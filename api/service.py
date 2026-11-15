from datetime import timedelta


def calendar(dataset, bbox, start, end, source):
    west, south, east, north = bbox
    cells = [c for c, (x, y) in dataset.cells.items() if west <= x <= east and south <= y <= north]
    # Count nominal 0.5-degree centers within the declared data domain, not just loaded cells.
    dw, ds, de, dn = dataset.manifest['declared_bbox']
    nominal = sum(west <= dw+.25+i*.5 <= east and south <= ds+.25+j*.5 <= north
                  for i in range(round((de-dw)/.5)) for j in range(round((dn-ds)/.5)))
    result = {'bbox': bbox, 'source': source, 'cells_in_area': len(cells), 'weeks': [],
              'coverage': {'spatial_status': 'no_cells' if not cells else 'partial' if nominal > len(cells) else 'available',
                           'nominal_cells': nominal, 'available_cells': len(cells),
                           'dataset_mode': dataset.manifest['mode']}}
    if not cells:
        return result
    offset = (-start.weekday()) % 7
    if (end-start).days < offset:
        return result
    monday = start + timedelta(days=offset)
    while monday <= end:
        wk = monday.isoformat()
        rows = [dataset.by_key.get((c, wk)) for c in cells]
        present = [r for r in rows if r is not None]
        field = 'harmonized_value' if source == 'harmonized' else source+'_active'
        values = [r[field] for r in present if r[field] is not None]
        complete = len(values) == len(cells)
        def mean_column(name):
            xs = [r[name] for r in present if r[name] is not None]
            return sum(xs)/len(cells) if len(xs) == len(cells) else None
        flags = {f for r in present for f in r['flags'].split(';') if f}
        if len(present) < len(cells):
            flags.add('outside_date_coverage' if wk < dataset.dates[0] or wk > dataset.dates[-1] else 'missing_cell_week')
        if not complete:
            flags.add('source_unavailable')
        provenance = {r['harmonized_source'] for r in present if r['harmonized_value'] is not None}
        lo = mean_column('uncertainty_low') if complete and source == 'harmonized' else None
        hi = mean_column('uncertainty_high') if complete and source == 'harmonized' else None
        row = {'week_start': wk, 'value': sum(values)/len(cells) if complete else None,
               'active_cells': sum(values) if complete else None,
               'valid_cells': len(values), 'anomaly': None,
               'uncertainty_low': lo if hi is not None else None,
               'uncertainty_high': hi if lo is not None else None,
               'low_sensitivity_share': mean_column('low_sensitivity') if complete and source == 'harmonized' else None,
               'flags': sorted(flags)}
        if source == 'harmonized' and provenance:
            row['harmonized_source'] = next(iter(provenance)) if len(provenance) == 1 else 'mixed'
        result['weeks'].append(row)
        if (end-monday).days < 7:
            break
        monday += timedelta(days=7)
    return result
