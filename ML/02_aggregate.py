"""
ML/02_aggregate.py  -  STAGE 2: cleaned files -> cell_week table (MODIS and VIIRS side by side).

    python ML/02_aggregate.py belgium      (or: core, all, a,b)
Writes: processed/cell_week_<region>.parquet (git-ignored)  and  processed/sample/cell_week_<region>_sample.csv

It takes the dozens of separate yearly Parquet files created by 01_clean.py and combines 
them into one master cell_week table per country with MODIS and VIIRS lined up side-by-side.
"""
import os
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))
import config
import store
from grid import build_grid, fill_calendar, add_schema_columns
from pipeline import to_cell_period

SAMPLE_MAX_ROWS = 5000          # the sample that goes into Git stays small
VIIRS_SENSOR = 'SNPP'           # version 1: S-NPP only (NOAA-20 only for gap filling later)


def sensor_cells(slug, sensor):
    """Read the cleaned files of one sensor and aggregate. Returns (cells table, years that had data)."""
    frames, covered = [], []
    for y in config.sensor_years(sensor):
        base = config.clean_base(slug, sensor, y)
        if store.exists(base):
            frames.append(store.read(base))
            covered.append(y)
    if not frames:
        empty = pd.DataFrame(columns=['cx', 'cy', 'period', 'active', 'n_hotspots', 'total_frp'])
        return empty, covered
    return to_cell_period(pd.concat(frames), config.RES, config.PERIOD), covered


def aggregate_region(slug):
    r = config.REGIONS[slug]
    print(f'##### {r["name"]} ({slug}) #####')
    results = {}
    for prefix, sensor in (('modis', 'MODIS'), ('viirs', VIIRS_SENSOR)):
        cells, covered = sensor_cells(slug, sensor)
        results[prefix] = (cells, covered, sensor)
        print(f'{sensor}: years with data: {covered if covered else "none"}')
    all_years = sorted(set(results['modis'][1]) | set(results['viirs'][1]))
    if not all_years:
        print(f'  no cleaned files for {slug}: run 01_clean.py first. Skipping.\n')
        return
    table = build_grid(r['bbox'], config.RES, f'{min(all_years)}-01-01', f'{max(all_years)}-12-31', config.PERIOD)
    n_cells = table[['cx', 'cy']].drop_duplicates().shape[0]
    print(f'grid: {n_cells} cells x {table.period.nunique()} periods = {len(table)} rows')

    for prefix, (cells, covered, sensor) in results.items():
        table = fill_calendar(table, cells, prefix, covered, config.SENSORS[sensor]['start'], config.PERIOD)
        lost = len(cells) - int(table[f'{prefix}_active'].sum())
        assert lost == 0, f'{lost} {sensor} detections fell outside the grid: re-run 01_clean.py --force'
        print(f'  {sensor}: active cell-periods {len(cells)} (checks passed: none lost)')

    table = add_schema_columns(table, config.RES)
    print('saved', store.save(table, os.path.join(config.OUT_DIR, f'cell_week_{slug}')))

    n_keep, kb = store.write_sample(table, os.path.join(config.SAMPLE_DIR, f'cell_week_{slug}_sample.csv'), SAMPLE_MAX_ROWS)
    print(f'saved sample ({kb:.0f} KB, {n_keep} cells)\n')


if __name__ == '__main__':
    slugs, _ = config.cli(sys.argv[1:])
    for s in slugs:
        aggregate_region(s)