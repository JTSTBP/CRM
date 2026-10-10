import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config';
import toast from 'react-hot-toast';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Filter, Phone, ChevronLeft, ChevronRight, MessageCircle, Linkedin, UserCircle, ChevronDown, Calendar, X, RefreshCw, CheckSquare } from 'lucide-react';
import LeadModal from '../../components/modals/LeadModal';
import PostCallFeedbackModal from '../../components/modals/PostCallFeedbackModal';
import TaskModal from '../../components/modals/TaskModal';

interface POC {
    poc_id: string;
    name: string;
    designation: string;
    contact: string;
    linkedin_url: string;
    remarks: string;
    remarks_count: number;
    all_remarks: { content: string; created_at: string; by: string }[];
    stage: string;
}

interface Company {
    lead_id: string;
    company_name: string;
    created_at: string;
    assigned_by: string;
    pocs: POC[];
}

const STAGES = ["New", "Contacted", "Proposal Sent", "Negotiation", "Won", "Lost", "Onboarded", "No vendor", "Future Reference"];
const POC_STAGES = ["New", "Contacted", "Busy", "No Answer", "Wrong Number"];

const Contacts: React.FC = () => {
    const navigate = useNavigate();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedTerm, setDebouncedTerm] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCompanies, setTotalCompanies] = useState(0);

    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [feedbackPoc, setFeedbackPoc] = useState<(POC & { lead_id: string }) | null>(null);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

    const openFeedback = (poc: POC & { lead_id: string }) => {
        setFeedbackPoc(poc);
        setIsFeedbackOpen(true);
    };

    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [leadIdForTask, setLeadIdForTask] = useState<string | null>(null);

    const openTaskModal = (leadId: string) => {
        setLeadIdForTask(leadId);
        setIsTaskModalOpen(true);
    };

    const setQuickDate = (type: 'today' | 'yesterday' | 'clear') => {
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        if (type === 'today') {
            setFilters(prev => ({ ...prev, startDate: today, endDate: today }));
        } else if (type === 'yesterday') {
            setFilters(prev => ({ ...prev, startDate: yesterday, endDate: yesterday }));
        } else {
            setFilters(prev => ({ ...prev, startDate: '', endDate: '' }));
        }
        setPage(1);
    };

    const [showFilters, setShowFilters] = useState(true);
    const [users, setUsers] = useState<any[]>([]);

    const [filters, setFilters] = useState({
        leadStage: '',
        pocStage: '',
        assignedBy: '',
        startDate: '',
        endDate: ''
    });

    const [searchParams, setSearchParams] = useSearchParams();
    const currentUserRole = JSON.parse(localStorage.getItem('user') || '{}')?.role;
    const linkPrefix = currentUserRole === 'BD Executive' ? '/bd' : '/admin';

    const openLeadModal = (leadId: string) => {
        setSelectedLeadId(leadId);
        setIsModalOpen(true);
    };

    useEffect(() => {
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
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        fetchPocs();
    }, [page, debouncedTerm, filters]);

    useEffect(() => {
        fetchUsers();
    }, []);

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

    const fetchPocs = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
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

            const response = await fetch(`${API_BASE_URL}/api/leads/pocs?${params.toString()}`, {
                headers: {
                    'x-auth-token': token || ''
                }
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to fetch contacts');
            }

            const data = await response.json();
            setCompanies(data.companies || []);
            setTotalPages(data.totalPages || 1);
            setTotalCompanies(data.totalCompanies || 0);

        } catch (err: any) {
            setError(err.message);
            toast.error(err.message || 'Failed to fetch contacts');
        } finally {
            setLoading(false);
        }
    };

    if (loading && companies.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0ea5e9]"></div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto pr-1 -mr-1 custom-scrollbar pb-20 sm:pb-10">
            <div className="flex flex-col space-y-4 lg:space-y-6 min-h-full">
                <div className="bg-[#f8fafc] lg:pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 lg:mb-6">
                        <div className="text-left">
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0f1c2e] tracking-tight">Contact Details</h1>
                            <p className="text-slate-500 text-sm mt-1">Directory of all Points of Contact across leads.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <button
                                onClick={fetchPocs}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                            >
                                <RefreshCw size={18} className={loading && companies.length === 0 ? 'animate-spin' : ''} />
                                <span className="hidden sm:inline">Refresh</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0ea5e9] transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Search by name, company, phone or assignee..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-10 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/10 focus:border-[#0ea5e9] transition-all shadow-sm"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 transition-colors bg-white p-0.5 rounded-md"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setShowFilters(!showFilters)}
                                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border shadow-sm ${showFilters
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

                <div className="flex-1 flex flex-col space-y-6">

                    {/* Filter Bar */}
                    {showFilters && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm animate-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Filter size={16} className="text-[#0ea5e9]" />
                                    <h2 className="text-xs font-bold text-[#0f1c2e] uppercase tracking-wider">Advanced Filters</h2>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setQuickDate('today')}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                                            filters.startDate === new Date().toISOString().split('T')[0] && filters.endDate === new Date().toISOString().split('T')[0]
                                            ? 'bg-sky-500 border-sky-500 text-white'
                                            : 'bg-white border-slate-200 text-slate-500 hover:border-[#0ea5e9] hover:text-[#0ea5e9]'
                                        }`}
                                    >
                                        Today
                                    </button>
                                    <button
                                        onClick={() => setQuickDate('yesterday')}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                                            filters.startDate === new Date(Date.now() - 86400000).toISOString().split('T')[0] && filters.endDate === new Date(Date.now() - 86400000).toISOString().split('T')[0]
                                            ? 'bg-sky-500 border-sky-500 text-white'
                                            : 'bg-white border-slate-200 text-slate-500 hover:border-[#0ea5e9] hover:text-[#0ea5e9]'
                                        }`}
                                    >
                                        Yesterday
                                    </button>
                                    <button
                                        onClick={() => setQuickDate('clear')}
                                        className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border bg-white border-slate-200 text-slate-500 hover:border-rose-500 hover:text-rose-500"
                                    >
                                        Clear Dates
                                    </button>
                                </div>
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
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                            {error}
                        </div>
                    )}

                    {/* Mobile Cards */}
                    <div className="grid grid-cols-1 gap-4 lg:hidden">
                        {companies.length > 0 ? (
                            companies.map((company) => {
                                return (
                                    <div
                                        key={company.lead_id}
                                        className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm active:scale-[0.99] transition-all cursor-pointer group"
                                        onClick={() => openLeadModal(company.lead_id)}
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0ea5e9] to-[#0184c7] flex items-center justify-center text-white font-bold shadow-md">
                                                    {company.company_name?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-[#0f1c2e] group-hover:text-[#0ea5e9] transition-colors block">
                                                        {company.company_name}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                        {company.pocs.length} Candidates
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openTaskModal(company.lead_id); }}
                                                className="p-2 bg-amber-50 rounded-xl text-amber-600 hover:bg-amber-100 transition-colors"
                                            >
                                                <CheckSquare size={16} />
                                            </button>
                                        </div>
                                        
                                        <div className="space-y-4 pt-4 border-t border-slate-50">
                                            {company.pocs.map((poc) => (
                                                <div key={poc.poc_id} className="bg-slate-50/50 p-3 rounded-xl space-y-3">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); navigate(`${linkPrefix}/contacts/${poc.poc_id}`); }}
                                                                className="text-sm font-bold text-[#0ea5e9] hover:underline text-left block"
                                                            >
                                                                {poc.name}
                                                            </button>
                                                            <p className="text-[10px] text-slate-500 font-bold uppercase">{poc.designation || 'No Designation'}</p>
                                                        </div>
                                                        <span className="text-[10px] px-2 py-0.5 bg-sky-100 text-sky-600 rounded-md font-bold uppercase">
                                                            {poc.stage}
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <a
                                                            href={`tel:${poc.contact}`}
                                                            onClick={(e) => { e.stopPropagation(); openFeedback({ ...poc, lead_id: company.lead_id, company_name: company.company_name } as any); }}
                                                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-white border border-slate-100 rounded-lg text-[10px] font-bold text-sky-600 shadow-sm"
                                                        >
                                                            <Phone size={12} /> Call
                                                        </a>
                                                        <a
                                                            href={`https://wa.me/${poc.contact.replace(/\D/g, '')}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-white border border-slate-100 rounded-lg text-[10px] font-bold text-green-600 shadow-sm"
                                                        >
                                                            <MessageCircle size={12} /> WA
                                                        </a>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex justify-between items-center pt-4 mt-2 border-t border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            <span>Added: {new Date(company.created_at).toLocaleDateString()}</span>
                                            <span>By: {company.assigned_by}</span>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500">
                                No companies found matching your search.
                            </div>
                        )}
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden lg:block bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden min-h-[400px]">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-20">
                                    <tr className="bg-slate-50/90 backdrop-blur-sm border-b border-slate-200/60">
                                        <th className="px-6 py-4 text-[0.75rem] font-bold text-slate-400 uppercase tracking-wider">Company & Candidates</th>
                                        <th className="px-6 py-4 text-[0.75rem] font-bold text-slate-400 uppercase tracking-wider">Designation</th>
                                        <th className="px-6 py-4 text-[0.75rem] font-bold text-slate-400 uppercase tracking-wider">Contact & Link</th>
                                        <th className="px-6 py-4 text-[0.75rem] font-bold text-slate-400 uppercase tracking-wider">Stage</th>
                                        <th className="px-6 py-4 text-[0.75rem] font-bold text-slate-400 uppercase tracking-wider">Assigned & Date</th>
                                        <th className="px-6 py-4 text-[0.75rem] font-bold text-slate-400 uppercase tracking-wider">Remarks</th>
                                        <th className="px-6 py-4 text-[0.75rem] font-bold text-slate-400 uppercase tracking-wider">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {companies.length > 0 ? (
                                        companies.map((company, index) => {
                                            return (
                                                <tr
                                                    key={company.lead_id}
                                                    className="hover:bg-slate-50/50 transition-colors group animate-in fade-in duration-300 cursor-pointer border-b border-slate-50 last:border-0"
                                                    style={{ animationDelay: `${index * 30}ms`, animationFillMode: 'both' }}
                                                    onClick={() => openLeadModal(company.lead_id)}
                                                >
                                                    <td className="px-6 py-5 align-top">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openLeadModal(company.lead_id);
                                                            }}
                                                            className="text-sm font-extrabold text-[#0ea5e9] hover:underline transition-colors text-left block max-w-[220px]"
                                                        >
                                                            {company.company_name}
                                                        </button>
                                                        <div className="mt-4 flex flex-col gap-4">
                                                            {company.pocs.map((poc) => (
                                                                <div key={poc.poc_id} className="flex items-center gap-2.5">
                                                                    <div className="w-6 h-6 rounded-md bg-sky-50 flex items-center justify-center text-[#0ea5e9] text-[10px] font-bold border border-sky-100">
                                                                        {poc.name?.charAt(0).toUpperCase() || '?'}
                                                                    </div>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); navigate(`${linkPrefix}/contacts/${poc.poc_id}`); }}
                                                                        className="text-xs font-bold text-[#0ea5e9] hover:underline text-left"
                                                                    >
                                                                        {poc.name}
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 align-top">
                                                        <div className="flex flex-col gap-4">
                                                            {company.pocs.map((poc) => (
                                                                <div key={poc.poc_id} className="h-8 flex items-center">
                                                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                                        {poc.designation || 'N/A'}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 align-top">
                                                        <div className="flex flex-col gap-4">
                                                            {company.pocs.map((poc) => (
                                                                <div key={poc.poc_id} className="h-8 flex items-center gap-3">
                                                                    <a
                                                                        href={`tel:${poc.contact}`}
                                                                        onClick={(e) => { e.stopPropagation(); openFeedback({ ...poc, lead_id: company.lead_id, company_name: company.company_name } as any); }}
                                                                        className="text-xs font-bold text-[#0ea5e9] hover:underline flex items-center gap-1.5"
                                                                    >
                                                                        <Phone size={12} className="text-[#0ea5e9]/70" />
                                                                        {poc.contact || 'N/A'}
                                                                    </a>
                                                                    <div className="flex gap-2">
                                                                        {poc.linkedin_url && (
                                                                            <a
                                                                                href={poc.linkedin_url}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                className="text-xs text-sky-600 hover:scale-110 transition-transform"
                                                                                title="LinkedIn"
                                                                            >
                                                                                <Linkedin size={14} />
                                                                            </a>
                                                                        )}
                                                                        <a
                                                                            href={`https://wa.me/${poc.contact.replace(/\D/g, '')}`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className="text-xs text-green-600 hover:scale-110 transition-transform"
                                                                            title="WhatsApp"
                                                                        >
                                                                            <MessageCircle size={14} />
                                                                        </a>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 align-top">
                                                        <div className="flex flex-col gap-4">
                                                            {company.pocs.map((poc) => (
                                                                <div key={poc.poc_id} className="h-8 flex items-center">
                                                                    <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                                                        {poc.stage}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 align-top">
                                                        <div className="flex flex-col gap-1.5">
                                                            <span className="text-xs font-bold text-[#0f1c2e] flex items-center gap-1.5">
                                                                <UserCircle size={14} className="text-slate-400" />
                                                                {company.assigned_by || 'Unknown'}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                                                                <Calendar size={12} />
                                                                {new Date(company.created_at).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 align-top max-w-[200px] relative">
                                                        <div className="flex flex-col gap-4">
                                                            {company.pocs.map((poc) => (
                                                                <div key={poc.poc_id} className="h-8 flex items-center group/remarks relative">
                                                                    <div className="flex items-center gap-2 cursor-pointer w-full">
                                                                        {poc.remarks_count === 0 && (
                                                                            <span className="text-xs text-slate-400 italic">None</span>
                                                                        )}
                                                                        {poc.remarks_count > 0 && (
                                                                            <span className="px-2 py-0.5 bg-sky-50 text-[#0ea5e9] text-[10px] font-bold rounded border border-sky-100 hover:bg-sky-100 transition-colors">
                                                                                {poc.remarks_count} Remarks
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {poc.remarks_count > 0 && (
                                                                        <div className="absolute right-0 top-full mt-2 w-72 max-w-[80vw] bg-slate-800 rounded-xl p-4 shadow-2xl opacity-0 invisible group-hover/remarks:opacity-100 group-hover/remarks:visible transition-all z-[100] transform translate-y-2 group-hover/remarks:translate-y-0">
                                                                            <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-700 pb-2">Remarks for {poc.name}</p>
                                                                            <div className="max-h-56 overflow-y-auto space-y-4 custom-scrollbar pr-2">
                                                                                {poc.all_remarks?.map((rmk, i) => (
                                                                                    <div key={i} className="text-xs border-l-[3px] border-[#0ea5e9] pl-3">
                                                                                        <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{rmk.content}</p>
                                                                                        <div className="flex justify-between items-center text-slate-500 mt-1.5 text-[0.65rem] font-medium">
                                                                                            <span>{rmk.by}</span>
                                                                                            <span>{new Date(rmk.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 align-top">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); openTaskModal(company.lead_id); }}
                                                            className="p-2 hover:bg-amber-50 text-amber-600 rounded-lg transition-colors border border-transparent hover:border-amber-100 shadow-sm"
                                                            title="Create Task"
                                                        >
                                                            <CheckSquare size={18} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-medium">
                                                No companies found matching your search.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination */}
                    <div className="p-4 sm:px-6 sm:py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-2xl border shadow-sm">
                        <div className="text-xs sm:text-sm font-medium text-slate-500 text-center sm:text-left flex flex-wrap items-center justify-center sm:justify-start gap-2">
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
                            <span>of <span className="text-[#0f1c2e] font-bold">{totalPages}</span></span>
                            <span className="hidden sm:inline mx-2 text-slate-300">|</span>
                            <span className="block sm:inline mt-1 sm:mt-0">Total Results: <span className="text-[#0f1c2e] font-bold">{totalCompanies}</span></span>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto justify-center">
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
            </div>

            {isModalOpen && (
                <LeadModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    leadId={selectedLeadId}
                    initialMode="view"
                    onUpdate={fetchPocs}
                />
            )}

            {isFeedbackOpen && feedbackPoc && (
                <PostCallFeedbackModal
                    isOpen={isFeedbackOpen}
                    onClose={() => { setIsFeedbackOpen(false); setFeedbackPoc(null); }}
                    leadId={feedbackPoc.lead_id}
                    poc={{
                        _id: feedbackPoc.poc_id,
                        name: feedbackPoc.name,
                        phone: feedbackPoc.contact,
                        stage: feedbackPoc.stage || 'New'
                    }}
                    onSuccess={fetchPocs}
                />
            )}

            {isTaskModalOpen && (
                <TaskModal
                    isOpen={isTaskModalOpen}
                    onClose={() => { setIsTaskModalOpen(false); setLeadIdForTask(null); }}
                    leadId={leadIdForTask}
                    onSuccess={fetchPocs}
                />
            )}
        </div>
    );
};

export default Contacts;
