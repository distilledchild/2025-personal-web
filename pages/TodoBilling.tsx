import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DollarSign, TrendingUp, CreditCard, AlertCircle, Loader2, Bell, Plus } from 'lucide-react';
import { API_URL } from '../utils/apiConfig';
import { AnalogClock, FloatingActionButton, WeatherWidget } from '../components/TodoComponents';

interface BillingData {
    billingAccounts?: BillingAccountCost[];
    totalProjects?: number;
    totalBillingAccounts?: number;
    totalCost: number;
    currency: string;
    period: string;
    source?: {
        tables?: string[];
        dataset?: string;
    };
}

interface BillingProjectCost {
    projectId: string;
    cost: number;
    currency: string;
}

interface BillingAccountCost {
    billingAccountId: string;
    billingAccountName: string;
    totalCost: number;
    currency: string;
    projectCount: number;
    projects: BillingProjectCost[];
}

interface TodoBillingProps {
    isAuthorized: boolean;
}

export const TodoBilling: React.FC<TodoBillingProps> = ({ isAuthorized }) => {
    const [data, setData] = useState<BillingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
    const [locationTimezone, setLocationTimezone] = useState<string>('America/Chicago');
    const [locationLabel, setLocationLabel] = useState<string>('Location');

    const monthOptions = [
        { value: 0, label: 'January' },
        { value: 1, label: 'February' },
        { value: 2, label: 'March' },
        { value: 3, label: 'April' },
        { value: 4, label: 'May' },
        { value: 5, label: 'June' },
        { value: 6, label: 'July' },
        { value: 7, label: 'August' },
        { value: 8, label: 'September' },
        { value: 9, label: 'October' },
        { value: 10, label: 'November' },
        { value: 11, label: 'December' }
    ];

    const yearOptions = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];
    }, []);

    const fetchBillingData = async (targetDate: Date, keepLoading = false) => {
        if (!keepLoading) setLoading(true);
        setError(null);
        try {
            const year = targetDate.getFullYear();
            const month = targetDate.getMonth() + 1;
            const params = new URLSearchParams({
                year: String(year),
                month: String(month)
            });
            const response = await fetch(`${API_URL}/api/billing?${params.toString()}`);
            if (!response.ok) {
                let message = 'Failed to fetch billing data';
                try {
                    const errJson = await response.json();
                    message = errJson?.message || errJson?.error || message;
                } catch {
                    // Keep fallback message if response body isn't JSON.
                }
                throw new Error(message);
            }
            const result = await response.json();
            setData(result);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchLocationTimezone = async () => {
        try {
            const response = await fetch(`${API_URL}/api/contact`);
            if (response.ok) {
                const contactData = await response.json();
                if (contactData?.Location) {
                    const { city, state, country } = contactData.Location;
                    let timezone = 'America/Chicago';
                    let label = 'Location';

                    const locationParts = [city, state, country].filter(Boolean);
                    if (locationParts.length > 0) {
                        label = locationParts[0];
                    }

                    if (country === 'South Korea' || country === 'Korea') {
                        timezone = 'Asia/Seoul';
                    } else if (country === 'United States' || country === 'USA') {
                        const stateTimezones: { [key: string]: string } = {
                            'Illinois': 'America/Chicago',
                            'Texas': 'America/Chicago',
                            'Wisconsin': 'America/Chicago',
                            'California': 'America/Los_Angeles',
                            'New York': 'America/New_York',
                            'Florida': 'America/New_York'
                        };
                        timezone = stateTimezones[state] || 'America/Chicago';
                    } else if (country === 'United Kingdom' || country === 'UK') {
                        timezone = 'Europe/London';
                    } else if (country === 'Japan') {
                        timezone = 'Asia/Tokyo';
                    } else if (country === 'China') {
                        timezone = 'Asia/Shanghai';
                    }

                    setLocationTimezone(timezone);
                    setLocationLabel(label);
                }
            }
        } catch (locationError) {
            console.error('Failed to fetch location timezone:', locationError);
        }
    };

    useEffect(() => {
        fetchLocationTimezone();
    }, []);

    useEffect(() => {
        fetchBillingData(selectedDate, !!data);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDate.getFullYear(), selectedDate.getMonth()]);

    const normalizedAccounts: BillingAccountCost[] = useMemo(() => {
        if (!data) return [];
        if (Array.isArray(data.billingAccounts)) return data.billingAccounts;
        return [];
    }, [data]);

    const totalCostValue = useMemo(() => {
        if (!data) return 0;
        const parsed = Number(data.totalCost);
        if (Number.isFinite(parsed)) return parsed;
        return normalizedAccounts.reduce((sum, item) => sum + item.totalCost, 0);
    }, [data, normalizedAccounts]);

    const totalProjects = useMemo(() => {
        if (data && Number.isFinite(Number(data.totalProjects))) return Number(data.totalProjects);
        return normalizedAccounts.reduce((sum, acc) => sum + (acc.projectCount || acc.projects?.length || 0), 0);
    }, [data, normalizedAccounts]);

    const chartData = normalizedAccounts.map((account, index) => ({
        name: account.billingAccountName,
        cost: account.totalCost,
        fill: index % 2 === 0 ? '#3b82f6' : '#60a5fa'
    }));

    const projectRows = useMemo(() => {
        return normalizedAccounts.flatMap((account) =>
            (account.projects || []).map((project) => ({
                billingAccountId: account.billingAccountId,
                billingAccountName: account.billingAccountName,
                projectId: project.projectId,
                cost: project.cost,
                currency: project.currency || account.currency || 'USD'
            }))
        );
    }, [normalizedAccounts]);

    const moveMonth = (delta: number) => {
        setSelectedDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    };

    const handleMonthSelect = (monthValue: string) => {
        const month = Number(monthValue);
        if (!Number.isFinite(month)) return;
        setSelectedDate((prev) => new Date(prev.getFullYear(), month, 1));
    };

    const handleYearSelect = (yearValue: string) => {
        const year = Number(yearValue);
        if (!Number.isFinite(year)) return;
        setSelectedDate((prev) => new Date(year, prev.getMonth(), 1));
    };

    const renderCalendar = () => {
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = [];

        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="w-8 h-8" />);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const isToday = new Date().toDateString() === date.toDateString();
            const isSelected = selectedDay?.toDateString() === date.toDateString();

            days.push(
                <button
                    key={day}
                    onClick={() => setSelectedDay(date)}
                    className={`w-8 h-8 flex items-center justify-center text-sm rounded-full transition-colors relative
                        ${isToday ? 'bg-blue-500 text-white font-bold' : ''}
                        ${isSelected ? 'ring-2 ring-blue-400' : ''}
                        ${!isToday ? 'hover:bg-slate-100' : ''}`}
                >
                    {day}
                </button>
            );
        }

        return days;
    };

    const renderRightPanel = () => {
        if (loading) {
            return (
                <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                    <Loader2 className="w-10 h-10 animate-spin mb-4" />
                    <p>Loading billing information...</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex flex-col items-center justify-center h-96 text-red-400">
                    <AlertCircle className="w-10 h-10 mb-4" />
                    <p className="text-center">Error: {error}</p>
                    <p className="text-sm text-slate-500 mt-2 text-center">
                        Please ensure Billing Export is enabled and tables are populated.
                    </p>
                </div>
            );
        }

        if (!data) return null;

        return (
            <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">GCP Billing Overview</h2>
                        <p className="text-slate-500">
                            Current usage for <span className="font-semibold text-slate-700">{data.period}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => moveMonth(-1)}
                            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 text-sm"
                            title="Previous month"
                        >
                            ←
                        </button>
                        <select
                            value={selectedDate.getMonth()}
                            onChange={(e) => handleMonthSelect(e.target.value)}
                            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 text-sm"
                            aria-label="Select month"
                        >
                            {monthOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        <select
                            value={selectedDate.getFullYear()}
                            onChange={(e) => handleYearSelect(e.target.value)}
                            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 text-sm"
                            aria-label="Select year"
                        >
                            {yearOptions.map((year) => (
                                <option key={year} value={year}>
                                    {year}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={() => moveMonth(1)}
                            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 text-sm"
                            title="Next month"
                        >
                            →
                        </button>
                        <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-100 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            {data.source?.dataset || 'Billing Export'}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-slate-900 text-white rounded-xl">
                                <DollarSign className="w-6 h-6" />
                            </div>
                            <span className="text-slate-500 font-medium">Total Cost</span>
                        </div>
                        <div className="mt-4">
                            <span className="text-4xl font-bold text-slate-900">${totalCostValue.toFixed(2)}</span>
                            <span className="ml-2 text-slate-400 text-sm">{data.currency}</span>
                        </div>
                    </div>

                    <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                                <TrendingUp className="w-6 h-6" />
                            </div>
                            <span className="text-slate-500 font-medium">Billing Accounts</span>
                        </div>
                        <div className="mt-4">
                            <span className="text-4xl font-bold text-slate-900">{normalizedAccounts.length}</span>
                            <span className="ml-2 text-slate-400 text-sm">accounts</span>
                        </div>
                    </div>

                    <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                <CreditCard className="w-6 h-6" />
                            </div>
                            <span className="text-slate-500 font-medium">Projects</span>
                        </div>
                        <div className="mt-4">
                            <p className="text-4xl font-bold text-slate-900">{totalProjects}</p>
                            <p className="text-xs text-slate-400 mt-1">projects with cost rows</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Cost by Billing Account</h3>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                    dy={10}
                                    angle={-45}
                                    textAnchor="end"
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                    tickFormatter={(value) => `$${value}`}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="cost" radius={[8, 8, 0, 0]} barSize={40}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    {chartData.length === 0 && (
                        <p className="text-sm text-slate-500 mt-4">
                            No billed usage found for this period. Check BigQuery export setup.
                        </p>
                    )}
                </div>

                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-50">
                        <h3 className="text-lg font-bold text-slate-800">Project Cost Details</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Billing Account</th>
                                    <th className="px-6 py-3 font-medium">Project ID</th>
                                    <th className="px-6 py-3 font-medium text-right">Cost</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {projectRows.map((row, index) => (
                                    <tr key={`${row.billingAccountId}-${row.projectId}-${index}`} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-700">
                                            {row.billingAccountName}
                                            <span className="ml-2 text-xs text-slate-400 font-mono">{row.billingAccountId}</span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 font-mono">{row.projectId}</td>
                                        <td className="px-6 py-4 text-right font-bold text-slate-900">${row.cost.toFixed(2)}</td>
                                    </tr>
                                ))}
                                {projectRows.length === 0 && (
                                    <tr>
                                        <td className="px-6 py-4 text-slate-500" colSpan={3}>
                                            No project usage rows returned.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <div className="flex gap-8 min-h-full">
                <div className="w-1/3 flex flex-col gap-6">
                    {isAuthorized && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <button
                                    onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    ←
                                </button>
                                <h3 className="text-lg font-bold text-slate-900">
                                    {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                </h3>
                                <button
                                    onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    →
                                </button>
                            </div>
                            <div className="grid grid-cols-7 gap-2 mb-2">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                    <div key={day} className="text-xs font-bold text-slate-500 text-center">
                                        {day}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-2">
                                {renderCalendar()}
                            </div>
                        </div>
                    )}

                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <div className="grid grid-cols-2 gap-4 justify-items-center">
                            <AnalogClock timezone={locationTimezone} label={locationLabel} />
                            <AnalogClock timezone="Asia/Seoul" label="Seoul" />
                        </div>
                    </div>

                </div>

                <div className="flex-1">
                    {renderRightPanel()}
                </div>
            </div>

            <WeatherWidget />

            {isAuthorized && (
                <>
                    <FloatingActionButton
                        onClick={() => fetchBillingData(selectedDate)}
                        positionClassName="fixed bottom-64 left-6"
                        colorClassName="bg-gray-500 text-white hover:bg-gray-600"
                        title="Refresh billing data"
                        badgeCount={normalizedAccounts.length}
                        className="todo-action-button"
                    >
                        <Bell size={24} />
                    </FloatingActionButton>

                    <FloatingActionButton
                        onClick={() => {
                            const now = new Date();
                            setSelectedDate(new Date(now.getFullYear(), now.getMonth(), 1));
                            setSelectedDay(now);
                        }}
                        positionClassName="fixed bottom-24 left-6"
                        colorClassName="bg-gray-500 text-white hover:bg-gray-600"
                        title="Go to current month"
                        className="todo-action-button"
                    >
                        <Plus size={28} />
                    </FloatingActionButton>
                </>
            )}
        </>
    );
};
