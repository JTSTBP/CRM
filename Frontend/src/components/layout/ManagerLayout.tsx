import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import ManagerSidebar from './ManagerSidebar';
import Navbar from './Navbar';

const ManagerLayout: React.FC = () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

    // Safety check: Ensure user is logged in and is a Manager
    if (!token || user?.role !== 'Manager') {
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
            <ManagerSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

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

export default ManagerLayout;
