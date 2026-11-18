import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  Download,
  Flag,
  Layers,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  Settings,
  ShieldCheck,
  Target,
  Users,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as XLSX from "xlsx";
import { workspaceApi, displayTime } from "../bd/workspaceApi";
import { TerritoryModal } from "../bd/TerritoryDialog";
import MonitoringSettings from "../bd/MonitoringSettings";
import ManagerActionDialog from "../manager/ManagerActionDialog";
import {
  exportCsv,
  type ManagerAction,
  type QueueRow,
} from "../manager/managerTypes";
import ExecutiveDirective from "./ExecutiveDirective";
import type { AdminData, DirectiveAction } from "./adminTypes";
import "../bd/territory.css";
import "./executiveDashboard.css";
const pct = (value: number | null) => (value === null ? "—" : `${value}%`);
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
    <div className="ae-progress" role="img" aria-label={`${value} of ${total}`}>
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
    <section className={`ae-card ${className}`}>
      <header>
        <div>
          <h2>
            {icon}
            {title}
          </h2>
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}
function Empty({
  children = "No records in this selection.",
}: {
  children?: ReactNode;
}) {
  return <p className="ae-empty">{children}</p>;
}
export default function ExecutiveDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<AdminData | null>(null),
    [period, setPeriod] = useState("today"),
    [manager, setManager] = useState(""),
    [employee, setEmployee] = useState(""),
    [territory, setTerritory] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [revision, setRevision] = useState(0),
    [settled, setSettled] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [directive, setDirective] = useState<DirectiveAction | null>(null),
    [action, setAction] = useState<ManagerAction | null>(null),
    [queue, setQueue] = useState<{ title: string; rows: QueueRow[] } | null>(
      null,
    ),
    [selected, setSelected] = useState<string[]>([]),
    [accountStage, setAccountStage] = useState<string | null>(null),
    [settingsOpen, setSettingsOpen] = useState(false),
    [exportOpen, setExportOpen] = useState(false),
    [auditSearch, setAuditSearch] = useState("");
  const requestKey = JSON.stringify([
      period,
      manager,
      employee,
      territory,
      from,
      to,
      revision,
    ]),
    loading = requestKey !== settled,
    modal = Boolean(
      directive ||
      action ||
      queue ||
      accountStage !== null ||
      settingsOpen ||
      exportOpen,
    );
  useEffect(() => {
    if (period === "custom" && (!from || !to)) return;
    const controller = new AbortController();
    const query = new URLSearchParams({
      period,
      ...(manager ? { manager } : {}),
      ...(employee ? { employee } : {}),
      ...(territory ? { territory } : {}),
      ...(period === "custom" ? { from, to } : {}),
    });
    workspaceApi<AdminData>(
      `/admin/dashboard?${query}`,
      "GET",
      undefined,
      controller.signal,
    )
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSettled(requestKey);
      });
    return () => controller.abort();
  }, [period, manager, employee, territory, from, to, revision, requestKey]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !modal)
        setRevision((value) => value + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, [modal]);
  const saved = (message: string) => {
    setDirective(null);
    setAction(null);
    setQueue(null);
    setNotice(message);
    setRevision((value) => value + 1);
  };
  const openQueue = (title: string, rows: QueueRow[]) => {
    setSelected([]);
    setQueue({ title, rows });
  };
  if (!data)
    return (
      <div className="ae-dashboard">
        <section className="ae-card">
          <h1>Executive Command Center</h1>
          {error ? (
            <>
              <p role="alert" className="ae-error">
                {error}
              </p>
              <button onClick={() => setRevision((value) => value + 1)}>
                Retry dashboard
              </button>
            </>
          ) : (
            <p role="status">Loading executive telemetry…</p>
          )}
        </section>
      </div>
    );
  const totals = data.periodTotals,
    critical = data.alerts.filter((row) => row.critical),
    stalled = data.alerts.filter((row) =>
      row.reasons.includes("Lifecycle stalled"),
    ),
    escalations = data.queue.filter((row) => (row.daysUnreached || 0) >= 5),
    recovery = data.queue.filter((row) => row.callOutcome === "Wrong Number"),
    unreached = data.queue.filter((row) => (row.daysUnreached || 0) > 0),
    actors = [
      ...new Set(
        data.queue.filter((row) => row.critical).map((row) => row.ownerId),
      ),
    ],
    connectRate = totals.calls
      ? Math.round((totals.connected / totals.calls) * 100)
      : null;
  const stageAccounts =
    accountStage === null
      ? []
      : data.accounts.filter(
          (account) =>
            !accountStage ||
            (accountStage === "Qualified"
              ? data.qualified.some((company) => company._id === account._id)
              : account.stage === accountStage),
        );
  const reportRows: (string | number | null)[][] = [
    [
      "Report from",
      data.range.from,
      "Report to",
      data.range.to,
      "Current queues as of",
      data.today,
    ],
    [
      "Manager",
      "Territory",
      "Active team",
      "Assigned companies",
      "Calls",
      "Connections",
      "Pending follow-ups",
      "Overdue",
      "Pending communication",
      "Proposals",
      "Proposal target",
      "Onboardings MTD",
      "Follow-up SLA today",
    ],
    ...data.managerMatrix.map((row) => [
      row.name,
      row.territories.join("; "),
      row.team,
      row.assigned,
      row.calls,
      row.connected,
      row.pending,
      row.overdue,
      row.incomplete,
      row.proposals,
      row.proposalTarget,
      row.onboardings,
      row.sla,
    ]),
  ];
  function exportExcel() {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(reportRows),
      "Executive report",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(data!.velocity),
      "Current pipeline",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Company", "Contact", "Executive", "Reasons", "Due"],
        ...data!.alerts.map((row) => [
          row.company,
          row.contact,
          row.owner,
          row.reasons.join("; "),
          row.dueAt || "",
        ]),
      ]),
      "Live alerts",
    );
    XLSX.writeFile(workbook, `executive-board-report-${data!.today}.xlsx`);
  }
  const notifyOwners = (rows: QueueRow[], title: string) => {
    setDirective({
      kind: "directive",
      recipients: [...new Set(rows.map((row) => row.ownerId).filter(Boolean))],
      title,
      message:
        "Review the recorded account issue, confirm the next action, and update CRM before the reporting cutoff.",
    });
  };
  const queueActions = (row: QueueRow) => (
    <div className="ae-button-row">
      <Link to={`/admin/leads/${row.leadId}?tab=contacts`}>View company</Link>
      {row.stateId ? (
        <>
          <button
            onClick={() =>
              setAction({ kind: "remind", stateIds: [row.stateId!] })
            }
          >
            Remind Rep
          </button>
          <button
            className="ae-primary"
            onClick={() =>
              setAction({ kind: "reassign", stateIds: [row.stateId!] })
            }
          >
            Reassign
          </button>
        </>
      ) : (
        <button
          className="ae-primary"
          onClick={() =>
            setAction({
              kind: "lifecycle",
              leadId: row.leadId,
              ownerId: row.ownerId,
            })
          }
        >
          Force Review
        </button>
      )}
    </div>
  );
  return (
    <div className="ae-dashboard" aria-busy={loading}>
      <div className="ae-utility">
        <span>
          <i className="ae-live" /> Synced: {displayTime(data.generatedAt)} ·
          refreshes every minute
        </span>
        <div className="ae-button-row">
          <button
            disabled={loading}
            onClick={() => setRevision((value) => value + 1)}
            aria-label="Refresh executive dashboard"
          >
            <RefreshCw size={14} />
          </button>
          <button
            className="ae-primary"
            onClick={() => setDirective({ kind: "directive" })}
          >
            + Executive Directive
          </button>
          <button onClick={() => setExportOpen(true)}>
            <Download size={14} /> Export Board Report
          </button>
        </div>
      </div>
      <section className="ae-hero ae-card">
        <div className="ae-hero-head">
          <div>
            <h1>Executive Command Center</h1>
            <span className="ae-pill">● LIVE CRM TELEMETRY</span>
            <p>
              Company-wide business development performance, client acquisition
              velocity, and managerial execution metrics.
            </p>
          </div>
          <div className="ae-hero-summary">
            <div>
              <span className="ae-pill">
                <Building2 size={12} /> Active territories:{" "}
                {data.territories.length}
              </span>
              <span className="ae-pill">
                <Users size={12} /> BD headcount: {data.employees.length} reps ·{" "}
                {data.managers.length} managers
              </span>
            </div>
            <button
              className="ae-hero-alert"
              onClick={() => openQueue("Critical executive alerts", critical)}
            >
              <Bell size={17} />
              <span>
                {critical.length} critical items require attention
                <small>Review live SLA, recovery and client escalations</small>
              </span>
              <ArrowUpRight size={17} />
            </button>
          </div>
        </div>
        <div className="ae-filters">
          <span className="ae-label">Time horizon</span>
          <div className="ae-segment">
            {[
              ["today", "Today"],
              ["week", "This Week"],
              ["month", "This Month"],
              ["custom", "Custom Range"],
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
          {period === "custom" ? (
            <div className="ae-dates">
              <label>
                From
                <input
                  type="date"
                  max={data.today}
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  max={data.today}
                  min={from}
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                />
              </label>
            </div>
          ) : (
            <span className="ae-pill ae-blue">
              <CalendarDays size={12} />
              {data.range.from} – {data.range.to}
            </span>
          )}
        </div>
        <div className="ae-filters">
          <label>
            Territory
            <select
              aria-label="Territory"
              value={territory}
              onChange={(event) => setTerritory(event.target.value)}
            >
              <option value="">All Divisions (Global)</option>
              {data.territories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Regional Lead
            <select
              aria-label="Manager"
              value={manager}
              onChange={(event) => {
                setManager(event.target.value);
                setEmployee("");
                setTerritory("");
              }}
            >
              <option value="">All Regional Managers</option>
              {data.managers.map((person) => (
                <option key={person._id} value={person._id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Executive
            <select
              aria-label="Executive"
              value={employee}
              onChange={(event) => setEmployee(event.target.value)}
            >
              <option value="">All Executives</option>
              {data.employees.map((person) => (
                <option key={person._id} value={person._id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              setPeriod("today");
              setManager("");
              setEmployee("");
              setTerritory("");
              setFrom("");
              setTo("");
            }}
          >
            ↻ Reset Filters
          </button>
        </div>
        <p className="ae-scope">
          Outreach: selected period (IST). Pipeline, queues and compliance:
          today. Activations: current calendar month.
        </p>
      </section>
      {error && (
        <p role="alert" className="ae-error">
          {error}{" "}
          <button onClick={() => setRevision((value) => value + 1)}>
            Retry
          </button>
        </p>
      )}
      {notice && (
        <div className="ae-notice" role="status">
          {notice}
          <button aria-label="Dismiss message" onClick={() => setNotice("")}>
            <X size={14} />
          </button>
        </div>
      )}
      <div className="ae-kpi-groups">
        <Card
          title="1. BUSINESS DEVELOPMENT"
          aside={<small>Pipeline sourcing</small>}
        >
          <div className="ae-metric-grid">
            {[
              [data.companies.length, "Accounts", "Current portfolio"],
              [
                data.lifecycle.find((row) => row.stage === "New")?.count || 0,
                "New leads",
                "Current stage",
              ],
              [data.contactCount, "Contacts", "Approved people"],
              [data.qualified.length, "Qualified", "Opportunity plans"],
              [data.stalledCount, "Stalled", "Contacted >48h"],
            ].map(([value, label, note]) => (
              <button
                key={String(label)}
                className={label === "Stalled" ? "ae-red-bg" : ""}
                onClick={() =>
                  label === "Contacts"
                    ? navigate("/admin/contacts")
                    : label === "Stalled"
                      ? openQueue("Stalled companies", stalled)
                      : setAccountStage(
                          label === "New leads"
                            ? "New"
                            : label === "Qualified"
                              ? "Qualified"
                              : "",
                        )
                }
              >
                <small>{label}</small>
                <strong>{value}</strong>
                <em>{note}</em>
              </button>
            ))}
          </div>
        </Card>
        <Card
          title="2. SALES PERFORMANCE"
          aside={<small>Quota & closing</small>}
        >
          <div className="ae-metric-grid ae-purple-metrics">
            {[
              [
                `${totals.proposals}/${totals.proposalTarget}`,
                "Proposals",
                "Period target",
              ],
              [
                data.proposals.filter((row) => row.status === "Approved")
                  .length,
                "Ready in queue",
                "Approved proposals",
              ],
              [
                data.lifecycle.find((row) => row.stage === "Won")?.count || 0,
                "Clients won",
                "Current stage",
              ],
              [
                `${totals.onboardings}/${totals.onboardingTarget}`,
                "Onboarded",
                "Current month target",
              ],
            ].map(([value, label, note]) => (
              <div key={String(label)}>
                <small>{label}</small>
                <strong>{value}</strong>
                <em>{note}</em>
              </div>
            ))}
          </div>
        </Card>
        <Card
          title="3. OPERATIONAL HEALTH"
          aside={<small>SLA & accountability</small>}
        >
          <div className="ae-metric-grid">
            {[
              [totals.calls, "Total calls", pct(connectRate) + " connected"],
              [totals.connected, "Connections", "Recorded outcomes"],
              [totals.overdue, "Overdue", "Scheduled tasks"],
              [
                data.roster.reduce((sum, row) => sum + row.incomplete, 0),
                "Pending updates",
                "Current records",
              ],
              [escalations.length, "Escalations", "5 calendar days"],
            ].map(([value, label, note]) => (
              <div
                key={String(label)}
                className={
                  label === "Overdue" || label === "Escalations"
                    ? "ae-red-bg"
                    : ""
                }
              >
                <small>{label}</small>
                <strong>{value}</strong>
                <em>{note}</em>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="ae-two ae-alert-columns">
        <Card
          title="Critical Alerts & Overdue Escalations"
          icon={<Bell />}
          aside={
            <span className="ae-pill ae-red">
              {critical.length} urgent items
            </span>
          }
        >
          <div className="ae-alert-list">
            {data.alerts.slice(0, 5).map((row) => (
              <article className="ae-alert" key={row.id}>
                <i className={`ae-dot ${row.critical ? "ae-dot-red" : ""}`} />
                <div>
                  <h3>
                    {row.company}{" "}
                    <span
                      className={`ae-pill ${row.critical ? "ae-red" : "ae-purple"}`}
                    >
                      {row.reasons[0]}
                    </span>
                  </h3>
                  <p>
                    Assigned: {row.owner} · {row.contact}
                  </p>
                  <small>
                    {row.reasons.join(" · ")}
                    {row.dueAt ? " · " + displayTime(row.dueAt) : ""}
                  </small>
                </div>
                {queueActions(row)}
              </article>
            ))}
            {!data.alerts.length && <Empty>No active escalations.</Empty>}
          </div>
          <button
            className="ae-wide"
            onClick={() =>
              openQueue("Executive intervention queue", data.alerts)
            }
          >
            View All Alerts ({data.alerts.length})
          </button>
        </Card>
        <Card
          title="Fast-Track Closures & Proposal Approvals"
          icon={<CheckCircle2 />}
        >
          <p className="ae-muted">
            Recorded proposal reviews, dispatch readiness and qualified
            opportunities.
          </p>
          {data.proposals.slice(0, 4).map((proposal) => (
            <article className="ae-closure" key={proposal._id}>
              <h3>
                {proposal.company}{" "}
                <span
                  className={`ae-pill ${proposal.status === "Approved" ? "ae-green" : "ae-purple"}`}
                >
                  {proposal.status}
                </span>
              </h3>
              <p>{proposal.title}</p>
              <div className="ae-button-row">
                <small>
                  {proposal.priority === "High"
                    ? "High priority account"
                    : proposal.reference}
                </small>
                <Link
                  className="ae-primary"
                  to={`/admin/leads/${proposal.leadId}?tab=proposals`}
                >
                  {proposal.status === "In Review"
                    ? "Review & Authorize"
                    : proposal.status === "Approved"
                      ? "Prepare Dispatch"
                      : "View Sent Proposal"}
                </Link>
              </div>
            </article>
          ))}
          {!data.proposals.length && (
            <Empty>No proposal approvals waiting.</Empty>
          )}
          {data.qualified.slice(0, 2).map((company) => (
            <article className="ae-closure" key={company._id}>
              <h3>
                {company.name}{" "}
                <span className="ae-pill">Qualified opportunity</span>
              </h3>
              <p>
                Expected onboarding:{" "}
                {company.expectedAt
                  ? displayTime(company.expectedAt)
                  : "Not scheduled"}
              </p>
              <Link to={`/admin/leads/${company._id}`}>
                View Onboarding Plan ↗
              </Link>
            </article>
          ))}
        </Card>
      </div>
      <Card
        title="Company-Wide Sales Pipeline & Stage Velocity"
        icon={<Layers />}
        aside={
          <div className="ae-button-row">
            {data.outcomes.map((row) => (
              <button
                key={row.stage}
                onClick={() => setAccountStage(row.stage)}
              >
                {row.stage}: {row.count}
              </button>
            ))}
          </div>
        }
      >
        <p className="ae-muted">
          Current stage distribution and dwell time from recorded transitions.
          Click a stage to review its accounts.
        </p>
        <div className="ae-pipeline">
          {data.velocity.map((row, index) => (
            <button
              className={index === 5 ? "ae-stage-final" : ""}
              key={row.stage}
              onClick={() => setAccountStage(row.stage)}
            >
              <span className="ae-label">
                {row.stage === "New" ? "NEW LEADS" : row.stage.toUpperCase()}
              </span>
              <div>
                <strong>{row.count}</strong>
                <small> accounts</small>
              </div>
              <p>
                Avg dwell:{" "}
                <b>
                  {row.dwellDays === null
                    ? "Not recorded"
                    : row.dwellDays + " days"}
                </b>
              </p>
              <small>{row.recorded} with known stage dates</small>
              {row.stage === "Contacted" && data.stalledCount > 0 && (
                <span className="ae-pill ae-red">
                  {data.stalledCount} stalled &gt;48h
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="ae-quota">
          <div className="ae-line">
            <b>⚑ Proposal quota · selected period</b>
            <span>
              {totals.proposals} / {totals.proposalTarget} ·{" "}
              {pct(
                totals.proposalTarget
                  ? Math.round((totals.proposals / totals.proposalTarget) * 100)
                  : null,
              )}{" "}
              pacing
            </span>
          </div>
          <Progress value={totals.proposals} total={totals.proposalTarget} />
          <small>
            Targets use each active executive's working-day calendar and are not
            apportioned by territory.
          </small>
        </div>
      </Card>
      <Card
        title="Regional Manager Performance Command Matrix"
        icon={<Users />}
        aside={
          <button
            onClick={() =>
              exportCsv(`territory-matrix-${data.today}`, reportRows)
            }
          >
            Export Territory Matrix
          </button>
        }
      >
        <p className="ae-muted">
          Active reporting teams, current assignments, outreach and scheduled
          follow-up adherence.
        </p>
        <div className="ae-table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "Manager & territory",
                  "Team",
                  "Assigned",
                  "Calls / connect rate",
                  "Follow-up SLA today",
                  "Pending / stalled",
                  "Proposal quota",
                  "Execution status",
                  "Action",
                ].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.managerMatrix.map((row, index) => (
                <tr key={row._id}>
                  <td>
                    <div className="ae-person">
                      <span
                        style={{
                          background: ["#dce9ff", "#ede5ff", "#e5eeff"][
                            index % 3
                          ],
                        }}
                      >
                        {row.name
                          .split(" ")
                          .map((word) => word[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <div>
                        <b>{row.name}</b>
                        <small>
                          {row.territories.join(" · ") ||
                            "No territory recorded"}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>{row.team} reps</td>
                  <td>{row.assigned} cos</td>
                  <td>
                    {row.calls} calls
                    <small>
                      {row.connected} connected (
                      {pct(
                        row.calls
                          ? Math.round((row.connected / row.calls) * 100)
                          : null,
                      )}
                      )
                    </small>
                  </td>
                  <td>
                    <Progress
                      value={row.sla || 0}
                      total={100}
                      color={
                        row.sla !== null && row.sla < 80 ? "#ba1a1a" : "#004ac6"
                      }
                    />
                    <b>{pct(row.sla)}</b>
                  </td>
                  <td>
                    <span className="ae-pill">{row.pending} pending</span>{" "}
                    <span className="ae-pill ae-red">
                      {row.stalled} stalled
                    </span>
                  </td>
                  <td>
                    {row.proposals} / {row.proposalTarget}
                    <Progress
                      value={row.proposals}
                      total={row.proposalTarget}
                    />
                  </td>
                  <td>
                    <span
                      className={`ae-pill ${row.overdue || row.incomplete ? "ae-red" : "ae-blue"}`}
                    >
                      {row.overdue || row.incomplete
                        ? "Needs Attention"
                        : row.proposalTarget &&
                            row.proposals >= row.proposalTarget
                          ? "Target Achieved"
                          : "On Track"}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() =>
                        setDirective({
                          kind: "directive",
                          recipients: [
                            ...row.executives,
                            ...(row._id === "unassigned" ? [] : [row._id]),
                          ],
                          title: `Team review: ${row.name}`,
                        })
                      }
                    >
                      Send Directive
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.managerMatrix.length && (
          <Empty>No active managers or executives.</Empty>
        )}
      </Card>
      <div className="ae-two">
        <Card
          title="Multi-Channel Outreach Breakdown"
          icon={<MessageCircle />}
          aside={
            <small>
              Total:{" "}
              {totals.calls +
                totals.whatsapp +
                totals.email +
                totals.linkedinSent}{" "}
              recorded touches
            </small>
          }
        >
          <p className="ae-muted">
            Selected period activity. Delivery/read receipts require a connected
            provider and are not inferred.
          </p>
          <div className="ae-channel-grid">
            {[
              {
                name: "Direct Voice Calls",
                value: totals.calls,
                icon: <Phone />,
                note: `${totals.connected} connected · ${pct(connectRate)} connect rate`,
                color: "#004ac6",
              },
              {
                name: "WhatsApp Business",
                value: totals.whatsapp,
                icon: <MessageCircle />,
                note: "Manually confirmed sent messages",
                color: "#586377",
              },
              {
                name: "Corporate Email",
                value: totals.email,
                icon: <Mail />,
                note: "Manual confirmations + provider sends",
                color: "#632ecd",
              },
              {
                name: "LinkedIn Outreach",
                value: totals.linkedinSent,
                icon: <Users />,
                note: `${totals.linkedinAccepted} acceptance updates recorded`,
                color: "#2563eb",
              },
            ].map((channel) => (
              <div key={channel.name}>
                <header>
                  <span style={{ background: channel.color }}>
                    {channel.icon}
                  </span>
                  <b>{channel.name}</b>
                  <strong>{channel.value}</strong>
                </header>
                <small>{channel.note}</small>
                <Progress
                  value={channel.value}
                  total={Math.max(
                    1,
                    totals.calls,
                    totals.whatsapp,
                    totals.email,
                    totals.linkedinSent,
                  )}
                  color={channel.color}
                />
              </div>
            ))}
          </div>
        </Card>
        <Card
          title="Follow-up SLA Aging Buckets"
          icon={<Flag />}
          aside={
            <strong className="ae-score">
              {pct(data.health.rate)}
              <small>Selected-period on-time SLA</small>
            </strong>
          }
        >
          <p className="ae-muted">
            {data.health.overdue} current overdue tasks grouped by elapsed
            duration.
          </p>
          {data.health.aging.map((bucket, index) => (
            <div className="ae-aging" key={bucket.label}>
              <span>{bucket.label} overdue</span>
              <Progress
                value={bucket.count}
                total={data.health.overdue}
                color={["#586377", "#632ecd", "#ed6470", "#ba1a1a"][index]}
              />
              <b>{bucket.count} tasks</b>
            </div>
          ))}
          <div className="ae-quota">
            <span>In-app reminders for overdue account owners</span>
            <button
              disabled={!actors.length}
              onClick={() =>
                setDirective({
                  kind: "directive",
                  recipients: actors,
                  title: "Review overdue account follow-ups",
                })
              }
            >
              Remind Overdue Owners
            </button>
          </div>
          <button
            className="ae-wide"
            onClick={() =>
              openQueue(
                "Overdue contact follow-ups",
                data.queue.filter((row) =>
                  row.reasons.includes("Overdue follow-up"),
                ),
              )
            }
          >
            Review Overdue Contacts
          </button>
        </Card>
      </div>
      <div className="ae-two">
        <Card
          title="Contact Data Quality & Recovery"
          icon={<ShieldCheck />}
          aside={<span className="ae-pill">{recovery.length} contacts</span>}
        >
          <p className="ae-muted">
            Recorded recovery progress. External enrichment is not connected.
          </p>
          {data.recovery
            .filter((item) =>
              [
                "alternativeFound",
                "alternativeVerified",
                "emailAvailable",
                "decisionMaker",
              ].includes(item.key),
            )
            .map((item) => (
              <div className="ae-recovery-row" key={item.key}>
                <CheckCircle2 size={16} />
                <div>
                  <b>
                    {
                      (
                        {
                          alternativeFound: "Alternative Contacts Found",
                          alternativeVerified: "Alternative Number Verified",
                          emailAvailable: "Email Available",
                          decisionMaker: "Decision Maker Verified",
                        } as Record<string, string>
                      )[item.key]
                    }
                  </b>
                  <small>CRM checklist confirmations</small>
                </div>
                <strong>{item.count}</strong>
              </div>
            ))}
          <div className="ae-button-row ae-bottom">
            <span>{recovery.length} wrong-number recovery cases</span>
            <button
              onClick={() =>
                openQueue("Contact enrichment research queue", recovery)
              }
            >
              Assign Recovery Research
            </button>
          </div>
        </Card>
        <Card
          title="5-Day Unreached Client Escalation Board"
          icon={<Flag />}
          aside={
            <button
              className="ae-primary"
              disabled={!escalations.length}
              onClick={() => openQueue("Bulk escalation strategy", escalations)}
            >
              Bulk Strategy Shift
            </button>
          }
        >
          <p className="ae-muted">
            {escalations.length} contacts without a recorded direct connection
            for five calendar days.
          </p>
          <div className="ae-table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    "Enterprise client",
                    "Assigned rep",
                    "Touchpoints",
                    "Last outcome",
                    "Action",
                  ].map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {escalations.slice(0, 6).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <b>{row.company}</b>
                      <small>{row.contact}</small>
                    </td>
                    <td>{row.owner}</td>
                    <td>{row.attempts} logged</td>
                    <td>{row.callOutcome}</td>
                    <td>
                      <button
                        onClick={() =>
                          setAction({
                            kind: "research",
                            stateIds: [row.stateId!],
                          })
                        }
                      >
                        Enrich Contact
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!escalations.length && <Empty>No five-day escalations.</Empty>}
          <button
            className="ae-wide"
            onClick={() => openQueue("Unreached outreach review", unreached)}
          >
            Review Unreached Contacts ({unreached.length})
          </button>
        </Card>
      </div>
      <Card
        title="Pipeline Requirements & Client Acquisition Outlook"
        icon={<Briefcase />}
      >
        <p className="ae-muted">
          Current account pipeline and requirement counts. No revenue or
          financial yield is inferred from missing values.
        </p>
        <div className="ae-requirement-grid">
          <div>
            <small>Total requirements received</small>
            <strong>{data.requirements.positions} positions</strong>
            <p>
              Recorded, non-cancelled hiring mandates across the selected
              portfolio.
            </p>
          </div>
          <div>
            <small>Active pipeline requirements</small>
            <strong>{data.requirements.activePositions} positions</strong>
            <p>
              {data.requirements.active} mandates currently open or in sourcing.
            </p>
          </div>
          <div>
            <small>Positions fulfilled</small>
            <strong>{data.requirements.filled} filled</strong>
            <p>Confirmed fulfilment against recorded hiring mandates.</p>
          </div>
        </div>
        <div className="ae-chart ae-chart-wide">
          <ResponsiveContainer
            width="100%"
            height="100%"
            initialDimension={{ width: 600, height: 240 }}
          >
            <BarChart data={data.velocity}>
              <CartesianGrid vertical={false} stroke="#e5eeff" />
              <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} width={30} />
              <Tooltip />
              <Legend />
              <Bar
                name="Current accounts"
                dataKey="count"
                fill="#2563eb"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                name="Without critical alerts"
                dataKey="withoutCritical"
                fill="#a6bffc"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="ae-funnel">
          {data.funnel.map((item) => (
            <div key={item.label}>
              <small>{item.label}</small>
              <b>{item.count}</b>
            </div>
          ))}
        </div>
      </Card>
      <div className="ae-two ae-bottom-grid">
        <Card
          title="Executive Directives & Operational Audit Trail"
          icon={<Activity />}
          aside={
            <button
              onClick={() =>
                exportCsv(`executive-audit-${data.today}`, [
                  ["Time", "Actor", "Action", "Company", "Message"],
                  ...data.executiveAudit.map((event) => [
                    event.createdAt,
                    event.actor,
                    event.kind,
                    event.company || "",
                    event.message,
                  ]),
                ])
              }
            >
              Export System Logs
            </button>
          }
        >
          <input
            aria-label="Search audit trail"
            className="ae-audit-search"
            placeholder="Search actor, company or directive…"
            value={auditSearch}
            onChange={(event) => setAuditSearch(event.target.value)}
          />
          {data.executiveAudit
            .filter((event) =>
              `${event.actor} ${event.company || ""} ${event.message} ${event.kind}`
                .toLowerCase()
                .includes(auditSearch.toLowerCase()),
            )
            .map((event) => (
              <article key={event._id} className="ae-audit">
                <i className="ae-dot" />
                <div>
                  <h3>
                    {event.kind.replace(/-/g, " ")}
                    {event.company ? " · " + event.company : ""}
                  </h3>
                  <p>{event.message}</p>
                  <small>
                    {event.actor} · {displayTime(event.createdAt)}
                  </small>
                </div>
              </article>
            ))}
          {!data.executiveAudit.length && (
            <Empty>No executive interventions recorded.</Empty>
          )}
        </Card>
        <Card title="1-Click Executive Action Hub" icon={<Target />}>
          <p className="ae-muted">
            Review the details before confirming an administrative action.
          </p>
          <div className="ae-hub">
            <button onClick={() => setExportOpen(true)}>
              <Download size={15} /> Export Board Pack (Excel / PDF){" "}
              <ArrowUpRight size={14} />
            </button>
            <button onClick={() => setDirective({ kind: "directive" })}>
              <Mail size={15} /> Send Regional Directive{" "}
              <ArrowUpRight size={14} />
            </button>
            <button
              disabled={!data.queue.length}
              onClick={() =>
                openQueue("Rebalance territory workload", data.queue)
              }
            >
              <Users size={15} /> Rebalance Territory Workload{" "}
              <ArrowUpRight size={14} />
            </button>
            <button
              className="ae-primary"
              onClick={() =>
                setDirective({ kind: "meeting", title: "All-Hands BD Sync" })
              }
            >
              <CalendarDays size={15} /> Schedule All-Hands BD Sync{" "}
              <ArrowUpRight size={14} />
            </button>
            <button onClick={() => setSettingsOpen(true)}>
              <Settings size={15} /> Review CRM Targets & Rules
            </button>
          </div>
          <p className="ae-micro">
            <ShieldCheck size={13} /> Admin access · directives and
            interventions are recorded
          </p>
          <div className="ae-chart ae-trend">
            <ResponsiveContainer
              width="100%"
              height="100%"
              initialDimension={{ width: 300, height: 180 }}
            >
              <AreaChart data={data.trend}>
                <XAxis
                  dataKey="day"
                  tickFormatter={(value) => String(value).slice(5)}
                  tick={{ fontSize: 10 }}
                />
                <YAxis width={25} allowDecimals={false} />
                <Tooltip />
                <Area
                  dataKey="calls"
                  name="Recorded calls"
                  stroke="#2563eb"
                  fill="#dce9ff"
                />
                <Area
                  dataKey="connected"
                  name="Connected calls"
                  stroke="#009c76"
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      {directive && (
        <ExecutiveDirective
          data={data}
          action={directive}
          onClose={() => setDirective(null)}
          onSaved={saved}
        />
      )}
      {action && (
        <ManagerActionDialog
          data={data}
          action={action}
          onClose={() => setAction(null)}
          onSaved={saved}
        />
      )}
      {queue && !action && !directive && (
        <TerritoryModal title={queue.title} onClose={() => setQueue(null)}>
          <div className="ae-dialog-body">
            <p>
              {queue.rows.length} contacts / accounts in the current portfolio.
            </p>
            <div className="ae-button-row">
              <button
                onClick={() =>
                  exportCsv("executive-queue-" + data.today, [
                    ["Company", "Contact", "Executive", "Reasons", "Due"],
                    ...queue.rows.map((row) => [
                      row.company,
                      row.contact,
                      row.owner,
                      row.reasons.join("; "),
                      row.dueAt || "",
                    ]),
                  ])
                }
              >
                Export Queue
              </button>
              <button
                disabled={!queue.rows.length}
                onClick={() =>
                  notifyOwners(queue.rows, "Executive account intervention")
                }
              >
                Send Directive
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
                      setAction({ kind: "research", stateIds: selected })
                    }
                  >
                    Assign Research
                  </button>
                  <button
                    onClick={() =>
                      setAction({ kind: "remind", stateIds: selected })
                    }
                  >
                    Remind Reps
                  </button>
                </>
              )}
            </div>
            {selected.length > 100 && (
              <p className="ae-error">
                Choose up to 100 contacts per bulk action.
              </p>
            )}
            {queue.rows.map((row) => (
              <article className="ae-queue-item" key={row.id}>
                {row.stateId && (
                  <label>
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
                    />{" "}
                    {row.company} · {row.contact}
                  </label>
                )}
                <h3>
                  {row.company} · {row.owner}
                </h3>
                <p>{row.reasons.join(" · ") || row.callOutcome}</p>
                <p>
                  {row.nextAction || "Next action not recorded"} ·{" "}
                  {row.dueAt ? displayTime(row.dueAt) : "Not scheduled"}
                </p>
                {queueActions(row)}
              </article>
            ))}
            {!queue.rows.length && <Empty />}
          </div>
        </TerritoryModal>
      )}
      {accountStage !== null && (
        <TerritoryModal
          title={
            accountStage ? `${accountStage} accounts` : "Company portfolio"
          }
          onClose={() => setAccountStage(null)}
        >
          <div className="ae-dialog-body">
            {stageAccounts.map((company) => (
              <Link
                className="ae-account-link"
                key={company._id}
                to={`/admin/leads/${company._id}`}
              >
                <b>{company.name}</b>
                <span>
                  {company.stage} · {company.priority} priority ↗
                </span>
              </Link>
            ))}
            {!stageAccounts.length && <Empty />}
          </div>
        </TerritoryModal>
      )}
      {settingsOpen && (
        <TerritoryModal
          title="CRM Targets & Monitoring Rules"
          onClose={() => setSettingsOpen(false)}
        >
          <MonitoringSettings
            config={data.config}
            employees={data.employees}
            onSaved={() => setRevision((value) => value + 1)}
          />
        </TerritoryModal>
      )}
      {exportOpen && (
        <TerritoryModal
          title="Export Executive Board Report"
          onClose={() => setExportOpen(false)}
        >
          <div className="ae-dialog-body">
            <p>
              Reporting period: {data.range.from} – {data.range.to}. Live
              queues: {data.today}. Exports use the current filters.
            </p>
            <button onClick={exportExcel}>
              Download Excel Board Pack (.xlsx)
            </button>
            <button
              onClick={() =>
                exportCsv("executive-board-report-" + data.today, reportRows)
              }
            >
              Download CSV Report
            </button>
            <button
              onClick={() => {
                setExportOpen(false);
                requestAnimationFrame(() => window.print());
              }}
            >
              Print / Save as PDF
            </button>
          </div>
        </TerritoryModal>
      )}
    </div>
  );
}
