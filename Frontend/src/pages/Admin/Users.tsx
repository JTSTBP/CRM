import React, { useEffect, useState } from 'react';
import { UserPlus, Search, Edit2, Trash2, Shield, Mail, Phone, Clock, MoreVertical, CircleDot, UserX, UserCheck, Calendar } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import UserModal from '../../components/modals/UserModal';
import toast from 'react-hot-toast';

interface User {
    _id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    phone: string;
    personal_email?: string;
    date_of_joining?: string;
    dob?: string;
    reporter?: { _id: string, name: string, role: string };
    created_at: string;
}

const Users: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalLoading, setModalLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [roleFilter, setRoleFilter] = useState('All');
    const [reporterFilter, setReporterFilter] = useState('All');
    const [joinFromDate, setJoinFromDate] = useState('');
    const [joinToDate, setJoinToDate] = useState('');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        const statusParam = searchParams.get('status');
        if (statusParam) {
            setStatusFilter(statusParam);
            setSearchParams({}, { replace: true });
        }
    }, [searchParams]);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/auth/users`, {
                headers: {
                    'x-auth-token': token || ''
                }
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to fetch users');
            }

            const data = await response.json();
            setUsers(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveUser = async (userData: any) => {
        setModalLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const url = editingUser
                ? `${API_BASE_URL}/api/auth/users/${editingUser._id}`
                : `${API_BASE_URL}/api/auth/users`;

            const response = await fetch(url, {
                method: editingUser ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token || ''
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to save user');
            }

            // Refresh list
            await fetchUsers();
            toast.success(editingUser ? 'User updated successfully' : 'User created successfully');
            setIsModalOpen(false);
            setEditingUser(null);
        } catch (err: any) {
            setError(err.message);
            toast.error(err.message || 'Failed to save user');
        } finally {
            setModalLoading(false);
        }
    };

    const handleDeleteUser = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/auth/users/${id}`, {
                method: 'DELETE',
                headers: {
                    'x-auth-token': token || ''
                }
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to delete user');
            }

            setUsers(users.filter(u => u._id !== id));
            toast.success('User deleted successfully');
            setActiveActionMenu(null);
        } catch (err: any) {
            setError(err.message);
            toast.error(err.message || 'Failed to delete user');
        }
    };

    const handleToggleStatus = async (id: string) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/auth/users/${id}/status`, {
                method: 'PATCH',
                headers: {
                    'x-auth-token': token || ''
                }
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to update status');
            }

            const data = await response.json();
            setUsers(users.map(u => u._id === id ? { ...u, status: data.status } : u));
            toast.success(`User status updated to ${data.status}`);
            setActiveActionMenu(null);
        } catch (err: any) {
            setError(err.message);
            toast.error(err.message || 'Failed to update status');
        }
    };

    const filteredUsers = users.filter((user: User) => {
        const matchesSearch = (user.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (user.phone || '').includes(searchTerm);

        const matchesStatus = statusFilter === 'All' || user.status === statusFilter;

        const matchesRole = roleFilter === 'All' || user.role === roleFilter;

        const matchesReporter = reporterFilter === 'All' || user.reporter?._id === reporterFilter;

        const joiningDate = new Date(user.date_of_joining || user.created_at);
        const matchesFrom = !joinFromDate || joiningDate >= new Date(joinFromDate);
        const matchesTo = !joinToDate || joiningDate <= new Date(new Date(joinToDate).setHours(23, 59, 59, 999));

        return matchesSearch && matchesStatus && matchesRole && matchesReporter && matchesFrom && matchesTo;
    }).sort((a, b) => {
        if (a.status === 'Active' && b.status !== 'Active') return -1;
        if (a.status !== 'Active' && b.status === 'Active') return 1;
        return a.name.localeCompare(b.name);
    });

    const uniqueReporters = Array.from(new Set(
        users
            .filter(u => u.role === 'Admin' || u.role === 'Manager')
            .map(u => JSON.stringify({ _id: u._id, name: u.name }))
    )).map(s => JSON.parse(s));

    if (loading && users.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0ea5e9]"></div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col space-y-4 lg:space-y-6 overflow-hidden">
            {/* Header & Toolbar - Non-scrolling */}
            <div className="flex-none bg-[#f8fafc] lg:pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 lg:mb-6">
                    <div className="text-left">
                        <h1 className="text-xl sm:text-2xl font-bold text-[#0f1c2e] tracking-tight">User Management</h1>
                        <p className="text-slate-500 text-xs sm:text-sm mt-1">Manage system access and monitor user activity.</p>
                    </div>
                    <button
                        onClick={() => {
                            setEditingUser(null);
                            setIsModalOpen(true);
                        }}
                        className="flex-none flex items-center justify-center gap-2 bg-[#0ea5e9] hover:bg-[#0284c7] text-white px-4 py-2 sm:py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-sky-500/20 text-xs sm:text-sm"
                    >
                        <UserPlus size={18} className="shrink-0" />
                        <span className="whitespace-nowrap">Add New User</span>
                    </button>
                </div>

                {/* toolbar */}
                <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0ea5e9] transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Search by name, email or phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs sm:text-sm font-medium focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/10 focus:border-[#0ea5e9] transition-all shadow-sm"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <div className="flex-1 sm:flex-none min-w-[140px]">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-600 focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/10 focus:border-[#0ea5e9] transition-all shadow-sm appearance-none"
                            >
                                <option value="All">All Statuses</option>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                        <div className="flex-1 sm:flex-none min-w-[140px]">
                            <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-600 focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/10 focus:border-[#0ea5e9] transition-all shadow-sm appearance-none"
                            >
                                <option value="All">All Roles</option>
                                <option value="Admin">Admin</option>
                                <option value="Manager">Manager</option>
                                <option value="BD Executive">BD Executive</option>
                            </select>
                        </div>
                        <div className="flex-1 sm:flex-none min-w-[160px]">
                            <select
                                value={reporterFilter}
                                onChange={(e) => setReporterFilter(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-600 focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/10 focus:border-[#0ea5e9] transition-all shadow-sm appearance-none"
                            >
                                <option value="All">All Reporters</option>
                                {uniqueReporters.map((reporter: any) => (
                                    <option key={reporter._id} value={reporter._id}>
                                        Reports to: {reporter.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Joining Date Range */}
                        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-[#0ea5e9]/10 focus-within:border-[#0ea5e9] transition-all">
                            <Calendar size={14} className="text-slate-400 shrink-0" />
                            <span className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider shrink-0">Joined From</span>
                            <input
                                type="date"
                                value={joinFromDate}
                                onChange={(e) => setJoinFromDate(e.target.value)}
                                className="bg-transparent text-slate-700 outline-none w-[120px] text-xs font-medium"
                            />
                        </div>
                        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-[#0ea5e9]/10 focus-within:border-[#0ea5e9] transition-all">
                            <Calendar size={14} className="text-slate-400 shrink-0" />
                            <span className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider shrink-0">To</span>
                            <input
                                type="date"
                                value={joinToDate}
                                min={joinFromDate || undefined}
                                onChange={(e) => setJoinToDate(e.target.value)}
                                className="bg-transparent text-slate-700 outline-none w-[120px] text-xs font-medium"
                            />
                        </div>
                        {(joinFromDate || joinToDate) && (
                            <button
                                onClick={() => { setJoinFromDate(''); setJoinToDate(''); }}
                                className="text-[0.65rem] font-bold text-slate-400 hover:text-red-500 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm transition-colors"
                            >
                                Clear
                            </button>
                        )}

                        <button
                            onClick={fetchUsers}
                            className="p-2 sm:p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-[#0ea5e9] transition-colors shadow-sm"
                            title="Refresh List"
                        >
                            <Clock size={18} className="shrink-0" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar space-y-6">
                {error && (
                    <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                        {error}
                    </div>
                )}

                {/* Users List - Mobile & Tablet Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-4">
                    {filteredUsers.length > 0 ? (
                        filteredUsers.map((user, index) => (
                            <div
                                key={user._id}
                                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300"
                                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0ea5e9] to-[#0184c7] flex items-center justify-center text-white font-bold shadow-md">
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-[#0f1c2e]">{user.name}</h3>
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                <Shield size={12} />
                                                {user.role} {user.reporter && <span>(Reports to: {user.reporter.name})</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <button
                                            onClick={() => setActiveActionMenu(activeActionMenu === user._id ? null : user._id)}
                                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                        >
                                            <MoreVertical size={18} className="text-slate-400" />
                                        </button>
                                        {activeActionMenu === user._id && (
                                            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-20 overflow-hidden">
                                                <button
                                                    onClick={() => {
                                                        setEditingUser(user);
                                                        setIsModalOpen(true);
                                                        setActiveActionMenu(null);
                                                    }}
                                                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3"
                                                >
                                                    <Edit2 size={16} /> Edit User
                                                </button>
                                                <button
                                                    onClick={() => handleToggleStatus(user._id)}
                                                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3"
                                                >
                                                    {user.status === 'Active' ? <UserX size={16} className="text-amber-500" /> : <UserCheck size={16} className="text-emerald-500" />}
                                                    {user.status === 'Active' ? 'Disable User' : 'Enable User'}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(user._id)}
                                                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-3"
                                                >
                                                    <Trash2 size={16} /> Delete User
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 py-4 border-t border-slate-50">
                                    <div className="space-y-1">
                                        <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider">Status</p>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6rem] font-bold uppercase tracking-wider border ${user.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                            <CircleDot size={10} /> {user.status}
                                        </span>
                                    </div>
                                    <div className="space-y-1 text-right">
                                        <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider">Joined</p>
                                        <p className="text-xs font-bold text-[#0f1c2e]">{user.date_of_joining ? new Date(user.date_of_joining).toLocaleDateString() : new Date(user.created_at).toLocaleDateString()}</p>
                                    </div>
                                    {user.personal_email && (
                                        <div className="col-span-2 space-y-1 pt-2 border-t border-slate-50/50">
                                            <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider">Personal Email</p>
                                            <p className="text-xs font-bold text-[#0f1c2e] flex items-center gap-2">
                                                <Mail size={12} className="text-slate-300" />
                                                {user.personal_email}
                                            </p>
                                        </div>
                                    )}
                                    {user.dob && (
                                        <div className="col-span-2 space-y-1 pt-2 border-t border-slate-50/50">
                                            <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider">Date of Birth</p>
                                            <p className="text-xs font-bold text-[#0f1c2e] flex items-center gap-2">
                                                <span className="text-[10px]">🎂</span>
                                                {new Date(user.dob).toLocaleDateString()}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 pt-4 border-t border-slate-50 font-bold">
                                    <a href={`mailto:${user.email}`} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-50 rounded-xl text-xs text-slate-600 hover:bg-slate-100 transition-colors">
                                        <Mail size={14} /> Email
                                    </a>
                                    <a href={`tel:${user.phone}`} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-50 rounded-xl text-xs text-slate-600 hover:bg-slate-100 transition-colors">
                                        <Phone size={14} /> Call
                                    </a>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500">
                            No users found matching your search.
                        </div>
                    )}
                </div>

                {/* Users Table - Desktop */}
                <div className="hidden lg:block bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden min-h-[400px]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-20">
                                <tr className="bg-slate-50/90 backdrop-blur-sm border-b border-slate-200/60">
                                    <th className="px-6 py-4 text-[0.75rem] font-bold text-slate-400 uppercase tracking-wider">User</th>
                                    <th className="px-6 py-4 text-[0.75rem] font-bold text-slate-400 uppercase tracking-wider">Personal Email</th>
                                    <th className="px-6 py-4 text-[0.75rem] font-bold text-slate-400 uppercase tracking-wider">Role</th>
                                    <th className="px-6 py-4 text-[0.75rem] font-bold text-slate-400 uppercase tracking-wider">Reports To</th>
                                    <th className="px-6 py-4 text-[0.75rem] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-[0.75rem] font-bold text-slate-400 uppercase tracking-wider">Phone / DOB</th>
                                    <th className="px-6 py-4 text-[0.75rem] font-bold text-slate-400 uppercase tracking-wider">Joining Date</th>
                                    <th className="px-6 py-4 text-[0.75rem] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredUsers.length > 0 ? (
                                    filteredUsers.map((user: User, index: number) => (
                                        <tr
                                            key={user._id}
                                            className="hover:bg-slate-50/50 transition-colors group animate-in fade-in duration-300"
                                            style={{ animationDelay: `${index * 30}ms`, animationFillMode: 'both' }}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#0ea5e9] to-[#0184c7] flex items-center justify-center text-white text-sm font-bold shadow-md">
                                                        {user.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-[#0f1c2e]">{user.name}</span>
                                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                                            <Mail size={12} />
                                                            {user.email}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-semibold text-slate-500">
                                                    {user.personal_email || '—'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                                                    <Shield size={14} className="text-slate-400" />
                                                    {user.role}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-semibold text-slate-500">
                                                    {user.reporter ? user.reporter.name : '—'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.65rem] font-bold uppercase tracking-wider border ${user.status === 'Active'
                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                    : 'bg-amber-50 text-amber-600 border-amber-100'
                                                    }`}>
                                                    <CircleDot size={10} className={user.status === 'Active' ? 'text-emerald-500' : 'text-amber-500'} />
                                                    {user.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-sm font-semibold text-slate-600 flex items-center gap-1.5">
                                                        <Phone size={14} className="text-slate-400" />
                                                        {user.phone || 'N/A'}
                                                    </span>
                                                    {user.dob && (
                                                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 pl-0.5">
                                                            <span>🎂</span>
                                                            {new Date(user.dob).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm font-semibold text-slate-600 flex items-center gap-1.5">
                                                    <Clock size={14} className="text-slate-400" />
                                                    {user.date_of_joining ? new Date(user.date_of_joining).toLocaleDateString() : new Date(user.created_at).toLocaleDateString()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right relative">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditingUser(user);
                                                            setIsModalOpen(true);
                                                        }}
                                                        className="p-2 text-slate-400 hover:text-[#0ea5e9] hover:bg-sky-50 rounded-lg transition-all"
                                                        title="Edit User"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <div className="relative group/menu">
                                                        <button
                                                            onClick={() => setActiveActionMenu(activeActionMenu === user._id ? null : user._id)}
                                                            className="p-2 text-slate-400 hover:text-[#0f1c2e] hover:bg-slate-100 rounded-lg transition-all"
                                                        >
                                                            <MoreVertical size={16} />
                                                        </button>

                                                        {activeActionMenu === user._id && (
                                                            <>
                                                                <div
                                                                    className="fixed inset-0 z-10"
                                                                    onClick={() => setActiveActionMenu(null)}
                                                                ></div>
                                                                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-20 animate-in slide-in-from-top-2 duration-150">
                                                                    <button
                                                                        onClick={() => handleToggleStatus(user._id)}
                                                                        className="w-full px-4 py-2 text-left text-sm font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                                                                    >
                                                                        {user.status === 'Active' ? (
                                                                            <>
                                                                                <UserX size={16} className="text-amber-500" />
                                                                                Disable User
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <UserCheck size={16} className="text-emerald-500" />
                                                                                Enable User
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteUser(user._id)}
                                                                        className="w-full px-4 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                        Delete User
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-medium">
                                            No users found matching your search.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <UserModal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setEditingUser(null);
                    }}
                    onSave={handleSaveUser}
                    user={editingUser}
                    loading={modalLoading}
                    users={users}
                />
            </div>
        </div>
    );
};

export default Users;
