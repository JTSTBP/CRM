import React, { useState, useEffect } from 'react';
import { Download, PieChart as PieChartIcon, TrendingUp, Briefcase, PhoneCall, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import toast from 'react-hot-toast';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import DateRangeFilter from '../../components/common/DateRangeFilter';

interface BDReportData {
    myLeadsByStage: { name: string; value: number }[];
    myLeadsByIndustry: { name: string; value: number }[];
    myMonthlyTimeline: { name: string; calls: number }[];
    myCallOutcomes: { name: string; value: number }[];
    dailyBDPerformance: {
        date: string;
        agentName: string;
        target?: number;
        achieved: number;
        yetAchieved: number;
        onboarded: number;
    }[];
}

const COLORS = ['#0ea5e9', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6'];
const OUTCOME_COLORS = ['#fbbf24', '#f87171', '#34d399', '#60a5fa', '#a78bfa'];

const BDReports: React.FC = () => {
    // Helper to get current month range
    const getCurrentMonthRange = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();

        return {
            startDate: `${year}-${month}-01`,
            endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}`
        };
    };

    const [data, setData] = useState<BDReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<{ startDate: string, endDate: string } | null>(getCurrentMonthRange());

    useEffect(() => {
        fetchReportData();
    }, [dateRange]);

    const fetchReportData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            let url = `${API_BASE_URL}/api/dashboard/bd-reports`;

            if (dateRange) {
                url += `?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
            }

            const res = await fetch(url, {
                headers: { 'x-auth-token': token || '' }
            });
            if (!res.ok) throw new Error('Failed to fetch reports data');
            const json = await res.json();
            setData(json);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="animate-spin text-[#0ea5e9]" size={32} />
            </div>
        );
    }

    if (!data) return <div className="text-center mt-10 text-slate-500 font-medium">Failed to load reports.</div>;

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white/95 backdrop-blur shadow-xl border border-slate-200/60 p-4 rounded-xl">
                    <p className="font-extrabold text-[#0f1c2e] mb-1">{label || payload[0].payload.name}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={index} className="text-sm font-bold flex items-center gap-2" style={{ color: entry.color }}>
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></span>
                            {entry.name}: {entry.value}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="h-full overflow-y-auto pr-1 -mr-1 custom-scrollbar space-y-6 sm:space-y-8 bg-[#f8fafc] pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-500">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0f1c2e] tracking-tight">My Performance Reports</h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">Analyze your lead generation, call activity, and conversion success.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <DateRangeFilter onApply={(range) => setDateRange(range)} initialRange={dateRange} />
                    <button className="flex items-center gap-2 px-4 py-2 bg-[#0f1c2e] text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm">
                        <Download size={16} /> Export Data
                    </button>
                </div>
            </div>

            {/* Top Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* My Calls Timeline (Area Chart) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-extrabold text-[#0f1c2e] flex items-center gap-2">
                            <TrendingUp size={20} className="text-[#0ea5e9]" />
                            My Call Activity {dateRange ? `(${dateRange.startDate} to ${dateRange.endDate})` : '(6 Months)'}
                        </h3>
                    </div>
                    <div className="h-[250px] w-full">
                        {data.myMonthlyTimeline.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data.myMonthlyTimeline} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorMyCalls" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 'bold' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 'bold' }} />
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area type="monotone" dataKey="calls" name="Calls Made" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorMyCalls)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">No recent call data.</div>
                        )}
                    </div>
                </div>

                {/* My Lead Pipeline (Pie Chart) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: '100ms' }}>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-extrabold text-[#0f1c2e] flex items-center gap-2">
                            <PieChartIcon size={20} className="text-emerald-500" />
                            My Assigned Pipeline
                        </h3>
                    </div>
                    <div className="h-[250px] w-full flex items-center justify-center">
                        {data.myLeadsByStage.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data.myLeadsByStage}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                        label={({ cx, cy, midAngle, innerRadius, outerRadius, value, index }: any) => {
                                            const RADIAN = Math.PI / 180;
                                            const radius = 25 + innerRadius + (outerRadius - innerRadius);
                                            const angle = midAngle || 0;
                                            const x = cx + radius * Math.cos(-angle * RADIAN);
                                            const y = cy + radius * Math.sin(-angle * RADIAN);
                                            return (
                                                <text x={x} y={y} fill={COLORS[(index || 0) % COLORS.length]} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11} fontWeight="bold">
                                                    {data.myLeadsByStage[index || 0].name} ({value})
                                                </text>
                                            );
                                        }}
                                    >
                                        {data.myLeadsByStage.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">No leads assigned to you.</div>
                        )}
                    </div>
                </div>

            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Call Outcomes (Donut Chart) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: '200ms' }}>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-extrabold text-[#0f1c2e] flex items-center gap-2">
                            <PhoneCall size={20} className="text-rose-500" />
                            My Call Dispositions
                        </h3>
                    </div>
                    <div className="h-[250px] w-full">
                        {data.myCallOutcomes.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data.myCallOutcomes}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={0}
                                        outerRadius={90}
                                        dataKey="value"
                                        stroke="#fff"
                                        strokeWidth={2}
                                        label={({ cx, cy, midAngle, innerRadius, outerRadius, value, index }: any) => {
                                            const RADIAN = Math.PI / 180;
                                            const radius = 25 + innerRadius + (outerRadius - innerRadius);
                                            const angle = midAngle || 0;
                                            const x = cx + radius * Math.cos(-angle * RADIAN);
                                            const y = cy + radius * Math.sin(-angle * RADIAN);
                                            return (
                                                <text x={x} y={y} fill={OUTCOME_COLORS[(index || 0) % OUTCOME_COLORS.length]} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11} fontWeight="bold">
                                                    {data.myCallOutcomes[index || 0].name} ({value})
                                                </text>
                                            );
                                        }}
                                    >
                                        {data.myCallOutcomes.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={OUTCOME_COLORS[index % OUTCOME_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">No call outcome data recorded.</div>
                        )}
                    </div>
                </div>

                {/* Industry Penetration (Bar Chart) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: '300ms' }}>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-extrabold text-[#0f1c2e] flex items-center gap-2">
                            <Briefcase size={20} className="text-amber-500" />
                            My Top Industries Focus
                        </h3>
                    </div>
                    <div className="h-[250px] w-full">
                        {data.myLeadsByIndustry.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.myLeadsByIndustry} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} width={80} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="value" name="Leads" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20}>
                                        {data.myLeadsByIndustry.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">No industry data assigned to you.</div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default BDReports;
