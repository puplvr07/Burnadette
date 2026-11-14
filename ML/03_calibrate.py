"""
ML/03_calibrate.py  -  STAGE 3: harmonize MODIS and VIIRS, validate, stitch, score anomalies.

    python ML/03_calibrate.py cambodia          (or: core, all, a,b)      add --no-plot to skip the picture
Needs:  processed/cell_week_<region>.*   from 02_aggregate.py (MODIS + S-NPP, ideally 2012-2025 plus MODIS 2000-2011)
Writes: processed/cell_week_<region>.*          the same table + harmonized_value, harmonized_source, anomaly,
                                                low_sensitivity, uncertainty_low, uncertainty_high, flags
        processed/region_week_<region>.*         one row per week for the whole region (feeds the calendar heatmap)
        processed/calibration_<region>.json      the calibration numbers + validation results
        docs/calibration_report_<region>.md      readable summary for the write-up
        docs/calibration_<region>.png            a picture to look at (needs matplotlib)

THE IDEA (plain words)
VIIRS is the reference. In the overlap years (2012-2025) we see, for every cell and week, both what MODIS saw and what
VIIRS saw. We learn:  "when MODIS says X in a cell, how likely is it that VIIRS shows fire there that week?"
X has 3 states:  2 = MODIS active this week,  1 = MODIS active in the week before/after only,  0 = nothing nearby.
It also looks at how busy MODIS is across the whole region that week (quiet / some / busy), so a huge fire
season is not treated like an ordinary one. The answer is learned per calendar month. Before 2012 (MODIS only) we replace MODIS by that learned probability.
So  harmonized_value = "VIIRS-equivalent chance of fire in this cell this week":
    from 2012 on   : what VIIRS really saw (0 or 1)
    before 2012    : the learned probability (a number between 0 and 1)
Add the values over many cells (an area, a region) and you get the expected number of VIIRS-active cells.
Compare areas and totals, not single pre-2012 cells.
"""
import json
import os
import sys
import warnings

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))
import config
import store

N_STATE = 3                       # 0 = nothing nearby, 1 = active in a neighbouring week, 2 = active this week
N_CTX = 3                         # how busy MODIS is across the whole region that week: 0 quiet, 1 some, 2 busy
N_SC = N_STATE * N_CTX
N_G = 12 * N_SC                   # groups = month x state x context
NEW_COLS = ['harmonized_value', 'harmonized_source', 'anomaly', 'low_sensitivity',
            'uncertainty_low', 'uncertainty_high', 'flags']
SRC_NAMES = {1: 'viirs', 2: 'modis_scaled', 3: 'modis_fill'}


# ----------------------------------------------------------------------------------------- helpers
def to_array(col):
    return col.to_numpy(dtype='float64', na_value=np.nan)


def shift(a, k):
    """Shift along the time axis by k weeks; the gap is NaN."""
    out = np.full_like(a, np.nan)
    if k > 0:
        out[:, k:] = a[:, :-k]
    elif k < 0:
        out[:, :k] = a[:, -k:]
    else:
        out[:] = a
    return out


def smooth(a, k):
    """Centered mean over k weeks, ignoring NaN."""
    half = k // 2
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        return np.nanmean(np.stack([shift(a, s) for s in range(-half, half + 1)]), axis=0)


def gap_weeks(weeks, gap):
    """True for weeks that overlap the gap's dates."""
    start, end = pd.Timestamp(gap['start']), pd.Timestamp(gap['end'])
    return np.asarray((weeks <= end) & (weeks + pd.Timedelta(days=6) >= start))


def pearson(a, b):
    if len(a) < 3 or np.std(a) == 0 or np.std(b) == 0:
        return None
    return float(np.corrcoef(a, b)[0, 1])


# ------------------------------------------------------------------------------- the calibration
def modis_state(M):
    """0 nothing nearby, 1 active in a neighbouring week, 2 active this week, NaN = no MODIS data."""
    near = np.fmax(np.fmax(shift(M, 1), shift(M, -1)), M)
    return np.where(np.isnan(M), np.nan, np.where(M == 1, 2, np.where(near == 1, 1, 0)))


def counts_by_year(G, V, usable, year_idx, n_years):
    """n[y, g] = cell-weeks in group g in year y;  k[y, g] = how many of them VIIRS saw as active."""
    yi = np.broadcast_to(year_idx[None, :], G.shape)
    ok = usable & (G >= 0) & ~np.isnan(V) & (yi >= 0)
    key = yi[ok] * N_G + G[ok]
    n = np.bincount(key, minlength=n_years * N_G).reshape(n_years, N_G).astype(float)
    k = np.bincount(key, weights=V[ok], minlength=n_years * N_G).reshape(n_years, N_G)
    return n, k


def modis_context(M, usable_overlap):
    """Per week: 0 = MODIS saw no fire anywhere in the region, 1 = a little, 2 = a lot (above the typical busy week).
    This stops the model from treating a huge fire season like an ordinary one."""
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        frac = np.nanmean(M, axis=0)
    pos = frac[usable_overlap & ~np.isnan(frac) & (frac > 0)]
    cut = float(np.median(pos)) if len(pos) >= 5 else 1.0
    ctx = np.where(np.isnan(frac), -1, np.where(frac == 0, 0, np.where(frac <= cut, 1, 2)))
    return ctx, cut


def fit_p(n_tot, k_tot, ridge):
    """P(VIIRS active | month, MODIS state, regional busyness); thin groups are pulled toward the all-months
    value of the same (state, busyness)."""
    ns = n_tot.reshape(12, N_SC).sum(0)
    ks = k_tot.reshape(12, N_SC).sum(0)
    p_pool = np.where(ns > 0, ks / np.maximum(ns, 1), 0.0)
    return (k_tot + ridge * np.tile(p_pool, 12)) / (n_tot + ridge)


def uncertainty_band(n, k, p, ridge, boot, seed):
    """Between-year bootstrap band if there are enough years, otherwise a simple binomial band."""
    Y = n.shape[0]
    if Y >= config.CAL['min_overlap_years']:
        rng = np.random.default_rng(seed)
        P = np.empty((boot, N_G))
        for b in range(boot):
            w = np.bincount(rng.integers(0, Y, Y), minlength=Y)
            P[b] = fit_p(w @ n, w @ k, ridge)
        lo, hi = np.percentile(P, [10, 90], axis=0)
        return lo, hi, 'bootstrap over overlap years (10th-90th percentile)'
    se = np.sqrt(p * (1 - p) / (n.sum(0) + ridge))
    return np.clip(p - 1.28 * se, 0, 1), np.clip(p + 1.28 * se, 0, 1), 'binomial (too few overlap years for a bootstrap)'


def weekly_scores(p, G, V, M, usable_rows):
    """Region-wide weekly totals for one block of weeks: calibrated prediction, raw MODIS, actual VIIRS."""
    ok = usable_rows & (G >= 0) & ~np.isnan(V)
    pred = np.where(ok, p[np.clip(G, 0, None)], 0.0).sum(0)
    raw = np.where(ok, M, 0.0).sum(0)
    act = np.where(ok, V, 0.0).sum(0)
    return pred, raw, act


def summarize(pred, raw, act):
    def bias(x):
        return float((x.sum() - act.sum()) / act.sum() * 100) if act.sum() > 0 else None
    return {'weeks': int(len(act)),
            'r_calibrated': pearson(pred, act), 'r_raw_modis': pearson(raw, act),
            'mae_calibrated': float(np.abs(pred - act).mean()), 'mae_raw_modis': float(np.abs(raw - act).mean()),
            'bias_pct_calibrated': bias(pred), 'bias_pct_raw_modis': bias(raw)}


def validate(n, k, G, V, M, usable, year_idx, years, ridge):
    """Hold-out tests INSIDE the overlap: leave-one-year-out, and early-vs-late in time."""
    Y = len(years)
    n_tot, k_tot = n.sum(0), k.sum(0)
    P_, R_, A_, per_year = [], [], [], {}
    for j, y in enumerate(years):
        p = fit_p(n_tot - n[j], k_tot - k[j], ridge)
        cols = year_idx == j
        pred, raw, act = weekly_scores(p, G[:, cols], V[:, cols], M[:, cols], usable[:, cols])
        P_.append(pred); R_.append(raw); A_.append(act)
        per_year[int(y)] = {'predicted_active_cells': float(pred.sum()), 'actual_viirs_active_cells': float(act.sum()),
                            'raw_modis_active_cells': float(raw.sum())}
    out = {'leave_one_year_out': summarize(np.concatenate(P_), np.concatenate(R_), np.concatenate(A_)),
            'per_year': per_year}
    if Y >= 4:                                                    # does the relationship drift over time?
        half = Y // 2
        for name, fit_idx, test_idx in (('fit_early_test_late', range(half), range(half, Y)),
                                        ('fit_late_test_early', range(half, Y), range(half))):
            p = fit_p(n[list(fit_idx)].sum(0), k[list(fit_idx)].sum(0), ridge)
            cols = np.isin(year_idx, list(test_idx))
            out[name] = summarize(*weekly_scores(p, G[:, cols], V[:, cols], M[:, cols], usable[:, cols]))
            out[name]['fit_years'] = [int(years[i]) for i in fit_idx]
            out[name]['test_years'] = [int(years[i]) for i in test_idx]
    return out


# -------------------------------------------------------------------------------------- anomalies
def seasonal_percentile(X, weeks, window_days, min_ref):
    """Percentile (0-100) of each value among values from the same time of year (+-window_days) in ALL years."""
    doy = weeks.dayofyear.to_numpy()
    d = np.abs(doy[:, None] - doy[None, :])
    ref_mask = np.minimum(d, 365 - d) <= window_days
    out = np.full(X.shape, np.nan, dtype=np.float32)
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        for t in range(X.shape[1]):
            x = X[:, t]
            if np.isnan(x).all():
                continue
            ref = X[:, ref_mask[t]]
            valid = ~np.isnan(ref)
            less = ((ref < x[:, None]) & valid).sum(1)
            eq = ((ref == x[:, None]) & valid).sum(1)
            n = valid.sum(1)
            pct = np.where(n >= min_ref, 100.0 * (less + 0.5 * eq) / np.maximum(n, 1), np.nan)
            out[:, t] = np.where(np.isnan(x), np.nan, pct)
    return out


# ------------------------------------------------------------------------------------- main routine
def calibrate_region(slug, make_plot=True):
    cfg = config.CAL
    r = config.REGIONS[slug]
    base = os.path.join(config.OUT_DIR, f'cell_week_{slug}')
    print(f'##### {r["name"]} ({slug}) #####')
    if not store.exists(base):
        print('  no cell_week table yet: run 02_aggregate.py first. Skipping.\n')
        return
    t = store.read(base)
    t = t.drop(columns=[c for c in NEW_COLS if c in t.columns])          # so the script is safe to re-run
    t = t.sort_values(['cell_id', 'week_start']).reset_index(drop=True)
    n_cells, n_weeks = t.cell_id.nunique(), t.week_start.nunique()
    assert len(t) == n_cells * n_weeks, 'table is not a complete cell x week grid: re-run 02_aggregate.py'
    weeks = pd.DatetimeIndex(pd.to_datetime(np.sort(t.week_start.unique())))
    M = to_array(t.modis_active).reshape(n_cells, n_weeks)
    V = to_array(t.viirs_active).reshape(n_cells, n_weeks)

    # ---- which weeks may be used to LEARN the relationship: both sensors present, outside known outages ----
    bad_week = np.zeros(n_weeks, dtype=bool)
    for g in config.KNOWN_GAPS:
        bad_week |= gap_weeks(weeks, g)
    usable = np.broadcast_to(~bad_week[None, :], M.shape)
    both = ~np.isnan(M) & ~np.isnan(V) & usable
    years_all = weeks.year.to_numpy()
    fit_years = sorted({int(y) for y in np.unique(years_all[both.any(0)])})
    if not fit_years:
        print('  MODIS and VIIRS never overlap in this table: nothing to calibrate. Skipping.\n')
        return
    year_idx = np.array([fit_years.index(y) if y in fit_years else -1 for y in years_all])
    print(f'overlap years used for fitting: {fit_years}')

    state = modis_state(M)
    month_idx = weeks.month.to_numpy() - 1
    overlap_week = both.any(0)
    ctx, ctx_cut = modis_context(M, overlap_week)
    G = np.where(np.isnan(state) | (ctx[None, :] < 0), -1,
                 month_idx[None, :] * N_SC + np.nan_to_num(state) * N_CTX + np.clip(ctx, 0, None)[None, :]).astype(int)

    n, k = counts_by_year(G, V, usable, year_idx, len(fit_years))
    p = fit_p(n.sum(0), k.sum(0), cfg['ridge'])
    p_lo, p_hi, band_method = uncertainty_band(n, k, p, cfg['ridge'], cfg['boot'], cfg['seed'])

    # ---- how much does MODIS see of what VIIRS sees? (per calendar month) ----
    sens, n_pos, false_alarm = np.full(12, np.nan), np.zeros(12, dtype=int), np.full(12, np.nan)
    for m in range(12):
        sel = both & (month_idx == m)[None, :]
        v1, v0 = sel & (V == 1), sel & (V == 0)
        n_pos[m] = int(v1.sum())
        if v1.sum() > 0:
            sens[m] = float((M[v1] == 1).mean())
        if v0.sum() > 0:
            false_alarm[m] = float((M[v0] == 1).mean())
    low_sens_month = np.where(np.isnan(sens), True, (sens < cfg['low_sens']) | (n_pos < cfg['min_pos']))
    print(f'MODIS sensitivity (share of VIIRS-active cell-weeks that MODIS also shows), overall: '
          f'{np.nansum(sens * n_pos) / max(n_pos.sum(), 1):.0%}  ({n_pos.sum()} VIIRS-active cell-weeks)')

    # ---- hold-out validation (inside the overlap) ----
    if len(fit_years) >= cfg['min_overlap_years']:
        validation = validate(n, k, G, V, M, usable, year_idx, np.array(fit_years), cfg['ridge'])
        v = validation['leave_one_year_out']
        print(f'leave-one-year-out: r={v["r_calibrated"]} (raw MODIS r={v["r_raw_modis"]}), '
                f'bias {v["bias_pct_calibrated"]}% (raw MODIS bias {v["bias_pct_raw_modis"]}%)')
    else:
        validation = None
        print(f'only {len(fit_years)} overlap year(s): hold-out validation SKIPPED (need at least '
                f'{cfg["min_overlap_years"]}). Do not trust the calibration numbers yet.')

    # ---- stitch: VIIRS where it is trustworthy, calibrated MODIS elsewhere ----
    snpp_gap = np.zeros(n_weeks, dtype=bool)
    for g in config.KNOWN_GAPS:
        if g['affects'] == 'viirs':
            snpp_gap |= gap_weeks(weeks, g)
    v_ok = ~np.isnan(V) & ~snpp_gap[None, :]
    m_ok = ~v_ok & (G >= 0)
    Gc = np.clip(G, 0, None)
    H = np.full(M.shape, np.nan)
    LO, HI = np.full(M.shape, np.nan), np.full(M.shape, np.nan)
    H[v_ok], LO[v_ok], HI[v_ok] = V[v_ok], V[v_ok], V[v_ok]
    H[m_ok], LO[m_ok], HI[m_ok] = p[Gc][m_ok], p_lo[Gc][m_ok], p_hi[Gc][m_ok]
    viirs_start = pd.Timestamp(config.SENSORS['SNPP']['start'])
    before_viirs = np.asarray(weeks + pd.Timedelta(days=6) < viirs_start)
    SRC = np.zeros(M.shape, dtype=np.int8)
    SRC[v_ok] = 1
    SRC[m_ok & before_viirs[None, :]] = 2
    SRC[m_ok & ~before_viirs[None, :]] = 3
    LS = (m_ok & low_sens_month[month_idx][None, :]).astype(np.int8)

    gap_masks = [(g['id'], gap_weeks(weeks, g)) for g in config.KNOWN_GAPS]
    flag_week = np.array([';'.join(gid for gid, mask in gap_masks if mask[i]) for i in range(n_weeks)])

    # ---- anomalies: per cell, and for the whole region ----
    S = smooth(H, cfg['smooth_weeks'])
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        clim = np.nanmean(S, axis=1)
    A = seasonal_percentile(S, weeks, cfg['season_window_days'], cfg['min_ref'])
    A[np.nan_to_num(clim, nan=0.0) < cfg['min_clim'], :] = np.nan

    any_h = ~np.isnan(H).all(0)
    R = np.where(any_h, np.nansum(H, axis=0), np.nan)
    R_lo = np.where(any_h, np.nansum(LO, axis=0), np.nan)
    R_hi = np.where(any_h, np.nansum(HI, axis=0), np.nan)
    A_region = seasonal_percentile(smooth(R[None, :], cfg['smooth_weeks']), weeks, cfg['season_window_days'], cfg['min_ref'])[0]
    # within-sensor cross-checks: each instrument compared only with its OWN history (needs no calibration)
    modis_cells = np.where(np.isnan(M).all(0), np.nan, np.nansum(M, axis=0))
    viirs_cells = np.where(v_ok.any(0), np.nansum(np.where(v_ok, V, np.nan), axis=0), np.nan)
    A_modis = seasonal_percentile(smooth(modis_cells[None, :], cfg['smooth_weeks']), weeks, cfg['season_window_days'], cfg['min_ref'])[0]
    A_viirs = seasonal_percentile(smooth(viirs_cells[None, :], cfg['smooth_weeks']), weeks, cfg['season_window_days'], cfg['min_ref'])[0]

    # ---- write the cell_week table back (same rows, new columns) ----
    t['harmonized_value'] = H.ravel()
    t['harmonized_source'] = pd.Series(SRC.ravel()).map(SRC_NAMES).to_numpy()
    t['anomaly'] = A.ravel()
    t['low_sensitivity'] = LS.ravel()
    t['uncertainty_low'] = LO.ravel()
    t['uncertainty_high'] = HI.ravel()
    t['flags'] = np.tile(flag_week, n_cells)
    print('saved', store.save(t, base))
    n_keep, kb = store.write_sample(t, os.path.join(config.SAMPLE_DIR, f'cell_week_{slug}_sample.csv'))
    print(f'saved sample ({kb:.0f} KB, {n_keep} cells)')

    reg = pd.DataFrame({
        'week_start': weeks.strftime('%Y-%m-%d'),
        'modis_cells': modis_cells,
        'viirs_cells': np.where(np.isnan(V).all(0), np.nan, np.nansum(V, axis=0)),
        'harmonized_cells': R, 'harmonized_low': R_lo, 'harmonized_high': R_hi,
        'anomaly_region': A_region, 'anomaly_modis_only': A_modis, 'anomaly_viirs_only': A_viirs,
        'source': pd.Series(SRC[0]).map(SRC_NAMES).to_numpy(), 'flags': flag_week})
    print('saved', store.save(reg, os.path.join(config.OUT_DIR, f'region_week_{slug}')))

    # ---- the calibration file and the report ----
    months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    table = {months[m]: {f'state{s}_busy{c}': {'p': round(float(p[m * N_SC + s * N_CTX + c]), 4),
                                               'low': round(float(p_lo[m * N_SC + s * N_CTX + c]), 4),
                                               'high': round(float(p_hi[m * N_SC + s * N_CTX + c]), 4),
                                               'cell_weeks': int(n.sum(0)[m * N_SC + s * N_CTX + c])}
                        for s in range(N_STATE) for c in range(N_CTX)} for m in range(12)}
    cal = {'region': slug, 'settings': cfg, 'overlap_years': fit_years, 'band_method': band_method,
            'busy_week_cut_share_of_cells': round(ctx_cut, 4),
            'p_viirs_active_given_modis_state': table,
            'modis_sensitivity_by_month': {months[m]: None if np.isnan(sens[m]) else round(float(sens[m]), 3) for m in range(12)},
            'modis_false_alarm_rate_by_month': {months[m]: None if np.isnan(false_alarm[m]) else round(float(false_alarm[m]), 3) for m in range(12)},
            'viirs_positive_cell_weeks_by_month': {months[m]: int(n_pos[m]) for m in range(12)},
            'low_sensitivity_months': [months[m] for m in range(12) if low_sens_month[m]],
            'validation': validation, 'validated': validation is not None}
    with open(os.path.join(config.OUT_DIR, f'calibration_{slug}.json'), 'w', encoding='utf-8') as f:
        json.dump(cal, f, indent=1)
    write_report(slug, r['name'], cal, reg)
    if make_plot:
        draw_plot(slug, reg, cal, weeks)
    print()


def fmt(x, nd=2):
    return 'n/a' if x is None else f'{x:.{nd}f}'


def write_report(slug, name, cal, reg):
    L = [f'# Calibration report: {name}', '',
        f'*Overlap years used to learn the MODIS-to-VIIRS relationship:* {cal["overlap_years"]}', '',
        '## How MODIS relates to VIIRS here', '',
        '| Month | MODIS sees this share of VIIRS fire cell-weeks | VIIRS-active cell-weeks | MODIS false alarms |', '|---|---|---|---|']
    for m in cal['modis_sensitivity_by_month']:
        sens_m = cal['modis_sensitivity_by_month'][m]
        fa_m = cal['modis_false_alarm_rate_by_month'][m]
        sens_txt = 'n/a' if sens_m is None else '{:.0%}'.format(sens_m)
        fa_txt = 'n/a' if fa_m is None else '{:.1%}'.format(fa_m)
        L.append('| {} | {} | {} | {} |'.format(m, sens_txt, cal['viirs_positive_cell_weeks_by_month'][m], fa_txt))
    L += ['', f'Months flagged **low sensitivity** (MODIS sees little, or too little data): {", ".join(cal["low_sensitivity_months"]) or "none"}.', '',
            '## Validation (tested on years the model did not learn from)', '']
    v = cal['validation']
    if v is None:
        L.append('**Not done: fewer than the required number of overlap years.** The numbers above are not validated. '
                'Download more overlap years (MODIS + S-NPP 2012-2025) and re-run.')
    else:
        L += ['| Test | r (calibrated) | r (raw MODIS) | bias % (calibrated) | bias % (raw MODIS) |', '|---|---|---|---|---|']
        for key, label in (('leave_one_year_out', 'Leave one year out'), ('fit_early_test_late', 'Learn early years, test late years'),
                            ('fit_late_test_early', 'Learn late years, test early years')):
            if key in v:
                x = v[key]
                L.append(f'| {label} | {fmt(x["r_calibrated"])} | {fmt(x["r_raw_modis"])} | {fmt(x["bias_pct_calibrated"], 1)} | {fmt(x["bias_pct_raw_modis"], 1)} |')
        L += ['', '*r* = how closely the weekly region-wide count of VIIRS-active cells is followed. '
                '*bias %* = total predicted minus total actual, as a share of actual. '
                'The early-vs-late rows show whether the relationship drifts over time. If those two disagree a lot, '
                'the pre-2012 values are shakier than the leave-one-year-out numbers suggest.']
    first, last = reg.week_start.min(), reg.week_start.max()
    L += ['', '## Honest limits', '',
            f'- Series covers {first} to {last}.',
            '- Before 2012 the values are *expected* VIIRS-equivalent fire (probabilities), not observations. Use area totals, not single cells.',
            '- The pre-2012 relationship is assumed to equal the 2012-2025 one. That cannot be tested directly.',
            '- Calibrations like this tend to pull extremes toward the middle: an exceptionally bad pre-2012 season is likely '
            'UNDERSTATED, and ordinary seasons slightly overstated. For "was that season unusual?" also look at '
            '`anomaly_modis_only` (MODIS compared only with its own history), which needs no calibration.',
            f'- Uncertainty band method: {cal["band_method"]}.',
            '- A quiet week can mean cloud or no satellite pass: hotspot files have no cloud information.']
    os.makedirs(config.DOCS_DIR, exist_ok=True)
    with open(os.path.join(config.DOCS_DIR, f'calibration_report_{slug}.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(L) + '\n')
    print(f'wrote docs/calibration_report_{slug}.md')


def draw_plot(slug, reg, cal, weeks):
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
    except ImportError:
        print('  (matplotlib not installed: skipping the picture. pip install matplotlib)')
        return
    fig, ax = plt.subplots(2, 1, figsize=(11, 7))
    ax[0].plot(weeks, reg.modis_cells, color='tab:orange', lw=0.7, label='MODIS (raw)')
    ax[0].plot(weeks, reg.viirs_cells, color='tab:blue', lw=0.7, label='VIIRS (raw)')
    ax[0].plot(weeks, reg.harmonized_cells, color='black', lw=1.0, label='Harmonized (VIIRS-equivalent)')
    ax[0].fill_between(weeks, reg.harmonized_low, reg.harmonized_high, color='grey', alpha=0.3, label='uncertainty')
    ax[0].axvline(pd.Timestamp(config.SENSORS['SNPP']['start']), color='red', ls='--', lw=0.8)
    ax[0].set_title(f'{slug}: active cells per week (look for a jump at the red line = 2012)')
    ax[0].legend(loc='upper left', fontsize=8)
    months = list(cal['modis_sensitivity_by_month'])
    vals = [np.nan if cal['modis_sensitivity_by_month'][m] is None else cal['modis_sensitivity_by_month'][m] for m in months]
    ax[1].bar(months, vals, color='tab:orange')
    ax[1].axhline(config.CAL['low_sens'], color='red', ls='--', lw=0.8)
    ax[1].set_ylim(0, 1)
    ax[1].set_title('Share of VIIRS fire cell-weeks that MODIS also shows (red line = low-sensitivity limit)')
    fig.tight_layout()
    path = os.path.join(config.DOCS_DIR, f'calibration_{slug}.png')
    os.makedirs(config.DOCS_DIR, exist_ok=True)
    fig.savefig(path, dpi=110)
    plt.close(fig)
    print(f'wrote {path}')


if __name__ == '__main__':
    slugs, opts = config.cli(sys.argv[1:])
    for s in slugs:
        calibrate_region(s, opts['plot'])