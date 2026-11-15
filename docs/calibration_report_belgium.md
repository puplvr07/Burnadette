# Calibration report: Belgium

*Overlap years used to learn the MODIS-to-VIIRS relationship:* [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]

## How MODIS relates to VIIRS here

| Month | MODIS sees this share of VIIRS fire cell-weeks | VIIRS-active cell-weeks | MODIS false alarms |
|---|---|---|---|
| Jan | 3% | 29 | 0.0% |
| Feb | 6% | 68 | 0.2% |
| Mar | 22% | 197 | 3.6% |
| Apr | 22% | 285 | 3.5% |
| May | 13% | 306 | 2.6% |
| Jun | 6% | 273 | 1.9% |
| Jul | 10% | 278 | 1.3% |
| Aug | 14% | 257 | 2.8% |
| Sep | 19% | 276 | 1.7% |
| Oct | 4% | 73 | 0.6% |
| Nov | 3% | 74 | 0.3% |
| Dec | 2% | 40 | 0.1% |

Months flagged **low sensitivity** (MODIS sees little, or too little data): Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec.

## Validation (tested on years the model did not learn from)

| Test | r (calibrated) | r (raw MODIS) | bias % (calibrated) | bias % (raw MODIS) |
|---|---|---|---|---|
| Leave one year out | 0.69 | 0.59 | 0.6 | -72.2 |
| Learn early years, test late years | 0.70 | 0.58 | -9.3 | -77.1 |
| Learn late years, test early years | 0.66 | 0.60 | 14.3 | -67.3 |

*r* = how closely the weekly region-wide count of VIIRS-active cells is followed. *bias %* = total predicted minus total actual, as a share of actual. The early-vs-late rows show whether the relationship drifts over time. If those two disagree a lot, the pre-2012 values are shakier than the leave-one-year-out numbers suggest.

## Honest limits

- Series covers 2000-01-03 to 2025-12-22.
- Before 2012 the values are *expected* VIIRS-equivalent fire (probabilities), not observations. Use area totals, not single cells.
- The pre-2012 relationship is assumed to equal the 2012-2025 one. That cannot be tested directly.
- Calibrations like this tend to pull extremes toward the middle: an exceptionally bad pre-2012 season is likely UNDERSTATED, and ordinary seasons slightly overstated. For "was that season unusual?" also look at `anomaly_modis_only` (MODIS compared only with its own history), which needs no calibration.
- Uncertainty band method: bootstrap over overlap years (10th-90th percentile).
- A quiet week can mean cloud or no satellite pass: hotspot files have no cloud information.
