"""
ML/config.py  -  every setting lives here. Change things here, never inside the scripts.

HOW TO ADD A REGION
1. Download its MODIS and S-NPP country files into raw_data/ (see folders below).
2. Add one entry to REGIONS. 'country' must match the file name EXACTLY
(look at your downloaded file, e.g. modis_2018_Belgium.csv  ->  country='Belgium').
3. Check the bbox with:   python ML/suggest_bbox.py <Country>
4. Run:  python ML/01_clean.py <slug>   then   02_aggregate.py <slug>   then   04_export_web.py <slug>
"""
import os

RES = 0.5                    # cell size in degrees (the SAME for every script and every region)
PERIOD = 'W'                 # 'W' = weeks starting Monday, 'M' = months
FIRST_YEAR, LAST_YEAR = 2000, 2025

RAW_DIR = 'raw_data'
CLEAN_DIR = 'processed/clean_parquet'
OUT_DIR = 'processed'
SAMPLE_DIR = 'processed/sample'
DOCS_DIR = 'docs'
WEB_DIR = 'frontend/public/data'     # Vite serves everything in public/ as static files

# FIRMS per-country files are named   <prefix>_<year>_<Country>.csv
# 'start' = first day the instrument produces fire data (before that is NOT zero fire, it is "no data")
SENSORS = {
    'MODIS':  dict(folder='modis',        prefix='modis',       kind='MODIS', start='2000-11-01'),
    'SNPP':   dict(folder='viirs_snpp',   prefix='viirs-snpp',  kind='VIIRS', start='2012-01-20'),
    'NOAA20': dict(folder='viirs_noaa20', prefix='viirs-jpss1', kind='VIIRS', start='2018-04-01'),
}
DEFAULT_SENSORS = ['MODIS', 'SNPP']      # NOAA-20 is only for gap filling and checks later

# Known data gaps. Used by 03_calibrate.py (flags + excluded from fitting) and 04_export_web.py (meta.json).
# 'affects' = which instrument is hurt. Check 'terra_only' end against the first Aqua row in YOUR data.
KNOWN_GAPS = [
    dict(id='terra_only', start='2000-11-01', end='2002-05-04', affects='modis',
            note='Terra only. Aqua was launched 4 May 2002 and its fire data starts a little later: fewer observations.'),
    dict(id='aqua_outage', start='2020-08-16', end='2020-09-02', affects='modis',
            note='Aqua data loss; limited direct-broadcast coverage.'),
    dict(id='snpp_outage', start='2022-07-27', end='2022-08-10', affects='viirs',
            note='S-NPP VIIRS outage (zeros in these weeks are not real).'),
]

# Persistence filter (01_clean.py): a ~1 km spot that fires on at least this many different dates in one year is
# treated as a static heat source (industry) and removed. 5 suits low-fire places like Belgium. In a high-fire country
# it may remove REAL repeated burning, so check with  python ML/inspect_persistent.py <region>  and, if needed,
# override per region with persist_min_dates=... inside REGIONS (then run 01_clean.py <region> --force).
PERSIST_MIN_DATES = 5

# Calibration settings (03_calibrate.py)
CAL = dict(
    ridge=20,              # pulls thin groups toward the pooled value (bigger = more cautious)
    smooth_weeks=3,        # anomaly is computed on a centered mean over this many weeks (odd number)
    season_window_days=21, # "same time of year" = within +-21 days, in all years
    min_clim=0.02,         # cells whose typical activity is below this get no anomaly score
    min_ref=20,            # need at least this many reference values to score an anomaly
    low_sens=0.25,         # MODIS sees less than 25% of VIIRS fire cell-weeks -> low_sensitivity = 1
    min_pos=30,            # fewer VIIRS-positive cell-weeks than this in a month -> low_sensitivity = 1
    boot=200,              # bootstrap repeats for the uncertainty band
    seed=42,
    min_overlap_years=3,   # fewer overlap years than this: no hold-out validation, binomial band only
    anom_high=90,          # percentile at which a cell is exported as "unusually high"
)

# bbox = (min_lat, max_lat, min_lon, max_lon), hand-set and snapped to 0.5 degree lines.
# Detections outside the bbox (distant territories) are removed in stage 1 and counted in the log.
# tier: 'core' = do these first. 'stretch' = only after the whole chain works for the core ones.
# NOTE: these boxes are from memory. Verify each with  python ML/suggest_bbox.py <Country>
REGIONS = {
    # ---------------- core ----------------
    'belgium':     dict(name='Belgium', country='Belgium', bbox=(49.5, 51.5, 2.5, 6.4), tier='core',
                        regime='Temperate, small burns; low fire (shows the limits of MODIS)'),
    'philippines': dict(name='Philippines', country='Philippines', bbox=(4.5, 21.5, 116.5, 127.0), tier='core',
                        regime='Tropical archipelago, crop burning, heavy cloud (home country)'),
    'indonesia':   dict(name='Indonesia', country='Indonesia', bbox=(-11.5, 6.5, 94.5, 141.5), tier='core',
                        regime='Peatland and forest fires; 2015 haze season'),
    'cambodia':    dict(name='Cambodia', country='Cambodia', bbox=(10.0, 15.0, 102.0, 108.0), tier='core',
                        regime='Compact, strong dry-season burning (good for calibration)'),
    'zambia':      dict(name='Zambia', country='Zambia', bbox=(-18.5, -8.0, 21.5, 34.0), tier='core',
                        regime='African savanna, very high fire activity (good for calibration)')
}


def sensor_years(sensor):
    """Years in which this instrument has data (within FIRST_YEAR..LAST_YEAR)."""
    first = max(FIRST_YEAR, int(SENSORS[sensor]['start'][:4]))
    return list(range(first, LAST_YEAR + 1))


def persist_min_dates(slug):
    return REGIONS[slug].get('persist_min_dates', PERSIST_MIN_DATES)


def region_sensors(slug):
    return REGIONS[slug].get('sensors', DEFAULT_SENSORS)


def raw_path(slug, sensor, year):
    s = SENSORS[sensor]
    return os.path.join(RAW_DIR, s['folder'], f"{s['prefix']}_{year}_{REGIONS[slug]['country']}.csv")


def clean_base(slug, sensor, year):
    """Path WITHOUT extension for the cleaned file (store.py adds .parquet or .csv.gz)."""
    return os.path.join(CLEAN_DIR, f'{sensor.lower()}_{year}_{slug}')


def resolve(selection):
    """'belgium' -> ['belgium'];  'core' -> all core regions;  'all' -> everything;  'a,b' -> both."""
    if selection == 'core':
        return [k for k, v in REGIONS.items() if v['tier'] == 'core']
    if selection == 'all':
        return list(REGIONS)
    slugs = [s.strip().lower() for s in selection.split(',')]
    for s in slugs:
        if s not in REGIONS:
            raise SystemExit(f"Unknown region '{s}'. Known: {', '.join(REGIONS)}")
    return slugs


def cli(argv):
    """Tiny argument reader: [region|core|all] [--force] [--no-plot] [--out FOLDER]. Returns (slugs, options)."""
    selection, opts = 'core', {'force': False, 'out': None, 'plot': True}
    it = iter(argv)
    for a in it:
        if a == '--force':
            opts['force'] = True
        elif a == '--out':
            opts['out'] = next(it)
        elif a == '--no-plot':
            opts['plot'] = False
        else:
            selection = a
    return resolve(selection), opts