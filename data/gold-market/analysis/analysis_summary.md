# Gold Market Correlation Analysis

Generated: 2026-08-11T06:30:01.677Z
Rows: 5678
Features tested: 64

## How To Read This

- Correlations use today-known features against future gold outcomes.
- `target_gold_return_next_3m` is the next 63 trading-day gold futures return.
- `target_bad_entry_3m` is 1 when the next 3 months include a drawdown of -7% or worse.
- These are association checks, not causal proof.

## Top Correlations With Next 3M Gold Return

| Feature | n | Spearman | Pearson |
|---|---:|---:|---:|
| dfii10_value | 5615 | 0.361 | 0.356 |
| payems_value_change_3m | 5552 | -0.304 | -0.169 |
| fedfunds_value | 5615 | 0.256 | 0.277 |
| payems_value_change_1m | 5594 | -0.214 | -0.057 |
| rrpontsyd_value_change_3m | 5551 | -0.157 | -0.158 |
| t10y2y_value | 5615 | -0.153 | -0.122 |
| gold_drawdown_from_252d_high | 5615 | 0.141 | 0.090 |
| t10yie_value_change_3m | 5552 | -0.140 | -0.176 |
| fedfunds_value_change_3m | 5552 | -0.139 | -0.116 |
| wti_crude_oil_return_3m | 5552 | -0.125 | -0.154 |
| t10yie_value_change_1m | 5594 | -0.123 | -0.134 |
| t10y2y_value_change_3m | 5552 | 0.121 | 0.129 |

## Top Correlations With Bad Entry Risk

| Feature | n | Spearman | Pearson |
|---|---:|---:|---:|
| dfii10_value | 5677 | -0.178 | -0.169 |
| fedfunds_value | 5677 | -0.178 | -0.177 |
| t10y2y_value | 5677 | 0.160 | 0.144 |
| rrpontsyd_value_change_3m | 5613 | 0.141 | 0.088 |
| gold_drawdown_from_252d_high | 5677 | -0.137 | -0.111 |
| vix_percentile_1y | 5426 | 0.101 | 0.099 |
| wti_crude_oil_return_3m | 5614 | 0.099 | 0.094 |
| rrpontsyd_value | 5676 | -0.094 | -0.060 |
| rrpontsyd_value_change_1m | 5655 | 0.093 | 0.093 |
| sp500_return_3m | 5614 | -0.092 | -0.095 |
| iau_return_3m | 5347 | -0.087 | -0.050 |
| gld_return_3m | 5393 | -0.085 | -0.047 |

## Strongest 5-Bucket Spreads

| Feature | Low Bucket 3M Return | High Bucket 3M Return | High-Low Spread | Bad Risk Spread |
|---|---:|---:|---:|---:|
| dfii10_value | -1.10% | 7.44% | 8.54% | -23.70% |
| payems_value_change_3m | 6.75% | 0.55% | -6.19% | 3.90% |
| fedfunds_value | 0.80% | 6.94% | 6.14% | -23.80% |
| payems_value_change_1m | 5.55% | 1.00% | -4.55% | 1.72% |
| fedfunds_value_change_3m | 6.81% | 3.11% | -3.71% | -3.03% |
| tnx_close_change_3m | 6.17% | 2.57% | -3.60% | 9.55% |
| rrpontsyd_value_change_3m | 5.08% | 1.58% | -3.49% | 16.46% |
| fedfunds_value_change_1m | 6.56% | 3.29% | -3.27% | -5.14% |
| t10yie_value | 4.09% | 1.05% | -3.03% | 14.86% |
| wti_crude_oil_return_3m | 4.87% | 1.85% | -3.03% | 10.14% |
| rrpontsyd_value_change_1m | 4.51% | 1.51% | -3.00% | 11.83% |
| tnx_return_3m | 4.26% | 1.46% | -2.80% | 10.86% |

## Stability Across Market Regimes

| Feature | Sign Stability | Avg Spearman | Avg Abs Spearman |
|---|---:|---:|---:|
| dfii10_value | 100.00% | 0.290 | 0.290 |
| payems_value_change_3m | 100.00% | -0.278 | 0.278 |
| t10yie_value | 100.00% | -0.196 | 0.196 |
| fedfunds_value_change_3m | 100.00% | -0.188 | 0.188 |
| tnx_return_3m | 100.00% | -0.162 | 0.162 |
| tnx_close_change_3m | 100.00% | -0.157 | 0.157 |
| wti_crude_oil_return_3m | 100.00% | -0.153 | 0.153 |
| fedfunds_value_change_1m | 100.00% | -0.144 | 0.144 |
| t10yie_value_change_3m | 100.00% | -0.138 | 0.138 |
| rrpontsyd_value | 100.00% | -0.129 | 0.129 |
| t10yie_value_change_1m | 100.00% | -0.118 | 0.118 |
| wti_crude_oil_return_1m | 100.00% | -0.113 | 0.113 |

## Data Quality Notes

- No feature has more than 20% missing values.

## Next Modeling Step

- Build a baseline rule score from the strongest stable signals.
- Train a time-series split classifier for `target_good_entry_3m` and `target_bad_entry_3m`.
- Compare model signals against simple score buckets before displaying predictions on the page.
