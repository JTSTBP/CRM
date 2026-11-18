import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  Linkedin,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
  Legend,
} from "recharts";
import {
  workspaceApi,
  fieldClass,
  primaryClass,
  secondaryClass,
  displayTime,
} from "./workspaceApi";
import ContactPicker from "./ContactPicker";
import ActivityDialog from "./ActivityDialog";
import MonitoringSettings, {
  type MonitoringConfig,
} from "./MonitoringSettings";
import SendEmailModal from "../modals/SendEmailModal";
import ScheduledTasks, { type ScheduledTask } from "./ScheduledTasks";

interface Employee {
  _id: string;
  name: string;
  calls: number;
  connected: number;
  incomplete: number;
  workedContacts: number;
  submitted: boolean;
  reportStatus: string;
  submittedAt?: string;
  proposals: number;
  onboardings: number;
  proposalTarget: number;
  onboardingTarget: number;
  pending: number;
  overdue: number;
  whatsapp: number;
  email: number;
  linkedinSent: number;
  linkedinAccepted: number;
}
interface QueueRow {
  _id: string;
  leadId: { _id: string; company_name: string; stage: string };
  pocId: string;
  contact: { name?: string; phone?: string; email?: string; designation?: string; linkedin_url?: string };
  ownerId: { _id: string; name: string };
  callOutcome?: string;
  lastCallAt?: string;
  lastActivityAt?: string;
  whatsapp: string;
  email: string;
  linkedin: string;
  daysUnreached: number | null;
  nextAction?: string;
  dueAt?: string;
  priority: string;
  reasons: string[];
  missing: string[];
}
interface Stalled {
  _id: string;
  company_name: string;
  since: string;
  updatedAt: string;
  lastActivityAt?: string;
  review?: {
    data: { reason: string; nextAction: string; dueAt: string };
    createdAt: string;
  };
}
export interface Dashboard {
  today: string;
  generatedAt: string;
  config: MonitoringConfig;
  team: Employee[];
  totals: Omit<Employee, "_id" | "name" | "submitted" | "reportStatus">;
  queue: QueueRow[];
  queueCount: number;
  page: number;
  pages: number;
  alertCounts: Record<string, number>;
  completionRate: number | null;
  followupCompliance: number | null;
  proposalConversion: number | null;
  onboardingConversion: number | null;
  stalled: Stalled[];
  stalledCount: number;
  stalledPage: number;
  stalledPages: number;
  qualifiedAwaitingProposal: number;
  expectedOnboardings: number;
  lifecycle: { _id: string; count: number }[];
  trend: {
    day: string;
    calls: number;
    proposals: number;
    onboardings: number;
  }[];
  businessOutcomes: { _id: { kind: string; status: string }; count: number }[];
  outcomes: { _id: { outcome: string }; count: number }[];
  scheduledTasks: ScheduledTask[];
  portfolioCompanies: number;
  workingDayNumber: number;
  workingDayTotal: number;
  accountability: { score: number | null; provisional: boolean; parts: { label: string; weight: number; value: number | null }[] };
  linkedinPipeline: { _id: string; count: number }[];
  linkedinAcceptedContacts: { _id: string; leadId: { _id: string; company_name: string }; pocId: string; contact: { name?: string; designation?: string }; linkedinUrl?: string }[];
  completedTasksToday: number;
  priorityActions: QueueRow[];
  priorityCounts: { all: number; urgent: number; today: number; upcoming: number };
  callbackStats: { busy: number; noAnswer: number; overdue: number };
  dailyChecklist: { label: string; complete: number; total: number }[];
}
interface Notice {
  _id: string;
  title: string;
  severity: string;
  leadId?: string;
  pocId?: string;
  createdAt: string;
  readAt?: string;
}
const percent = (value: number | null) => (value === null ? "—" : `${value}%`);
const panel = "rounded-2xl border border-slate-200 bg-white p-4 sm:p-5";

function Progress({
  title,
  actual,
  target,
  period,
}: {
  title: string;
  actual: number;
  target: number;
  period: string;
}) {
  if (!target)
    return (
      <div className={panel}>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <p className="mt-3 text-2xl font-bold">{actual} recorded</p>
        <p className="mt-3 text-xs text-slate-500">
          No target scheduled for this non-working day.
        </p>
      </div>
    );
  const achievement = target ? Math.round((actual / target) * 100) : 0;
  return (
    <div className={panel}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <Target size={16} className="text-sky-600" />
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight">
        {actual}
        <span className="text-base font-medium text-slate-400">
          {" "}
          / {target}
        </span>
      </p>
      <div
        role="progressbar"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, achievement)}
        className="my-3 h-2 overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className="h-full rounded-full bg-sky-500 transition-all"
          style={{ width: `${Math.min(100, achievement)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-500">
        <span>
          {achievement}% achieved · {period}
        </span>
        <span>{Math.max(0, target - actual)} remaining</span>
      </div>
    </div>
  );
}

export default function SmartBDDashboard() {
  const role = JSON.parse(localStorage.getItem("user") || "{}").role;
  const prefix =
    role === "Admin" ? "/admin" : role === "Manager" ? "/manager" : "/bd";
  const navigate = useNavigate();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [urgency, setUrgency] = useState("");
  const [employee, setEmployee] = useState("");
  const [sort, setSort] = useState("priority");
  const [page, setPage] = useState(1);
  const [stalledPage, setStalledPage] = useState(1);
  const [stalledSearch, setStalledSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [picker, setPicker] = useState(false);
  const [selected, setSelected] = useState<{
    lead: string;
    contact: string;
  } | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [showNotices, setShowNotices] = useState(false);
  const [action, setAction] = useState<{
    kind: "lifecycle" | "reassign" | "resolve";
    id: string;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [trendPeriod, setTrendPeriod] = useState("month");
  const [teamSearch, setTeamSearch] = useState("");
  const refresh = () => setRefreshKey((value) => value + 1);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          page: String(page),
          search,
          urgency,
          employee,
          sort,
          stalledPage: String(stalledPage),
          stalledSearch,
        });
        const result = await workspaceApi<Dashboard>(
          `/dashboard?${params}`,
          "GET",
          undefined,
          controller.signal,
        );
        if (!controller.signal.aborted) setData(result);
      } catch (error) {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Could not load dashboard.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    page,
    search,
    urgency,
    employee,
    sort,
    refreshKey,
    stalledPage,
    stalledSearch,
  ]);
  useEffect(() => {
    const controller = new AbortController();
    workspaceApi<{ items: Notice[] }>(
      "/notifications",
      "GET",
      undefined,
      controller.signal,
    )
      .then((result) => setNotices(result.items))
      .catch(() => {});
    return () => controller.abort();
  }, [refreshKey]);
  useEffect(() => {
    if (action)
      document
        .getElementById("monitoring-action")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [action]);
  useEffect(() => {
    const timer = setInterval(() => {
      const editing = ["INPUT", "TEXTAREA", "SELECT"].includes(
        document.activeElement?.tagName || "",
      );
      if (
        document.visibilityState === "visible" &&
        !selected &&
        !action &&
        !editing
      )
        setRefreshKey((value) => value + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, [selected, action]);
  async function perform(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true);
    setMessage("");
    try {
      const result = await workspaceApi<{ message: string }>(
        action.kind === "lifecycle"
          ? `/lifecycle/${action.id}`
          : `/state/${action.id}`,
        action.kind === "lifecycle" ? "POST" : "PATCH",
        {
          ...fields,
          requestId: crypto.randomUUID(),
          ...(fields.dueAt
            ? { dueAt: new Date(String(fields.dueAt)).toISOString() }
            : {}),
        },
      );
      setMessage(result.message);
      setAction(null);
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const fields = Object.fromEntries(new FormData(event.currentTarget));
      const result = await workspaceApi<{ message: string }>(
        "/submit",
        "POST",
        { ...fields, requestId: crypto.randomUUID() },
      );
      setMessage(result.message);
      refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not submit report.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function remind(row: QueueRow) {
    setSaving(true);
    try {
      const result = await workspaceApi<{ message: string }>(
        `/state/${row._id}/remind`,
        "POST",
        {},
      );
      setMessage(result.message);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not send reminder.",
      );
    } finally {
      setSaving(false);
    }
  }
  const title =
    role === "Admin"
      ? "Business development overview"
      : role === "Manager"
        ? "Team performance"
        : "Your business development workspace";
  const alerts: Record<string, number> = data
    ? { ...data.alertCounts, "Lifecycle stalled": data.stalledCount }
    : {};
  const trend = data?.trend.slice(trendPeriod === "week" ? -7 : -30) || [];
  const feedback = (status: string) =>
    data?.businessOutcomes
      .filter(
        (item) => item._id.kind === "proposal" && item._id.status === status,
      )
      .reduce((sum, item) => sum + item.count, 0) || 0;
  const kpis = data
    ? ([
        ["Calls today", data.totals.calls, Phone],
        ["Connected", data.totals.connected, CheckCircle2],
        ["WhatsApp sent", data.totals.whatsapp, MessageCircle],
        ["Personalized emails", data.totals.email, Mail],
        ["LinkedIn requests", data.totals.linkedinSent, Linkedin],
        ["LinkedIn accepted", data.totals.linkedinAccepted, Users],
        [
          "Proposals today",
          data.totals.proposalTarget
            ? `${data.totals.proposals} / ${data.totals.proposalTarget}`
            : `${data.totals.proposals} sent`,
          FileText,
        ],
        [
          "Onboarded this month",
          `${data.totals.onboardings} / ${data.totals.onboardingTarget}`,
          Building2,
        ],
      ] as const)
    : [];
  return (
    <div className="h-full space-y-5 overflow-y-auto bg-slate-50 pb-10 pr-1">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-sky-700">
            Jobs Territory ·{" "}
            {role === "Admin"
              ? "Executive view"
              : role === "Manager"
                ? "Manager view"
                : "BD workspace"}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {data
              ? `${data.today} · Asia/Kolkata · Updated ${displayTime(data.generatedAt)}`
              : "Loading saved activity and business results"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className={secondaryClass}
          >
            <RefreshCw
              size={14}
              className={loading ? "inline animate-spin" : "inline"}
            />{" "}
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowNotices(!showNotices)}
            className={secondaryClass}
          >
            <Bell size={14} className="inline" /> Notifications{" "}
            {notices.filter((notice) => !notice.readAt).length || ""}
          </button>
          <button
            type="button"
            onClick={() => setPicker(!picker)}
            className={primaryClass}
          >
            <Plus size={15} className="inline" /> Record activity
          </button>
        </div>
      </header>
      <nav
        className="flex flex-wrap gap-4 text-xs font-semibold text-slate-600"
        aria-label="CRM shortcuts"
      >
        <Link to={`${prefix}/leads`}>
          Companies &amp; pipeline <ArrowUpRight size={12} className="inline" />
        </Link>
        <Link to={`${prefix}/contacts`}>Contacts</Link>
        <Link to={`${prefix}/reports`}>Detailed reports</Link>
        <button type="button" onClick={() => setEmailOpen(true)}>
          Send email
        </button>
      </nav>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          {error}{" "}
          <button type="button" onClick={refresh} className="underline">
            Retry
          </button>
        </div>
      )}
      {message && (
        <p
          role="status"
          className="rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm text-sky-900"
        >
          {message}
        </p>
      )}
      {picker && (
        <ContactPicker
          onSelect={(lead, contact) => setSelected({ lead, contact })}
        />
      )}
      {showNotices && (
        <section className={panel}>
          <h2 className="mb-3 text-sm font-bold">Notification history</h2>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {notices.map((notice) => (
              <div
                key={notice._id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-xs ${notice.readAt ? "text-slate-500" : "border-sky-200 bg-sky-50"}`}
              >
                <div>
                  <p className="font-semibold">{notice.title}</p>
                  <p>
                    {notice.severity} · {displayTime(notice.createdAt)}
                  </p>
                </div>
                <div className="flex gap-3">
                  {notice.leadId && (
                    <button
                      type="button"
                      className="font-semibold text-sky-700"
                      onClick={() =>
                        notice.pocId
                          ? setSelected({
                              lead: notice.leadId!,
                              contact: notice.pocId,
                            })
                          : navigate(
                              `${prefix}/leads?openLead=${notice.leadId}`,
                            )
                      }
                    >
                      Open record
                    </button>
                  )}
                  {!notice.readAt && (
                    <button
                      type="button"
                      onClick={() =>
                        void workspaceApi(
                          `/notifications/${notice._id}`,
                          "PATCH",
                          {},
                        )
                          .then(refresh)
                          .catch((error) => setMessage(error.message))
                      }
                      className="underline"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!notices.length && (
              <p className="text-sm text-slate-500">
                No notifications recorded.
              </p>
            )}
          </div>
        </section>
      )}
      {!data && loading && (
        <div role="status" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-xl bg-slate-200"
            />
          ))}
        </div>
      )}
      {data && (
        <>
          <section
            aria-label="Daily outreach and outcomes"
            className="grid grid-cols-2 gap-3 lg:grid-cols-4"
          >
            {kpis.map(([label, value, Icon]) => (
              <article
                key={label}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-500">{label}</p>
                  <Icon size={16} className="shrink-0 text-sky-600" />
                </div>
                <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                  {value}
                </p>
              </article>
            ))}
          </section>
          <div className="grid gap-4 lg:grid-cols-3">
            <Progress
              title="Daily proposal progress"
              actual={data.totals.proposals}
              target={data.totals.proposalTarget}
              period="today"
            />
            <Progress
              title="Monthly onboarding progress"
              actual={data.totals.onboardings}
              target={data.totals.onboardingTarget}
              period="this month"
            />
            <section className={panel}>
              <h2 className="text-sm font-bold">
                Recording &amp; follow-up compliance
              </h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt>Communication complete today</dt>
                  <dd className="font-bold">{percent(data.completionRate)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Follow-ups completed on time</dt>
                  <dd className="font-bold">
                    {percent(data.followupCompliance)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>Records needing updates</dt>
                  <dd className="font-bold text-amber-700">
                    {data.totals.incomplete}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-slate-500">
                Follow-up compliance covers tasks due in the last 30 days. An em
                dash means no eligible records.
              </p>
            </section>
          </div>
          <section className={panel}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <Clock3 size={16} className="text-amber-600" />
                Pending client actions
              </h2>
              <button
                type="button"
                onClick={() => {
                  setUrgency("");
                  setPage(1);
                }}
                className="text-xs font-semibold text-sky-700"
              >
                Show all
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {Object.entries(alerts).map(([reason, count]) => (
                <button
                  type="button"
                  key={reason}
                  onClick={() => {
                    setUrgency(reason === "Lifecycle stalled" ? "" : reason);
                    setPage(1);
                    document
                      .getElementById(
                        reason === "Lifecycle stalled"
                          ? "stalled-opportunities"
                          : "priority-queue",
                      )
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-left text-xs hover:border-sky-300"
                >
                  <span>{reason}</span>
                  <span className="rounded bg-white px-2 py-1 font-bold">
                    {count}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
              {data.outcomes.map((item) => (
                <span key={`${item._id.outcome}:${JSON.stringify(item._id)}`}>
                  {item._id.outcome} {item.count}
                </span>
              ))}
            </div>
          </section>
          {role === "BD Executive" ? (
            <section className={panel}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold">
                    Daily activity submission
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Cutoff {data.config.cutoff} IST ·{" "}
                    {data.team[0]?.reportStatus || "Due today"} ·{" "}
                    {data.totals.incomplete} incomplete records
                  </p>
                </div>
              </div>
              <form
                onSubmit={submit}
                className="mt-3 flex flex-col gap-2 sm:flex-row"
              >
                <input
                  aria-label="Late submission reason"
                  name="reason"
                  placeholder="Reason if submitting after cutoff"
                  maxLength={2000}
                  className={fieldClass}
                />
                <button
                  disabled={saving || data.totals.incomplete > 0}
                  className={`${primaryClass} shrink-0`}
                >
                  Submit daily report
                </button>
              </form>
            </section>
          ) : (
            <section className={panel}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold">
                    Executive performance &amp; daily submissions
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {data.team.length} active executives ·{" "}
                    {data.team.filter((item) => item.submitted).length}{" "}
                    submitted ·{" "}
                    {data.team.filter((item) => !item.submitted).length}{" "}
                    awaiting submission
                  </p>
                </div>
                <input
                  aria-label="Find employee"
                  value={teamSearch}
                  onChange={(event) => setTeamSearch(event.target.value)}
                  className="rounded-lg border px-3 py-2 text-xs"
                  placeholder="Find employee"
                />
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full whitespace-nowrap text-left text-xs">
                  <thead className="border-y bg-slate-50 text-slate-500">
                    <tr>
                      {[
                        "Executive",
                        "Calls / connected",
                        "Recording",
                        "Daily report",
                        "Overdue / pending",
                        "Proposals today",
                        "Onboardings month",
                        "Open",
                      ].map((label) => (
                        <th key={label} className="px-3 py-3 font-semibold">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.team
                      .filter((item) =>
                        item.name
                          .toLowerCase()
                          .includes(teamSearch.toLowerCase()),
                      )
                      .map((member) => (
                        <tr
                          key={member._id}
                          className="border-b border-slate-100"
                        >
                          <td className="px-3 py-3 font-semibold">
                            {member.name}
                          </td>
                          <td className="px-3">
                            {member.calls} / {member.connected}
                          </td>
                          <td className="px-3">
                            {member.incomplete} pending /{" "}
                            {member.workedContacts} worked
                          </td>
                          <td className="px-3">
                            <span
                              className={
                                member.submitted
                                  ? "text-emerald-700"
                                  : "text-amber-700"
                              }
                            >
                              {member.reportStatus}
                            </span>
                          </td>
                          <td className="px-3">
                            {member.overdue} / {member.pending}
                          </td>
                          <td className="px-3">
                            {member.proposals} / {member.proposalTarget}
                          </td>
                          <td className="px-3">
                            {member.onboardings} / {member.onboardingTarget}
                          </td>
                          <td className="px-3">
                            <button
                              type="button"
                              onClick={() => {
                                setEmployee(member._id);
                                setPage(1);
                                document
                                  .getElementById("priority-queue")
                                  ?.scrollIntoView({ behavior: "smooth" });
                              }}
                              className="font-semibold text-sky-700"
                            >
                              View actions
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!data.team.length && (
                  <p className="py-4 text-sm text-slate-500">
                    No active BD executives in this scope.
                  </p>
                )}
              </div>
            </section>
          )}
          <ScheduledTasks
            tasks={data.scheduledTasks || []}
            prefix={prefix}
            onSaved={refresh}
          />
          <section id="priority-queue" className={panel}>
            <h2 className="text-base font-bold">Priority work queue</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="relative">
                <span className="sr-only">Search queue</span>
                <Search
                  size={14}
                  className="absolute left-3 top-3 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Company, contact, executive"
                  className={`${fieldClass} pl-9`}
                />
              </label>
              <select
                aria-label="Action filter"
                value={urgency}
                onChange={(event) => {
                  setUrgency(event.target.value);
                  setPage(1);
                }}
                className={fieldClass}
              >
                <option value="">All actions</option>
                {[
                  "Urgent",
                  "Review",
                  "Scheduled",
                  ...Object.keys(data.alertCounts),
                ].map((reason) => (
                  <option key={reason}>{reason}</option>
                ))}
              </select>
              <select
                aria-label="Executive filter"
                value={employee}
                onChange={(event) => {
                  setEmployee(event.target.value);
                  setPage(1);
                }}
                className={fieldClass}
              >
                <option value="">All permitted executives</option>
                {data.team.map((member) => (
                  <option value={member._id} key={member._id}>
                    {member.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Queue sorting"
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
                className={fieldClass}
              >
                <option value="priority">Urgency, then due date</option>
                <option value="recent">Latest activity first</option>
              </select>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[1150px] text-left text-xs">
                <thead className="border-y bg-slate-50 text-slate-500">
                  <tr>
                    {[
                      "Company / contact",
                      "Call outcome",
                      "WhatsApp",
                      "Email",
                      "LinkedIn",
                      "Lifecycle",
                      "Days unreached",
                      "Next action / due",
                      "Priority",
                      "Quick actions",
                    ].map((label) => (
                      <th key={label} className="px-3 py-3 font-semibold">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.queue.map((row) => (
                    <tr
                      key={row._id}
                      className="border-b border-slate-100 align-top"
                    >
                      <td className="px-3 py-3">
                        <Link
                          to={`${prefix}/contacts/${row.pocId}`}
                          className="font-semibold text-sky-700"
                        >
                          {row.contact.name || "Contact"}
                        </Link>
                        <p className="mt-1">{row.leadId.company_name}</p>
                        <p className="mt-1 text-slate-500">
                          {row.ownerId.name}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        {row.callOutcome || "Pending"}
                      </td>
                      <td className="px-3 py-3">{row.whatsapp}</td>
                      <td className="px-3 py-3">{row.email}</td>
                      <td className="px-3 py-3">{row.linkedin}</td>
                      <td className="px-3 py-3">{row.leadId.stage}</td>
                      <td className="px-3 py-3">
                        {row.daysUnreached === null
                          ? "—"
                          : `${row.daysUnreached} / 5`}
                      </td>
                      <td className="max-w-52 px-3 py-3">
                        <p>{row.nextAction || "Update needed"}</p>
                        <p className="mt-1 text-slate-500">
                          {displayTime(row.dueAt)}
                        </p>
                      </td>
                      <td className="max-w-44 px-3 py-3">
                        <span
                          className={
                            row.priority === "Urgent"
                              ? "font-bold text-rose-700"
                              : "font-semibold text-amber-700"
                          }
                        >
                          {row.priority}
                        </span>
                        <p className="mt-1 text-slate-500">
                          {row.reasons.join(" · ")}
                        </p>
                        {row.missing.length > 0 && (
                          <p className="mt-1 text-amber-700">
                            Missing {row.missing.join(", ")}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col items-start gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setSelected({
                                lead: row.leadId._id,
                                contact: row.pocId,
                              })
                            }
                            className="font-semibold text-sky-700"
                          >
                            Update
                          </button>
                          {role !== "BD Executive" && (
                            <>
                              <button
                                disabled={saving}
                                type="button"
                                onClick={() => void remind(row)}
                              >
                                Remind
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setAction({ kind: "reassign", id: row._id })
                                }
                              >
                                Reassign
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setAction({ kind: "resolve", id: row._id })
                                }
                              >
                                Resolve
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.queue.length && (
                <div className="py-10 text-center">
                  <Activity size={24} className="mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-600">
                    No matching monitored contacts
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Use Record activity to start tracking an existing contact.
                  </p>
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
              <span>
                {data.queueCount} contacts · Page {page} of{" "}
                {Math.max(1, data.pages)}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage(page - 1)}
                  className={secondaryClass}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= data.pages || loading}
                  onClick={() => setPage(page + 1)}
                  className={secondaryClass}
                >
                  Next
                </button>
              </div>
            </div>
          </section>
          {action && (
            <section
              id="monitoring-action"
              className={`${panel} border-sky-200`}
            >
              <h2 className="text-sm font-bold">
                {action.kind === "lifecycle"
                  ? "Review stalled opportunity"
                  : action.kind === "reassign"
                    ? "Reassign follow-up"
                    : "Resolve escalation"}
              </h2>
              <form
                onSubmit={perform}
                className="mt-3 grid gap-3 sm:grid-cols-2"
              >
                {action.kind === "reassign" && (
                  <label className="space-y-1 text-xs font-semibold">
                    New responsible executive
                    <select name="ownerId" required className={fieldClass}>
                      <option value="">Select executive</option>
                      {data.team.map((member) => (
                        <option key={member._id} value={member._id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="space-y-1 text-xs font-semibold">
                  Reason / strategy
                  <textarea
                    name="reason"
                    required
                    maxLength={2000}
                    className={fieldClass}
                    placeholder={
                      action.kind === "lifecycle"
                        ? "Waiting for client response, meeting pending, proposal preparation, or another reason"
                        : "Explain the decision"
                    }
                  />
                </label>
                {action.kind === "lifecycle" && (
                  <>
                    <label className="space-y-1 text-xs font-semibold">
                      Next action
                      <input
                        name="nextAction"
                        required
                        className={fieldClass}
                      />
                    </label>
                    <label className="space-y-1 text-xs font-semibold">
                      Next follow-up (your local time)
                      <input
                        name="dueAt"
                        required
                        type="datetime-local"
                        className={fieldClass}
                      />
                    </label>
                  </>
                )}
                <div className="flex gap-2 sm:col-span-2">
                  <button disabled={saving} className={primaryClass}>
                    Save update
                  </button>
                  <button
                    type="button"
                    onClick={() => setAction(null)}
                    className={secondaryClass}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          )}
          <section id="stalled-opportunities" className={panel}>
            <div className="mb-3 flex justify-between">
              <h2 className="text-sm font-bold">
                Lifecycle stalled · {data.stalledCount}
              </h2>
              <span className="text-xs text-slate-500">
                Contacted over 48 hours
              </span>
            </div>
            <input
              aria-label="Search stalled companies"
              value={stalledSearch}
              onChange={(event) => {
                setStalledSearch(event.target.value);
                setStalledPage(1);
              }}
              placeholder="Filter stalled companies"
              className={`${fieldClass} mb-3`}
            />
            <div className="grid gap-3 lg:grid-cols-2">
              {data.stalled.map((lead) => (
                <article
                  key={lead._id}
                  className="rounded-xl border border-amber-100 bg-amber-50/40 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`${prefix}/leads?openLead=${lead._id}`}
                      className="text-sm font-semibold text-sky-700"
                    >
                      {lead.company_name}
                    </Link>
                    <button
                      type="button"
                      onClick={() =>
                        setAction({ kind: "lifecycle", id: lead._id })
                      }
                      className="text-xs font-semibold text-sky-700"
                    >
                      Record review
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Contacted {displayTime(lead.since)} · Last activity{" "}
                    {displayTime(lead.lastActivityAt)}
                  </p>
                  {lead.review && (
                    <p className="mt-2 text-xs">
                      {lead.review.data.reason} · {lead.review.data.nextAction}{" "}
                      · Due {displayTime(lead.review.data.dueAt)}
                    </p>
                  )}
                </article>
              ))}
              {!data.stalled.length && (
                <p className="text-sm text-slate-500">
                  No stalled opportunities with a recorded stage transition.
                </p>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span>
                Page {stalledPage} of {Math.max(1, data.stalledPages)}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={secondaryClass}
                  disabled={stalledPage <= 1 || loading}
                  onClick={() => setStalledPage(stalledPage - 1)}
                >
                  Previous stalled
                </button>
                <button
                  type="button"
                  className={secondaryClass}
                  disabled={stalledPage >= data.stalledPages || loading}
                  onClick={() => setStalledPage(stalledPage + 1)}
                >
                  Next stalled
                </button>
              </div>
            </div>
          </section>
          <div className="grid gap-4 xl:grid-cols-2">
            <section className={panel}>
              <div className="flex justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-bold">
                  <TrendingUp size={16} />
                  Outreach trend
                </h2>
                <select
                  aria-label="Trend period"
                  value={trendPeriod}
                  onChange={(event) => setTrendPeriod(event.target.value)}
                  className="text-xs"
                >
                  <option value="week">Last 7 days</option>
                  <option value="month">Last 30 days</option>
                </select>
              </div>
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => String(value).slice(5)}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="calls"
                      stroke="#0284c7"
                      fill="#e0f2fe"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className={panel}>
              <h2 className="text-sm font-bold">Confirmed business outcomes</h2>
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => String(value).slice(5)}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="proposals"
                      fill="#0284c7"
                      radius={[3, 3, 0, 0]}
                    />
                    <Bar
                      dataKey="onboardings"
                      fill="#10b981"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className={panel}>
              <h2 className="mb-3 text-sm font-bold">
                Pipeline &amp; conversion
              </h2>
              <div className="flex flex-wrap gap-2">
                {data.lifecycle.map((stage) => (
                  <Link
                    key={stage._id}
                    to={`${prefix}/leads?stage=${encodeURIComponent(stage._id)}`}
                    className="rounded-lg border bg-slate-50 px-3 py-2 text-xs"
                  >
                    {stage._id} <strong>{stage.count}</strong>
                  </Link>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-5 text-sm">
                <span>
                  Lead to proposal{" "}
                  <strong>{percent(data.proposalConversion)}</strong>
                </span>
                <span>
                  Proposal to onboarding{" "}
                  <strong>{percent(data.onboardingConversion)}</strong>
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Conversions use unique companies with confirmed business events
                across recorded history.
              </p>
            </section>
            <section className={panel}>
              <h2 className="mb-3 text-sm font-bold">Proposal feedback</h2>
              <div className="grid grid-cols-3 gap-2">
                {["Awaiting feedback", "Accepted", "Rejected"].map((status) => (
                  <div key={status} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{status}</p>
                    <p className="mt-2 text-xl font-bold">{feedback(status)}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {data.qualifiedAwaitingProposal} qualified opportunities
                awaiting proposals · {data.expectedOnboardings} expected
                upcoming onboardings.
              </p>
            </section>
          </div>
          {role === "Admin" && (
            <MonitoringSettings
              config={data.config}
              employees={data.team}
              onSaved={refresh}
            />
          )}
        </>
      )}
      {selected && (
        <ActivityDialog
          leadId={selected.lead}
          pocId={selected.contact}
          onClose={() => setSelected(null)}
          onSaved={refresh}
        />
      )}
      <SendEmailModal
        open={emailOpen}
        company={null}
        poc={null}
        onClose={() => setEmailOpen(false)}
      />
    </div>
  );
}
