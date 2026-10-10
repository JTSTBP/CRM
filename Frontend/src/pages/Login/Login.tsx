import React, { useState, useEffect } from 'react';
import { Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config';

interface LoginProps {
    type?: 'agent' | 'admin';
}

const Login: React.FC<LoginProps> = ({ type = 'agent' }) => {
    useEffect(() => {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');

        if (token && userStr) {
            const user = JSON.parse(userStr);
            if (user.role === 'Admin') {
                window.location.href = '/admin/dashboard';
            } else if (user.role === 'Manager') {
                window.location.href = '/manager/dashboard';
            } else if (user.role === 'BD Executive') {
                window.location.href = '/bd/dashboard';
            } else {
                window.location.href = '/dashboard';
            }
        }
    }, []);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const isAdmin = type === 'admin';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    password,
                    loginType: type, // 'agent' or 'admin'
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }

            // Success
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('loginDate', new Date().toDateString());

            console.log('Login successful:', data);

            // Redirect based on role or to a dashboard
            if (isAdmin) {
                window.location.href = '/admin/dashboard';
            } else if (data.user.role === 'Manager') {
                window.location.href = '/manager/dashboard';
            } else if (data.user.role === 'BD Executive') {
                window.location.href = '/bd/dashboard';
            } else {
                window.location.href = '/dashboard';
            }
        } catch (err: any) {
            console.error('Login error:', err.message);
            toast.error(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row min-h-screen w-full bg-[#f8fafc]">
            {/* Left Panel */}
            <div className="flex-none lg:flex-1 bg-[#0f1c2e] text-white flex items-center justify-center p-8 lg:p-16 transition-all min-h-[40vh] lg:min-h-screen">
                <div className="w-full max-w-[500px]">
                    <div className="flex items-center gap-3 mb-8 lg:mb-16 pt-4 lg:pt-0">
                        <img src="/logo.png" alt="CRM Logo" className="h-14 w-auto object-contain drop-shadow-md" />
                        <span className="text-2xl font-bold tracking-tight">JTCRM</span>
                    </div>

                    <h1 className="text-3xl sm:text-4xl lg:text-[3rem] font-extrabold leading-[1.1] mb-4 lg:mb-8 tracking-tight">
                        {isAdmin ? 'Admin Panel' : 'Manage Your Sales Pipeline Smarter'}
                    </h1>
                    <p className="text-sm sm:text-base lg:text-lg text-slate-400 leading-relaxed mb-8 lg:mb-10 max-w-[440px]">
                        {isAdmin
                            ? 'Manage your team, monitor performance, and oversee all CRM operations from one place.'
                            : 'Track calls, manage contacts, and close deals faster with your AI-powered CRM assistant.'}
                    </p>

                    <ul className="hidden sm:flex flex-col gap-4 lg:gap-6">
                        {(isAdmin ? [
                            'User management & roles',
                            'Company & lead oversight',
                            'Call activity monitoring'
                        ] : [
                            'Smart Call Management',
                            'Contact & Company Tracking',
                            'Pipeline & Deal Management',
                            'Performance Dashboard'
                        ]).map((feature, idx) => (
                            <li key={idx} className="flex items-center gap-4 text-base lg:text-lg font-medium text-slate-200">
                                <span className="w-2 h-2 shrink-0 bg-[#0ea5e9] rounded-full"></span>
                                {feature}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Right Panel */}
            <div className="flex-1 bg-white flex items-center justify-center p-8 lg:p-16 z-10 w-full lg:min-h-screen">
                <div className="w-full max-w-[420px] mx-auto">
                    <h2 className="text-3xl lg:text-[2.75rem] font-extrabold text-[#0f1c2e] mb-2 tracking-tight">
                        {isAdmin ? 'Sign in' : 'Welcome Back'}
                    </h2>
                    <p className="text-base text-slate-500 mb-8">
                        {isAdmin ? 'Enter your admin credentials to continue' : 'Sign in to your agent account'}
                    </p>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                        <div className="flex flex-col gap-2.5">
                            <label htmlFor="email" className="text-sm font-bold text-slate-700">Email</label>
                            <div className="flex items-center border border-slate-200 rounded-xl px-4 bg-white h-14 transition-all focus-within:border-[#0ea5e9] focus-within:ring-4 focus-within:ring-sky-500/5">
                                <Mail className="text-slate-400 mr-3 shrink-0" size={20} />
                                <input
                                    type="email"
                                    id="email"
                                    placeholder={isAdmin ? 'admin@company.com' : 'agent@company.com'}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="flex-1 bg-transparent border-none outline-none text-base text-slate-900 w-full placeholder:text-slate-300"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2.5">
                            <label htmlFor="password" className="text-sm font-bold text-slate-700">Password</label>
                            <div className="flex items-center border border-slate-200 rounded-xl px-4 bg-white h-14 transition-all focus-within:border-[#0ea5e9] focus-within:ring-4 focus-within:ring-sky-500/5">
                                <Lock className="text-slate-400 mr-3 shrink-0" size={20} />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    id="password"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="flex-1 bg-transparent border-none outline-none text-base text-slate-900 w-full placeholder:text-slate-300"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="text-slate-400 hover:text-slate-600 focus:outline-none ml-2"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center justify-center w-full bg-[#0ea5e9] hover:bg-[#0284c7] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed text-white rounded-xl h-14 text-base font-bold cursor-pointer transition-all mt-4 shadow-lg shadow-sky-500/20"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Signing in...
                                </span>
                            ) : (
                                <>{isAdmin ? 'Sign In' : 'Sign In'} <ArrowRight size={20} className="ml-2 shrink-0" /></>
                            )}
                        </button>
                    </form>

                    <div className="mt-12 text-center">
                        {isAdmin ? (
                            <a href="/login" className="text-[0.9rem] text-slate-500 hover:text-[#0ea5e9] font-medium transition-colors">
                                Back to app login
                            </a>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <p className="text-[0.9rem] text-slate-500">
                                    Contact your administrator to get an account
                                </p>
                                <a href="/admin-login" className="text-[0.9rem] text-[#0ea5e9] hover:text-[#0284c7] font-bold inline-flex items-center justify-center transition-colors">
                                    Admin Login <ArrowRight size={16} className="ml-1 shrink-0" />
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
