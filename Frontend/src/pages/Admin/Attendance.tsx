import React, { useEffect, useState } from 'react';
import { Clock, RefreshCw, Trash2, Smartphone, Monitor, ChevronDown, ChevronUp, History, Calendar, LogIn, LogOut, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config';

interface AttendanceSession {
    loginTime: string;
    logoutTime?: string;
    duration?: string;
    isActive: boolean;
    deviceType?: string;
}

interface AttendanceRecord {
    _id: string;
    user?: {
        _id: string;
        name: string;
        email: string;
        role: string;
    };
    user_id?: {
        _id: string;
        name: string;
        email: string;
        role: string;
    };
    date: string;
    totalWorkingHours: string;
    firstLogin: string;
    lastLogout: string;
    status: string;
    sessions: AttendanceSession[];
}

const Attendance: React.FC = () => {
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [fromDate, setFromDate] = useState<string>('');
    const [toDate, setToDate] = useState<string>('');
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [users, setUsers] = useState<any[]>([]);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    const toggleRow = (id: string) => {
        setExpandedRow(expandedRow === id ? null : id);
    };

    const fetchAttendance = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const params = new URLSearchParams();
            if (fromDate) params.append('from', fromDate);
            if (toDate) params.append('to', toDate);
            if (selectedUserId) params.append('user_id', selectedUserId);
            const query = params.toString() ? `?${params.toString()}` : '';
            const url = `${API_BASE_URL}/api/attendance${query}`;
            const res = await fetch(url, {
                headers: { 'x-auth-token': token || '' }
            });
            if (!res.ok) throw new Error('Failed to fetch attendance');
            const data = await res.json();
            setRecords(data);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_BASE_URL}/api/auth/users/list`, {
                    headers: { 'x-auth-token': token || '' }
                });
                if (response.ok) {
                    const data = await response.json();
                    setUsers(data);
                }
            } catch (err) { }
        };
        fetchUsers();
    }, []);

    useEffect(() => {
        fetchAttendance();
    }, [fromDate, toDate, selectedUserId]);

    // UI Helpers
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Present': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'Absent': return 'bg-red-100 text-red-700 border-red-200';
            case 'Half Day': return 'bg-orange-100 text-orange-700 border-orange-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const getInitials = (name: string) => {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    const formatTime12h = (timeStr?: string) => {
        if (!timeStr || timeStr === '--:--') return '--:--';
        const [hours, minutes] = timeStr.split(':');
        const h = parseInt(hours, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const formattedH = h % 12 || 12;
        return `${formattedH}:${minutes} ${ampm}`;
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this record?")) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/attendance/${id}`, {
                method: 'DELETE',
                headers: { 'x-auth-token': token || '' }
            });
            if (!res.ok) throw new Error('Failed to delete record');
            toast.success('Record deleted successfully');
            fetchAttendance();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const handleClearAll = async () => {
        if (!window.confirm("Are you sure you want to clear all attendance records? This action cannot be undone.")) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/attendance`, {
                method: 'DELETE',
                headers: { 'x-auth-token': token || '' }
            });
            if (!res.ok) throw new Error('Failed to clear records');
            toast.success('All records cleared successfully');
            fetchAttendance();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto w-full">
            {/* Header Section */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Attendance Log</h1>
                    <p className="text-slate-500 mt-1 md:text-base text-sm">Monitor daily employee engagement and session durations.</p>
                </div>

                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 items-stretch sm:items-center">
                    {/* From Date */}
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl text-sm border border-slate-200 shadow-sm transition-all focus-within:ring-2 focus-within:border-[#0ea5e9]">
                        <Calendar size={14} className="text-slate-400 shrink-0" />
                        <span className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider shrink-0">From</span>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="bg-transparent text-slate-700 outline-none w-[130px] font-medium text-sm"
                        />
                    </div>

                    {/* To Date */}
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl text-sm border border-slate-200 shadow-sm transition-all focus-within:ring-2 focus-within:border-[#0ea5e9]">
                        <Calendar size={14} className="text-slate-400 shrink-0" />
                        <span className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider shrink-0">To</span>
                        <input
                            type="date"
                            value={toDate}
                            min={fromDate || undefined}
                            onChange={(e) => setToDate(e.target.value)}
                            className="bg-transparent text-slate-700 outline-none w-[130px] font-medium text-sm"
                        />
                    </div>

                    {/* User Filter */}
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl text-sm border border-slate-200 shadow-sm transition-all focus-within:ring-2 focus-within:border-[#0ea5e9]">
                        <Users size={14} className="text-slate-400 shrink-0" />
                        <span className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider shrink-0">User</span>
                        <select
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            className="bg-transparent text-slate-700 outline-none w-full sm:w-[130px] font-medium text-sm border-none shadow-none focus:ring-0 px-1 appearance-none cursor-pointer"
                        >
                            <option value="">All Users</option>
                            {users.map((u) => (
                                <option key={u._id} value={u._id}>{u.name}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="text-slate-400 shrink-0 pointer-events-none -ml-2" />
                    </div>

                    {/* Clear Range */}
                    {(fromDate || toDate || selectedUserId) && (
                        <button
                            onClick={() => { setFromDate(''); setToDate(''); setSelectedUserId(''); }}
                            className="text-xs font-bold text-slate-400 hover:text-red-500 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm transition-colors"
                        >
                            Clear Range
                        </button>
                    )}

                    <div className="flex flex-row items-center gap-3 w-full sm:w-auto">
                        <button
                            onClick={handleClearAll}
                            className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2 bg-red-50/50 border border-red-200 rounded-xl text-red-600 hover:bg-red-50 hover:border-red-300 transition-all font-semibold text-sm shadow-sm"
                        >
                            <Trash2 size={16} />
                            <span>Clear</span>
                        </button>

                        <button
                            onClick={fetchAttendance}
                            disabled={loading}
                            className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2 bg-[#0ea5e9] text-white border border-[#0284c7] rounded-xl hover:bg-[#0284c7] transition-all disabled:opacity-70 font-semibold text-sm shadow-sm"
                        >
                            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="grid grid-cols-1 gap-4 lg:hidden mb-6">
                {loading ? (
                    Array(3).fill(0).map((_, i) => (
                        <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200/60 animate-pulse space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-100"></div>
                                <div className="space-y-2 flex-1">
                                    <div className="h-4 bg-slate-100 rounded w-1/3"></div>
                                    <div className="h-3 bg-slate-50 rounded w-1/4"></div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : records.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 border border-slate-200/60 text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-3">
                            <Clock size={24} className="text-slate-400" />
                        </div>
                        <p className="text-slate-500 font-medium tracking-tight">No attendance records found.</p>
                    </div>
                ) : (
                    records.map((record) => (
                        <div key={record._id} className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm transition-all hover:shadow-md">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#0ea5e9] to-[#3b82f6] text-white flex items-center justify-center font-bold shadow-sm">
                                        {getInitials(record.user?.name || record.user_id?.name || '')}
                                    </div>
                                    <div className="flex flex-col justify-center">
                                        <div className="font-bold text-slate-900">{record.user?.name || record.user_id?.name || 'Unknown User'}</div>
                                        <div className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-400 mt-0.5">{record.user?.role || record.user_id?.role || '---'}</div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                    <span className={`inline-flex items-center px-2 py-0.5 text-[0.6rem] font-bold rounded-full border shadow-sm ${getStatusColor(record.status)}`}>
                                        {record.status}
                                    </span>
                                    <div className="text-[0.65rem] font-bold text-slate-500 border border-slate-100 px-1.5 py-0.5 rounded bg-slate-50">
                                        {new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                    <div className="flex items-center gap-1.5 text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                                        <LogIn size={12} className="text-emerald-500" /> Login
                                    </div>
                                    <div className="text-xs font-bold text-slate-800">{formatTime12h(record.firstLogin)}</div>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                    <div className="flex items-center gap-1.5 text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                                        <LogOut size={12} className="text-orange-500" /> Logout
                                    </div>
                                    <div className="text-xs font-bold text-slate-800">{formatTime12h(record.lastLogout)}</div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100/80 rounded-lg border border-slate-200">
                                    <History size={14} className="text-[#0ea5e9]" />
                                    <span className="text-xs font-bold text-slate-700">{record.totalWorkingHours}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => toggleRow(`mobile-${record._id}`)}
                                        className="text-[0.7rem] font-bold text-[#0ea5e9] bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-100 hover:bg-[#0ea5e9] hover:text-white transition-colors"
                                    >
                                        {expandedRow === `mobile-${record._id}` ? 'Hide Logs' : 'View Logs'}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(record._id)}
                                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            {expandedRow === `mobile-${record._id}` && (
                                <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-3 bg-slate-50 p-2 rounded-lg">
                                        <History size={14} className="text-slate-400" />
                                        Session Logs ({record.sessions?.length || 0})
                                    </h4>
                                    {record.sessions && record.sessions.length > 0 ? (
                                        <div className="space-y-3">
                                            {record.sessions.map((session, idx) => (
                                                <div key={idx} className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-sm">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-1.5 py-0.5 rounded">Sess {idx + 1}</span>
                                                        {session.isActive ? (
                                                            <span className="text-[0.6rem] font-bold text-emerald-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>Active</span>
                                                        ) : (
                                                            <span className="text-[0.6rem] font-bold text-slate-400">Closed</span>
                                                        )}
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs mb-1">
                                                        <span className="text-slate-500 font-medium">In:</span>
                                                        <span className="font-bold text-slate-800">{formatTime12h(session.loginTime)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs mb-2">
                                                        <span className="text-slate-500 font-medium">Out:</span>
                                                        <span className="font-bold text-slate-800">{formatTime12h(session.logoutTime)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-[0.65rem]">
                                                        <span className="text-slate-400 flex items-center gap-1 font-bold">
                                                            {session.deviceType === 'Phone' ? <Smartphone size={10} /> : <Monitor size={10} />} {session.deviceType || 'Unknown'}
                                                        </span>
                                                        <span className="font-bold text-[#0ea5e9] bg-sky-50 border border-sky-100 px-1.5 py-0.5 rounded">{session.duration || '0h 0m'}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center text-slate-400 text-xs py-2 bg-slate-50 rounded-lg">No session logs captured.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Desktop Table Section */}
            <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left min-w-[1000px] border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200">
                                <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest w-12 text-center">Info</th>
                                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Employee</th>
                                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Date</th>
                                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Logins</th>
                                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Duration</th>
                                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center">
                                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 mb-3">
                                            <RefreshCw size={20} className="text-slate-400 animate-spin" />
                                        </div>
                                        <p className="text-slate-500 font-medium">Fetching attendance records...</p>
                                    </td>
                                </tr>
                            ) : records.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center">
                                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-3">
                                            <Clock size={24} className="text-slate-400" />
                                        </div>
                                        <p className="text-slate-500 font-medium tracking-tight">No attendance records found for this period.</p>
                                    </td>
                                </tr>
                            ) : (
                                records.map((record) => (
                                    <React.Fragment key={record._id}>
                                        <tr className={`transition-all hover:bg-slate-50/40 ${expandedRow === record._id ? 'bg-slate-50/80' : ''}`}>
                                            <td className="py-5 px-4 text-center border-l-2 border-transparent">
                                                <button
                                                    onClick={() => toggleRow(record._id)}
                                                    className="inline-flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors focus:outline-none"
                                                >
                                                    {expandedRow === record._id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                </button>
                                            </td>

                                            <td className="py-5 px-6 whitespace-nowrap">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#0ea5e9] to-[#3b82f6] text-white flex items-center justify-center font-bold shadow-sm">
                                                        {getInitials(record.user?.name || record.user_id?.name || '')}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-900">{record.user?.name || record.user_id?.name || 'Unknown User'}</div>
                                                        <div className="text-xs font-medium text-slate-400 mt-0.5">{record.user?.role || record.user_id?.role || '---'}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="py-5 px-6 whitespace-nowrap">
                                                <div className="text-sm font-semibold text-slate-700">
                                                    {new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </div>
                                                <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                                                    {record.sessions && record.sessions.length > 0 && record.sessions[0].deviceType === 'Phone' ? (
                                                        <span className="flex items-center gap-1"><Smartphone size={12} /> Mobile Auth</span>
                                                    ) : (
                                                        <span className="flex items-center gap-1"><Monitor size={12} /> Desktop Auth</span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="py-5 px-6 whitespace-nowrap">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                                        <LogIn size={14} className="text-emerald-500" />
                                                        <span className="font-medium">{formatTime12h(record.firstLogin)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                                        <LogOut size={14} className="text-orange-500" />
                                                        <span className="font-medium">{formatTime12h(record.lastLogout)}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="py-5 px-6 whitespace-nowrap">
                                                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 rounded-lg border border-slate-200 shadow-sm">
                                                    <History size={15} className="text-[#0ea5e9]" />
                                                    <span className="font-bold text-slate-700">{record.totalWorkingHours}</span>
                                                </div>
                                            </td>

                                            <td className="py-5 px-6 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-full border shadow-sm ${getStatusColor(record.status)}`}>
                                                    {record.status === 'Present' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>}
                                                    {record.status === 'Absent' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>}
                                                    {record.status === 'Half Day' && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-1.5"></span>}
                                                    {record.status}
                                                </span>
                                            </td>

                                            <td className="py-5 px-6 whitespace-nowrap text-right">
                                                <button
                                                    onClick={() => handleDelete(record._id)}
                                                    className="inline-flex items-center justify-center w-8 h-8 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                    title="Delete Record"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>

                                        {/* Expanded Row Content */}
                                        {expandedRow === record._id && (
                                            <tr>
                                                <td colSpan={7} className="p-0 border-b-2 border-slate-100">
                                                    <div className="bg-slate-50/80 px-4 md:px-12 py-6 border-y border-slate-200/50 shadow-inner">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                                                <History size={16} className="text-slate-400" />
                                                                Session History <span className="text-xs font-semibold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">{record.sessions?.length || 0}</span>
                                                            </h4>
                                                        </div>

                                                        {record.sessions && record.sessions.length > 0 ? (
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                                {record.sessions.map((session, idx) => (
                                                                    <div key={idx} className="bg-white border text-left border-slate-200/80 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                                                        <div className="flex justify-between items-start mb-4">
                                                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">Session {idx + 1}</span>
                                                                            {session.isActive ? (
                                                                                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                                                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">Closed</span>
                                                                            )}
                                                                        </div>

                                                                        <div className="space-y-3">
                                                                            <div className="flex items-center justify-between text-sm">
                                                                                <div className="flex items-center gap-2 text-slate-500 font-medium">
                                                                                    <LogIn size={14} className="text-slate-400" /> Login
                                                                                </div>
                                                                                <span className="font-bold text-slate-800">{formatTime12h(session.loginTime)}</span>
                                                                            </div>

                                                                            <div className="flex items-center justify-between text-sm">
                                                                                <div className="flex items-center gap-2 text-slate-500 font-medium">
                                                                                    <LogOut size={14} className="text-slate-400" /> Logout
                                                                                </div>
                                                                                <span className="font-bold text-slate-800">{formatTime12h(session.logoutTime)}</span>
                                                                            </div>
                                                                        </div>

                                                                        <div className="mt-4 pt-3 border-t border-slate-100/80 flex items-center justify-between">
                                                                            <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                                                                                {session.deviceType === 'Phone' ? <Smartphone size={12} /> : <Monitor size={12} />}
                                                                                {session.deviceType || 'Unknown'}
                                                                            </span>
                                                                            <span className="text-sm font-bold text-[#0ea5e9] bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-100">{session.duration || '0h 0m'}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="bg-white border rounded-lg p-6 text-center text-slate-400 text-sm">
                                                                No detailed session logs captured for this record.
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Attendance;
