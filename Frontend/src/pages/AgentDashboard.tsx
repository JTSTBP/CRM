import React from 'react';

const AgentDashboard: React.FC = () => {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    return (
        <div className="min-h-screen bg-[#f8fafc] p-8 flex items-center justify-center">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
                <h1 className="text-2xl font-bold text-[#0f1c2e] mb-4">Welcome, {user?.name}!</h1>
                <p className="text-slate-500 mb-8">Agent Dashboard is currently under development.</p>
                <button
                    onClick={() => {
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                        window.location.href = '/login';
                    }}
                    className="bg-red-50 text-red-600 px-6 py-2 rounded-xl font-bold hover:bg-red-100 transition-colors"
                >
                    Logout
                </button>
            </div>
        </div>
    );
};

export default AgentDashboard;
