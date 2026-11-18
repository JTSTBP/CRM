import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Flag,
  Linkedin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { workspaceApi, displayTime } from "../bd/workspaceApi";
import { TerritoryModal } from "../bd/TerritoryDialog";
import ActivityDialog from "../bd/ActivityDialog";
import ManagerActionDialog from "./ManagerActionDialog";
import {
  exportCsv,
  type Executive,
  type ManagerData,
  type ManagerAction,
  type QueueRow,
} from "./managerTypes";
import "../bd/territory.css";
import "./managerCommand.css";
const colors = [
  "#2563eb",
  "#7c3aed",
  "#004ac6",
  "#586377",
  "#f59e0b",
  "#ba1a1a",
];
const percent = (value: number | null) => (value === null ? "—" : `${value}%`);
function Progress({
  value,
  total,
  color,
}: {
  value: number;
  total: number;
  color?: string;
}) {
  return (
    <div className="mc-progress" role="img" aria-label={`${value} of ${total}`}>
      <span
        style={{
          width: `${total ? Math.min(100, (value / total) * 100) : 0}%`,
          background: color,
        }}
      />
    </div>
  );
}
function Card({
  title,
  icon,
  aside,
  children,
  className = "",
}: {
  title: string;
  icon?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mc-card ${className}`}>
      <header>
        <h2>
          {icon}
          {title}
        </h2>
        {aside}
      </header>
      {children}
    </section>
  );
}
function Empty({
  children = "No records for this selection.",
}: {
  children?: ReactNode;
}) {
  return <p className="mc-empty">{children}</p>;
}
export default function ManagerCommandDashboard() {
  const [data, setData] = useState<ManagerData | null>(null),
    [period, setPeriod] = useState("today"),
    [employee, setEmployee] = useState(""),
    [territory, setTerritory] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [reload, setReload] = useState(0),
    [settledKey, setSettledKey] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [rosterTab, setRosterTab] = useState("All executives"),
    [alertTab, setAlertTab] = useState("All"),
    [action, setAction] = useState<ManagerAction | null>(null),
    [queue, setQueue] = useState<{ title: string; rows: QueueRow[] } | null>(
      null,
    ),
    [detail, setDetail] = useState<Executive | null>(null),
    [activity, setActivity] = useState<QueueRow | null>(null),
    [tasksOpen, setTasksOpen] = useState(false),
    [selected, setSelected] = useState<string[]>([]);
  const modalOpen = Boolean(action || queue || detail || activity || tasksOpen);
  const requestKey = JSON.stringify([period, employee, territory, from, to, reload]);
  const loading = settledKey !== requestKey && (period !== "custom" || Boolean(from && to));
  useEffect(() => {
    if (period === "custom" && (!from || !to)) return;
    const controller = new AbortController();
    const query = new URLSearchParams({
      period,
      ...(employee ? { employee } : {}),
      ...(territory ? { territory } : {}),
      ...(period === "custom" ? { from, to } : {}),
    });
    workspaceApi<ManagerData>(
      `/manager/dashboard?${query}`,
      "GET",
      undefined,
      controller.signal,
    )
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSettledKey(requestKey);
      });
    return () => controller.abort();
  }, [period, employee, territory, from, to, reload, requestKey]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !modalOpen)
        setReload((value) => value + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, [modalOpen]);
  const saved = (message: string) => {
    setNotice(message);
    setAction(null);
    setQueue(null);
    setReload((value) => value + 1);
  };
  const showQueue = (title: string, rows: QueueRow[]) => {
    setSelected([]);
    setQueue({ title, rows });
  };
  if (!data)
    return (
      <main className="manager-command">
        <div className="mc-card">
          <h1>BD Team Performance Overview</h1>
          {error ? (
            <>
              <p role="alert" className="mc-error">
                {error}
              </p>
              <button onClick={() => setReload((value) => value + 1)}>
                Try again
              </button>
            </>
          ) : (
            <p role="status">Loading your team workspace…</p>
          )}
        </div>
      </main>
    );
  const totals = data.periodTotals,
    critical = data.alerts.filter((row) => row.critical),
    connectRate = totals.calls
      ? Math.round((totals.connected / totals.calls) * 100)
      : null;
  const roster = data.roster
    .filter((row) =>
      (row.name + " " + row.territories.join(" "))
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .filter(
      (row) =>
        rosterTab === "All executives" ||
        (rosterTab === "On track" && !row.incomplete && !row.overdue) ||
        (rosterTab === "Pending updates" && row.incomplete > 0) ||
        (rosterTab === "Overdue follow-ups" && row.overdue > 0) ||
        (rosterTab === "Target achieved" &&
          row.proposalTarget > 0 &&
          row.proposals >= row.proposalTarget),
    );
  const alerts = data.alerts.filter(
    (row) =>
      alertTab === "All" ||
      (alertTab === "Critical" && row.critical) ||
      (alertTab === "Due today" &&
        row.dueAt &&
        new Date(row.dueAt).toLocaleDateString("en-CA", {
          timeZone: "Asia/Kolkata",
        }) === data.today) ||
      (alertTab === "Upcoming" &&
        row.dueAt &&
        new Date(row.dueAt) > new Date()),
  );
  const escalations = data.queue.filter((row) => (row.daysUnreached || 0) >= 5),
    callbacks = data.queue.filter((row) =>
      ["Busy", "No Answer", "Callback Requested"].includes(
        row.callOutcome || "",
      ),
    ),
    recovery = data.queue.filter((row) => row.callOutcome === "Wrong Number"),
    linkedin = data.queue.filter(
      (row) => row.linkedin && row.linkedin !== "Unknown",
    ),
    stalled = data.alerts.filter((row) => row.id.startsWith("lifecycle:"));
  const report = () =>
    exportCsv(`manager-team-${data.range.from}-${data.range.to}`, [
      [
        "Reporting from",
        data.range.from,
        "Reporting to",
        data.range.to,
        "Live queues as of",
        data.today,
      ],
      [
        "Executive",
        "Companies",
        "Calls",
        "Connects",
        "WhatsApp",
        "Email",
        "LinkedIn sent",
        "LinkedIn accepted",
        "Proposals",
        "Proposal target",
        "Onboardings MTD",
        "Monthly target",
        "Pending follow-ups",
        "Overdue",
        "Incomplete contact records today",
        "Report status today",
        "Accountability today",
      ],
      ...data.roster.map((row) => [
        row.name,
        row.companies,
        row.calls,
        row.connected,
        row.whatsapp,
        row.email,
        row.linkedinSent,
        row.linkedinAccepted,
        row.proposals,
        row.proposalTarget,
        row.onboardings,
        row.onboardingTarget,
        row.pending,
        row.overdue,
        row.incomplete,
        row.reportStatus,
        row.score,
      ]),
    ]);
  const tileData = [
    {
      label: "Active execs",
      value: `${data.roster.length} / ${data.employees.length}`,
      note: "Active team accounts",
      icon: <Users />,
      foot: territory || "Your reporting team",
    },
    {
      label: "Companies worked",
      value: totals.companies,
      note: "Unique companies called",
      icon: <Building2 />,
      foot: `${data.range.from} – ${data.range.to}`,
    },
    {
      label: "Calls recorded",
      value: totals.calls,
      note: `${data.previousCalls} in previous equal period`,
      icon: <Phone />,
      foot: "Recorded CRM calls",
    },
    {
      label: `Connects (${percent(connectRate)})`,
      value: totals.connected,
      note: "Connected call outcomes",
      icon: <Activity />,
      foot: "Selected reporting period",
    },
    {
      label: "Pending follow-ups",
      value: totals.pending,
      note: "Current open tasks",
      icon: <Clock3 />,
      foot: `${data.health.dueToday} due today`,
    },
    {
      label: "Overdue SLA",
      value: totals.overdue,
      note: "Past scheduled due time",
      icon: <Flag />,
      foot: "Requires review",
      danger: true,
    },
    {
      label: "Proposals",
      value: `${totals.proposals} / ${totals.proposalTarget}`,
      note: "Configured period target",
      icon: <FileText />,
      foot:
        percent(
          totals.proposalTarget
            ? Math.round((totals.proposals / totals.proposalTarget) * 100)
            : null,
        ) + " of target",
    },
    {
      label: "Clients MTD",
      value: `${totals.onboardings} / ${totals.onboardingTarget}`,
      note: "Verified onboarding records",
      icon: <ShieldCheck />,
      foot: "Current calendar month",
    },
  ];
  function rowActions(row: QueueRow) {
    return (
      <div className="mc-actions">
        <Link
          to={
            row.pocId
              ? `/manager/contacts/${row.pocId}`
              : `/manager/leads/${row.leadId}`
          }
        >
          Open workspace ↗
        </Link>
        {row.pocId && (
          <button
            onClick={() => {
              setQueue(null);
              setActivity(row);
            }}
          >
            Update record
          </button>
        )}
        {row.stateId ? (
          <>
            <button
              onClick={() =>
                setAction({
                  kind: "remind",
                  stateIds: [row.stateId!],
                  leadId: row.leadId,
                })
              }
            >
              Remind rep
            </button>
            <button
              className="mc-primary"
              onClick={() =>
                setAction({
                  kind: "reassign",
                  stateIds: [row.stateId!],
                  leadId: row.leadId,
                })
              }
            >
              Reassign
            </button>
          </>
        ) : (
          <button
            onClick={() =>
              setAction({
                kind: "lifecycle",
                leadId: row.leadId,
                ownerId: row.ownerId,
              })
            }
          >
            Review stage
          </button>
        )}
      </div>
    );
  }
  return (
    <main className="manager-command" aria-busy={loading}>
      <section className="mc-hero mc-card">
        <div>
          <span className="mc-eyebrow">MANAGER COMMAND</span>
          <div className="mc-badges">
            <span className="mc-badge">
              ● Territory: {territory || "All team territories"}
            </span>
            <span className="mc-badge mc-red">
              △ {critical.length} critical / urgent
            </span>
          </div>
          <h1>
            BD Team Performance
            <br />
            Overview
          </h1>
          <p>
            Monitor team activity, follow-up compliance, client progression,
            <br className="mc-wide" /> and business development targets in real
            time.
          </p>
        </div>
        <div className="mc-toolbar">
          <div className="mc-tabs" aria-label="Reporting period">
            {[
              ["today", "Today"],
              ["week", "This Week"],
              ["month", "This Month"],
              ["custom", "Custom"],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={period === value}
                onClick={() => setPeriod(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="mc-select-label">
            Territory
            <select
              aria-label="Territory"
              value={territory}
              onChange={(event) => setTerritory(event.target.value)}
            >
              <option value="">All territories</option>
              {data.territories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          {period === "custom" && (
            <div className="mc-date-fields">
              <label>
                From
                <input
                  type="date"
                  value={from}
                  max={data.today}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={to}
                  min={from}
                  max={data.today}
                  onChange={(event) => setTo(event.target.value)}
                />
              </label>
            </div>
          )}
          <label className="mc-select-label">
            Executive
            <select
              aria-label="Executive"
              value={employee}
              onChange={(event) => setEmployee(event.target.value)}
            >
              <option value="">
                All executives ({data.employees.length} active)
              </option>
              {data.employees.map((person) => (
                <option key={person._id} value={person._id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <div className="mc-actions">
            <button
              className="mc-primary"
              onClick={() => setAction({ kind: "task", ownerId: employee })}
            >
              <Plus size={16} /> Assign Task
            </button>
            <button onClick={report}>
              <Download size={15} /> Export Team Report
            </button>
            <button
              aria-label="Refresh dashboard"
              disabled={loading}
              onClick={() => setReload((value) => value + 1)}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </section>
      <div className="mc-context">
        <span>
          <CalendarDays size={14} /> Outreach: {data.range.from} –{" "}
          {data.range.to} (IST)
        </span>
        <span>
          Live queues and compliance: today · Updated{" "}
          {displayTime(data.generatedAt)}
        </span>
      </div>
      {error && (
        <div role="alert" className="mc-error">
          {error}{" "}
          <button onClick={() => setReload((value) => value + 1)}>Retry</button>
        </div>
      )}
      {notice && (
        <div className="mc-notice" role="status">
          {notice}
          <button aria-label="Dismiss message" onClick={() => setNotice("")}>
            <X size={14} />
          </button>
        </div>
      )}
      <div className="mc-kpis">
        {tileData.map((tile) => (
          <section
            className={`mc-kpi ${tile.danger ? "mc-danger" : ""}`}
            key={tile.label}
          >
            <div>
              <h2>{tile.label}</h2>
              {tile.icon}
            </div>
            <strong>{tile.value}</strong>
            <p>{tile.note}</p>
            <small>{tile.foot}</small>
          </section>
        ))}
      </div>
      <div className="mc-upper-grid">
        <Card
          title="Smart Manager Alert Center"
          icon={<Bell />}
          aside={
            <span className="mc-badge mc-red">{data.alerts.length} live</span>
          }
        >
          <p className="mc-subtitle">
            Recorded bottlenecks requiring managerial action
          </p>
          <div className="mc-tabs mc-wrap">
            {["All", "Critical", "Due today", "Upcoming"].map((tab) => (
              <button
                key={tab}
                aria-pressed={alertTab === tab}
                onClick={() => setAlertTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="mc-alert-list">
            {alerts.slice(0, 5).map((row) => (
              <article className="mc-alert" key={row.id}>
                <div>
                  <h3>
                    <i className={row.critical ? "mc-dot red" : "mc-dot"} />
                    {row.company} <span className="mc-badge">{row.owner}</span>
                  </h3>
                  <p className={row.critical ? "mc-error" : ""}>
                    {row.reasons.join(" · ")}
                  </p>
                  <small>
                    {row.contact}
                    {row.dueAt
                      ? " · " + displayTime(row.dueAt)
                      : " · No retry time recorded"}
                  </small>
                </div>
                {rowActions(row)}
              </article>
            ))}
            {!alerts.length && <Empty>No alerts in this view.</Empty>}
          </div>
          <button
            className="mc-full"
            onClick={() => showQueue("Manager alert queue", alerts)}
          >
            View all {alerts.length} alerts
          </button>
        </Card>
        <Card
          title="Communication Compliance"
          icon={<ShieldCheck />}
          aside={
            <span className="mc-badge">Cutoff: {data.config.cutoff} IST</span>
          }
        >
          <p className="mc-subtitle">
            Today's recorded contact updates across five touchpoints
          </p>
          <div className="mc-compliance">
            <div
              className="mc-ring"
              style={{
                background: `conic-gradient(#2563eb ${(data.compliance.rate || 0) * 3.6}deg,#dce9ff 0)`,
              }}
            >
              <div>
                <strong>{percent(data.compliance.rate)}</strong>
                <small>Team index</small>
              </div>
            </div>
            <div className="mc-grow">
              <p>
                EOD reports submitted{" "}
                <b>
                  {data.compliance.submitted} / {data.compliance.total} reps
                </b>
              </p>
              <Progress
                value={data.compliance.submitted}
                total={data.compliance.total}
                color="#009c76"
              />
              <small>
                Recorded N/A outcomes with required reasons count toward
                completion.
              </small>
            </div>
          </div>
          <div className="mc-checklist">
            {data.compliance.checklist.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong
                  className={
                    item.rate !== null && item.rate < 80
                      ? "mc-orange"
                      : "mc-green"
                  }
                >
                  {percent(item.rate)}
                </strong>
              </div>
            ))}
          </div>
          <div className="mc-report-status">
            {data.roster.map((row) => (
              <button key={row._id} onClick={() => setDetail(row)}>
                <i
                  className={`mc-dot ${row.submitted ? "green" : row.incomplete ? "red" : ""}`}
                />
                <b>{row.name}</b>
                <span>
                  {row.incomplete
                    ? `${row.incomplete} incomplete contact(s)`
                    : row.reportStatus}
                </span>
              </button>
            ))}
          </div>
          <button
            className="mc-full"
            disabled={!data.compliance.incomplete}
            onClick={() =>
              setAction({
                kind: "compliance",
                employeeIds: data.roster
                  .filter(
                    (row) =>
                      row.incomplete ||
                      row.reportStatus === "Pending submission",
                  )
                  .map((row) => row._id),
              })
            }
          >
            Send In-App Compliance Reminder
          </button>
        </Card>
      </div>
      <Card
        title="Live BD Executive Performance Monitor"
        icon={<Users />}
        aside={
          <button onClick={report}>
            <Download size={14} /> Export roster
          </button>
        }
      >
        <p className="mc-subtitle">
          Outreach reflects the selected period. Pending records, follow-ups and
          report status reflect today.
        </p>
        <div className="mc-roster-controls">
          <div className="mc-tabs mc-wrap">
            {[
              "All executives",
              "On track",
              "Pending updates",
              "Overdue follow-ups",
              "Target achieved",
            ].map((tab) => (
              <button
                key={tab}
                onClick={() => setRosterTab(tab)}
                aria-pressed={rosterTab === tab}
              >
                {tab}
              </button>
            ))}
          </div>
          <label className="mc-search">
            <Search size={15} />
            <input
              aria-label="Search executives"
              placeholder="Search executive or territory"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        <div className="mc-table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "Executive & territory",
                  "Companies",
                  "Calls (connect %)",
                  "WA",
                  "Email",
                  "LinkedIn sent / accepted",
                  "Pending comm.",
                  "Pending F/U",
                  "Overdue F/U",
                  "Proposals",
                  "Onboardings MTD",
                  "Actions",
                ].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roster.map((row, index) => (
                <tr key={row._id}>
                  <td>
                    <button
                      className="mc-person"
                      onClick={() => setDetail(row)}
                    >
                      <span
                        className="mc-avatar"
                        style={{ background: colors[index % colors.length] }}
                      >
                        {row.name
                          .split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <span>
                        <b>{row.name}</b>
                        <small>
                          {row.territories.join(" · ") || "Territory not set"}
                        </small>
                      </span>
                    </button>
                  </td>
                  <td>{row.companies}</td>
                  <td>
                    {row.calls}
                    <small className="mc-green">
                      {row.connected} connected ·{" "}
                      {percent(
                        row.calls
                          ? Math.round((row.connected / row.calls) * 100)
                          : null,
                      )}
                    </small>
                  </td>
                  <td>{row.whatsapp}</td>
                  <td>{row.email}</td>
                  <td>
                    {row.linkedinSent} / {row.linkedinAccepted}
                  </td>
                  <td>
                    <span
                      className={`mc-badge ${row.incomplete ? "mc-red" : "mc-mint"}`}
                    >
                      {row.incomplete} pending
                    </span>
                  </td>
                  <td>{row.pending}</td>
                  <td>
                    <span
                      className={`mc-badge ${row.overdue ? "mc-red" : "mc-mint"}`}
                    >
                      {row.overdue} overdue
                    </span>
                  </td>
                  <td>
                    <b>
                      {row.proposals} / {row.proposalTarget}
                    </b>
                    <Progress
                      value={row.proposals}
                      total={row.proposalTarget}
                    />
                  </td>
                  <td>
                    <b>
                      {row.onboardings} / {row.onboardingTarget}
                    </b>
                    <Progress
                      value={row.onboardings}
                      total={row.onboardingTarget}
                      color="#009c76"
                    />
                  </td>
                  <td>
                    <button onClick={() => setDetail(row)}>Review</button>
                    <button
                      onClick={() => {
                        setEmployee(row._id);
                        setNotice(`Showing ${row.name}'s portfolio.`);
                      }}
                    >
                      Filter
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!roster.length && <Empty>No executives match these filters.</Empty>}
      </Card>
      <div className="mc-grid-three">
        <Card
          title="Team Follow-up Health"
          icon={<Clock3 />}
          aside={
            <span className="mc-badge mc-mint">
              {percent(data.health.rate)} on time
            </span>
          }
        >
          <div className="mc-stat-grid">
            {[
              [data.health.onTime, "Completed on time"],
              [data.health.late, "Completed late"],
              [data.health.overdue, "Current overdue"],
              [data.health.dueToday, "Open due today"],
            ].map(([value, label]) => (
              <div key={String(label)}>
                <strong>{value}</strong>
                <small>{label}</small>
              </div>
            ))}
          </div>
          <h3>Overdue aging buckets</h3>
          {data.health.aging.map((item) => (
            <div className="mc-line" key={item.label}>
              <span>{item.label}</span>
              <span className="mc-badge">{item.count} tasks</span>
            </div>
          ))}
          <button className="mc-full" onClick={() => setTasksOpen(true)}>
            View Follow-up Tasks ({data.followups.length})
          </button>
        </Card>
        <Card
          title="Callback & Retry Radar"
          icon={<Phone />}
          aside={<span className="mc-badge">{callbacks.length} contacts</span>}
        >
          <div className="mc-mini-grid">
            {[
              [data.callbacks.busy, "Busy"],
              [data.callbacks.noAnswer, "No answer"],
              [data.callbacks.requested, "Requested"],
            ].map(([value, label]) => (
              <div key={String(label)}>
                <small>{label}</small>
                <b>{value}</b>
              </div>
            ))}
          </div>
          {data.callbacks.unscheduled.length > 0 && (
            <p className="mc-warning">
              {data.callbacks.unscheduled.length} contact(s) lack a scheduled
              retry.
            </p>
          )}
          {callbacks.slice(0, 3).map((row) => (
            <button
              className="mc-list-button"
              key={row.id}
              onClick={() => showQueue("Callback review", [row])}
            >
              <span>
                {row.company}
                <small>
                  {row.owner} · {row.attempts} attempts
                </small>
              </span>
              <span>{row.dueAt ? displayTime(row.dueAt) : "Unscheduled"}</span>
            </button>
          ))}
          {!callbacks.length && <Empty>No callback records.</Empty>}
          <button
            className="mc-full"
            onClick={() => showQueue("Callbacks & retry queue", callbacks)}
          >
            Review / Reassign Callbacks
          </button>
        </Card>
        <Card
          title="5-Day Escalation Board"
          icon={<Flag />}
          aside={
            <span className="mc-badge mc-red">
              {escalations.length} escalations
            </span>
          }
        >
          <p>
            Recorded unsuccessful outreach with no direct connection for five
            calendar days.
          </p>
          {escalations.slice(0, 4).map((row) => (
            <button
              className="mc-list-button"
              key={row.id}
              onClick={() => showQueue("Escalation intervention", [row])}
            >
              <span>
                {row.company}
                <small>
                  {row.owner} · {row.attempts} attempts · {row.callOutcome}
                </small>
              </span>
              <span className="mc-badge mc-red">{row.daysUnreached} days</span>
            </button>
          ))}
          {!escalations.length && <Empty>No five-day escalations.</Empty>}
          <button
            className="mc-full"
            onClick={() =>
              exportCsv(`escalation-audit-${data.today}`, [
                [
                  "Company",
                  "Contact",
                  "Executive",
                  "Days unreached",
                  "Attempts",
                  "Last outcome",
                ],
                ...escalations.map((row) => [
                  row.company,
                  row.contact,
                  row.owner,
                  row.daysUnreached ?? 0,
                  row.attempts || 0,
                  row.callOutcome || "",
                ]),
              ])
            }
          >
            Download Escalation Audit
          </button>
        </Card>
        <Card
          title="Lead Lifecycle Health"
          icon={<TrendingUp />}
          aside={
            <span className="mc-badge">{data.companies.length} companies</span>
          }
        >
          <div className="mc-stage-grid">
            {data.lifecycle.map((item) => (
              <div key={item.stage}>
                <small>{item.stage}</small>
                <b>{item.count}</b>
              </div>
            ))}
          </div>
          <p className="mc-warning">
            {data.stalledCount} companies stalled beyond 48 hours
          </p>
          {stalled.slice(0, 2).map((row) => (
            <button
              className="mc-list-button"
              key={row.id}
              onClick={() => showQueue("Stalled account review", [row])}
            >
              <span>
                {row.company}
                <small>{row.owner}</small>
              </span>
              Review ↗
            </button>
          ))}
          <button
            className="mc-full"
            onClick={() => showQueue("Stalled companies", stalled)}
          >
            Review Stalled Companies
          </button>
        </Card>
        <Card
          title="Data Quality & Recovery"
          icon={<ShieldCheck />}
          aside={<span className="mc-badge">{recovery.length} contacts</span>}
        >
          <p>Wrong-number recovery checklist from contact records.</p>
          {data.recovery.map((item, index) => (
            <div className="mc-recovery" key={item.key}>
              <div className="mc-line">
                <span>
                  {item.key
                    .replace(/([A-Z])/g, " $1")
                    .replace(/^./, (letter) => letter.toUpperCase())}
                </span>
                <b>{item.count}</b>
              </div>
              <Progress
                value={item.count}
                total={recovery.length}
                color={colors[index % colors.length]}
              />
            </div>
          ))}
          <button
            className="mc-full"
            onClick={() => showQueue("Contact data recovery", recovery)}
          >
            Review / Assign Contact Research
          </button>
        </Card>
        <Card
          title="LinkedIn Outreach Pulse"
          icon={<Linkedin />}
          aside={
            <span className="mc-badge">
              {percent(
                data.linkedin.sent +
                  data.linkedin.pending +
                  data.linkedin.accepted +
                  data.linkedin.rejected
                  ? Math.round(
                      (data.linkedin.accepted /
                        (data.linkedin.sent +
                          data.linkedin.pending +
                          data.linkedin.accepted +
                          data.linkedin.rejected)) *
                        100,
                    )
                  : null,
              )}{" "}
              acceptance
            </span>
          }
        >
          <div className="mc-stat-grid">
            {[
              [data.linkedin.sent, "Sent"],
              [data.linkedin.accepted, "Accepted"],
              [data.linkedin.pending, "Pending acceptance"],
              [data.linkedin.awaitingFollowup, "Awaiting follow-up"],
            ].map(([value, label]) => (
              <div key={String(label)}>
                <strong>{value}</strong>
                <small>{label}</small>
              </div>
            ))}
          </div>
          <p>
            Statuses are recorded in CRM. External LinkedIn data is not
            synchronized.
          </p>
          <button
            className="mc-full"
            onClick={() => showQueue("LinkedIn outreach records", linkedin)}
          >
            Review LinkedIn Records
          </button>
        </Card>
      </div>
      <div className="mc-grid-two">
        <Card
          title="Proposal Target Tracker"
          icon={<Target />}
          aside={
            <strong className="mc-big-number">
              {totals.proposals} <small>/ {totals.proposalTarget}</small>
            </strong>
          }
        >
          <p>
            Configured executive targets across working days in the selected
            period. Targets are not apportioned by territory.
          </p>
          <Progress value={totals.proposals} total={totals.proposalTarget} />
          {data.roster.map((row) => (
            <div className="mc-target-row" key={row._id}>
              <button onClick={() => setDetail(row)}>{row.name}</button>
              <Progress
                value={row.proposals}
                total={row.proposalTarget}
                color={
                  row.proposalTarget && row.proposals < row.proposalTarget
                    ? "#f59e0b"
                    : "#009c76"
                }
              />
              <b>
                {row.proposals} / {row.proposalTarget}
              </b>
            </div>
          ))}
          <div className="mc-footer">
            Remaining to period target:{" "}
            <b>
              {Math.max(0, totals.proposalTarget - totals.proposals)} proposals
            </b>
          </div>
        </Card>
        <Card
          title="Monthly Client Onboardings"
          icon={<CheckCircle2 />}
          aside={
            <strong className="mc-big-number">
              {totals.onboardings} <small>/ {totals.onboardingTarget}</small>
            </strong>
          }
        >
          <p>Verified client activations against current monthly targets.</p>
          <Progress
            value={totals.onboardings}
            total={totals.onboardingTarget}
          />
          <div className="mc-mini-grid mc-month-stats">
            <div>
              <small>Completed MTD</small>
              <strong>{totals.onboardings}</strong>
            </div>
            <div>
              <small>Planned next 7 days</small>
              <strong>{data.plannedNextWeek}</strong>
            </div>
            <div>
              <small>Working days left</small>
              <strong>{data.remainingWorkingDays}</strong>
            </div>
          </div>
          <p className="mc-info">
            Required run rate:{" "}
            <b>
              {data.remainingWorkingDays
                ? (
                    Math.max(0, totals.onboardingTarget - totals.onboardings) /
                    data.remainingWorkingDays
                  ).toFixed(1)
                : "—"}{" "}
              clients / working day
            </b>
          </p>
          <h3>Monthly contributions</h3>
          {data.roster.map((row) => (
            <div className="mc-line" key={row._id}>
              <button onClick={() => setDetail(row)}>{row.name}</button>
              <b>{row.onboardings} activations</b>
            </div>
          ))}
        </Card>
      </div>
      <div className="mc-grid-three">
        <Card title="Activity Trends" icon={<TrendingUp />}>
          <p>Calls, WhatsApp confirmations and connects by reporting day.</p>
          <div className="mc-chart">
            <ResponsiveContainer
              width="100%"
              height="100%"
              initialDimension={{ width: 320, height: 240 }}
            >
              <AreaChart data={data.trend}>
                <CartesianGrid vertical={false} stroke="#e7edfa" />
                <XAxis
                  dataKey="day"
                  tickFormatter={(value) => String(value).slice(5)}
                  tick={{ fontSize: 11 }}
                />
                <YAxis allowDecimals={false} width={28} />
                <Tooltip />
                <Legend />
                <Area
                  name="Calls"
                  dataKey="calls"
                  stroke="#2563eb"
                  fill="#dce9ff"
                />
                <Area
                  name="WhatsApp"
                  dataKey="whatsapp"
                  stroke="#004ac6"
                  fill="transparent"
                />
                <Area
                  name="Connects"
                  dataKey="connected"
                  stroke="#009c76"
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Funnel Stage Conversion" icon={<TrendingUp />}>
          <p>
            Companies worked in the reporting period, followed through the same
            cohort.
          </p>
          {data.funnel.map((item, index) => (
            <div className="mc-funnel" key={item.label}>
              <div className="mc-line">
                <span>
                  {index + 1}. {item.label}
                </span>
                <b>
                  {item.count} (
                  {percent(
                    data.funnel[0].count
                      ? Math.round((item.count / data.funnel[0].count) * 100)
                      : null,
                  )}
                  )
                </b>
              </div>
              <Progress
                value={item.count}
                total={data.funnel[0].count}
                color={colors[index]}
              />
            </div>
          ))}
          <p className="mc-info">
            Each step counts unique companies with qualifying CRM records in
            this period.
          </p>
        </Card>
        <Card title="Executive Contribution" icon={<Users />}>
          <p>Share of recorded calls in the selected reporting period.</p>
          {totals.calls ? (
            <div className="mc-chart mc-donut">
              <ResponsiveContainer
                width="100%"
                height="100%"
                initialDimension={{ width: 320, height: 240 }}
              >
                <PieChart>
                  <Pie
                    data={data.roster.filter((row) => row.calls > 0)}
                    dataKey="calls"
                    nameKey="name"
                    innerRadius="58%"
                    outerRadius="85%"
                  >
                    {data.roster
                      .filter((row) => row.calls > 0)
                      .map((row, index) => (
                        <Cell
                          key={row._id}
                          fill={colors[index % colors.length]}
                        />
                      ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <span>
                <strong>{totals.calls}</strong>
                <small>Total calls</small>
              </span>
            </div>
          ) : (
            <Empty>No call activity for this period.</Empty>
          )}
          <div className="mc-legend">
            {data.roster.map((row, index) => (
              <span key={row._id}>
                <i style={{ background: colors[index % colors.length] }} />
                {row.name}:{" "}
                {percent(
                  totals.calls
                    ? Math.round((row.calls / totals.calls) * 100)
                    : null,
                )}
              </span>
            ))}
          </div>
          <button className="mc-full" onClick={report}>
            Export Contribution Matrix
          </button>
        </Card>
      </div>
      <Card
        title="BD Team Accountability Index"
        icon={<ShieldCheck />}
        aside={
          <strong className="mc-score">
            Team score: {data.accountability.score ?? "—"} / 100
          </strong>
        }
      >
        <p>
          25% communication + 25% on-time follow-ups + 15% overdue resolution +
          15% lifecycle review + 20% on-time report. N/A dimensions are excluded
          and weights normalized.{" "}
          {data.accountability.provisional
            ? "Provisional until today’s reporting cutoff."
            : "Current day score."}
        </p>
        <div className="mc-rankings">
          {[...data.roster]
            .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
            .map((row, index) => (
              <button
                key={row._id}
                className={`mc-rank ${row.score !== null && row.score < 70 ? "mc-rank-red" : ""}`}
                onClick={() => setDetail(row)}
              >
                <span>
                  Rank #{index + 1}
                  <b>{row.score ?? "—"} / 100</b>
                </span>
                <strong>{row.name}</strong>
                <small>
                  {row.score === null
                    ? "No applicable records"
                    : row.score >= 90
                      ? "Strong compliance"
                      : row.score >= 70
                        ? "Review outstanding actions"
                        : "Needs intervention"}
                </small>
              </button>
            ))}
        </div>
        <h3 className="mc-audit-heading">
          Live Manager Intervention Audit Log
        </h3>
        {data.audit.length ? (
          data.audit.slice(0, 6).map((event) => (
            <div className="mc-audit" key={event._id}>
              <Activity size={15} />
              <time>{displayTime(event.createdAt)}</time>
              <span>
                <b>{event.kind.replace("manager-", "").replaceAll("-", " ")}</b>
                {event.leadId ? " · " + event.leadId.company_name : ""}:{" "}
                {event.data.reason ||
                  event.data.remarks ||
                  "Recorded manager action"}
              </span>
            </div>
          ))
        ) : (
          <Empty>No manager interventions recorded for this portfolio.</Empty>
        )}
      </Card>
      {action && (
        <ManagerActionDialog
          action={action}
          data={data}
          onClose={() => setAction(null)}
          onSaved={saved}
        />
      )}
      {queue && !action && (
        <TerritoryModal title={queue.title} onClose={() => setQueue(null)}>
          <div className="mc-form">
            <p>{queue.rows.length} records · current team portfolio</p>
            <div className="mc-actions">
              <button
                onClick={() =>
                  exportCsv("manager-queue-" + data.today, [
                    [
                      "Company",
                      "Contact",
                      "Executive",
                      "Reasons",
                      "Due date",
                      "Next action",
                    ],
                    ...queue.rows.map((row) => [
                      row.company,
                      row.contact,
                      row.owner,
                      row.reasons.join("; "),
                      row.dueAt || "",
                      row.nextAction || "",
                    ]),
                  ])
                }
              >
                Export queue
              </button>
              {selected.length > 0 && (
                <>
                  <button
                    onClick={() =>
                      setAction({ kind: "reassign", stateIds: selected })
                    }
                  >
                    Reassign ({selected.length})
                  </button>
                  <button
                    onClick={() =>
                      setAction({ kind: "remind", stateIds: selected })
                    }
                  >
                    Remind selected
                  </button>
                  <button
                    onClick={() =>
                      setAction({ kind: "research", stateIds: selected })
                    }
                  >
                    Assign research
                  </button>
                </>
              )}
            </div>
            {queue.rows.map((row) => (
              <article className="mc-queue-row" key={row.id}>
                {row.stateId && (
                  <label className="mc-checkbox">
                    <input
                      type="checkbox"
                      checked={selected.includes(row.stateId)}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, row.stateId!]
                            : current.filter((id) => id !== row.stateId),
                        )
                      }
                    />
                    Select {row.contact}
                  </label>
                )}
                <h3>
                  {row.company} · {row.contact}
                </h3>
                <p>
                  {row.owner} ·{" "}
                  {row.reasons.join(" · ") || row.linkedin || row.callOutcome}
                </p>
                <p>
                  {row.nextAction || "No next action recorded"} ·{" "}
                  {row.dueAt ? displayTime(row.dueAt) : "No due date recorded"}
                </p>
                {rowActions(row)}
              </article>
            ))}
            {!queue.rows.length && <Empty />}
          </div>
        </TerritoryModal>
      )}
      {detail && !action && (
        <TerritoryModal
          title={`${detail.name} — performance review`}
          onClose={() => setDetail(null)}
        >
          <div className="mc-form">
            <p>
              {detail.reportStatus} · {detail.incomplete} incomplete contact
              record(s) today
            </p>
            <h3>Accountability: {detail.score ?? "—"} / 100</h3>
            {detail.parts.map((part) => (
              <div className="mc-line" key={part.label}>
                <span>
                  {part.label} ({part.weight}%)
                </span>
                <b>{percent(part.value)}</b>
              </div>
            ))}
            <div className="mc-actions">
              <button
                onClick={() => {
                  setDetail(null);
                  showQueue(
                    `${detail.name} — contact queue`,
                    data.queue.filter((row) => row.ownerId === detail._id),
                  );
                }}
              >
                Review contact records
              </button>
              <button
                onClick={() => {
                  setDetail(null);
                  setAction({ kind: "task", ownerId: detail._id });
                }}
              >
                Assign task
              </button>
              <button
                onClick={() => {
                  setDetail(null);
                  setAction({ kind: "corep", ownerId: detail._id });
                }}
              >
                Add to a company
              </button>
            </div>
          </div>
        </TerritoryModal>
      )}
      {tasksOpen && !action && (
        <TerritoryModal
          title="Current follow-up tasks"
          onClose={() => setTasksOpen(false)}
        >
          <div className="mc-form">
            {data.followups.map((task) => (
              <article key={task.id} className="mc-queue-row">
                <h3>{task.title}</h3>
                <p>
                  {task.company} · {task.owner}
                </p>
                <p
                  className={
                    new Date(task.dueAt) < new Date() ? "mc-error" : ""
                  }
                >
                  {displayTime(task.dueAt)}
                </p>
                <div className="mc-actions">
                  <Link to={`/manager/leads/${task.leadId}`}>
                    Open company ↗
                  </Link>
                  <button
                    onClick={() => {
                      setTasksOpen(false);
                      setAction({
                        kind: "task",
                        leadId: task.leadId,
                        ownerId: task.ownerId,
                      });
                    }}
                  >
                    Assign next action
                  </button>
                </div>
              </article>
            ))}
            {!data.followups.length && <Empty />}
          </div>
        </TerritoryModal>
      )}
      {activity && (
        <ActivityDialog
          leadId={activity.leadId}
          pocId={activity.pocId!}
          onClose={() => setActivity(null)}
          onSaved={() => {
            setActivity(null);
            setReload((value) => value + 1);
            setNotice("Contact activity updated.");
          }}
        />
      )}
    </main>
  );
}
