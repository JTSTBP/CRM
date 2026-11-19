import { useEffect, useState, type CSSProperties } from "react";
import { useLocation, useSearchParams, Link } from "react-router-dom";
import {
  Bell,
  Calendar,
  CalendarClock,
  ChevronDown,
  FileText,
  Hand,
  Linkedin,
  ListTodo,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  PhoneCall,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  UserCheck,
} from "lucide-react";
import type { Dashboard } from "./SmartBDDashboard";
import TerritoryQueue, {
  type QueueFilters,
  type TerritoryRow,
} from "./TerritoryQueue";
import TerritoryInsights from "./TerritoryInsights";
import TerritoryDialog, {
  TerritoryModal,
  type TerritoryAction,
} from "./TerritoryDialog";
import ActivityDialog from "./ActivityDialog";
import ContactPicker from "./ContactPicker";
import ActivityDateFilter from './ActivityDateFilter';
import TaskModal from "../modals/TaskModal";
import SendEmailModal from "../modals/SendEmailModal";
import { displayTime, workspaceApi } from "./workspaceApi";

interface Notice {
  _id: string;
  title: string;
  createdAt: string;
  readAt?: string;
  leadId?: string;
  pocId?: string;
}
const rate = (value: number, total: number) =>
  total ? Math.round((value / total) * 100) : 0;

export default function BDTerritoryDashboard() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const location = useLocation();
  const [params] = useSearchParams();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [filters, setFilters] = useState<QueueFilters>({
    search: params.get("search") || "",
    urgency: "",
    page: 1,
  });
  const [pendingTab, setPendingTab] = useState("all");
  const [period, setPeriod] = useState("month");
  const [picker, setPicker] = useState(false);
  const [selected, setSelected] = useState<{
    lead: string;
    contact: string;
    call?: boolean;
  } | null>(null);
  const [action, setAction] = useState<TerritoryAction | null>(null);
  const [customTask, setCustomTask] = useState(false);
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [email, setEmail] = useState<TerritoryRow | null>(null);
  const [savingTask, setSavingTask] = useState("");
  const reload = () => setRefresh((value) => value + 1);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({
          ...filters,
          page: String(filters.page),
          priority: pendingTab,
        });
        const result = await workspaceApi<Dashboard>(
          `/dashboard?${query}`,
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
              : "Could not load workspace.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters.search, filters.urgency, filters.page, pendingTab, refresh]);
  useEffect(() => {
    if (params.has("search"))
      setFilters((values) => ({
        ...values,
        search: params.get("search") || "",
        page: 1,
      }));
    if (params.get("action") === "activity") setPicker(true);
    if (params.get("notifications")) void loadNotifications();
  }, [params]);
  useEffect(() => {
    const open = () => setPicker(true);
    window.addEventListener("bd:quick-add", open);
    return () => window.removeEventListener("bd:quick-add", open);
  }, []);
  const hasData = Boolean(data);
  useEffect(() => {
    if (hasData && location.hash)
      document
        .getElementById(location.hash.slice(1))
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash, location.search, hasData]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        !selected &&
        !action &&
        !picker &&
        !customTask &&
        !email
      )
        reload();
    }, 60000);
    return () => clearInterval(timer);
  }, [selected, action, picker, customTask, email]);
  async function loadNotifications() {
    try {
      const result = await workspaceApi<{ items: Notice[] }>("/notifications");
      setNotices(result.items);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not load notifications.",
      );
    }
  }
  function filter(value: string) {
    setFilters((values) => ({ ...values, urgency: value, page: 1 }));
    document
      .getElementById("bd-action-queue")
      ?.scrollIntoView({ behavior: "smooth" });
  }
  function activity(row: TerritoryRow, call = false) {
    setSelected({ lead: row.leadId._id, contact: row.pocId, call });
  }
  async function completeTask(id: string) {
    setSavingTask(id);
    try {
      const result = await workspaceApi<{ message: string }>(
        `/task/${id}/complete`,
        "PATCH",
        { requestId: crypto.randomUUID() },
      );
      setMessage(result.message);
      reload();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not complete task.",
      );
    } finally {
      setSavingTask("");
    }
  }
  const hour = Number(
    new Date().toLocaleString("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hour12: false,
    }),
  );
  const greeting =
    hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const account = data?.accountability;
  const score = account?.score;
  const yesterday = data?.trend[data.trend.length - 2]?.calls || 0;
  const priorityActions =
    data?.priorityActions ||
    data?.queue.filter((row) => row.reasons.length).slice(0, 5) ||
    [];
  const linkedReady =
    data?.queue.filter((row) => row.linkedin === "Accepted").slice(0, 2) || [];
  const proposalsAwaiting =
    data?.businessOutcomes
      .filter(
        (item) =>
          item._id.kind === "proposal" &&
          item._id.status === "Awaiting feedback",
      )
      .reduce((sum, item) => sum + item.count, 0) || 0;
  const kpis = data
    ? [
        {
          label: "Calls Made Today",
          value: data.totals.calls,
          Icon: Phone,
          badge: yesterday
            ? `${Math.round(((data.totals.calls - yesterday) / yesterday) * 100)}% vs yesterday`
            : "Today",
          foot: `vs yesterday: ${yesterday}`,
          aside: "View call activity",
          filter: "",
        },
        {
          label: "Connected Calls",
          value: data.totals.connected,
          Icon: PhoneCall,
          badge: data.totals.calls
            ? `${rate(data.totals.connected, data.totals.calls)}% connected`
            : "No calls yet",
          foot: "Recorded connections",
          aside: `${data.totals.calls} total calls`,
          filter: "",
        },
        {
          label: "WhatsApp Messages",
          value: data.totals.whatsapp,
          Icon: MessageCircle,
          badge: "Confirmed",
          foot: "Sent status confirmed",
          aside: "Delivery not tracked",
          filter: "Pending communication update",
        },
        {
          label: "Personalized Emails",
          value: data.totals.email,
          Icon: Mail,
          badge: "Sent",
          foot: "Provider + external logs",
          aside: "Opens not tracked",
          filter: "Pending communication update",
        },
        {
          label: "LinkedIn Invites Sent",
          value: data.totals.linkedinSent,
          Icon: Linkedin,
          badge: "Today",
          foot: "Requests recorded today",
          aside: "Review pending",
          filter: "LinkedIn pending",
        },
        {
          label: "Network Invites Accepted",
          value: data.totals.linkedinAccepted,
          Icon: UserCheck,
          badge: "Verified",
          foot: `${linkedReady.length} shown ready for follow-up`,
          aside: "Ready to pitch",
          filter: "LinkedIn accepted",
        },
      ]
    : [];
  return (
    <div className="territory-page">
      <section className="tf-card tf-greeting">
        <div>
          <div className="tf-greeting-title">
            <span className="tf-icon-box">
              <Hand size={19} />
            </span>
            <h1>
              {greeting}, {user.name || "BD Executive"}
            </h1>
            <span className="tf-chip !rounded-full !text-[10px] uppercase">
              BD Executive
            </span>
          </div>
          <p className="mt-2 text-sm text-[#434655]">
            Here is your client activity, follow-up priorities, and revenue
            target progress for today.
          </p>
        </div>
        <div className="tf-context">
          <span className="tf-chip gray !py-2">
            <MapPin size={13} />
            Assigned:{" "}
            <strong>{data?.portfolioCompanies ?? "—"} companies</strong>
          </span>
          <span className="tf-chip gray !py-2">
            <Calendar size={13} />
            Working Day{" "}
            <strong>
              {data?.workingDayNumber ?? "—"} of {data?.workingDayTotal ?? "—"}
            </strong>
          </span>
          <span className="tf-chip gray !py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
            Sync: {loading ? "Refreshing…" : error ? "Unavailable" : "Just now"}
          </span>
          <button className="tf-button" disabled={loading} onClick={reload}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh Feed
          </button>
        </div>
      </section>
      <ActivityDateFilter refreshKey={refresh}/>
      {error && (
        <p role="alert" className="tf-status-message tf-error">
          {error}{" "}
          <button className="underline" onClick={reload}>
            Retry
          </button>
        </p>
      )}
      {message && (
        <p role="status" className="tf-status-message">
          {message}
          <button
            className="float-right"
            aria-label="Dismiss message"
            onClick={() => setMessage("")}
          >
            ×
          </button>
        </p>
      )}
      {!data && loading && (
        <div className="tf-kpis">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-xl bg-blue-100/50"
            />
          ))}
        </div>
      )}
      {data && (
        <>
          <section className="tf-kpis" aria-label="Daily activity KPI cards">
            {kpis.map(
              ({
                label,
                value,
                Icon,
                badge,
                foot,
                aside,
                filter: valueFilter,
              }) => (
                <button
                  key={label}
                  className="tf-card tf-kpi text-left"
                  onClick={() => filter(valueFilter)}
                >
                  <div className="tf-kpi-top">
                    <span className="tf-icon-box">
                      <Icon size={18} />
                    </span>
                    <span className="tf-chip !px-1.5 !text-[9px]">{badge}</span>
                  </div>
                  <div className="tf-kpi-value">{value}</div>
                  <p className="tf-kpi-label">{label}</p>
                  <div className="tf-kpi-foot">
                    <span>{foot}</span>
                    <span className="text-[#004ac6]">{aside}</span>
                  </div>
                </button>
              ),
            )}
          </section>
          <section id="bd-targets" className="tf-targets scroll-mt-5">
            <article className="tf-card tf-target-card">
              <div className="tf-card-header !mb-0">
                <div className="tf-heading">
                  <FileText size={18} />
                  <h2>Daily Proposal Target</h2>
                </div>
                <span className="tf-chip">
                  {data.totals.proposalTarget
                    ? `${rate(data.totals.proposals, data.totals.proposalTarget)}% Complete`
                    : "Non-working day"}
                </span>
              </div>
              <div>
                <div className="tf-target-value">
                  {data.totals.proposals} / {data.totals.proposalTarget}{" "}
                  Proposals
                  <span>
                    {Math.max(
                      0,
                      data.totals.proposalTarget - data.totals.proposals,
                    )}{" "}
                    remaining today
                  </span>
                </div>
                <div className="tf-progress mt-1">
                  <span
                    style={{
                      width: `${Math.min(100, rate(data.totals.proposals, data.totals.proposalTarget))}%`,
                    }}
                  />
                </div>
              </div>
              <div className="tf-inset">
                <strong className="text-[10px] font-semibold uppercase tracking-wider">
                  {data.qualifiedAwaitingProposal} qualified pipeline
                  opportunities
                </strong>
                <p className="mt-1">
                  {data.qualifiedAwaitingProposal
                    ? "Change the company status to Proposal Sent after sending the proposal. Your target updates automatically."
                    : "Qualify opportunities in the contact workspace to build your proposal pipeline."}
                </p>
                <p className="tf-small mt-1">
                  {proposalsAwaiting} proposals awaiting client feedback
                </p>
              </div>
              <div className="tf-target-footer">
                <span className="tf-small">
                  Daily submission
                  <br />
                  Due {data.config.cutoff} IST
                </span>
                <span className="tf-small">
                  Updates automatically from Proposal Sent status.
                </span>
              </div>
            </article>
            <article className="tf-card tf-target-card">
              <div className="tf-card-header !mb-0">
                <div className="tf-heading">
                  <CalendarClock size={18} />
                  <h2>Monthly Client Onboarding</h2>
                </div>
                <span className="tf-chip gray">
                  {rate(data.totals.onboardings, data.totals.onboardingTarget)}%
                  Milestone
                </span>
              </div>
              <div>
                <div className="tf-target-value">
                  {data.totals.onboardings} / {data.totals.onboardingTarget}{" "}
                  Clients
                  <span>
                    {Math.max(
                      0,
                      data.totals.onboardingTarget - data.totals.onboardings,
                    )}{" "}
                    to monthly target
                  </span>
                </div>
                <div className="tf-progress mt-1">
                  <span
                    style={{
                      width: `${Math.min(100, rate(data.totals.onboardings, data.totals.onboardingTarget))}%`,
                    }}
                  />
                </div>
              </div>
              <div className="tf-inset">
                <strong className="text-[10px] font-semibold uppercase tracking-wider">
                  {data.expectedOnboardings} upcoming in the onboarding pipeline
                </strong>
                <p className="mt-1">
                  Agreement and handover confirmations verify each client
                  activation.
                </p>
                <p className="tf-small mt-2">
                  Counted once per company, with a recorded completion date.
                </p>
              </div>
              <div className="tf-target-footer">
                <span className="tf-small">
                  Record a verified
                  <br />
                  activation
                </span>
                <Link className="tf-button" to="/bd/leads?stage=Won">
                  View Onboarding Queue
                </Link>
              </div>
            </article>
            <article className="tf-card tf-target-card">
              <div className="tf-card-header !mb-0">
                <div className="tf-heading">
                  <Target size={18} />
                  <h2>Daily Accountability Score</h2>
                </div>
                <span className="tf-chip">
                  {score === null || score === undefined
                    ? "No score yet"
                    : score >= 80
                      ? "High Compliance"
                      : "Needs Review"}
                </span>
              </div>
              <div className="tf-score-body">
                <div
                  className="tf-score-ring"
                  style={{ "--score": `${score ?? 0}%` } as CSSProperties}
                >
                  <div>
                    {score ?? "—"}
                    <small>/100</small>
                  </div>
                </div>
                <div className="tf-score-parts">
                  {(account?.parts || []).map((part) => (
                    <div key={part.label}>
                      <span>{part.label}</span>
                      <strong>
                        {part.value === null ? "—" : `${part.value}%`}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
              <p className="tf-small">
                {account?.provisional
                  ? "Provisional score · pending deadlines are excluded."
                  : "Applicable process measures use the configured weights."}
              </p>
              <button
                className="tf-inset !bg-[#dce9ff] mt-auto flex items-center justify-between gap-2 text-left"
                onClick={() => setAction({ kind: "report" })}
              >
                <span className="tf-small">
                  <Bell size={13} className="mr-1 inline text-red-600" />
                  Daily report {data.team[0]?.reportStatus || "pending"}
                  <br />
                  Submit by {data.config.cutoff} IST
                </span>
                <span className="tf-chip red">
                  {data.totals.incomplete} action items
                </span>
              </button>
            </article>
          </section>
          <section className="tf-split">
            <article className="tf-card flex flex-col">
              <div className="tf-card-header">
                <div className="tf-heading">
                  <Sparkles size={18} />
                  <div>
                    <h2>Smart Pending Actions Center</h2>
                    <p className="tf-small mt-1">
                      Your highest-priority client actions and exceptions.
                    </p>
                  </div>
                </div>
                <div className="tf-tabs">
                  {(["all", "urgent", "today", "upcoming"] as const).map(
                    (tab) => (
                      <button
                        key={tab}
                        className={`tf-tab ${pendingTab === tab ? "is-active" : ""}`}
                        onClick={() => setPendingTab(tab)}
                      >
                        {tab === "today"
                          ? "Due Today"
                          : tab[0].toUpperCase() + tab.slice(1)}{" "}
                        ({data.priorityCounts?.[tab] ?? 0})
                      </button>
                    ),
                  )}
                </div>
              </div>
              <div className="tf-list">
                {priorityActions.map((row) => (
                  <div key={row._id} className="tf-action">
                    <span
                      className={`tf-icon-box ${row.priority === "Urgent" ? "!bg-[#ffdad6] !text-[#ba1a1a]" : ""}`}
                    >
                      <ShieldAlert size={17} />
                    </span>
                    <div className="tf-action-main">
                      <div className="flex flex-wrap items-center gap-1">
                        <strong className="tf-action-title">
                          {row.leadId.company_name}
                        </strong>
                        <span
                          className={`tf-chip !text-[9px] ${row.priority === "Urgent" ? "red" : ""}`}
                        >
                          {row.reasons[0] || row.priority}
                        </span>
                      </div>
                      <p className="tf-small">
                        {row.contact.name} ·{" "}
                        {row.nextAction ||
                          row.missing.join(", ") ||
                          "Update contact strategy"}
                      </p>
                    </div>
                    <div className="tf-action-controls">
                      <button
                        className="tf-button primary"
                        onClick={() => activity(row, true)}
                      >
                        <Phone size={11} />
                        Call Now
                      </button>
                      <button
                        className="tf-button"
                        onClick={() =>
                          setAction({ kind: "bulk", ids: [row._id] })
                        }
                      >
                        Reschedule
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {!priorityActions.length && (
                <p className="tf-empty">No pending actions in this category.</p>
              )}
              <button
                className="tf-button mt-4 w-full"
                onClick={() =>
                  filter(
                    pendingTab === "urgent"
                      ? "Urgent"
                      : pendingTab === "today"
                        ? "Due today"
                        : "",
                  )
                }
              >
                View All {data.priorityCounts?.all || 0} High-Priority Alerts{" "}
                <ChevronDown size={13} />
              </button>
            </article>
            <article className="tf-card flex flex-col">
              <div className="tf-card-header">
                <div className="tf-heading">
                  <ListTodo size={18} />
                  <div>
                    <h2>My Prioritized To-Do List</h2>
                    <p className="tf-small mt-1">
                      Scheduled tasks requiring attention
                    </p>
                  </div>
                </div>
                <span className="tf-chip">Today: {data.today.slice(5)}</span>
              </div>
              <div className="tf-list">
                {data.scheduledTasks.slice(0, 5).map((task) => (
                  <label key={task._id} className="tf-todo">
                    <input
                      aria-label={`Complete ${task.title}`}
                      type="checkbox"
                      disabled={Boolean(savingTask)}
                      checked={false}
                      onChange={() => void completeTask(task._id)}
                    />
                    <div className="flex-1">
                      <div className="flex justify-between gap-2">
                        <strong className="font-medium">{task.title}</strong>
                        <span
                          className={`tf-chip !text-[9px] ${new Date(task.due_date) < new Date() ? "red" : ""}`}
                        >
                          {displayTime(task.due_date)}
                        </span>
                      </div>
                      <p className="tf-small mt-1">
                        {task.lead_id?.company_name || "Personal task"}
                      </p>
                      {task.lead_id && (
                        <Link
                          to={`/bd/leads?openLead=${task.lead_id._id}&tab=tasks`}
                          className="mt-1 block text-[11px] text-blue-700"
                        >
                          View task details · {task.type || "Follow-up"}
                        </Link>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              {!data.scheduledTasks.length && (
                <p className="tf-empty">
                  No pending tasks. Add your next client action.
                </p>
              )}
              <div className="tf-target-footer mt-4">
                <span className="tf-small">
                  Completed today:{" "}
                  <strong>{data.completedTasksToday || 0} items</strong>
                </span>
                <button
                  className="tf-button"
                  onClick={() => setCustomTask(true)}
                >
                  <Plus size={12} />
                  Add Custom Task
                </button>
              </div>
            </article>
          </section>
          <TerritoryQueue
            data={data}
            filters={filters}
            onFilter={(changes) =>
              setFilters((values) => ({ ...values, ...changes }))
            }
            onActivity={activity}
            onEmail={setEmail}
            onBulk={(ids) => setAction({ kind: "bulk", ids })}
          />
          <TerritoryInsights
            data={data}
            period={period}
            onPeriod={setPeriod}
            onFilter={filter}
            onContact={(lead, contact) => setSelected({ lead, contact })}
            onReview={(leadId) => setAction({ kind: "lifecycle", leadId })}
          />
        </>
      )}
      {picker && (
        <TerritoryModal
          title="Quick Add Activity"
          onClose={() => {
            setPicker(false);
          }}
        >
          <div className="mt-4">
            <ContactPicker
              onSelect={(lead, contact) => {
                setPicker(false);
                setSelected({
                  lead,
                  contact,
                });
              }}
            />
          </div>
        </TerritoryModal>
      )}
      {selected && (
        <ActivityDialog
          leadId={selected.lead}
          pocId={selected.contact}
          callMode={selected.call}
          onClose={() => setSelected(null)}
          onSaved={reload}
        />
      )}
      {action && (
        <TerritoryDialog
          action={action}
          onClose={() => setAction(null)}
          onSaved={reload}
        />
      )}
      {notices && (
        <TerritoryModal
          title="Notification history"
          onClose={() => setNotices(null)}
        >
          <div className="tf-list mt-4">
            {notices.map((notice) => (
              <article key={notice._id} className="tf-inset">
                <strong className="text-xs">{notice.title}</strong>
                <p className="tf-small mt-1">{displayTime(notice.createdAt)}</p>
                <div className="mt-2 flex gap-3">
                  {notice.leadId && (
                    <Link
                      className="text-xs text-blue-700"
                      to={
                        notice.pocId
                          ? `/bd/contacts/${notice.pocId}`
                          : `/bd/leads?openLead=${notice.leadId}`
                      }
                    >
                      Open record
                    </Link>
                  )}
                  {!notice.readAt && (
                    <button
                      className="text-xs text-blue-700"
                      onClick={() =>
                        void workspaceApi(
                          `/notifications/${notice._id}`,
                          "PATCH",
                          {},
                        )
                          .then(loadNotifications)
                          .catch((error) => setError(error.message))
                      }
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </article>
            ))}
            {!notices.length && (
              <p className="tf-empty">No notifications recorded.</p>
            )}
          </div>
        </TerritoryModal>
      )}
      <TaskModal
        isOpen={customTask}
        onClose={() => setCustomTask(false)}
        leadId={null}
        onSuccess={reload}
      />
      <SendEmailModal
        open={Boolean(email)}
        company={email?.leadId || null}
        poc={email ? { ...email.contact, _id: email.pocId } : null}
        onClose={() => {
          setEmail(null);
          reload();
        }}
      />
    </div>
  );
}
