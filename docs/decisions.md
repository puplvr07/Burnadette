# Historical local API contract 0.2 — provisional

The published-data integration and corrected harmonized count semantics now follow
`json-integration.md`. This document retains the original sample investigation;
its contributing-sensor definition of harmonized active_cells is superseded.

User-authorized scope: P0 documentation and P1 local backend only. No frontend/ML changes,
branch merges, deployment, commits, or pushes are included.

Primary specification: supplied NASA.pdf, especially sections 4 and 6. Its 19-column
cell_week contract is preserved. The existing frontend contract informed the response
shape, but these proposed semantic/type changes require Hans and Sean's review.

## Data provenance and limits

The backend fixture is copied byte-for-byte from Hans's machine-learning commit
4f1eebefefccd4926d9bf35255c68b93c894a9f8, processed/sample/cell_week_cambodia_sample.csv.
The manifest records its SHA-256. The original 24-cell, 4,992-row fixture is unchanged.
Cells 204_30 and 205_30 are excluded during loading, leaving 22 cells and 4,576 rows.
Both original cells lie north of the advertised Cambodia bounds. The grid/export
discrepancy remains unresolved; no ML output is corrected or regenerated here.

There are 208 Monday weeks from 2015-01-05 through 2018-12-24. The final week extends
through December 30; API dates refer to Monday starts. The subset is irregular and
does not represent all Cambodia or the 2000-present record. Other cells inside its
envelope remain unsampled. All sample harmonized provenance is VIIRS; bounds collapse
to the activity values. No demonstrated scaled-era or nontrivial uncertainty follows.
The broader 143-cell JSON exports are not used as sample totals or bbox anomalies.

## Provisional scientific mappings

All activity values are fractions: mean harmonized_value, mean modis_active, or mean
viirs_active across selected cells. They are not detection counts or FRP. Raw counts
and FRP remain in the input product; they are not exposed as the activity metric.
Harmonized active_cells counts the observations of the contributing sensor (VIIRS for
viirs provenance; MODIS for scaled/fill provenance). It is not a probability threshold,
union of sensors, or expected total. Hans must confirm this interpretation.

Missing activity in any selected cell makes the area's value and complete count null.
valid_cells reports available activity measurements. Zeros remain explicit zeros,
without proving complete observation coverage. Missing rows have missing_cell_week or
outside_date_coverage flags; missing measurements have source_unavailable. Flags are
sorted and deduplicated. Anomaly is always null until Hans approves bbox aggregation.

Harmonized uncertainty endpoints are the means of complete supplied endpoint pairs,
not a validated confidence interval for the area. Missing endpoints make both null.
Harmonized low_sensitivity_share is the mean supplied indicator when complete; sensor
views return null. Missing sensitivity remains null. Mixed provenance returns mixed.

Hans must confirm mean versus total activity, contributing-sensor count semantics,
spatial uncertainty interpretation, outage masks, exact data products/citations,
availability assumptions, grid boundaries and any future bbox anomaly method. Sean
must confirm nullable counts/shares, fraction units, capability/sample labels and
frontend handling. These are proposed behaviors for review, not finalized science.

## HTTP interface

- GET /meta: legacy date/gap/note fields plus dataset provenance and coverage,
  source_coverage, metrics capabilities/methods, limits and provisional version.
  is_fake=false denotes satellite-derived input; dataset.mode=development_sample
  must still be displayed as a limited development subset.
- GET /regions: bare array with id, name and bbox. The bbox is a sample envelope,
  not a national boundary or guarantee of continuous coverage.
- GET /calendar?bbox=west,south,east,north&start=YYYY-MM-DD&end=YYYY-MM-DD&source=harmonized
  returns bbox, source, cells_in_area, weeks and coverage. Source defaults to harmonized.
  Week fields follow the frontend shape, with nullable active_cells and
  low_sensitivity_share plus valid_cells. Each source uses active_cell_fraction units.

Bounds select cell centers inclusively. Dates select Monday starts inclusively;
there is no prorating or true circle/polygon filtering. Every requested Monday is
returned for selections containing cells, including null weeks outside availability.
No selected cells yields HTTP 200, an empty weeks array and no_cells coverage.
Nominal cells count the 0.5-degree centers inside the declared Cambodia domain and
the requested bbox; partial identifies an incomplete loaded subset of those centers.
available describes loaded grid coverage only, never cloud/pass coverage.

Validation errors are 422; limit violations are 413. Error detail contains code and
message. Unexpected errors return sanitized 500 responses and server diagnostics.
Invalid/unreadable datasets fail startup, with no silent fallback. Dates, source,
coordinates and finite values are validated. Antimeridian boxes are unsupported.
Limits: 100 square degrees, 1,600 weeks, 400 cells, 250,000 cell-weeks. Weekly query
limits conservatively count the requested span. The cache is process-local, bounded
to 128 entries for 60 seconds, keyed by artifact checksum and parsed query.

## Implementation choice

The 5,000-row fixture uses Python's CSV module rather than pandas. Dataset access is
separate from aggregation and HTTP, permitting a future Parquet adapter. Data loads
once at startup. Production requires explicit paths and a production-mode manifest;
full production dataset qualification and Cloud Run/GCS support remain future work.
