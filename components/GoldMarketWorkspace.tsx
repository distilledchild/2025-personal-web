import React, { useMemo, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ComposedChart,
    Legend,
    Line,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import MarketCommodities from './MarketCommodities';
import laggedCorrelationsRaw from '../data/gold-market/analysis/lagged_correlations.json';
import bucketSpreadsRaw from '../data/gold-market/analysis/feature_bucket_spreads.json';
import stabilityRaw from '../data/gold-market/analysis/correlation_stability.json';
import timingSnapshotRaw from '../data/gold-market/analysis/gold_timing_snapshot.json';
import manifestRaw from '../data/gold-market/metadata/manifest.json';

type WorkspaceTab = 'dashboard' | 'data' | 'analysis' | 'model';

interface CorrelationRow {
    feature: string;
    target: string;
    n: number;
    pearson: number | null;
    spearman: number | null;
    abs_spearman: number | null;
}

interface BucketSpreadRow {
    feature: string;
    high_minus_low_avg_return_3m: number;
    high_minus_low_good_entry_rate_3m: number;
    high_minus_low_bad_entry_rate_3m: number;
    low_bucket_return_3m: number;
    high_bucket_return_3m: number;
    low_bad_entry_rate_3m: number;
    high_bad_entry_rate_3m: number;
}

interface StabilityRow {
    feature: string;
    windows_with_signal: number;
    sign_stability: number;
    avg_abs_spearman: number;
    avg_spearman: number;
    '2004_2010_spearman': number | null;
    '2011_2016_spearman': number | null;
    '2017_2021_spearman': number | null;
    '2022_present_spearman': number | null;
}

interface TimingSignal {
    feature: string;
    label: string;
    category: string;
    detail: string;
    direction: string;
    currentValue: number | null;
    formattedValue: string;
    percentile: number | null;
    signalScore: number;
    weight: number;
    contributionPoints: number;
    returnCorrelation?: number;
    badRiskCorrelation?: number;
    modelStrength?: number;
}

interface TimingHistoryPoint {
    date: string;
    score: number;
    entryScore: number;
    exitRiskScore: number;
    zoneId: 'accumulation' | 'watch' | 'caution' | 'avoid';
    goldFuturesClose: number | null;
    goldPricePerGram: number | null;
    fedFundsRate: number | null;
    predictedScore: number | null;
    forecastError: number | null;
}

interface TimingNextForecast {
    basisDate: string;
    forecastDate: string;
    predictedScore: number;
    model: string;
}

interface TimingFedFunds {
    effectiveRate: number | null;
    dataAsOfDate: string | null;
    nextMeetingStartDate: string | null;
    nextDecisionDate: string | null;
    decisionTime: string | null;
    hasSummaryOfEconomicProjections: boolean;
    rateSourceUrl: string;
    calendarSourceUrl: string;
}

interface TimingSnapshot {
    generatedAt: string;
    asOfDate: string;
    historyStartDate: string | null;
    exitThreshold: number;
    threshold: number;
    score: number;
    entryScore: number;
    exitRiskScore: number;
    zone: {
        id: 'accumulation' | 'watch' | 'caution' | 'avoid';
        label: string;
        action: string;
    };
    signals: TimingSignal[];
    entrySignals: TimingSignal[];
    exitSignals: TimingSignal[];
    history: TimingHistoryPoint[];
    fedFunds: TimingFedFunds;
    nextForecast: TimingNextForecast | null;
    methodology: string[];
}

const laggedCorrelations = laggedCorrelationsRaw as CorrelationRow[];
const bucketSpreads = bucketSpreadsRaw as BucketSpreadRow[];
const stability = stabilityRaw as StabilityRow[];
const timingSnapshot = timingSnapshotRaw as TimingSnapshot;
const manifest = manifestRaw as {
    startDate: string;
    endDate: string;
    yahoo: unknown[];
    fred: unknown[];
    dbnomicsGoldReserves: unknown[];
    processed?: { rows: number; columns: number };
};

const featureLabels: Record<string, string> = {
    dfii10_value: '10Y TIPS Real Yield',
    payems_value_change_3m: 'Payrolls 3M Change',
    payems_value_change_1m: 'Payrolls 1M Change',
    fedfunds_value: 'Fed Funds Level',
    fedfunds_value_change_3m: 'Fed Funds 3M Change',
    fedfunds_value_change_1m: 'Fed Funds 1M Change',
    rrpontsyd_value: 'Reverse Repo Level',
    rrpontsyd_value_change_3m: 'Reverse Repo 3M Change',
    rrpontsyd_value_change_1m: 'Reverse Repo 1M Change',
    t10y2y_value: '10Y-2Y Spread',
    t10yie_value: '10Y Inflation Expectation',
    t10yie_value_change_3m: 'Inflation Expect. 3M Change',
    tnx_return_3m: '10Y Yield 3M Return',
    tnx_return_1m: '10Y Yield 1M Return',
    tnx_close_change_3m: '10Y Yield 3M Change',
    wti_crude_oil_return_3m: 'WTI 3M Return',
    gld_return_3m: 'GLD 3M Return',
    iau_return_3m: 'IAU 3M Return',
    gold_futures_return_3m: 'Gold 3M Momentum',
    gold_drawdown_from_252d_high: 'Gold 52W Drawdown',
    vix_percentile_1y: 'VIX 1Y Percentile',
    sp500_return_3m: 'S&P 500 3M Return',
    central_bank_gold_reserves_top15_tonnes: 'Central Bank Gold Reserves',
};

const formatFeature = (feature: string) => featureLabels[feature] || feature.replaceAll('_', ' ');
const formatPct = (value: number | null | undefined) => value === null || value === undefined ? 'n/a' : `${(value * 100).toFixed(1)}%`;
const formatNum = (value: number | null | undefined) => value === null || value === undefined ? 'n/a' : value.toFixed(3);

const compactFeature = (feature: string) => {
    const label = formatFeature(feature);
    return label.length > 26 ? `${label.slice(0, 24)}...` : label;
};

const formatShortDate = (date: string) => {
    const parsed = new Date(`${date}T00:00:00Z`);
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

const formatLongDate = (date: string | null) => {
    if (!date) return 'Not available';
    const parsed = new Date(`${date}T00:00:00Z`);
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

const formatMonthYear = (date: string | null) => {
    if (!date) return 'not available';
    const parsed = new Date(`${date}T00:00:00Z`);
    return parsed.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
};

const formatChartValue = (value: number, label: string) => {
    if (label === 'Final action score' || label === 'Predicted score' || label === 'Entry strength' || label === 'Exit risk') return `${value.toFixed(1)} / 100`;
    if (label === 'Gold price') return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}/g`;
    if (label === 'Fed funds rate') return `${value.toFixed(2)}%`;
    if (label === 'Forecast error') return `${value > 0 ? '+' : ''}${value.toFixed(1)} pts`;
    return value.toFixed(1);
};

const SectionHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div>
        <h3 className="text-2xl font-black tracking-tight text-slate-950">{title}</h3>
        <p className="mt-1 max-w-none whitespace-nowrap text-sm font-medium leading-relaxed text-slate-500">{subtitle}</p>
    </div>
);

const MetricTile = ({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'orange' | 'green' | 'rose' }) => {
    const toneClass = {
        slate: 'border-slate-200 bg-slate-50 text-slate-900',
        orange: 'border-orange-200 bg-orange-50 text-orange-900',
        green: 'border-emerald-200 bg-emerald-50 text-emerald-900',
        rose: 'border-rose-200 bg-rose-50 text-rose-600',
    }[tone];

    return (
        <div className={`rounded-lg border px-4 py-3 ${toneClass}`}>
            <p className="text-[11px] font-black uppercase tracking-wider opacity-60">{label}</p>
            <p className="mt-1 font-mono text-xl font-black">{value}</p>
        </div>
    );
};

const zoneTone = {
    accumulation: {
        card: 'border-emerald-200 bg-emerald-50 text-emerald-950',
        badge: 'bg-emerald-600 text-white',
        fill: '#16a34a',
    },
    watch: {
        card: 'border-orange-200 bg-orange-50 text-orange-950',
        badge: 'bg-orange-500 text-white',
        fill: '#f97316',
    },
    caution: {
        card: 'border-amber-200 bg-amber-50 text-amber-950',
        badge: 'bg-amber-500 text-white',
        fill: '#f59e0b',
    },
    avoid: {
        card: 'border-rose-200 bg-rose-50 text-rose-950',
        badge: 'bg-rose-600 text-white',
        fill: '#e11d48',
    },
};

const getSignalTone = (score: number) => {
    if (score >= 60) {
        return {
            label: 'Supportive',
            border: 'border-emerald-200',
            soft: 'bg-emerald-50 text-emerald-800',
            badge: 'bg-emerald-100 text-emerald-700',
            bar: '#16a34a',
        };
    }

    if (score >= 40) {
        return {
            label: 'Mixed',
            border: 'border-amber-200',
            soft: 'bg-amber-50 text-amber-800',
            badge: 'bg-amber-100 text-amber-700',
            bar: '#FFA300',
        };
    }

    return {
        label: 'Dragging',
        border: 'border-rose-200',
        soft: 'bg-rose-50 text-rose-800',
        badge: 'bg-rose-100 text-rose-700',
        bar: '#ef4444',
    };
};

const getExitSignalTone = (score: number) => {
    if (score >= 60) {
        return {
            label: 'Risky',
            border: 'border-rose-200',
            soft: 'bg-rose-50 text-rose-800',
            badge: 'bg-rose-100 text-rose-700',
            bar: '#ef4444',
        };
    }

    if (score >= 40) {
        return {
            label: 'Elevated',
            border: 'border-amber-200',
            soft: 'bg-amber-50 text-amber-800',
            badge: 'bg-amber-100 text-amber-700',
            bar: '#FFA300',
        };
    }

    return {
        label: 'Calm',
        border: 'border-emerald-200',
        soft: 'bg-emerald-50 text-emerald-800',
        badge: 'bg-emerald-100 text-emerald-700',
        bar: '#16a34a',
    };
};

const DashboardTab = () => {
    const tone = zoneTone[timingSnapshot.zone.id];
    const [activeSignalModel, setActiveSignalModel] = useState<'entry' | 'exit'>('entry');
    const [showEntryScore, setShowEntryScore] = useState(false);
    const [showExitRisk, setShowExitRisk] = useState(false);
    const entrySignals = timingSnapshot.entrySignals ?? timingSnapshot.signals;
    const exitSignals = timingSnapshot.exitSignals ?? [];
    const activeSignals = activeSignalModel === 'entry' ? entrySignals : exitSignals;
    const entryContributionData = entrySignals.map(signal => ({
        name: signal.label,
        category: signal.category,
        contribution: signal.contributionPoints,
        score: signal.signalScore,
    }));
    const exitContributionData = exitSignals.map(signal => ({
        name: signal.label,
        category: signal.category,
        contribution: signal.contributionPoints,
        score: signal.signalScore,
    }));
    const topBoost = [...entryContributionData].sort((a, b) => b.contribution - a.contribution)[0];
    const topExitRisk = [...exitContributionData].sort((a, b) => b.contribution - a.contribution)[0];
    const netContribution = timingSnapshot.score - 50;
    const scoreHistoryData = timingSnapshot.history.map(point => ({
        ...point,
        label: formatShortDate(point.date),
    }));
    return (
        <div className="space-y-8">
            <SectionHeader
                title="Gold Timing Dashboard"
                subtitle="Two separate 0-100 models feed one final action score: 70+ Buy / Accumulate, 50-69 Hold / Watch, below 50 Exit / Avoid."
            />

            <div className="grid grid-cols-1 gap-6">
                <div className={`rounded-2xl border p-6 shadow-sm ${tone.card}`}>
                    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.18em] opacity-70">Current score as of {timingSnapshot.asOfDate}</p>
                            <div className="mt-3 flex items-end gap-3">
                                <span className="font-mono text-6xl font-black leading-none">{timingSnapshot.score.toFixed(1)}</span>
                                <span className="pb-2 text-xl font-black opacity-60">/ 100</span>
                            </div>
                            <p className="mt-4 max-w-none whitespace-nowrap text-base font-semibold leading-relaxed">{timingSnapshot.zone.action}</p>
                            <div className="mt-5 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
                                <MetricTile label="Final action" value={timingSnapshot.score.toFixed(1)} tone="orange" />
                                <MetricTile label="Entry strength" value={timingSnapshot.entryScore.toFixed(1)} tone="green" />
                                <MetricTile label="Exit risk" value={timingSnapshot.exitRiskScore.toFixed(1)} tone="rose" />
                            </div>
                        </div>
                        <span className={`w-fit whitespace-nowrap rounded-full px-4 py-2 text-xs font-black uppercase tracking-wider ${tone.badge}`}>
                            {timingSnapshot.zone.label}
                        </span>
                    </div>

                    <div className="mt-8">
                        <div
                            className="relative h-5 rounded-full shadow-inner"
                            style={{ background: 'linear-gradient(90deg, #FFCC80 0%, #FFB84D 50%, #f97316 70%, #f97316 100%)' }}
                        >
                            <div
                                className="absolute -top-2 h-9 w-1 rounded-full bg-orange-950"
                                style={{ left: `${Math.min(100, Math.max(0, timingSnapshot.score))}%` }}
                            />
                            <div
                                className="absolute -top-7 -translate-x-1/2 text-center text-[11px] font-black uppercase tracking-wider text-slate-950"
                                style={{ left: `${Math.min(100, Math.max(0, timingSnapshot.score))}%` }}
                            >
                                Current
                            </div>
                            <div
                                className="absolute -top-2 h-9 w-1 rounded-full bg-rose-600"
                                style={{ left: `${timingSnapshot.exitThreshold}%` }}
                            />
                            <div
                                className="absolute top-8 -translate-x-1/2 text-center text-[11px] font-black uppercase tracking-wider text-rose-700"
                                style={{ left: `${timingSnapshot.exitThreshold}%` }}
                            >
                                Exit
                                <br />
                                &lt;{timingSnapshot.exitThreshold}
                            </div>
                            <div
                                className="absolute -top-2 h-9 w-1 rounded-full bg-emerald-600"
                                style={{ left: `${timingSnapshot.threshold}%` }}
                            />
                            <div
                                className="absolute top-8 -translate-x-1/2 text-center text-[11px] font-black uppercase tracking-wider text-emerald-700"
                                style={{ left: `${timingSnapshot.threshold}%` }}
                            >
                                Accumulate
                                <br />
                                {timingSnapshot.threshold}+
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 border-t border-orange-200/70 pt-5">
                        <h4 className="text-sm font-black uppercase tracking-[0.18em] text-slate-800">How to read it</h4>
                        <div className="mt-3 grid gap-3 text-sm font-semibold leading-relaxed text-slate-700">
                            <p><strong style={{ color: '#f97316' }}>70+</strong> means buy / accumulate: the macro and trend setup is strong enough to consider a new or larger position.</p>
                            <p><strong style={{ color: '#FFA300' }}>50-69</strong> means hold / watch: the setup is not a clean new entry, but it is still acceptable for monitoring or holding.</p>
                            <p><strong className="text-rose-600">Below 50</strong> means exit / avoid: entry strength is weak and/or exit risk is high enough to reduce the final action score.</p>
                        </div>
                        <p className="mt-4 rounded-lg bg-white/60 p-3 text-xs font-semibold leading-relaxed text-slate-600">
                            Disclaimer: This page is for personal research only and does not provide financial advice. I am not responsible for any investment decisions, losses, or outcomes based on this model.
                        </p>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                        <h4 className="text-lg font-black text-slate-950">Score trend with gold price</h4>
                        <p className="mt-1 max-w-3xl text-sm font-medium text-slate-500">
                            Default view shows only gold price and the final action score. Toggle model internals when you want to inspect the two sub-models.
                        </p>
                    </div>
                    <div className="grid w-full grid-cols-2 gap-2 sm:w-[270px] sm:shrink-0">
                        <button
                            type="button"
                            onClick={() => setShowEntryScore(value => !value)}
                            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-center text-xs font-black transition ${
                                showEntryScore
                                    ? 'border-emerald-300 bg-emerald-500 text-white'
                                    : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:text-emerald-700'
                            }`}
                        >
                            Entry strength
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowExitRisk(value => !value)}
                            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-center text-xs font-black transition ${
                                showExitRisk
                                    ? 'border-rose-300 bg-rose-500 text-white'
                                    : 'border-slate-200 bg-white text-slate-500 hover:border-rose-200 hover:text-rose-700'
                            }`}
                        >
                            Exit risk
                        </button>
                    </div>
                </div>
                <div className="relative mt-5 h-[320px]">
                    <span className="pointer-events-none absolute left-6 top-1 z-10 text-[11px] font-black uppercase tracking-wider text-orange-500">
                        Score
                    </span>
                    <span className="pointer-events-none absolute right-6 top-1 z-10 text-[11px] font-black uppercase tracking-wider text-amber-400">
                        Gold $/g
                    </span>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={scoreHistoryData} margin={{ top: 30, right: 18, left: 18, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                                dataKey="date"
                                minTickGap={24}
                                tickFormatter={formatShortDate}
                                tick={{ fontSize: 11, fill: '#64748b' }}
                            />
                            <YAxis
                                yAxisId="score"
                                domain={[0, 100]}
                                ticks={[0, 25, 50, 70, 100]}
                                tick={{ fontSize: 11, fill: '#f97316', fontWeight: 700 }}
                                tickMargin={6}
                                width={46}
                                axisLine={{ stroke: '#f97316' }}
                                tickLine={{ stroke: '#f97316' }}
                            />
                            <YAxis
                                yAxisId="gold"
                                orientation="right"
                                domain={['dataMin - 5', 'dataMax + 5']}
                                tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                                tick={{ fontSize: 11, fill: '#fbbf24' }}
                                tickMargin={6}
                                width={46}
                                axisLine={{ stroke: '#fbbf24' }}
                                tickLine={{ stroke: '#fbbf24' }}
                            />
                            <Tooltip
                                formatter={(value: number, name: string) => [formatChartValue(value, name), name]}
                                labelFormatter={(label, payload) => {
                                    const point = payload?.[0]?.payload;
                                    if (!point) return `${label}`;
                                    const parts = [`${point.date}`];
                                    if (point.goldPricePerGram !== null) parts.push(`Gold $${point.goldPricePerGram.toFixed(2)}/g`);
                                    return parts.join(' | ');
                                }}
                            />
                            <ReferenceLine
                                yAxisId="score"
                                y={timingSnapshot.threshold}
                                stroke="#16a34a"
                                strokeDasharray="4 4"
                                label={{ value: 'Buy threshold', position: 'insideTopRight', fill: '#16a34a', fontSize: 11, fontWeight: 800 }}
                            />
                            <ReferenceLine
                                yAxisId="score"
                                y={timingSnapshot.exitThreshold}
                                stroke="#e11d48"
                                strokeDasharray="4 4"
                                label={{ value: 'Exit threshold', position: 'insideBottomRight', fill: '#e11d48', fontSize: 11, fontWeight: 800 }}
                            />
                            <Line
                                yAxisId="gold"
                                type="monotone"
                                dataKey="goldPricePerGram"
                                name="Gold price"
                                stroke="#fbbf24"
                                strokeWidth={1.5}
                                dot={false}
                            />
                            {showEntryScore && (
                                <Line
                                    yAxisId="score"
                                    type="monotone"
                                    dataKey="entryScore"
                                    name="Entry strength"
                                    stroke="#16a34a"
                                    strokeWidth={1}
                                    dot={false}
                                />
                            )}
                            {showExitRisk && (
                                <Line
                                    yAxisId="score"
                                    type="monotone"
                                    dataKey="exitRiskScore"
                                    name="Exit risk"
                                    stroke="#e11d48"
                                    strokeWidth={1}
                                    dot={false}
                                />
                            )}
                            <Line
                                yAxisId="score"
                                type="monotone"
                                dataKey="score"
                                name="Final action score"
                                stroke="#f97316"
                                strokeWidth={1.75}
                                dot={false}
                                activeDot={{ r: 5, fill: '#f97316', stroke: '#fff', strokeWidth: 2 }}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-4 border-t border-slate-100 pt-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p className="whitespace-nowrap text-sm font-black text-slate-900">Fed funds rate</p>
                            <p className="mt-1 text-sm font-semibold text-teal-700">
                                Current effective rate {timingSnapshot.fedFunds.effectiveRate === null
                                    ? 'not available'
                                    : `${timingSnapshot.fedFunds.effectiveRate.toFixed(2)}%`}
                                <span className="font-medium text-slate-500"> · Latest observation {formatMonthYear(timingSnapshot.fedFunds.dataAsOfDate)}</span>
                            </p>
                            <a
                                href={timingSnapshot.fedFunds.rateSourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-block text-xs font-bold text-slate-400 underline decoration-slate-300 underline-offset-2 hover:text-teal-700"
                            >
                                Source: FRED FEDFUNDS
                            </a>
                        </div>
                        <div className="text-left sm:text-right">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Next FOMC decision</p>
                            <p className="mt-1 text-sm font-black text-slate-900">
                                {formatLongDate(timingSnapshot.fedFunds.nextDecisionDate)}
                                {timingSnapshot.fedFunds.decisionTime ? ` · ${timingSnapshot.fedFunds.decisionTime}` : ''}
                            </p>
                            <a
                                href={timingSnapshot.fedFunds.calendarSourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-block text-xs font-bold text-slate-400 underline decoration-slate-300 underline-offset-2 hover:text-teal-700"
                            >
                                Source: Federal Reserve calendar
                            </a>
                        </div>
                    </div>
                    <div className="mt-2 h-[120px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={scoreHistoryData} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="date" minTickGap={24} tickFormatter={formatShortDate} tick={{ fontSize: 10, fill: '#64748b' }} />
                                <YAxis
                                    orientation="right"
                                    domain={['dataMin - 0.1', 'dataMax + 0.1']}
                                    tickFormatter={(value) => `${Number(value).toFixed(1)}%`}
                                    tick={{ fontSize: 10, fill: '#0f766e' }}
                                    tickMargin={6}
                                    width={46}
                                    axisLine={{ stroke: '#0f766e' }}
                                    tickLine={{ stroke: '#0f766e' }}
                                />
                                <Tooltip
                                    formatter={(value: number, name: string) => [formatChartValue(value, name), name]}
                                    labelFormatter={(label, payload) => {
                                        const point = payload?.[0]?.payload;
                                        return point ? `${point.date}` : `${label}`;
                                    }}
                                />
                                <Line
                                    type="stepAfter"
                                    dataKey="fedFundsRate"
                                    name="Fed funds rate"
                                    stroke="#0f766e"
                                    strokeWidth={1.5}
                                    dot={false}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h4 className="text-lg font-black text-slate-950">What pushed the final score?</h4>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                        Entry factors push the action score up; exit-risk factors pull it down after being inverted into the final decision layer.
                    </p>
                    <div className="mt-5 grid gap-3">
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Top boost</p>
                            <div className="mt-2 flex items-center justify-between gap-3">
                                <span className="text-sm font-black text-slate-950">{topBoost.name}</span>
                                <span className="font-mono text-sm font-black text-emerald-700">+{topBoost.contribution.toFixed(1)} pts</span>
                            </div>
                        </div>
                        <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-rose-700">Top exit risk</p>
                            <div className="mt-2 flex items-center justify-between gap-3">
                                <span className="text-sm font-black text-slate-950">{topExitRisk.name}</span>
                                <span className="font-mono text-sm font-black text-rose-700">Risk {topExitRisk.score.toFixed(1)}</span>
                            </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Net effect</p>
                            <div className="mt-2 flex items-center justify-between gap-3">
                                <span className="text-sm font-black text-slate-950">Final score vs neutral 50</span>
                                <span className={`font-mono text-sm font-black ${netContribution >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {netContribution >= 0 ? '+' : ''}{netContribution.toFixed(1)} pts
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h4 className="text-lg font-black text-slate-950">Method</h4>
                    <p className="mt-1 text-sm font-medium text-slate-500">The page uses two transparent models, then resolves them into one buy / hold / exit action score.</p>
                    <ol className="mt-5 space-y-3">
                        {timingSnapshot.methodology.map((step, index) => (
                            <li key={step} className="flex gap-3 rounded-lg bg-slate-50 p-3 text-sm font-semibold leading-relaxed text-slate-600">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black text-white" style={{ backgroundColor: '#FFA300' }}>{index + 1}</span>
                                <span>{step}</span>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>

            <div>
                <div className="mb-4 flex flex-wrap gap-2">
                    {[
                        { id: 'entry' as const, label: 'Entry factors', score: timingSnapshot.entryScore },
                        { id: 'exit' as const, label: 'Exit-risk factors', score: timingSnapshot.exitRiskScore },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveSignalModel(tab.id)}
                            className={`rounded-full border px-4 py-2 text-sm font-black transition ${
                                activeSignalModel === tab.id
                                    ? 'border-orange-300 bg-orange-500 text-white shadow-sm'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:text-orange-600'
                            }`}
                        >
                            {tab.label}
                            <span className="ml-2 font-mono opacity-80">{tab.score.toFixed(1)}</span>
                        </button>
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {activeSignals.map(signal => {
                        const signalTone = activeSignalModel === 'entry'
                            ? getSignalTone(signal.signalScore)
                            : getExitSignalTone(signal.signalScore);
                        const scoreLabel = activeSignalModel === 'entry' ? 'Signal' : 'Risk';
                        const nowLabel = activeSignalModel === 'entry' ? 'Now' : 'Risk now';
                        const explainer = activeSignalModel === 'entry'
                            ? 'Signal shows the current condition; impact is the calibrated entry-model weight.'
                            : 'Risk shows the current exit pressure; impact is this factor’s exit-risk model weight.';

                        return (
                            <div key={signal.feature} className={`rounded-2xl border bg-white p-5 shadow-sm ${signalTone.border}`}>
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{signal.category}</p>
                                    <h4 className="mt-1 text-lg font-black text-slate-950">{signal.label}</h4>
                                </div>
                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    <div className={`rounded-xl px-3 py-2 text-center ${signalTone.badge}`}>
                                        <p className="text-[10px] font-black uppercase tracking-wider opacity-70">{scoreLabel}</p>
                                        <p className="mt-1 font-mono text-sm font-black">{signal.signalScore.toFixed(1)}/100</p>
                                    </div>
                                    <div className="rounded-xl bg-slate-100 px-3 py-2 text-center text-slate-600">
                                        <p className="text-[10px] font-black uppercase tracking-wider opacity-70">Impact</p>
                                        <p className="mt-1 font-mono text-sm font-black">{(signal.weight * 100).toFixed(1)}/100</p>
                                    </div>
                                </div>
                                <p className="mt-3 text-xs font-semibold leading-relaxed text-slate-500">{explainer}</p>
                                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <div className="flex min-h-[84px] flex-col items-center justify-center rounded-lg bg-slate-50 p-3 text-center">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Current</p>
                                        <p className="mt-1 font-mono text-sm font-black text-slate-900">{signal.formattedValue}</p>
                                    </div>
                                    <div className="flex min-h-[84px] flex-col items-center justify-center rounded-lg bg-slate-50 p-3 text-center">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Rule</p>
                                        <p className="mt-1 text-sm font-black text-slate-900">{signal.direction}</p>
                                    </div>
                                    <div className={`flex min-h-[84px] flex-col items-center justify-center rounded-lg p-3 text-center ${signalTone.soft}`}>
                                        <p className="text-[10px] font-black uppercase tracking-wider opacity-70">{nowLabel}</p>
                                        <p className="mt-1 text-sm font-black">{signalTone.label}</p>
                                    </div>
                                </div>
                                <div className="mt-4 h-2 rounded-full bg-slate-100">
                                    <div
                                        className="h-2 rounded-full"
                                        style={{ width: `${Math.min(100, Math.max(0, signal.signalScore))}%`, backgroundColor: signalTone.bar }}
                                    />
                                </div>
                                <p className="mt-4 text-sm font-medium leading-relaxed text-slate-500">{signal.detail}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const AnalysisTab = () => {
    const returnCorrelations = useMemo(() => (
        laggedCorrelations
            .filter(row => row.target === 'target_gold_return_next_3m')
            .slice(0, 10)
            .map(row => ({
                feature: compactFeature(row.feature),
                fullFeature: formatFeature(row.feature),
                spearman: row.spearman ?? 0,
                pearson: row.pearson ?? 0,
            }))
    ), []);

    const riskCorrelations = useMemo(() => (
        laggedCorrelations
            .filter(row => row.target === 'target_bad_entry_3m')
            .slice(0, 10)
            .map(row => ({
                feature: compactFeature(row.feature),
                fullFeature: formatFeature(row.feature),
                spearman: row.spearman ?? 0,
            }))
    ), []);

    const bucketData = useMemo(() => (
        bucketSpreads.slice(0, 10).map(row => ({
            feature: compactFeature(row.feature),
            fullFeature: formatFeature(row.feature),
            spread: row.high_minus_low_avg_return_3m,
            badRiskSpread: row.high_minus_low_bad_entry_rate_3m,
        }))
    ), []);

    const stabilityData = useMemo(() => (
        stability.slice(0, 8).map(row => ({
            feature: compactFeature(row.feature),
            fullFeature: formatFeature(row.feature),
            '2004-10': row['2004_2010_spearman'] ?? 0,
            '2011-16': row['2011_2016_spearman'] ?? 0,
            '2017-21': row['2017_2021_spearman'] ?? 0,
            '2022+': row['2022_present_spearman'] ?? 0,
        }))
    ), []);

    return (
        <div className="space-y-8">
            <SectionHeader
                title="Gold Signal Analysis"
                subtitle="This view checks how market and macro features known today relate to future 1-month returns, future 3-month returns, and 3-month drawdown risk for gold."
            />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <MetricTile label="Rows" value={manifest.processed?.rows?.toLocaleString() || '5,600'} tone="orange" />
                <MetricTile label="Features Tested" value="64" />
                <MetricTile label="Correlation Rows" value="320" />
                <MetricTile label="Date Range" value={`${manifest.startDate.slice(0, 4)}-${manifest.endDate.slice(0, 4)}`} tone="green" />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="mb-1 text-lg font-black text-slate-900">Next 3M Return Correlation</h4>
                    <p className="mb-5 text-sm text-slate-500">Spearman correlation with future 63-trading-day gold return.</p>
                    <div className="h-[360px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={returnCorrelations} layout="vertical" margin={{ top: 0, right: 24, left: 78, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                <XAxis type="number" domain={[-0.45, 0.45]} tick={{ fontSize: 11, fill: '#64748b' }} />
                                <YAxis type="category" dataKey="feature" tick={{ fontSize: 11, fill: '#334155' }} width={92} />
                                <Tooltip formatter={(value: number) => [value.toFixed(3), 'Spearman']} labelFormatter={(_, payload) => payload?.[0]?.payload?.fullFeature || ''} />
                                <Bar dataKey="spearman" radius={[0, 6, 6, 0]}>
                                    {returnCorrelations.map((entry) => (
                                        <Cell key={entry.feature} fill={entry.spearman >= 0 ? '#16a34a' : '#f97316'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="mb-1 text-lg font-black text-slate-900">Bucket Spread</h4>
                    <p className="mb-5 text-sm text-slate-500">Difference between highest and lowest feature buckets for next 3M gold return.</p>
                    <div className="h-[360px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={bucketData} layout="vertical" margin={{ top: 0, right: 24, left: 78, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                <XAxis type="number" tickFormatter={(value) => `${(Number(value) * 100).toFixed(0)}%`} tick={{ fontSize: 11, fill: '#64748b' }} />
                                <YAxis type="category" dataKey="feature" tick={{ fontSize: 11, fill: '#334155' }} width={92} />
                                <Tooltip formatter={(value: number) => [formatPct(value), 'High - Low']} labelFormatter={(_, payload) => payload?.[0]?.payload?.fullFeature || ''} />
                                <Bar dataKey="spread" radius={[0, 6, 6, 0]}>
                                    {bucketData.map((entry) => (
                                        <Cell key={entry.feature} fill={entry.spread >= 0 ? '#16a34a' : '#f97316'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="mb-1 text-lg font-black text-slate-900">Bad Entry Risk Correlation</h4>
                    <p className="mb-5 text-sm text-slate-500">Association with a -7% or worse drawdown within the next 3 months.</p>
                    <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={riskCorrelations} layout="vertical" margin={{ top: 0, right: 24, left: 78, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                <XAxis type="number" domain={[-0.25, 0.25]} tick={{ fontSize: 11, fill: '#64748b' }} />
                                <YAxis type="category" dataKey="feature" tick={{ fontSize: 11, fill: '#334155' }} width={92} />
                                <Tooltip formatter={(value: number) => [value.toFixed(3), 'Spearman']} labelFormatter={(_, payload) => payload?.[0]?.payload?.fullFeature || ''} />
                                <Bar dataKey="spearman" radius={[0, 6, 6, 0]}>
                                    {riskCorrelations.map((entry) => (
                                        <Cell key={entry.feature} fill={entry.spearman >= 0 ? '#ef4444' : '#16a34a'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="mb-1 text-lg font-black text-slate-900">Regime Stability</h4>
                    <p className="mb-5 text-sm text-slate-500">Signals that keep the same direction across historical regimes are safer model inputs.</p>
                    <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={stabilityData} margin={{ top: 12, right: 10, left: 0, bottom: 35 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="feature" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 10, fill: '#64748b' }} height={80} />
                                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                                <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.fullFeature || ''} />
                                <Legend />
                                <Line type="monotone" dataKey="2004-10" stroke="#334155" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="2011-16" stroke="#16a34a" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="2017-21" stroke="#f97316" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="2022+" stroke="#0f766e" strokeWidth={2} dot={false} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="rounded-lg border border-orange-200 bg-orange-50 p-5">
                <h4 className="mb-3 text-lg font-black text-orange-950">Readable Findings</h4>
                <div className="grid gap-3 text-sm font-semibold leading-relaxed text-orange-900 md:grid-cols-2">
                    <p>Payroll growth slowing over 3 months had one of the strongest relationships with better next-3-month gold returns.</p>
                    <p>Rising 10-year yield pressure and rising inflation expectation levels generally weakened the forward gold setup.</p>
                    <p>Gold, GLD, and IAU momentum still mattered, but the macro regime signals were stronger than simple price momentum.</p>
                    <p>Level variables like TIPS yield are useful, but should be treated carefully because regime effects can inflate correlation.</p>
                </div>
            </div>
        </div>
    );
};

const ModelTab = () => {
    const selectedFeatures = useMemo(() => (
        stability
            .filter(row => row.windows_with_signal >= 4 && row.sign_stability >= 1 && row.avg_abs_spearman >= 0.1)
            .slice(0, 10)
    ), []);

    const totalWeight = selectedFeatures.reduce((sum, row) => sum + row.avg_abs_spearman, 0);
    const weights = selectedFeatures.map(row => ({
        feature: compactFeature(row.feature),
        fullFeature: formatFeature(row.feature),
        direction: row.avg_spearman >= 0 ? 'Higher = bullish' : 'Lower = bullish',
        weight: totalWeight ? row.avg_abs_spearman / totalWeight : 0,
        score: row.avg_spearman,
    }));

    const modelSteps = [
        { step: 'Stable feature selection', status: 'Ready', detail: 'Use sign-stable features from regime tests.' },
        { step: 'Gold Timing Score', status: 'Next', detail: 'Normalize selected features and combine with direction-aware weights.' },
        { step: 'Score bucket backtest', status: 'Next', detail: 'Compare low/mid/high score buckets against forward 3M returns.' },
        { step: 'ML classifiers', status: 'Next', detail: 'Train good_entry_3m and bad_entry_3m classifiers with time-series splits.' },
        { step: 'Contribution chart', status: 'Next', detail: 'Show which signals push the current score up or down.' },
    ];

    return (
        <div className="space-y-8">
            <SectionHeader
                title="Gold Timing Model"
                subtitle="A workspace for selecting stable features from the analysis, building a rule-based timing score, and extending it into ML probability models."
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                {modelSteps.map((item, index) => (
                    <div key={item.step} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                            <span className="font-mono text-xs font-black text-slate-400">{String(index + 1).padStart(2, '0')}</span>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${item.status === 'Ready' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                                {item.status}
                            </span>
                        </div>
                        <h4 className="text-sm font-black text-slate-900">{item.step}</h4>
                        <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">{item.detail}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="mb-1 text-lg font-black text-slate-900">Draft Rule Weights</h4>
                    <p className="mb-5 text-sm text-slate-500">Weights are normalized from stable average absolute Spearman strength.</p>
                    <div className="h-[380px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weights} layout="vertical" margin={{ top: 0, right: 24, left: 88, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                <XAxis type="number" tickFormatter={(value) => `${(Number(value) * 100).toFixed(0)}%`} />
                                <YAxis type="category" dataKey="feature" width={104} tick={{ fontSize: 11, fill: '#334155' }} />
                                <Tooltip formatter={(value: number) => [formatPct(value), 'Weight']} labelFormatter={(_, payload) => payload?.[0]?.payload?.fullFeature || ''} />
                                <Bar dataKey="weight" fill="#16a34a" radius={[0, 6, 6, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="mb-1 text-lg font-black text-slate-900">Model Inputs</h4>
                    <p className="mb-5 text-sm text-slate-500">The first model should be readable before it becomes clever.</p>
                    <div className="space-y-3">
                        {weights.map(row => (
                            <div key={row.fullFeature} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                                <div>
                                    <p className="text-sm font-black text-slate-900">{row.fullFeature}</p>
                                    <p className="text-xs font-semibold text-slate-500">{row.direction}</p>
                                </div>
                                <span className="font-mono text-sm font-black text-emerald-700">{formatPct(row.weight)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
                    <h4 className="text-sm font-black uppercase tracking-wider text-emerald-800">Score Output</h4>
                    <p className="mt-2 text-2xl font-black text-emerald-950">0-100</p>
                    <p className="mt-2 text-sm font-semibold text-emerald-800">Accumulation, Neutral, Caution, or Avoid zone.</p>
                </div>
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-5">
                    <h4 className="text-sm font-black uppercase tracking-wider text-orange-800">Good Entry Target</h4>
                    <p className="mt-2 text-2xl font-black text-orange-950">3M +5%</p>
                    <p className="mt-2 text-sm font-semibold text-orange-800">Probability that gold rises at least 5% over 63 trading days.</p>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-5">
                    <h4 className="text-sm font-black uppercase tracking-wider text-rose-800">Bad Entry Target</h4>
                    <p className="mt-2 text-2xl font-black text-rose-950">3M -7%</p>
                    <p className="mt-2 text-sm font-semibold text-rose-800">Probability of a 7% or worse drawdown within 63 trading days.</p>
                </div>
            </div>
        </div>
    );
};

const GoldMarketWorkspace: React.FC = () => {
    const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>('dashboard');

    const tabs: { id: WorkspaceTab; label: string }[] = [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'data', label: 'Data' },
        { id: 'analysis', label: 'Research Details' },
        { id: 'model', label: 'Model Notes' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveWorkspaceTab(tab.id)}
                        className={`rounded-lg px-4 py-2 text-sm font-black transition-colors ${
                            activeWorkspaceTab === tab.id
                                ? 'bg-orange-500 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-500 hover:bg-orange-50 hover:text-orange-700'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeWorkspaceTab === 'dashboard' && <DashboardTab />}
            {activeWorkspaceTab === 'data' && <MarketCommodities />}
            {activeWorkspaceTab === 'analysis' && <AnalysisTab />}
            {activeWorkspaceTab === 'model' && <ModelTab />}
        </div>
    );
};

export default GoldMarketWorkspace;
