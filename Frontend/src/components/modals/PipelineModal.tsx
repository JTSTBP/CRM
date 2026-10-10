import React, { useEffect, useState } from 'react';
import { X, User, Phone, Mail, Trash2, Briefcase, MessageSquare, ChevronDown, ChevronUp, LayoutPanelTop, Calendar, Download } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import toast from 'react-hot-toast';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onUpdate?: () => void;
}

const PipelineModal: React.FC<Props> = ({ isOpen, onClose, onUpdate }) => {
    const [bucket, setBucket] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [hiddenRemarks, setHiddenRemarks] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (isOpen) {
            fetchBucket();
        }
    }, [isOpen]);

    const fetchBucket = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/poc-bucket`, {
                headers: { 'x-auth-token': token || '' }
            });
            if (response.ok) {
                const data = await response.json();
                setBucket(data);
            }
        } catch (err) {
            console.error('Fetch bucket error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (pocId: string) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/poc-bucket/remove/${pocId}`, {
                method: 'DELETE',
                headers: { 'x-auth-token': token || '' }
            });
            if (response.ok) {
                setBucket(prev => prev.filter(item => item.pocId !== pocId));
                toast.success('Removed from pipeline');
                if (onUpdate) onUpdate();
            }
        } catch (err) {
            toast.error('Failed to remove item');
        }
    };

    const handleClear = async () => {
        if (!window.confirm('Are you sure you want to clear the entire pipeline?')) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/poc-bucket/clear`, {
                method: 'DELETE',
                headers: { 'x-auth-token': token || '' }
            });
            if (response.ok) {
                setBucket([]);
                toast.success('Pipeline cleared');
                if (onUpdate) onUpdate();
            }
        } catch (err) {
            toast.error('Failed to clear bucket');
        }
    };

    const toggleRemarks = (pocId: string) => {
        setHiddenRemarks(prev => ({
            ...prev,
            [pocId]: !prev[pocId]
        }));
    };

    const handleDownloadCSV = () => {
        if (bucket.length === 0) return;

        const headers = ['Company', 'Name', 'Designation', 'Phone', 'Email', 'Added At'];
        const csvContent = [
            headers.join(','),
            ...bucket.map(item => [
                `"${item.company_name}"`,
                `"${item.name}"`,
                `"${item.designation || ''}"`,
                `"${item.phone}"`,
                `"${item.email || ''}"`,
                `"${new Date(item.added_at).toLocaleString()}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `pipeline_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-50 rounded-xl text-amber-500">
                            <LayoutPanelTop size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-[#0f1c2e]">Pipeline</h2>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{bucket.length} items added</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {bucket.length > 0 && (
                            <>
                                {(() => {
                                    const userStr = localStorage.getItem('user');
                                    const role = userStr ? JSON.parse(userStr).role : '';
                                    if (role !== 'BD Executive') {
                                        return (
                                            <button
                                                onClick={handleDownloadCSV}
                                                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                            >
                                                <Download size={16} /> Download CSV
                                            </button>
                                        );
                                    }
                                    return null;
                                })()}
                                <button
                                    onClick={handleClear}
                                    className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                                >
                                    <Trash2 size={16} /> Clear All
                                </button>
                            </>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <div className="w-10 h-10 border-4 border-[#0ea5e9]/20 border-t-[#0ea5e9] rounded-full animate-spin"></div>
                            <p className="text-slate-400 font-bold text-sm">Loading pipeline contents...</p>
                        </div>
                    ) : bucket.length > 0 ? (
                        <div className="space-y-4">
                            {bucket.map((item) => (
                                <div key={item.pocId} className="bg-slate-50 border border-slate-100 rounded-2xl p-5 hover:bg-white hover:shadow-md transition-all group relative">
                                    <button
                                        onClick={() => handleRemove(item.pocId)}
                                        className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <X size={16} />
                                    </button>
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-[#0ea5e9] shadow-sm">
                                            <User size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-sm font-bold text-slate-800">{item.name}</h3>
                                                <span className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">{item.designation}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mb-3 text-[0.7rem] font-bold text-[#0ea5e9]">
                                                <Briefcase size={12} /> {item.company_name}
                                            </div>
                                            <div className="flex flex-wrap gap-3">
                                                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                                                    <Phone size={12} className="text-slate-400" /> {item.phone}
                                                </div>
                                                {item.email && (
                                                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                                                        <Mail size={12} className="text-slate-400" /> {item.email}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Remarks Section */}
                                            {item.remarks && item.remarks.length > 0 && (
                                                <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="text-[0.6rem] font-black text-slate-400 uppercase tracking-[0.1em] flex items-center gap-2">
                                                            <MessageSquare size={10} /> Relevant Remarks
                                                        </h4>
                                                        <button
                                                            onClick={() => toggleRemarks(item.pocId)}
                                                            className="text-[0.6rem] font-bold text-[#0ea5e9] hover:underline flex items-center gap-1"
                                                        >
                                                            {hiddenRemarks[item.pocId] ? (
                                                                <>Show <ChevronDown size={10} /></>
                                                            ) : (
                                                                <>Hide <ChevronUp size={10} /></>
                                                            )}
                                                        </button>
                                                    </div>

                                                    {!hiddenRemarks[item.pocId] && (
                                                        <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                            {item.remarks.slice(0, 3).map((remark: any, rIdx: number) => (
                                                                <div key={rIdx} className="bg-white/50 rounded-xl p-3 border border-slate-100/50">
                                                                    <p className="text-[0.75rem] text-slate-600 font-medium leading-relaxed">
                                                                        {remark.content.replace(`[POC: ${item.name}] `, '')}
                                                                    </p>
                                                                    <div className="flex items-center gap-2 mt-2 opacity-50">
                                                                        <div className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center text-[0.5rem] font-bold text-slate-500">
                                                                            {remark.profile?.name?.[0]}
                                                                        </div>
                                                                        <span className="text-[0.55rem] font-bold text-slate-400">{remark.profile?.name}</span>
                                                                        <span className="text-[0.55rem] font-bold text-slate-300">•</span>
                                                                        <span className="text-[0.55rem] font-bold text-slate-400 flex items-center gap-1">
                                                                            <Calendar size={8} /> {new Date(remark.created_at).toLocaleDateString()}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {item.remarks.length > 3 && (
                                                                <p className="text-[0.6rem] font-bold text-[#0ea5e9] text-center pt-1">+ {item.remarks.length - 3} more remarks available in lead history</p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="p-6 bg-slate-50 rounded-full mb-4">
                                <LayoutPanelTop size={48} className="text-slate-200" />
                            </div>
                            <h3 className="text-lg font-extrabold text-slate-800 mb-1">Your pipeline is empty</h3>
                            <p className="text-sm text-slate-400 max-w-xs mx-auto">Start adding Points of Contact from Lead Details to build your custom pipeline here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PipelineModal;
