import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users,
    TrendingUp,
    Loader2,
    Activity,
    UserCheck,
    Trophy,
    PhoneCall,
    Clock
} from 'lucide-react';
import { API_BASE_URL } from '../../config';
import toast from 'react-hot-toast';

import DateRangeFilter from '../../components/common/DateRangeFilter';

interface DashboardStats {
    totalLeads: number;
    activeAgents: number;
    totalCalls: number;
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

interface TeamMemberPerformance {
    _id: string;
    name: string;
    role: string;
    calls: number;
    leads: number;
    won: number;
    onboarded: number;
    winRate: number;
}

const ManagerDashboard: React.FC = () => {
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
    const [teamPerformance, setTeamPerformance] = useState<TeamMemberPerformance[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<{ startDate: string, endDate: string } | null>(getCurrentMonthRange());

    useEffect(() => {
        fetchDashboardData();
    }, [dateRange]);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            let url = `${API_BASE_URL}/api/dashboard/manager`;

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
            setTeamPerformance(data.teamPerformance || []);
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
        { label: 'Team Companies', value: stats?.totalLeads || 0, icon: <TrendingUp className="text-emerald-500" />, trend: 'Team Leads', isUp: true, path: '/manager/leads' },
        { label: 'Active BDs', value: stats?.activeAgents || 0, icon: <Users className="text-blue-500" />, trend: 'Reporters', isUp: true, path: '/manager/add-lead' },
        { label: 'Total Calls', value: stats?.totalCalls || 0, icon: <PhoneCall className="text-sky-500" />, trend: 'Dialed', isUp: true, path: '/manager/leads' },
        { label: 'Total Onboarded', value: stats?.totalOnboarded || 0, icon: <UserCheck className="text-purple-500" />, trend: 'Conversions', isUp: true, path: '/manager/leads?stage=Onboarded' },
    ];

    return (
        <div className="h-full overflow-y-auto pr-1 -mr-1 custom-scrollbar space-y-6 sm:space-y-8 bg-[#f8fafc] pb-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0f1c2e] tracking-tight">Manager Dashboard</h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">Review team conversions, call outputs, and approvals.</p>
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
                            <span className="text-[10px] sm:text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 bg-slate-50 text-slate-500">
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
                {/* Team Performance List */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-bold text-[#0f1c2e] flex items-center gap-2">
                            <Trophy size={18} className="text-amber-500" />
                            Team Sales Leaderboard
                        </h3>
                        <span className="text-xs font-bold text-slate-400">Sorted by calls</span>
                    </div>
                    <div className="p-6 overflow-y-auto max-h-[400px] space-y-6 custom-scrollbar">
                        {teamPerformance.length > 0 ? (
                            teamPerformance.map((member, idx) => (
                                <div key={member._id} className="flex items-center gap-4 animate-in fade-in slide-in-from-left-4 duration-300" style={{ animationDelay: `${idx * 100}ms` }}>
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm shrink-0 ${idx === 0 ? 'bg-amber-100 text-amber-600 ring-2 ring-amber-200' :
                                        idx === 1 ? 'bg-slate-100 text-slate-500 ring-2 ring-slate-200' :
                                            idx === 2 ? 'bg-orange-50 text-orange-600 ring-2 ring-orange-100' :
                                                'bg-slate-50 text-slate-400'
                                        }`}>
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center">
                                            <p className="text-sm font-extrabold text-[#0f1c2e] truncate">{member.name}</p>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{member.role}</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mt-2">
                                            {/* Calls Progress */}
                                            <div>
                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Calls Dialed</span>
                                                    <span className="text-[10px] font-bold text-slate-500">{member.calls}</span>
                                                </div>
                                                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-[#0ea5e9]"
                                                        style={{ width: `${Math.min((member.calls / (teamPerformance[0]?.calls || 1)) * 100, 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>

                                            {/* Onboarded Progress */}
                                            <div>
                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                    <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Onboarded</span>
                                                    <span className="text-[10px] font-bold text-emerald-600">{member.onboarded}</span>
                                                </div>
                                                <div className="w-full h-1 bg-emerald-50 rounded-full overflow-hidden border border-emerald-100/30">
                                                    <div
                                                        className="h-full rounded-full bg-emerald-500"
                                                        style={{ width: `${Math.min((member.onboarded / Math.max(1, ...teamPerformance.map(a => a.onboarded))) * 100, 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-slate-400 italic text-sm py-10">No reporter activity found yet.</div>
                        )}
                    </div>
                </div>

                {/* Recent Team Activity Feed */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-bold text-[#0f1c2e] flex items-center gap-2">
                            <Activity size={18} className="text-[#0ea5e9]" />
                            Team Activity Log
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-[400px] p-6 custom-scrollbar">
                        {recentActivity.length > 0 ? (
                            <div className="space-y-6">
                                {recentActivity.map((activity, idx) => (
                                    <div key={activity._id} className="relative flex gap-4 animate-in fade-in slide-in-from-right-4 duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                                        {idx !== recentActivity.length - 1 && (
                                            <div className="absolute left-[15px] top-8 bottom-[-24px] w-[2px] bg-slate-50"></div>
                                        )}
                                        <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 z-10 font-bold text-[#0ea5e9] text-xs">
                                            {activity.performedByName?.charAt(0) || 'U'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-[#0f1c2e]">
                                                {activity.performedByName} <span className="text-slate-400 font-medium">logged</span> {activity.type}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5 italic truncate">{activity.description}</p>
                                            {activity.leadId && (
                                                <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-[#0ea5e9]/5 rounded-md border border-[#0ea5e9]/10">
                                                    <span className="text-[10px] font-bold text-[#0ea5e9] uppercase tracking-wider">Company:</span>
                                                    <span className="text-[10px] font-extrabold text-[#0f1c2e] truncate max-w-[120px]">{activity.leadId.company_name}</span>
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap pt-1 flex items-center gap-1">
                                            <Clock size={10} />
                                            {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">No recent team activities.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManagerDashboard;
