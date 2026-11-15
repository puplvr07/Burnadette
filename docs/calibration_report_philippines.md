# Calibration report: Philippines

*Overlap years used to learn the MODIS-to-VIIRS relationship:* [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]

## How MODIS relates to VIIRS here

| Month | MODIS sees this share of VIIRS fire cell-weeks | VIIRS-active cell-weeks | MODIS false alarms |
|---|---|---|---|
| Jan | 37% | 3623 | 0.4% |
| Feb | 44% | 5143 | 0.5% |
| Mar | 48% | 7296 | 0.4% |
| Apr | 46% | 8174 | 0.4% |
| May | 29% | 4945 | 0.7% |
| Jun | 16% | 2048 | 0.6% |
| Jul | 14% | 1555 | 0.4% |
| Aug | 19% | 1924 | 0.5% |
| Sep | 15% | 1875 | 0.5% |
| Oct | 19% | 2207 | 0.5% |
| Nov | 26% | 2485 | 0.4% |
| Dec | 33% | 2729 | 0.4% |

Months flagged **low sensitivity** (MODIS sees little, or too little data): Jun, Jul, Aug, Sep, Oct.

## Validation (tested on years the model did not learn from)

| Test | r (calibrated) | r (raw MODIS) | bias % (calibrated) | bias % (raw MODIS) |
|---|---|---|---|---|
| Leave one year out | 0.95 | 0.96 | -0.0 | -59.8 |
| Learn early years, test late years | 0.95 | 0.96 | 2.2 | -60.7 |
| Learn late years, test early years | 0.95 | 0.95 | -2.6 | -58.9 |

*r* = how closely the weekly region-wide count of VIIRS-active cells is followed. *bias %* = total predicted minus total actual, as a share of actual. The early-vs-late rows show whether the relationship drifts over time. If those two disagree a lot, the pre-2012 values are shakier than the leave-one-year-out numbers suggest.

## Honest limits

- Series covers 2000-01-03 to 2025-12-22.
- Before 2012 the values are *expected* VIIRS-equivalent fire (probabilities), not observations. Use area totals, not single cells.
- The pre-2012 relationship is assumed to equal the 2012-2025 one. That cannot be tested directly.
- Calibrations like this tend to pull extremes toward the middle: an exceptionally bad pre-2012 season is likely UNDERSTATED, and ordinary seasons slightly overstated. For "was that season unusual?" also look at `anomaly_modis_only` (MODIS compared only with its own history), which needs no calibration.
- Uncertainty band method: bootstrap over overlap years (10th-90th percentile).
- A quiet week can mean cloud or no satellite pass: hotspot files have no cloud information.
