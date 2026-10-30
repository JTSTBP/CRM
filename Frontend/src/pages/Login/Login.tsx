import React, { useState, useEffect } from 'react';
import { Mail, Lock, ArrowRight, Eye, EyeOff, Users, Building2, Phone, ShieldCheck, LoaderCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config';
import './Login.css';

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
            if (data.user.role === 'Admin') {
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

    const features = isAdmin ? [
        { icon: Users, title: 'User management & roles', detail: 'Manage recruiter permissions & account hierarchies' },
        { icon: Building2, title: 'Company & lead oversight', detail: 'Monitor client accounts, hiring pipelines & mandates' },
        { icon: Phone, title: 'Call activity monitoring', detail: 'Track daily recruiter calls, TAT & candidate reach' },
    ] : [
        { icon: Phone, title: 'Smart Call Management', detail: 'Track calls, follow-ups & daily activity' },
        { icon: Building2, title: 'Contact & Company Tracking', detail: 'Keep your contacts and client accounts connected' },
        { icon: Users, title: 'Pipeline & Deal Management', detail: 'Manage your pipeline and close deals faster' },
    ];
    const trustFooter = <div className="login-trust"><span>&copy; 2026 Jobs Territory Consulting</span><span><ShieldCheck size={13} /> Enterprise Security</span></div>;

    return (
        <div className="login-page">
            <header className="login-topbar">
                <div><span className="login-status-dot" /><strong>JTCRM {isAdmin ? 'ADMIN' : 'WORKSPACE'}</strong><span className="login-topline">Executive Talent Architecture</span></div>
                <span className="login-version">SYS V2.4</span>
            </header>
            <main className="login-stage">
                <div className="login-card">
                    <section className="login-intro" aria-labelledby="login-title">
                        <div className="login-brand">
                            <div className="login-emblem"><img src="/login-logo.png" alt="Jobs Territory" /></div>
                            <div><div className="login-brand-name">JTCRM <span>{isAdmin ? 'Admin' : 'App'}</span></div><p>Jobs Territory Ecosystem</p></div>
                        </div>
                        <h1 id="login-title">{isAdmin ? 'Admin Panel' : 'Manage Your Sales Pipeline Smarter'}</h1>
                        <p className="login-description">{isAdmin ? 'Manage your team, monitor performance, and oversee all CRM operations from one place.' : 'Track calls, manage contacts, and close deals faster with your AI-powered CRM assistant.'}</p>
                        <div className="login-features">
                            {features.map(({ icon: Icon, title, detail }, index) => (
                                <div className={`login-feature login-feature-${index}`} key={title}>
                                    <span className="login-feature-icon"><Icon size={20} strokeWidth={1.7} /></span>
                                    <div><h2>{title}</h2><p>{detail}</p></div>
                                    <span className="login-feature-dot" />
                                </div>
                            ))}
                        </div>
                        <div className="login-desktop-trust">{trustFooter}</div>
                    </section>
                    <section className="login-form-panel" aria-labelledby="signin-title">
                        <div>
                            <div className="login-form-heading"><h2 id="signin-title">Sign in</h2><span>{isAdmin ? 'Admin Portal' : 'App Portal'}</span></div>
                            <p className="login-form-description">{isAdmin ? 'Enter your admin credentials to continue' : 'Sign in to your agent account'}</p>
                            <form onSubmit={handleSubmit} className="login-form">
                                <div className="login-field">
                                    <label htmlFor="email">Email</label>
                                    <div className="login-input"><Mail size={19} /><input id="email" name="email" type="email" autoComplete="username" placeholder={isAdmin ? 'admin@company.com' : 'agent@company.com'} value={email} onChange={e => setEmail(e.target.value)} required /></div>
                                </div>
                                <div className="login-field">
                                    <label htmlFor="password">Password</label>
                                    <div className="login-input"><Lock size={19} /><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>
                                </div>
                                <button className="login-submit" type="submit" disabled={loading} aria-busy={loading}>{loading ? <><LoaderCircle className="login-spinner" size={17} /> Signing in...</> : <>Sign In <ArrowRight size={17} /></>}</button>
                            </form>
                        </div>
                        <div className="login-bottom">
                            {isAdmin ? <a href="/login">Back to app login</a> : <><p>Contact your administrator to get an account</p><a href="/admin-login">Admin Login <ArrowRight size={14} /></a></>}
                            <div className="login-mobile-trust">{trustFooter}</div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
};

export default Login;
