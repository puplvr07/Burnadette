"""
ML/store.py  -  save/read tables. Uses Parquet; falls back to CSV.gz if pyarrow is missing.
"""
import os
import pandas as pd


def save(df, base):
    os.makedirs(os.path.dirname(base) or '.', exist_ok=True)
    try:
        df.to_parquet(base + '.parquet', index=False)
        return base + '.parquet'
    except ImportError:
        print('  (pyarrow not installed: saving CSV.gz instead. Run  pip install pyarrow  for Parquet.)')
        df.to_csv(base + '.csv.gz', index=False)
        return base + '.csv.gz'


def exists(base):
    return os.path.exists(base + '.parquet') or os.path.exists(base + '.csv.gz')


def read(base):
    if os.path.exists(base + '.parquet'):
        return pd.read_parquet(base + '.parquet')
    if os.path.exists(base + '.csv.gz'):
        df = pd.read_csv(base + '.csv.gz')
        if 'datetime_utc' in df.columns:
            df['datetime_utc'] = pd.to_datetime(df['datetime_utc'])
        return df
    raise FileNotFoundError(base)


def write_sample(table, path, max_rows=5000):
    """Write a small CSV (a few whole cells, all weeks) that is safe to commit to Git."""
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    per_cell = max(1, len(table) // table.cell_id.nunique())
    keep = table.cell_id.drop_duplicates().head(max(1, max_rows // per_cell))
    table[table.cell_id.isin(keep)].to_csv(path, index=False)
    return len(keep), os.path.getsize(path) / 1024