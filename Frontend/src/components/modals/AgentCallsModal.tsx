import React, { useState, useEffect } from 'react';
import { X, Phone, User, Loader2, Filter, Search, MessageSquare, Briefcase } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import toast from 'react-hot-toast';

interface Call {
    _id: string;
    companyName: string;
    pocName: string;
    designation: string;
    phoneNumber: string;
    callType: string;
    timestamp: string;
    remarks: string;
    stageAfterCall: string;
}

interface AgentCallsModalProps {
    isOpen: boolean;
    onClose: () => void;
    agentId: string;
    agentName: string;
    startDate?: string;
    endDate?: string;
}

const AgentCallsModal: React.FC<AgentCallsModalProps> = ({
    isOpen,
    onClose,
    agentId,
    agentName,
    startDate,
    endDate
}) => {
    const [calls, setCalls] = useState<Call[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedStatus, setSelectedStatus] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState<string>('');

    useEffect(() => {
        if (isOpen && agentId) {
            setSelectedStatus('All');
            setSearchQuery('');
            fetchCalls();
        }
    }, [isOpen, agentId, startDate, endDate]);

    const fetchCalls = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const userStr = localStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            const isManager = user?.role === 'Manager';
            const endpoint = isManager ? 'manager-agent-calls' : 'agent-calls';
            let url = `${API_BASE_URL}/api/dashboard/${endpoint}?agentId=${agentId}`;

            if (startDate && endDate) {
                url += `&startDate=${startDate}&endDate=${endDate}`;
            }

            const res = await fetch(url, {
                headers: { 'x-auth-token': token || '' }
            });
            if (!res.ok) throw new Error('Failed to fetch call details');
            const json = await res.json();
            setCalls(json);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const uniqueStatuses = Array.from(
        new Set(calls.map((call) => call.stageAfterCall).filter(Boolean))
    ).sort();

    const statusCounts = calls.reduce((acc: Record<string, number>, call) => {
        const status = call.stageAfterCall;
        if (status) {
            acc[status] = (acc[status] || 0) + 1;
        }
        return acc;
    }, {});

    const filteredCalls = calls.filter((call) => {
        const matchesStatus = selectedStatus === 'All' || call.stageAfterCall === selectedStatus;
        if (!matchesStatus) return false;

        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            call.companyName?.toLowerCase().includes(q) ||
            call.pocName?.toLowerCase().includes(q) ||
            call.phoneNumber?.includes(q) ||
            call.designation?.toLowerCase().includes(q) ||
            call.remarks?.toLowerCase().includes(q) ||
            call.stageAfterCall?.toLowerCase().includes(q)
        );
    });

    // Group filtered calls by company name so the company name is shown once per group
    const groupedCalls = filteredCalls.reduce((acc: { companyName: string; calls: Call[] }[], call) => {
        const key = call.companyName || 'Unknown Company';
        let group = acc.find(g => g.companyName === key);
        if (!group) {
            group = { companyName: key, calls: [] };
            acc.push(group);
        }
        group.calls.push(call);
        return acc;
    }, []);

    const callsWithRemarksCount = calls.filter(
        c => c.remarks && c.remarks.trim() && c.remarks !== 'No remarks'
    ).length;

    const getStageBadgeStyle = (stage: string) => {
        switch (stage) {
            case 'Contacted':
                return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'No Answer':
                return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'Busy':
                return 'bg-rose-50 text-rose-700 border-rose-200';
            case 'Wrong Number':
                return 'bg-red-50 text-red-700 border-red-200';
            case 'Proposal Sent':
                return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'Won':
            case 'Onboarded':
                return 'bg-green-50 text-green-700 border-green-200';
            default:
                return 'bg-sky-50 text-[#0ea5e9] border-sky-200';
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="relative bg-white w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col gap-4 bg-slate-50/70">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-extrabold text-[#0f1c2e] flex items-center gap-2.5">
                                <span className="p-2 bg-sky-50 text-[#0ea5e9] rounded-xl border border-sky-100">
                                    <Phone size={18} />
                                </span>
                                Call Logs: {agentName}
                            </h2>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                {startDate && endDate && (
                                    <p className="text-xs text-slate-500 font-medium">
                                        Period: <span className="text-slate-800 font-bold">{startDate}</span> to <span className="text-slate-800 font-bold">{endDate}</span>
                                    </p>
                                )}
                                <span className="text-slate-300">•</span>
                                <span className="text-xs font-bold text-slate-600">
                                    Total: <strong className="text-slate-900">{calls.length}</strong> calls across <strong className="text-slate-900">{groupedCalls.length}</strong> companies
                                </span>
                                <span className="text-slate-300">•</span>
                                <span className="text-xs font-bold text-emerald-600">
                                    With Remarks: <strong>{callsWithRemarksCount}</strong>
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-200/60 rounded-xl transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Filter and Search Bar */}
                    <div className="flex items-center gap-3 flex-wrap pt-1">
                        {/* Search Input */}
                        <div className="flex-1 min-w-[200px] relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search company, POC, phone, remarks..."
                                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all shadow-sm"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>

                        {/* Status Filter */}
                        {!loading && calls.length > 0 && (
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm transition-all">
                                <Filter size={13} className="text-slate-500" />
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">Status:</span>
                                <select
                                    value={selectedStatus}
                                    onChange={(e) => setSelectedStatus(e.target.value)}
                                    className="text-xs font-bold bg-transparent border-none text-slate-700 outline-none cursor-pointer pr-1"
                                >
                                    <option value="All">All Statuses ({calls.length})</option>
                                    {uniqueStatuses.map(status => (
                                        <option key={status} value={status}>
                                            {status} ({statusCounts[status]})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
                    {loading ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-3">
                            <Loader2 className="animate-spin text-[#0ea5e9]" size={32} />
                            <p className="text-sm font-bold text-slate-500 animate-pulse uppercase tracking-widest">Fetching call history...</p>
                        </div>
                    ) : groupedCalls.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[750px]">
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] uppercase tracking-widest text-slate-500 font-extrabold shadow-sm">
                                        <th className="py-3 px-5 w-[220px]">Company</th>
                                        <th className="py-3 px-5">Contact Person</th>
                                        <th className="py-3 px-5">Phone</th>
                                        <th className="py-3 px-5">Status</th>
                                        <th className="py-3 px-5 whitespace-nowrap">Date & Time</th>
                                        <th className="py-3 px-5 min-w-[240px]">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-medium text-slate-700 divide-y divide-slate-100">
                                    {groupedCalls.map((group) => (
                                        <React.Fragment key={group.companyName}>
                                            {group.calls.map((call, idx) => {
                                                const hasRemark = call.remarks && call.remarks.trim() && call.remarks !== 'No remarks';
                                                const isFirstOfGroup = idx === 0;

                                                return (
                                                    <tr
                                                        key={call._id}
                                                        className={`hover:bg-slate-50/80 transition-colors ${
                                                            isFirstOfGroup ? 'border-t-2 border-slate-200/80' : ''
                                                        }`}
                                                    >
                                                        {/* Company Column - rendered ONLY ONCE per company with rowSpan */}
                                                        {isFirstOfGroup && (
                                                            <td
                                                                rowSpan={group.calls.length}
                                                                className="py-3.5 px-5 align-top border-r border-slate-100 bg-slate-50/40"
                                                            >
                                                                <div className="sticky top-12">
                                                                    <span className="font-extrabold text-[#0ea5e9] text-sm block leading-snug">
                                                                        {group.companyName}
                                                                    </span>
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200 mt-1.5 shadow-sm">
                                                                        <Briefcase size={10} className="text-[#0ea5e9]" />
                                                                        {group.calls.length} {group.calls.length === 1 ? 'call' : 'calls'}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        )}

                                                        {/* Contact Person */}
                                                        <td className="py-3.5 px-5 align-top">
                                                            <div className="flex items-center gap-1.5 text-xs text-slate-700 font-bold">
                                                                <User size={13} className="text-[#0ea5e9] flex-shrink-0" />
                                                                <span className="truncate">{call.pocName}</span>
                                                            </div>
                                                            {call.designation && call.designation !== 'N/A' && (
                                                                <span className="inline-block text-[10px] text-slate-500 font-medium px-1.5 py-0.5 bg-slate-100 rounded mt-1">
                                                                    {call.designation}
                                                                </span>
                                                            )}
                                                        </td>

                                                        {/* Phone */}
                                                        <td className="py-3.5 px-5 align-top whitespace-nowrap font-semibold text-slate-600">
                                                            {call.phoneNumber || 'N/A'}
                                                        </td>

                                                        {/* Status & Call Device */}
                                                        <td className="py-3.5 px-5 align-top">
                                                            <div className="flex flex-col gap-1 items-start">
                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${getStageBadgeStyle(call.stageAfterCall)}`}>
                                                                    {call.stageAfterCall || 'Contacted'}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                                    {call.callType}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        {/* Date & Time */}
                                                        <td className="py-3.5 px-5 align-top whitespace-nowrap">
                                                            <div className="flex flex-col">
                                                                <span className="text-[11px] font-extrabold text-slate-700">
                                                                    {new Date(call.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-slate-400">
                                                                    {new Date(call.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        {/* Remarks */}
                                                        <td className="py-3.5 px-5 align-top">
                                                            {hasRemark ? (
                                                                <div className="bg-slate-50/90 border border-slate-200/70 rounded-xl p-2.5 max-w-[340px] shadow-sm">
                                                                    <div className="flex items-start gap-1.5">
                                                                        <MessageSquare size={13} className="text-[#0ea5e9] flex-shrink-0 mt-0.5" />
                                                                        <p className="text-xs text-slate-700 font-medium whitespace-pre-line leading-relaxed select-text">
                                                                            {call.remarks}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <span className="inline-flex items-center text-[11px] font-semibold text-slate-400 italic">
                                                                    No remarks
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="h-64 flex flex-col items-center justify-center text-center p-6">
                            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-3 border border-slate-100">
                                <Phone size={22} className="text-slate-300" />
                            </div>
                            <h3 className="text-slate-800 font-extrabold text-base">No matching calls</h3>
                            <p className="text-slate-400 text-xs mt-1 max-w-[280px]">
                                {searchQuery
                                    ? `No calls matching "${searchQuery}".`
                                    : `No call records found with status "${selectedStatus}".`}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-xs text-slate-500 font-medium">
                        Showing <strong className="text-slate-800">{filteredCalls.length}</strong> calls across <strong className="text-slate-800">{groupedCalls.length}</strong> companies
                    </p>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-white border border-slate-200 text-[#0f1c2e] rounded-xl font-bold text-xs hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                    >
                        Close Window
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AgentCallsModal;

