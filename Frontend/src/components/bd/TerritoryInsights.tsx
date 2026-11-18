import { Link } from "react-router-dom";
import {
  BarChart3,
  ChevronRight,
  Linkedin,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Dashboard } from "./SmartBDDashboard";
import { displayTime } from "./workspaceApi";

interface Props {
  data: Dashboard;
  period: string;
  onPeriod: (value: string) => void;
  onFilter: (value: string) => void;
  onContact: (lead: string, poc: string) => void;
  onReview: (lead: string) => void;
}
const stages = [
  "New",
  "Contacted",
  "Proposal Sent",
  "Negotiation",
  "Won",
  "Onboarded",
];

export default function TerritoryInsights({
  data,
  period,
  onPeriod,
  onFilter,
  onContact,
  onReview,
}: Props) {
  const count = (key: string) => data.alertCounts[key] || 0;
  const connections = (status: string) =>
    data.linkedinPipeline
      ?.filter((item) => item._id === status)
      .reduce((sum, item) => sum + item.count, 0) || 0;
  const today = new Date(data.today + "T12:00:00+05:30");
  const weekday = today.getUTCDay() || 7;
  const weekStart = new Date(today.getTime() - (weekday - 1) * 86400000)
    .toISOString()
    .slice(0, 10);
  const trend = data.trend.filter((day) =>
    period === "today"
      ? day.day === data.today
      : period === "week"
        ? day.day >= weekStart
        : day.day.startsWith(data.today.slice(0, 7)),
  );
  const accepted = data.businessOutcomes
    .filter(
      (item) => item._id.kind === "proposal" && item._id.status === "Accepted",
    )
    .reduce((sum, item) => sum + item.count, 0);
  const proposalTotal = data.businessOutcomes
    .filter((item) => item._id.kind === "proposal")
    .reduce((sum, item) => sum + item.count, 0);
  const onboardingTotal = data.businessOutcomes
    .filter((item) => item._id.kind === "onboarding")
    .reduce((sum, item) => sum + item.count, 0);
  return (
    <>
      <section id="bd-recovery" className="tf-mini-grid scroll-mt-5">
        <article className="tf-card tf-mini">
          <div className="flex items-center justify-between">
            <h3>Comms Completion</h3>
            <span className="tf-chip">
              {data.completionRate === null ? "—" : `${data.completionRate}%`}
            </span>
          </div>
          <p className="tf-small">
            Tracking completion of multichannel activity updates.
          </p>
          {(data.dailyChecklist || []).map((item) => (
            <div key={item.label}>
              <div className="tf-metric-line">
                <span>{item.label}</span>
                <strong>
                  {item.complete}/{item.total}
                </strong>
              </div>
              <div className="tf-progress !h-1">
                <span
                  style={{
                    width: `${item.total ? Math.min(100, (item.complete / item.total) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
          <button
            className="tf-button"
            onClick={() => onFilter("Pending communication update")}
          >
            Complete {data.totals.incomplete} Pending Updates{" "}
            <ChevronRight size={12} />
          </button>
        </article>
        <article className="tf-card tf-mini">
          <div className="flex items-center justify-between gap-1">
            <h3>Callbacks &amp; Retries</h3>
            <span className="tf-chip">
              {(data.callbackStats?.busy || 0) +
                (data.callbackStats?.noAnswer || 0)}{" "}
              in queue
            </span>
          </div>
          <div className="tf-stats-row">
            <div>
              <strong>{data.callbackStats?.busy || 0}</strong>
              <small>Busy</small>
            </div>
            <div>
              <strong>{data.callbackStats?.noAnswer || 0}</strong>
              <small>No Answer</small>
            </div>
            <div className="text-red-600">
              <strong>{data.callbackStats?.overdue || 0}</strong>
              <small>Overdue</small>
            </div>
          </div>
          {data.scheduledTasks
            .filter((task) => /callback|retry/i.test(task.type || ""))
            .slice(0, 2)
            .map((task) => (
              <div className="tf-inset !p-2" key={task._id}>
                <strong className="text-[11px]">
                  {task.lead_id?.company_name || task.title}
                </strong>
                <p className="tf-small">{displayTime(task.due_date)}</p>
              </div>
            ))}
          <button
            className="tf-button"
            onClick={() => onFilter("Busy / No Answer")}
          >
            Manage Retry Matrix
          </button>
        </article>
        <article className="tf-card tf-mini">
          <div className="flex items-center justify-between gap-2">
            <h3>5-Day Unreached</h3>
            <span className="tf-chip red">
              {count("Five-day escalation")} contacts
            </span>
          </div>
          <p className="tf-small">
            No successful contact recorded within five calendar days.
          </p>
          {(data.priorityActions || data.queue)
            .filter((row) => row.reasons.includes("Five-day escalation"))
            .slice(0, 2)
            .map((row) => (
              <div key={row._id} className="tf-inset !p-2">
                <strong>{row.leadId.company_name}</strong>
                <p className="tf-small">
                  {row.daysUnreached} days · {row.contact.name}
                </p>
                <button
                  className="mt-1 text-[11px] text-blue-700"
                  onClick={() => onContact(row.leadId._id, row.pocId)}
                >
                  Update contact strategy
                </button>
              </div>
            ))}
          <button
            className="tf-button danger"
            onClick={() => onFilter("Five-day escalation")}
          >
            Review All Unreached ({count("Five-day escalation")})
          </button>
        </article>
        <article className="tf-card tf-mini">
          <div className="flex items-center justify-between gap-2">
            <h3>Wrong Number Fix</h3>
            <span className="tf-chip">
              {count("Wrong Number recovery")} active
            </span>
          </div>
          <p className="tf-small">
            Recover contact details and verify alternative outreach.
          </p>
          <ul className="space-y-2 text-[11px] text-[#434655]">
            {[
              "Alternative phone verified",
              "Decision-maker identified",
              "Email available and contacted",
              "LinkedIn request reviewed",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full border border-[#737686]" />
                {item}
              </li>
            ))}
          </ul>
          <button
            className="tf-button"
            onClick={() => onFilter("Wrong Number recovery")}
          >
            <Wrench size={12} />
            Update Contact Details
          </button>
        </article>
      </section>
      <section className="tf-split !grid-cols-1 lg:!grid-cols-[1.7fr_1fr]">
        <article id="bd-pipeline" className="tf-card scroll-mt-5">
          <div className="tf-card-header">
            <div>
              <h3>Lead Lifecycle Pipeline Health</h3>
              <p className="tf-small mt-1">
                Active distribution across enterprise sales stages
              </p>
            </div>
            <span className="tf-chip">
              Total: {data.portfolioCompanies || 0} leads
            </span>
          </div>
          <div className="tf-pipeline">
            {stages.map((stage) => (
              <Link
                key={stage}
                to={`/bd/leads?stage=${encodeURIComponent(stage)}`}
              >
                <small>{stage}</small>
                <strong>
                  {data.lifecycle.find((item) => item._id === stage)?.count ||
                    0}
                </strong>
              </Link>
            ))}
          </div>
          <div className="tf-inset my-3 !bg-[#dce9ff] flex gap-2">
            <ShieldAlert size={16} className="shrink-0 text-blue-700" />
            <div>
              <strong className="text-xs">
                {data.stalledCount} leads in Contacted over 48 hours
              </strong>
              <p className="tf-small">
                Record a delay reason and next action. Advance a stage when the
                business event is confirmed.
              </p>
            </div>
          </div>
          <table className="w-full text-left text-[11px]">
            <thead className="text-[10px] uppercase text-[#434655]">
              <tr>
                <th className="py-2">Lead / Company</th>
                <th>Days in stage</th>
                <th>Reason for delay</th>
                <th>Quick action</th>
              </tr>
            </thead>
            <tbody>
              {data.stalled.slice(0, 3).map((lead) => (
                <tr key={lead._id} className="border-t border-[#eff4ff]">
                  <td className="py-3 pr-2">
                    <Link to={`/bd/leads?openLead=${lead._id}`}>
                      {lead.company_name}
                    </Link>
                  </td>
                  <td>
                    <span className="tf-chip red">
                      {Math.floor(
                        (Date.now() - +new Date(lead.since)) / 86400000,
                      )}{" "}
                      days
                    </span>
                  </td>
                  <td className="max-w-36 px-2">
                    {lead.review?.data.reason || "Reason needed"}
                  </td>
                  <td>
                    <button
                      className="tf-button"
                      onClick={() => onReview(lead._id)}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.stalled.length && (
            <p className="tf-empty">
              No stalled opportunities with a recorded stage-entry time.
            </p>
          )}
          <button
            className="tf-button mt-3 w-full"
            onClick={() => onFilter("Lifecycle stalled")}
          >
            View all stalled contact actions
          </button>
        </article>
        <article className="tf-card flex flex-col">
          <div className="tf-card-header">
            <div className="tf-heading">
              <Linkedin size={17} />
              <h3>LinkedIn Pipeline Tracker</h3>
            </div>
            <span className="tf-chip purple">
              {connections("Accepted")} accepted
            </span>
          </div>
          <div className="tf-stats-row mb-4">
            {[
              ["Sent", connections("Sent")],
              ["Pending", connections("Pending")],
              ["Accepted", connections("Accepted")],
              ["Rejected", connections("Rejected")],
            ].map(([label, value]) => (
              <div key={label}>
                <strong>{value}</strong>
                <small>{label}</small>
              </div>
            ))}
          </div>
          <p className="tf-small mb-2 font-semibold uppercase">
            Ready for a personal follow-up
          </p>
          {(data.linkedinAcceptedContacts || []).map((row) => (
            <div key={row._id} className="tf-action mb-2">
              <span className="tf-avatar !h-7 !w-7 !text-[10px]">
                {row.contact.name
                  ?.split(" ")
                  .map((word) => word[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <div className="tf-action-main">
                <strong className="text-xs">{row.contact.name}</strong>
                <p className="tf-small">{row.leadId.company_name}</p>
              </div>
              <button
                className="tf-button purple"
                onClick={() => onContact(row.leadId._id, row.pocId)}
              >
                Pitch Now
              </button>
            </div>
          ))}
          {!data.linkedinAcceptedContacts?.length && (
            <p className="tf-empty">
              Accepted connections will appear here for a personalized
              follow-up.
            </p>
          )}
          <button
            className="tf-button mt-auto w-full"
            onClick={() => onFilter("LinkedIn pending")}
          >
            Open LinkedIn Campaign View <ChevronRight size={12} />
          </button>
        </article>
      </section>
      <section id="bd-analytics" className="tf-card scroll-mt-5">
        <div className="tf-card-header">
          <div>
            <h2>BD Performance Analytics &amp; Compliance Trends</h2>
            <p className="tf-muted mt-1">
              Review activity, conversion velocity, business results, and
              process compliance.
            </p>
          </div>
          <div className="tf-tabs">
            {[
              ["Today", "today"],
              ["This Week", "week"],
              ["This Month", "month"],
            ].map(([label, value]) => (
              <button
                key={value}
                className={`tf-tab ${period === value ? "is-active" : ""}`}
                onClick={() => onPeriod(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="tf-analytics">
          <div>
            <h3 className="mb-3 flex items-center gap-2">
              <BarChart3 size={15} />
              Outreach &amp; business volume
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend}>
                  <CartesianGrid vertical={false} stroke="#e5eeff" />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(value) => String(value).slice(5)}
                    tick={{ fontSize: 10, fill: "#434655" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: "#434655" }}
                    width={25}
                  />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="calls" fill="#2563eb" radius={[3, 3, 0, 0]} />
                  <Bar
                    dataKey="proposals"
                    fill="#7d4ce7"
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey="onboardings"
                    fill="#b4c5ff"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="tf-small">
              Selected period: Asia/Kolkata reporting dates
            </p>
          </div>
          <div>
            <h3 className="mb-4">Proposal Outcome Funnel (All Recorded)</h3>
            {[
              ["Proposals recorded", proposalTotal],
              ["Accepted proposals", accepted],
              ["Verified onboardings", onboardingTotal],
            ].map(([label, value]) => (
              <div className="mb-4" key={label}>
                <div className="tf-metric-line">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
                <div className="tf-progress">
                  <span
                    style={{
                      width: `${proposalTotal ? Math.min(100, (Number(value) / proposalTotal) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            <p className="tf-small">Proposal-to-onboarding conversion</p>
            <strong className="text-xl text-[#004ac6]">
              {data.onboardingConversion === null
                ? "—"
                : `${data.onboardingConversion}%`}
            </strong>
          </div>
          <div>
            <h3 className="mb-4">Compliance &amp; Conversion</h3>
            {[
              ["On-time follow-ups", data.followupCompliance],
              ["Communication completion", data.completionRate],
              ["Lead-to-proposal", data.proposalConversion],
              ["Proposal-to-onboarding", data.onboardingConversion],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between gap-3 border-b border-[#e5eeff] py-3 text-xs"
              >
                <span>{label}</span>
                <strong className="text-[#004ac6]">
                  {value === null ? "—" : `${value}%`}
                </strong>
              </div>
            ))}
            <p className="tf-small mt-3">
              Current compliance and all recorded business conversions.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
