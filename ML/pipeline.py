"""
ML/pipeline.py  -  Step 1 of harmonization: load, normalize and clean FIRMS hotspot CSVs.
"""
import sys
import numpy as np
import pandas as pd

SAT = {'N': 'SNPP', 'N20': 'NOAA20', 'N21': 'NOAA21'}


def load(path, sensor):
    """Read one FIRMS CSV and convert it to the shared schema. sensor = 'MODIS' or 'VIIRS'."""
    d = pd.read_csv(path, dtype={'acq_time': str, 'confidence': str})
    d['sensor'] = sensor
    d['satellite'] = d['satellite'].replace(SAT)
    d['datetime_utc'] = pd.to_datetime(d.acq_date + ' ' + d.acq_time.str.zfill(4), format='%Y-%m-%d %H%M')
    if sensor == 'MODIS':
        c = pd.to_numeric(d.confidence)
        d['conf_class'] = pd.cut(c, [-1, 29, 79, 100], labels=['l', 'n', 'h']).astype(str)
        d['conf_raw'] = c
        d = d.rename(columns={'brightness': 'bt_mir', 'bright_t31': 'bt_tir'})
    else:
        d['conf_class'] = d.confidence
        d['conf_raw'] = np.nan
        d = d.rename(columns={'bright_ti4': 'bt_mir', 'bright_ti5': 'bt_tir'})
    if 'type' not in d.columns:          # near-real-time (2026) files have no 'type' column
        d['type'] = np.nan
    d['pixel_km2'] = d.scan * d.track
    keep = ['datetime_utc', 'latitude', 'longitude', 'sensor', 'satellite', 'conf_class',
            'conf_raw', 'frp', 'bt_mir', 'bt_tir', 'pixel_km2', 'daynight', 'type']
    return d[keep]


def flag_persistent(d, min_dates=5):
    """Flag ~1 km spots that fire on many different dates within one year (likely static sources)."""
    key = d.latitude.round(2).astype(str) + '_' + d.longitude.round(2).astype(str)
    year = d.datetime_utc.dt.year
    date = d.datetime_utc.dt.normalize()                      # the calendar day, without the time
    n_dates = date.groupby([key, year]).transform('nunique')  # built-in count: ~100x faster than a lambda
    d = d.copy()
    d['persistent'] = n_dates >= min_dates
    return d


def clean(d, label='', min_dates=5, verbose=True):
    """Keep presumed vegetation fires, drop low confidence, drop persistent spots. Logs every step."""
    steps = [('input rows', len(d))]
    if d['type'].notna().any():
        d = d[d.type == 0]
        steps.append(('type == 0 (vegetation fire)', len(d)))
    else:
        steps.append(('type column missing (NRT): static sources NOT removed by NASA type', len(d)))
    d = d[d.conf_class != 'l']
    steps.append(('drop low confidence', len(d)))
    d = flag_persistent(d, min_dates)
    d = d[~d.persistent]
    steps.append((f'drop persistent spots (>= {min_dates} dates/year)', len(d)))
    if verbose:
        print(f'--- {label} ---')
        prev = None
        for name, n in steps:
            print(f'  {name:<70} {n:>8}' + (f'   (removed {prev - n})' if prev is not None and prev != n else ''))
            prev = n
    return d


def to_cell_period(d, res=0.5, period='M'):
    """Aggregate to grid cells and periods. 'active' = 1 for every cell-period with a detection."""
    g = d.assign(cx=(d.longitude // res).astype(int), cy=(d.latitude // res).astype(int), period=d.datetime_utc.dt.to_period(period).dt.start_time)

    out = g.groupby(['cx', 'cy', 'period', 'sensor']).agg(n_hotspots=('frp', 'size'), total_frp=('frp', 'sum')).reset_index()

    out['active'] = 1

    return out


if __name__ == '__main__':
    # make sures the passed argument is 4 files
    if len(sys.argv) != 4:
        sys.exit(__doc__)

    modis = clean(load(sys.argv[1], 'MODIS'), 'MODIS')
    snpp = clean(load(sys.argv[2], 'VIIRS'), 'S-NPP')
    n20 = clean(load(sys.argv[3], 'VIIRS'), 'NOAA-20')
    print(f'\nCleaned rows -> MODIS {len(modis)}, S-NPP {len(snpp)}, NOAA-20 {len(n20)}')
    print('Expected      -> MODIS 40, S-NPP 298, NOAA-20 295')