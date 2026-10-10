import React, { useRef } from 'react';
import { User, Mail, Phone, Shield, Calendar, Lock, Clock, Camera, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import toast from 'react-hot-toast';

const Profile: React.FC = () => {
    const userStr = localStorage.getItem('user');
    const initialUser = userStr ? JSON.parse(userStr) : null;
    const [user, setUser] = React.useState(initialUser);
    const [isEditing, setIsEditing] = React.useState(false);
    const [formData, setFormData] = React.useState<any>({
        name: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        personal_email: user?.personal_email || '',
        dob: user?.dob ? new Date(user.dob).toISOString().split('T')[0] : '',
    });
    const [error, setError] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
    const [previewImage, setPreviewImage] = React.useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [autoLogoutEnabled, setAutoLogoutEnabled] = React.useState(() => {
        return localStorage.getItem('autoLogoutEnabled') !== 'false';
    });

    const handleToggleAutoLogout = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.checked;
        setAutoLogoutEnabled(val);
        localStorage.setItem('autoLogoutEnabled', val.toString());
        toast.success(val ? 'Auto logout enabled' : 'Auto logout disabled');
    };

    const infoItems: any[] = [
        { icon: <User size={18} />, label: 'Full Name', value: user?.name || 'N/A', name: 'name' },
        { icon: <Mail size={18} />, label: 'Official Email', value: user?.email || 'N/A', name: 'email' },
        { icon: <Mail size={18} />, label: 'Personal Email', value: user?.personal_email || 'Not provided', name: 'personal_email' },
        { icon: <Shield size={18} />, label: 'Access Level', value: user?.role || 'N/A', readonly: true },
        { icon: <Phone size={18} />, label: 'Phone Number', value: user?.phone || 'Not provided', name: 'phone' },
        { icon: <Calendar size={18} />, label: 'Date of Birth', value: user?.dob ? new Date(user.dob).toLocaleDateString() : 'Not provided', name: 'dob', type: 'date' },
        { icon: <Calendar size={18} />, label: 'Date of Joining', value: user?.date_of_joining ? new Date(user.date_of_joining).toLocaleDateString() : 'Not provided', readonly: true },
        { icon: <Lock size={18} />, label: 'App Password', value: user?.appPassword || 'None set', readonly: true },
        { icon: <Calendar size={18} />, label: 'System Created On', value: (user?.createdAt || user?.created_at) ? new Date(user?.createdAt || user?.created_at).toLocaleDateString() : 'N/A', readonly: true },
        { icon: <Clock size={18} />, label: 'Last Login', value: user?.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'N/A', readonly: true },
    ];

    const handleSave = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const dataPayload = new FormData();

            Object.keys(formData).forEach(key => {
                if (formData[key]) dataPayload.append(key, formData[key]);
            });

            if (selectedFile) {
                dataPayload.append('profile_photo', selectedFile);
            }

            const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
                method: 'PUT',
                headers: {
                    'x-auth-token': token || ''
                },
                body: dataPayload
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to update profile');
            }

            // Update local storage and state
            localStorage.setItem('user', JSON.stringify(data));
            setUser(data);
            toast.success('Profile updated successfully');
            setIsEditing(false);
            setPreviewImage(null);
            setSelectedFile(null);
        } catch (err: any) {
            setError(err.message);
            toast.error(err.message || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-[1000px]">
            <div className="mb-8 flex justify-between items-end">
                <div className="text-left">
                    <h1 className="text-3xl font-extrabold text-[#0f1c2e] tracking-tight text-left">My Profile</h1>
                    <p className="text-slate-500 mt-1 text-left">View and manage your personal account settings.</p>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium flex items-center gap-3 animate-shake">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Profile Card */}
                <div className="md:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8 flex flex-col items-center">
                    <div className="relative group">
                        <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-[#0ea5e9] to-[#0184c7] flex items-center justify-center text-white text-4xl font-extrabold shadow-xl shadow-sky-500/20 mb-6 border-4 border-white overflow-hidden">
                            {(previewImage || user?.profile_photo) && !formData.delete_photo ? (
                                <img
                                    src={previewImage || `${API_BASE_URL}/uploads/${user.profile_photo}`}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                (user?.name || 'A').charAt(0).toUpperCase()
                            )}
                        </div>
                        {isEditing && (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-6 -right-2 p-2.5 bg-white text-[#0ea5e9] rounded-xl shadow-lg border border-slate-100 hover:bg-slate-50 transition-colors z-10"
                            >
                                <Camera size={18} />
                            </button>
                        )}
                        {isEditing && (user?.profile_photo || previewImage) && !formData.delete_photo && (
                            <button
                                onClick={() => {
                                    setPreviewImage(null);
                                    setSelectedFile(null);
                                    setFormData((prev: any) => ({ ...prev, delete_photo: 'true' }));
                                }}
                                className="absolute top-6 -right-2 p-2.5 bg-white text-rose-500 rounded-xl shadow-lg border border-slate-100 hover:bg-rose-50 transition-colors z-10"
                                title="Remove Photo"
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    setSelectedFile(file);
                                    setPreviewImage(URL.createObjectURL(file));
                                    setFormData((prev: any) => ({ ...prev, delete_photo: '' }));
                                }
                            }}
                        />
                    </div>

                    <h2 className="text-xl font-bold text-[#0f1c2e]">{user?.name}</h2>
                    <p className="text-slate-400 font-medium text-sm mt-1 uppercase tracking-widest">{user?.role}</p>

                    {!isEditing ? (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="mt-8 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors text-sm"
                        >
                            Edit Profile
                        </button>
                    ) : (
                        <div className="w-full space-y-3 mt-8">
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold py-3 rounded-xl transition-colors text-sm disabled:opacity-50"
                            >
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button
                                onClick={() => {
                                    setIsEditing(false);
                                    setPreviewImage(null);
                                    setSelectedFile(null);
                                    setFormData({
                                        name: user?.name || '',
                                        email: user?.email || '',
                                        phone: user?.phone || '',
                                        personal_email: user?.personal_email || '',
                                        dob: user?.dob ? new Date(user.dob).toISOString().split('T')[0] : '',
                                    });
                                    setError(null);
                                }}
                                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors text-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    <p className="mt-4 text-[0.7rem] text-slate-400 text-center font-medium">
                        Last login: {user?.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Just now'}
                    </p>
                </div>

                {/* Details Section */}
                <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h3 className="font-bold text-[#0f1c2e]">Personal Information</h3>
                        <span className={`text-[0.7rem] font-bold px-2 py-1 rounded-md uppercase tracking-wider border ${user?.status === 'Active' ? 'text-[#0ea5e9] bg-sky-50 border-sky-100/50' : 'text-rose-500 bg-rose-50 border-rose-100/50'}`}>Account Status: {user?.status || 'N/A'}</span>
                    </div>
                    <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-y-8 gap-x-12">
                        {infoItems.map((item, idx) => (
                            <div key={idx} className="space-y-1.5 text-left">
                                <label className="text-[0.75rem] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <span className="text-slate-300">{item.icon}</span>
                                    {item.label}
                                </label>
                                {isEditing && !item.readonly ? (
                                    <input
                                        type={item.type || 'text'}
                                        value={formData[item.name as keyof typeof formData]}
                                        onChange={(e) => setFormData({ ...formData, [item.name!]: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-[#0f1c2e] focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/20 focus:border-[#0ea5e9]"
                                    />
                                ) : (
                                    <p className="text-[0.95rem] font-semibold text-[#0f1c2e] leading-snug">{item.value}</p>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="p-8 bg-sky-50/30 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg border border-sky-100 shadow-sm">
                                <Shield className="text-[#0ea5e9]" size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-[#0f1c2e]">Two-Factor Authentication</p>
                                <p className="text-xs text-slate-500">Currently disabled for your account</p>
                            </div>
                        </div>
                        <button className="text-sm font-bold text-[#0ea5e9] hover:underline">Enable</button>
                    </div>
                </div>
            </div>

            {user?.role === 'BD Executive' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden mt-8">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h3 className="font-bold text-[#0f1c2e]">Session Settings</h3>
                    </div>
                    <div className="p-8 flex items-center justify-between">
                        <div className="text-left">
                            <p className="text-sm font-bold text-[#0f1c2e]">Auto Logout on Inactivity</p>
                            <p className="text-xs text-slate-500 mt-1">Automatically log out if there is no keyboard, mouse, or touch activity for 5 minutes.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={autoLogoutEnabled}
                                onChange={handleToggleAutoLogout}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0ea5e9]"></div>
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;
