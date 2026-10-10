import React, { useState, useEffect } from 'react';
import {
    X, MessageCircle, Mail, Send, CheckCircle2,
    Edit3, RotateCcw, Phone, Building2, User
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config';

interface AutoMessagePopupProps {
    isOpen: boolean;
    onClose: () => void;
    poc: {
        _id: string;
        name: string;
        phone?: string;
        email?: string;
        designation?: string;
    };
    lead: {
        company_name?: string;
        industry_name?: string;
    };
    pocStage: string; // 'Busy' | 'No Answer'
}

const buildMessage = (senderName: string): string =>
    `Greetings of the day!\n\nI'm ${senderName} from Job Territory, a Bangalore-based recruitment consultancy supporting organizations across India with hiring solutions.\n\nWe help companies reduce their recruitment time by sourcing and screening qualified candidates based on their hiring requirements, so your team only interviews the most relevant profiles.\n\nOur model is completely success-based — you pay only after the selected candidate joins your organization, and we also provide a complimentary replacement as per our service agreement.\n\nCommercials are 8.33% of annual CTC or 1 month salary with replacement clause of 60 days.\n\nLooking forward to hearing from you and to discuss further.\n\nRegards\n${senderName}`;

const AutoMessagePopup: React.FC<AutoMessagePopupProps> = ({
    isOpen,
    onClose,
    poc,
    lead,
    pocStage,
}) => {
    const userData = localStorage.getItem('user');
    const currentUser = userData ? JSON.parse(userData) : null;
    const senderName: string = currentUser?.name || 'Our Team';

    const [message, setMessage] = useState('');
    const [editingMessage, setEditingMessage] = useState(false);
    const [emailSending, setEmailSending] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [whatsappClicked, setWhatsappClicked] = useState(false);
    const [activeTab, setActiveTab] = useState<'whatsapp' | 'email'>('whatsapp');

    // Email subject & to
    const [emailTo, setEmailTo] = useState(poc.email || '');
    const emailSubject = `Recruitment Partnership Opportunity — Job Territory`;

    useEffect(() => {
        if (isOpen) {
            setMessage(buildMessage(senderName));
            setEmailSent(false);
            setWhatsappClicked(false);
            setEditingMessage(false);
            setEmailTo(poc.email || '');
        }
    }, [isOpen, poc, lead, senderName]);

    const handleSendWhatsApp = () => {
        if (!poc.phone) {
            toast.error('No phone number available for this POC');
            return;
        }
        const cleanPhone = poc.phone.replace(/\D/g, '');
        const encodedMsg = encodeURIComponent(message);
        window.open(`https://wa.me/${cleanPhone}?text=${encodedMsg}`, '_blank');
        setWhatsappClicked(true);
        toast.success('WhatsApp opened!');
        // Auto-close after a short delay
        // Removed auto-close timeout; will show confirmation instead
    };

    const handleSendEmail = async () => {
        if (!emailTo) {
            toast.error('No email address available for this POC');
            return;
        }
        try {
            setEmailSending(true);
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/leads/send-auto-message-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token || '',
                },
                body: JSON.stringify({
                    to: emailTo,
                    subject: emailSubject,
                    message,
                    pocName: poc.name,
                    companyName: lead.company_name || '',
                    senderName,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to send email');
            setEmailSent(true);
            toast.success('Email sent successfully!');
            // Auto-close after a short delay
            // Removed auto-close timeout; will show confirmation instead
        } catch (err: any) {
            toast.error(err.message || 'Failed to send email');
        } finally {
            setEmailSending(false);
        }
    };

    if (!isOpen) return null;

    const stageBadgeClass =
        pocStage === 'Busy'
            ? 'bg-amber-100 text-amber-700 border border-amber-200'
            : 'bg-rose-100 text-rose-700 border border-rose-200';

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-0 bg-slate-900/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            {/* Prevent click propagation so backdrop doesn't close when interacting inside modal */}
            <div className="relative z-10 w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 my-auto" onClick={e => e.stopPropagation()}>


                {/* Header */}
                <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 px-6 py-5 text-white relative overflow-hidden">
                    {/* decorative circles */}
                    <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10" />
                    <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/10" />

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close auto message popup"
                        className="absolute top-4 right-4 z-20 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                    >
                        <X size={16} />
                    </button>

                    <div className="relative flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                            <Send size={22} className="text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h2 className="text-base font-extrabold tracking-tight">Send Auto Message</h2>
                                <span className={`px-2 py-0.5 rounded-full text-[0.6rem] font-bold uppercase ${stageBadgeClass}`}>
                                    {pocStage}
                                </span>
                            </div>
                            <p className="text-white/70 text-[0.7rem] font-medium">
                                POC was {pocStage.toLowerCase()} — reach out via WhatsApp or Email
                            </p>
                        </div>
                    </div>

                    {/* POC & Lead info strip */}
                    <div className="relative mt-4 flex flex-wrap gap-3">
                        <div className="flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-1.5">
                            <User size={12} className="text-white/70" />
                            <span className="text-[0.7rem] font-bold text-white">{poc.name}</span>
                        </div>
                        {poc.phone && (
                            <div className="flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-1.5">
                                <Phone size={12} className="text-white/70" />
                                <span className="text-[0.7rem] font-bold text-white">{poc.phone}</span>
                            </div>
                        )}
                        {lead.company_name && (
                            <div className="flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-1.5">
                                <Building2 size={12} className="text-white/70" />
                                <span className="text-[0.7rem] font-bold text-white">{lead.company_name}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tab switcher */}
                <div className="flex gap-1 p-3 bg-slate-50 border-b border-slate-100">
                    <button
                        onClick={() => setActiveTab('whatsapp')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'whatsapp'
                            ? 'bg-[#25D366] text-white shadow-md shadow-green-500/20'
                            : 'text-slate-500 hover:bg-slate-100'
                            }`}
                    >
                        <MessageCircle size={15} />
                        WhatsApp
                    </button>
                    <button
                        onClick={() => setActiveTab('email')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'email'
                            ? 'bg-[#0ea5e9] text-white shadow-md shadow-sky-500/20'
                            : 'text-slate-500 hover:bg-slate-100'
                            }`}
                    >
                        <Mail size={15} />
                        Email
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Email-specific fields */}
                    {activeTab === 'email' && (
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">To</label>
                                <input
                                    type="email"
                                    value={emailTo}
                                    onChange={(e) => setEmailTo(e.target.value)}
                                    placeholder="poc@company.com"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-400 transition-all"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">Subject</label>
                                <div className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500">
                                    {emailSubject}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Message box */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">
                                Message
                            </label>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setMessage(buildMessage(senderName))}
                                    className="flex items-center gap-1 text-[0.65rem] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                                    title="Reset to default"
                                >
                                    <RotateCcw size={11} />
                                    Reset
                                </button>
                                <button
                                    onClick={() => setEditingMessage(!editingMessage)}
                                    className={`flex items-center gap-1 text-[0.65rem] font-bold transition-colors ${editingMessage ? 'text-violet-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <Edit3 size={11} />
                                    {editingMessage ? 'Editing' : 'Edit'}
                                </button>
                            </div>
                        </div>
                        {editingMessage ? (
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={10}
                                className="w-full bg-violet-50 border-2 border-violet-200 rounded-2xl px-4 py-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 transition-all resize-none leading-relaxed"
                            />
                        ) : (
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-medium text-slate-700 whitespace-pre-line leading-relaxed max-h-52 overflow-y-auto">
                                {message}
                            </div>
                        )}
                    </div>

                    {/* Action buttons */}
                    {activeTab === 'whatsapp' ? (
                        <div className="space-y-2 pt-1">
                            {!poc.phone && (
                                <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                                    <Phone size={14} className="text-amber-500 shrink-0" />
                                    <p className="text-[0.65rem] font-bold text-amber-700">No phone number on record for this POC</p>
                                </div>
                            )}
                            <button
                                onClick={handleSendWhatsApp}
                                disabled={!poc.phone}
                                className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-extrabold text-sm transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${whatsappClicked
                                    ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                                    : 'bg-[#25D366] text-white shadow-green-500/20 hover:bg-[#22c55e]'
                                    }`}
                            >
                                {whatsappClicked ? (
                                    <>
                                        <CheckCircle2 size={18} />
                                        Opened — Send Again
                                    </>
                                ) : (
                                    <>
                                        <MessageCircle size={18} />
                                        Open WhatsApp &amp; Send
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2 pt-1">
                            {!poc.email && !emailTo && (
                                <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                                    <Mail size={14} className="text-amber-500 shrink-0" />
                                    <p className="text-[0.65rem] font-bold text-amber-700">No email address on record — enter one above</p>
                                </div>
                            )}
                            <button
                                onClick={handleSendEmail}
                                disabled={emailSending || emailSent || !emailTo}
                                className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-extrabold text-sm transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${emailSent
                                    ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                                    : 'bg-[#0ea5e9] text-white shadow-sky-500/20 hover:bg-[#0284c7]'
                                    }`}
                            >
                                {emailSending ? (
                                    <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...</>
                                ) : emailSent ? (
                                    <><CheckCircle2 size={18} /> Email Sent!</>
                                ) : (
                                    <><Mail size={18} /> Send Email</>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer hint */}
                <div className="bg-slate-50 border-t border-slate-100 px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                        <p className="text-[0.6rem] text-slate-400 font-medium">
                            Message is personalized with your name: <span className="font-bold text-slate-600">{senderName}</span>
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-extrabold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AutoMessagePopup;
