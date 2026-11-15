"""
ml_export_reader.py  -  reference reader/aggregator for the ML web export (frontend/public/data/).
Pure Python standard library, so the backend can copy it as is. Tested against the ML tables.

    region = load_region('frontend/public/data', 'cambodia')
    cells  = select_cells(region, (west, south, east, north))      # cell CENTERS, inclusive
    rows   = area_series(region, cells, 'harmonized')              # one dict per week
    anomaly = area_anomaly(rows)                                   # percentile 0-100 per week (or None)
"""
import datetime as dt
import json
import os


def _load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def load_region(data_dir, slug):
    base = os.path.join(data_dir, slug)
    info = _load(os.path.join(base, 'info.json'))
    cells = _load(os.path.join(base, 'cells.json'))['cells']          # [[lat, lon], ...]; position = cell index
    cal = _load(os.path.join(base, 'calendar.json'))                  # whole-region weekly series
    weeks = {}
    for y in range(info['years'][0], info['years'][1] + 1):
        p = os.path.join(base, f'{y}.json')
        if os.path.exists(p):
            weeks.update(_load(p)['weeks'])                           # {'YYYY-MM-DD': {modis, viirs, harmonized...}}
    return {'slug': slug, 'info': info, 'cells': cells, 'cal': cal, 'weeks': weeks}


def select_cells(region, bbox):
    """bbox = (west, south, east, north). A cell is selected if its CENTER is inside (edges inclusive)."""
    west, south, east, north = bbox
    return [i for i, (lat, lon) in enumerate(region['cells']) if south <= lat <= north and west <= lon <= east]


def area_series(region, selected, source='harmonized'):
    """
    One row per week of the region's calendar. For the selected cells:
    value        = share of selected cells with fire (0-1), None = no data
    active_cells =  harmonized: expected number of VIIRS-equivalent active cells (fractional before 2012)
                    modis / viirs: how many selected cells that instrument saw as active
    low / high   =  range. Observed weeks: equal to value. Estimated weeks: the region's relative range
                    applied to this area (APPROXIMATE, not a validated interval for a sub-area).
    """
    sel, n = set(selected), len(selected)
    cal = region['cal']
    rows = []
    for k, wk in enumerate(cal['week_start']):
        entry = region['weeks'].get(wk, {})
        row = {'week_start': wk, 'value': None, 'active_cells': None, 'low': None, 'high': None,
               'source': cal.get('source', [None] * len(cal['week_start']))[k],
               'flags': (cal.get('flags') or [[]] * len(cal['week_start']))[k] or []}
        if n == 0:
            rows.append(row)
            continue
        if source in ('modis', 'viirs'):
            lst = entry.get(source)
            if lst is not None:
                count = sum(1 for i in lst if i in sel)
                row.update(value=count / n, active_cells=count, low=count / n, high=count / n)
        else:
            default = entry.get('harmonized_default')
            if default is not None:
                total = n * default + sum(v - default for i, v in (entry.get('harmonized') or []) if i in sel)
                total = max(total, 0.0)
                row.update(value=total / n, active_cells=total)
                reg, lo, hi = (cal['harmonized_cells'][k], cal['harmonized_low'][k], cal['harmonized_high'][k])
                if row['source'] == 'viirs' or not reg:           # observed week, or an all-zero region week
                    row.update(low=row['value'], high=row['value'])
                else:
                    row.update(low=row['value'] * lo / reg, high=row['value'] * hi / reg)
        rows.append(row)
    return rows


def area_anomaly(rows, smooth_weeks=3, window_days=21, min_ref=20):
    """
    'Unusually active for this time of year', percentile 0-100 (same rule as the ML stage 3):
    centered 3-week mean of the area value, compared with all weeks within +-21 days of the same time of year in ALL years.
    Needs at least 20 comparison weeks, otherwise None.
    """
    vals = [r['value'] for r in rows]
    half = smooth_weeks // 2
    sm = []
    for t in range(len(vals)):
        part = [v for v in vals[max(0, t - half): t + half + 1] if v is not None]
        sm.append(sum(part) / len(part) if part else None)
    doy = [dt.date.fromisoformat(r['week_start']).timetuple().tm_yday for r in rows]
    buckets = {}
    for v, d in zip(sm, doy):
        if v is not None:
            buckets.setdefault(d, []).append(v)
    near = {}                                                       # day-of-year -> days of year within the window
    for d in set(doy):
        near[d] = [u for u in buckets if min(abs(d - u), 365 - abs(d - u)) <= window_days]
    out = []
    for t, x in enumerate(sm):
        if x is None:
            out.append(None)
            continue
        less = eq = n = 0
        for u in near[doy[t]]:
            for v in buckets[u]:
                n += 1
                less += v < x
                eq += v == x
        out.append(100.0 * (less + 0.5 * eq) / n if n >= min_ref else None)
    return out
