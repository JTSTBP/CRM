import React, { useState } from 'react';
import { X, Save, Loader2, MessageSquare, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import toast from 'react-hot-toast';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    leadId: string;
    poc: {
        _id: string;
        name: string;
    };
    onSuccess: () => void;
}

const RemarkModal: React.FC<Props> = ({ isOpen, onClose, leadId, poc, onSuccess }) => {
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!content.trim()) {
            toast.error('Please enter remark content');
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            const response = await fetch(`${API_BASE_URL}/api/leads/${leadId}/poc/${poc._id}/remark`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token || ''
                },
                body: JSON.stringify({ content })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to save remark');

            toast.success('Remark added successfully');
            setContent('');
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/80 animate-in fade-in duration-300" onClick={onClose} />

            <div className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white text-center relative">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                    >
                        <X size={18} />
                    </button>
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                        <MessageSquare size={32} className="text-white" />
                    </div>
                    <h2 className="text-xl font-extrabold tracking-tight">Add Quick Remark</h2>
                    <p className="text-white/80 text-xs mt-1 font-medium">Adding note for <span className="font-bold underline">{poc.name}</span></p>
                </div>

                <div className="p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <MessageSquare size={14} className="text-emerald-500" />
                            Remark Content
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Type your remark here..."
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 min-h-[120px] transition-all resize-none"
                            autoFocus
                        />
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={loading || !content.trim()}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <Save size={18} />
                                Save Remark
                            </>
                        )}
                    </button>
                </div>

                <div className="bg-slate-50 p-4 border-t border-slate-100 flex items-start gap-3">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                        This remark will be added to the lead history and visible to other team members.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RemarkModal;
