import React, { useState, useEffect } from 'react';
import {
    X, Plus, Globe, Building2, Mail, Linkedin, Briefcase, Users, User, RefreshCw, AlertCircle, Check, Search,
    Sparkles, Phone, Send, Handshake, Trophy, XCircle, UserCheck, Timer, Target, TrendingUp, Calendar
} from 'lucide-react';
import { API_BASE_URL } from '../../config';
import toast from 'react-hot-toast';

interface POC {
    _id?: string;
    name: string;
    designation: string;
    phone: string;
    alternate_phone: string;
    email: string;
    linkedin_url: string;
    stage: string;
    approvalStatus: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    leadId?: string | null;
    isPocOnly?: boolean;
    duplicateData?: { company_name: string; website_url: string } | null;
}

const STAGES = [
    "New", "Contacted", "Proposal Sent", "Negotiation", "Won", "Lost", "Onboarded", "No vendor", "Future Reference"
];

const POC_STAGES = ["New", "Contacted", "Busy", "No Answer", "Wrong Number"];

const AddIncompleteLeadModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, leadId, isPocOnly = false, duplicateData }) => {
    const [formData, setFormData] = useState({
        company_name: '',
        company_email: '',
        website_url: '',
        company_size: '',
        industry_name: '',
        linkedin_link: '',
        stage: 'New',
        assignedTo: [] as string[],
        points_of_contact: [{ name: '', designation: '', phone: '', alternate_phone: '', email: '', linkedin_url: '', stage: 'New', approvalStatus: 'pending' }] as POC[]
    });

    const [users, setUsers] = useState<any[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchingLead, setFetchingLead] = useState(false);
    const currentUserRole = JSON.parse(localStorage.getItem('user') || '{}')?.role;
    const isBD = currentUserRole === 'BD Executive';

    useEffect(() => {
        if (isOpen) {
            fetchUsers();
            if (leadId) {
                fetchLeadDetails(leadId);
            } else {
                const currentUserData = localStorage.getItem('user');
                const currentUser = currentUserData ? JSON.parse(currentUserData) : null;
                const currentUserId = currentUser?._id || currentUser?.id;
                const initialAssignedTo = currentUserId ? [currentUserId] : [];

                setFormData({
                    company_name: duplicateData?.company_name || '',
                    company_email: '',
                    website_url: duplicateData?.website_url || '',
                    company_size: '',
                    industry_name: '',
                    linkedin_link: '',
                    stage: 'New',
                    assignedTo: initialAssignedTo,
                    points_of_contact: [{ name: '', designation: '', phone: '', alternate_phone: '', email: '', linkedin_url: '', stage: 'New', approvalStatus: 'pending' }]
                });
            }
        }
    }, [isOpen, leadId, duplicateData]);

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

    const fetchLeadDetails = async (id: string) => {
        try {
            setFetchingLead(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/leads/${id}?includePending=true`, {
                headers: { 'x-auth-token': token || '' }
            });
            if (response.ok) {
                const data = await response.json();
                setFormData({
                    company_name: data.company_name || '',
                    company_email: data.company_email || '',
                    website_url: data.website_url || '',
                    company_size: data.company_size || '',
                    industry_name: data.industry_name || '',
                    linkedin_link: data.linkedin_link || '',
                    stage: data.stage || 'New',
                    assignedTo: data.assignedTo?.map((u: any) => u._id) || [],
                    points_of_contact: data.points_of_contact?.length
                        ? data.points_of_contact.map((poc: any) => ({ ...poc, linkedin_url: poc.linkedin_url || '' }))
                        : [{ name: '', designation: '', phone: '', email: '', linkedin_url: '', stage: 'New' }]
                });
            }
        } catch (err) {
            toast.error('Failed to fetch lead details');
        } finally {
            setFetchingLead(false);
        }
    };

    const filteredUsers = users.filter(u =>
        (u.name?.toLowerCase() || '').includes(userSearch.toLowerCase()) ||
        (u.role?.toLowerCase() || '').includes(userSearch.toLowerCase())
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const toggleAssignee = (userId: string) => {
        setFormData(prev => {
            const isAssigned = prev.assignedTo.includes(userId);
            if (isAssigned) {
                return { ...prev, assignedTo: prev.assignedTo.filter(id => id !== userId) };
            } else {
                return { ...prev, assignedTo: [...prev.assignedTo, userId] };
            }
        });
    };

    const updatePOC = (index: number, field: string, value: string) => {
        const newPOCs = [...formData.points_of_contact];
        newPOCs[index] = { ...newPOCs[index], [field]: value };
        setFormData(prev => ({ ...prev, points_of_contact: newPOCs }));
    };

    const addPOC = () => {
        setFormData(prev => ({
            ...prev,
            points_of_contact: [...prev.points_of_contact, { name: '', designation: '', phone: '', alternate_phone: '', email: '', linkedin_url: '', stage: 'New', approvalStatus: 'pending' }]
        }));
    };

    const removePOC = (index: number) => {
        if (formData.points_of_contact.length === 1) return;
        const newPOCs = formData.points_of_contact.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, points_of_contact: newPOCs }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.website_url && !formData.company_name) {
            toast.error('Either Website URL or Company Name is mandatory');
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            const phones = new Set();
            for (const poc of formData.points_of_contact) {
                const checkPhone = (p: string) => {
                    if (p && p.trim()) {
                        const trimmed = p.trim();
                        if (phones.has(trimmed)) {
                            toast.error(`Duplicate phone number: ${trimmed}`);
                            return false;
                        }
                        phones.add(trimmed);
                    }
                    return true;
                };
                if (!checkPhone(poc.phone)) return;
                if (!checkPhone(poc.alternate_phone)) return;
            }

            const cleanedPocs = formData.points_of_contact.filter(poc => poc.name || poc.phone || poc.alternate_phone || poc.email || poc.linkedin_url);

            const url = leadId ? `${API_BASE_URL}/api/leads/${leadId}` : `${API_BASE_URL}/api/leads`;
            const method = leadId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token || ''
                },
                body: JSON.stringify({
                    ...formData,
                    company_name: formData.company_name?.trim() || '',
                    company_email: formData.company_email?.trim() || '',
                    website_url: formData.website_url?.trim() || '',
                    company_size: formData.company_size?.trim() || '',
                    industry_name: formData.industry_name?.trim() || '',
                    linkedin_link: formData.linkedin_link?.trim() || '',
                    points_of_contact: cleanedPocs.map(poc => ({
                        ...poc,
                        name: poc.name?.trim() || '',
                        designation: poc.designation?.trim() || '',
                        phone: poc.phone?.trim() || '',
                        alternate_phone: poc.alternate_phone?.trim() || '',
                        email: poc.email?.trim() || '',
                        linkedin_url: poc.linkedin_url?.trim() || '',
                    })),
                    status: isPocOnly ? undefined : (leadId ? undefined : 'incomplete')
                })
            });

            if (response.ok) {
                const responseData = await response.json();
                if (responseData.isDuplicate) {
                    toast.success('Submitted as a duplicate for Admin review!');
                } else {
                    toast.success(leadId ? 'Company updated successfully!' : 'Company added successfully!');
                }
                onSuccess();
                onClose();
            } else {
                const data = await response.json();
                throw new Error(data.message || 'Failed to process lead');
            }
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-black text-[#0f1c2e]">{isPocOnly ? 'Add Points of Contact' : leadId ? 'Edit Incomplete Company' : 'Add New Incomplete Company'}</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{isPocOnly ? `Adding POCs for ${formData.company_name}` : leadId ? 'Modify existing lead data' : 'Fill details for later approval'}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                        <X size={24} />
                    </button>
                </div>

                {/* Form Body */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    {fetchingLead ? (
                        <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <RefreshCw className="animate-spin text-[#0ea5e9]" size={24} />
                            </div>
                            <span className="text-sm font-bold text-slate-400">Fetching lead details...</span>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-100 rounded-xl w-fit">
                                    <AlertCircle size={16} className="text-amber-500" />
                                    <span className="text-[0.65rem] font-black text-amber-700 uppercase tracking-wide">{isPocOnly ? 'Populate at least one field for the POC' : 'Either Website URL or Company Name is Mandatory'}</span>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl w-fit">
                                    <Timer size={14} className="text-slate-400" />
                                    <span className="text-[0.65rem] font-black text-slate-500 uppercase tracking-wide">Ready for Pipeline</span>
                                </div>
                            </div>

                            <div className="space-y-4 mb-8">
                                <div className="flex items-center gap-3 mb-2 px-1">
                                    <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                                        <TrendingUp size={14} />
                                    </div>
                                    <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-[0.2em]">Lifecycle Pipeline</label>
                                </div>
                                <div className="flex gap-2 pb-2 overflow-x-auto scrollbar-hide snap-x select-none px-1 bg-slate-50/50 p-2.5 rounded-3xl border border-slate-100">
                                    {STAGES.map((s) => {
                                        const isActive = formData.stage === s;

                                        const getIcon = () => {
                                            switch (s) {
                                                case 'New': return <Sparkles size={14} />;
                                                case 'Contacted': return <Phone size={14} />;
                                                case 'Proposal Sent': return <Send size={14} />;
                                                case 'Negotiation': return <Handshake size={14} />;
                                                case 'Won': return <Trophy size={14} />;
                                                case 'Lost': return <XCircle size={14} />;
                                                case 'Onboarded': return <UserCheck size={14} />;
                                                case 'No vendor': return <AlertCircle size={14} />;
                                                case 'Future Reference': return <Calendar size={14} />;
                                                default: return <Target size={14} />;
                                            }
                                        };

                                        const baseClass = "group relative px-4 py-3 rounded-2xl text-[0.55rem] font-bold uppercase tracking-wider border transition-all duration-300 flex items-center gap-2 overflow-hidden flex-shrink-0 snap-center";

                                        let styleClass = "";
                                        if (isActive) {
                                            if (s === 'Won') styleClass = "bg-emerald-500 text-white border-transparent shadow-lg shadow-emerald-500/20 font-black";
                                            else if (s === 'Lost') styleClass = "bg-rose-500 text-white border-transparent shadow-lg shadow-rose-500/20 font-black";
                                            else styleClass = "bg-[#0ea5e9] text-white border-transparent shadow-lg shadow-sky-500/20 font-black";
                                        } else {
                                            styleClass = "bg-white text-slate-500 border-slate-100 hover:bg-slate-100 hover:text-slate-700";
                                        }

                                        return (
                                            <button
                                                key={s}
                                                type="button"
                                                disabled={isPocOnly}
                                                onClick={() => setFormData(prev => ({ ...prev, stage: s }))}
                                                className={`${baseClass} ${styleClass} min-w-[100px] ${isPocOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                                                    {getIcon()}
                                                </div>
                                                <span className="text-center leading-tight whitespace-nowrap">{s}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Column 1: Core Info */}
                                <div className={`${(isBD && !isPocOnly) ? 'lg:col-span-3' : 'lg:col-span-2'} grid grid-cols-1 md:grid-cols-2 gap-6`}>
                                    <div className="space-y-1.5">
                                        <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider ml-1">Website URL</label>
                                        <div className="relative group">
                                            <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0ea5e9] transition-colors" size={17} />
                                            <input
                                                name="website_url"
                                                type="text"
                                                placeholder="example.com"
                                                readOnly={isPocOnly || !!duplicateData}
                                                value={formData.website_url}
                                                onChange={handleInputChange}
                                                className={`w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-11 pr-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/5 focus:border-[#0ea5e9] transition-all ${isPocOnly ? 'opacity-70 cursor-not-allowed grayscale-[0.3]' : ''}`}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider ml-1">Company Name</label>
                                        <div className="relative group">
                                            <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0ea5e9] transition-colors" size={17} />
                                            <input
                                                name="company_name"
                                                type="text"
                                                placeholder="Company Ltd"
                                                readOnly={isPocOnly || !!duplicateData}
                                                value={formData.company_name}
                                                onChange={handleInputChange}
                                                className={`w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-11 pr-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/5 focus:border-[#0ea5e9] transition-all ${isPocOnly ? 'opacity-70 cursor-not-allowed grayscale-[0.3]' : ''}`}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider ml-1">Company Email</label>
                                        <div className="relative group">
                                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0ea5e9] transition-colors" size={17} />
                                            <input
                                                name="company_email"
                                                type="email"
                                                placeholder="hr@example.com"
                                                readOnly={isPocOnly}
                                                value={formData.company_email}
                                                onChange={handleInputChange}
                                                className={`w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-11 pr-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/5 focus:border-[#0ea5e9] transition-all ${isPocOnly ? 'opacity-70 cursor-not-allowed grayscale-[0.3]' : ''}`}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider ml-1">Industry</label>
                                        <div className="relative group">
                                            <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0ea5e9] transition-colors" size={17} />
                                            <input
                                                name="industry_name"
                                                type="text"
                                                placeholder="IT / Services"
                                                readOnly={isPocOnly}
                                                value={formData.industry_name}
                                                onChange={handleInputChange}
                                                className={`w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-11 pr-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/5 focus:border-[#0ea5e9] transition-all ${isPocOnly ? 'opacity-70 cursor-not-allowed grayscale-[0.3]' : ''}`}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider ml-1">LinkedIn Link</label>
                                        <div className="relative group">
                                            <Linkedin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0077b5] transition-colors" size={17} />
                                            <input
                                                name="linkedin_link"
                                                type="text"
                                                placeholder="linkedin.com/company/..."
                                                readOnly={isPocOnly}
                                                value={formData.linkedin_link}
                                                onChange={handleInputChange}
                                                className={`w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-11 pr-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/5 focus:border-[#0ea5e9] transition-all ${isPocOnly ? 'opacity-70 cursor-not-allowed grayscale-[0.3]' : ''}`}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider ml-1">Team Size</label>
                                        <div className="relative group">
                                            <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0ea5e9] transition-colors" size={17} />
                                            <input
                                                name="company_size"
                                                type="text"
                                                placeholder="50-200"
                                                readOnly={isPocOnly}
                                                value={formData.company_size}
                                                onChange={handleInputChange}
                                                className={`w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-11 pr-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/5 focus:border-[#0ea5e9] transition-all ${isPocOnly ? 'opacity-70 cursor-not-allowed grayscale-[0.3]' : ''}`}
                                            />
                                        </div>
                                    </div>

                                </div>

                                {/* Column 2: Multi-Assignee Selection */}
                                {(isBD || isPocOnly) ? (
                                    <div className="space-y-3">
                                        <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                            <User size={14} className="text-[#0ea5e9]" />
                                            Assigned To
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {formData.assignedTo.length > 0 ? formData.assignedTo.map(id => {
                                                const u = users.find(user => user._id === id);
                                                if (!u) return null;
                                                return (
                                                    <div key={id} className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                                                        <div className="w-5 h-5 rounded-md bg-white flex items-center justify-center font-black text-[0.55rem] text-slate-600 shadow-sm">
                                                            {u.name?.[0] || '?'}
                                                        </div>
                                                        <span className="text-xs font-bold text-slate-600">{u.name || 'Unknown'}</span>
                                                    </div>
                                                );
                                            }) : (
                                                <span className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">No users assigned</span>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                            <User size={14} className="text-[#0ea5e9]" />
                                            Assign To (Multiple)
                                        </label>
                                        <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden flex flex-col h-[300px]">
                                            <div className="p-3 border-b border-slate-200 bg-white/50">
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                    <input
                                                        type="text"
                                                        placeholder="Search employees..."
                                                        value={userSearch}
                                                        onChange={(e) => setUserSearch(e.target.value)}
                                                        className="w-full bg-white border border-slate-200 rounded-lg py-1.5 pl-9 pr-3 text-[0.7rem] font-bold focus:border-[#0ea5e9] transition-all outline-none"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                                {filteredUsers.length > 0 ? filteredUsers.map((u) => (
                                                    <div
                                                        key={u._id}
                                                        onClick={() => toggleAssignee(u._id)}
                                                        className={`flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer ${formData.assignedTo.includes(u._id)
                                                            ? 'bg-[#0ea5e9] text-white shadow-lg shadow-sky-500/20'
                                                            : 'hover:bg-white text-slate-600'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-[0.6rem] ${formData.assignedTo.includes(u._id) ? 'bg-white/20' : 'bg-slate-200'
                                                                }`}>
                                                                {u.name?.[0] || '?'}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[0.7rem] font-black leading-none">{u.name}</span>
                                                                <span className={`text-[0.6rem] font-bold ${formData.assignedTo.includes(u._id) ? 'text-white/70' : 'text-slate-400'}`}>{u.role}</span>
                                                            </div>
                                                        </div>
                                                        {formData.assignedTo.includes(u._id) && <Check size={14} strokeWidth={4} />}
                                                    </div>
                                                )) : (
                                                    <div className="p-8 text-center text-slate-400 text-xs font-bold">No users found</div>
                                                )}
                                            </div>
                                            <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between">
                                                <span className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest">{formData.assignedTo.length} Selected</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, assignedTo: [] }))}
                                                    className="text-[0.6rem] font-black text-rose-500 uppercase hover:underline"
                                                >
                                                    Clear All
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* POC Management */}
                            <div className="space-y-4 pt-6 border-t border-slate-100">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Points of Contact</h3>
                                    <button type="button" onClick={addPOC} className="text-xs font-bold text-[#0ea5e9] flex items-center gap-1.5 hover:underline decoration-2 underline-offset-4">
                                        <Plus size={14} /> Add POC
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {formData.points_of_contact.map((poc, idx) => (
                                        <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl relative group/poc grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                                            {formData.points_of_contact.length > 1 && !(poc as any)._id && (
                                                <button type="button" onClick={() => removePOC(idx)} className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg transform scale-0 group-hover/poc:scale-100 transition-all z-10">
                                                    <X size={12} strokeWidth={4} />
                                                </button>
                                            )}
                                            <div className="space-y-1">
                                                <input type="text" placeholder="Name" value={poc.name} onChange={(e) => updatePOC(idx, 'name', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[0.7rem] font-bold outline-none focus:border-[#0ea5e9]" />
                                            </div>
                                            <div className="space-y-1">
                                                <input type="text" placeholder="Phone" value={poc.phone} onChange={(e) => updatePOC(idx, 'phone', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[0.7rem] font-bold outline-none focus:border-[#0ea5e9]" />
                                            </div>
                                            <div className="space-y-1">
                                                <input type="text" placeholder="Alt Phone" value={poc.alternate_phone} onChange={(e) => updatePOC(idx, 'alternate_phone', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[0.7rem] font-bold outline-none focus:border-[#0ea5e9]" />
                                            </div>
                                            <div className="space-y-1">
                                                <input type="email" placeholder="Email" value={poc.email} onChange={(e) => updatePOC(idx, 'email', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[0.7rem] font-bold outline-none focus:border-[#0ea5e9]" />
                                            </div>
                                            <div className="space-y-1">
                                                <input type="text" placeholder="LinkedIn URL" value={poc.linkedin_url} onChange={(e) => updatePOC(idx, 'linkedin_url', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[0.7rem] font-bold outline-none focus:border-[#0077b5]" />
                                            </div>
                                            <select value={poc.stage} onChange={(e) => updatePOC(idx, 'stage', e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[0.7rem] font-bold outline-none focus:border-[#0ea5e9] appearance-none cursor-pointer">
                                                {POC_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                {!fetchingLead && (
                    <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/30 flex justify-end gap-3">
                        <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all">
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="bg-[#0ea5e9] text-white px-8 py-2.5 rounded-xl font-black transition-all hover:bg-[#0284c7] shadow-xl shadow-sky-500/20 text-sm flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading && <RefreshCw size={18} className="animate-spin" />}
                            {loading ? 'Processing...' : leadId ? 'Update Lead' : 'Create Incomplete Lead'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AddIncompleteLeadModal;
