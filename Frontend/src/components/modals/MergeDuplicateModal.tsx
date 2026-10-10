import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Building2, Globe, Users, ArrowRight, Check } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import toast from 'react-hot-toast';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    duplicateLeadId: string;
}

type FieldKey = 'company_name' | 'company_email' | 'company_size' | 'website_url' | 'industry_name' | 'linkedin_link' | 'lead_source';

const FIELDS_TO_COMPARE: { key: FieldKey; label: string }[] = [
    { key: 'company_name', label: 'Company Name' },
    { key: 'website_url', label: 'Website URL' },
    { key: 'company_email', label: 'Company Email' },
    { key: 'company_size', label: 'Company Size' },
    { key: 'industry_name', label: 'Industry' },
    { key: 'linkedin_link', label: 'LinkedIn URL' },
    { key: 'lead_source', label: 'Lead Source' },
];

const MergeDuplicateModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, duplicateLeadId }) => {
    const [duplicateLead, setDuplicateLead] = useState<any>(null);
    const [originalLead, setOriginalLead] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [merging, setMerging] = useState(false);
    
    // Tracks which version of the field the user wants to keep
    const [fieldSelections, setFieldSelections] = useState<Record<FieldKey, 'original' | 'duplicate'>>({
        company_name: 'original',
        company_email: 'original',
        company_size: 'original',
        website_url: 'original',
        industry_name: 'original',
        linkedin_link: 'original',
        lead_source: 'original'
    });

    useEffect(() => {
        if (isOpen && duplicateLeadId) {
            fetchLeads();
            // Reset selections
            setFieldSelections({
                company_name: 'original',
                company_email: 'original',
                company_size: 'original',
                website_url: 'original',
                industry_name: 'original',
                linkedin_link: 'original',
                lead_source: 'original'
            });
        } else {
            setDuplicateLead(null);
            setOriginalLead(null);
        }
    }, [isOpen, duplicateLeadId]);

    const fetchLeads = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            
            // 1. Fetch duplicate lead
            const dupRes = await fetch(`${API_BASE_URL}/api/leads/${duplicateLeadId}?includePending=true`, {
                headers: { 'x-auth-token': token || '' }
            });
            if (!dupRes.ok) throw new Error('Failed to fetch duplicate lead');
            const dupData = await dupRes.json();
            setDuplicateLead(dupData);

            // 2. Fetch original lead
            if (dupData.duplicateOf) {
                const origRes = await fetch(`${API_BASE_URL}/api/leads/${dupData.duplicateOf._id || dupData.duplicateOf}?includePending=true`, {
                    headers: { 'x-auth-token': token || '' }
                });
                if (origRes.ok) {
                    const origData = await origRes.json();
                    setOriginalLead(origData);
                }
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to load lead details for merging');
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmMerge = async () => {
        try {
            setMerging(true);
            
            // Construct the overwrites payload
            const overwrites: Record<string, string> = {};
            for (const field of FIELDS_TO_COMPARE) {
                if (fieldSelections[field.key] === 'duplicate' && duplicateLead[field.key] !== undefined) {
                    overwrites[field.key] = duplicateLead[field.key];
                }
            }

            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/leads/${duplicateLeadId}/approve`, {
                method: 'PATCH',
                headers: { 
                    'x-auth-token': token || '',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ overwrites })
            });
            
            if (response.ok) {
                toast.success('Duplicate lead merged successfully!');
                onSuccess();
                onClose();
            } else {
                const data = await response.json();
                toast.error(data.message || 'Failed to merge lead');
            }
        } catch (err) {
            toast.error('Server error during merge');
        } finally {
            setMerging(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
                
                {/* Header */}
                <div className="flex items-center justify-between p-6 sm:px-8 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 shadow-sm border border-indigo-100/50">
                            <ArrowRight size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-[#0f1c2e]">Review & Merge Lead</h2>
                            <p className="text-[0.7rem] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Select the fields you want to keep</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-slate-50/30">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-4">
                            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-sm font-bold uppercase tracking-widest">Loading details...</p>
                        </div>
                    ) : !originalLead || !duplicateLead ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <AlertCircle size={48} className="mb-4 text-slate-300" />
                            <p className="text-sm font-bold uppercase tracking-widest">Unable to load comparison data</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            
                            {/* Side by side columns */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Original Lead Column */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                                    <div className="bg-slate-50 border-b border-slate-200 p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                                <Building2 size={16} className="text-slate-500" /> Original Lead
                                            </h3>
                                            <span className="px-2 py-1 bg-slate-200 text-slate-600 text-[0.6rem] font-bold rounded uppercase tracking-wider">Existing</span>
                                        </div>
                                        <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                            <Users size={14} className="text-slate-400" />
                                            BD Exec: <span className="font-bold text-slate-700">{originalLead?.assignedBy?.name || originalLead?.createdBy?.name || 'Unknown'}</span>
                                        </p>
                                    </div>
                                    <div className="p-6 space-y-4 flex-1">
                                        <p className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 mb-2">Company Fields</p>
                                        
                                        <div className="space-y-3">
                                            {FIELDS_TO_COMPARE.map(field => {
                                                const isSelected = fieldSelections[field.key] === 'original';
                                                const value = originalLead[field.key];
                                                
                                                return (
                                                    <div 
                                                        key={field.key} 
                                                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-300'}`}
                                                        onClick={() => setFieldSelections(p => ({ ...p, [field.key]: 'original' }))}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300 bg-white'}`}>
                                                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{field.label}</p>
                                                                <p className={`text-sm break-all ${!value ? 'text-slate-400 italic' : 'text-slate-700 font-medium'}`}>
                                                                    {value || 'Empty'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        
                                        <div className="mt-6 pt-4 border-t border-slate-100">
                                            <div className="flex items-center gap-2 text-slate-400 mb-3">
                                                <Users size={14} />
                                                <span className="text-[0.65rem] font-bold uppercase tracking-widest">Current Contacts ({originalLead.points_of_contact?.length || 0})</span>
                                            </div>
                                            <div className="space-y-2">
                                                {originalLead.points_of_contact?.map((poc: any, idx: number) => (
                                                    <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                                                        <p className="text-sm font-bold text-slate-700">{poc.name}</p>
                                                        <p className="text-xs text-slate-500">{poc.designation || 'No designation'} • {poc.phone || 'No phone'}</p>
                                                    </div>
                                                ))}
                                                {(!originalLead.points_of_contact || originalLead.points_of_contact.length === 0) && (
                                                    <p className="text-xs text-slate-400 italic">No contacts</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Duplicate Lead Column */}
                                <div className="bg-white rounded-2xl border-2 border-indigo-100 shadow-sm overflow-hidden flex flex-col relative">
                                    <div className="bg-indigo-50/50 border-b border-indigo-100 p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-sm font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2">
                                                <Globe size={16} className="text-indigo-500" /> New Submission
                                            </h3>
                                            <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-[0.6rem] font-bold rounded uppercase tracking-wider">Duplicate</span>
                                        </div>
                                        <p className="text-xs text-indigo-500 font-medium flex items-center gap-1">
                                            <Users size={14} className="text-indigo-400" />
                                            BD Exec: <span className="font-bold text-indigo-700">{duplicateLead?.assignedBy?.name || duplicateLead?.createdBy?.name || 'Unknown'}</span>
                                        </p>
                                    </div>
                                    <div className="p-6 space-y-4 flex-1">
                                        <p className="text-[0.65rem] font-bold uppercase tracking-widest text-indigo-400 mb-2">Company Fields</p>
                                        
                                        <div className="space-y-3">
                                            {FIELDS_TO_COMPARE.map(field => {
                                                const isSelected = fieldSelections[field.key] === 'duplicate';
                                                const value = duplicateLead[field.key];
                                                
                                                return (
                                                    <div 
                                                        key={field.key} 
                                                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-indigo-500 bg-indigo-50/50' : 'border-indigo-50/50 hover:border-indigo-200'}`}
                                                        onClick={() => setFieldSelections(p => ({ ...p, [field.key]: 'duplicate' }))}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-indigo-200 bg-white'}`}>
                                                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[0.65rem] font-bold uppercase tracking-widest text-indigo-400 mb-0.5">{field.label}</p>
                                                                <p className={`text-sm break-all ${!value ? 'text-slate-400 italic' : 'text-slate-700 font-medium'}`}>
                                                                    {value || 'Empty'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        <div className="mt-6 pt-4 border-t border-indigo-100/50">
                                            <div className="flex items-center gap-2 text-indigo-400 mb-3">
                                                <Users size={14} />
                                                <span className="text-[0.65rem] font-bold uppercase tracking-widest">Contacts to Add ({duplicateLead.points_of_contact?.length || 0})</span>
                                            </div>
                                            <div className="space-y-2">
                                                {duplicateLead.points_of_contact?.map((poc: any, idx: number) => (
                                                    <div key={idx} className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 relative overflow-hidden">
                                                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-400"></div>
                                                        <p className="text-sm font-bold text-slate-700">{poc.name}</p>
                                                        <p className="text-xs text-slate-500">{poc.designation || 'No designation'} • {poc.phone || 'No phone'}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Auto-Merge Info Box */}
                            <div className="bg-amber-50/80 border border-amber-200/60 rounded-2xl p-5">
                                <h3 className="text-sm font-black text-amber-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <AlertCircle size={16} /> Auto-Merge Actions
                                </h3>
                                <ul className="text-sm text-amber-800 space-y-3 font-medium">
                                    <li className="flex items-start gap-2">
                                        <Check size={16} className="mt-0.5 text-amber-500 shrink-0" />
                                        <span>The contacts listed under <strong>"New Submission"</strong> will be automatically added to the Original Lead.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check size={16} className="mt-0.5 text-amber-500 shrink-0" />
                                        <span>The BD who submitted this duplicate (<span className="font-bold">{duplicateLead.assignedBy?.name || duplicateLead.createdBy?.name || 'BD'}</span>) will be added to the Original Lead's Assignees list.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check size={16} className="mt-0.5 text-amber-500 shrink-0" />
                                        <span>The duplicate lead record will be permanently deleted after merging.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-slate-500 font-medium max-w-lg">
                        Please review your field selections above carefully. This action cannot be undone.
                    </p>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button 
                            onClick={onClose}
                            className="flex-1 sm:flex-none px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleConfirmMerge}
                            disabled={loading || merging || !originalLead}
                            className="flex-1 sm:flex-none bg-indigo-500 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                        >
                            {merging ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Merging...
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={16} />
                                    Confirm Merge
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MergeDuplicateModal;
