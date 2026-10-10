import React, { useState } from 'react';
import { Phone, Calendar, Save, MessageSquare, CheckCircle2, TrendingUp, CalendarPlus, ChevronDown } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import toast from 'react-hot-toast';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    leadId: string;
    poc: {
        _id: string;
        name: string;
        phone: string;
        email?: string;
        stage: string;
    };
    onSuccess: () => void;
    /** Called after a successful save when stage is 'Busy' or 'No Answer' */
    onBusyOrNoAnswer?: (poc: any, savedStage: string) => void;
}

const POC_STAGES = ["New", "Contacted", "Busy", "No Answer", "Wrong Number"];
const TASK_TYPES = ["Follow-up", "Call", "Meeting", "Demo", "Proposal", "Other"];

const PostCallFeedbackModal: React.FC<Props> = ({ isOpen, onClose, leadId, poc, onSuccess, onBusyOrNoAnswer }) => {
    const [stage, setStage] = useState(poc.stage || 'New');
    const [remarks, setRemarks] = useState('');
    const [loading, setLoading] = useState(false);

    // Task scheduling
    const [addTask, setAddTask] = useState(false);
    const [taskTitle, setTaskTitle] = useState(`Follow-up call with ${poc.name}`);
    const [taskType, setTaskType] = useState('Call');
    const [taskDueDate, setTaskDueDate] = useState('');

    const handleSubmit = async () => {
        if (!stage) {
            toast.error('Please select a stage');
            return;
        }
        if (addTask && (!taskTitle || !taskDueDate)) {
            toast.error('Please fill in the task title and due date/time');
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            // 1. Save call feedback
            const feedbackRemarks = addTask
                ? `${remarks}${remarks ? '\n' : ''}(Follow-up: ${taskTitle} on ${new Date(taskDueDate).toLocaleString()})`
                : remarks;

            const detectDevice = () => {
                const ua = navigator.userAgent;
                if (/tablet|ipad|playbook|silk/i.test(ua)) return 'Tablet';
                if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return 'Mobile';
                return 'Laptop';
            };

            const response = await fetch(`${API_BASE_URL}/api/leads/${leadId}/poc/${poc._id}/call`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token || ''
                },
                body: JSON.stringify({ stage, remarks: feedbackRemarks, device: detectDevice() })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to save feedback');

            // Update lead stage to 'Contacted' automatically
            try {
                const leadRes = await fetch(`${API_BASE_URL}/api/leads/${leadId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-auth-token': token || ''
                    },
                    body: JSON.stringify({ stage: 'Contacted' })
                });
                const leadData = await leadRes.json();
                if (!leadRes.ok) throw new Error(leadData.message || 'Failed to update lead stage');
                toast.success('Lead stage set to Contacted');
            } catch (leadErr: any) {
                toast.error(leadErr.message);
            }

            // 2. Create task if enabled
            if (addTask && taskTitle && taskDueDate) {
                const taskRes = await fetch(`${API_BASE_URL}/api/tasks`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-auth-token': token || ''
                    },
                    body: JSON.stringify({
                        title: taskTitle,
                        type: taskType,
                        due_date: taskDueDate,
                        lead_id: leadId,
                        poc_id: poc._id
                    })
                });
                const taskData = await taskRes.json();
                if (!taskRes.ok) throw new Error(taskData.message || 'Failed to create task');
                toast.success('Feedback saved & follow-up task created!');
            } else {
                toast.success('Call activity saved successfully');
            }

            onSuccess();

            // Trigger auto-message popup for Busy / No Answer
            if ((stage === 'Busy' || stage === 'No Answer') && onBusyOrNoAnswer) {
                onBusyOrNoAnswer(poc, stage);
            }
            onClose();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <div className="fixed inset-0 bg-slate-900/80 animate-in fade-in duration-300" />

            <div className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 my-auto">
                <div className="bg-gradient-to-r from-[#0ea5e9] to-[#0284c7] p-5 sm:p-6 text-white text-center relative">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 backdrop-blur-md">
                        <Phone size={28} className="text-white sm:w-8 sm:h-8" />
                    </div>
                    <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">Post-Call Feedback</h2>
                    <p className="text-white/80 text-[0.65rem] sm:text-xs mt-1 font-medium">Capture results for 1:1 call with <span className="font-bold underline">{poc.name}</span></p>
                </div>

                <div className="p-5 sm:p-8 space-y-5 sm:space-y-6">
                    <div className="space-y-4">
                        {/* POC Stage */}
                        <div className="space-y-2">
                            <label className="text-[0.6rem] sm:text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <TrendingUp size={14} className="text-[#0ea5e9]" />
                                Update POC Stage
                            </label>
                            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                                {POC_STAGES.map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setStage(s)}
                                        className={`px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl text-[0.65rem] sm:text-xs font-bold transition-all border-2 text-center ${stage === s
                                            ? 'bg-[#0ea5e9] border-[#0ea5e9] text-white shadow-lg shadow-sky-500/20'
                                            : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'
                                            }`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Remarks */}
                        <div className="space-y-2">
                            <label className="text-[0.6rem] sm:text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <MessageSquare size={14} className="text-[#0ea5e9]" />
                                Call Remarks
                            </label>
                            <textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="What was the outcome? (e.g. Interested, Call back...)"
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl px-4 py-3 text-xs sm:text-sm font-medium text-slate-600 focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/10 focus:border-[#0ea5e9] min-h-[80px] sm:min-h-[100px] transition-all"
                            />
                        </div>

                        {/* ── Schedule Follow-up Task ─────────────────── */}
                        <div className="border border-slate-100 rounded-2xl overflow-hidden">
                            {/* Toggle header */}
                            <button
                                onClick={() => setAddTask(prev => !prev)}
                                className={`w-full flex items-center justify-between px-4 py-3.5 transition-all ${addTask ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <CalendarPlus size={15} />
                                    <span className="text-xs font-extrabold uppercase tracking-widest">Schedule Follow-up Task</span>
                                </div>
                                <ChevronDown
                                    size={16}
                                    className={`transition-transform duration-200 ${addTask ? 'rotate-180 text-amber-600' : ''}`}
                                />
                            </button>

                            {/* Expandable task form */}
                            {addTask && (
                                <div className="p-4 space-y-3 border-t border-slate-100 animate-in slide-in-from-top-2 duration-200">
                                    {/* Task Title */}
                                    <div className="space-y-1.5">
                                        <label className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">Task Title</label>
                                        <input
                                            type="text"
                                            value={taskTitle}
                                            onChange={(e) => setTaskTitle(e.target.value)}
                                            placeholder="e.g. Call back John at ABC Corp"
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/10 focus:border-[#0ea5e9] transition-all"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Task Type */}
                                        <div className="space-y-1.5">
                                            <label className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">Type</label>
                                            <div className="relative">
                                                <select
                                                    value={taskType}
                                                    onChange={(e) => setTaskType(e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/10 focus:border-[#0ea5e9] appearance-none cursor-pointer"
                                                >
                                                    {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                            </div>
                                        </div>

                                        {/* Due Date & Time */}
                                        <div className="space-y-1.5">
                                            <label className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                <Calendar size={10} /> Due Date & Time
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={taskDueDate}
                                                onChange={(e) => setTaskDueDate(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/10 focus:border-[#0ea5e9] transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:gap-3 pt-2">
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-extrabold py-3.5 sm:py-4 rounded-xl sm:rounded-2xl transition-all shadow-lg shadow-sky-500/20 active:scale-[0.98] disabled:opacity-50 text-xs sm:text-sm flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <Save size={18} className="sm:w-5 sm:h-5" />
                                    {addTask ? 'Save Feedback & Create Task' : 'Save Feedback'}
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="bg-emerald-50 p-4 border-t border-emerald-100 flex items-start gap-3">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-[0.6rem] sm:text-[0.65rem] text-emerald-700 font-medium leading-relaxed">
                        Activity will be logged under your profile and visible in history.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PostCallFeedbackModal;
