import React, { useEffect, useRef, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Line, YAxis, XAxis, Tooltip } from 'recharts';
import { API_URL } from '../utils/apiConfig';
import { getOrFetchCached } from '../utils/clientCache';

interface MarketData {
    name: string;
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    currency: string;
    history?: { date: string, close: number }[];
    fetchedAt?: string;
    error?: string;
}

interface FOMCEvent {
    date: string;
    status: 'past' | 'next';
    rate: number | null;
}

interface FOMCData {
    events: FOMCEvent[];
    rateHistory: { date: string; rate: number }[];
}

interface MacroData {
    id: string;
    name: string;
    unit: string;
    currentValue: number | null;
    currentDate: string | null;
    change: number;
    changePercent: number;
    history?: { date: string, value: number }[];
    details?: {
        bullish: number;
        neutral: number;
        bearish: number;
    };
    fetchedAt?: string;
    error?: string;
}

const MARKET_CACHE_TTL_MS = 2 * 60 * 1000;
const MACRO_CACHE_TTL_MS = 30 * 60 * 1000;
const FOMC_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const GOLD_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const GOLD_CHART_HEIGHT = 500;
const GOLD_CHART_MARGIN = { top: 10, right: 10, bottom: 20, left: 10 };

const ChartMountGuard: React.FC<{ className: string; children: React.ReactNode }> = ({ className, children }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateReadyState = () => {
            const { width, height } = container.getBoundingClientRect();
            if (width <= 0 || height <= 0) {
                setDimensions(null);
                return;
            }

            const nextDimensions = {
                width: Math.round(width),
                height: Math.round(height),
            };

            setDimensions(current => (
                current?.width === nextDimensions.width && current?.height === nextDimensions.height
                    ? current
                    : nextDimensions
            ));
        };

        updateReadyState();

        const observer = new ResizeObserver(updateReadyState);
        observer.observe(container);

        return () => {
            observer.disconnect();
        };
    }, []);

    const guardedChildren = React.isValidElement(children) && dimensions && 'width' in children.props && 'height' in children.props
        ? React.cloneElement(children as React.ReactElement<{ width: number; height: number }>, dimensions)
        : children;

    return (
        <div ref={containerRef} className={className}>
            {dimensions ? guardedChildren : null}
        </div>
    );
};

const getClosestGoldCountry = (payload: any[], cursorY: number | undefined, maxValue: number) => {
    if (!payload?.length || typeof cursorY !== 'number' || !maxValue) return null;

    const plotHeight = GOLD_CHART_HEIGHT - GOLD_CHART_MARGIN.top - GOLD_CHART_MARGIN.bottom;
    const cursorRatio = Math.min(1, Math.max(0, (cursorY - GOLD_CHART_MARGIN.top) / plotHeight));
    const cursorValue = maxValue - cursorRatio * maxValue;

    return payload
        .filter((entry: any) => typeof entry.value === 'number')
        .reduce((closest: any | null, entry: any) => {
            const distance = Math.abs(entry.value - cursorValue);
            return !closest || distance < closest.distance
                ? { country: entry.dataKey, distance }
                : closest;
        }, null)?.country || null;
};

const GoldReserveTooltip = ({ active, label, payload, coordinate, activeCountry, maxValue }: any) => {
    if (!active || !payload?.length) return null;

    const targetCountry = activeCountry || getClosestGoldCountry(payload, coordinate?.y, maxValue);
    if (!targetCountry) return null;

    const countryPayload = payload.find((entry: any) => entry.dataKey === targetCountry);
    if (!countryPayload || typeof countryPayload.value !== 'number') return null;

    return (
        <div className="rounded-xl border border-slate-100 bg-white/95 px-4 py-3 text-[11px] shadow-xl shadow-slate-200/70 backdrop-blur">
            <p className="mb-2 font-bold text-slate-900">
                {new Date(label).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
            </p>
            <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: countryPayload.color }} />
                <span className="font-bold" style={{ color: countryPayload.color }}>
                    {targetCountry}
                </span>
                <span className="font-mono text-slate-700">
                    {countryPayload.value.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                    })}t
                </span>
            </div>
        </div>
    );
};

const MarketCommodities: React.FC = () => {
    const [marketData, setMarketData] = useState<MarketData[]>([]);
    const [loadingMarket, setLoadingMarket] = useState(false);
    const [marketFetchError, setMarketFetchError] = useState<string | null>(null);

    const [macroData, setMacroData] = useState<MacroData[]>([]);
    const [loadingMacro, setLoadingMacro] = useState(false);
    const [macroFetchError, setMacroFetchError] = useState<string | null>(null);

    const [fomcData, setFomcData] = useState<FOMCData>({ events: [], rateHistory: [] });
    const [goldReserves, setGoldReserves] = useState<{ data: any[], countryConfig: any[] }>({ data: [], countryConfig: [] });
    const [loadingGold, setLoadingGold] = useState(false);
    const [goldFetchError, setGoldFetchError] = useState<string | null>(null);
    const [activeGoldCountry, setActiveGoldCountry] = useState<string | null>(null);

    useEffect(() => {
        setLoadingMarket(true);
        getOrFetchCached(
            `${API_URL}:finance:market-data`,
            MARKET_CACHE_TTL_MS,
            async () => {
                const res = await fetch(`${API_URL}/api/finance/market-data`);
                const text = await res.text();
                try {
                    const data = JSON.parse(text);
                    if (!res.ok) {
                        throw new Error(`Server returned ${res.status}: ${JSON.stringify(data)}`);
                    }
                    return data as MarketData[];
                } catch (error) {
                    if (error instanceof Error && error.message.startsWith('Server returned')) {
                        throw error;
                    }
                    throw new Error(`Parse error: ${text.slice(0, 50)}`);
                }
            }
        )
            .then(data => {
                setMarketFetchError(null);
                setMarketData(data);
            })
            .catch(err => setMarketFetchError(err.message))
            .finally(() => setLoadingMarket(false));
            
        setLoadingMacro(true);
        getOrFetchCached(
            `${API_URL}:finance:macro-data`,
            MACRO_CACHE_TTL_MS,
            async () => {
                const res = await fetch(`${API_URL}/api/finance/macro-data`);
                const text = await res.text();
                try {
                    const data = JSON.parse(text);
                    if (!res.ok) {
                        throw new Error(`Server returned ${res.status}: ${JSON.stringify(data)}`);
                    }
                    return data as MacroData[];
                } catch (error) {
                    if (error instanceof Error && error.message.startsWith('Server returned')) {
                        throw error;
                    }
                    throw new Error(`Parse error: ${text.slice(0, 50)}`);
                }
            }
        )
            .then(data => {
                setMacroFetchError(null);
                setMacroData(data);
            })
            .catch(err => setMacroFetchError(err.message))
            .finally(() => setLoadingMacro(false));

        getOrFetchCached(
            `${API_URL}:finance:fomc-schedule`,
            FOMC_CACHE_TTL_MS,
            async () => {
                const res = await fetch(`${API_URL}/api/finance/fomc-schedule`);
                if (!res.ok) {
                    throw new Error(`Server returned ${res.status}`);
                }
                return res.json() as Promise<FOMCData>;
            }
        )
            .then(data => setFomcData(data))
            .catch(err => console.error('FOMC fetch error:', err));

        setLoadingGold(true);
        setGoldFetchError(null);
        getOrFetchCached(
            `${API_URL}:finance:gold-reserves`,
            GOLD_CACHE_TTL_MS,
            async () => {
                const res = await fetch(`${API_URL}/api/finance/gold-reserves`);
                if (!res.ok) {
                    throw new Error(`Server returned ${res.status}`);
                }
                return res.json() as Promise<{ data: any[]; countryConfig: any[] }>;
            }
        )
            .then(data => {
                if (data && data.data && data.data.length > 0) {
                    setGoldReserves(data);
                } else {
                    throw new Error("No data returned from DBnomics");
                }
            })
            .catch(err => {
                console.error('Gold reserves fetch error:', err);
                setGoldFetchError(err.message);
            })
            .finally(() => setLoadingGold(false));
    }, []);

    const gold = marketData.find(item => item.symbol === 'GC=F');
    const silver = marketData.find(item => item.symbol === 'SI=F');
    const copper = marketData.find(item => item.symbol === 'HG=F');
    
    // Check if lengths are zero but loading is done. This points to CORS/Connection error state.
    const isFetchError = (!loadingMarket && marketData.length === 0);
    
    const gsRatio = gold && silver && typeof silver.price === 'number' && silver.price > 0 ? (gold.price / silver.price).toFixed(2) : null;
    const cgRatio = copper && gold && typeof gold.price === 'number' && gold.price > 0 ? (copper.price / gold.price).toFixed(4) : null;
    const goldCountryNames = goldReserves.countryConfig.map(n => n.name);
    const goldReserveMaxValue = goldReserves.data.length > 0
        ? Math.ceil(
            Math.max(
                ...goldReserves.data.flatMap(point => goldCountryNames.map(country => Number(point[country]) || 0))
            ) / 2500
        ) * 2500
        : 0;

    const updateActiveGoldCountryFromCursor = (state: any) => {
        if (!state?.activePayload?.length || !goldReserveMaxValue) return;

        const chartY = typeof state.chartY === 'number'
            ? state.chartY
            : state.activeCoordinate?.y;

        if (typeof chartY !== 'number') return;

        const closestCountry = getClosestGoldCountry(
            state.activePayload.filter((entry: any) => goldCountryNames.includes(entry.dataKey)),
            chartY,
            goldReserveMaxValue
        );

        if (closestCountry) {
            setActiveGoldCountry(current => current === closestCountry ? current : closestCountry);
        }
    };

    return (
        <>
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">Market & Commodities</h3>
                    <p className="text-slate-500 text-lg">Real-time indicators & recent trends</p>
                </div>
                {loadingMarket && (
                    <div className="text-orange-500 font-medium flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                        Updating...
                    </div>
                )}
            </div>

            {/* FOMC Rate History Chart */}
            {fomcData.rateHistory.length > 0 && (
                <div className="mt-4 mb-6 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-2 h-2 bg-slate-300 rounded-full"></span>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">FOMC Rate Decisions</span>
                            </div>
                            <p className="text-slate-500 text-xs">Federal Funds Rate — 12-month trend by meeting date</p>
                        </div>
                        {fomcData.events.find(e => e.status === 'next') && (
                            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-full">
                                <span className="text-orange-500 text-xs font-bold uppercase">Next 🚀</span>
                                <span className="font-mono text-sm font-black text-orange-700">
                                    {new Date(fomcData.events.find(e => e.status === 'next')!.date)
                                        .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                            </div>
                        )}
                    </div>
                    <ChartMountGuard className="h-[160px] w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={fomcData.events.filter(e => e.status === 'past' && e.rate !== null)}
                                margin={{ top: 20, right: 20, bottom: 5, left: 10 }}
                            >
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={(d) => {
                                        const dt = new Date(d);
                                        return dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                                    }}
                                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    domain={['dataMin - 0.3', 'dataMax + 0.3']}
                                    tick={{ fontSize: 9, fill: '#94a3b8' }}
                                    width={30}
                                    tickFormatter={(v) => `${v.toFixed(1)}%`}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    formatter={(v: number) => [`${v.toFixed(2)}%`, 'Fed Funds Rate']}
                                    labelFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                                />
                                <Line
                                    type="stepAfter"
                                    dataKey="rate"
                                    stroke="#FFA300"
                                    strokeWidth={2.5}
                                    dot={{ r: 5, fill: '#FFA300', stroke: '#fff', strokeWidth: 2 }}
                                    isAnimationActive={false}
                                    label={({ x, y, value }) => (
                                        <text x={x} y={y - 10} textAnchor="middle" fill="#64748b" fontSize={10} fontWeight="bold">
                                            {`${(value as number).toFixed(2)}%`}
                                        </text>
                                    )}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </ChartMountGuard>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {marketData.length === 0 && !loadingMarket && (
                    <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-8 bg-slate-50 rounded-xl border border-dashed border-red-300">
                        <p className="text-red-500 font-medium">No market data available: {marketFetchError || 'Unknown error'}</p>
                    </div>
                )}
                {marketData.map((item, idx) => (
                    <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 pb-3 hover:shadow-md transition-shadow relative">
                        {item.error ? (
                            <div className="flex flex-col h-full justify-center text-center py-4">
                                <h4 className="font-bold text-slate-800 text-lg">{item.name}</h4>
                                <p className="text-red-500 text-sm mt-2">{item.error}</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-start mb-2 relative z-10">
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-lg">{item.name}</h4>
                                        <p className="text-slate-400 text-xs font-mono">{item.symbol}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-0.5">
                                        <div className="px-3 py-1.5 rounded-lg text-[13px] font-bold text-white shadow-md bg-gradient-to-br from-[#FFA300] via-[#FF7700] to-[#FF5500]">
                                            {item.change >= 0 ? '+' : ''}{item.changePercent?.toFixed(2)}%
                                        </div>
                                        {item.fetchedAt && (
                                            <span className="text-[9px] text-slate-400 font-mono">{item.fetchedAt}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="relative z-10">
                                    <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                                        {item.price?.toLocaleString()}
                                    </span>
                                    <span className="text-sm font-bold text-slate-400 ml-1">
                                        {item.currency}
                                    </span>
                                </div>
                                <ChartMountGuard className="mt-2 h-[100px] w-full min-w-0">
                                    {item.history && item.history.length > 0 && (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={item.history} margin={{ top: 5, right: 25, bottom: 10, left: 12 }}>
                                                <XAxis 
                                                    dataKey="date"
                                                    interval={0}
                                                    tick={({ x, y, payload, index }) => {
                                                        if (!payload || !payload.value) return null;
                                                        const isLastIndex = index === (item.history?.length || 0) - 1;
                                                        // Parse directly to avoid UTC timezone offset shifting dates by 1 day
                                                        const parts = payload.value.split('-');
                                                        if (parts.length < 3) return null;
                                                        const year = parts[0];
                                                        const month = parts[1];
                                                        const day = parts[2];
                                                        return (
                                                            <text
                                                                x={x}
                                                                y={y}
                                                                dy={14}
                                                                textAnchor="middle"
                                                                fill={isLastIndex ? '#111111' : '#94a3b8'}
                                                                fontWeight={isLastIndex ? '900' : '400'}
                                                                fontSize={isLastIndex ? 11 : 10}
                                                            >
                                                                {`${parseInt(month)}/${parseInt(day)}`}
                                                            </text>
                                                        );
                                                    }}
                                                    tickLine={false}
                                                    axisLine={false}
                                                />
                                                <Tooltip 
                                                    labelFormatter={(label) => {
                                                        const [year, month, day] = label.split('-');
                                                        return `${parseInt(month)}/${parseInt(day)}/${year}`;
                                                    }}
                                                    formatter={(value: number, name: string, props: any) => {
                                                        const isToday = props.payload.date === item.history?.[item.history.length - 1]?.date;
                                                        return [`${value.toFixed(2)}`, isToday ? (item.fetchedAt || 'Live') : 'Close'];
                                                    }}
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                                                />
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="close" 
                                                    stroke="#FFA300" 
                                                    strokeWidth={2} 
                                                    dot={false} 
                                                    isAnimationActive={false}
                                                />
                                                <YAxis 
                                                    domain={['dataMin', 'dataMax']} 
                                                    hide={false}
                                                    stroke="#e2e8f0"
                                                    axisLine={true}
                                                    tickLine={true}
                                                    tick={{ fontSize: 9, fill: '#94a3b8', dx: -2 }}
                                                    width={25}
                                                    tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val.toFixed(1)}
                                                />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    )}
                                </ChartMountGuard>
                            </>
                        )}
                    </div>
                ))}
            </div>

            {/* Metal Ratios Block */}
            <div className="mt-8">
                <h4 className="text-xl font-bold text-slate-800 mb-4">Macro Indicators: Metal Ratios</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <div className="flex justify-between items-start">
                            <div>
                                <h5 className="font-bold text-slate-800 text-lg mb-1">Gold / Silver Ratio</h5>
                                <p className="text-sm text-slate-500 mb-4">Exchange Ratio (Risk-Aversion Indicator)</p>
                            </div>
                            <div className="p-2 bg-yellow-100 rounded-lg">
                                <span className="text-yellow-700 font-bold">Safe-Haven</span>
                            </div>
                        </div>
                        <div className="text-3xl font-black text-slate-900 font-mono mb-3">
                            {isFetchError ? 'Data Unavailable' : (gsRatio || 'Loading...')}
                        </div>
                        <div className="text-sm bg-orange-100 text-orange-800 px-3 py-2 rounded-lg font-medium inline-block">
                            💡 &gt; 80 indicates strong risk-off sentiment
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <div className="flex justify-between items-start">
                            <div>
                                <h5 className="font-bold text-slate-800 text-lg mb-1">Copper / Gold Ratio</h5>
                                <p className="text-sm text-slate-500 mb-4">Exchange Ratio (Economic Expansion Indicator)</p>
                            </div>
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <span className="text-blue-700 font-bold">Expansion</span>
                            </div>
                        </div>
                        <div className="text-3xl font-black text-slate-900 font-mono mb-3">
                            {isFetchError ? 'Data Unavailable' : (cgRatio || 'Loading...')}
                        </div>
                        <div className="text-sm bg-blue-100 text-blue-800 px-3 py-2 rounded-lg font-medium inline-block">
                            💡 Uptrend signals economic expansion &amp; rising industrial demand
                        </div>
                    </div>
                </div>
            </div>

            {/* FRED Macro Indicators Section */}
            <div className="mt-12 mb-8">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h4 className="text-xl font-bold text-slate-800">Macro Indicators (FRED)</h4>
                        <p className="text-slate-500 text-sm mt-1">Key economic data driving inflation & rate trends</p>
                    </div>
                    {loadingMacro && (
                        <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {macroData.length === 0 && !loadingMacro && (
                        <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-8 bg-slate-50 rounded-xl border border-dashed border-red-300">
                            <p className="text-red-500 font-medium">No macro data available: {macroFetchError || 'Unknown error'}</p>
                        </div>
                    )}
                    {macroData.map((item, idx) => {
                        const now = new Date();
                        const currentYearStr = now.getFullYear().toString();
                        const currentMonthStr = (now.getMonth() + 1).toString().padStart(2, '0');
                        
                        let sixMonthsAgo = new Date();
                        sixMonthsAgo.setMonth(now.getMonth() - 5);
                        sixMonthsAgo.setDate(1);
                        const boundaryDateStr = `${sixMonthsAgo.getFullYear()}-${(sixMonthsAgo.getMonth() + 1).toString().padStart(2, '0')}-01`;
                        
                        let chartData = item.history || [];
                        if (item.id !== 'GDPC1') {
                            chartData = chartData.filter(h => h.date >= boundaryDateStr);
                        } else {
                            const gdpBoundary = `${now.getFullYear() - 1}-01-01`;
                            chartData = chartData.filter(h => h.date >= gdpBoundary);
                        }
                        
                        if (chartData.length > 0 && item.id !== 'GDPC1') {
                            const lastPoint = chartData[chartData.length - 1];
                            const [ly, lm] = lastPoint.date.split('-');
                            if (ly !== currentYearStr || lm !== currentMonthStr) {
                                chartData.push({ date: `${currentYearStr}-${currentMonthStr}-01`, value: null as any });
                            }
                        }

                        const isSentimentCard = item.id === 'SENTIMENT_AI';
                        
                        return (
                            <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 pb-3 hover:shadow-md transition-shadow relative">
                                {item.error ? (
                                    <div className="flex flex-col h-full justify-center text-center py-4">
                                        <h4 className="font-bold text-slate-800 text-lg">{item.name}</h4>
                                        <p className="text-red-500 text-sm mt-2">{item.error}</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex justify-between items-start mb-2 relative z-10">
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-lg">{item.name}</h4>
                                                <p className="text-slate-400 text-xs font-mono">{item.id}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-0.5">
                                                <div className="px-3 py-1.5 rounded-lg text-[13px] font-bold text-white shadow-md bg-gradient-to-br from-[#FFA300] via-[#FF7700] to-[#FF5500]">
                                                    {isSentimentCard ? (item.change > 0 ? 'Bullish' : 'Bearish') : (item.changePercent > 0 ? '+' : '') + (item.changePercent?.toFixed(2) + '%')}
                                                </div>
                                                {item.fetchedAt && (
                                                    <span className="text-[9px] text-slate-400 font-mono">{item.fetchedAt}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="relative z-10">
                                            <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                                                {item.currentValue !== null ? item.currentValue.toLocaleString() : '--'}
                                            </span>
                                            <span className="text-sm font-bold text-slate-400 ml-1">
                                                {item.unit}
                                            </span>
                                        </div>
                                        
                                        <ChartMountGuard className="mt-2 h-[100px] min-h-[100px] w-full min-w-0 flex flex-col justify-center overflow-hidden">
                                            {isSentimentCard && item.details ? (
                                                <div className="space-y-3">
                                                    <div className="flex h-4 w-full rounded-full overflow-hidden bg-slate-100">
                                                        <div style={{ width: `${item.details.bullish}%` }} className="bg-emerald-500 h-full" />
                                                        <div style={{ width: `${item.details.neutral}%` }} className="bg-slate-300 h-full" />
                                                        <div style={{ width: `${item.details.bearish}%` }} className="bg-rose-500 h-full" />
                                                    </div>
                                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                                                        <div className="flex flex-col items-start">
                                                            <span className="text-emerald-600">Bullish</span>
                                                            <span className="text-slate-900">{item.details.bullish}%</span>
                                                        </div>
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-slate-400">Neutral</span>
                                                            <span className="text-slate-900">{item.details.neutral}%</span>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-rose-600">Bearish</span>
                                                            <span className="text-slate-900">{item.details.bearish}%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                chartData && chartData.length > 0 ? (
                                                    <ResponsiveContainer width="100%" height="100%" debounce={100}>
                                                        <ComposedChart data={chartData} margin={{ top: 5, right: 35, bottom: 10, left: -10 }}>
                                                            <XAxis 
                                                                dataKey="date"
                                                                interval={0}
                                                                tick={({ x, y, payload, index }) => {
                                                                    if (!payload || !payload.value) return <g />;
                                                                    const parts = payload.value.split('-');
                                                                    if (parts.length < 2) return <g />;
                                                                    const isLastIndex = index === chartData.length - 1;
                                                                    const minDistance = Math.max(1, Math.floor(chartData.length / 5));
                                                                    if (!isLastIndex && index % minDistance !== 0) return <g />;
                                                                    const year = parts[0];
                                                                    const month = parts[1];
                                                                    let displayString = `${year.slice(2)}/${month}`;
                                                                    if (item.id === 'GDPC1') {
                                                                        const quarter = Math.floor((parseInt(month) - 1) / 3) + 1;
                                                                        displayString = `${year.slice(2)}/${quarter}Q`;
                                                                    }
                                                                    return (
                                                                        <text x={x} y={y} dy={14} textAnchor="middle" fill={isLastIndex ? '#111111' : '#94a3b8'} fontWeight={isLastIndex ? '900' : '400'} fontSize={isLastIndex ? 11 : 10}>
                                                                            {displayString}
                                                                        </text>
                                                                    );
                                                                }}
                                                                tickLine={false}
                                                                axisLine={false}
                                                            />
                                                            <Tooltip 
                                                                labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                                formatter={(value: number) => [`${value.toFixed(2)} ${item.unit}`, 'Value']}
                                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                                                            />
                                                            <Line type="monotone" dataKey="value" stroke="#FFA300" strokeWidth={2} dot={false} isAnimationActive={false} />
                                                            <YAxis 
                                                                domain={['dataMin', 'dataMax']} 
                                                                hide={false}
                                                                stroke="#e2e8f0"
                                                                axisLine={true}
                                                                tickLine={true}
                                                                tick={{ fontSize: 9, fill: '#94a3b8', dx: -2 }}
                                                                width={25}
                                                            />
                                                        </ComposedChart>
                                                    </ResponsiveContainer>
                                                ) : (
                                                    <div className="flex items-center justify-center h-full">
                                                        <p className="text-[10px] text-slate-400 italic">No historical trend data</p>
                                                    </div>
                                                )
                                            )}
                                        </ChartMountGuard>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Gold Reserves Multi-Line Chart Section */}
            <div className="mt-12 mb-20 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h4 className="text-xl font-bold text-slate-800">Top 15 Central Bank Gold Reserves</h4>
                        <p className="text-slate-500 text-sm mt-1">Monthly accumulation trends of world's top holders (Metric Tonnes)</p>
                    </div>
                    {goldReserves.data.length > 0 && (
                        <div className="flex flex-wrap gap-x-4 gap-y-2 max-w-[60%] justify-end">
                            {goldReserves.countryConfig.map(n => (
                                <div key={n.name} className="flex items-center gap-1.5 shrink-0">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: n.color }}></span>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{n.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                <ChartMountGuard className="h-[500px] min-h-[500px] w-full min-w-0 flex items-center justify-center overflow-hidden">
                    {loadingGold ? (
                        <div className="text-center">
                            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-slate-400 font-medium italic">Fetching Top 15 National Reserves from DBnomics...</p>
                        </div>
                    ) : goldFetchError ? (
                        <div className="text-center p-8 bg-rose-50 rounded-xl border border-rose-100">
                            <p className="text-rose-500 font-medium italic text-rose-600">Failed to load gold reserves: {goldFetchError}</p>
                            <button 
                                onClick={() => window.location.reload()}
                                className="mt-4 px-6 py-2 bg-rose-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-rose-100 hover:bg-rose-600 transition-all active:scale-95"
                            >
                                Retry Fetching Data
                            </button>
                        </div>
                    ) : goldReserves.data.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%" debounce={100}>
                            <ComposedChart
                                data={goldReserves.data}
                                margin={GOLD_CHART_MARGIN}
                                onMouseMove={updateActiveGoldCountryFromCursor}
                                onMouseLeave={() => setActiveGoldCountry(null)}
                            >
                                <XAxis 
                                    dataKey="date" 
                                    tickFormatter={(str) => {
                                        const date = new Date(str);
                                        return `${date.getFullYear()}/${(date.getMonth() + 1)}`;
                                    }}
                                    interval={Math.floor(goldReserves.data.length / 10)}
                                    stroke="#94a3b8"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis 
                                    stroke="#94a3b8" 
                                    fontSize={10} 
                                    tickLine={false} 
                                    axisLine={false}
                                    domain={[0, goldReserveMaxValue]}
                                    width={45}
                                    tickFormatter={(val) => `${val.toLocaleString()}t`}
                                />
                                <Tooltip content={<GoldReserveTooltip activeCountry={activeGoldCountry} maxValue={goldReserveMaxValue} />} />
                                {goldReserves.countryConfig.map(n => (
                                    <Line 
                                        key={n.name}
                                        type="monotone" 
                                        dataKey={n.name} 
                                        stroke={n.color} 
                                        strokeOpacity={activeGoldCountry && activeGoldCountry !== n.name ? 0.25 : 1}
                                        strokeWidth={activeGoldCountry === n.name || n.name === 'USA' ? 4 : 2} 
                                        dot={false} 
                                        activeDot={{ r: 5, strokeWidth: 2, onMouseEnter: () => setActiveGoldCountry(n.name) }}
                                        isAnimationActive={false}
                                        onMouseEnter={() => setActiveGoldCountry(n.name)}
                                        onMouseMove={() => setActiveGoldCountry(n.name)}
                                    />
                                ))}
                            </ComposedChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-slate-400 italic">No historical data available yet</p>
                    )}
                </ChartMountGuard>
            </div>
        </>
    );
};

export default MarketCommodities;
