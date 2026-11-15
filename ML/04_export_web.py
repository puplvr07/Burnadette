"""
ML/04_export_web.py  -  STAGE 4: cell_week tables -> small static JSON files for the web app.
No server needed: the front end just fetch()es these files.

    python ML/04_export_web.py belgium
    python ML/04_export_web.py core --out frontend/public/data

(Run it any time: before 03_calibrate.py you get the raw MODIS/VIIRS layers, after it you also get the harmonized ones.)
Per region: <out>/<slug>/cells.json     cell centers; a cell's index in this list is its ID everywhere else
            <out>/<slug>/calendar.json  weekly totals for the whole region (feeds the calendar heatmap)
            <out>/<slug>/<year>.json    per week: which cells are active (only active ones are stored)
            <out>/<slug>/info.json
Shared:      <out>/regions.json (dropdown + bbox)   <out>/meta.json (gaps, caveats, how to read nulls)
In the files:  null = no data for that sensor that week.  An empty list [] = data exists, no fire.
"""
import datetime
import json
import os
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))
import config
import store


def dump(obj, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, separators=(',', ':'), allow_nan=False)


def clean_num(x, nd=3):
    return None if pd.isna(x) else round(float(x), nd)


def clean_count(x):
    return None if pd.isna(x) else int(x)


def export_region(slug, out_dir):
    base = os.path.join(config.OUT_DIR, f'cell_week_{slug}')
    if not store.exists(base):
        print(f'{slug}: no cell_week table yet (run 02_aggregate.py). Skipping.')
        return False
    r = config.REGIONS[slug]
    t = store.read(base)
    for c in ('modis_active', 'viirs_active'):
        t[c] = t[c].astype('float64')                      # pd.NA -> NaN, so we can tell "no data" from 0
    # trim leading weeks where NO sensor had data yet (e.g. Jan-Oct 2000, or the partial week of 1999-12-27)
    has_data = t.modis_active.notna() | t.viirs_active.notna()
    t = t[t.week_start >= t.loc[has_data, 'week_start'].min()].copy()
    cells = t[['cell_id', 'lat', 'lon']].drop_duplicates().sort_values('cell_id').reset_index(drop=True)
    t['ci'] = t.cell_id.map({c: i for i, c in enumerate(cells.cell_id)})
    has_h = 'harmonized_value' in t.columns
    has_a = 'anomaly' in t.columns
    d = os.path.join(out_dir, slug)

    dump({'region': slug, 'cell_size_deg': config.RES, 'cells': [[float(a), float(b)] for a, b in zip(cells.lat, cells.lon)]}, os.path.join(d, 'cells.json'))

    # calendar.json: weekly totals for the whole region
    g = t.groupby('week_start')
    cal = pd.DataFrame({'modis': g.modis_active.sum(min_count=1), 'viirs': g.viirs_active.sum(min_count=1)})
    extra = {}
    rw_base = os.path.join(config.OUT_DIR, f'region_week_{slug}')
    if has_h and store.exists(rw_base):                    # whole-region series made by 03_calibrate.py
        rw = store.read(rw_base).set_index('week_start').reindex(cal.index)
        for name, col in (('harmonized_cells', 'harmonized_cells'), ('harmonized_low', 'harmonized_low'), ('harmonized_high', 'harmonized_high')):
            extra[name] = [clean_num(x, 2) for x in rw[col]]
        for name in ('anomaly_region', 'anomaly_modis_only', 'anomaly_viirs_only'):
            extra[name] = [clean_num(x, 1) for x in rw[name]]
        extra['source'] = [None if pd.isna(x) else x for x in rw['source']]
        extra['flags'] = [[] if (pd.isna(x) or x == '') else str(x).split(';') for x in rw['flags']]
    dump({'region': slug, 'cells_total': int(len(cells)), 'week_start': cal.index.tolist(),
            'modis_active_cells': [clean_count(x) for x in cal.modis],
            'viirs_active_cells': [clean_count(x) for x in cal.viirs], **extra},
            os.path.join(d, 'calendar.json'))

    # one file per year: which cells are active each week
    for year, gy in t.groupby('year'):
        weeks = {}
        for wk, gw in gy.groupby('week_start'):
            entry = {}
            for s in ('modis', 'viirs'):
                col = gw[f'{s}_active']
                entry[s] = None if col.isna().all() else gw.ci[col == 1].astype(int).tolist()
            if has_h:
                hv = gw.harmonized_value.round(3)
                if hv.isna().all():
                    entry['harmonized_default'], entry['harmonized'] = None, None
                else:
                    default = float(hv.mode().iloc[0])             # the value almost every cell has that week
                    ex = gw[hv.notna() & (hv != default)]
                    entry['harmonized_default'] = default           # every cell NOT listed has this value
                    entry['harmonized'] = [[int(i), clean_num(v)] for i, v in zip(ex.ci, hv[ex.index])]
                if has_a:
                    hi = gw[gw.anomaly >= config.CAL['anom_high']]
                    entry['anomaly_high'] = [[int(i), clean_num(v, 1)] for i, v in zip(hi.ci, hi.anomaly)]
            weeks[wk] = entry
        dump({'region': slug, 'year': int(year), 'weeks': weeks}, os.path.join(d, f'{int(year)}.json'))

    calsum = None                                    # summary of stage 3, so the UI can show honest badges
    cal_path = os.path.join(config.OUT_DIR, f'calibration_{slug}.json')
    if os.path.exists(cal_path):
        with open(cal_path, encoding='utf-8') as f:
            c = json.load(f)
        v = (c.get('validation') or {}).get('leave_one_year_out')
        keys = ('r_calibrated', 'r_raw_modis', 'bias_pct_calibrated', 'bias_pct_raw_modis', 'mae_calibrated', 'mae_raw_modis')
        calsum = {'overlap_years': [c['overlap_years'][0], c['overlap_years'][-1]], 'validated': bool(c['validated']),
                    'low_sensitivity_months': c['low_sensitivity_months'],
                    'modis_sensitivity_by_month': c['modis_sensitivity_by_month'],
                    'validation': None if v is None else {k: clean_num(v[k], 2) for k in keys}}
    min_lat, max_lat, min_lon, max_lon = r['bbox']
    dump({'slug': slug, 'name': r['name'], 'country': r['country'], 'tier': r['tier'], 'regime': r['regime'],
            'bbox': {'min_lat': min_lat, 'max_lat': max_lat, 'min_lon': min_lon, 'max_lon': max_lon},
            'cell_size_deg': config.RES, 'n_cells': int(len(cells)),
            'first_week': t.week_start.min(), 'last_week': t.week_start.max(),
            'years': [int(t.year.min()), int(t.year.max())], 'has_harmonized': bool(has_h), 'calibration': calsum,
            'files': {'cells': f'{slug}/cells.json', 'calendar': f'{slug}/calendar.json', 'year': f'{slug}/{{year}}.json'}},
            os.path.join(d, 'info.json'))
    print(f'{slug}: exported {len(cells)} cells, {t.week_start.nunique()} weeks, years {t.year.min()}-{t.year.max()}')
    return True


def write_shared(out_dir):
    infos = []
    for slug in config.REGIONS:                              # keep config order
        p = os.path.join(out_dir, slug, 'info.json')
        if os.path.exists(p):
            with open(p, encoding='utf-8') as f:
                infos.append(json.load(f))
    dump({'regions': infos}, os.path.join(out_dir, 'regions.json'))
    dump({
        'generated': datetime.datetime.now().isoformat(timespec='seconds'),
        'cell_size_deg': config.RES,
        'period': 'weekly, weeks start on Monday (week_start is that Monday)',
        'how_to_read': {'null': 'no data for that sensor that week (not the same as no fire)',
                        'empty list': 'sensor had data, no fire detected in the cell that week',
                        'cell index': 'position of the cell in <region>/cells.json'},
        'known_gaps': [{k: v for k, v in g.items()} for g in config.KNOWN_GAPS],
        'caveats': [
            'A quiet week does not always mean no fire: the hotspot data has no cloud or missing-data information.',
            'Before 2012 only MODIS exists. Harmonized values for that period are MODIS scaled using the 2012-2025 overlap, which assumes the sensor relationship was the same earlier.',
            'Where fires are small, MODIS sees only a fraction of what VIIRS sees, so scaled values there are less certain.',
            'Static heat sources (industry) are removed with NASA type codes plus an extra persistence rule; a few may remain or be removed in error.',
            'Current-year data may come from near-real-time processing and can be revised later.']},
        os.path.join(out_dir, 'meta.json'))


def folder_size_mb(path):
    return sum(os.path.getsize(os.path.join(a, f)) for a, _, fs in os.walk(path) for f in fs) / 1024 / 1024


if __name__ == '__main__':
    slugs, opts = config.cli(sys.argv[1:])
    out = opts['out'] or config.WEB_DIR
    for s in slugs:
        export_region(s, out)
    write_shared(out)
    print(f'\nweb data folder: {out}  ({folder_size_mb(out):.2f} MB total)')
