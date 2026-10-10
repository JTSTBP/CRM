import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Funnel, Plus, CheckCircle, AlertCircle, Globe, RefreshCw, Edit2, Trash2, XCircle, ChevronDown, ChevronUp, Mail } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import toast from 'react-hot-toast';
import AddIncompleteLeadModal from '../../components/modals/AddIncompleteLeadModal';
import MergeDuplicateModal from '../../components/modals/MergeDuplicateModal';
import { createPortal } from 'react-dom';

interface PointOfContact {
    _id: string;
    name: string;
    phone: string;
    email?: string;
    designation?: string;
    approvalStatus: 'pending' | 'approved' | 'rejected';
}

interface Lead {
    _id: string;
    company_name?: string;
    website_url: string;
    status: 'incomplete' | 'approved' | 'rejected';
    isDuplicate?: boolean;
    assignedBy: {
        _id: string;
        name: string;
    };
    assignedTo?: {
        _id: string;
        name: string;
    }[];
    createdAt: string;
    points_of_contact: PointOfContact[];
}

const AddLeadTab: React.FC = () => {
    const [incompleteLeads, setIncompleteLeads] = useState<Lead[]>([]);
    const [fetching, setFetching] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
    const [isPocOnlyMode, setIsPocOnlyMode] = useState(false);
    const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
    const [checkUrl, setCheckUrl] = useState('');
    const [checking, setChecking] = useState(false);
    const [activeTab, setActiveTab] = useState<'leads' | 'pocs'>('leads');
    const [showDuplicates, setShowDuplicates] = useState(false);
    const [showRejected, setShowRejected] = useState(false);
    const [duplicateData, setDuplicateData] = useState<{ company_name: string; website_url: string } | null>(null);
    const [mergeModalLeadId, setMergeModalLeadId] = useState<string | null>(null);
// Assignee column filter state
const [assigneeFilterOpen, setAssigneeFilterOpen] = useState(false);
const [assigneeOptions, setAssigneeOptions] = useState<string[]>([]);
const [selectedAssignees, setSelectedAssignees] = useState<Set<string>>(new Set());
const [assigneeSearch, setAssigneeSearch] = useState('');
    const rejectedSectionRef = useRef<HTMLDivElement>(null);
    const assigneeButtonRef = useRef<HTMLButtonElement>(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });


    const handleAssigneeFilterToggle = () => {
  if (!assigneeFilterOpen && assigneeButtonRef.current) {
    const rect = assigneeButtonRef.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
  }
  setAssigneeFilterOpen(!assigneeFilterOpen);
};

    const scrollToRejected = () => {
        setShowRejected(true);
        setTimeout(() => {
            rejectedSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
    };

    const [rejectedLeads, setRejectedLeads] = useState<Lead[]>([]);
    const [pendingPocs, setPendingPocs] = useState<any[]>([]);
    const [rejectedPocs, setRejectedPocs] = useState<any[]>([]);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [limit] = useState(10);

    const [rejectedPage, setRejectedPage] = useState(1);
    const [rejectedTotalPages, setRejectedTotalPages] = useState(1);

    const fetchIncompleteLeads = useCallback(async (searchQuery: string = '', page: number = 1) => {
        try {
            setFetching(true);
            const token = localStorage.getItem('token');
            const params = new URLSearchParams();
            params.append('status', 'incomplete');
            params.append('limit', limit.toString());
            params.append('page', page.toString());
            if (showDuplicates) params.append('isDuplicate', 'true');
            if (searchQuery) params.append('search', searchQuery);

            const response = await fetch(`${API_BASE_URL}/api/leads?${params.toString()}`, {
                headers: { 'x-auth-token': token || '' }
            });
            if (response.ok) {
                const data = await response.json();
                setIncompleteLeads(data.leads || []);
                setCurrentPage(data.currentPage ?? page);
                setTotalPages(data.totalPages ?? 1);
            }
        } catch (err) {
            toast.error('Failed to fetch pending leads');
        } finally {
            setFetching(false);
        }
    }, [limit, showDuplicates]);

    const fetchRejectedLeads = useCallback(async (searchQuery: string = '', page: number = 1) => {
        try {
            const token = localStorage.getItem('token');
            const params = new URLSearchParams();
            params.append('status', 'rejected');
            params.append('limit', limit.toString());
            params.append('page', page.toString());
            if (searchQuery) params.append('search', searchQuery);

            const response = await fetch(`${API_BASE_URL}/api/leads?${params.toString()}`, {
                headers: { 'x-auth-token': token || '' }
            });
            if (response.ok) {
                const data = await response.json();
                setRejectedLeads(data.leads || []);
                setRejectedPage(data.currentPage ?? page);
                setRejectedTotalPages(data.totalPages ?? 1);
            }
        } catch (err) {
            toast.error('Failed to fetch rejected leads');
        }
    }, [limit]);

    const fetchPendingPocs = useCallback(async (searchQuery: string = '', page: number = 1) => {
        try {
            setFetching(true);
            const token = localStorage.getItem('token');
            const params = new URLSearchParams();
            params.append('approvalStatus', 'pending');
            params.append('limit', '10');
            params.append('page', page.toString());
            if (searchQuery) params.append('search', searchQuery);

            const response = await fetch(`${API_BASE_URL}/api/leads/approval-pocs?${params.toString()}`, {
                headers: { 'x-auth-token': token || '' }
            });
            if (response.ok) {
                const data = await response.json();
                setPendingPocs(data.pocs || []);
                setCurrentPage(data.currentPage ?? page);
                setTotalPages(data.totalPages ?? 1);
            }
        } catch (err) {
            toast.error('Failed to fetch pending contacts');
        } finally {
            setFetching(false);
        }
    }, []);

    const fetchRejectedPocs = useCallback(async (searchQuery: string = '', page: number = 1) => {
        try {
            const token = localStorage.getItem('token');
            const params = new URLSearchParams();
            params.append('approvalStatus', 'rejected');
            params.append('limit', '10');
            params.append('page', page.toString());
            if (searchQuery) params.append('search', searchQuery);

            const response = await fetch(`${API_BASE_URL}/api/leads/approval-pocs?${params.toString()}`, {
                headers: { 'x-auth-token': token || '' }
            });
            if (response.ok) {
                const data = await response.json();
                setRejectedPocs(data.pocs || []);
                setRejectedPage(data.currentPage ?? page);
                setRejectedTotalPages(data.totalPages ?? 1);
            }
        } catch (err) {
            toast.error('Failed to fetch rejected contacts');
        }
    }, []);

    // Pagination controls UI for pending
    const renderPagination = () => (
        <div className="flex justify-center items-center gap-4 mt-4 p-4 border-t border-slate-100">
            <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage <= 1}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl disabled:opacity-50 font-bold text-xs hover:bg-slate-200 transition-colors"
            >
                Previous
            </button>
            <span className="text-xs font-bold text-slate-500">Page {currentPage} of {totalPages}</span>
            <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl disabled:opacity-50 font-bold text-xs hover:bg-slate-200 transition-colors"
            >
                Next
            </button>
        </div>
    );

    // Pagination controls UI for rejected
    const renderRejectedPagination = () => (
        <div className="flex justify-center items-center gap-4 mt-4 p-4 border-t border-rose-50/50">
            <button
                onClick={() => setRejectedPage(prev => Math.max(prev - 1, 1))}
                disabled={rejectedPage <= 1}
                className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl disabled:opacity-50 font-bold text-xs hover:bg-rose-100 transition-colors"
            >
                Previous
            </button>
            <span className="text-xs font-bold text-rose-400">Page {rejectedPage} of {rejectedTotalPages}</span>
            <button
                onClick={() => setRejectedPage(prev => Math.min(prev + 1, rejectedTotalPages))}
                disabled={rejectedPage >= rejectedTotalPages}
                className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl disabled:opacity-50 font-bold text-xs hover:bg-rose-100 transition-colors"
            >
                Next
            </button>
        </div>
    );

    // Effect to refetch when page changes
    useEffect(() => {
        if (activeTab === 'leads') {
            fetchIncompleteLeads(searchTerm, currentPage);
        } else {
            fetchPendingPocs(searchTerm, currentPage);
        }
    }, [searchTerm, currentPage, activeTab, fetchIncompleteLeads, fetchPendingPocs]);

    useEffect(() => {
        if (activeTab === 'leads') {
            fetchRejectedLeads(searchTerm, rejectedPage);
        } else {
            fetchRejectedPocs(searchTerm, rejectedPage);
        }
    }, [searchTerm, rejectedPage, activeTab, fetchRejectedLeads, fetchRejectedPocs]);

    useEffect(() => { 
        if (activeTab === 'leads') {
            fetchIncompleteLeads(); 
            fetchRejectedLeads(); 
        } else {
            fetchPendingPocs();
            fetchRejectedPocs();
        }
    }, [activeTab, fetchIncompleteLeads, fetchRejectedLeads, fetchPendingPocs, fetchRejectedPocs]);

    useEffect(() => {
        const timer = setTimeout(() => { 
            if (activeTab === 'leads') {
                fetchIncompleteLeads(searchTerm, 1); 
                fetchRejectedLeads(searchTerm, 1); 
            } else {
                fetchPendingPocs(searchTerm, 1);
                fetchRejectedPocs(searchTerm, 1);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm, activeTab, fetchIncompleteLeads, fetchRejectedLeads, fetchPendingPocs, fetchRejectedPocs]);

    const handleApprove = async (id: string) => {
        const lead = incompleteLeads.find(l => l._id === id);
        if (lead && lead.isDuplicate) {
            setMergeModalLeadId(id);
            return;
        }

        if (!window.confirm('Approve this lead? It will moved to the main leads list.')) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/leads/${id}/approve`, {
                method: 'PATCH',
                headers: { 'x-auth-token': token || '' }
            });
            if (response.ok) {
                toast.success('Lead approved!');
                fetchIncompleteLeads(searchTerm);
            } else {
                const data = await response.json();
                if (data.errors && Array.isArray(data.errors)) {
                    toast.error(`${data.message} ${data.errors.join(' ')}`, { duration: 5000 });
                } else {
                    throw new Error(data.message || 'Failed to approve lead');
                }
            }
        } catch (err: any) { toast.error(err.message); }
    };

    const handleReject = async (id: string) => {
        if (!window.confirm('Are you sure you want to REJECT this lead?')) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/leads/${id}/reject`, {
                method: 'PATCH',
                headers: { 'x-auth-token': token || '' }
            });
            if (response.ok) { toast.success('Lead rejected!'); fetchIncompleteLeads(searchTerm); }
            else { const data = await response.json(); toast.error(data.message || 'Failed to reject lead'); }
        } catch (err) { toast.error('Server error'); }
    };

    const handleRejectPoc = async (leadId: string, pocId: string) => {
        if (!window.confirm('Are you sure you want to REJECT this contact?')) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/leads/${leadId}/reject-poc/${pocId}`, {
                method: 'PATCH',
                headers: { 'x-auth-token': token || '' }
            });
            if (response.ok) { 
                toast.success('Contact rejected!'); 
                if (activeTab === 'leads') {
                    fetchIncompleteLeads(searchTerm, currentPage);
                } else {
                    fetchPendingPocs(searchTerm, currentPage);
                    fetchRejectedPocs(searchTerm, rejectedPage);
                }
            }
            else { const data = await response.json(); toast.error(data.message || 'Failed to reject contact'); }
        } catch (err) { toast.error('Server error'); }
    };

    const handleApprovePoc = async (leadId: string, pocId: string) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/leads/${leadId}/approve-poc/${pocId}`, {
                method: 'PATCH',
                headers: { 'x-auth-token': token || '' }
            });
            if (response.ok) { 
                toast.success('Contact approved!'); 
                if (activeTab === 'leads') {
                    fetchIncompleteLeads(searchTerm, currentPage);
                } else {
                    fetchPendingPocs(searchTerm, currentPage);
                    fetchRejectedPocs(searchTerm, rejectedPage);
                }
            }
            else { const data = await response.json(); toast.error(data.message || 'Failed to approve contact'); }
        } catch (err) { toast.error('Server error'); }
    };

    const handleDeletePoc = async (leadId: string, pocId: string, pocName: string) => {
        if (!window.confirm(`Delete contact "${pocName}"?`)) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/leads/${leadId}/poc/${pocId}`, {
                method: 'DELETE',
                headers: { 'x-auth-token': token || '' }
            });
            if (response.ok) { 
                toast.success('Contact deleted!'); 
                if (activeTab === 'leads') {
                    fetchIncompleteLeads(searchTerm, currentPage);
                } else {
                    fetchPendingPocs(searchTerm, currentPage);
                    fetchRejectedPocs(searchTerm, rejectedPage);
                }
            }
            else { const data = await response.json(); toast.error(data.message || 'Failed to delete contact'); }
        } catch (err) { toast.error('Server error'); }
    };

    const handleEdit = (id: string) => { setSelectedLeadId(id); setIsPocOnlyMode(false); setIsModalOpen(true); };
    const handleEditPoc = (leadId: string) => { setSelectedLeadId(leadId); setIsPocOnlyMode(true); setIsModalOpen(true); };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this lead?')) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/leads/${id}`, {
                method: 'DELETE',
                headers: { 'x-auth-token': token || '' }
            });
            if (response.ok) { toast.success('Lead deleted!'); fetchIncompleteLeads(searchTerm); }
            else { const data = await response.json(); throw new Error(data.message || 'Failed to delete lead'); }
        } catch (err: any) { toast.error(err.message); }
    };

    const handleOpenCreateModal = () => { setSelectedLeadId(null); setIsPocOnlyMode(false); setIsModalOpen(true); };

    const handleCheckUrl = async () => {
        if (!checkUrl) return toast.error('Please enter a website URL or company name');
        try {
            setChecking(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/leads/check?query=${encodeURIComponent(checkUrl.trim())}`, {
                headers: { 'x-auth-token': token || '' }
            });
            const data = await response.json();
            if (response.ok) {
                if (data.status === 'incomplete') {
                    toast('Note: This company is currently pending approval. Please approve the company first.', {
                        icon: '⚠️',
                        duration: 4000
                    });
                    return;
                }

                if (data.isDuplicate) {
                    toast('This company is already assigned to someone else. Your submission will be flagged as a duplicate for Admin review.', { icon: '🚨', duration: 6000 });
                    setSelectedLeadId(null); 
                    setIsPocOnlyMode(false); 
                    setDuplicateData({ company_name: data.company_name || '', website_url: data.website_url || checkUrl.trim() });
                    setIsModalOpen(true);
                    setIsCheckModalOpen(false); 
                    setCheckUrl('');
                    return;
                }

                setSelectedLeadId(data.id); setIsPocOnlyMode(true); setDuplicateData(null); setIsModalOpen(true);
                setIsCheckModalOpen(false); setCheckUrl('');
            } else {
                toast.error(data.message || 'Lead not found.');
            }
        } catch (err) { toast.error('Error checking lead existence'); }
        finally { setChecking(false); }
    };

    const isAdmin = ['Admin', 'Manager'].includes(JSON.parse(localStorage.getItem('user') || '{}')?.role);

    // Derived lists — pending vs rejected and duplicates
    const pendingLeads = incompleteLeads;
    const duplicateLeads = incompleteLeads;
    
    // Determine items based on active tab and duplicate view
    const pendingItems = activeTab === 'leads' ? (showDuplicates ? duplicateLeads : pendingLeads) : pendingPocs;

    // Compute assignee options for filter
    useEffect(() => {
      const names = new Set<string>();
      pendingItems.forEach(item => {
        if (item.assignedBy?.name) names.add(item.assignedBy.name);
        if (Array.isArray(item.assignedTo)) {
          item.assignedTo.forEach((u:any) => u.name && names.add(u.name));
        }
      });
      setAssigneeOptions(Array.from(names).sort());
    }, [pendingItems]);

    const filteredPending = pendingItems.filter(item => {
      const base = activeTab === 'leads' ? (!showDuplicates || item.isDuplicate) : true;
      if (!base) return false;
      if (selectedAssignees.size === 0) return true;
      const names: string[] = [];
      if (item.assignedBy?.name) {
        names.push(item.assignedBy.name);
      } else if (Array.isArray(item.assignedTo)) {
        names.push(...item.assignedTo.map((u:any) => u.name));
      }
      return names.some(n => selectedAssignees.has(n));
    });
    const rejectedItems = activeTab === 'leads' ? rejectedLeads : rejectedPocs;

// const tableHeader = (
//   <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-100">
//     <tr>
//       <th className="px-8 py-5 text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.15em]">
//           {(activeTab === 'leads') ? 'Website / Company' : 'POC Detail'}
//       </th>
//       <th className="px-8 py-5 text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.15em] overflow-visible relative z-100">
//         <div className="relative inline-flex items-center">
//           <button ref={assigneeButtonRef} onClick={() => setAssigneeFilterOpen(!assigneeFilterOpen)} className="flex items-center gap-1">
//             {(activeTab === 'leads') ? 'Assignee' : 'Company'}
//             <Funnel className={assigneeFilterOpen ? "stroke-current text-[#0ea5e9]" : "stroke-current"} size={14} />
//           </button>
          
//         </div>
//       </th>
//       <th className="px-8 py-5 text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.15em]">
//         Submitted By
//       </th>
//       <th className="px-8 py-5 text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.15em]">
//         Submission Date
//       </th>
//       <th className="px-8 py-5 text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.15em] text-right">
//         Actions
//       </th>
//     </tr>
//   </thead>
// );

    // 3. Fixed tableHeader — clean, no stray )}
const tableHeader = (
  <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-100">
    <tr>
      <th className="px-8 py-5 text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.15em]">
        {activeTab === 'leads' ? 'Website / Company' : 'POC Detail'}
      </th>
      <th className="px-8 py-5 text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.15em] relative">
        <div className="inline-flex items-center">
          <button ref={assigneeButtonRef} onClick={handleAssigneeFilterToggle} className="flex items-center gap-1">
            {activeTab === 'leads' ? 'Assignee' : 'Company'}
            <Funnel className={assigneeFilterOpen ? "text-[#0ea5e9]" : ""} size={14} />
          </button>
        </div>
      </th>
      <th className="px-8 py-5 text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.15em]">Submitted By</th>
      <th className="px-8 py-5 text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.15em]">Submission Date</th>
      <th className="px-8 py-5 text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.15em] text-right">Actions</th>
    </tr>
  </thead>
);
const rejectedTableHeader = (
  <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-100">
    <tr>
      <th className="px-8 py-5 text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.15em]">
          {(activeTab === 'leads') ? 'Website / Company' : 'POC Detail'}
      </th>
      <th className="px-8 py-5 text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.15em]">
          {(activeTab === 'leads') ? 'Assignee' : 'Company'}
      </th>
      <th className="px-8 py-5 text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.15em]">
        Submitted By
      </th>
      <th className="px-8 py-5 text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.15em]">Rejected By</th>
      <th className="px-8 py-5 text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.15em]">
        Submission Date
      </th>
      <th className="px-8 py-5 text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.15em] text-right">
        Actions
      </th>
    </tr>
  </thead>
);
const renderRow = (item: any, isRejected = false) => (
        <tr key={item._id + (isRejected ? '-r' : '-p')} className={`hover:bg-slate-50/70 transition-all group ${isRejected ? 'opacity-80' : ''}`}>
            <td className="px-8 py-6">
                {activeTab === 'leads' ? (
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm transition-all ${isRejected ? 'bg-rose-50 text-rose-400 border-rose-100' : 'bg-sky-50 text-[#0ea5e9] border-sky-100/50 group-hover:bg-[#0ea5e9] group-hover:text-white'}`}>
                            <Globe size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-[#0f1c2e]">{item.company_name || 'No Name'}</span>
                                {item.isDuplicate && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.55rem] font-bold bg-rose-100 text-rose-700 uppercase tracking-widest border border-rose-200" title="Duplicate of an existing lead">Duplicate</span>
                                )}
                            </div>
                            <span className="text-[0.65rem] font-bold text-slate-400 block truncate max-w-[150px] sm:max-w-[250px]">{item.website_url}</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm transition-all ${isRejected ? 'bg-rose-50 text-rose-400 border-rose-100' : 'bg-emerald-50 text-emerald-500 border-emerald-100/50 group-hover:bg-emerald-500 group-hover:text-white'}`}>
                            <CheckCircle size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-[#0f1c2e] truncate max-w-[200px]">{item.name || item.linkedin_url || 'Unnamed Contact'}</span>
                                {item.designation && (
                                    <span className="text-[0.65rem] font-bold text-[#0ea5e9] bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100/50 uppercase tracking-wider">{item.designation}</span>
                                )}
                            </div>
                        {item.email ? (
                          <span className="text-[0.65rem] font-bold text-slate-400 flex items-center">
                            <Mail size={14} className="mr-1" />
                            {item.email}
                          </span>
                        ) : (
                          <span className="text-[0.65rem] font-bold text-slate-400">{item.phone || 'No contact details'}</span>
                        )}
                        </div>
                    </div>
                )}
            </td>
            <td className="px-8 py-6">
  {activeTab === 'leads' ? (
    <div className="flex flex-wrap gap-2">
      {item.assignedBy ? (
        <div className="flex items-center gap-2 bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200" title={item.assignedBy.name}>
          <div className="w-5 h-5 rounded-md bg-white flex items-center justify-center text-slate-500 font-black text-[0.55rem] shadow-sm">
            {item.assignedBy.name?.[0] || '?'}
          </div>
          <span className="text-[0.65rem] font-bold text-slate-600">{item.assignedBy.name}</span>
        </div>
      ) : (
        item.assignedTo && item.assignedTo.length > 0 ? (
          item.assignedTo.map((u:any) => (
            <div key={u._id} className="flex items-center gap-2 bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200" title={u.name}>
              <div className="w-5 h-5 rounded-md bg-white flex items-center justify-center text-slate-500 font-black text-[0.55rem] shadow-sm">
                {u.name?.[0] || '?'}
              </div>
              <span className="text-[0.65rem] font-bold text-slate-600">{u.name}</span>
            </div>
          ))
        ) : (
          <div className="flex items-center gap-2 bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <div className="w-5 h-5 rounded-md bg-white flex items-center justify-center text-slate-500 font-black text-[0.55rem] shadow-sm">
              {item.assignedBy?.name?.[0] || '?'}
            </div>
            <span className="text-[0.65rem] font-bold text-slate-600">{item.assignedBy?.name || 'Self'}</span>
          </div>
        )
      )}
    </div>
  ) : (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-slate-600 block truncate max-w-[150px] sm:max-w-[200px]">
          {item.lead.company_name || 'No Name'}
        </span>
        {item.lead.isDuplicate && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.55rem] font-bold bg-rose-100 text-rose-700 uppercase tracking-widest border border-rose-200" title="Duplicate of an existing lead">Duplicate</span>
        )}
      </div>
      <span className="text-[0.65rem] font-medium text-[#0ea5e9] block truncate max-w-[150px] sm:max-w-[200px]">
        {item.lead.website_url}
      </span>
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        <span className="text-[0.6rem] font-black text-slate-300 uppercase tracking-widest">BD:</span>
        {item.lead.assignedTo && item.lead.assignedTo.length > 0 ? (
          item.lead.assignedTo.map((u:any) => (
            <span key={u._id} className="text-[0.65rem] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200">{u.name}</span>
          ))
        ) : (
          <span className="text-[0.65rem] font-bold text-slate-500">{item.lead.assignedBy?.name || 'Self'}</span>
        )}
      </div>
    </div>
  )}
</td>
            <td className="px-8 py-6">
                {activeTab === 'leads' ? (
                    <span className="text-[0.65rem] font-bold text-slate-600">
                        {item.createdBy?.name || item.assignedBy?.name || 'Self'}
                    </span>
                ) : (
                    item.createdBy?.name && (
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 font-black text-[0.55rem] shadow-sm">
                                {item.createdBy.name[0]}
                            </div>
                            <span className="text-[0.65rem] font-bold text-slate-600">
                                {item.createdBy.name || "-"}
                            </span>
                        </div>
                    )
                )}
            </td>
{isRejected && (
  <td className="px-8 py-6">
    <div className="flex items-center gap-2 bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200" title={item.rejectedBy?.name}>
     
      <span className="text-[0.65rem] font-bold text-slate-600">{item.rejectedBy?.name || '-'}</span>
    </div>
  </td>
)}

            <td className="px-8 py-6">
                <span className="text-[0.7rem] font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                 {new Date(activeTab === 'leads' ? item.createdAt : (item.createdAt || item.lead.createdAt)).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}
                </span>
            </td>
            <td className="px-8 py-6">
                <div className="flex items-center justify-end gap-2">
                    {activeTab === 'leads' ? (
                        <>
                            <button onClick={() => handleEdit(item._id)} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-[#0ea5e9]/10 hover:text-[#0ea5e9] transition-all border border-slate-100" title="Edit">
                                <Edit2 size={16} />
                            </button>
                            <button onClick={() => handleDelete(item._id)} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-all border border-slate-100" title="Delete">
                                <Trash2 size={16} />
                            </button>
                            {isAdmin && (
                                <>
                                    {!isRejected && (
                                        <button onClick={() => handleReject(item._id)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-500 hover:text-white transition-all text-xs font-black uppercase tracking-widest border border-rose-100">
                                            <XCircle size={16} /> Reject
                                        </button>
                                    )}
                                    <button onClick={() => handleApprove(item._id)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0ea5e9]/5 text-[#0ea5e9] rounded-xl hover:bg-[#0ea5e9] hover:text-white transition-all text-xs font-black uppercase tracking-widest border border-[#0ea5e9]/10">
                                        <CheckCircle size={16} /> {isRejected ? 'Re-Approve' : 'Approve'}
                                    </button>
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            <button onClick={() => handleEditPoc(item.lead._id)} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-[#0ea5e9]/10 hover:text-[#0ea5e9] transition-all border border-slate-100" title="Edit">
                                <Edit2 size={16} />
                            </button>
                            <button onClick={() => handleDeletePoc(item.lead._id, item._id, item.name)} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-all border border-slate-100" title="Delete">
                                <Trash2 size={16} />
                            </button>
                            {isAdmin && (
                                <>
                                    {!isRejected && (
                                        <button onClick={() => handleRejectPoc(item.lead._id, item._id)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-500 hover:text-white transition-all text-[0.65rem] font-black uppercase tracking-widest border border-rose-100">
                                            <XCircle size={14} /> Reject
                                        </button>
                                    )}
                                    <button onClick={() => handleApprovePoc(item.lead._id, item._id)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white transition-all text-[0.65rem] font-black uppercase tracking-widest border border-emerald-100">
                                        <CheckCircle size={14} /> {isRejected ? 'Re-Approve' : 'Approve'}
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </div>
            </td>
        </tr>
    );

    return (
        <div className="h-full flex flex-col space-y-6 overflow-hidden max-w-7xl mx-auto px-4 sm:px-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0f1c2e] tracking-tight">Company Approvals</h1>
                    <p className="text-sm text-slate-500 mt-1">Review and approve pending companies and contacts for the main dashboard.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                    <button
                        onClick={scrollToRejected}
                        className="bg-rose-50 text-rose-600 px-6 py-3 rounded-2xl font-black transition-all hover:bg-rose-500 hover:text-white active:scale-[0.98] shadow-lg shadow-rose-200/50 text-sm flex items-center gap-2.5 border border-rose-100"
                    >
                        <ChevronDown size={20} className="stroke-[3]" /> View Rejected
                    </button>
                    <button onClick={() => setIsCheckModalOpen(true)} className="bg-white border-2 border-slate-100 text-[#0ea5e9] px-6 py-3 rounded-2xl font-black transition-all hover:bg-sky-50 hover:border-[#0ea5e9]/20 active:scale-[0.98] shadow-lg shadow-slate-200/50 text-sm flex items-center gap-2.5">
                        <Plus size={20} className="stroke-[3]" /> Add POC
                    </button>
                    <button onClick={handleOpenCreateModal} className="bg-[#0ea5e9] text-white px-8 py-3 rounded-2xl font-black transition-all hover:bg-[#0284c7] hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-sky-500/25 text-sm flex items-center gap-2.5">
                        <Plus size={22} /> Add Company
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-0 space-y-4 pb-12">
                {/* Section Header + Search */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                            <AlertCircle size={22} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-[#0f1c2e] leading-tight">Pending Approvals</h2>
                            <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">{pendingItems.length} {activeTab === 'leads' ? 'companies' : 'contacts'} waiting</p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                        <div className="relative w-full sm:w-80 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0ea5e9] transition-colors" size={17} />
                            <input type="text" placeholder="Search by URL or Company..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold focus:outline-none focus:ring-8 focus:ring-[#0ea5e9]/5 focus:border-[#0ea5e9] transition-all shadow-sm" />
                        </div>
                        <button onClick={() => activeTab === 'leads' ? fetchIncompleteLeads(searchTerm, currentPage) : fetchPendingPocs(searchTerm, currentPage)} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-[#0ea5e9] hover:bg-sky-50 transition-all shadow-sm">
                            <RefreshCw size={20} className={fetching ? 'animate-spin text-[#0ea5e9]' : ''} />
                        </button>
                    </div>
                </div>

                <div className="flex gap-2 bg-slate-100/50 p-1.5 rounded-2xl w-fit">
                    <button onClick={() => { setActiveTab('leads'); setCurrentPage(1); setRejectedPage(1); }} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'leads' ? 'bg-white text-[#0ea5e9] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Pending Companies</button>
                    <button onClick={() => { setActiveTab('pocs'); setCurrentPage(1); setRejectedPage(1); }} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'pocs' ? 'bg-white text-[#0ea5e9] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Pending Contacts</button>
                </div>
                {activeTab === 'leads' && (
                    <div className="flex gap-2 bg-slate-100/50 p-1.5 rounded-2xl w-fit mt-2">
                        <button onClick={() => { setShowDuplicates(false); setCurrentPage(1); }} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${!showDuplicates ? 'bg-white text-[#0ea5e9] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>All Companies</button>
                        <button onClick={() => { setShowDuplicates(true); setCurrentPage(1); }} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${showDuplicates ? 'bg-white text-[#0ea5e9] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Duplicate Companies</button>
                    </div>
                )}

                {/* Pending Table */}
                <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/40 overflow-visible">
                    <div className="overflow-x-auto overflow-visible">
                        <table className="w-full text-left border-collapse">
                            {tableHeader}
                            <tbody className="divide-y divide-slate-50">
                                {fetching && pendingItems.length === 0 ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td className="px-8 py-6"><div className="h-4 bg-slate-100 rounded-lg w-48"></div></td>
                                            <td className="px-8 py-6"><div className="h-4 bg-slate-100 rounded-lg w-32"></div></td>
                                            <td className="px-8 py-6"><div className="h-4 bg-slate-100 rounded-lg w-24"></div></td>
                                            <td className="px-8 py-6"><div className="h-4 bg-slate-100 rounded-lg w-24"></div></td>
                                            <td className="px-8 py-6 text-right"><div className="h-10 bg-slate-100 rounded-xl w-28 ml-auto"></div></td>
                                        </tr>
                                    ))
                                ) : pendingItems.length > 0 ? (
                                    <>
                                        {activeTab === 'leads' && showDuplicates && (
                                            <tr className="bg-slate-100">
                                                <td colSpan={5} className="px-8 py-2 text-sm font-bold text-slate-600">Duplicate Companies</td>
                                            </tr>
                                        )}
                                        {filteredPending.map((item: any) => renderRow(item, false))}
                                    </>
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-20 text-center">
                                            <div className="flex flex-col items-center">
                                                <div className="w-20 h-20 bg-slate-50 rounded-3xl mb-4 flex items-center justify-center text-slate-200 border border-slate-100">
                                                    <AlertCircle size={40} />
                                                </div>
                                                <h4 className="text-lg font-black text-[#0f1c2e]">{searchTerm ? 'No results found' : 'Queue clear!'}</h4>
                                                <p className="text-slate-400 font-bold text-sm max-w-[240px] mt-2">
                                                    {searchTerm ? `Nothing matches "${searchTerm}".` : `No pending ${activeTab === 'pocs' ? 'contacts' : 'companies'} require approval.`}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {totalPages > 1 && renderPagination()}
                </div>

                {/* ── Rejected Section (collapsible) ── */}
                {rejectedItems.length > 0 && (
                    <div ref={rejectedSectionRef} className="border border-rose-100 rounded-3xl overflow-hidden shadow-sm">
                        <button
                            onClick={() => setShowRejected(prev => !prev)}
                            className="w-full flex items-center justify-between px-6 py-4 bg-rose-50/60 hover:bg-rose-50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-rose-500 flex items-center justify-center text-white shadow-sm shadow-rose-500/30">
                                    <XCircle size={16} />
                                </div>
                                <div className="text-left">
                                    <p className="text-sm font-black text-rose-700">Rejected {activeTab === 'leads' ? 'Companies' : 'Contacts'}</p>
                                    <p className="text-[0.6rem] font-bold text-rose-400 uppercase tracking-widest">{rejectedItems.length} item{rejectedItems.length !== 1 ? 's' : ''} — click to {showRejected ? 'collapse' : 'expand'}</p>
                                </div>
                            </div>
                            <div className="text-rose-400">
                                {showRejected ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </div>
                        </button>
                        {showRejected && (
                            <>
                                <div className="bg-white overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        {rejectedTableHeader}
                                        <tbody className="divide-y divide-rose-50/50">
                                            {rejectedItems.map((item: any) => renderRow(item, true))}
                                        </tbody>
                                    </table>
                                </div>
                                {rejectedTotalPages > 1 && renderRejectedPagination()}
                            </>
                        )}
                    </div>
                )}
            </div>

            <AddIncompleteLeadModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setDuplicateData(null); }}
                onSuccess={() => {
                    if (activeTab === 'leads') {
                        fetchIncompleteLeads(searchTerm, currentPage);
                    } else {
                        fetchPendingPocs(searchTerm, currentPage);
                    }
                }}
                leadId={selectedLeadId}
                isPocOnly={isPocOnlyMode}
                duplicateData={duplicateData}
            />

            <MergeDuplicateModal
                isOpen={!!mergeModalLeadId}
                onClose={() => setMergeModalLeadId(null)}
                onSuccess={() => {
                    if (activeTab === 'leads') {
                        fetchIncompleteLeads(searchTerm, currentPage);
                    } else {
                        fetchPendingPocs(searchTerm, currentPage);
                    }
                }}
                duplicateLeadId={mergeModalLeadId || ''}
            />

{assigneeFilterOpen && createPortal(
  <>
    {/* backdrop to close on outside click */}
    <div className="fixed inset-0 z-[998]" onClick={() => setAssigneeFilterOpen(false)} />
    <div
      style={{ position: 'absolute', top: dropdownPos.top, left: dropdownPos.left }}
      className="w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-[999]"
    >
      <div className="p-2 border-b border-slate-200">
        <input
          type="text"
          placeholder="Search…"
          value={assigneeSearch}
          onChange={e => setAssigneeSearch(e.target.value)}
          className="w-full border border-slate-300 rounded px-2 py-1 text-sm mb-1"
          autoFocus
        />
        <div className="flex gap-2">
          <button onClick={() => setSelectedAssignees(new Set(assigneeOptions))} className="text-xs text-slate-600 hover:underline">Select All</button>
          <button onClick={() => setSelectedAssignees(new Set())} className="text-xs text-slate-600 hover:underline">Deselect All</button>
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {assigneeOptions.filter(o => o.toLowerCase().includes(assigneeSearch.toLowerCase())).map(option => (
          <label key={option} className="flex items-center px-3 py-1.5 text-sm hover:bg-slate-100 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedAssignees.has(option)}
              onChange={() => {
                const s = new Set(selectedAssignees);
                s.has(option) ? s.delete(option) : s.add(option);
                setSelectedAssignees(s);
              }}
              className="mr-2"
            />
            {option}
          </label>
        ))}
      </div>
      <div className="p-2 border-t border-slate-200 text-center">
        <button onClick={() => setAssigneeFilterOpen(false)} className="text-sm text-slate-600 hover:underline">Close</button>
      </div>
    </div>
  </>,
  document.body
)}
            {/* Check URL Modal */}
            {isCheckModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center text-[#0ea5e9]">
                                <Globe size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-[#0f1c2e]">Check Lead Existence</h3>
                                <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Verify lead existence before adding POC</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest ml-1">Company Website URL or Name</label>
                                <input type="text" placeholder="example.com or Demo Corp" value={checkUrl} onChange={(e) => setCheckUrl(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-[#0ea5e9]/10 focus:border-[#0ea5e9] transition-all" onKeyPress={(e) => e.key === 'Enter' && handleCheckUrl()} />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                <button onClick={() => { setIsCheckModalOpen(false); setCheckUrl(''); }} className="flex-1 px-6 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all">
                                    Cancel
                                </button>
                                <button onClick={handleCheckUrl} disabled={checking} className="flex-1 bg-[#0ea5e9] text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all hover:bg-[#0284c7] shadow-lg shadow-sky-500/20 disabled:opacity-50 flex items-center justify-center gap-2">
                                    {checking && <RefreshCw size={14} className="animate-spin" />}
                                    {checking ? 'Checking...' : 'Check & Proceed'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            
        
        
        </div>
    );
};

export default AddLeadTab;
