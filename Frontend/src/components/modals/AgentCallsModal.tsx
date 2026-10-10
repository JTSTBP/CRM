import React, { useState, useEffect } from 'react';
import { X, Phone, User, Loader2, Filter } from 'lucide-react';
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

    useEffect(() => {
        if (isOpen && agentId) {
            setSelectedStatus('All');
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

    const filteredCalls = selectedStatus === 'All'
        ? calls
        : calls.filter((call) => call.stageAfterCall === selectedStatus);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="relative bg-white w-full max-w-4xl max-h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-extrabold text-[#0f1c2e] flex items-center gap-2">
                            <Phone className="text-[#0ea5e9]" size={20} />
                            Call Logs: {agentName}
                        </h2>
                        {startDate && endDate && (
                            <p className="text-xs text-slate-500 mt-1 font-medium">
                                Showing calls from <span className="text-slate-800 font-bold">{startDate}</span> to <span className="text-slate-800 font-bold">{endDate}</span>
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {!loading && calls.length > 0 && (
                            <div className="flex items-center gap-2 bg-slate-100/80 px-3 py-1.5 rounded-xl border border-slate-200/50 transition-all hover:bg-slate-100">
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
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-200/60 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
                    {loading ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-3">
                            <Loader2 className="animate-spin text-[#0ea5e9]" size={32} />
                            <p className="text-sm font-bold text-slate-500 animate-pulse uppercase tracking-widest">Fetching call history...</p>
                        </div>
                    ) : filteredCalls.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[700px]">
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase tracking-widest text-slate-400 font-extrabold">
                                        <th className="py-4 px-6">Company & POC</th>
                                        <th className="py-4 px-6">Designation</th>
                                        <th className="py-4 px-6">Phone Number</th>
                                        <th className="py-4 px-6">Call Details</th>
                                        <th className="py-4 px-6">Time</th>
                                        <th className="py-4 px-6">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm font-medium text-slate-700 divide-y divide-slate-100">
                                    {Object.values(filteredCalls.reduce((acc: any, call: any) => {
                                        const key = call.companyName || 'Unknown';
                                        if (!acc[key]) acc[key] = { companyName: key, logs: [] };
                                        acc[key].logs.push(call);
                                        return acc;
                                    }, {})).map((group: any) => (
                                        <tr key={group.companyName} className="hover:bg-slate-50/60 transition-colors group border-b border-slate-50 last:border-0">
                                            <td className="py-4 px-6 align-top">
                                                <span className="font-extrabold text-[#0ea5e9] block mb-4 underline decoration-[#0ea5e9]/30 underline-offset-4">{group.companyName}</span>
                                                <div className="flex flex-col gap-4 mt-2">
                                                    {group.logs.map((call: any, idx: number) => (
                                                        <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-500 font-bold h-8">
                                                            <User size={12} className="text-[#0ea5e9]/40" /> {call.pocName}
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 align-top">
                                                <div className="flex flex-col gap-4 mt-[48px]">
                                                    {group.logs.map((call: any, idx: number) => (
                                                        <div key={idx} className="h-8 flex items-center">
                                                            <span className="text-[10px] font-black px-2 py-1 bg-slate-100 text-slate-500 rounded-md uppercase tracking-wider">
                                                                {call.designation}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 align-top">
                                                <div className="flex flex-col gap-4 mt-[48px]">
                                                    {group.logs.map((call: any, idx: number) => (
                                                        <div key={idx} className="h-8 flex items-center">
                                                            <span className="text-xs font-bold text-slate-500">{call.phoneNumber}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 align-top">
                                                <div className="flex flex-col gap-4 mt-[48px]">
                                                    {group.logs.map((call: any, idx: number) => (
                                                        <div key={idx} className="h-8 flex flex-col justify-center">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-sky-50 text-[10px] font-black text-[#0ea5e9] uppercase tracking-wider w-fit">
                                                                {call.stageAfterCall}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{call.callType}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 align-top">
                                                <div className="flex flex-col gap-4 mt-[48px]">
                                                    {group.logs.map((call: any, idx: number) => (
                                                        <div key={idx} className="h-8 flex flex-col justify-center whitespace-nowrap">
                                                            <span className="text-[11px] font-extrabold text-slate-700">
                                                                {new Date(call.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-slate-400">
                                                                {new Date(call.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 align-top">
                                                <div className="flex flex-col gap-4 mt-[48px]">
                                                    {group.logs.map((call: any, idx: number) => (
                                                        <div key={idx} className="h-8 flex items-center">
                                                            <div className="max-w-[200px]">
                                                                <p className="text-xs text-slate-600 leading-relaxed font-medium line-clamp-2 italic" title={call.remarks}>
                                                                    "{call.remarks}"
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="h-64 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <Phone size={24} className="text-slate-300" />
                            </div>
                            <h3 className="text-slate-800 font-extrabold">No matching calls</h3>
                            <p className="text-slate-400 text-sm mt-1 max-w-[250px]">No call records found with the status "{selectedStatus}".</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-white border border-slate-200 text-[#0f1c2e] rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        Close Window
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AgentCallsModal;
