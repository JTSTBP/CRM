import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import {
    LayoutDashboard,
    BarChart3,
    UserCircle,
    LogOut,
    ChevronRight,
    ClipboardCheck,
    Activity,
    Contact,
    Mail
} from 'lucide-react';

interface ManagerSidebarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

const ManagerSidebar: React.FC<ManagerSidebarProps> = ({ isOpen, setIsOpen }) => {
    const navigate = useNavigate();

    const menuItems = [
        { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/manager/dashboard' },
        { icon: <Activity size={20} />, label: 'Company Details', path: '/manager/leads' },
        { icon: <ClipboardCheck size={20} />, label: 'Company Approvals', path: '/manager/add-lead' },
        { icon: <Contact size={20} />, label: 'Contacts', path: '/manager/contacts' },
        { icon: <BarChart3 size={20} />, label: 'Reports', path: '/manager/reports' },
        { icon: <UserCircle size={20} />, label: 'Profile', path: '/manager/profile' },
        { icon: <Mail size={20} />, label: 'Send Email', path: '/manager/email-sending' },
    ];

    const handleLogout = async () => {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                await fetch(`${API_BASE_URL}/api/attendance/logout`, {
                    method: 'POST',
                    headers: { 'x-auth-token': token || '' }
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        }
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    return (
        <aside className={`
            fixed inset-y-0 left-0 z-50 w-64 bg-[#0f1c2e] text-white flex flex-col h-screen 
            transition-transform duration-300 ease-in-out border-r border-slate-800/50 shadow-2xl
            lg:translate-x-0 lg:sticky lg:top-0 lg:shadow-xl
            ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
            {/* Brand Logo & Close Button */}
            <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img src="/logo.png" alt="CRM Logo" className="h-10 w-auto object-contain" />
                    <span className="text-xl font-bold tracking-tight">JTCRM</span>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-slate-800 rounded-lg lg:hidden text-slate-400"
                >
                    <LogOut size={20} className="rotate-180" />
                </button>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 mt-4 px-3 space-y-1">
                {menuItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsOpen(false)}
                        className={({ isActive }) => `
                            flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group
                            ${isActive
                                ? 'bg-[#0ea5e9]/10 text-[#0ea5e9] font-semibold border-l-4 border-[#0ea5e9]'
                                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}
                        `}
                    >
                        {({ isActive }) => (
                            <>
                                <div className="flex items-center gap-3">
                                    <span className={`transition-colors duration-200 ${isActive ? 'text-[#0ea5e9]' : 'group-hover:text-white'}`}>
                                        {item.icon}
                                    </span>
                                    <span className="text-[0.95rem]">{item.label}</span>
                                </div>
                                <ChevronRight
                                    size={16}
                                    className={`opacity-0 group-hover:opacity-100 transition-all duration-200 -translate-x-2 group-hover:translate-x-0`}
                                />
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Logout Section */}
            <div className="p-4 border-t border-slate-800/50">
                <button
                    onClick={() => {
                        handleLogout();
                        setIsOpen(false);
                    }}
                    className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-400/5 rounded-xl transition-all duration-200 group"
                >
                    <LogOut size={20} className="group-hover:translate-x-1 transition-transform" />
                    <span className="text-[0.95rem] font-medium">Logout</span>
                </button>
            </div>
        </aside>
    );
};

export default ManagerSidebar;
