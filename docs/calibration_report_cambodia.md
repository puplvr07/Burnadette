# Calibration report: Cambodia

*Overlap years used to learn the MODIS-to-VIIRS relationship:* [2015, 2016, 2017, 2018]

## How MODIS relates to VIIRS here

| Month | MODIS sees this share of VIIRS fire cell-weeks | VIIRS-active cell-weeks | MODIS false alarms |
|---|---|---|---|
| Jan | 84% | 1209 | 2.1% |
| Feb | 89% | 1320 | 0.6% |
| Mar | 82% | 1291 | 1.3% |
| Apr | 67% | 1154 | 1.6% |
| May | 48% | 746 | 3.1% |
| Jun | 42% | 463 | 2.3% |
| Jul | 26% | 257 | 1.6% |
| Aug | 14% | 195 | 1.8% |
| Sep | 12% | 109 | 1.5% |
| Oct | 24% | 202 | 1.9% |
| Nov | 44% | 398 | 2.5% |
| Dec | 69% | 791 | 2.2% |

Months flagged **low sensitivity** (MODIS sees little, or too little data): Aug, Sep, Oct.

## Validation (tested on years the model did not learn from)

| Test | r (calibrated) | r (raw MODIS) | bias % (calibrated) | bias % (raw MODIS) |
|---|---|---|---|---|
| Leave one year out | 0.98 | 0.97 | -0.4 | -27.8 |
| Learn early years, test late years | 0.96 | 0.96 | -6.4 | -31.8 |
| Learn late years, test early years | 0.98 | 0.97 | 2.9 | -24.2 |

*r* = how closely the weekly region-wide count of VIIRS-active cells is followed. *bias %* = total predicted minus total actual, as a share of actual. The early-vs-late rows show whether the relationship drifts over time. If those two disagree a lot, the pre-2012 values are shakier than the leave-one-year-out numbers suggest.

## Honest limits

- Series covers 2015-01-05 to 2018-12-24.
- Before 2012 the values are *expected* VIIRS-equivalent fire (probabilities), not observations. Use area totals, not single cells.
- The pre-2012 relationship is assumed to equal the 2012-2025 one. That cannot be tested directly.
- Calibrations like this tend to pull extremes toward the middle: an exceptionally bad pre-2012 season is likely UNDERSTATED, and ordinary seasons slightly overstated. For "was that season unusual?" also look at `anomaly_modis_only` (MODIS compared only with its own history), which needs no calibration.
- Uncertainty band method: bootstrap over overlap years (10th-90th percentile).
- A quiet week can mean cloud or no satellite pass: hotspot files have no cloud information.
