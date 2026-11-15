# PLAN2 implementation: published JSON contract 0.3

## Artifact and scope

The authoritative ML source is frontend/public/data/ at commit
0e6e66965e4782c369210a8d88dc62a538a0fcbf. Only those 147 JSON files are packaged under
api/data/published; the manifest records checksums and provenance. They are not
combined with deb4fa2 or the moving remote tip. Compared with deb4fa2, weekly values,
calendars and cell lists are unchanged; calibration-enriched info/regions metadata
and removal of duplicate processed/web exports justify the newer integration pin.
The checksum files are pinned to the artifact, not a claim of independent NASA
verification. They fail startup on corruption, missing files or incompatible shape.

This implements the approved first increment of the revised PLAN2 and uses the
team's ML_FE_BE_integration.md. It does not implement every suggested analytic in
that guide. No frontend or ML scripts are changed. No cloud resources are used.

The five grids have 32 Belgium, 120 Cambodia, 714 Philippines, 525 Zambia and
3,384 Indonesia cells, each with 1,313 Monday weeks 2000-10-30..2025-12-22.
The last week ends December 28. Nothing in 2026 is available. These are 0.5-degree
country-filtered regional grids: the denominator includes sea/out-of-country cells.
No claim of cloud/pass-level complete observation coverage follows from grid coverage.
Belgium's declared east bound is 6.4 but its final cell footprint reaches 6.5.
Final Cambodia has no old extra-edge cells; the old two-cell quarantine applies
only to the preserved original regression fixture.

## Activity and routing

Harmonized active_cells is the sum of selected harmonized values (potentially
fractional); MODIS/VIIRS active_cells is that sensor's observed active-cell count.
For every available response, value = active_cells / cells_in_area. This replaces
the old contributing-sensor definition in both CSV and JSON modes. The original
30 tests are retained, with only two obsolete count expectations corrected.
Raw counts/FRP are not inferred from active-cell indicators.

Subset sums use selected defaults plus exceptions, including nonzero defaults.
Complete-grid responses use calendar.json totals. Cell exports are rounded to
three decimals, so full-grid and reconstructed subset totals may differ by up to
N*0.0005+0.005; arbitrary-area fractions have cell-rounding uncertainty around 0.0005.
Provenance distinguishes observed viirs, estimated modis_scaled and estimated
modis_fill. These comparisons share units, not sensor detection sensitivity.

GET /calendar adds optional region=<slug>. Explicit routing selects one product.
Without it, an exact pilot bbox resolves first, then a unique cell-intersecting
product; multiple products return 422 bbox_ambiguous_region. Indonesia/Philippines
share 84 cell centers but are different products and are never merged. Inclusive
cell-center selection and inclusive Monday-start date filtering remain unchanged.
Coverage now adds region and clipped_to_region. A bbox extending beyond an explicit
product is clipped to its cells. Complete grids are available, not sampled partial
coverage. Empty selections return no_cells and no weekly rows.

The normal ASGI app uses published_json. create_app() without a mode retains the
legacy regression profile; explicit data_mode or BURN_DATA_MODE selects a profile.
Published limits: 1,000 square degrees; 5,000 cells; 1,600 requested weeks;
8,000,000 cell-weeks. The original sample limits remain for sample regression.
All response cache keys include artifact revision, product, bbox, dates and source.

## Availability and deferred analytics

VIIRS availability starts at week_start 2012-01-16 (instrument starts Jan 20).
Mask VIIRS for the three snpp_outage weeks 2022-07-25, 2022-08-01 and 2022-08-08,
even though exports contain zero counts/empty lists there. MODIS activity remains
available and harmonized uses modis_fill. Aqua/Terra flags qualify observations;
they do not invalidate all MODIS measurements. Unknown/out-of-range weeks are null
with source_unavailable/outside_date_coverage; 2026 never becomes observed zero.

Whole-grid harmonized bounds are the published summed bounds divided by cell count.
Subarea bounds remain null, flagged uncertainty_unavailable_subarea. No proportional
range is invented. low_sensitivity_share remains null; calibration warnings are
preserved through /regions. Anomaly is always null while original regional scores
are retained and validated internally. Early smoothed VIIRS anomaly values must
not be exposed where source activity is unavailable.

Future approved exact-grid anomaly maps source to anomaly_region,
anomaly_modis_only or anomaly_viirs_only, gated on Hans and Sean's approval.
Arbitrary-area anomaly remains deferred: obtain the reference reader and format
companion, verify full-history three-week smoothing/seasonal midrank method and
rounding effects before implementing it. Approximate subarea uncertainty and the
guide-derived sensitivity share likewise require explicit review.

## Frontend handoff / approvals

Sean must allow nullable numeric counts/shares and nullable provenance, format
estimated counts as fractional, pass region for ambiguous selections, and consume
calibration/capability/coverage metadata. Explain units, unavailable analytics,
country-boundary effects and coverage through December 2025. The existing frontend
has not been integrated or changed by this increment.

Hans should confirm whole-week validity/provenance assumptions, conservative outage
masks, scientific uncertainty wording and exact NASA citations. Hans and Sean must
approve regional anomaly activation and any derived sensitivity share. JSON loading
and correct activity metrics do not wait for Parquet. Cloud deployment is deferred.
