import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config';
import toast from 'react-hot-toast';
import { Loader2, PieChart as PieChartIcon, Award, Briefcase, Download, PhoneCall, Users } from 'lucide-react';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';

import DateRangeFilter from '../../components/common/DateRangeFilter';
import AgentCallsModal from '../../components/modals/AgentCallsModal';

interface ReportData {
    leadsByStage: { name: string; value: number }[];
    leadsByIndustry: { name: string; value: number }[];
    monthlyTimeline: { name: string; calls: number }[];
    callOutcomes?: { name: string; value: number }[];
    agentPerformance: { agentId: string; name: string; calls: number; leads: number; won: number; onboarded: number; winRate: number }[];
    summaryStats?: {
        totalLeads: number;
        totalUsers: number;
        totalProposalSent: number;
        totalOnboarded: number;
    };
    dailyBDPerformance?: {
        date: string;
        agentName: string;
        target: number;
        achieved: number;
        yetAchieved: number;
        onboarded: number;
    }[];
}

interface UserOption {
    _id: string;
    name: string;
    role: string;
    status: string;
}

const COLORS = ['#0ea5e9', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6'];

const Reports: React.FC = () => {
    // Helper to get current month range (Local Time)
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
    const getTodayRange = () => {
      const today = new Date();
      const date = today.toISOString().split('T')[0];
      return { startDate: date, endDate: date };
    };
    const getWeekRange = () => {
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
      const monday = new Date(now.setDate(diff));
      const start = monday.toISOString().split('T')[0];
      const end = new Date().toISOString().split('T')[0];
      return { startDate: start, endDate: end };
    };

    const [data, setData] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<{ startDate: string, endDate: string } | null>(getCurrentMonthRange());
    const [selectedAgent, setSelectedAgent] = useState<{ id: string, name: string } | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // BD Executive Filtration states
    const [executives, setExecutives] = useState<UserOption[]>([]);
    const [selectedBDExecutive, setSelectedBDExecutive] = useState<string>('');

    useEffect(() => {
        fetchExecutives();
    }, []);

    useEffect(() => {
        fetchReportData();
    }, [dateRange, selectedBDExecutive]);

    const fetchExecutives = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/auth/users/list`, {
                headers: { 'x-auth-token': token || '' }
            });
            if (!res.ok) throw new Error('Failed to fetch user list');
            const json = await res.json();
            // Filter to include only active BD Executives and Managers
            const filtered = json.filter((u: UserOption) => 
                (u.role === 'BD Executive' || u.role === 'Manager') && u.status === 'Active'
            );
            setExecutives(filtered);
        } catch (err: any) {
            console.error('Error fetching executives:', err.message);
        }
    };

    const fetchReportData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            let url = `${API_BASE_URL}/api/dashboard/admin-reports`;

            const params = new URLSearchParams();
            if (dateRange) {
                params.append('startDate', dateRange.startDate);
                params.append('endDate', dateRange.endDate);
            }
            if (selectedBDExecutive) {
                params.append('agentId', selectedBDExecutive);
            }

            const queryString = params.toString();
            if (queryString) {
                url += `?${queryString}`;
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
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0f1c2e] tracking-tight">Analytics & Reports</h1>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <p className="text-xs sm:text-sm text-slate-500">Deep dive into CRM performance, agent metrics, and lead conversions.</p>
                        {selectedBDExecutive && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[0.65rem] font-bold bg-sky-50 text-[#0ea5e9] border border-sky-200 animate-in fade-in duration-200">
                                <Users size={10} />
                                {executives.find(e => e._id === selectedBDExecutive)?.name || 'Selected Executive'}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    <div className="relative flex items-center">
                        <Users className="absolute left-3 text-slate-400 pointer-events-none" size={16} />
                        <select
                            value={selectedBDExecutive}
                            onChange={(e) => setSelectedBDExecutive(e.target.value)}
                            className={`bg-white border text-slate-700 hover:bg-slate-50 pl-9 pr-8 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-sm focus:outline-none focus:ring-4 focus:ring-sky-500/5 focus:border-[#0ea5e9] transition-all appearance-none cursor-pointer min-w-[180px] ${selectedBDExecutive ? 'border-sky-300 bg-sky-50 text-[#0ea5e9]' : 'border-slate-200'}`}
                        >
                            <option value="">All Executives</option>
                            {executives.map((exec) => (
                                <option key={exec._id} value={exec._id}>
                                    {exec.name}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                    <DateRangeFilter onApply={(range) => setDateRange(range)} initialRange={dateRange} />
                    <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#0ea5e9] to-[#0284c7] text-white rounded-xl text-xs sm:text-sm font-bold hover:shadow-lg hover:shadow-sky-500/20 transition-all">
                        <Download size={16} /> Export CSV
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            {data.summaryStats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start mb-3">
                            <div className="bg-emerald-50 p-2 rounded-xl group-hover:bg-emerald-100 transition-colors">
                                <Briefcase className="text-emerald-500" size={20} />
                            </div>
                        </div>
                        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Total Leads Uploaded</p>
                        <h3 className="text-2xl font-bold text-[#0f1c2e] mt-1">{data.summaryStats.totalLeads.toLocaleString()}</h3>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start mb-3">
                            <div className="bg-blue-50 p-2 rounded-xl group-hover:bg-blue-100 transition-colors">
                                <Briefcase className="text-blue-500" size={20} />
                            </div>
                        </div>
                        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Active Users</p>
                        <h3 className="text-2xl font-bold text-[#0f1c2e] mt-1">{data.summaryStats.totalUsers.toLocaleString()}</h3>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start mb-3">
                            <div className="bg-orange-50 p-2 rounded-xl group-hover:bg-orange-100 transition-colors">
                                <Briefcase className="text-orange-500" size={20} />
                            </div>
                        </div>
                        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Proposals Sent</p>
                        <h3 className="text-2xl font-bold text-[#0f1c2e] mt-1">{data.summaryStats.totalProposalSent.toLocaleString()}</h3>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start mb-3">
                            <div className="bg-purple-50 p-2 rounded-xl group-hover:bg-purple-100 transition-colors">
                                <Award className="text-purple-500" size={20} />
                            </div>
                        </div>
                        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Total Onboarded</p>
                        <h3 className="text-2xl font-bold text-[#0f1c2e] mt-1">{data.summaryStats.totalOnboarded.toLocaleString()}</h3>
                    </div>
                </div>
            )}

        {/* Daily BD Performance Table */}
        {data.dailyBDPerformance && data.dailyBDPerformance.length > 0 && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 mt-6">
            <h3 className="font-extrabold text-[#0f1c2e] mb-4 flex items-center gap-2">
              <Award className="text-purple-500" size={20} />
              Daily BD Performance
            </h3>
            <div className="flex space-x-2 mb-2">
              <button className="px-3 py-1 text-sm bg-sky-50 text-[#0ea5e9] border border-sky-200 rounded-md hover:bg-sky-100" onClick={() => setDateRange(getTodayRange())}>Today</button>
              <button className="px-3 py-1 text-sm bg-sky-50 text-[#0ea5e9] border border-sky-200 rounded-md hover:bg-sky-100" onClick={() => setDateRange(getWeekRange())}>This Week</button>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-widest text-slate-400 font-extrabold">
                    <th className="py-4 px-6">Date</th>
                    <th className="py-4 px-6">BD Executive</th>
                    <th className="py-4 px-6 text-center">Target</th>
                    <th className="py-4 px-6 text-center">Achieved</th>
                    <th className="py-4 px-6 text-center">Yet Achieved</th>
                    <th className="py-4 px-6 text-center">Onboarded</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-medium text-slate-700 divide-y divide-slate-100">
                  {data.dailyBDPerformance.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-6">{row.date}</td>
                      <td className="py-4 px-6">{row.agentName}</td>
                      <td className="py-4 px-6 text-center">{row.target ?? 5}</td>
                      <td className="py-4 px-6 text-center">{row.achieved}</td>
                      <td className="py-4 px-6 text-center">{row.yetAchieved}</td>
                      <td className="py-4 px-6 text-center">{row.onboarded}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}


            {/* Top Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Leads By Stage Pie Chart */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-extrabold text-[#0f1c2e] flex items-center gap-2">
                            <PieChartIcon size={20} className="text-[#0ea5e9]" />
                            Lead Pipeline Distribution
                        </h3>
                    </div>
                    <div className="h-[250px] w-full">
                        {data.leadsByStage.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data.leadsByStage}
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
                                            const x = cx + radius * Math.cos(-(midAngle || 0) * RADIAN);
                                            const y = cy + radius * Math.sin(-(midAngle || 0) * RADIAN);
                                            return (
                                                <text x={x} y={y} fill={COLORS[(index || 0) % COLORS.length]} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11} fontWeight="bold">
                                                    {data.leadsByStage[index || 0].name} ({value})
                                                </text>
                                            );
                                        }}
                                    >
                                        {data.leadsByStage.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">No lead data available</div>
                        )}
                    </div>
                </div>

                {/* Call Outcomes Distribution Chart */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: '100ms' }}>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-extrabold text-[#0f1c2e] flex items-center gap-2">
                            <PhoneCall size={20} className="text-emerald-500" />
                            Call Outcomes Distribution
                        </h3>
                    </div>
                    <div className="h-[250px] w-full">
                        {data.callOutcomes && data.callOutcomes.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.callOutcomes} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 'bold' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 'bold' }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="value" name="Total Calls" radius={[8, 8, 0, 0]}>
                                        {data.callOutcomes.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">No call outcome data available</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Industry Breakdown (Modern Matrix) */}
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 lg:col-span-1 flex flex-col animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: '200ms' }}>
                    <div className="p-6 border-b border-slate-100 bg-slate-50/30">
                        <h3 className="font-extrabold text-[#0f1c2e] flex items-center gap-2">
                            <Briefcase size={20} className="text-amber-500" />
                            Industry Distribution
                        </h3>
                    </div>
                    <div className="p-6 flex-1 overflow-y-auto custom-scrollbar max-h-[400px]">
                        {data.leadsByIndustry.length > 0 ? (
                            <div className="space-y-5">
                                {data.leadsByIndustry.map((industry, index) => {
                                    const totalLeads = data.leadsByIndustry.reduce((acc, curr) => acc + curr.value, 0);
                                    const percentage = totalLeads > 0 ? Math.round((industry.value / totalLeads) * 100) : 0;

                                    return (
                                        <div key={index} className="group">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[(index + 4) % COLORS.length] }}></span>
                                                    <span className="text-sm font-bold text-slate-700 truncate max-w-[140px] group-hover:text-[#0ea5e9] transition-colors">
                                                        {industry.name}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black text-[#0f1c2e]">{industry.value}</span>
                                                    <span className="text-[10px] font-bold text-slate-400">({percentage}%)</span>
                                                </div>
                                            </div>
                                            <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100 flex-shrink-0">
                                                <div
                                                    className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm"
                                                    style={{
                                                        width: `${percentage}%`,
                                                        backgroundColor: COLORS[(index + 4) % COLORS.length],
                                                        opacity: 0.8
                                                    }}
                                                ></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 italic text-sm py-10">No industry data found.</div>
                        )}
                    </div>
                    <div className="p-4 bg-slate-50/50 border-t border-slate-100 text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Showing Top {data.leadsByIndustry.length} Industries</p>
                    </div>
                </div>

                {/* Agent Leaderboard Matrix */}
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 lg:col-span-2 overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: '300ms' }}>
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                        <h3 className="font-extrabold text-[#0f1c2e] flex items-center gap-2">
                            <Award size={20} className="text-rose-500" />
                            Agent Performance Matrix
                        </h3>
                    </div>
                    <div className="overflow-x-auto flex-1 custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] sm:text-xs uppercase tracking-widest text-slate-400 font-extrabold">
                                    <th className="py-4 px-6 font-bold">Agent Name</th>
                                    <th className="py-4 px-6 font-bold text-center">Calls</th>
                                    <th className="py-4 px-6 font-bold text-center">Leads</th>
                                    <th className="py-4 px-6 font-bold text-center">Wins</th>
                                    <th className="py-4 px-6 font-bold text-center">Onboarded</th>
                                    <th className="py-4 px-6 font-bold text-center">Success %</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm font-medium text-slate-700 divide-y divide-slate-100">
                                {data.agentPerformance.length > 0 ? (
                                    data.agentPerformance.map((agent, i) => (
                                        <tr key={i} className="hover:bg-slate-50/60 transition-colors group">
                                            <td className="py-4 px-6 font-extrabold text-[#0f1c2e] flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center text-xs shadow-sm font-bold group-hover:bg-[#0ea5e9] group-hover:text-white transition-colors">
                                                    {agent.name.charAt(0).toUpperCase()}
                                                </div>
                                                {agent.name}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <button
                                                    onClick={() => {
                                                        setSelectedAgent({ id: agent.agentId, name: agent.name });
                                                        setIsModalOpen(true);
                                                    }}
                                                    className="px-3 py-1.5 rounded-lg bg-slate-50 text-slate-700 font-extrabold text-sm hover:bg-[#0ea5e9] hover:text-white hover:shadow-md hover:shadow-sky-500/20 transition-all cursor-pointer border border-transparent hover:border-sky-200"
                                                >
                                                    {agent.calls}
                                                </button>
                                            </td>
                                            <td className="py-4 px-6 text-center font-bold text-slate-600">{agent.leads}</td>
                                            <td className="py-4 px-6 text-center font-bold text-blue-600">{agent.won}</td>
                                            <td className="py-4 px-6">
                                                <div className="flex flex-col items-center gap-1.5 min-w-[80px]">
                                                    <span className="font-extrabold text-emerald-600">{agent.onboarded}</span>
                                                    <div className="w-full h-1 bg-emerald-50 rounded-full overflow-hidden border border-emerald-100/30">
                                                        <div
                                                            className="h-full rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                                                            style={{ width: `${Math.min((agent.onboarded / Math.max(...data.agentPerformance.map(a => a.onboarded || 1))) * 100, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]"
                                                            style={{ width: `${agent.winRate}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="font-extrabold text-[10px] sm:text-xs text-slate-500">{agent.winRate}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="py-10 text-center text-slate-400 italic">No agent performance data found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {selectedAgent && (
                <AgentCallsModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    agentId={selectedAgent.id}
                    agentName={selectedAgent.name}
                    startDate={dateRange?.startDate}
                    endDate={dateRange?.endDate}
                />
            )}
        </div>
    );
};

export default Reports;
