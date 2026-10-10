import React, { useEffect, useState } from 'react';
import {
    Target, TrendingUp, Users, Phone, CheckSquare, AlertCircle,
    Activity, Loader2, Building2, ArrowUpRight, ArrowDownRight,
    BarChart3, Clock, Star, ChevronRight
} from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { Mail } from 'lucide-react';
import SendEmailModal from '../../components/modals/SendEmailModal';
import toast from 'react-hot-toast';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Stats {
    totalLeads: number;
    activeLeads: number;
    wonLeads: number;
    lostLeads: number;
    conversionRate: string;
    callsToday: number;
    callsThisWeek: number;
    callsThisMonth: number;
    newLeadsThisMonth: number;
    leadsThisWeek: number;
    totalPendingTasks: number;
    overdueTasks: number;
}

interface StageItem { _id: string; count: number; }
interface CallOutcome { _id: string; count: number; }
interface TopLead { company_name: string; stage: string; activityCount: number; }
interface PendingTask {
    _id: string;
    title: string;
    due_date: string;
    type?: string;
    completed: boolean;
    lead_id?: { company_name: string };
}
interface RecentActivity {
    _id: string;
    type: string;
    description: string;
    timestamp: string;
    leadId?: { company_name: string };
}

interface DashboardData {
    stats: Stats;
    stageBreakdown: StageItem[];
    callOutcomes: CallOutcome[];
    topLeads: TopLead[];
    pendingTasks: PendingTask[];
    recentActivity: RecentActivity[];
}

// ─── Stage colours ───────────────────────────────────────────────────────────
const STAGE_COLORS: Record<string, string> = {
    New: '#6366f1',
    Contacted: '#0ea5e9',
    'Proposal Sent': '#f59e0b',
    Negotiation: '#8b5cf6',
    Won: '#10b981',
    Onboarded: '#059669',
    Lost: '#ef4444',
    'No vendor': '#94a3b8',
    'Future Reference': '#64748b',
};

const stageColor = (stage: string) => STAGE_COLORS[stage] ?? '#94a3b8';

// ─── Activity icon colour ─────────────────────────────────────────────────────
const activityColor = (type: string) => {
    const map: Record<string, string> = {
        'Lead Created': '#10b981',
        'Stage Changed': '#8b5cf6',
        'Call Logged': '#0ea5e9',
        'Task Created': '#f59e0b',
        'Task Completed': '#10b981',
        'POC Added': '#6366f1',
        'Remark Added': '#64748b',
    };
    return map[type] ?? '#94a3b8';
};

// ─── Helper: relative time ────────────────────────────────────────────────────
function relativeTime(ts: string) {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Helper: due-date badge ───────────────────────────────────────────────────
function dueBadge(dueDate: string) {
    const now = new Date();
    const due = new Date(dueDate);
    const diff = due.getTime() - now.getTime();
    const days = Math.ceil(diff / 86400000);
    if (days < 0) return { label: `${Math.abs(days)}d overdue`, cls: 'bg-red-100 text-red-700' };
    if (days === 0) return { label: 'Due today', cls: 'bg-amber-100 text-amber-700' };
    if (days === 1) return { label: 'Due tomorrow', cls: 'bg-yellow-100 text-yellow-700' };
    return { label: `${days}d left`, cls: 'bg-slate-100 text-slate-600' };
}

// ─── Mini bar for pipeline stage ─────────────────────────────────────────────
const StageBar: React.FC<{ item: StageItem; max: number }> = ({ item, max }) => {
    const pct = Math.max(4, Math.round((item.count / max) * 100));
    return (
        <div className="flex items-center gap-3 group">
            <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: stageColor(item._id) }}
            />
            <span className="text-sm font-medium text-slate-600 w-32 truncate">{item._id}</span>
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: stageColor(item._id) }}
                />
            </div>
            <span className="text-sm font-bold text-slate-700 w-6 text-right">{item.count}</span>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
const BDDashboard: React.FC = () => {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showSendEmailModal, setShowSendEmailModal] = useState(false);


    useEffect(() => { fetchDashboard(); }, []);

    const fetchDashboard = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/dashboard/bd`, {
                headers: { 'x-auth-token': token || '' },
            });
            if (!res.ok) throw new Error('Failed to load dashboard');
            const json = await res.json();
            setData(json);
        } catch (err: any) {
            toast.error(err.message || 'Dashboard error');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="animate-spin text-[#0ea5e9]" size={36} />
            </div>
        );
    }

    if (!data) return null;
    const { stats, stageBreakdown, callOutcomes, topLeads, pendingTasks, recentActivity } = data;
    const stageMax = stageBreakdown.reduce((m, s) => Math.max(m, s.count), 1);
    const outcomeMax = callOutcomes.reduce((m, o) => Math.max(m, o.count), 1);

    // ── KPI cards ──────────────────────────────────────────────────────────────
    const kpiCards = [
        {
            title: 'Total Companies',
            value: stats.totalLeads,
            sub: `${stats.newLeadsThisMonth} new this month`,
            icon: Users,
            color: 'text-indigo-600',
            bg: 'bg-indigo-50',
            trend: 'up',
        },
        {
            title: 'Active Companies',
            value: stats.activeLeads,
            sub: `${stats.leadsThisWeek} added this week`,
            icon: TrendingUp,
            color: 'text-sky-600',
            bg: 'bg-sky-50',
            trend: 'up',
        },
        {
            title: 'Won / Onboarded',
            value: stats.wonLeads,
            sub: `Conversion: ${stats.conversionRate}`,
            icon: Target,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            trend: stats.wonLeads > 0 ? 'up' : 'neutral',
        },
        {
            title: 'Calls Today',
            value: stats.callsToday,
            sub: `${stats.callsThisWeek} this week • ${stats.callsThisMonth} this month`,
            icon: Phone,
            color: 'text-violet-600',
            bg: 'bg-violet-50',
            trend: stats.callsToday > 0 ? 'up' : 'neutral',
        },
        {
            title: 'Pending Tasks',
            value: stats.totalPendingTasks,
            sub: stats.overdueTasks > 0 ? `${stats.overdueTasks} overdue` : 'All on track',
            icon: CheckSquare,
            color: stats.overdueTasks > 0 ? 'text-red-600' : 'text-amber-600',
            bg: stats.overdueTasks > 0 ? 'bg-red-50' : 'bg-amber-50',
            trend: stats.overdueTasks > 0 ? 'down' : 'neutral',
        },
        {
            title: 'Lost Leads',
            value: stats.lostLeads,
            sub: 'Closed as lost',
            icon: AlertCircle,
            color: 'text-rose-600',
            bg: 'bg-rose-50',
            trend: stats.lostLeads > 0 ? 'down' : 'neutral',
        },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500 h-full pb-8 overflow-y-auto pr-1 -mr-1 custom-scrollbar">

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0f1c2e] tracking-tight">
                        Welcome back, {user?.name?.split(' ')[0] || 'Executive'}!
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">
                        {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        &nbsp;·&nbsp;Your live pipeline at a glance.
                    </p>
                </div>
                <button
                    onClick={fetchDashboard}
                    className="flex items-center gap-2 px-4 py-2 bg-[#0ea5e9] text-white rounded-xl text-sm font-semibold hover:bg-[#0284c7] transition-colors shadow-sm shadow-sky-500/20 self-start sm:self-auto"
                >
                    <Activity size={15} />
                    Refresh
                </button>
            </div>

            {/* ── KPI Grid ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                {kpiCards.map((card, idx) => {
                    const Icon = card.icon;
                    return (
                        <div
                            key={idx}
                            className="bg-white rounded-2xl p-4 border border-slate-200/70 shadow-sm hover:shadow-md transition-all group cursor-default"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${card.bg} ${card.color} group-hover:scale-110 transition-transform duration-300`}>
                                    <Icon size={18} />
                                </div>
                                {card.trend === 'up' && (
                                    <ArrowUpRight size={14} className="text-emerald-500" />
                                )}
                                {card.trend === 'down' && (
                                    <ArrowDownRight size={14} className="text-rose-500" />
                                )}
                            </div>
                            <p className="text-2xl font-extrabold text-[#0f1c2e]">
                                {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                            </p>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-0.5 truncate">{card.title}</p>
                            <p className="text-[11px] text-slate-400 mt-1 truncate leading-tight">{card.sub}</p>
                        </div>
                    );
                })}
            </div>

            {/* ── Middle row: Pipeline + Call Outcomes ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Pipeline Stage Breakdown */}
                <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center">
                            <BarChart3 size={16} className="text-indigo-600" />
                        </div>
                        <h3 className="text-base font-bold text-[#0f1c2e]">Pipeline Stage Breakdown</h3>
                    </div>
                    {stageBreakdown.length > 0 ? (
                        <div className="space-y-3">
                            {stageBreakdown.map((item) => (
                                <StageBar key={item._id} item={item} max={stageMax} />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                            <BarChart3 size={28} className="opacity-20 mb-2" />
                            <p className="text-xs italic">No leads in pipeline yet.</p>
                        </div>
                    )}
                </div>

                {/* Call Outcome Breakdown */}
                <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <div className="w-8 h-8 bg-sky-50 rounded-xl flex items-center justify-center">
                            <Phone size={16} className="text-sky-600" />
                        </div>
                        <h3 className="text-base font-bold text-[#0f1c2e]">Call Outcomes</h3>
                        <span className="ml-auto text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            {stats.callsThisMonth} this month
                        </span>
                    </div>
                    {callOutcomes.length > 0 ? (
                        <div className="space-y-3">
                            {callOutcomes.map((item) => {
                                const pct = Math.max(4, Math.round((item.count / outcomeMax) * 100));
                                const colors: Record<string, string> = {
                                    Contacted: '#0ea5e9',
                                    'No Answer': '#f59e0b',
                                    Busy: '#f97316',
                                    'Wrong Number': '#ef4444',
                                    New: '#6366f1',
                                };
                                const c = colors[item._id] ?? '#94a3b8';
                                return (
                                    <div key={item._id} className="flex items-center gap-3">
                                        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c }} />
                                        <span className="text-sm font-medium text-slate-600 w-32 truncate">{item._id}</span>
                                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c }} />
                                        </div>
                                        <span className="text-sm font-bold text-slate-700 w-6 text-right">{item.count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                            <Phone size={28} className="opacity-20 mb-2" />
                            <p className="text-xs italic">No call records found.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Bottom row: Top Leads + Tasks + Activity ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Top Engaged Leads */}
                <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-6 flex flex-col">
                    <div className="flex items-center gap-2 mb-5">
                        <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center">
                            <Star size={16} className="text-amber-500" />
                        </div>
                        <h3 className="text-base font-bold text-[#0f1c2e]">Top Engaged Leads</h3>
                    </div>
                    {topLeads.length > 0 ? (
                        <div className="space-y-3 flex-1">
                            {topLeads.map((lead, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-sky-100 flex items-center justify-center text-indigo-600 font-extrabold text-sm shrink-0">
                                        {lead.company_name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-[#0f1c2e] truncate">{lead.company_name}</p>
                                        <span
                                            className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                                            style={{
                                                background: stageColor(lead.stage) + '22',
                                                color: stageColor(lead.stage)
                                            }}
                                        >
                                            {lead.stage}
                                        </span>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-extrabold text-slate-700">{lead.activityCount}</p>
                                        <p className="text-[10px] text-slate-400">activities</p>
                                    </div>
                                </div>
                            ))}
                            <div className="flex justify-end mt-4">
                                <button onClick={() => setShowSendEmailModal(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded">
                                    <Mail size={16} />
                                    Send Email
                                </button>
                            </div>
                            <SendEmailModal open={showSendEmailModal} onClose={() => setShowSendEmailModal(false)} company={null} poc={null} />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center flex-1 text-slate-400 py-8">
                            <Building2 size={28} className="opacity-20 mb-2" />
                            <p className="text-xs italic">No lead activity yet.</p>
                        </div>
                    )}
                </div>

                {/* Pending Tasks */}
                <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-6 flex flex-col">
                    <div className="flex items-center gap-2 mb-5">
                        <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center">
                            <Clock size={16} className="text-amber-600" />
                        </div>
                        <h3 className="text-base font-bold text-[#0f1c2e]">Upcoming Tasks</h3>
                        {stats.overdueTasks > 0 && (
                            <span className="ml-auto text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                                {stats.overdueTasks} overdue
                            </span>
                        )}
                    </div>
                    {pendingTasks.length > 0 ? (
                        <div className="space-y-3 flex-1">
                            {pendingTasks.map((task) => {
                                const badge = dueBadge(task.due_date);
                                return (
                                    <div key={task._id} className="flex gap-3 items-start p-3 rounded-xl hover:bg-slate-50 transition-colors">
                                        <div className="w-2 h-2 rounded-full bg-amber-400 mt-2 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-[#0f1c2e] truncate">{task.title}</p>
                                            {task.lead_id && (
                                                <p className="text-xs text-slate-400 truncate mt-0.5">{task.lead_id.company_name}</p>
                                            )}
                                            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full mt-1 inline-block ${badge.cls}`}>
                                                {badge.label}
                                            </span>
                                        </div>
                                        {task.type && (
                                            <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full shrink-0">
                                                {task.type}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                            {stats.totalPendingTasks > 5 && (
                                <p className="text-xs text-slate-400 text-center pt-1">
                                    + {stats.totalPendingTasks - 5} more tasks
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center flex-1 text-slate-400 py-8">
                            <CheckSquare size={28} className="opacity-20 mb-2" />
                            <p className="text-xs italic">No pending tasks. Great work!</p>
                        </div>
                    )}
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-6 flex flex-col">
                    <div className="flex items-center gap-2 mb-5">
                        <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center">
                            <Activity size={16} className="text-slate-600" />
                        </div>
                        <h3 className="text-base font-bold text-[#0f1c2e]">Recent Activity</h3>
                    </div>
                    {recentActivity.length > 0 ? (
                        <div className="space-y-4 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                            {recentActivity.map((item, i) => (
                                <div key={item._id} className="flex gap-3" style={{ animationDelay: `${i * 40}ms` }}>
                                    <div
                                        className="w-2 h-2 rounded-full mt-2 shrink-0"
                                        style={{ background: activityColor(item.type) }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        {item.leadId && (
                                            <p className="text-[0.82rem] font-bold text-[#0f1c2e] truncate">
                                                {item.leadId.company_name}
                                            </p>
                                        )}
                                        <p className="text-xs text-slate-500 truncate leading-snug">{item.description}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">{relativeTime(item.timestamp)}</p>
                                    </div>
                                    <ChevronRight size={14} className="text-slate-300 mt-1 shrink-0" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center flex-1 text-slate-400 py-8">
                            <Activity size={28} className="opacity-20 mb-2" />
                            <p className="text-xs italic">No recent activity found.</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};

export default BDDashboard;
