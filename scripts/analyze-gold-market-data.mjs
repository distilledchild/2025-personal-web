import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const datasetDir = path.join(rootDir, 'data', 'gold-market');
const featureTablePath = path.join(datasetDir, 'processed', 'gold_feature_table_daily.csv');
const analysisDir = path.join(datasetDir, 'analysis');

const targets = [
  'target_gold_return_next_1m',
  'target_gold_return_next_3m',
  'target_gold_max_drawdown_next_3m',
  'target_good_entry_3m',
  'target_bad_entry_3m',
];

const preferredFeatureOrder = [
  'gold_futures_return_1m',
  'gold_futures_return_3m',
  'gold_drawdown_from_252d_high',
  'dxy_return_1m',
  'dxy_return_3m',
  'dfii10_value',
  'tnx_return_1m',
  't10yie_value',
  'vix_close',
  'vix_percentile_1y',
  'sp500_return_1m',
  'nasdaq_return_1m',
  'silver_futures_return_1m',
  'copper_futures_return_1m',
  'wti_crude_oil_return_1m',
  'fedfunds_value',
  'rrpontsyd_value',
  'central_bank_gold_reserves_top15_change_3m',
  'days_to_next_fomc',
  'days_since_last_fomc',
];

const derivedChangeBases = [
  'dfii10_value',
  'fedfunds_value',
  'tnx_close',
  'dxy_close',
  'vix_close',
  't10y2y_value',
  't10yie_value',
  'cpiaucsl_value',
  'pcepi_value',
  'rrpontsyd_value',
  'payems_value',
  'm2sl_value',
  'central_bank_gold_reserves_top15_tonnes',
];

const stabilityWindows = [
  { label: '2004_2010', start: '2004-01-01', end: '2010-12-31' },
  { label: '2011_2016', start: '2011-01-01', end: '2016-12-31' },
  { label: '2017_2021', start: '2017-01-01', end: '2021-12-31' },
  { label: '2022_present', start: '2022-01-01', end: '9999-12-31' },
];

const timingThreshold = 70;
const troyOunceToGrams = 31.1034768;

const timingSignalConfigs = [
  {
    feature: 'payems_value_change_3m',
    label: 'Payroll cooling',
    category: 'Growth',
    bullishWhen: 'low',
    weight: 0.22,
    detail: 'Slower payroll growth has historically been one of the cleaner macro backdrops for better forward gold returns.',
  },
  {
    feature: 'dxy_return_3m',
    label: 'Dollar pressure',
    category: 'Dollar',
    bullishWhen: 'low',
    weight: 0.18,
    detail: 'A weaker dollar reduces headwind for gold because gold is priced globally in USD.',
  },
  {
    feature: 'tnx_return_3m',
    label: '10Y yield pressure',
    category: 'Rates',
    bullishWhen: 'low',
    weight: 0.17,
    detail: 'Falling or stable long rates reduce the opportunity-cost pressure that often weighs on gold.',
  },
  {
    feature: 'gold_futures_return_3m',
    label: 'Gold momentum',
    category: 'Trend',
    bullishWhen: 'high',
    weight: 0.15,
    detail: 'Positive three-month momentum confirms that buyers are already supporting the trend.',
  },
  {
    feature: 't10yie_value',
    label: 'Inflation expectation level',
    category: 'Inflation',
    bullishWhen: 'low',
    weight: 0.14,
    detail: 'The historical analysis showed very high breakeven inflation levels were not automatically better entry points.',
  },
  {
    feature: 'gold_drawdown_from_252d_high',
    label: 'Trend health vs 52W high',
    category: 'Trend',
    bullishWhen: 'high',
    weight: 0.14,
    detail: 'A smaller drawdown from the 52-week high keeps the trend-health signal constructive.',
  },
];

const parseCsv = (text) => {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const values = line.split(',');
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
};

const toNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const std = (values) => {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
};

const pearson = (pairs) => {
  if (pairs.length < 30) return null;
  const xs = pairs.map(([x]) => x);
  const ys = pairs.map(([, y]) => y);
  const xMean = mean(xs);
  const yMean = mean(ys);
  let numerator = 0;
  let xDenominator = 0;
  let yDenominator = 0;

  for (const [x, y] of pairs) {
    const xDiff = x - xMean;
    const yDiff = y - yMean;
    numerator += xDiff * yDiff;
    xDenominator += xDiff ** 2;
    yDenominator += yDiff ** 2;
  }

  const denominator = Math.sqrt(xDenominator * yDenominator);
  return denominator ? numerator / denominator : null;
};

const rank = (values) => {
  const sorted = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);
  const ranks = Array(values.length);

  for (let i = 0; i < sorted.length; i += 1) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].value === sorted[i].value) j += 1;
    const avgRank = (i + j + 2) / 2;
    for (let k = i; k <= j; k += 1) ranks[sorted[k].index] = avgRank;
    i = j;
  }

  return ranks;
};

const spearman = (pairs) => {
  if (pairs.length < 30) return null;
  const xRanks = rank(pairs.map(([x]) => x));
  const yRanks = rank(pairs.map(([, y]) => y));
  return pearson(xRanks.map((xRank, index) => [xRank, yRanks[index]]));
};

const round = (value, digits = 6) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Number(value.toFixed(digits));
};

const csvEscape = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str;
};

const writeJson = async (filePath, data) => {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
};

const writeCsv = async (filePath, rows) => {
  if (!rows.length) {
    await fs.writeFile(filePath, '');
    return;
  }

  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set()));

  const csv = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ].join('\n');

  await fs.writeFile(filePath, `${csv}\n`);
};

const getFeatureColumns = (headers) => headers.filter((header) => (
  header !== 'date'
  && !targets.includes(header)
  && !header.endsWith('_close')
));

const addDerivedFeatures = (rows) => {
  const lags = [
    { suffix: 'change_1m', days: 21 },
    { suffix: 'change_3m', days: 63 },
  ];

  for (const base of derivedChangeBases) {
    if (!(base in (rows[0] || {}))) continue;

    for (let index = 0; index < rows.length; index += 1) {
      const current = toNumber(rows[index][base]);
      for (const lag of lags) {
        const previous = index >= lag.days ? toNumber(rows[index - lag.days][base]) : null;
        rows[index][`${base}_${lag.suffix}`] = current !== null && previous !== null
          ? String(current - previous)
          : '';
      }
    }
  }

  return rows;
};

const getPairs = (rows, feature, target) => rows
  .map((row) => [toNumber(row[feature]), toNumber(row[target])])
  .filter(([x, y]) => x !== null && y !== null);

const buildQualitySummary = (rows, features) => {
  const rowCount = rows.length;
  return features.map((feature) => {
    const values = rows.map((row) => toNumber(row[feature])).filter((value) => value !== null);
    return {
      feature,
      rows: rowCount,
      valid_rows: values.length,
      missing_rows: rowCount - values.length,
      missing_rate: round((rowCount - values.length) / rowCount),
      mean: round(values.length ? mean(values) : null),
      median: round(median(values)),
      std: round(values.length ? std(values) : null),
      min: round(values.length ? Math.min(...values) : null),
      max: round(values.length ? Math.max(...values) : null),
    };
  });
};

const buildCorrelations = (rows, features) => {
  const results = [];
  for (const feature of features) {
    for (const target of targets) {
      const pairs = getPairs(rows, feature, target);
      const pearsonValue = pearson(pairs);
      const spearmanValue = spearman(pairs);
      results.push({
        feature,
        target,
        n: pairs.length,
        pearson: round(pearsonValue),
        spearman: round(spearmanValue),
        abs_pearson: round(pearsonValue === null ? null : Math.abs(pearsonValue)),
        abs_spearman: round(spearmanValue === null ? null : Math.abs(spearmanValue)),
      });
    }
  }

  return results.sort((a, b) => (b.abs_spearman ?? 0) - (a.abs_spearman ?? 0));
};

const bucketRows = (rows, feature, bucketCount = 5) => {
  const valid = rows
    .map((row) => ({ row, value: toNumber(row[feature]) }))
    .filter((item) => item.value !== null)
    .sort((a, b) => a.value - b.value);

  if (valid.length < bucketCount * 30) return [];

  return Array.from({ length: bucketCount }, (_, index) => {
    const start = Math.floor(index * valid.length / bucketCount);
    const end = Math.floor((index + 1) * valid.length / bucketCount);
    const bucket = valid.slice(start, end);
    const values = bucket.map((item) => item.value);
    const return1m = bucket.map((item) => toNumber(item.row.target_gold_return_next_1m)).filter((value) => value !== null);
    const return3m = bucket.map((item) => toNumber(item.row.target_gold_return_next_3m)).filter((value) => value !== null);
    const drawdown3m = bucket.map((item) => toNumber(item.row.target_gold_max_drawdown_next_3m)).filter((value) => value !== null);
    const goodEntry = bucket.map((item) => toNumber(item.row.target_good_entry_3m)).filter((value) => value !== null);
    const badEntry = bucket.map((item) => toNumber(item.row.target_bad_entry_3m)).filter((value) => value !== null);

    return {
      feature,
      bucket: index + 1,
      bucket_label: index === 0 ? 'lowest' : index === bucketCount - 1 ? 'highest' : `q${index + 1}`,
      n: bucket.length,
      feature_min: round(values[0]),
      feature_max: round(values[values.length - 1]),
      feature_median: round(median(values)),
      avg_gold_return_next_1m: round(return1m.length ? mean(return1m) : null),
      avg_gold_return_next_3m: round(return3m.length ? mean(return3m) : null),
      median_gold_return_next_3m: round(median(return3m)),
      avg_gold_max_drawdown_next_3m: round(drawdown3m.length ? mean(drawdown3m) : null),
      good_entry_rate_3m: round(goodEntry.length ? mean(goodEntry) : null),
      bad_entry_rate_3m: round(badEntry.length ? mean(badEntry) : null),
    };
  });
};

const buildBucketBacktest = (rows, features) => features.flatMap((feature) => bucketRows(rows, feature));

const buildBucketSpreads = (bucketBacktest) => {
  const byFeature = Map.groupBy(bucketBacktest, (row) => row.feature);
  return Array.from(byFeature.entries()).map(([feature, buckets]) => {
    const sorted = [...buckets].sort((a, b) => a.bucket - b.bucket);
    const low = sorted[0];
    const high = sorted[sorted.length - 1];
    return {
      feature,
      high_minus_low_avg_return_3m: round(high.avg_gold_return_next_3m - low.avg_gold_return_next_3m),
      high_minus_low_good_entry_rate_3m: round(high.good_entry_rate_3m - low.good_entry_rate_3m),
      high_minus_low_bad_entry_rate_3m: round(high.bad_entry_rate_3m - low.bad_entry_rate_3m),
      low_bucket_return_3m: low.avg_gold_return_next_3m,
      high_bucket_return_3m: high.avg_gold_return_next_3m,
      low_bad_entry_rate_3m: low.bad_entry_rate_3m,
      high_bad_entry_rate_3m: high.bad_entry_rate_3m,
    };
  }).sort((a, b) => Math.abs(b.high_minus_low_avg_return_3m) - Math.abs(a.high_minus_low_avg_return_3m));
};

const buildStability = (rows, features) => {
  const target = 'target_gold_return_next_3m';
  return features.map((feature) => {
    const windowResults = stabilityWindows.map((window) => {
      const windowRows = rows.filter((row) => row.date >= window.start && row.date <= window.end);
      const pairs = getPairs(windowRows, feature, target);
      return {
        [`${window.label}_n`]: pairs.length,
        [`${window.label}_spearman`]: round(spearman(pairs)),
      };
    });

    const merged = Object.assign({}, ...windowResults);
    const values = stabilityWindows
      .map((window) => merged[`${window.label}_spearman`])
      .filter((value) => value !== null && value !== undefined);
    const positiveCount = values.filter((value) => value > 0).length;
    const negativeCount = values.filter((value) => value < 0).length;
    const dominantSignCount = Math.max(positiveCount, negativeCount);

    return {
      feature,
      windows_with_signal: values.length,
      dominant_sign_count: dominantSignCount,
      sign_stability: values.length ? round(dominantSignCount / values.length) : null,
      avg_abs_spearman: values.length ? round(mean(values.map((value) => Math.abs(value)))) : null,
      avg_spearman: values.length ? round(mean(values)) : null,
      ...merged,
    };
  }).sort((a, b) => {
    const stabilityDiff = (b.sign_stability ?? 0) - (a.sign_stability ?? 0);
    return stabilityDiff || (b.avg_abs_spearman ?? 0) - (a.avg_abs_spearman ?? 0);
  });
};

const percentileRank = (values, currentValue) => {
  const sorted = values
    .filter((value) => value !== null && Number.isFinite(value))
    .sort((a, b) => a - b);

  if (!sorted.length || currentValue === null) return null;

  const lowerOrEqual = sorted.filter((value) => value <= currentValue).length;
  return lowerOrEqual / sorted.length;
};

const formatTimingValue = (feature, value) => {
  if (value === null) return 'n/a';

  if (feature.includes('return') || feature.includes('drawdown')) {
    return `${(value * 100).toFixed(1)}%`;
  }

  if (feature === 'payems_value_change_3m') {
    return `${Math.round(value).toLocaleString()}k jobs`;
  }

  if (feature === 't10yie_value' || feature === 'tnx_close' || feature === 'dfii10_value') {
    return `${value.toFixed(2)}%`;
  }

  return Math.abs(value) >= 100 ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : value.toFixed(2);
};

const getTimingZone = (score) => {
  if (score >= timingThreshold) {
    return {
      id: 'accumulation',
      label: 'Accumulation zone',
      action: 'Gold setup is favorable enough to consider accumulation.',
    };
  }

  if (score >= 50) {
    return {
      id: 'watch',
      label: 'Watch zone',
      action: 'The setup has constructive pieces, but it is below the accumulation threshold.',
    };
  }

  if (score >= 30) {
    return {
      id: 'caution',
      label: 'Caution zone',
      action: 'Macro and trend signals are mixed; avoid forcing a new entry.',
    };
  }

  return {
    id: 'avoid',
    label: 'Avoid zone',
    action: 'The setup is unfavorable for a fresh gold entry.',
  };
};

const buildTimingSignalsForRow = (row, historicalRows) => {
  const availableConfigs = timingSignalConfigs.filter((config) => row && toNumber(row[config.feature]) !== null);
  const totalWeight = availableConfigs.reduce((sum, config) => sum + config.weight, 0);

  return availableConfigs.map((config) => {
    const currentValue = toNumber(row[config.feature]);
    const historicalValues = historicalRows.map((historicalRow) => toNumber(historicalRow[config.feature]));
    const rawPercentile = percentileRank(historicalValues, currentValue);
    const signalScore = rawPercentile === null
      ? 50
      : config.bullishWhen === 'high'
        ? rawPercentile * 100
        : (1 - rawPercentile) * 100;
    const normalizedWeight = totalWeight ? config.weight / totalWeight : 0;

    return {
      feature: config.feature,
      label: config.label,
      category: config.category,
      detail: config.detail,
      direction: config.bullishWhen === 'high' ? 'Higher is better' : 'Lower is better',
      currentValue: round(currentValue),
      formattedValue: formatTimingValue(config.feature, currentValue),
      percentile: round(rawPercentile),
      signalScore: round(signalScore, 1),
      weight: round(normalizedWeight, 4),
      contributionPoints: round((signalScore - 50) * normalizedWeight, 1),
    };
  });
};

const scoreTimingSignals = (signals) => round(
  signals.reduce((sum, signal) => sum + signal.signalScore * signal.weight, 0),
  1,
);

const getIsoDateOneYearBefore = (dateString) => {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() - 1);
  return date.toISOString().slice(0, 10);
};

const getNextBusinessDate = (dateString) => {
  const date = new Date(`${dateString}T00:00:00Z`);
  do {
    date.setUTCDate(date.getUTCDate() + 1);
  } while (date.getUTCDay() === 0 || date.getUTCDay() === 6);
  return date.toISOString().slice(0, 10);
};

const buildGoldTimingSnapshot = (rows) => {
  const indexedRows = rows.map((row, index) => ({ row, index }));
  const latestItem = [...indexedRows]
    .reverse()
    .find(({ row }) => toNumber(row.gold_futures_close) !== null);
  const latest = latestItem?.row;
  const signals = latestItem
    ? buildTimingSignalsForRow(latest, rows.slice(0, latestItem.index + 1))
    : [];

  const score = scoreTimingSignals(signals);
  const zone = getTimingZone(score);
  const historyStartDate = latest ? getIsoDateOneYearBefore(latest.date) : null;
  const rawHistory = latest
    ? indexedRows
      .filter(({ row }) => (
        row.date >= historyStartDate
        && row.date <= latest.date
        && toNumber(row.gold_futures_close) !== null
      ))
      .map(({ row, index }) => {
        const rowSignals = buildTimingSignalsForRow(row, rows.slice(0, index + 1));
        const rowScore = scoreTimingSignals(rowSignals);
        const goldFuturesClose = toNumber(row.gold_futures_close);
        return {
          date: row.date,
          score: rowScore,
          zoneId: getTimingZone(rowScore).id,
          goldFuturesClose: round(goldFuturesClose, 2),
          goldPricePerGram: goldFuturesClose === null ? null : round(goldFuturesClose / troyOunceToGrams, 2),
          fedFundsRate: round(toNumber(row.fedfunds_value), 2),
        };
      })
    : [];

  const history = rawHistory.map((point, index) => {
    const predictedScore = index > 0 ? rawHistory[index - 1].score : null;
    const forecastError = predictedScore === null ? null : round(point.score - predictedScore, 1);

    return {
      ...point,
      predictedScore,
      forecastError,
    };
  });

  const latestHistoryPoint = history.at(-1);
  const nextForecast = latestHistoryPoint
    ? {
      basisDate: latestHistoryPoint.date,
      forecastDate: getNextBusinessDate(latestHistoryPoint.date),
      predictedScore: latestHistoryPoint.score,
      model: 'Persistence baseline: tomorrow score = latest available score',
    }
    : null;

  return {
    generatedAt: new Date().toISOString(),
    asOfDate: latest?.date ?? null,
    historyStartDate,
    threshold: timingThreshold,
    score,
    zone,
    signals,
    history,
    nextForecast,
    methodology: [
      'Use a compact set of six interpretable signals instead of the full feature table.',
      'Convert the latest value of each signal into its historical percentile.',
      'Flip the percentile when lower values are historically more bullish for gold.',
      'Weight the signals into a 0-100 Gold Timing Score.',
      `Treat ${timingThreshold}+ as the accumulation threshold; below that, keep the page in watch or caution mode.`,
    ],
  };
};

const formatPct = (value) => value === null || value === undefined
  ? 'n/a'
  : `${(value * 100).toFixed(2)}%`;

const formatNum = (value) => value === null || value === undefined
  ? 'n/a'
  : value.toFixed(3);

const buildMarkdownSummary = ({ rows, correlations, bucketSpreads, qualitySummary, stability, features }) => {
  const topReturn = correlations
    .filter((row) => row.target === 'target_gold_return_next_3m')
    .slice(0, 12);
  const topRisk = correlations
    .filter((row) => row.target === 'target_bad_entry_3m')
    .slice(0, 12);
  const topBuckets = bucketSpreads.slice(0, 12);
  const stable = stability
    .filter((row) => row.windows_with_signal >= 3 && row.sign_stability >= 0.75)
    .slice(0, 12);
  const missing = qualitySummary.filter((row) => row.missing_rate > 0.2).sort((a, b) => b.missing_rate - a.missing_rate);

  const lines = [
    '# Gold Market Correlation Analysis',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Rows: ${rows.length}`,
    `Features tested: ${features.length}`,
    '',
    '## How To Read This',
    '',
    '- Correlations use today-known features against future gold outcomes.',
    '- `target_gold_return_next_3m` is the next 63 trading-day gold futures return.',
    '- `target_bad_entry_3m` is 1 when the next 3 months include a drawdown of -7% or worse.',
    '- These are association checks, not causal proof.',
    '',
    '## Top Correlations With Next 3M Gold Return',
    '',
    '| Feature | n | Spearman | Pearson |',
    '|---|---:|---:|---:|',
    ...topReturn.map((row) => `| ${row.feature} | ${row.n} | ${formatNum(row.spearman)} | ${formatNum(row.pearson)} |`),
    '',
    '## Top Correlations With Bad Entry Risk',
    '',
    '| Feature | n | Spearman | Pearson |',
    '|---|---:|---:|---:|',
    ...topRisk.map((row) => `| ${row.feature} | ${row.n} | ${formatNum(row.spearman)} | ${formatNum(row.pearson)} |`),
    '',
    '## Strongest 5-Bucket Spreads',
    '',
    '| Feature | Low Bucket 3M Return | High Bucket 3M Return | High-Low Spread | Bad Risk Spread |',
    '|---|---:|---:|---:|---:|',
    ...topBuckets.map((row) => `| ${row.feature} | ${formatPct(row.low_bucket_return_3m)} | ${formatPct(row.high_bucket_return_3m)} | ${formatPct(row.high_minus_low_avg_return_3m)} | ${formatPct(row.high_minus_low_bad_entry_rate_3m)} |`),
    '',
    '## Stability Across Market Regimes',
    '',
    '| Feature | Sign Stability | Avg Spearman | Avg Abs Spearman |',
    '|---|---:|---:|---:|',
    ...stable.map((row) => `| ${row.feature} | ${formatPct(row.sign_stability)} | ${formatNum(row.avg_spearman)} | ${formatNum(row.avg_abs_spearman)} |`),
    '',
    '## Data Quality Notes',
    '',
    missing.length
      ? missing.slice(0, 12).map((row) => `- ${row.feature}: ${(row.missing_rate * 100).toFixed(1)}% missing`).join('\n')
      : '- No feature has more than 20% missing values.',
    '',
    '## Next Modeling Step',
    '',
    '- Build a baseline rule score from the strongest stable signals.',
    '- Train a time-series split classifier for `target_good_entry_3m` and `target_bad_entry_3m`.',
    '- Compare model signals against simple score buckets before displaying predictions on the page.',
  ];

  return `${lines.join('\n')}\n`;
};

const main = async () => {
  await fs.mkdir(analysisDir, { recursive: true });
  const csvText = await fs.readFile(featureTablePath, 'utf8');
  const rows = addDerivedFeatures(parseCsv(csvText));
  const headers = Object.keys(rows[0] || {});
  const allFeatures = getFeatureColumns(headers);
  const features = [
    ...preferredFeatureOrder.filter((feature) => allFeatures.includes(feature)),
    ...allFeatures.filter((feature) => !preferredFeatureOrder.includes(feature)),
  ];

  const qualitySummary = buildQualitySummary(rows, features);
  const correlations = buildCorrelations(rows, features);
  const bucketBacktest = buildBucketBacktest(rows, features);
  const bucketSpreads = buildBucketSpreads(bucketBacktest);
  const stability = buildStability(rows, features);
  const timingSnapshot = buildGoldTimingSnapshot(rows);
  const summary = buildMarkdownSummary({ rows, correlations, bucketSpreads, qualitySummary, stability, features });

  await writeCsv(path.join(analysisDir, 'data_quality_summary.csv'), qualitySummary);
  await writeJson(path.join(analysisDir, 'data_quality_summary.json'), qualitySummary);
  await writeCsv(path.join(analysisDir, 'lagged_correlations.csv'), correlations);
  await writeJson(path.join(analysisDir, 'lagged_correlations.json'), correlations);
  await writeCsv(path.join(analysisDir, 'feature_bucket_backtest.csv'), bucketBacktest);
  await writeCsv(path.join(analysisDir, 'feature_bucket_spreads.csv'), bucketSpreads);
  await writeJson(path.join(analysisDir, 'feature_bucket_spreads.json'), bucketSpreads);
  await writeCsv(path.join(analysisDir, 'correlation_stability.csv'), stability);
  await writeJson(path.join(analysisDir, 'correlation_stability.json'), stability);
  await writeJson(path.join(analysisDir, 'gold_timing_snapshot.json'), timingSnapshot);
  await fs.writeFile(path.join(analysisDir, 'analysis_summary.md'), summary);

  console.log(`Analyzed ${rows.length} rows and ${features.length} features.`);
  console.log(`Wrote analysis to ${path.relative(rootDir, analysisDir)}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
