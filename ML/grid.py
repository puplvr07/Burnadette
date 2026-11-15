"""
ML/grid.py  -  the region grid: which cells exist, which detections belong, the final cell_week columns.
"""
import numpy as np
import pandas as pd


def cell_ranges(bbox, res):
    """Cell index ranges (cx0, cx1, cy0, cy1) covered by the bbox. Cell index = floor(coordinate / res)."""
    min_lat, max_lat, min_lon, max_lon = bbox
    cx0, cy0 = int(np.floor(min_lon / res)), int(np.floor(min_lat / res))
    # the max edge is exclusive: a box ending exactly on a cell edge (e.g. lat 15.0) must NOT add the cell beyond it
    cx1, cy1 = int(np.ceil(max_lon / res)) - 1, int(np.ceil(max_lat / res)) - 1
    return cx0, max(cx0, cx1), cy0, max(cy0, cy1)


def full_periods(start, end, period):
    """Start dates of the periods that lie COMPLETELY inside start..end.
    The first/last week of a year usually straddles New Year (e.g. 2014-12-29 .. 2015-01-04). Such a week
    would be half empty because the neighbouring year's file is missing, so it is left out."""
    p = pd.period_range(start, end, freq=period)
    keep = (p.start_time >= pd.Timestamp(start)) & (p.end_time < pd.Timestamp(end) + pd.Timedelta(days=1))
    return p[keep].start_time


def build_grid(bbox, res, start, end, period):
    """Every cell in the region x every full period (weeks start on Monday)."""
    cx0, cx1, cy0, cy1 = cell_ranges(bbox, res)
    cells = pd.MultiIndex.from_product([np.arange(cx0, cx1 + 1), np.arange(cy0, cy1 + 1)], names=['cx', 'cy']).to_frame(index=False)
    periods = pd.DataFrame({'period': full_periods(start, end, period)})
    return cells.merge(periods, how='cross')


def clip_to_region(d, bbox, res):
    """Keep only detections that fall inside the region's grid (drops distant territories)."""
    cx0, cx1, cy0, cy1 = cell_ranges(bbox, res)
    cx = np.floor(d.longitude / res)
    cy = np.floor(d.latitude / res)
    return d[(cx >= cx0) & (cx <= cx1) & (cy >= cy0) & (cy <= cy1)]


def fill_calendar(grid, cells_df, prefix, covered_years, sensor_start, period):
    """
    Attach one sensor's results to the grid.
        0   = the sensor was operating (and we have its file for that year) and saw nothing
        NA  = no data: wrong year (no file), or the period ended before the instrument started
    """
    keep = cells_df[['cx', 'cy', 'period', 'active', 'n_hotspots', 'total_frp']].rename(columns={
        'active': f'{prefix}_active', 'n_hotspots': f'{prefix}_n', 'total_frp': f'{prefix}_frp'})
    out = grid.merge(keep, how='left', on=['cx', 'cy', 'period'])

    uniq = pd.Series(out.period.unique())
    ends = pd.Series(pd.PeriodIndex(uniq, freq=period).end_time.values, index=uniq.values)
    period_end = out.period.map(ends)
    covered = out.period.dt.year.isin(covered_years) & (period_end >= pd.Timestamp(sensor_start))

    for c in (f'{prefix}_active', f'{prefix}_n'):
        out[c] = out[c].fillna(0).astype('Int64')
        out.loc[~covered, c] = pd.NA
    out[f'{prefix}_frp'] = out[f'{prefix}_frp'].fillna(0.0).where(covered)
    return out


def add_schema_columns(table, res):
    """Add the columns the team expects (see the shared cell_week schema)."""
    t = table.copy()
    t['cell_id'] = t.cx.astype(str) + '_' + t.cy.astype(str)
    t['lat'] = (t.cy + 0.5) * res
    t['lon'] = (t.cx + 0.5) * res
    t['week_start'] = t.period.dt.date.astype(str)
    t['year'] = t.period.dt.year
    t['week_of_year'] = t.period.dt.isocalendar().week.astype(int)
    cols = ['cell_id', 'lat', 'lon', 'week_start', 'year', 'week_of_year',
            'modis_active', 'viirs_active', 'modis_n', 'viirs_n', 'modis_frp', 'viirs_frp']
    return t[cols].sort_values(['cell_id', 'week_start']).reset_index(drop=True)