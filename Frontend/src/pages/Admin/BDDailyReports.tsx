import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../../config';
import toast from 'react-hot-toast';
import { BarChart3, Clock, Download, Eye, Loader2, Mail, RefreshCw, Save, Send, Settings } from 'lucide-react';

type ReportType = '12PM' | '7PM';

interface ReportData {
    reportType: ReportType;
    title: string;
    displayDate: string;
    periodStart: string;
    periodEnd: string;
    summary: Record<string, number>;
    executiveRows: Array<Record<string, any>>;
    leadActivity: Record<string, number>;
    stageChanges: Record<string, number>;
    calls: { total: number; byExecutive: Record<string, number>; latest: any[] };
    followups: Array<{ bdExecutive: string; completed: number; pending: number }>;
    companiesPocs: { byExecutive: Array<{ bdExecutive: string; companies: number; pocs: number }> };
    outreach: { total: number; byExecutive: Array<{ bdExecutive: string; outreach: number }> };
    meetings: { booked: number; completed: number; upcoming: number; rows: any[] };
    outcomes: { won: any[]; lost: any[]; onboarded: any[]; proposalSent: number; negotiation: number };
    recentActivity: any[];
}

interface HistoryRow {
    _id: string;
    reportType: ReportType;
    title: string;
    reportDate: string;
    generatedAt: string;
    email: { status: string };
    whatsapp: { status: string };
    status: string;
    data?: ReportData;
}

const stages = ['New', 'Contacted', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Onboarded', 'No Vendor', 'Future Reference'];

const labelMap: Record<string, string> = {
    activeBDExecutives: 'Active BD Executives',
    totalAssignedLeads: 'Total Assigned Leads',
    newLeadsAddedToday: 'New Leads Added Today',
    companiesAddedToday: 'Companies Added Today',
    pocsAddedToday: 'POCs Added Today',
    callsMadeToday: 'Calls Made Today',
    followupsCompleted: 'Follow-ups Completed',
    outreachEmails: 'Outreach / Emails',
    meetingsBookings: 'Meetings / Bookings',
    won: 'Won',
    lost: 'Lost',
    onboarded: 'Onboarded'
};

const formatTime = (value: string) => new Date(value).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit'
});

const csvToList = (value = '') => value.split(',').map((item) => item.trim()).filter(Boolean);
const listToCsv = (value?: string[]) => (value || []).join(', ');

const BDDailyReports: React.FC = () => {
    const [reportType, setReportType] = useState<ReportType>('12PM');
    const [report, setReport] = useState<ReportData | null>(null);
    const [history, setHistory] = useState<HistoryRow[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const token = localStorage.getItem('token') || '';

    const headers = useMemo(() => ({
        'Content-Type': 'application/json',
        'x-auth-token': token
    }), [token]);

    const fetchJson = async (url: string, options: RequestInit = {}) => {
        const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.message || 'Request failed');
        }
        return res.json();
    };

    const loadAll = async () => {
        try {
            setLoading(true);
            const [settingsJson, reportJson, historyJson] = await Promise.all([
                fetchJson(`${API_BASE_URL}/api/bd-daily-reports/settings`),
                fetchJson(`${API_BASE_URL}/api/bd-daily-reports/generate?reportType=${reportType}`),
                fetchJson(`${API_BASE_URL}/api/bd-daily-reports/history`)
            ]);
            setSettings(settingsJson);
            setReport(reportJson);
            setHistory(historyJson);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAll();
    }, [reportType]);

    const saveSettings = async () => {
        try {
            setBusy(true);
            const payload = {
                ...settings,
                ceoRecipients: csvToList(settings.ceoRecipientsInput),
                ccRecipients: csvToList(settings.ccRecipientsInput),
                whatsappRecipients: csvToList(settings.whatsappRecipientsInput)
            };
            const updated = await fetchJson(`${API_BASE_URL}/api/bd-daily-reports/settings`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            setSettings({
                ...updated,
                ceoRecipientsInput: listToCsv(updated.ceoRecipients),
                ccRecipientsInput: listToCsv(updated.ccRecipients),
                whatsappRecipientsInput: listToCsv(updated.whatsappRecipients)
            });
            toast.success('Report settings saved');
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    };

    useEffect(() => {
        if (!settings || settings.ceoRecipientsInput !== undefined) return;
        setSettings({
            ...settings,
            ceoRecipientsInput: listToCsv(settings.ceoRecipients),
            ccRecipientsInput: listToCsv(settings.ccRecipients),
            whatsappRecipientsInput: listToCsv(settings.whatsappRecipients)
        });
    }, [settings]);

    const generateAndStore = async () => {
        try {
            setBusy(true);
            await fetchJson(`${API_BASE_URL}/api/bd-daily-reports/generate`, {
                method: 'POST',
                body: JSON.stringify({ reportType })
            });
            toast.success('Report generated');
            await loadAll();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    };

    const sendNow = async () => {
        try {
            setBusy(true);
            await fetchJson(`${API_BASE_URL}/api/bd-daily-reports/send`, {
                method: 'POST',
                body: JSON.stringify({ reportType })
            });
            toast.success('Report send workflow completed');
            await loadAll();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    };

    const previewHistory = async (id: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/bd-daily-reports/history/${id}/html`, {
                headers: { 'x-auth-token': token }
            });
            if (!res.ok) throw new Error('Failed to preview report');
            const html = await res.text();
            const blob = new Blob([html], { type: 'text/html' });
            const url = window.URL.createObjectURL(blob);
            const preview = window.open(url, '_blank', 'noopener,noreferrer');
            if (!preview) {
                throw new Error('Popup blocked. Please allow popups for this CRM site.');
            }
            setTimeout(() => window.URL.revokeObjectURL(url), 60 * 1000);
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const resendHistory = async (id: string) => {
        try {
            setBusy(true);
            await fetchJson(`${API_BASE_URL}/api/bd-daily-reports/history/${id}/send`, { method: 'POST' });
            toast.success('Saved report sent again');
            await loadAll();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    };

    const downloadHistory = async (row: HistoryRow) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/bd-daily-reports/history/${row._id}/download-pdf`, {
                headers: { 'x-auth-token': token }
            });
            if (!res.ok) throw new Error('Failed to download report');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `bd-executive-${row.reportType.toLowerCase()}-${row.reportDate}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    if (loading || !report || !settings) {
        return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-sky-500" size={32} /></div>;
    }

    return (
        <div className="h-full overflow-y-auto bg-slate-50 pb-10 pr-1 -mr-1 custom-scrollbar">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">BD Executive Daily Report</h1>
                    <p className="text-sm text-slate-500 mt-1">Current state and today's activity are separated so management can read the day clearly.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => setReportType('12PM')} className={`px-4 py-2 rounded-lg text-sm font-bold border ${reportType === '12PM' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-700 border-slate-200'}`}>12 PM</button>
                    <button onClick={() => setReportType('7PM')} className={`px-4 py-2 rounded-lg text-sm font-bold border ${reportType === '7PM' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-700 border-slate-200'}`}>7 PM</button>
                    <button disabled={busy} onClick={generateAndStore} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-100"><RefreshCw size={16} />Generate Now</button>
                    <button disabled={busy} onClick={sendNow} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"><Send size={16} />Send Now</button>
                </div>
            </div>

            <section className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-widest text-slate-500 font-extrabold">CEO Summary</p>
                        <h2 className="text-xl font-extrabold text-slate-900 mt-1">{report.title}</h2>
                        <p className="text-sm text-slate-500">Date: {report.displayDate} | Period: {formatTime(report.periodStart)} to {formatTime(report.periodEnd)} IST</p>
                    </div>
                    <a href="/admin/dashboard" className="text-sm font-bold text-sky-700 hover:text-sky-900">Open CRM Dashboard</a>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 mt-5">
                    {Object.entries(report.summary).map(([key, value]) => (
                        <div key={key} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                            <p className="text-[11px] uppercase text-slate-500 font-bold leading-tight">{labelMap[key] || key}</p>
                            <p className="text-2xl font-extrabold text-slate-900 mt-1">{value}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-6">
                <div className="p-4 border-b border-slate-200 flex items-center gap-2"><BarChart3 size={18} className="text-sky-600" /><h3 className="font-extrabold text-slate-900">BD Executive-Wise Report</h3></div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1050px] text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                            <tr>
                                {['BD Executive', 'Assigned Leads', 'New Leads Today', 'Companies Today', 'POCs Today', 'Calls Today', 'Follow-ups Today', 'Outreach Today', 'Meetings Today', 'Won', 'Lost', 'Onboarded'].map((head) => <th key={head} className="px-4 py-3 text-left font-extrabold">{head}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {report.executiveRows.map((row) => (
                                <tr key={row.executiveId} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-bold text-slate-900">{row.name}</td>
                                    <td className="px-4 py-3">{row.assignedLeads}</td>
                                    <td className="px-4 py-3">{row.newLeadsToday}</td>
                                    <td className="px-4 py-3">{row.companiesToday}</td>
                                    <td className="px-4 py-3">{row.pocsToday}</td>
                                    <td className="px-4 py-3">{row.callsToday}</td>
                                    <td className="px-4 py-3">{row.followupsToday}</td>
                                    <td className="px-4 py-3">{row.outreachToday}</td>
                                    <td className="px-4 py-3">{row.meetingsToday}</td>
                                    <td className="px-4 py-3">{row.won}</td>
                                    <td className="px-4 py-3">{row.lost}</td>
                                    <td className="px-4 py-3">{row.onboarded}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                <section className="bg-white border border-slate-200 rounded-lg p-5">
                    <h3 className="font-extrabold text-slate-900 mb-4">Lead Activity</h3>
                    {Object.entries(report.leadActivity).map(([key, value]) => <div key={key} className="flex justify-between py-2 border-b border-slate-100 text-sm"><span className="text-slate-600">{labelMap[key] || key.replace(/([A-Z])/g, ' $1')}</span><strong>{value}</strong></div>)}
                </section>
                <section className="bg-white border border-slate-200 rounded-lg p-5">
                    <h3 className="font-extrabold text-slate-900 mb-4">Stage Changes Today</h3>
                    {stages.map((stage) => <div key={stage} className="flex justify-between py-2 border-b border-slate-100 text-sm"><span className="text-slate-600">{stage}</span><strong>{report.stageChanges[stage] || 0}</strong></div>)}
                </section>
                <section className="bg-white border border-slate-200 rounded-lg p-5">
                    <h3 className="font-extrabold text-slate-900 mb-4">Today's Outcome</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="p-3 rounded-lg bg-emerald-50"><p className="text-slate-500">Won</p><strong className="text-xl">{report.summary.won}</strong></div>
                        <div className="p-3 rounded-lg bg-rose-50"><p className="text-slate-500">Lost</p><strong className="text-xl">{report.summary.lost}</strong></div>
                        <div className="p-3 rounded-lg bg-sky-50"><p className="text-slate-500">Onboarded</p><strong className="text-xl">{report.summary.onboarded}</strong></div>
                        <div className="p-3 rounded-lg bg-amber-50"><p className="text-slate-500">Proposal / Negotiation</p><strong className="text-xl">{report.outcomes.proposalSent} / {report.outcomes.negotiation}</strong></div>
                    </div>
                    {[...report.outcomes.won, ...report.outcomes.lost, ...report.outcomes.onboarded].slice(0, 8).map((item, i) => <p key={i} className="text-xs text-slate-600 mt-3">{item.company} - {item.executive}</p>)}
                </section>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
                <section className="bg-white border border-slate-200 rounded-lg p-5">
                    <h3 className="font-extrabold text-slate-900 mb-4">Calls Today</h3>
                    <p className="text-3xl font-extrabold text-slate-900 mb-3">{report.calls.total}</p>
                    {Object.entries(report.calls.byExecutive).map(([name, count]) => <div key={name} className="flex justify-between py-2 border-b border-slate-100 text-sm"><span>{name}</span><strong>{count}</strong></div>)}
                </section>
                <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <div className="p-4 border-b border-slate-200"><h3 className="font-extrabold text-slate-900">Follow-up Activity</h3></div>
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3 text-left">BD Executive</th><th>Completed</th><th>Pending</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">{report.followups.map((row) => <tr key={row.bdExecutive}><td className="px-4 py-3 font-bold">{row.bdExecutive}</td><td className="text-center">{row.completed}</td><td className="text-center">{row.pending}</td></tr>)}</tbody>
                    </table>
                </section>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
                <section className="bg-white border border-slate-200 rounded-lg p-5">
                    <h3 className="font-extrabold text-slate-900 mb-4">Company / POC Activity</h3>
                    {report.companiesPocs.byExecutive.map((row) => <div key={row.bdExecutive} className="flex justify-between py-2 border-b border-slate-100 text-sm"><span>{row.bdExecutive}</span><strong>{row.companies} companies / {row.pocs} POCs</strong></div>)}
                </section>
                <section className="bg-white border border-slate-200 rounded-lg p-5">
                    <h3 className="font-extrabold text-slate-900 mb-4">Outreach / Email Activity</h3>
                    <p className="text-3xl font-extrabold text-slate-900 mb-3">{report.outreach.total}</p>
                    {report.outreach.byExecutive.map((row) => <div key={row.bdExecutive} className="flex justify-between py-2 border-b border-slate-100 text-sm"><span>{row.bdExecutive}</span><strong>{row.outreach}</strong></div>)}
                </section>
            </div>

            <section className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-6">
                <div className="p-4 border-b border-slate-200"><h3 className="font-extrabold text-slate-900">Meetings / Bookings</h3><p className="text-sm text-slate-500">Booked: {report.meetings.booked} | Completed: {report.meetings.completed} | Upcoming: {report.meetings.upcoming}</p></div>
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3 text-left">Company</th><th>BD Executive</th><th>Meeting Time</th><th>Stage</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">{report.meetings.rows.map((row, i) => <tr key={i}><td className="px-4 py-3 font-bold">{row.company}</td><td className="text-center">{row.bdExecutive}</td><td className="text-center">{formatTime(row.meetingTime)}</td><td className="text-center">{row.stage}</td></tr>)}</tbody>
                </table>
            </section>

            <section className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
                <h3 className="font-extrabold text-slate-900 mb-4">Recent BD Activity</h3>
                <div className="space-y-3">
                    {report.recentActivity.map((item, i) => (
                        <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 border-b border-slate-100 pb-3 text-sm">
                            <span className="font-bold text-slate-900 w-20">{formatTime(item.time)}</span>
                            <span className="font-bold text-sky-700 w-36">{item.bdExecutive}</span>
                            <span className="text-slate-700 flex-1">{item.action} - {item.company}</span>
                            <span className="text-slate-500">{item.stage}</span>
                        </div>
                    ))}
                </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
                <div className="flex items-center gap-2 mb-4"><Settings size={18} className="text-slate-600" /><h3 className="font-extrabold text-slate-900">BD Executive Daily Report Settings</h3></div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={settings.enable12PmReport} onChange={(e) => setSettings({ ...settings, enable12PmReport: e.target.checked })} />Enable 12 PM Report</label>
                    <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={settings.enable7PmReport} onChange={(e) => setSettings({ ...settings, enable7PmReport: e.target.checked })} />Enable 7 PM Report</label>
                    <label className="text-sm font-bold">CEO email recipients<input value={settings.ceoRecipientsInput || ''} onChange={(e) => setSettings({ ...settings, ceoRecipientsInput: e.target.value })} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 font-normal" placeholder="ceo@example.com, owner@example.com" /></label>
                    <label className="text-sm font-bold">CC recipients<input value={settings.ccRecipientsInput || ''} onChange={(e) => setSettings({ ...settings, ccRecipientsInput: e.target.value })} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 font-normal" /></label>
                    <label className="text-sm font-bold">Timezone<input value={settings.timezone || 'Asia/Kolkata'} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 font-normal" /></label>
                    <label className="text-sm font-bold">WhatsApp recipients<input value={settings.whatsappRecipientsInput || ''} onChange={(e) => setSettings({ ...settings, whatsappRecipientsInput: e.target.value })} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 font-normal" placeholder="Provider not configured yet" /></label>
                </div>
                <div className="flex gap-2 mt-4">
                    <button disabled={busy} onClick={saveSettings} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold"><Save size={16} />Save Settings</button>
                    <button disabled={busy} onClick={sendNow} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-bold"><Mail size={16} />Send Test Report</button>
                </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center gap-2"><Clock size={18} className="text-slate-600" /><h3 className="font-extrabold text-slate-900">BD Executive Report History</h3></div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[780px] text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3 text-left">Date</th><th>Report</th><th>Generated</th><th>Email</th><th>WhatsApp</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {history.map((row) => (
                                <tr key={row._id}>
                                    <td className="px-4 py-3 font-bold">{row.reportDate}</td>
                                    <td className="text-center">{row.reportType}</td>
                                    <td className="text-center">{formatTime(row.generatedAt)}</td>
                                    <td className="text-center">{row.email?.status || 'Not Sent'}</td>
                                    <td className="text-center">{row.whatsapp?.status || 'Not Sent'}</td>
                                    <td className="text-center">{row.status}</td>
                                    <td className="text-center">
                                        <button onClick={() => previewHistory(row._id)} className="p-2 text-sky-700 hover:bg-sky-50 rounded-lg" title="Preview report"><Eye size={16} /></button>
                                        <button onClick={() => downloadHistory(row)} className="p-2 text-slate-700 hover:bg-slate-100 rounded-lg" title="Download PDF"><Download size={16} /></button>
                                        <button disabled={busy} onClick={() => resendHistory(row._id)} className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg" title="Send again"><Send size={16} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

export default BDDailyReports;
