import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users,
    TrendingUp,
    ArrowUpRight,
    ArrowDownRight,
    Loader2,
    Activity,
    FileText,
    UserCheck,
    Trophy,
    X
} from 'lucide-react';
import { API_BASE_URL } from '../../config';
import toast from 'react-hot-toast';

import DateRangeFilter from '../../components/common/DateRangeFilter';

interface DashboardStats {
    totalLeads: number;
    activeAgents: number;
    totalProposalSent: number;
    totalOnboarded: number;
}

interface RecentActivity {
    _id: string;
    type: string;
    description: string;
    performedByName: string;
    timestamp: string;
    leadId?: { company_name: string };
}

interface TopAgent {
    name: string;
    calls: number;
    onboarded: number;
}

const AdminDashboard: React.FC = () => {
    const navigate = useNavigate();

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

    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
    const [topAgents, setTopAgents] = useState<TopAgent[]>([]);
    const [fullLeaderboard, setFullLeaderboard] = useState<TopAgent[]>([]);
    const [isLeaderboardModalOpen, setIsLeaderboardModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<{ startDate: string, endDate: string } | null>(getCurrentMonthRange());

    useEffect(() => {
        fetchDashboardData();
    }, [dateRange]);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            let url = `${API_BASE_URL}/api/dashboard/admin`;

            if (dateRange) {
                url += `?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
            }

            const response = await fetch(url, {
                headers: { 'x-auth-token': token || '' }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch dashboard data');
            }

            const data = await response.json();
            setStats(data.stats);
            setRecentActivity(data.recentActivity);
            setTopAgents(data.topAgents);
            setFullLeaderboard(data.fullLeaderboard || []);
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

    const statCards = [
        { label: 'Total Companies', value: stats?.totalLeads || 0, icon: <TrendingUp className="text-emerald-500" />, trend: '+12.5%', isUp: true, path: '/admin/leads' },
        { label: 'Active Agents', value: stats?.activeAgents || 0, icon: <Users className="text-blue-500" />, trend: '+3.2%', isUp: true, path: '/admin/users?status=Active' },
        { label: 'Proposals Sent', value: stats?.totalProposalSent || 0, icon: <FileText className="text-orange-500" />, trend: '+8.4%', isUp: true, path: '/admin/leads?stage=Proposal Sent' },
        { label: 'Total Onboarded', value: stats?.totalOnboarded || 0, icon: <UserCheck className="text-purple-500" />, trend: '+2.1%', isUp: true, path: '/admin/leads?stage=Onboarded' },
    ];

    return (
        <div className="h-full overflow-y-auto pr-1 -mr-1 custom-scrollbar space-y-6 sm:space-y-8 bg-[#f8fafc] pb-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0f1c2e] tracking-tight">Dashboard Overview</h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">Monitor CRM performance and team activity.</p>
                </div>
                <DateRangeFilter onApply={(range) => setDateRange(range)} initialRange={dateRange} />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {statCards.map((stat, idx) => (
                    <div
                        key={idx}
                        onClick={() => navigate(stat.path)}
                        className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-md transition-all cursor-pointer hover:-translate-y-1 group"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="bg-slate-50 p-2 sm:p-2.5 rounded-xl group-hover:bg-sky-50 transition-colors">
                                {stat.icon}
                            </div>
                            <span className={`text-[10px] sm:text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${stat.isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                                }`}>
                                {stat.isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                {stat.trend}
                            </span>
                        </div>
                        <p className="text-slate-500 text-xs sm:text-sm font-medium">{stat.label}</p>
                        <h3 className="text-xl sm:text-2xl font-bold text-[#0f1c2e] mt-1">{stat.value.toLocaleString()}</h3>
                    </div>
                ))}
            </div>

            {/* Main Content Sections */}
            <div className="grid grid-cols-1 overflow-visible lg:grid-cols-3 gap-6">
                {/* Recent Activity Feed */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200/60 flex flex-col overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-bold text-[#0f1c2e] flex items-center gap-2">
                            <Activity size={18} className="text-[#0ea5e9]" />
                            Recent Activity Feed
                        </h3>
                        <button className="text-xs font-bold text-[#0ea5e9] hover:underline">View All</button>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-[400px] p-6 custom-scrollbar">
                        {recentActivity.length > 0 ? (
                            <div className="space-y-6">
                                {recentActivity.map((activity, idx) => (
                                    <div key={activity._id} className="relative flex gap-4 animate-in fade-in slide-in-from-left-4 duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                                        {idx !== recentActivity.length - 1 && (
                                            <div className="absolute left-[15px] top-8 bottom-[-24px] w-[2px] bg-slate-50"></div>
                                        )}
                                        <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 z-10 font-bold text-[#0ea5e9] text-xs">
                                            {activity.performedByName?.charAt(0) || 'S'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-[#0f1c2e]">
                                                {activity.performedByName} <span className="text-slate-400 font-medium">performed</span> {activity.type}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5 italic truncate">{activity.description}</p>
                                            {activity.leadId && (
                                                <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-[#0ea5e9]/5 rounded-md border border-[#0ea5e9]/10">
                                                    <span className="text-[10px] font-bold text-[#0ea5e9] uppercase tracking-wider">Lead:</span>
                                                    <span className="text-[10px] font-extrabold text-[#0f1c2e] truncate max-w-[120px]">{activity.leadId.company_name}</span>
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap pt-1">
                                            {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">No recent activity found.</div>
                        )}
                    </div>
                </div>

                {/* Top Agents List */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-slate-100">
                        <h3 className="font-bold text-[#0f1c2e] flex items-center gap-2">
                            <Users size={18} className="text-orange-500" />
                            Top Performing Agents
                        </h3>
                    </div>
                    <div className="p-6 space-y-5">
                        {topAgents.length > 0 ? (
                            topAgents.map((agent, idx) => (
                                <div key={idx} className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-300" style={{ animationDelay: `${idx * 100}ms` }}>
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm ${idx === 0 ? 'bg-amber-100 text-amber-600 ring-2 ring-amber-200' :
                                        idx === 1 ? 'bg-slate-100 text-slate-500 ring-2 ring-slate-200' :
                                            idx === 2 ? 'bg-orange-50 text-orange-600 ring-2 ring-orange-100' :
                                                'bg-slate-50 text-slate-400'
                                        }`}>
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-extrabold text-[#0f1c2e] truncate">{agent.name}</p>

                                        {/* Calls Bar */}
                                        <div className="mt-1">
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Calls</span>
                                                <span className="text-[10px] font-bold text-slate-500">{agent.calls}</span>
                                            </div>
                                            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${idx === 0 ? 'bg-amber-500' : 'bg-[#0ea5e9]'}`}
                                                    style={{ width: `${Math.min((agent.calls / (topAgents[0]?.calls || 1)) * 100, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        {/* Onboarded Bar */}
                                        <div className="mt-2 text-emerald-600">
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Onboarded</span>
                                                <span className="text-[10px] font-bold text-emerald-600">{agent.onboarded}</span>
                                            </div>
                                            <div className="w-full h-1 bg-emerald-50 rounded-full overflow-hidden border border-emerald-100/30">
                                                <div
                                                    className="h-full rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                                                    style={{ width: `${Math.min((agent.onboarded / Math.max(...topAgents.map(a => a.onboarded || 1))) * 100, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-slate-400 italic text-sm py-10">No agent activity yet.</div>
                        )}
                    </div>
                    <div className="mt-auto p-6 bg-slate-50/50 border-t border-slate-100">
                        <button
                            onClick={() => setIsLeaderboardModalOpen(true)}
                            className="w-full py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                        >
                            View Full Leaderboard
                        </button>
                    </div>
                </div>
            </div>

            {/* Leaderboard Modal */}
            {isLeaderboardModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-lg p-0 shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shadow-sm">
                                    <Trophy size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-[#0f1c2e]">Full Leaderboard</h3>
                                    <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">All agents ranked by performance</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsLeaderboardModalOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shadow-sm"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                            <div className="space-y-4">
                                {fullLeaderboard.length > 0 ? (
                                    fullLeaderboard.map((agent, idx) => (
                                        <div key={idx} className="flex items-center gap-4 animate-in fade-in slide-in-from-right-4 duration-300" style={{ animationDelay: `${Math.min(idx * 50, 500)}ms` }}>
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shadow-sm ${idx === 0 ? 'bg-amber-100 text-amber-600 ring-2 ring-amber-200' :
                                                idx === 1 ? 'bg-slate-100 text-slate-500 ring-2 ring-slate-200' :
                                                    idx === 2 ? 'bg-orange-50 text-orange-600 ring-2 ring-orange-100' :
                                                        'bg-slate-50 text-slate-400'
                                                }`}>
                                                #{idx + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-extrabold text-[#0f1c2e] truncate">{agent.name}</p>
                                                <div className="space-y-2 mt-1">
                                                    {/* Calls Bar */}
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-orange-500' : 'bg-[#0ea5e9]'}`}
                                                                style={{ width: `${(agent.calls / (fullLeaderboard[0]?.calls || 1)) * 100}%` }}
                                                            ></div>
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-500 min-w-[50px] text-right">{agent.calls} calls</span>
                                                    </div>
                                                    {/* Onboarded Bar */}
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-1.5 bg-emerald-50 rounded-full overflow-hidden border border-emerald-100/30">
                                                            <div
                                                                className="h-full rounded-full bg-emerald-500"
                                                                style={{ width: `${(agent.onboarded / Math.max(...fullLeaderboard.map(a => a.onboarded || 1))) * 100}%` }}
                                                            ></div>
                                                        </div>
                                                        <span className="text-[10px] font-bold text-emerald-600 min-w-[50px] text-right">{agent.onboarded} onboard</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end shrink-0 hidden md:flex">
                                                <span className="text-lg font-black text-[#0f1c2e]">{agent.onboarded}</span>
                                                <span className="text-[0.6rem] font-bold text-emerald-500 uppercase tracking-wider">Onboarding</span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center text-slate-400 italic text-sm py-10">No agent activity yet.</div>
                                )}
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                            <button
                                onClick={() => setIsLeaderboardModalOpen(false)}
                                className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-[#0ea5e9] bg-white border border-slate-200 hover:bg-sky-50 hover:border-sky-200 transition-all shadow-sm"
                            >
                                Close Leaderboard
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
