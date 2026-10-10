import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Phone, Mail, Building2, Calendar, ChevronLeft, CheckSquare, MessageCircle, Settings, Search, Activity, ChevronDown, Users, Plus, Linkedin, MessageSquare } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import toast from 'react-hot-toast';
import PostCallFeedbackModal from '../../components/modals/PostCallFeedbackModal';
import AddPOCModal from '../../components/modals/AddPOCModal';
import EditPOCModal from '../../components/modals/EditPOCModal';
import TaskModal from '../../components/modals/TaskModal';
import RemarkModal from '../../components/modals/RemarkModal';

interface POCData {
    poc: any;
    lead: any;
    remarks: any[];
    tasks: any[];
    activities: any[];
    calls: any[];
}

const ContactDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<POCData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [activeSubTab, setActiveSubTab] = useState('activity');
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [showAddPOCModal, setShowAddPOCModal] = useState(false);
    const [showEditPOCModal, setShowEditPOCModal] = useState(false);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [showRemarkModal, setShowRemarkModal] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [showScheduleDropdown, setShowScheduleDropdown] = useState(false);

    useEffect(() => {
        fetchContactDetails();
    }, [id]);

    const fetchContactDetails = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/leads/poc/${id}`, {
                headers: { 'x-auth-token': token || '' }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch contact');
            }
            const json = await response.json();
            setData(json);

            // Expand all by default
            const initialExpanded = new Set<string>();
            json.remarks.forEach((r: any) => initialExpanded.add(String(r._id)));
            json.tasks.forEach((t: any) => initialExpanded.add(String(t._id)));
            json.activities.forEach((a: any) => initialExpanded.add(String(a._id)));
            json.calls.forEach((c: any) => initialExpanded.add(String(c._id)));
            setExpandedIds(initialExpanded);
        } catch (err: any) {
            toast.error(err.message);
            if (err.message.includes('Forbidden') || err.message.includes('access')) {
                navigate(-1);
            }
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0ea5e9]"></div>
            </div>
        );
    }

    if (!data) return <div className="p-8 text-center font-bold text-slate-500">Contact not found or access denied.</div>;

    const { poc, lead, remarks, tasks, activities, calls } = data;

    // Combine and filter timeline items
    const timelineItems = [
        ...remarks.map(r => ({ type: 'remark', date: new Date(r.created_at), data: r })),
        ...tasks.map(t => ({ type: 'task', date: new Date(t.created_at), data: t })),
        ...activities.filter(a => a.type !== 'Call Logged').map(a => ({ type: 'activity', date: new Date(a.timestamp), data: a })),
        ...calls.map(c => ({ type: 'call', date: new Date(c.timestamp), data: c }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime())
        .filter(item => {
            if (activeSubTab === 'activity') return true;
            if (activeSubTab === 'calls') return item.type === 'call';
            if (activeSubTab === 'tasks') return item.type === 'task';
            return true;
        });

    const toggleExpand = (id: string) => {
        const idStr = String(id);
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(idStr)) next.delete(idStr);
            else next.add(idStr);
            return next;
        });
    };

    const toggleAll = (collapse: boolean) => {
        if (collapse) {
            setExpandedIds(new Set());
        } else {
            setExpandedIds(new Set(timelineItems.map(item => String(item.data._id))));
        }
    };

    return (
        <div className="h-full -m-4 sm:-m-6 lg:-m-8 flex flex-col bg-slate-50 overflow-hidden lg:rounded-tl-2xl lg:border-l lg:border-t border-slate-200">
            {/* Header */}
            <div className="flex-none px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 flex items-center gap-4 bg-white shadow-sm z-10">
                <button onClick={() => navigate(-1)} className="text-[#0ea5e9] hover:underline flex items-center text-sm font-bold tracking-wide">
                    <ChevronLeft size={16} /> Back
                </button>
            </div>

            {/* Mobile Header Summary (Visible only on mobile) */}
            <div className="lg:hidden flex-none px-4 py-3 sm:px-6 sm:py-4 bg-white border-b border-slate-200 shadow-sm animate-in slide-in-from-top-2">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0ea5e9] to-[#0184c7] flex items-center justify-center text-white text-lg font-bold shadow-sm flex-none">
                        {poc.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-lg font-extrabold text-[#0f1c2e] leading-tight truncate">{poc.name}</h2>
                        <p className="text-[0.65rem] text-slate-500 font-bold tracking-wide uppercase mt-0.5 truncate">{poc.designation}</p>
                    </div>
                </div>

                {/* Mobile Action Hub */}
                <div className="grid grid-cols-3 gap-y-4 gap-x-2 items-center px-1">
                    {poc.email && (
  <a href={`mailto:${poc.email}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1.5 text-slate-500 hover:text-[#0ea5e9] transition-colors text-center w-full min-w-0">
    <Mail size={16} className="p-2 box-content bg-slate-50 rounded-full border border-slate-200 shadow-sm" />
    <span className="text-[0.6rem] font-bold truncate w-full">Email</span>
  </a>
)}
                    <a href={`tel:${poc.phone}`} onClick={() => setShowFeedbackModal(true)} className="flex flex-col items-center gap-1.5 text-slate-500 hover:text-[#0ea5e9] transition-colors text-center w-full min-w-0"><Phone size={16} className="p-2 box-content bg-slate-50 rounded-full border border-slate-200 shadow-sm" /><span className="text-[0.6rem] font-bold truncate w-full">Call</span></a>
                    <button onClick={() => setShowRemarkModal(true)} className="flex flex-col items-center gap-1.5 text-slate-500 hover:text-emerald-500 transition-colors text-center w-full min-w-0"><MessageSquare size={16} className="p-2 box-content bg-slate-50 rounded-full border border-slate-200 shadow-sm" /><span className="text-[0.6rem] font-bold truncate w-full">Remark</span></button>
                    <button onClick={() => setShowTaskModal(true)} className="flex flex-col items-center gap-1.5 text-slate-500 hover:text-[#0ea5e9] transition-colors text-center w-full min-w-0"><CheckSquare size={16} className="p-2 box-content bg-slate-50 rounded-full border border-slate-200 shadow-sm" /><span className="text-[0.6rem] font-bold truncate w-full">Task</span></button>
                    <div className="relative flex flex-col items-center min-w-0">
                        <button
                            onClick={() => setShowScheduleDropdown(!showScheduleDropdown)}
                            className="flex flex-col items-center gap-1.5 text-slate-500 hover:text-[#0ea5e9] transition-colors text-center w-full min-w-0"
                        >
                            <Calendar size={16} className="p-2 box-content bg-slate-50 rounded-full border border-slate-200 shadow-sm" />
                            <span className="text-[0.6rem] font-bold truncate w-full">Schedule</span>
                        </button>
                        {showScheduleDropdown && (
                            <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-white rounded-xl border border-slate-200 shadow-xl p-2 z-50 min-w-[140px] animate-in zoom-in-95 duration-200">
                                <a
                                    href={`https://calendar.google.com/calendar/r/eventedit?text=Meeting+with+${encodeURIComponent(poc.name)}&add=${encodeURIComponent(poc.email)}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-[0.65rem] font-bold text-slate-600 transition-colors"
                                    onClick={() => setShowScheduleDropdown(false)}
                                >
                                    <div className="w-5 h-5 rounded bg-blue-50 flex items-center justify-center text-blue-500"><Calendar size={10} /></div>
                                    Google Meet
                                </a>
                                <a
                                    href={`https://outlook.office.com/calendar/0/deeplink/compose?subject=Meeting+with+${encodeURIComponent(poc.name)}&body=Meeting+discussion&to=${encodeURIComponent(poc.email)}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-[0.65rem] font-bold text-slate-600 transition-colors"
                                    onClick={() => setShowScheduleDropdown(false)}
                                >
                                    <div className="w-5 h-5 rounded bg-indigo-50 flex items-center justify-center text-indigo-500"><Calendar size={10} /></div>
                                    Outlook Meet
                                </a>
                            </div>
                        )}
                    </div>
                    <a href={`https://wa.me/${poc.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1.5 text-slate-500 hover:text-[#25D366] transition-colors text-center w-full min-w-0"><MessageCircle size={16} className="p-2 box-content bg-slate-50 rounded-full border border-slate-200 shadow-sm" /><span className="text-[0.6rem] font-bold truncate w-full">WhatsApp</span></a>
                </div>
            </div>

            {/* Main Layout */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

                {/* Left Sidebar (Hidden on mobile) */}
                <div className="hidden lg:block w-[300px] flex-none border-r border-slate-200 overflow-y-auto bg-white p-6 custom-scrollbar">
                    <div className="flex items-center gap-4 mb-5">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0ea5e9] to-[#0184c7] flex items-center justify-center text-white text-xl font-bold shadow-md ring-4 ring-slate-50">
                            {poc.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-[#0f1c2e] tracking-tight">{poc.name}</h2>
                            <p className="text-xs text-slate-500 font-bold mt-0.5">{poc.designation}</p>
                            <p className="text-[0.65rem] text-slate-400 font-medium">at {lead.company_name}</p>
                        </div>
                    </div>

                    {/* Action Hub */}
                    <div className="grid grid-cols-3 gap-y-6 gap-x-2 items-center mb-8 px-1">
                        <a href={`mailto:${poc.email}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1.5 text-slate-500 hover:text-[#0ea5e9] transition-colors text-center w-full min-w-0"><Mail size={16} className="p-2 box-content bg-slate-50 rounded-full border border-slate-200" /><span className="text-[0.65rem] font-bold truncate w-full">Email</span></a>
                        <a href={`tel:${poc.phone}`} onClick={() => setShowFeedbackModal(true)} className="flex flex-col items-center gap-1.5 text-slate-500 hover:text-[#0ea5e9] transition-colors text-center w-full min-w-0"><Phone size={16} className="p-2 box-content bg-slate-50 rounded-full border border-slate-200" /><span className="text-[0.65rem] font-bold truncate w-full">Call</span></a>
                        <button onClick={() => setShowRemarkModal(true)} className="flex flex-col items-center gap-1.5 text-slate-500 hover:text-emerald-500 transition-colors text-center w-full min-w-0"><MessageSquare size={16} className="p-2 box-content bg-slate-50 rounded-full border border-slate-200" /><span className="text-[0.65rem] font-bold truncate w-full">Remark</span></button>
                        <button onClick={() => setShowTaskModal(true)} className="flex flex-col items-center gap-1.5 text-slate-500 hover:text-[#0ea5e9] transition-colors text-center w-full min-w-0"><CheckSquare size={16} className="p-2 box-content bg-slate-50 rounded-full border border-slate-200" /><span className="text-[0.65rem] font-bold truncate w-full">Task</span></button>
                        <div className="relative flex flex-col items-center min-w-0">
                            <button
                                onClick={() => setShowScheduleDropdown(!showScheduleDropdown)}
                                className="flex flex-col items-center gap-1.5 text-slate-500 hover:text-[#0ea5e9] transition-colors text-center w-full min-w-0"
                            >
                                <Calendar size={16} className="p-2 box-content bg-slate-50 rounded-full border border-slate-200" />
                                <span className="text-[0.65rem] font-bold truncate w-full">Schedule</span>
                            </button>
                            {showScheduleDropdown && (
                                <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-white rounded-xl border border-slate-200 shadow-xl p-2 z-50 min-w-[140px] animate-in zoom-in-95 duration-200">
                                    <a
                                        href={`https://calendar.google.com/calendar/r/eventedit?text=Meeting+with+${encodeURIComponent(poc.name)}&add=${encodeURIComponent(poc.email)}`}
                                        target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-[0.7rem] font-bold text-slate-600 transition-colors"
                                        onClick={() => setShowScheduleDropdown(false)}
                                    >
                                        <div className="w-6 h-6 rounded bg-blue-50 flex items-center justify-center text-blue-500"><Calendar size={12} /></div>
                                        Google Meet
                                    </a>
                                    <a
                                        href={`https://outlook.office.com/calendar/0/deeplink/compose?subject=Meeting+with+${encodeURIComponent(poc.name)}&body=Meeting+discussion&to=${encodeURIComponent(poc.email)}`}
                                        target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-[0.7rem] font-bold text-slate-600 transition-colors"
                                        onClick={() => setShowScheduleDropdown(false)}
                                    >
                                        <div className="w-6 h-6 rounded bg-indigo-50 flex items-center justify-center text-indigo-500"><Calendar size={12} /></div>
                                        Outlook Meet
                                    </a>
                                </div>
                            )}
                        </div>
                        <a href={`https://wa.me/${poc.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1.5 text-slate-500 hover:text-[#25D366] transition-colors text-center w-full min-w-0"><MessageCircle size={16} className="p-2 box-content bg-slate-50 rounded-full border border-slate-200" /><span className="text-[0.65rem] font-bold truncate w-full">WhatsApp</span></a>
                    </div>

                    {/* About section */}
                    <div className="space-y-4">
                        <div
                            onClick={() => setShowEditPOCModal(true)}
                            className="flex items-center justify-between group cursor-pointer border-b border-slate-100 pb-2 hover:bg-slate-50 transition-colors px-1 -mx-1 rounded"
                        >
                            <h3 className="text-sm font-extrabold text-[#0f1c2e]">About this contact</h3>
                            <Settings size={14} className="text-slate-400 group-hover:text-[#0ea5e9] transition-colors" />
                        </div>

                        <div className="space-y-4 pt-1">
                            <div>
                                <p className="text-[0.65rem] uppercase tracking-wider text-slate-500 font-bold mb-1">Email</p>
                                <p className="text-xs font-bold text-[#0ea5e9] truncate hover:underline cursor-pointer">{poc.email || 'No email'}</p>
                            </div>
                            <div>
                                <p className="text-[0.65rem] uppercase tracking-wider text-slate-500 font-bold mb-1">Phone Number</p>
                                <p className="text-xs font-bold text-[#0f1c2e]">{poc.phone}</p>
                            </div>
                            <div>
                                <p className="text-[0.65rem] uppercase tracking-wider text-slate-500 font-bold mb-1">Contact owner</p>
                                <p className="text-xs font-bold text-[#0f1c2e] bg-slate-100 inline-block px-2 py-1 rounded-md">{lead.assignedBy?.name || 'Unknown'}</p>
                            </div>
                            <div>
                                <p className="text-[0.65rem] uppercase tracking-wider text-slate-500 font-bold mb-1">Company Name</p>
                                <p className="text-xs font-bold text-[#0ea5e9] hover:underline cursor-pointer block truncate">{lead.company_name}</p>
                            </div>
                            <div>
                                <p className="text-[0.65rem] uppercase tracking-wider text-slate-500 font-bold mb-1">Industry</p>
                                <p className="text-xs font-semibold text-[#0f1c2e]">{lead.industry_name || '--'}</p>
                            </div>
                            <div>
                                <p className="text-[0.65rem] uppercase tracking-wider text-slate-500 font-bold mb-1">Job Title</p>
                                <p className="text-xs font-semibold text-[#0f1c2e]">{poc.designation || '--'}</p>
                            </div>
                            {poc.linkedin_url && (
                                <div>
                                    <p className="text-[0.65rem] uppercase tracking-wider text-slate-500 font-bold mb-1">LinkedIn</p>
                                    <a
                                        href={poc.linkedin_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-bold text-[#0ea5e9] hover:underline flex items-center gap-1.5"
                                    >
                                        <Linkedin size={12} /> View Profile
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Middle Content */}
                <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc] border-r border-slate-200 overflow-hidden">
                    {/* Tabs */}
                    <div className="bg-white px-4 lg:px-6 pt-2 flex gap-4 lg:gap-8 border-b border-slate-200 overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth">
                        {['Overview', 'Activities', 'About', 'Contacts'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab.toLowerCase())}
                                className={`pb-3 pt-2 text-xs lg:text-sm font-bold border-b-2 transition-all flex-none ${activeTab === tab.toLowerCase() ? 'border-[#0ea5e9] text-[#0f1c2e]' : 'border-transparent text-slate-400 hover:text-slate-700'} ${['About', 'Contacts'].includes(tab) ? 'lg:hidden block' : 'block'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Sub-content rendering */}
                    {activeTab === 'activities' && (
                        <>
                            {/* Filters & SubTabs */}
                            <div className="px-4 py-3 sm:px-6 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm z-10">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                                    <div className="relative w-full sm:w-auto">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search activities..."
                                            className="pl-9 pr-3 py-1.5 w-full sm:w-[180px] bg-[#f8fafc] border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 transition-all placeholder:font-medium"
                                        />
                                    </div>
                                    <div className="flex gap-5 text-xs font-bold text-slate-500 tracking-wide overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                                        <button
                                            onClick={() => setActiveSubTab('activity')}
                                            className={`${activeSubTab === 'activity' ? 'text-[#0f1c2e] border-b-[3px] border-slate-800' : 'hover:text-[#0ea5e9] border-b-[3px] border-transparent'} pb-0.5 transition-all flex-none`}
                                        >Activity</button>
                                        <button
                                            onClick={() => setActiveSubTab('calls')}
                                            className={`${activeSubTab === 'calls' ? 'text-[#0f1c2e] border-b-[3px] border-slate-800' : 'hover:text-[#0ea5e9] border-b-[3px] border-transparent'} pb-0.5 transition-all flex-none`}
                                        >Calls</button>
                                        <button
                                            onClick={() => setActiveSubTab('tasks')}
                                            className={`${activeSubTab === 'tasks' ? 'text-[#0f1c2e] border-b-[3px] border-slate-800' : 'hover:text-[#0ea5e9] border-b-[3px] border-transparent'} pb-0.5 transition-all flex-none`}
                                        >Tasks</button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-end sm:justify-start">
                                    <button
                                        onClick={() => toggleAll(expandedIds.size > 0)}
                                        className="text-[0.65rem] sm:text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors whitespace-nowrap"
                                    >
                                        {expandedIds.size > 0 ? 'Collapse all' : 'Expand all'}
                                    </button>
                                </div>
                            </div>

                            {/* Timeline */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-6">
                                {timelineItems.length === 0 ? (
                                    <div className="text-center text-sm font-medium text-slate-400 mt-10">No activities found.</div>
                                ) : (
                                    timelineItems.map((item, i) => {
                                        const isExpanded = expandedIds.has(String(item.data._id));
                                        return (
                                            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-4 relative animate-in fade-in slide-in-from-bottom-2 duration-300 ml-3 sm:ml-4 group">
                                                {/* Timeline thread & dot */}
                                                {i !== timelineItems.length - 1 && <div className="absolute -left-3 sm:-left-4 top-8 bottom-[-24px] w-[2px] bg-slate-100 group-hover:bg-[#0ea5e9]/20 transition-colors"></div>}
                                                <div className="absolute -left-4 sm:-left-5 top-5 w-2.5 h-2.5 rounded-full bg-slate-300 ring-4 ring-[#f8fafc] group-hover:bg-[#0ea5e9] transition-colors"></div>

                                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 cursor-pointer gap-2" onClick={() => toggleExpand(item.data._id)}>
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="p-1.5 rounded-md bg-slate-50 border border-slate-100 text-slate-400 group-hover:text-[#0ea5e9] transition-colors flex-none">
                                                            {item.type === 'activity' && <Activity size={14} />}
                                                            {item.type === 'task' && <CheckSquare size={14} />}
                                                            {item.type === 'remark' && <Mail size={14} />}
                                                            {item.type === 'call' && <Phone size={14} />}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <h4 className="text-[0.75rem] sm:text-[0.8rem] font-extrabold text-[#0f1c2e] leading-tight">
                                                                {item.type === 'activity' && item.data.description}
                                                                {item.type === 'task' && `Task: ${item.data.title}`}
                                                                {item.type === 'remark' && `Remark added by ${item.data.profile?.name}`}
                                                                {item.type === 'call' && `Call Logged: "${item.data.stage}"`}
                                                            </h4>
                                                            {!isExpanded && (item.type === 'remark' || item.type === 'call' || item.type === 'task') && (
                                                                <p className="text-[0.6rem] sm:text-[0.65rem] text-slate-400 font-medium truncate max-w-full mt-0.5 italic">
                                                                    {item.type === 'remark' && item.data.content}
                                                                    {item.type === 'call' && item.data.remarks}
                                                                    {item.type === 'task' && item.data.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between sm:justify-end gap-3 px-1 sm:px-0">
                                                        <span className="text-[0.55rem] sm:text-[0.65rem] font-bold text-slate-400 bg-slate-100/50 px-2 py-0.5 rounded border border-slate-100">
                                                            {item.date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                        </span>
                                                        <ChevronDown size={14} className={`text-slate-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                    </div>
                                                </div>

                                                {isExpanded && (
                                                    <div className="text-[0.7rem] sm:text-xs text-slate-600 font-medium pl-8 sm:pl-[38px] mt-3 sm:mt-4 border-t border-slate-50 pt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                                        {item.type === 'task' && <p>{item.data.description}</p>}
                                                        {item.type === 'remark' && <p className="italic text-slate-500 font-medium">"{item.data.content}"</p>}
                                                        {item.type === 'call' && (
                                                            <div className="space-y-2">
                                                                <p className="italic text-slate-500 font-medium">"{item.data.remarks}"</p>
                                                                <div className="flex flex-wrap gap-2">
                                                                    <div className="bg-slate-50 border border-slate-100 px-2 py-1 rounded text-[0.6rem] sm:text-[0.65rem] flex items-center gap-1 shrink-0">
                                                                        <span className="text-slate-400 font-bold tracking-wider capitalize">Stage:</span>
                                                                        <span className="text-slate-700 font-extrabold">{item.data.stage}</span>
                                                                    </div>
                                                                    <div className="bg-slate-50 border border-slate-100 px-2 py-1 rounded text-[0.6rem] sm:text-[0.65rem] flex items-center gap-1 shrink-0">
                                                                        <span className="text-slate-400 font-bold tracking-wider capitalize">Device:</span>
                                                                        <span className="text-slate-700 font-extrabold">{item.data.device}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {item.type === 'activity' && item.data.metadata && Object.keys(item.data.metadata).length > 0 && (
                                                            <div className="flex flex-wrap gap-2 mt-2">
                                                                {Object.entries(item.data.metadata)
                                                                    .filter(([key]) => !['pocId', 'leadId', '_id', '__v', 'taskId'].includes(key))
                                                                    .map(([key, value]) => (
                                                                        <div key={key} className="bg-slate-50 border border-slate-100 px-2 py-1 rounded text-[0.6rem] sm:text-[0.65rem] flex items-center gap-1 shrink-0">
                                                                            <span className="text-slate-400 font-bold tracking-wider capitalize">{key.replace(/_/g, ' ')}:</span>
                                                                            <span className="text-slate-700 font-extrabold max-w-[150px] sm:max-w-[200px] truncate" title={String(value)}>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                                                                        </div>
                                                                    ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    )}

                    {activeTab === 'overview' && (
                        /* Overview Tab */
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-6 sm:space-y-8 animate-in fade-in duration-300">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                                {/* Call Stats */}
                                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                                        <div className="p-2 sm:p-3 bg-blue-50 text-blue-600 rounded-xl"><Phone size={20} className="sm:hidden" /><Phone size={24} className="hidden sm:block" /></div>
                                        <div>
                                            <p className="text-[0.6rem] sm:text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider">Total Calls</p>
                                            <h3 className="text-xl sm:text-2xl font-extrabold text-[#0f1c2e]">{calls.length}</h3>
                                        </div>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 rounded-full" style={{ width: '100%' }}></div>
                                    </div>
                                    <p className="text-[0.6rem] sm:text-[0.65rem] text-slate-500 font-bold mt-3 capitalize italic truncate">Latest: {calls[0]?.stage || 'None'}</p>
                                </div>

                                {/* Task Stats */}
                                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                                        <div className="p-2 sm:p-3 bg-amber-50 text-amber-600 rounded-xl"><CheckSquare size={20} className="sm:hidden" /><CheckSquare size={24} className="hidden sm:block" /></div>
                                        <div>
                                            <p className="text-[0.6rem] sm:text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider">Associated Tasks</p>
                                            <h3 className="text-xl sm:text-2xl font-extrabold text-[#0f1c2e]">{tasks.length}</h3>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-[0.6rem] sm:text-[0.65rem] font-bold">
                                        <span className="text-slate-400">STATUS:</span>
                                        <span className="text-amber-600">{tasks.filter(t => t.status === 'Completed').length} / {tasks.length} Completed</span>
                                    </div>
                                    <p className="text-[0.6rem] sm:text-[0.65rem] text-slate-500 font-bold mt-3 italic underline cursor-pointer hover:text-[#ea900e]" onClick={() => setActiveTab('activities')}>See pending tasks</p>
                                </div>

                                {/* Remark Stats */}
                                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                                        <div className="p-2 sm:p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Mail size={20} className="sm:hidden" /><Mail size={24} className="hidden sm:block" /></div>
                                        <div>
                                            <p className="text-[0.6rem] sm:text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider">Total Remarks</p>
                                            <h3 className="text-xl sm:text-2xl font-extrabold text-[#0f1c2e]">{remarks.length}</h3>
                                        </div>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }}></div>
                                    </div>
                                    <p className="text-[0.6rem] sm:text-[0.65rem] text-slate-500 font-bold mt-3 italic truncate">"{remarks[0]?.content.slice(0, 40)}{remarks[0]?.content.length > 40 ? '...' : ''}"</p>
                                </div>
                            </div>

                            {/* Additional info section */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-4 sm:p-6">
                                <h3 className="text-[0.7rem] sm:text-sm font-extrabold text-[#0f1c2e] mb-4 border-b border-slate-100 pb-2">Record Overview</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 sm:gap-y-6 gap-x-4">
                                    <div>
                                        <p className="text-[0.6rem] sm:text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider mb-1">Last Activity Date</p>
                                        <p className="text-xs sm:text-sm font-bold text-slate-700">{timelineItems[0]?.date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) || 'No activity yet'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[0.6rem] sm:text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider mb-1">Contact Status</p>
                                        <span className="px-3 py-1 bg-sky-50 text-[#0ea5e9] text-[0.6rem] sm:text-[0.65rem] font-extrabold rounded-lg border border-sky-100 uppercase tracking-widest leading-none inline-block">{poc.stage || 'NEW'}</span>
                                    </div>
                                    <div>
                                        <p className="text-[0.6rem] sm:text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider mb-1">Company Name</p>
                                        <p className="text-xs sm:text-sm font-bold text-slate-700 truncate">{lead.company_name}</p>
                                    </div>
                                    <div>
                                        <p className="text-[0.6rem] sm:text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider mb-1">Assigned Manager</p>
                                        <p className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[0.55rem] flex-none">{lead.assignedBy?.name?.charAt(0)}</div> <span className="truncate">{lead.assignedBy?.name}</span></p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'about' && (
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 animate-in fade-in duration-300">
                            {/* Copy of About section from left sidebar */}
                            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
                                <div onClick={() => setShowEditPOCModal(true)} className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <h3 className="text-sm font-extrabold text-[#0f1c2e]">About this contact</h3>
                                    <Settings size={14} className="text-[#0ea5e9]" />
                                </div>
                                <div className="grid grid-cols-1 gap-6">
                                    <div>
                                        <p className="text-[0.65rem] uppercase tracking-wider text-slate-500 font-bold mb-1">Email</p>
                                        <p className="text-xs font-bold text-[#0ea5e9] truncate">{poc.email || 'No email'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[0.65rem] uppercase tracking-wider text-slate-500 font-bold mb-1">Phone Number</p>
                                        <p className="text-xs font-bold text-[#0f1c2e]">{poc.phone}</p>
                                    </div>
                                    <div>
                                        <p className="text-[0.65rem] uppercase tracking-wider text-slate-500 font-bold mb-1">Company</p>
                                        <p className="text-xs font-bold text-[#0ea5e9]">{lead.company_name}</p>
                                    </div>
                                    <div>
                                        <p className="text-[0.65rem] uppercase tracking-wider text-slate-500 font-bold mb-1">Industry</p>
                                        <p className="text-xs font-semibold text-[#0f1c2e]">{lead.industry_name || '--'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'contacts' && (
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 animate-in fade-in duration-300">
                            {/* Copy of Right Sidebar contents */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between p-4 bg-slate-50/50 border-b border-slate-100">
                                    <h3 className="text-xs font-extrabold text-[#0f1c2e] flex items-center gap-2"><Users size={14} className="text-[#0ea5e9]" /> Other Contacts ({lead.points_of_contact.length})</h3>
                                    <button onClick={() => setShowAddPOCModal(true)} className="text-[#0ea5e9] text-xs font-bold hover:underline flex items-center gap-1"><Plus size={12} /> Add</button>
                                </div>
                                <div className="p-2 space-y-1">
                                    {lead.points_of_contact.map((p: any) => {
                                        const linkPrefix = window.location.pathname.startsWith('/admin') ? '/admin' : '/bd';
                                        return (
                                            <div
                                                key={p._id}
                                                onClick={() => navigate(`${linkPrefix}/contacts/${p._id}`)}
                                                className={`flex items-center gap-3 p-3 rounded-lg transition-all border ${p._id === poc._id ? 'bg-sky-50 border-sky-100 shadow-sm' : 'hover:bg-slate-50 border-transparent cursor-pointer'}`}
                                            >
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${p._id === poc._id ? 'bg-[#0ea5e9] text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                    {p.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-[0.75rem] font-bold truncate ${p._id === poc._id ? 'text-[#0ea5e9]' : 'text-slate-700'}`}>{p.name}</p>
                                                    <p className="text-[0.6rem] font-semibold text-slate-400 truncate tracking-wide">{p.designation}</p>
                                                </div>
                                                {p._id === poc._id && <div className="w-1.5 h-1.5 rounded-full bg-[#0ea5e9] shadow-[0_0_8px_rgba(14,165,233,0.5)]"></div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Sidebar (Hidden on mobile) */}
                <div className="hidden lg:block w-[300px] flex-none bg-[#f8fafc] p-6 overflow-y-auto custom-scrollbar space-y-6">

                    {/* Companies */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between p-4 bg-slate-50/50 border-b border-slate-100">
                            <h3 className="text-xs font-extrabold text-[#0f1c2e] flex items-center gap-2"><Building2 size={14} className="text-[#0ea5e9]" /> Company</h3>
                        </div>
                        <div className="p-4">
                            <div className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm hover:border-[#0ea5e9]/30 transition-colors">
                                <div className="flex items-center gap-2.5 mb-2.5">
                                    <div className="w-7 h-7 rounded-md bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 flex items-center justify-center text-slate-500 font-bold text-[0.65rem] shadow-inner">
                                        {lead.company_name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[0.7rem] font-bold text-[#0ea5e9] hover:underline cursor-pointer block truncate">{lead.company_name}</span>
                                        <span className="text-[0.55rem] font-bold px-1.5 py-0.5 border border-[#0ea5e9] text-[#0ea5e9] rounded bg-[#0ea5e9]/5 mt-1 inline-block">Primary</span>
                                    </div>
                                </div>
                                <div className="text-[0.65rem] font-semibold text-slate-500 space-y-1.5 ml-9 border-l-2 border-slate-100 pl-2">
                                    <p className="flex justify-between"><span>Domain:</span> <a href={lead.website_url} target="_blank" className="text-[#0ea5e9] truncate max-w-[120px] font-bold">{lead.website_url.replace(/^https?:\/\//, '')}</a></p>
                                    <p className="flex justify-between"><span>Industry:</span> <span className="font-bold text-slate-600 truncate max-w-[120px]">{lead.industry_name || '--'}</span></p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Points of Contact */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between p-4 bg-slate-50/50 border-b border-slate-100">
                            <h3 className="text-xs font-extrabold text-[#0f1c2e] flex items-center gap-2"><Users size={14} className="text-[#0ea5e9]" /> Other Contacts ({lead.points_of_contact.length})</h3>
                            <button
                                onClick={() => setShowAddPOCModal(true)}
                                className="text-[#0ea5e9] text-xs font-bold hover:underline flex items-center gap-1"
                            >
                                <Plus size={12} /> Add
                            </button>
                        </div>
                        <div className="p-2 space-y-1">
                            {lead.points_of_contact.map((p: any) => {
                                const linkPrefix = window.location.pathname.startsWith('/admin') ? '/admin' : '/bd';
                                return (
                                    <div
                                        key={p._id}
                                        onClick={() => p._id !== poc._id && navigate(`${linkPrefix}/contacts/${p._id}`)}
                                        className={`flex items-center gap-3 p-3 rounded-lg transition-all border ${p._id === poc._id ? 'bg-sky-50 border-sky-100 shadow-sm' : 'hover:bg-slate-50 border-transparent cursor-pointer'}`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${p._id === poc._id ? 'bg-[#0ea5e9] text-white' : 'bg-slate-100 text-slate-500'}`}>
                                            {p.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-[0.75rem] font-bold truncate ${p._id === poc._id ? 'text-[#0ea5e9]' : 'text-slate-700'}`}>{p.name}</p>
                                            <p className="text-[0.6rem] font-semibold text-slate-400 truncate tracking-wide">{p.designation}</p>
                                        </div>
                                        {p._id === poc._id && <div className="w-1.5 h-1.5 rounded-full bg-[#0ea5e9] shadow-[0_0_8px_rgba(14,165,233,0.5)]"></div>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>

            </div>

            <PostCallFeedbackModal
                isOpen={showFeedbackModal}
                onClose={() => setShowFeedbackModal(false)}
                leadId={lead._id}
                poc={poc}
                onSuccess={fetchContactDetails}
            />

            <AddPOCModal
                isOpen={showAddPOCModal}
                onClose={() => setShowAddPOCModal(false)}
                leadId={lead._id}
                onSuccess={fetchContactDetails}
            />

            <EditPOCModal
                isOpen={showEditPOCModal}
                onClose={() => setShowEditPOCModal(false)}
                leadId={lead._id}
                poc={poc}
                onSuccess={fetchContactDetails}
            />

            <TaskModal
                isOpen={showTaskModal}
                onClose={() => setShowTaskModal(false)}
                leadId={lead._id}
                onSuccess={fetchContactDetails}
            />

            <RemarkModal
                isOpen={showRemarkModal}
                onClose={() => setShowRemarkModal(false)}
                leadId={lead._id}
                poc={poc}
                onSuccess={fetchContactDetails}
            />

        </div>
    );
};

export default ContactDetail;
