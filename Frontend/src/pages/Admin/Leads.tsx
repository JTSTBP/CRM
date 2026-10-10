import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, Plus, Upload, Edit2, Trash2, AlertCircle, Briefcase, Calendar, ChevronLeft, ChevronRight, Globe, Users, RefreshCw, LayoutPanelTop, ChevronDown, User, ExternalLink, Square, CheckSquare, X, Check, UserCheck } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import toast from 'react-hot-toast';
import LeadModal from '../../components/modals/LeadModal';
import BulkUploadLeadModal from '../../components/modals/BulkUploadLeadModal';
import PipelineModal from '../../components/modals/PipelineModal';

interface PointOfContact {
    _id?: string;
    name: string;
    designation: string;
    phone: string;
    email: string;
    approvalStatus?: 'pending' | 'approved';
}

interface Lead {
    _id: string;
    company_name: string;
    company_email: string;
    website_url: string;
    company_size: string;
    industry_name: string;
    stage: string;
    points_of_contact: PointOfContact[];
    assignedBy: {
        _id: string;
        name: string;
    };
    created_at: string;
    createdAt: string;
}

const STAGES = ["New", "Contacted", "Proposal Sent", "Negotiation", "Won", "Lost", "Onboarded", "No vendor", "Future Reference"];
const POC_STAGES = ["New", "Contacted", "Busy", "No Answer", "Wrong Number"];

const Leads: React.FC = () => {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalLeads, setTotalLeads] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedTerm, setDebouncedTerm] = useState('');
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create'>('view');
    const [showFilters, setShowFilters] = useState(true);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [users, setUsers] = useState<any[]>([]);

    const [isBulkAssignModalOpen, setIsBulkAssignModalOpen] = useState(false);
    const [selectedBulkAssignees, setSelectedBulkAssignees] = useState<string[]>([]);
    const [bulkUserSearch, setBulkUserSearch] = useState('');

    // Determine permissions (only Admins & Managers can reassign inline)
    const currentUserRole = JSON.parse(localStorage.getItem('user') || '{}')?.role;
    const canReassign = currentUserRole === 'Admin' || currentUserRole === 'Manager';

    // Filter States
    const [filters, setFilters] = useState({
        leadStage: '',
        pocStage: '',
        assignedBy: '',
        startDate: '',
        endDate: ''
    });

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isAllSelectedGlobal, setIsAllSelectedGlobal] = useState(false);
    const [bulkAssignee, setBulkAssignee] = useState<string>('');
    const [bulkStage, setBulkStage] = useState<string>('');

    // Bucket state
    const [isBucketModalOpen, setIsBucketModalOpen] = useState(false);
    const [bucketCount, setBucketCount] = useState(0);

    // Handle push notification deep-links: ?openLead=<id>&tab=tasks
    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        const openLeadId = searchParams.get('openLead');
        if (openLeadId) {
            setSelectedLeadId(openLeadId);
            setModalMode('view');
            setIsModalOpen(true);
            // Clean URL so refreshing doesn't reopen the modal
            setSearchParams({}, { replace: true });
        }

        const stageParam = searchParams.get('stage');
        if (stageParam && STAGES.includes(stageParam)) {
            setFilters(prev => ({ ...prev, leadStage: stageParam }));
            // Clean URL
            setSearchParams({}, { replace: true });
        }
    }, [searchParams]);

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedTerm(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset selection when page or search changes
    useEffect(() => {
        setSelectedIds([]);
        setIsAllSelectedGlobal(false);
    }, [page, debouncedTerm, filters]);

    useEffect(() => {
        fetchLeads();
    }, [page, debouncedTerm, filters]);

    useEffect(() => {
        fetchUsers();
        fetchBucketCount();
    }, []);

    const fetchBucketCount = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/poc-bucket`, {
                headers: { 'x-auth-token': token || '' }
            });
            if (response.ok) {
                const data = await response.json();
                setBucketCount(data.length);
            }
        } catch (err) { }
    };

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

    const fetchLeads = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            // Construct query params
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '10',
                search: debouncedTerm
            });

            if (filters.leadStage) params.append('leadStage', filters.leadStage);
            if (filters.pocStage) params.append('pocStage', filters.pocStage);
            if (filters.assignedBy) params.append('assignedBy', filters.assignedBy);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);

            const response = await fetch(`${API_BASE_URL}/api/leads?${params.toString()}`, {
                headers: {
                    'x-auth-token': token || ''
                }
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to fetch leads');
            }

            const data = await response.json();
            setLeads(data.leads);
            setTotalPages(data.totalPages);
            setTotalLeads(data.totalLeads);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (id: string, mode: 'view' | 'edit' | 'create' = 'view') => {
        setSelectedLeadId(id === 'new' ? null : id);
        setModalMode(mode);
        setIsModalOpen(true);
    };

    const handleDeleteLead = async (id: string, companyName: string) => {
        if (!window.confirm(`Are you sure you want to delete lead for "${companyName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/leads/${id}`, {
                method: 'DELETE',
                headers: {
                    'x-auth-token': token || ''
                }
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to delete lead');
            }

            toast.success('Lead deleted successfully');
            setSelectedIds(prev => prev.filter(item => item !== id));
            fetchLeads();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleBulkDelete = async () => {
        const count = isAllSelectedGlobal ? totalLeads : selectedIds.length;
        if (!window.confirm(`Are you sure you want to delete ${count} selected leads? This action cannot be undone.`)) {
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/leads/bulk/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token || ''
                },
                body: JSON.stringify({
                    ids: selectedIds,
                    isAllGlobal: isAllSelectedGlobal,
                    filters: {
                        search: debouncedTerm,
                        ...filters
                    }
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Bulk delete failed');
            }

            const data = await response.json();
            toast.success(data.message);
            setSelectedIds([]);
            setIsAllSelectedGlobal(false);
            fetchLeads();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getStageColor = (stage: string) => {
        switch (stage) {
            case 'New': return 'bg-blue-50 text-blue-600 border-blue-100';
            case 'Contacted': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
            case 'Won': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'Lost': return 'bg-rose-50 text-rose-600 border-rose-100';
            case 'Negotiation': return 'bg-amber-50 text-amber-600 border-amber-100';
            default: return 'bg-slate-50 text-slate-600 border-slate-100';
        }
    };

    const toggleSelectAllPage = () => {
        if (selectedIds.length === leads.length) {
            setSelectedIds([]);
            setIsAllSelectedGlobal(false);
        } else {
            setSelectedIds(leads.map(l => l._id));
        }
    };

    const toggleSelectId = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
        setIsAllSelectedGlobal(false);
    };

    const isPageSelected = leads.length > 0 && selectedIds.length === leads.length;

    const handleBulkUpdate = async (updates: any) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/leads/bulk/update`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token || ''
                },
                body: JSON.stringify({
                    ids: selectedIds,
                    isAllGlobal: isAllSelectedGlobal,
                    filters: {
                        search: debouncedTerm,
                        ...filters
                    },
                    updates
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Bulk update failed');
            }

            const data = await response.json();
            toast.success(data.message);
            setSelectedIds([]);
            setIsAllSelectedGlobal(false);
            setBulkAssignee('');
            setBulkStage('');
            fetchLeads();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDirectAssigneeChange = async (leadId: string, newAssigneeId: string) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/leads/${leadId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token || ''
                },
                body: JSON.stringify({ assignedBy: newAssigneeId })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to reassign lead');
            }

            toast.success('Lead reassigned successfully');
            fetchLeads();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full overflow-y-auto pr-1 -mr-1 custom-scrollbar pb-20 sm:pb-10">
            <div className="flex flex-col space-y-4 lg:space-y-6 min-h-full">
                <div className="bg-[#f8fafc] lg:pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 lg:mb-6">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0f1c2e] tracking-tight">Company Details</h1>
                            <p className="text-sm text-slate-500 mt-1">Manage and track your business prospects.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <button
                                onClick={fetchLeads}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                            >
                                <RefreshCw size={18} className={loading && leads.length === 0 ? 'animate-spin' : ''} />
                                <span className="hidden sm:inline">Refresh</span>
                            </button>
                            <button
                                onClick={() => setIsBulkModalOpen(true)}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                            >
                                <Upload size={18} />
                                <span className="hidden sm:inline">Bulk Upload</span>
                            </button>
                            <button
                                onClick={() => setIsBucketModalOpen(true)}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-amber-500 hover:bg-amber-50 transition-all shadow-sm relative"
                                title="View Pipeline"
                            >
                                <LayoutPanelTop size={18} />
                                <span className="hidden sm:inline">Pipeline</span>
                                {bucketCount > 0 && (
                                    <span className="absolute -top-2 -right-2 w-5 h-5 bg-amber-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-bounce">
                                        {bucketCount}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => handleOpenModal('new', 'create')}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#0ea5e9] text-white px-5 py-2.5 rounded-xl font-bold transition-all hover:bg-[#0284c7] shadow-lg shadow-sky-500/20 text-sm"
                            >
                                <Plus size={20} />
                                <span>Add Company</span>
                            </button>
                        </div>
                    </div>

                    {/* Toolbar */}
                    <div className="flex flex-col lg:flex-row gap-4">
                        <form onSubmit={(e) => e.preventDefault()} className="relative flex-1 group">
                            <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${loading ? 'text-[#0ea5e9]' : 'text-slate-400 group-focus-within:text-[#0ea5e9]'}`} size={18} />
                            <input
                                type="text"
                                placeholder="Search company or domain..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-11 pr-10 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/5 focus:border-[#0ea5e9] transition-all shadow-sm"
                            />
                            {loading && leads.length > 0 && (
                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                                    <div className="w-5 h-5 border-2 border-[#0ea5e9]/20 border-t-[#0ea5e9] rounded-full animate-spin"></div>
                                </div>
                            )}
                            {!loading && searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 transition-colors bg-white p-0.5 rounded-md"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </form>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all border whitespace-nowrap shadow-sm ${showFilters
                                    ? 'bg-sky-50 border-sky-100 text-[#0ea5e9]'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                <Filter size={18} />
                                Filters
                                {(filters.leadStage || filters.pocStage || filters.assignedBy || filters.startDate || filters.endDate) && (
                                    <div className="flex items-center justify-center w-4 h-4 bg-rose-500 text-white rounded-full text-[10px]">
                                        !
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Scrollable Content Area */}
                <div className="flex-1 flex flex-col space-y-6">

                    {/* Filter Bar */}
                    {showFilters && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm animate-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-2 mb-4">
                                <Filter size={16} className="text-[#0ea5e9]" />
                                <h2 className="text-xs font-bold text-[#0f1c2e] uppercase tracking-wider">Advanced Filters</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider ml-1">Lead Stage</label>
                                    <div className="relative">
                                        <select
                                            value={filters.leadStage}
                                            onChange={(e) => setFilters({ ...filters, leadStage: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-[#0f1c2e] focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/10 appearance-none cursor-pointer"
                                        >
                                            <option value="">All Stages</option>
                                            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider ml-1">POC Stage</label>
                                    <div className="relative">
                                        <select
                                            value={filters.pocStage}
                                            onChange={(e) => setFilters({ ...filters, pocStage: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-[#0f1c2e] focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/10 appearance-none cursor-pointer"
                                        >
                                            <option value="">All Statuses</option>
                                            {POC_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    </div>
                                </div>

                                {currentUserRole !== 'BD Executive' && (
                                    <div className="space-y-1.5">
                                        <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider ml-1">Assigned To</label>
                                        <div className="relative">
                                            <select
                                                value={filters.assignedBy}
                                                onChange={(e) => setFilters({ ...filters, assignedBy: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-[#0f1c2e] focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/10 appearance-none cursor-pointer"
                                            >
                                                <option value="">All Users</option>
                                                {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider ml-1">Added From</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input
                                            type="date"
                                            value={filters.startDate}
                                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-[#0f1c2e] focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/10"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider ml-1">Added To</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input
                                            type="date"
                                            value={filters.endDate}
                                            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-[#0f1c2e] focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/10"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Table */}
                    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden min-h-[500px] flex flex-col relative">
                        {/* Select All Global Banner */}
                        {selectedIds.length === leads.length && leads.length < totalLeads && (
                            <div className={`p-2.5 flex items-center justify-center gap-4 text-xs font-bold transition-all ${isAllSelectedGlobal ? 'bg-sky-500 text-white' : 'bg-sky-50 text-[#0ea5e9] border-b border-sky-100'}`}>
                                <div className="flex items-center gap-2">
                                    <AlertCircle size={14} />
                                    {isAllSelectedGlobal
                                        ? `All ${totalLeads} leads in this view are selected.`
                                        : `All ${leads.length} leads on this page are selected.`
                                    }
                                </div>
                                {!isAllSelectedGlobal && (
                                    <button
                                        onClick={() => setIsAllSelectedGlobal(true)}
                                        className="underline decoration-2 underline-offset-4 hover:text-[#0284c7]"
                                    >
                                        Select all {totalLeads} leads
                                    </button>
                                )}
                                {isAllSelectedGlobal && (
                                    <button
                                        onClick={() => {
                                            setSelectedIds([]);
                                            setIsAllSelectedGlobal(false);
                                        }}
                                        className="underline decoration-2 underline-offset-4 hover:text-white/80"
                                    >
                                        Clear Selection
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Card View for Mobile */}
                        <div className="grid grid-cols-1 gap-4 p-4 lg:hidden">
                            {loading && leads.length === 0 ? (
                                Array(5).fill(0).map((_, i) => (
                                    <div key={i} className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 animate-pulse space-y-4">
                                        <div className="flex gap-3">
                                            <div className="w-12 h-12 bg-slate-200 rounded-xl"></div>
                                            <div className="flex-1 space-y-2">
                                                <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                                                <div className="h-3 bg-slate-100 rounded w-3/4"></div>
                                            </div>
                                        </div>
                                        <div className="flex justify-between border-t border-slate-100 pt-3">
                                            <div className="h-6 bg-slate-200 rounded-full w-20"></div>
                                            <div className="h-6 bg-slate-200 rounded-lg w-20"></div>
                                        </div>
                                    </div>
                                ))
                            ) : leads.length > 0 ? (
                                leads.map((lead, index) => (
                                    <div
                                        key={lead._id}
                                        className={`bg-white rounded-2xl p-5 border shadow-sm transition-all active:scale-95 cursor-pointer relative overflow-hidden group animate-in fade-in slide-in-from-bottom-4 duration-300 ${selectedIds.includes(lead._id) ? 'border-[#0ea5e9] bg-sky-50/20' : 'border-slate-100'}`}
                                        style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                                        onClick={() => handleOpenModal(lead._id)}
                                    >
                                        <div className="flex items-start justify-between gap-4 mb-4">
                                            <div className="flex gap-4">
                                                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-[#0ea5e9] border border-slate-100 shadow-sm transition-transform group-hover:scale-110">
                                                    <Briefcase size={22} />
                                                </div>
                                                <div>
                                                    <h3 className="text-base font-extrabold text-[#0f1c2e] line-clamp-1">{lead.company_name}</h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {lead.website_url && (
                                                            <a
                                                                href={lead.website_url.startsWith('http') ? lead.website_url : `https://${lead.website_url}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-[0.65rem] font-bold text-[#0ea5e9] underline decoration-[#0ea5e9]/30 underline-offset-4 flex items-center gap-1 overflow-hidden"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <Globe size={11} className="shrink-0" />
                                                                <span className="truncate">{lead.website_url}</span>
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleSelectId(lead._id);
                                                }}
                                                className={`transition-colors p-1 ${selectedIds.includes(lead._id) ? 'text-[#0ea5e9]' : 'text-slate-200'}`}
                                            >
                                                {selectedIds.includes(lead._id) ? <CheckSquare size={22} /> : <Square size={22} />}
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 mb-5">
                                            <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 shadow-sm">
                                                <p className="text-[0.55rem] font-bold text-slate-400 uppercase tracking-widest mb-1">Lead Stage</p>
                                                <span className={`inline-flex px-2 py-0.5 rounded-lg text-[0.6rem] font-bold border ${getStageColor(lead.stage)}`}>
                                                    {lead.stage}
                                                </span>
                                            </div>
                                            {lead.company_size && (
                                                <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 shadow-sm">
                                                    <p className="text-[0.55rem] font-bold text-slate-400 uppercase tracking-widest mb-1">Company Size</p>
                                                    <div className="flex items-center gap-1.5 text-[0.65rem] font-extrabold text-slate-600">
                                                        <Users size={12} className="text-[#0ea5e9]" />
                                                        {lead.company_size}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100">
                                            <div className="flex -space-x-2 self-start sm:self-auto">
                                                {/* Simplified visual indicator for POCs */}
                                                <div className="w-7 h-7 rounded-full bg-emerald-50 border-2 border-white flex items-center justify-center text-emerald-600 text-[0.6rem] font-bold shadow-sm" title="Approved POCs">
                                                    {lead.points_of_contact?.filter((p: any) => p.approvalStatus !== 'pending').length || 0}
                                                </div>
                                                <div className="w-7 h-7 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-slate-400 shadow-sm" title={`Assigned to ${lead.assignedBy?.name || 'Unassigned'}`}>
                                                    <User size={12} />
                                                </div>
                                            </div>

                                            {/* Inline Mobile Dropdown */}
                                            <div className="flex-1 w-full sm:w-auto sm:mx-3" onClick={(e) => canReassign ? e.stopPropagation() : undefined}>
                                                {canReassign ? (
                                                    <select
                                                        value={lead.assignedBy?._id || ''}
                                                        onChange={(e) => handleDirectAssigneeChange(lead._id, e.target.value)}
                                                        className="w-full max-w-[120px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[0.65rem] font-bold text-[#0f1c2e] focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/20 transition-all hover:border-[#0ea5e9]/50"
                                                    >
                                                        <option value="">Unassigned</option>
                                                        {users.map(u => (
                                                            <option key={u._id} value={u._id}>{u.name}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <div className="flex flex-col">
                                                        <span className="text-[0.55rem] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Assigned To</span>
                                                        <span className="text-[0.65rem] font-extrabold text-[#0f1c2e]">{lead.assignedBy?.name || 'Unassigned'}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-1.5 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenModal(lead._id, 'edit');
                                                    }}
                                                    className="p-2.5 bg-sky-50 text-[#0ea5e9] rounded-xl hover:bg-[#0ea5e9] hover:text-white transition-all shadow-sm"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteLead(lead._id, lead.company_name);
                                                    }}
                                                    className="p-2.5 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-20 text-center">
                                    <div className="p-4 bg-slate-50 inline-block rounded-full mb-3">
                                        <Briefcase size={32} className="text-slate-200" />
                                    </div>
                                    <p className="text-slate-400 font-bold text-sm">No results found.</p>
                                </div>
                            )}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden lg:block overflow-x-auto flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-20">
                                    <tr className="bg-slate-50/50 border-b border-slate-200/60">
                                        <th className="px-6 py-4 w-12">
                                            <button
                                                onClick={toggleSelectAllPage}
                                                className={`transition-colors ${isPageSelected ? 'text-[#0ea5e9]' : 'text-slate-300 hover:text-slate-400'}`}
                                            >
                                                {isPageSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                            </button>
                                        </th>
                                        <th className="px-6 py-4 text-[0.75rem] font-bold text-slate-400 uppercase tracking-wider">Company</th>
                                        <th className="px-6 py-4 text-[0.75rem] font-bold text-slate-400 uppercase tracking-wider">POC Details</th>
                                        <th className="px-6 py-4 text-[0.75rem] font-bold text-slate-400 uppercase tracking-wider">Information</th>
                                        <th className="px-6 py-4 text-[0.75rem] font-bold text-slate-400 uppercase tracking-wider">Stage</th>
                                        <th className="px-6 py-4 text-[0.75rem] font-bold text-slate-400 uppercase tracking-wider">Assigned By</th>
                                        <th className="px-6 py-4 text-[0.75rem] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-4 text-[0.75rem] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 relative">
                                    {/* Loading Overlay */}
                                    {loading && leads.length > 0 && (
                                        <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] flex items-center justify-center transition-all">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-10 h-10 border-4 border-[#0ea5e9]/20 border-t-[#0ea5e9] rounded-full animate-spin"></div>
                                                <span className="text-[0.65rem] font-extrabold text-[#0ea5e9] uppercase tracking-[0.2em] animate-pulse">Synchronizing...</span>
                                            </div>
                                        </div>
                                    )}

                                    {loading && leads.length === 0 ? (
                                        Array(8).fill(0).map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td className="px-6 py-4"><div className="w-6 h-6 bg-slate-100 rounded"></div></td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-slate-100"></div>
                                                        <div className="space-y-2">
                                                            <div className="h-4 bg-slate-100 rounded w-24"></div>
                                                            <div className="h-3 bg-slate-50 rounded w-32"></div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="space-y-2">
                                                        <div className="h-3 bg-slate-100 rounded w-20"></div>
                                                        <div className="h-3 bg-slate-50 rounded w-24"></div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="space-y-2">
                                                        <div className="h-3 bg-slate-100 rounded w-28"></div>
                                                        <div className="h-3 bg-slate-50 rounded w-32"></div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4"><div className="h-6 bg-slate-100 rounded-full w-20"></div></td>
                                                <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                                                <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-20"></div></td>
                                                <td className="px-6 py-4 text-right"><div className="h-8 bg-slate-100 rounded-lg w-8 ml-auto"></div></td>
                                            </tr>
                                        ))
                                    ) : leads.length > 0 ? (
                                        leads.map((lead) => (
                                            <tr
                                                key={lead._id}
                                                className={`hover:bg-slate-50/50 transition-colors group cursor-pointer ${selectedIds.includes(lead._id) ? 'bg-sky-50/30' : ''}`}
                                                onClick={() => handleOpenModal(lead._id)}
                                            >
                                                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => toggleSelectId(lead._id)}
                                                        className={`transition-colors ${selectedIds.includes(lead._id) ? 'text-[#0ea5e9]' : 'text-slate-200 group-hover:text-slate-300'}`}
                                                    >
                                                        {selectedIds.includes(lead._id) ? <CheckSquare size={18} /> : <Square size={18} />}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-[#0f1c2e] font-bold border border-slate-200 shadow-sm group-hover:scale-110 transition-transform">
                                                            <Briefcase size={20} className="text-[#0ea5e9]" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-[#0f1c2e] group-hover:text-[#0ea5e9] transition-colors truncate max-w-[200px]">{lead.company_name}</span>
                                                            <a
                                                                href={lead.website_url ? (lead.website_url.startsWith('http') ? lead.website_url : `https://${lead.website_url}`) : undefined}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-[0.65rem] text-slate-400 hover:text-[#0ea5e9] hover:underline flex items-center gap-1 transition-colors overflow-hidden"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <Globe size={11} className="shrink-0" />
                                                                <span className="truncate max-w-[200px]">{lead.website_url}</span>
                                                            </a>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1.5">
                                                        {(lead.points_of_contact || [])
                                                            .filter((p: any) => p.approvalStatus !== 'pending')
                                                            .slice(0, 3)
                                                            .map((poc: any, idx: number) => (
                                                                <div key={idx} className="flex flex-col">
                                                                    <span className="text-[0.7rem] font-bold text-[#0f1c2e]">{poc.name}</span>
                                                                    <div className="flex items-center gap-2">
                                                                        <a
                                                                            href={`tel:${poc.phone}`}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className="text-[0.6rem] font-bold text-[#0ea5e9] hover:underline"
                                                                        >
                                                                            {poc.phone}
                                                                        </a>
                                                                        {poc.email && (
                                                                            <span className="text-[0.6rem] text-slate-300">|</span>
                                                                        )}
                                                                        {poc.email && (
                                                                            <a
                                                                                href={`https://jobsterritory.in/email-action/${poc.email}`}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                className="text-[0.6rem] font-bold text-slate-400 hover:text-[#0ea5e9] hover:underline truncate max-w-[100px]"
                                                                                title={poc.email}
                                                                            >
                                                                                {poc.email}
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        {lead.points_of_contact?.filter((p: any) => p.approvalStatus !== 'pending').length > 3 && (
                                                            <span className="text-[0.6rem] font-bold text-slate-400 italic">
                                                                + {lead.points_of_contact.filter((p: any) => p.approvalStatus !== 'pending').length - 3} more contacts
                                                            </span>
                                                        )}
                                                        {lead.points_of_contact?.filter((p: any) => p.approvalStatus !== 'pending').length === 0 && (
                                                            <span className="text-[0.65rem] text-slate-400 italic font-medium">No approved POCs</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1.5">
                                                        {lead.company_size && (
                                                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                                                                <Users size={12} className="text-[#0ea5e9]" />
                                                                {lead.company_size} Employees
                                                            </div>
                                                        )}
                                                        <div className="text-[0.65rem] text-slate-400 font-semibold tracking-wide uppercase italic">
                                                            {lead.industry_name || 'General Industry'}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-[0.65rem] font-bold uppercase tracking-wider border shadow-sm ${getStageColor(lead.stage)}`}>
                                                        {lead.stage}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-xs font-bold text-[#0f1c2e]" onClick={(e) => canReassign ? e.stopPropagation() : undefined}>
                                                    {canReassign ? (
                                                        <select
                                                            value={lead.assignedBy?._id || ''}
                                                            onChange={(e) => handleDirectAssigneeChange(lead._id, e.target.value)}
                                                            className="w-full max-w-[140px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-[#0f1c2e] focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/20 transition-all hover:border-[#0ea5e9]/50"
                                                        >
                                                            <option value="">Unassigned</option>
                                                            {users.map(u => (
                                                                <option key={u._id} value={u._id}>{u.name}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <span className="text-xs font-bold text-[#0f1c2e]">{lead.assignedBy?.name || 'Unassigned'}</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-xs font-bold text-slate-400">
                                                    {new Date(lead.created_at || lead.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenModal(lead._id, 'view');
                                                            }}
                                                            className="p-2 text-slate-400 hover:text-[#0ea5e9] hover:bg-sky-50 rounded-lg transition-all"
                                                        >
                                                            <ExternalLink size={18} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenModal(lead._id, 'edit');
                                                            }}
                                                            className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteLead(lead._id, lead.company_name);
                                                            }}
                                                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan={7} className="text-center py-20 text-slate-400 font-bold">No results found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="p-6 border-t border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="text-xs font-bold text-slate-400 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                                <span>Showing <span className="text-[#0f1c2e]">{leads.length}</span> of <span className="text-[#0f1c2e]">{totalLeads}</span> leads</span>
                                <span className="hidden sm:inline mx-2 text-slate-300">|</span>
                                <span>Page</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={totalPages}
                                    defaultValue={page}
                                    key={page}
                                    onBlur={(e) => {
                                        const val = parseInt(e.target.value);
                                        if (!isNaN(val) && val >= 1 && val <= totalPages && val !== page) setPage(val);
                                        else e.target.value = page.toString();
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const val = parseInt((e.currentTarget).value);
                                            if (!isNaN(val) && val >= 1 && val <= totalPages && val !== page) setPage(val);
                                            else (e.currentTarget).value = page.toString();
                                        }
                                    }}
                                    className="w-12 px-1.5 py-1 text-center border border-slate-200 rounded-md text-[#0f1c2e] font-bold focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/50 bg-slate-50 hover:bg-white transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    title="Type page number and press Enter"
                                />
                                <span>of <span className="text-[#0f1c2e]">{totalPages}</span></span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    disabled={page === 1 || loading}
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    className="p-2 border border-slate-200 rounded-lg text-slate-400 hover:text-[#0ea5e9] hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <button
                                    disabled={page === totalPages || loading}
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    className="p-2 border border-slate-200 rounded-lg text-slate-400 hover:text-[#0ea5e9] hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Bulk Actions Floating Bar */}
                    {selectedIds.length > 0 && (
                        <div className="fixed bottom-6 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto sm:w-auto z-[100] bg-[#0f1c2e] text-white px-4 sm:px-6 py-4 rounded-3xl shadow-2xl border border-slate-700/50 flex flex-col sm:flex-row items-center gap-4 sm:gap-8 animate-in slide-in-from-bottom-10 duration-500 max-h-[80vh] overflow-y-auto">
                            <div className="flex items-center justify-between w-full sm:w-auto sm:pr-8 sm:border-r sm:border-slate-700">
                                <div className="flex items-center gap-3">
                                    <div className="bg-[#0ea5e9] w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-bold text-sm">
                                        {isAllSelectedGlobal ? totalLeads : selectedIds.length}
                                    </div>
                                    <div>
                                        <p className="text-[0.6rem] sm:text-xs font-bold text-slate-300 uppercase tracking-widest leading-none">Selected</p>
                                        <p className="text-[0.55rem] sm:text-[0.65rem] text-slate-500 mt-0.5">
                                            {isAllSelectedGlobal ? 'Across all pages' : 'Current results'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedIds([]);
                                        setIsAllSelectedGlobal(false);
                                    }}
                                    className="sm:hidden text-slate-400 hover:text-white"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 w-full sm:w-auto">
                                <div className="flex-1 min-w-[140px] sm:flex-none flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-2 sm:px-3 py-1.5 focus-within:ring-2 focus-within:ring-[#0ea5e9]/50 transition-all">
                                    <Users size={14} className="text-slate-400 shrink-0" />
                                    <select
                                        value={bulkAssignee}
                                        onChange={(e) => setBulkAssignee(e.target.value)}
                                        className="bg-transparent text-[0.65rem] font-bold focus:outline-none cursor-pointer w-full border-none text-white appearance-none py-1"
                                    >
                                        <option value="" className="bg-[#0f1c2e]">Assignee...</option>
                                        {users.map(u => (
                                            <option key={u._id} value={u._id} className="bg-[#0f1c2e]">
                                                {u.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex-1 min-w-[140px] sm:flex-none flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-2 sm:px-3 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/50 transition-all">
                                    <CheckSquare size={14} className="text-slate-400 shrink-0" />
                                    <select
                                        value={bulkStage}
                                        onChange={(e) => setBulkStage(e.target.value)}
                                        className="bg-transparent text-[0.65rem] font-bold focus:outline-none cursor-pointer w-full border-none text-white appearance-none py-1"
                                    >
                                        <option value="" className="bg-[#0f1c2e]">Stage...</option>
                                        {STAGES.map(s => (
                                            <option key={s} value={s} className="bg-[#0f1c2e]">
                                                {s}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                
                                <button
                                    onClick={() => {
                                        const updates: any = {};
                                        if (bulkAssignee) updates.assignedBy = bulkAssignee;
                                        if (bulkStage) updates.stage = bulkStage;
                                        if (Object.keys(updates).length > 0) {
                                            handleBulkUpdate(updates);
                                        }
                                    }}
                                    disabled={(!bulkAssignee && !bulkStage) || loading}
                                    className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-sky-500/20"
                                >
                                    Save
                                </button>

                                <button
                                    onClick={() => {
                                        setSelectedBulkAssignees([]);
                                        setBulkUserSearch('');
                                        setIsBulkAssignModalOpen(true);
                                    }}
                                    className="flex items-center justify-center gap-2 px-3 py-2 bg-sky-500/10 hover:bg-sky-500/20 text-[#0ea5e9] text-[0.65rem] font-bold rounded-xl transition-colors border border-sky-500/20 flex-1 sm:flex-none"
                                >
                                    <UserCheck size={14} /> <span>Bulk Assign Persons</span>
                                </button>

                                <button
                                    onClick={handleBulkDelete}
                                    disabled={loading}
                                    className="flex items-center justify-center gap-2 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[0.65rem] font-bold rounded-xl transition-colors border border-rose-500/20 flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Trash2 size={14} /> <span className="hidden sm:inline">Delete</span>
                                </button>

                                <button
                                    onClick={() => {
                                        setSelectedIds([]);
                                        setIsAllSelectedGlobal(false);
                                    }}
                                    className="hidden sm:block text-[0.65rem] font-bold text-slate-400 hover:text-white px-3 py-2 transition-colors uppercase tracking-widest"
                                >
                                    Reset
                                </button>
                            </div>
                        </div>
                    )}

                    <LeadModal
                        isOpen={isModalOpen}
                        onClose={() => {
                            setIsModalOpen(false);
                            setSelectedLeadId(null);
                        }}
                        leadId={selectedLeadId}
                        initialMode={modalMode}
                        onUpdate={fetchLeads}
                    />

                    <BulkUploadLeadModal
                        isOpen={isBulkModalOpen}
                        onClose={() => setIsBulkModalOpen(false)}
                        onUploadSuccess={fetchLeads}
                    />
                </div>
                {/* Pipeline Modal */}
                <PipelineModal
                    isOpen={isBucketModalOpen}
                    onClose={() => {
                        setIsBucketModalOpen(false);
                        fetchBucketCount(); // Refresh count when closed
                    }}
                    onUpdate={fetchBucketCount}
                />

                {/* Bulk Assign Persons Modal */}
                {isBulkAssignModalOpen && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div>
                                    <h3 className="text-sm font-black text-[#0f1c2e] uppercase tracking-wider">Bulk Assign Persons</h3>
                                    <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest mt-1">Assign multiple members to selected leads</p>
                                </div>
                                <button onClick={() => setIsBulkAssignModalOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Search & List */}
                            <div className="p-6 flex-1 overflow-y-auto space-y-4 max-h-[400px]">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search employees..."
                                        value={bulkUserSearch}
                                        onChange={(e) => setBulkUserSearch(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs font-bold focus:border-[#0ea5e9] transition-all outline-none"
                                    />
                                </div>

                                <div className="space-y-1.5 max-h-[250px] overflow-y-auto custom-scrollbar">
                                    {users
                                        .filter(u =>
                                            (u.name?.toLowerCase() || '').includes(bulkUserSearch.toLowerCase()) ||
                                            (u.role?.toLowerCase() || '').includes(bulkUserSearch.toLowerCase())
                                        )
                                        .map((u) => {
                                            const isChecked = selectedBulkAssignees.includes(u._id);
                                            return (
                                                <div
                                                    key={u._id}
                                                    onClick={() => {
                                                        setSelectedBulkAssignees(prev =>
                                                            isChecked
                                                                ? prev.filter(id => id !== u._id)
                                                                : [...prev, u._id]
                                                        );
                                                    }}
                                                    className={`flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer ${isChecked
                                                        ? 'bg-[#0ea5e9] text-white shadow-lg shadow-sky-500/10'
                                                        : 'hover:bg-slate-50 text-slate-600'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-[0.65rem] ${isChecked ? 'bg-white/20' : 'bg-slate-200'
                                                            }`}>
                                                            {u.name[0]}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black leading-none">{u.name}</span>
                                                            <span className={`text-[0.6rem] font-bold ${isChecked ? 'text-white/70' : 'text-slate-400'}`}>{u.role}</span>
                                                        </div>
                                                    </div>
                                                    {isChecked && <Check size={14} strokeWidth={4} />}
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <span className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest">{selectedBulkAssignees.length} Selected</span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setIsBulkAssignModalOpen(false)}
                                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            handleBulkUpdate({ assignedTo: selectedBulkAssignees });
                                            setIsBulkAssignModalOpen(false);
                                        }}
                                        disabled={selectedBulkAssignees.length === 0}
                                        className="bg-[#0ea5e9] text-white px-5 py-2 rounded-xl text-xs font-black transition-all hover:bg-[#0284c7] shadow-lg shadow-sky-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Assign
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Leads;
