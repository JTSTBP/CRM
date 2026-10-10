import React, { useState, useEffect } from 'react';
import { X, Calendar, ClipboardList, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import toast from 'react-hot-toast';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    leadId: string | null;
    taskToEdit?: any | null; // Pass existing task if editing, or null for creating
    onSuccess: () => void;
}

const TASK_TYPES = ["Follow-up", "Meeting", "Email", "Call", "Other"];

const TaskModal: React.FC<Props> = ({ isOpen, onClose, leadId, taskToEdit, onSuccess }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('Follow-up');
    const [dueDate, setDueDate] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (taskToEdit) {
                // Formatting date for HTML input type="datetime-local" (YYYY-MM-DDTHH:mm)
                const dateObj = new Date(taskToEdit.due_date);
                // Adjust for local timezone offset to display correctly in input field
                const tzOffset = dateObj.getTimezoneOffset() * 60000;
                const localISOTime = (new Date(dateObj.getTime() - tzOffset)).toISOString().slice(0, 16);

                setTitle(taskToEdit.title || '');
                setDescription(taskToEdit.description || '');
                setType(taskToEdit.type || 'Follow-up');
                setDueDate(localISOTime || '');
            } else {
                setTitle('');
                setDescription('');
                setType('Follow-up');
                setDueDate('');
            }
        }
    }, [isOpen, taskToEdit]);

    const handleSubmit = async () => {
        if (!title.trim() || !dueDate) {
            toast.error('Title and Due Date are required');
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const isEditing = !!taskToEdit;
            const url = taskToEdit
                ? `${API_BASE_URL}/api/tasks/${taskToEdit._id}`
                : `${API_BASE_URL}/api/tasks`;

            const payload = {
                title,
                description,
                type,
                due_date: new Date(dueDate).toISOString(),
                lead_id: leadId // Assuming we always link new tasks to the current lead context
            };

            const response = await fetch(url, {
                method: isEditing ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token || ''
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to save task');

            toast.success(isEditing ? 'Task updated successfully' : 'Task created successfully');
            onSuccess();
            onClose();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-y-auto">
            <div className="fixed inset-0 bg-slate-900/80 animate-in fade-in duration-300" onClick={onClose} />

            <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 my-auto">
                <div className="bg-gradient-to-r from-[#0ea5e9] to-[#0284c7] p-6 text-white text-center relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-xl transition-colors"
                    >
                        <X size={20} />
                    </button>
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                        <ClipboardList size={32} className="text-white" />
                    </div>
                    <h2 className="text-xl font-extrabold tracking-tight">
                        {taskToEdit ? 'Edit Task' : 'Create New Task'}
                    </h2>
                    <p className="text-white/80 text-xs mt-1 font-medium">
                        {taskToEdit ? 'Update details for this task' : 'Add a new actionable item for this lead'}
                    </p>
                </div>

                <div className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                Task Title *
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="eg. Follow up on proposal"
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/10 focus:border-[#0ea5e9] transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    Task Type
                                </label>
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/10 focus:border-[#0ea5e9] transition-all"
                                >
                                    {TASK_TYPES.map((t) => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <Calendar size={12} /> Due Date & Time *
                                </label>
                                <input
                                    type="datetime-local"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/10 focus:border-[#0ea5e9] transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                Description (Optional)
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Add any additional notes or context..."
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-4 focus:ring-[#0ea5e9]/10 focus:border-[#0ea5e9] min-h-[100px] transition-all"
                            />
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-extrabold py-4 rounded-2xl transition-all shadow-lg shadow-sky-500/20 active:scale-[0.98] disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <CheckCircle2 size={18} />
                                    {taskToEdit ? 'Update Task' : 'Save Task'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskModal;
