# Calibration report: Cambodia

*Overlap years used to learn the MODIS-to-VIIRS relationship:* [2012, 2013, 2014, 2015, 2016, 2017, 2018]

## How MODIS relates to VIIRS here

| Month | MODIS sees this share of VIIRS fire cell-weeks | VIIRS-active cell-weeks | MODIS false alarms |
|---|---|---|---|
| Jan | 85% | 2024 | 2.3% |
| Feb | 88% | 2277 | 0.9% |
| Mar | 83% | 2310 | 1.9% |
| Apr | 64% | 2068 | 2.1% |
| May | 52% | 1416 | 3.1% |
| Jun | 44% | 987 | 2.4% |
| Jul | 30% | 574 | 1.7% |
| Aug | 22% | 490 | 2.1% |
| Sep | 10% | 204 | 1.7% |
| Oct | 28% | 464 | 2.5% |
| Nov | 43% | 827 | 1.9% |
| Dec | 70% | 1654 | 2.1% |

Months flagged **low sensitivity** (MODIS sees little, or too little data): Aug, Sep.

## Validation (tested on years the model did not learn from)

| Test | r (calibrated) | r (raw MODIS) | bias % (calibrated) | bias % (raw MODIS) |
|---|---|---|---|---|
| Leave one year out | 0.98 | 0.96 | -0.1 | -30.2 |
| Learn early years, test late years | 0.98 | 0.96 | 2.8 | -29.6 |
| Learn late years, test early years | 0.98 | 0.96 | -3.0 | -30.8 |

*r* = how closely the weekly region-wide count of VIIRS-active cells is followed. *bias %* = total predicted minus total actual, as a share of actual. The early-vs-late rows show whether the relationship drifts over time. If those two disagree a lot, the pre-2012 values are shakier than the leave-one-year-out numbers suggest.

## Honest limits

- Series covers 2000-01-03 to 2018-12-24.
- Before 2012 the values are *expected* VIIRS-equivalent fire (probabilities), not observations. Use area totals, not single cells.
- The pre-2012 relationship is assumed to equal the 2012-2025 one. That cannot be tested directly.
- Calibrations like this tend to pull extremes toward the middle: an exceptionally bad pre-2012 season is likely UNDERSTATED, and ordinary seasons slightly overstated. For "was that season unusual?" also look at `anomaly_modis_only` (MODIS compared only with its own history), which needs no calibration.
- Uncertainty band method: bootstrap over overlap years (10th-90th percentile).
- A quiet week can mean cloud or no satellite pass: hotspot files have no cloud information.
