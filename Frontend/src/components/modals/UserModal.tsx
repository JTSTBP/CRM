import React, { useState, useEffect } from 'react';
import { X, User, Mail, Shield, Phone, Lock, Eye, EyeOff } from 'lucide-react';

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (userData: any) => void;
    user?: any; // If provided, we are editing
    loading?: boolean;
    users?: any[];
}

const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, onSave, user, loading, users }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        role: 'BD Executive',
        phone: '',
        personal_email: '',
        date_of_joining: '',
        dob: '',
        status: 'Active',
        password: '',
        reporter: ''
    });
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                email: user.email || '',
                role: user.role || 'BD Executive',
                phone: user.phone || '',
                personal_email: user.personal_email || '',
                date_of_joining: user.date_of_joining ? new Date(user.date_of_joining).toISOString().split('T')[0] : '',
                dob: user.dob ? new Date(user.dob).toISOString().split('T')[0] : '',
                status: user.status || 'Active',
                password: '', // Don't populate password during edit
                reporter: user.reporter?._id || user.reporter || ''
            });
        } else {
            setFormData({
                name: '',
                email: '',
                role: 'BD Executive',
                phone: '',
                personal_email: '',
                date_of_joining: '',
                dob: '',
                status: 'Active',
                password: '',
                reporter: ''
            });
        }
    }, [user, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-[#0f1c2e]/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 my-auto max-h-[95vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="font-bold text-[#0f1c2e] text-lg">
                        {user ? 'Edit User' : 'Add New User'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200/50 rounded-lg transition-colors text-slate-400"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Name */}
                        <div className="space-y-1.5">
                            <label className="text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider">
                                Full Name <span className="text-rose-500 text-base leading-none">*</span>
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                <input
                                    required
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold text-[#0f1c2e] focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/10 focus:border-[#0ea5e9] transition-all"
                                    placeholder="Enter full name"
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-1.5">
                            <label className="text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider">
                                Official Email <span className="text-rose-500 text-base leading-none">*</span>
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                <input
                                    required
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold text-[#0f1c2e] focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/10 focus:border-[#0ea5e9] transition-all"
                                    placeholder="email@example.com"
                                />
                            </div>
                        </div>

                        {/* Personal Email */}
                        <div className="space-y-1.5">
                            <label className="text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider">Personal Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                <input
                                    type="email"
                                    value={formData.personal_email}
                                    onChange={(e) => setFormData({ ...formData, personal_email: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold text-[#0f1c2e] focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/10 focus:border-[#0ea5e9] transition-all"
                                    placeholder="personal@example.com"
                                />
                            </div>
                        </div>

                        {/* Phone */}
                        <div className="space-y-1.5">
                            <label className="text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider">Phone Number</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                <input
                                    type="text"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold text-[#0f1c2e] focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/10 focus:border-[#0ea5e9] transition-all"
                                    placeholder="Enter phone number"
                                />
                            </div>
                        </div>

                        {/* DOB */}
                        <div className="space-y-1.5">
                            <label className="text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider">Date of Birth</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300">🎂</span>
                                <input
                                    type="date"
                                    value={formData.dob}
                                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold text-[#0f1c2e] focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/10 focus:border-[#0ea5e9] transition-all"
                                />
                            </div>
                        </div>

                        {/* DOJ */}
                        <div className="space-y-1.5">
                            <label className="text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider">Date of Joining</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300">📅</span>
                                <input
                                    type="date"
                                    value={formData.date_of_joining}
                                    onChange={(e) => setFormData({ ...formData, date_of_joining: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold text-[#0f1c2e] focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/10 focus:border-[#0ea5e9] transition-all"
                                />
                            </div>
                        </div>

                        {/* Role */}
                        <div className="space-y-1.5 lg:col-span-2">
                            <label className="text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider">
                                Role <span className="text-rose-500 text-base leading-none">*</span>
                            </label>
                            <div className="relative">
                                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold text-[#0f1c2e] focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/10 focus:border-[#0ea5e9] transition-all appearance-none"
                                >
                                    <option value="Admin">Admin</option>
                                    <option value="Manager">Manager</option>
                                    <option value="BD Executive">BD Executive</option>
                                </select>
                            </div>
                        </div>

                        {/* Reports To */}
                        {formData.role !== 'Admin' && (
                            <div className="space-y-1.5 lg:col-span-2">
                                <label className="text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider">
                                    Reports To
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                    <select
                                        value={formData.reporter}
                                        onChange={(e) => setFormData({ ...formData, reporter: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold text-[#0f1c2e] focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/10 focus:border-[#0ea5e9] transition-all appearance-none"
                                    >
                                        <option value="">Select Reporter</option>
                                        {users?.filter(u => {
                                            if (user && u._id === user._id) return false;
                                            if (formData.role === 'BD Executive') return u.role === 'Manager' || u.role === 'Admin';
                                            if (formData.role === 'Manager') return u.role === 'Admin';
                                            return false;
                                        }).map(r => (
                                            <option key={r._id} value={r._id}>{r.name} ({r.role})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                        <label className="text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider">
                            {user ? 'New Password (Optional)' : <>Password <span className="text-rose-500 text-base leading-none">*</span></>}
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                            <input
                                required={!user}
                                type={showPassword ? 'text' : 'password'}
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-12 text-sm font-semibold text-[#0f1c2e] focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/10 focus:border-[#0ea5e9] transition-all"
                                placeholder={user ? 'Leave blank to keep current' : 'Enter password'}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Status */}
                    <div className="space-y-1.5">
                        <label className="text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider">Account Status</label>
                        <div className="flex gap-4">
                            <label className="flex-1 cursor-pointer">
                                <input
                                    type="radio"
                                    name="status"
                                    value="Active"
                                    checked={formData.status === 'Active'}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="sr-only"
                                />
                                <div className={`px-4 py-2.5 rounded-xl border-2 text-center text-sm font-bold transition-all ${formData.status === 'Active'
                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-600'
                                    : 'bg-white border-slate-100 text-slate-400'
                                    }`}>
                                    Active
                                </div>
                            </label>
                            <label className="flex-1 cursor-pointer">
                                <input
                                    type="radio"
                                    name="status"
                                    value="Inactive"
                                    checked={formData.status === 'Inactive'}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="sr-only"
                                />
                                <div className={`px-4 py-2.5 rounded-xl border-2 text-center text-sm font-bold transition-all ${formData.status === 'Inactive'
                                    ? 'bg-amber-50 border-amber-500 text-amber-600'
                                    : 'bg-white border-slate-100 text-slate-400'
                                    }`}>
                                    Inactive
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-sky-500/20 text-sm disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Saving...
                                </div>
                            ) : (
                                user ? 'Update User' : 'Create User'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserModal;
