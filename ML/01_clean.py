"""
ML/01_clean.py  -  STAGE 1: raw FIRMS CSVs -> cleaned files (one per sensor, year and region).
Slow stage. Files that are already cleaned are skipped, so you can re-run it safely.

    python ML/01_clean.py belgium          one region
    python ML/01_clean.py core             all core regions
    python ML/01_clean.py belgium --force  redo files even if already cleaned
Writes: processed/clean_parquet/<sensor>_<year>_<region>.*     docs/filter_log_<region>.txt
"""
import contextlib
import datetime
import io
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import config
import store
from grid import clip_to_region
from pipeline import load, clean


def clean_region(slug, force=False):
    r = config.REGIONS[slug]
    log, done, skipped, missing = [], 0, 0, 0
    print(f'##### {r["name"]} ({slug}) #####')
    for sensor in config.region_sensors(slug):
        kind = config.SENSORS[sensor]['kind']
        for year in config.sensor_years(sensor):
            path = config.raw_path(slug, sensor, year)
            base = config.clean_base(slug, sensor, year)
            if not os.path.exists(path):
                missing += 1
                continue
            if store.exists(base) and not force:
                skipped += 1
                continue
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                d = clean(load(path, kind), f'{sensor} {year} {slug}', min_dates=config.persist_min_dates(slug))
                before = len(d)
                d = clip_to_region(d, r['bbox'], config.RES)
                print(f'  {"outside the region grid (other territories)":<70} {len(d):>8}   (removed {before - len(d)})')
            print(buf.getvalue(), end='')
            log.append(buf.getvalue())
            print(f'  saved {store.save(d, base)}\n')
            done += 1
    print(f'{slug}: cleaned {done}, already done {skipped}, raw file not found {missing}\n')
    if log:
        os.makedirs(config.DOCS_DIR, exist_ok=True)
        with open(os.path.join(config.DOCS_DIR, f'filter_log_{slug}.txt'), 'a', encoding='utf-8') as f:
            f.write(f'===== {datetime.datetime.now():%Y-%m-%d %H:%M} =====\n' + ''.join(log))


if __name__ == '__main__':
    slugs, opts = config.cli(sys.argv[1:])
    for s in slugs:
        clean_region(s, opts['force'])