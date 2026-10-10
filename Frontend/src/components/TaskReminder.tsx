import { useEffect, useState, useCallback, useRef } from 'react';
import { Bell, X, Calendar, ExternalLink, BellOff, Shield } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../config';

interface Task {
    _id: string;
    title: string;
    due_date: string;
    type: string;
    lead_id: {
        _id: string;
        company_name: string;
    } | null;
    createdBy: {
        _id: string;
        name: string;
    } | null;
}

// Convert base64 VAPID public key to Uint8Array for pushManager.subscribe
function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

const TaskReminder = () => {
    const [dueTasks, setDueTasks] = useState<Task[]>([]);
    const [pushEnabled, setPushEnabled] = useState<boolean | null>(null); // null = unknown
    const dismissedTaskIdsRef = useRef<Set<string>>(new Set());
    const navigate = useNavigate();
    const location = useLocation();

    // Don't show task reminders on login pages
    const isLoginPage = location.pathname === '/login' || location.pathname === '/admin-login';

    const handleCardClick = (task: Task) => {
        if (task.lead_id?._id) {
            navigate(`/admin/leads?openLead=${task.lead_id._id}&tab=tasks`);
        }
    };

    // ── Register Service Worker & subscribe on mount ──────────────
    useEffect(() => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

        const setupPush = async () => {
            try {
                const registration = await navigator.serviceWorker.register('/service-worker.js');
                await navigator.serviceWorker.ready;

                const existingSub = await registration.pushManager.getSubscription();
                if (existingSub) {
                    setPushEnabled(true);
                    return; // already subscribed
                }

                // Ask for permission silently on first load
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    setPushEnabled(false);
                    return;
                }

                // Fetch VAPID public key from backend
                const keyRes = await fetch(`${API_BASE_URL}/api/push/vapid-public-key`);
                const { publicKey } = await keyRes.json();

                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicKey)
                });

                // Send subscription to backend
                const token = localStorage.getItem('token');
                if (token) {
                    await fetch(`${API_BASE_URL}/api/push/subscribe`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-auth-token': token
                        },
                        body: JSON.stringify(subscription)
                    });
                }
                setPushEnabled(true);
            } catch (err) {
                console.warn('Push notification setup failed:', err);
                setPushEnabled(false);
            }
        };

        // Only try to set up push if user is logged in
        const token = localStorage.getItem('token');
        if (token) setupPush();
    }, []);

    // ── Fetch in-app due tasks ────────────────────────────────────
    const fetchTasks = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${API_BASE_URL}/api/tasks/my-tasks`, {
                headers: { 'x-auth-token': token }
            });

            if (!response.ok) return;

            const data: Task[] = await response.json();
            const now = new Date();

            const overdueTasks = data.filter(task => {
                const isPastDue = new Date(task.due_date) <= now;
                const isNotDismissed = !dismissedTaskIdsRef.current.has(task._id);
                return isPastDue && isNotDismissed;
            });

            setDueTasks(overdueTasks);
        } catch (err) {
            console.error('Failed to fetch tasks for reminders:', err);
        }
    }, []);

    useEffect(() => {
        fetchTasks();
        const intervalId = setInterval(fetchTasks, 60000);
        return () => clearInterval(intervalId);
    }, [fetchTasks]);

    const handleDismiss = (taskId: string) => {
        dismissedTaskIdsRef.current.add(taskId);
        setDueTasks(prev => prev.filter(t => t._id !== taskId));
    };

    const handleClearAll = () => {
        dueTasks.forEach(task => dismissedTaskIdsRef.current.add(task._id));
        setDueTasks([]);
    };

    if (isLoginPage || dueTasks.length === 0) return null;


    return (
        <div className="fixed bottom-4 left-4 right-4 md:bottom-6 md:right-6 md:left-auto z-[100] flex flex-col gap-2 md:gap-3 md:max-w-sm">
            {dueTasks.length > 1 && (
                <div className="flex justify-end pr-1">
                    <button
                        onClick={handleClearAll}
                        className="group flex items-center gap-2 px-3 py-1.5 bg-white/90 backdrop-blur-md border border-slate-200 rounded-full shadow-lg hover:shadow-xl hover:bg-white transition-all duration-300"
                    >
                        <X size={14} className="text-slate-500 group-hover:text-red-500 transition-colors" />
                        <span className="text-[0.7rem] font-bold text-slate-600 group-hover:text-slate-800 uppercase tracking-wider">
                            Clear All
                        </span>
                    </button>
                </div>
            )}
            {dueTasks.map(task => (
                <div
                    key={task._id}
                    onClick={() => handleCardClick(task)}
                    className={`bg-white border-l-4 border-l-amber-500 rounded-xl shadow-2xl p-3 md:p-4 animate-in slide-in-from-right-8 duration-500 overflow-hidden relative ${task.lead_id?._id ? 'cursor-pointer hover:shadow-amber-200/60 md:hover:scale-[1.01] transition-all' : ''}`}
                >
                    <div className="absolute top-0 right-0 p-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDismiss(task._id); }}
                            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div className="pr-8">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-500 shrink-0">
                                <Bell size={16} className="animate-pulse" />
                            </div>
                            <div>
                                <h4 className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest leading-none">
                                    Task Reminder
                                </h4>
                                <h3 className="text-xs md:text-sm font-extrabold text-slate-800 leading-tight mt-0.5 line-clamp-1">
                                    {task.title}
                                </h3>
                            </div>
                        </div>

                        {task.lead_id && (
                            <p className="text-xs font-semibold text-[#0ea5e9] mb-2 flex items-center gap-1 mt-1">
                                <ExternalLink size={12} /> {task.lead_id.company_name}
                            </p>
                        )}

                        <div className="flex items-center gap-2 text-[0.65rem] md:text-xs font-medium text-amber-700 bg-amber-50/50 py-1.5 px-3 rounded-lg w-fit">
                            <Calendar size={12} />
                            Due: {new Date(task.due_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                        {task.createdBy && (
                            <div className="flex items-center gap-1.5 text-[0.6rem] font-bold text-slate-400 mt-2 bg-slate-50/50 w-fit px-2 py-0.5 rounded-md">
                                <Shield size={10} /> By: {task.createdBy.name || 'Admin'}
                            </div>
                        )}

                        {pushEnabled === false && (
                            <p className="text-[0.6rem] text-slate-400 flex items-center gap-1 mt-2">
                                <BellOff size={10} /> Enable browser notifications to get alerts when app is closed.
                            </p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default TaskReminder;
