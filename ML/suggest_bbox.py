"""
ML/suggest_bbox.py  -  look at a country's raw files and suggest a bbox for config.py.

    python ML/suggest_bbox.py Belgium
It prints the full extent, a "core" extent that ignores a few far-away detections, and warnings.
YOU decide the final bbox. Remember: the bbox also decides which cells exist (zero-fire cells included).
"""
import glob
import os
import re
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))
import config


def find_files(country):
    out = []
    for s in config.SENSORS.values():
        rx = re.compile(rf"^{re.escape(s['prefix'])}_\d{{4}}_{re.escape(country)}\.csv$")
        for p in glob.glob(os.path.join(config.RAW_DIR, s['folder'], '*.csv')):
            if rx.match(os.path.basename(p)):
                out.append(p)
    return out


def snap(lo, hi, res):
    return float(np.floor(lo / res) * res), float(np.ceil(hi / res) * res)


def main(country):
    files = find_files(country)
    if not files:
        sys.exit(f"No raw files found for '{country}' in {config.RAW_DIR}/ (the name must match the file name exactly).")
    d = pd.concat([pd.read_csv(p, usecols=['latitude', 'longitude']) for p in files], ignore_index=True)
    print(f'{len(files)} files, {len(d)} detections')
    lat0, lat1, lon0, lon1 = d.latitude.min(), d.latitude.max(), d.longitude.min(), d.longitude.max()
    print(f'full extent : lat {lat0:.2f} .. {lat1:.2f}   lon {lon0:.2f} .. {lon1:.2f}')
    q = d.quantile([0.001, 0.999])
    c_lat0, c_lat1, c_lon0, c_lon1 = q.latitude.iloc[0], q.latitude.iloc[1], q.longitude.iloc[0], q.longitude.iloc[1]
    print(f'core extent : lat {c_lat0:.2f} .. {c_lat1:.2f}   lon {c_lon0:.2f} .. {c_lon1:.2f}   (middle 99.8%)')
    far = max(abs(lat0 - c_lat0), abs(lat1 - c_lat1), abs(lon0 - c_lon0), abs(lon1 - c_lon1)) > 3
    use = (c_lat0, c_lat1, c_lon0, c_lon1) if far else (lat0, lat1, lon0, lon1)
    sl, so = snap(use[0], use[1], config.RES), snap(use[2], use[3], config.RES)
    print(f"\nSuggested line for config.py (based on the {'core' if far else 'full'} extent):\n"
            f"    bbox=({sl[0]}, {sl[1]}, {so[0]}, {so[1]})")
    if (lon1 - lon0) > 100:
        print('\nWARNING: longitude span > 100 degrees. The country may cross the 180-degree line or have distant '
            'territories. Choose the bbox of the MAIN area by hand.')
    if far:
        print('\nNOTE: the full extent is much larger than the core extent: there are detections far away '
            '(overseas territories?). Stage 1 will clip them and say how many.')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
