# Burnadette: ML, API and Frontend integration guide

*One document for all three parts. Everyone reads sections 0 to 3. Then read your own section: Backend/API (4), Frontend (5). Companion files: `web_data_format.md` (file formats) and `ml_export_reader.py` (tested reference code for the Backend).*

*Based on `API.md`, `BACK_END.md`, `FRONT_END.md` and the repo screenshots. I have not seen `src/types.ts`, `src/api.ts` or a real `/calendar` response, so field names below follow `API.md` where it names them, and are marked "map to your name" otherwise.*

---

## 0. Where we are (the honest version)

| Part | Today |
|---|---|
| **ML** | Final data for 5 regions (Belgium, Cambodia, Indonesia, Philippines, Zambia), weekly, **30 Oct 2000 to 22 Dec 2025 (1,313 weeks)**, in `frontend/public/data/` (12.63 MB). |
| **Backend** | Serves only the **early Cambodia sample** (24 cells, 2015-2018 from an old ML commit) and hides 2 of its cells. |
| **Frontend** | Reads the API and shows sample data. It does **not** read `frontend/public/data/`. |

**So the real ML data is not connected to the app yet.** Connecting it is the main job for the next hours.

**About the two "quarantined" cells (`204_30`, `205_30`):** they came from an early ML bug. A region box ending exactly on a cell edge added one extra row/column of empty cells beyond the box. That is fixed in the final ML code, and the final Cambodia export has **120 cells** (not 143, not 24). The final data has no such cells, so the Backend's workaround is not needed for it.

### The one decision to make in the first 15 minutes

**Recommended path:** keep the API as the single door for the frontend (the frontend is already built for it). The Backend replaces its CSV loader with a reader for the ML JSON export, using the tested `ml_export_reader.py` as the starting point. The frontend then needs few or no changes.

**Fallback (if the Backend cannot finish in time):** the frontend computes the same numbers in the browser from `/data/...` using the algorithm in section 4.4. No server needed. Do not let the demo depend on an unfinished API.

---

## 1. Facts every part must use (copy exactly)

| Fact | Value |
|---|---|
| Time span | Weekly, **30 Oct 2000 to 22 Dec 2025** (1,313 weeks). Weeks start on **Monday**. The first MODIS data is Nov 2000, the last full week is 22 Dec 2025. |
| Cell size | **0.5 degrees, about 55 km.** Never write "1 km" or imply pinpoint locations. |
| Cell ID and position | `cell_id = <floor(lon/0.5)>_<floor(lat/0.5)>`. Center = (index + 0.5) x 0.5. In the JSON export a cell is identified by its **position in `cells.json`**. |
| Regions and cells | Belgium 32, Cambodia 120, Philippines 714, Zambia 525, Indonesia 3,384. |
| Two instruments | **MODIS** (older, 2000-) and **VIIRS** (newer, from **20 Jan 2012**). Their raw counts are not comparable. |
| "Harmonized" | One consistent series. From 20 Jan 2012 it is what VIIRS observed. Before that it is an estimate made from MODIS. |
| Cell value | "VIIRS-equivalent chance of fire in that square that week", 0 to 1. Exactly 0 or 1 after 2012 (observed), a decimal before (estimated). |
| Area metric | **Share of squares with fire** = sum of cell values / number of cells. It is a fraction (or "% of squares"), not a count of fires, and not FRP. |
| No data is not zero | `null` means no data. `0` means data exists and no fire was detected. Never draw them the same. |
| Known gaps | Terra-only period (to about May 2002); Aqua outage 16 Aug - 2 Sep 2020; S-NPP outage 27 Jul - 10 Aug 2022. |
| Data end | "Through December 2025". Nothing from 2026. |

---

## 2. What ML delivers

Everything is in `frontend/public/data/` (details in `web_data_format.md`):

| File | Contents |
|---|---|
| `regions.json` | The 5 regions: `slug`, `name`, `bbox`, `n_cells`, `first_week`, `last_week`, `years`, `has_harmonized`, and a **`calibration`** block (low-sensitivity months, validation numbers) |
| `meta.json` | `known_gaps` (id, start, end, affects, note), `caveats`, how to read nulls |
| `<region>/cells.json` | Cell centers `[lat, lon]`; position = cell index |
| `<region>/calendar.json` | Whole-region weekly series: `harmonized_cells`, `harmonized_low`, `harmonized_high`, `anomaly_region`, `anomaly_modis_only`, `anomaly_viirs_only`, `source`, `flags`, raw `modis_active_cells`, `viirs_active_cells` |
| `<region>/<year>.json` | Per week: `modis` / `viirs` (lists of active cell indices, or `null`), `harmonized_default` and `harmonized` (exceptions), `anomaly_high` |

`source` per week: `viirs` = observed, `modis_scaled` = estimated (before 2012), `modis_fill` = estimated because VIIRS was unavailable (e.g. the 2022 outage).

---

## 3. Answers to the open questions in `API.md` ("Hans must confirm")

These are the ML-side answers. **Hans (ML) to confirm**; they are what the data is built to mean.

| Question in `API.md` | ML answer |
|---|---|
| Mean versus total activity | **Mean** is the headline metric (share of squares). The **expected number of active squares** is also valid for harmonized: it is the sum of the cell values. |
| Meaning of harmonized `active_cells` | **Not** a MODIS count and not a threshold. For harmonized it is **the sum of the selected cells' values**: the observed VIIRS count after 2012, and the *expected* VIIRS-equivalent count before (**fractional**). Show one decimal for estimated weeks. For the MODIS and VIIRS views it is that instrument's count of active squares. |
| Uncertainty | The range is the 10th-90th percentile of the calibration, resampled over the 14 overlap years. It is **not a validated confidence interval for a drawn sub-area**. After 2012 (observed) low = high = value. For a drawn area, scale the region's relative range (section 4.4) and label it **approximate**. |
| Missing cells | In the ML data a week is either fully available or fully missing for all cells, so "any missing cell makes the area null" works. |
| Outage masks | S-NPP outage weeks: source `modis_fill`, flag `snpp_outage`. Aqua outage and the Terra-only period: flags `aqua_outage`, `terra_only`. Flags come from `calendar.json` per week and apply to the whole region. |
| Availability | Weeks `2000-10-30` to `2025-12-22`. For VIIRS, from the week of 2012-01-16 (VIIRS starts 20 Jan 2012). Outside that: no data. |
| Data products and citation | NASA FIRMS standard (science-quality) archive: MODIS Collection 6.1 and VIIRS S-NPP 375 m, per-country files, downloaded Nov 2026. NOAA-20/21 and 2026 near-real-time were deliberately not used. **Check the exact citation wording on the FIRMS site before putting it in the app.** |
| Grid boundaries | 0.5 degree cells aligned to multiples of 0.5. A region box ending on a cell edge does **not** include the next cell. |
| Anomaly for a drawn area | **Approved method (below).** The Backend computes it; `null` is no longer needed once this is in. |

**Anomaly rule (same as ML stage 3):** take the area's weekly value, apply a centered 3-week average, then rank each week among all weeks within **21 days of the same time of year in all years** (percentile 0-100, ties count half). Need at least **20** comparison weeks, otherwise `null`. For the whole region, use ML's `anomaly_region` (authoritative). For a drawn area, compute with `area_anomaly()` in `ml_export_reader.py`: it reproduces ML's result to about 1 percentile point on unrounded values. Because the files round values to 3 decimals, a drawn-area anomaly from them is **approximate**: I measured a median difference of 0.0 and a 99th percentile of 2.6 points, but a few weeks (10 of 1,313 in my synthetic test) differed by more than 3 points, up to 23. Label it approximate.

---

## 4. Backend / API

### 4.1 Data loading
- Replace the sample-CSV loader with a reader for the export folder. `ml_export_reader.py` (standard library only) has `load_region`, `select_cells`, `area_series` and `area_anomaly`.
- Load all five regions at startup (12.63 MB). The processed CSV samples (`processed/sample/*.csv`) contain only the **first few cells of a region** and must never be used for totals.
- Where does the data live in deployment? Either serve it from `frontend/public/data` (same folder the frontend uses) or copy it to a bucket. Keep **one copy**.

### 4.2 `GET /meta`
Map from `meta.json`: `known_gaps` -> your gap fields; `caveats` -> your notes; add dataset info: instruments, period (weekly, Monday), cell size 0.5 degree, coverage `2000-10-30` to `2025-12-22`, and per-source coverage (harmonized and MODIS from 2000-10-30; VIIRS from 2012-01-16). The dataset is **real satellite-derived data**, no longer the "development sample".

### 4.3 `GET /regions`
Return the 5 regions from `regions.json`. `bbox` is `[min_lon, min_lat, max_lon, max_lat]` if your contract uses west,south,east,north. **Add the `calibration` block** (low-sensitivity months, validation) so the frontend can show warnings; extra optional fields do not break existing consumers.

### 4.4 `GET /calendar?bbox=west,south,east,north&start&end&source`

**Region choice:** pick the region whose box contains the drawn box. The Philippines and Indonesia boxes **overlap** (around lat 4.5 - 6.5, lon 116.5 - 127), and the same cell can hold different values in the two regions (each country file only has its own country's fires). If the drawn box touches more than one region, return 422 `bbox_ambiguous_region`, or add an optional `region=<slug>` parameter (the frontend knows the region the user picked). **Recommended: add `region`.**

**Per request:**
1. `cells = select_cells(region, bbox)`: cell **centers** inside the box, edges inclusive (as `API.md` already says).
2. For each Monday in `start..end`:
   - **source = viirs or modis:** `active_cells` = number of selected cells in the week's `viirs` / `modis` list; `null` if the list is `null`. Area value = `active_cells / N`.
   - **source = harmonized:** if `harmonized_default` is `null`, value is null. Otherwise `total = N x default + sum(v - default)` over listed exceptions inside the selection; value = `total / N`; `active_cells = total` (fractional before 2012).
   - **provenance:** from `calendar.json` `source`: `viirs` -> viirs, `modis_scaled` -> scaled, `modis_fill` -> fill (map to your enum).
   - **range:** observed weeks: low = high = value. Estimated weeks: `low = value x harmonized_low / harmonized_cells`, `high` likewise (from that week's region totals; if the region total is 0, low = high = value).
   - **low_sensitivity_share:** 1.0 if the week is estimated **and** its month is in the region's `low_sensitivity_months`, else 0.0. For the MODIS/VIIRS views, `null`.
   - **valid_cells:** `N` if value is not null, else 0.
   - **flags:** from `calendar.json` `flags` (sort and de-duplicate). Add your own `outside_date_coverage` for weeks outside 2000-10-30..2025-12-22 and `source_unavailable` where a sensor is `null`.
   - **anomaly:** whole region -> `anomaly_region` (when source is harmonized; `anomaly_modis_only` / `anomaly_viirs_only` for the raw views). Drawn area -> `area_anomaly()`. Compute once per query over the full history, then slice to the requested dates (the rule needs all years).

**Tested:** I ran the reader on a synthetic region with a known answer: whole-region totals reproduce `calendar.json`; a drawn sub-area matches a direct calculation (max difference 0.0005 in share for harmonized, 0 for MODIS and VIIRS); null weeks stay null; observed weeks have no range; the 2022 outage week comes back as `modis_fill` with `snpp_outage`.

### 4.5 Limits must be raised
`API.md` limits (100 sq deg, 400 cells, 250,000 cell-weeks) were set for the 24-cell sample. **A whole-Cambodia selection (120 cells) passes, but whole-Indonesia (3,384 cells, 846 sq deg), Philippines (714) and Zambia (525) would be rejected.** Suggested (tune, not validated): area up to 1,000 sq deg, cells up to 4,000, weeks up to 1,400. The cell-weeks limit is not needed for the harmonized method above (cost depends on the number of exceptions, not on cells x weeks); drop it or raise it to several million.

### 4.6 Other behaviors
- Keep nullable counts and fractions, 422/413 errors and the response cache. Cache the **full-history area series per (region, bbox, source)** because the anomaly needs it.
- Antimeridian boxes are not needed.
- No selected cells: 200 with empty weeks and `no_cells`, as already specified.
- `partial` coverage from the sample no longer applies. Within a region the data is complete. A box that extends beyond the region just has fewer cells.

---

## 5. Frontend

### 5.1 What to show and where it comes from
| UI element | API field | What to write / how to show |
|---|---|---|
| Header line | `/meta` | **"Weekly fire activity, Nov 2000 - Dec 2025. Each square is about 55 km wide."** |
| Heatmap / map / calendar value | `value` | "% of squares with fire." Not a count of fires. |
| Selected squares | `cells_in_area` | "N squares (~55 km each)" |
| Estimated vs observed | provenance | Observed = "Observed by VIIRS". Scaled = "Estimated from MODIS". Fill = "Estimated from MODIS (VIIRS unavailable)". |
| Active cells | `active_cells` | Integer when observed, **one decimal when estimated** ("about 12.4 squares"). |
| Range | `low`, `high` | Shaded range only for estimated weeks. For a drawn area call it **"approximate range."** |
| Anomaly | `anomaly` | "Unusually active for this time of year (top 10%)" at 90 or more. 0-100 percentile, not a probability. Before 2012 add: "Based on older data; extreme seasons may be understated." |
| Gaps | `flags` + `/meta` `known_gaps` | Show the gap note. |
| Era line | fixed date | A marker at **20 Jan 2012**: "From here values are observed by VIIRS. Before, they are estimated from MODIS." |
| No data | `null` | Grey, hatched. Never the "no fire" color. |

### 5.2 Warnings to add (not in the current frontend notes)
| Show when | Text |
|---|---|
| Estimated week **and** month in `calibration.low_sensitivity_months` | **Low confidence.** In this area the older instrument sees few of the fires the newer one sees, so these values are rough estimates. |
| Fewer than **10** squares selected (my guess; tune) | **Small area.** Estimates are most reliable for whole regions. |
| Region is Belgium | **Belgium has small fires that the older instrument barely sees. It is shown as an example of the method's limits.** |
| `calibration` missing or `validated` false | **Not validated.** |
| Always, in the caveats panel | **Regions follow national borders.** Fires in neighbouring countries are not included, so squares along a border can look quieter than they are. Squares outside the country (or at sea) inside your selection count as "no fire". |

The last two sentences matter: a drawn rectangle often includes squares outside the country, which dilute "% of squares with fire." For the demo, choose shapes well inside the country. A later ML fix could exclude squares that never had data.

### 5.3 Keep what the frontend already does right
- Distinguishing zero, unavailable, missing-record and known-gap states.
- Weekly entries with explicit seven-day ranges, and boundary weeks in each month they touch.
- Anomaly on a fixed 0-100 scale, not described as a prediction.
- No invented units: say "% of squares with fire" and "squares", and nothing more specific.
- Bounding-box selection with a notice about corners outside a circle.
- A source selector (Harmonized / MODIS / VIIRS). Label the two raw views **"not comparable across the 2012 line."**

### 5.4 Changes needed
- Remove the "random development fixture" and "sample data" labels once real data is connected (keep them only if the demo still uses sample data).
- Heatmap color scale: your per-query 98th-percentile saturation is fine within one query. State the endpoints in the legend as you do.
- Show **"through December 2025"**, not "up to now".
- Add the era marker, the warnings in 5.2, and the "estimated" wording in 5.1.

### 5.5 If you must compute in the browser (fallback)
Use the algorithm in 4.4 with the files in section 2. Convert `week.harmonized` to a `Map` once per week. See `web_data_format.md` for a TypeScript sketch.

---

## 6. How to fetch

**Static files (fallback, or for the Backend loader):**
```
/data/regions.json
/data/meta.json
/data/cambodia/cells.json
/data/cambodia/calendar.json
/data/cambodia/2015.json
```

**API (recommended path):**
```
GET /meta
GET /regions
GET /calendar?bbox=102,10,108,15&start=2015-01-05&end=2015-12-28&source=harmonized&region=cambodia
```
(`region` is the optional parameter suggested in 4.4. The bbox above is the whole Cambodia box.)

---

## 7. End-to-end checks (all must pass before the demo)

1. Whole-Cambodia box: `value x 120` equals `harmonized_cells` from `cambodia/calendar.json` for any week (within 0.02).
2. A pre-2012 Belgium week: "Low confidence" and the Belgium note appear.
3. Week of **8 Aug 2022**: flag `snpp_outage`, provenance fill, wording "Estimated from MODIS (VIIRS unavailable)".
4. Any pre-2012 week: "Estimated" label and a range; the 2012 marker is visible on the heatmap.
5. A very small selection (under 10 squares): the small-area warning appears.
6. A week before 30 Oct 2000, or the VIIRS view before 2012: grey "no data", not zero.
7. A whole-Indonesia selection returns data (not 413).
8. A box over the Philippines/Indonesia overlap: asks for or uses the chosen region, and never mixes the two.

---

## 8. Validation figures the About page may quote

From ML (leave-one-year-out across the 14 overlap years, region-wide weekly totals; exact values in `regions.json` `calibration.validation`):

| Region | Raw MODIS bias | Harmonized bias | Weekly correlation | Low-sensitivity months (under 25%) |
|---|---|---|---|---|
| Zambia | -19.6% | -0.0% | 0.99 | Jan, Feb, Mar, Dec |
| Cambodia | -30.5% | -0.1% | 0.97 | Sep |
| Indonesia | -52.3% | -0.1% | 0.97 | Jan, Apr, Dec |
| Philippines | -59.8% | -0.0% | 0.95 | Jun-Oct |
| Belgium | -72.2% | +0.6% | 0.69 | All 12 months |

Wording: *"Tested on years the method had not seen, the harmonized series matched VIIRS's regional totals within about 1%, where raw MODIS undercounted by 20-70%."* Quote bias, not correlation (correlation looks high for any series that follows the seasons). These numbers describe **whole-region totals**; small drawn areas are not validated.

---

## 9. Open items

| Item | Owner |
|---|---|
| Choose recommended path or fallback (section 0) | Team, now |
| Add `region` parameter and `calibration` in `/regions` | Backend |
| Raise limits (4.5) | Backend |
| Confirm section 3 answers | Hans |
| Confirm field names, nullable types, wording and warnings | Frontend (Sean) |
| Citation wording for FIRMS | Docs/presenter |
| Squares outside the country count as zeros (known limitation) | ML, if time allows |
| Whether sample labels stay in the UI | Frontend |

**To finish the field-name mapping,** send ML the frontend's `src/types.ts` and one real `/calendar` JSON response. Then this document can use your exact field names.
