"""
ML/inspect_persistent.py  -  what would the persistence filter remove, and is that sensible for this region?

    python ML/inspect_persistent.py cambodia            (S-NPP, first year found)
    python ML/inspect_persistent.py cambodia SNPP 2016
    python ML/inspect_persistent.py cambodia MODIS 2016
It reads the raw file, applies the same first filters as 01_clean.py (type 0, not low confidence) and then looks at
~1 km spots that fire on many different dates. Open a few top spots in the map links: factory, kiln, power plant,
quarry = static heat (removing is right). Farmland or forest = real repeated burning (removing it is wrong).
"""
import os
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))
import config
from pipeline import load


def main(slug, sensor='SNPP', year=None):
    kind = config.SENSORS[sensor]['kind']
    years = [year] if year else config.sensor_years(sensor)
    path = next((config.raw_path(slug, sensor, y) for y in years if os.path.exists(config.raw_path(slug, sensor, y))), None)
    if path is None:
        sys.exit(f'No raw {sensor} file found for {slug}. Looked in {config.RAW_DIR}/{config.SENSORS[sensor]["folder"]}/')
    d = load(path, kind)
    if d['type'].notna().any():
        d = d[d.type == 0]
    d = d[d.conf_class != 'l'].copy()
    d['spot'] = d.latitude.round(2).astype(str) + ', ' + d.longitude.round(2).astype(str)
    d['date'] = d.datetime_utc.dt.normalize()
    g = d.groupby('spot').agg(rows=('frp', 'size'), dates=('date', 'nunique'), months=('date', lambda s: s.dt.month.nunique()), frp=('frp', 'median'))
    print(f'{os.path.basename(path)}: {len(d)} rows in {len(g)} spots (after type 0 and low-confidence filters)\n')
    print('threshold (different dates) -> share of ROWS removed | share of SPOTS removed')
    for th in (3, 5, 10, 20, 40):
        hit = g[g.dates >= th]
        print(f'  >= {th:<3} dates : {hit.rows.sum() / len(d):>6.1%} of rows | {len(hit) / len(g):>6.1%} of spots')
    print(f'\ncurrent setting for {slug}: {config.persist_min_dates(slug)} dates\n')
    print('top 15 spots (most different dates):')
    top = g.sort_values('dates', ascending=False).head(15)
    for spot, r in top.iterrows():
        print(f'  {spot:>16}  {int(r.dates):>3} dates  {int(r.months):>2} months  {int(r.rows):>5} rows  '
                f'median FRP {r.frp:>5.1f}   https://www.google.com/maps?q={spot.replace(" ", "")}')


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    main(a[0].lower(), a[1].upper() if len(a) > 1 else 'SNPP', int(a[2]) if len(a) > 2 else None)