import React, { useState, useEffect } from 'react';
import { X, User, Phone, Mail, Briefcase, Linkedin } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import toast from 'react-hot-toast';

interface EditPOCModalProps {
    isOpen: boolean;
    onClose: () => void;
    leadId: string;
    poc: any;
    onSuccess: () => void;
}

const EditPOCModal: React.FC<EditPOCModalProps> = ({ isOpen, onClose, leadId, poc, onSuccess }) => {
    const [formData, setFormData] = useState({
        name: '',
        designation: '',
        phone: '',
        email: '',
        linkedin_url: '',
        stage: ''
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (poc) {
            setFormData({
                name: poc.name || '',
                designation: poc.designation || '',
                phone: poc.phone || '',
                email: poc.email || '',
                linkedin_url: poc.linkedin_url || '',
                stage: poc.stage || 'New'
            });
        }
    }, [poc, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name && !formData.phone && !formData.email && !formData.linkedin_url) {
            toast.error('At least one field (Name, Phone, Email, or LinkedIn) is required');
            return;
        }

        try {
            setSaving(true);
            const token = localStorage.getItem('token');
            const trimmedData = {
                ...formData,
                name: formData.name.trim(),
                designation: formData.designation.trim(),
                phone: formData.phone.trim(),
                email: formData.email.trim(),
                linkedin_url: formData.linkedin_url.trim()
            };

            const response = await fetch(`${API_BASE_URL}/api/leads/${leadId}/poc/${poc._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token || ''
                },
                body: JSON.stringify(trimmedData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update contact');
            }

            toast.success('Contact updated successfully');
            onSuccess();
            onClose();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-extrabold text-[#0f1c2e]">Edit Contact</h2>
                        <p className="text-xs font-bold text-slate-400 mt-0.5">Update details for {poc.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-slate-600 border border-transparent hover:border-slate-200">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-widest ml-1">Full Name *</label>
                                <div className="relative group">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0ea5e9] transition-colors"><User size={16} /></div>
                                    <input
                                        type="text"
                                        required
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#0ea5e9] focus:ring-4 focus:ring-[#0ea5e9]/10 transition-all placeholder:text-slate-300"
                                        placeholder="John Doe"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-widest ml-1">Designation</label>
                                <div className="relative group">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0ea5e9] transition-colors"><Briefcase size={16} /></div>
                                    <input
                                        type="text"
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#0ea5e9] focus:ring-4 focus:ring-[#0ea5e9]/10 transition-all placeholder:text-slate-300"
                                        placeholder="Software Engineer"
                                        value={formData.designation}
                                        onChange={e => setFormData({ ...formData, designation: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-widest ml-1">Phone Number *</label>
                                <div className="relative group">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0ea5e9] transition-colors"><Phone size={16} /></div>
                                    <input
                                        type="tel"
                                        required
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#0ea5e9] focus:ring-4 focus:ring-[#0ea5e9]/10 transition-all placeholder:text-slate-300"
                                        placeholder="+1 234 567 890"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-widest ml-1">Email Address *</label>
                                <div className="relative group">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0ea5e9] transition-colors"><Mail size={16} /></div>
                                    <input
                                        type="email"
                                        required
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#0ea5e9] focus:ring-4 focus:ring-[#0ea5e9]/10 transition-all placeholder:text-slate-300"
                                        placeholder="john@example.com"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-widest ml-1">LinkedIn Profile URL</label>
                            <div className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0ea5e9] transition-colors"><Linkedin size={16} /></div>
                                <input
                                    type="url"
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#0ea5e9] focus:ring-4 focus:ring-[#0ea5e9]/10 transition-all placeholder:text-slate-300"
                                    placeholder="https://linkedin.com/in/johndoe"
                                    value={formData.linkedin_url}
                                    onChange={e => setFormData({ ...formData, linkedin_url: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 text-sm font-extrabold rounded-xl hover:bg-slate-50 transition-all active:scale-95"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 px-4 py-3 bg-[#0ea5e9] text-white text-sm font-extrabold rounded-xl hover:bg-[#0284c7] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_4px_12px_rgba(14,165,233,0.3)] active:scale-95 flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>Save Changes</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditPOCModal;
