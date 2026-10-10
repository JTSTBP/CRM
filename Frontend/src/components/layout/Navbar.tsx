import { Bell, Search, Settings, Menu } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

interface NavbarProps {
    onMenuClick: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
    // Get user from localStorage
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const navigate = useNavigate();
    const location = useLocation();

    const handleProfileNavigation = () => {
        const basePath = location.pathname.startsWith('/admin') ? '/admin' : '/bd';
        navigate(`${basePath}/profile`);
    };

    const handleNotificationsClick = () => {
        toast(
            <div className="flex flex-col gap-1">
                <span className="font-bold text-sm text-[#0f1c2e]">No New Notifications</span>
                <span className="text-xs text-slate-500">You're all caught up!</span>
            </div>,
            { duration: 3000, icon: '🔔' }
        );
    };

    return (
        <header className="h-16 sm:h-20 bg-white border-b border-slate-200/60 sticky top-0 z-40 flex items-center justify-between px-4 sm:px-8 shadow-sm">
            {/* Left Section: Mobile Menu & Search */}
            <div className="flex items-center gap-3 sm:gap-4 flex-1">
                <button
                    onClick={onMenuClick}
                    className="p-2 -ml-2 hover:bg-slate-100 rounded-lg lg:hidden text-slate-600"
                >
                    <Menu size={24} />
                </button>
                <div className="relative w-full max-w-md hidden md:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search leads, users, tasks..."
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-sky-500/5 focus:border-[#0ea5e9] transition-all"
                    />
                </div>
            </div>

            {/* Right Section: Actions & Profile */}
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3 text-slate-500 px-3 py-2 border-r border-slate-200">
                    <button
                        onClick={handleNotificationsClick}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors relative"
                        title="Notifications"
                    >
                        <Bell size={20} />
                        {/* Static indicator for design purposes, can make dynamic later */}
                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                    </button>
                    <button
                        onClick={handleProfileNavigation}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Settings"
                    >
                        <Settings size={20} />
                    </button>
                </div>

                <div
                    onClick={handleProfileNavigation}
                    className="flex items-center gap-3.5 pl-2 cursor-pointer group"
                >
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-[#0f1c2e] leading-tight">{user?.name || 'Admin User'}</p>
                        <p className="text-[0.75rem] font-medium text-slate-400 uppercase tracking-wider">{user?.role || 'Administrator'}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0ea5e9] to-[#0284c7] flex items-center justify-center text-white font-bold shadow-lg shadow-sky-500/10 border-2 border-white group-hover:scale-105 transition-transform">
                        {(user?.name || 'A').charAt(0).toUpperCase()}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Navbar;
