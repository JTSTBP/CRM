import React, { useEffect, useCallback } from 'react';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import BDSidebar from './BDSidebar';
import Navbar from './Navbar';
import { API_BASE_URL } from '../../config';
import toast from 'react-hot-toast';

const BDLayout: React.FC = () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const navigate = useNavigate();

    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

    const handleLogout = useCallback(async () => {
        const currentToken = localStorage.getItem('token');
        try {
            if (currentToken) {
                await fetch(`${API_BASE_URL}/api/attendance/logout`, {
                    method: 'POST',
                    headers: { 'x-auth-token': currentToken }
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        }
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        toast.error('Session expired due to inactivity');
        navigate('/login', { replace: true });
    }, [navigate]);

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const resetTimer = () => {
            if (timeoutId) clearTimeout(timeoutId);

            const isAutoLogoutEnabled = localStorage.getItem('autoLogoutEnabled') !== 'false';
            if (!isAutoLogoutEnabled) return;

            timeoutId = setTimeout(() => {
                handleLogout();
            }, 5 * 60 * 1000); // 5 minutes inactivity
        };

        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        events.forEach(event => document.addEventListener(event, resetTimer, true));
        resetTimer();

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            events.forEach(event => document.removeEventListener(event, resetTimer, true));
        };
    }, [handleLogout]);

    // Safety check: Ensure user is logged in
    // Note: It's good to be defensive, redirecting unauthorized users back.
    if (!token || user?.role !== 'BD Executive') {
        const redirectPath = user?.role === 'Admin' ? '/admin/dashboard' : '/login';
        return <Navigate to={redirectPath} replace />;
    }

    return (
        <div className="flex h-screen bg-[#f8fafc] relative overflow-hidden">
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <BDSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                <Navbar onMenuClick={() => setIsSidebarOpen(true)} />
                <main className="flex-1 overflow-y-auto relative">
                    <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:px-8 lg:py-6">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default BDLayout;
