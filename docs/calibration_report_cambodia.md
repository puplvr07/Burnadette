# Calibration report: Cambodia

*Overlap years used to learn the MODIS-to-VIIRS relationship:* [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]

## How MODIS relates to VIIRS here

| Month | MODIS sees this share of VIIRS fire cell-weeks | VIIRS-active cell-weeks | MODIS false alarms |
|---|---|---|---|
| Jan | 86% | 4264 | 1.8% |
| Feb | 88% | 4458 | 1.2% |
| Mar | 82% | 4691 | 1.8% |
| Apr | 63% | 4073 | 2.4% |
| May | 46% | 2740 | 3.1% |
| Jun | 41% | 1938 | 2.5% |
| Jul | 30% | 1173 | 1.8% |
| Aug | 26% | 925 | 2.1% |
| Sep | 12% | 350 | 1.7% |
| Oct | 26% | 713 | 2.6% |
| Nov | 38% | 1554 | 2.2% |
| Dec | 69% | 3430 | 2.4% |

Months flagged **low sensitivity** (MODIS sees little, or too little data): Sep.

## Validation (tested on years the model did not learn from)

| Test | r (calibrated) | r (raw MODIS) | bias % (calibrated) | bias % (raw MODIS) |
|---|---|---|---|---|
| Leave one year out | 0.97 | 0.95 | -0.1 | -30.5 |
| Learn early years, test late years | 0.97 | 0.94 | -1.1 | -30.8 |
| Learn late years, test early years | 0.98 | 0.96 | 0.6 | -30.1 |

*r* = how closely the weekly region-wide count of VIIRS-active cells is followed. *bias %* = total predicted minus total actual, as a share of actual. The early-vs-late rows show whether the relationship drifts over time. If those two disagree a lot, the pre-2012 values are shakier than the leave-one-year-out numbers suggest.

## Honest limits

- Series covers 2000-01-03 to 2025-12-22.
- Before 2012 the values are *expected* VIIRS-equivalent fire (probabilities), not observations. Use area totals, not single cells.
- The pre-2012 relationship is assumed to equal the 2012-2025 one. That cannot be tested directly.
- Calibrations like this tend to pull extremes toward the middle: an exceptionally bad pre-2012 season is likely UNDERSTATED, and ordinary seasons slightly overstated. For "was that season unusual?" also look at `anomaly_modis_only` (MODIS compared only with its own history), which needs no calibration.
- Uncertainty band method: bootstrap over overlap years (10th-90th percentile).
- A quiet week can mean cloud or no satellite pass: hotspot files have no cloud information.
