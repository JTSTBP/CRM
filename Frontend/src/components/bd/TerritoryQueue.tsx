import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  Columns3,
  Download,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Search,
  ListChecks,
} from "lucide-react";
import type { Dashboard } from "./SmartBDDashboard";
import { API_BASE_URL } from "../../config";
import { displayTime } from "./workspaceApi";

export type TerritoryRow = Dashboard["queue"][number];
export interface QueueFilters {
  search: string;
  urgency: string;
  page: number;
}
interface Props {
  data: Dashboard;
  filters: QueueFilters;
  onFilter: (changes: Partial<QueueFilters>) => void;
  onActivity: (row: TerritoryRow, call?: boolean) => void;
  onEmail: (row: TerritoryRow) => void;
  onBulk: (ids: string[]) => void;
}
const optionalColumns = [
  "Call outcome",
  "WhatsApp",
  "Email",
  "LinkedIn",
  "Lifecycle stage",
  "Last contacted",
  "Next follow-up",
];
const initial = (name?: string) =>
  (name || "Contact")
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export default function TerritoryQueue({
  data,
  filters,
  onFilter,
  onActivity,
  onEmail,
  onBulk,
}: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [columns, setColumns] = useState(optionalColumns);
  const [showColumns, setShowColumns] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setSelected([]);
  }, [filters.page, filters.search, filters.urgency]);
  useEffect(() => {
    setSelected((values) =>
      values.filter((id) => data.queue.some((row) => row._id === id)),
    );
  }, [data.queue]);
  const show = (column: string) => columns.includes(column);
  const tabs = [
    ["All", ""],
    ["Due Today", "Due today"],
    ["Busy / No Answer", "Busy / No Answer"],
    ["Wrong Number", "Wrong Number recovery"],
    ["Stalled >48h", "Lifecycle stalled"],
    ["Overdue", "Overdue follow-up"],
  ];
  function toggle(id: string) {
    setSelected((values) =>
      values.includes(id)
        ? values.filter((value) => value !== id)
        : [...values, id],
    );
  }
  async function exportQueue() {
    setExporting(true);
    setError("");
    try {
      const params = new URLSearchParams({
        search: filters.search,
        urgency: filters.urgency,
        ...(selected.length ? { ids: selected.join(",") } : {}),
      });
      const response = await fetch(
        `${API_BASE_URL}/api/bd-workspace/queue-export?${params}`,
        { headers: { "x-auth-token": localStorage.getItem("token") || "" } },
      );
      if (!response.ok) throw new Error("Could not export the queue.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `bd-followups-${data.today}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }
  return (
    <section id="bd-action-queue" className="tf-card scroll-mt-5">
      <div className="tf-card-header">
        <div className="tf-heading">
          <CalendarClock size={18} />
          <div>
            <h2>Today's Client Follow-ups &amp; Action Queue</h2>
            <p className="tf-muted mt-1">
              Execute your daily calls, multichannel messaging, and lifecycle
              progression.
            </p>
          </div>
        </div>
        <span className="tf-chip">{data.queueCount} contacts in queue</span>
      </div>
      <div className="tf-tabs mb-3">
        {tabs.map(([label, value]) => (
          <button
            key={label}
            type="button"
            onClick={() => onFilter({ urgency: value, page: 1 })}
            className={`tf-tab ${filters.urgency === value ? "is-active" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="tf-queue-top">
        <div className="tf-queue-search">
          <Search
            size={14}
            className="absolute left-3 top-2.5 text-slate-500"
          />
          <input
            aria-label="Filter follow-up queue"
            placeholder="Filter company, contact, or phone…"
            value={filters.search}
            onChange={(event) =>
              onFilter({ search: event.target.value, page: 1 })
            }
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="tf-columns">
            <button
              type="button"
              aria-expanded={showColumns}
              onClick={() => setShowColumns(!showColumns)}
              className="tf-button bg-white"
            >
              <Columns3 size={13} />
              Columns
            </button>
            {showColumns && (
              <div>
                {optionalColumns.map((column) => (
                  <label key={column}>
                    <input
                      type="checkbox"
                      checked={show(column)}
                      onChange={() =>
                        setColumns((values) =>
                          values.includes(column)
                            ? values.filter((value) => value !== column)
                            : [...values, column],
                        )
                      }
                    />
                    {column}
                  </label>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={!selected.length}
            onClick={() => onBulk(selected)}
            className="tf-button bg-white"
          >
            <ListChecks size={13} />
            Bulk Action ({selected.length})
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void exportQueue()}
            className="tf-button primary"
          >
            <Download size={13} />
            {exporting ? "Exporting…" : "Export Queue"}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="tf-status-message tf-error mt-3">
          {error}
        </p>
      )}
      <div className="tf-table-wrap">
        <table className="tf-table">
          <thead>
            <tr>
              <th>
                <input
                  aria-label="Select all contacts on this page"
                  type="checkbox"
                  checked={
                    Boolean(data.queue.length) &&
                    data.queue.every((row) => selected.includes(row._id))
                  }
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? data.queue.map((row) => row._id)
                        : [],
                    )
                  }
                />
              </th>
              <th>Company &amp; Contact Person</th>
              {show("Call outcome") && <th>Last Call Outcome</th>}
              {show("WhatsApp") && <th>WhatsApp</th>}
              {show("Email") && <th>Email</th>}
              {show("LinkedIn") && <th>LinkedIn</th>}
              {show("Lifecycle stage") && <th>Lifecycle Stage</th>}
              {show("Last contacted") && <th>Last Contacted</th>}
              {show("Next follow-up") && <th>Next Follow-Up</th>}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.queue.map((row) => (
              <tr key={row._id}>
                <td>
                  <input
                    aria-label={`Select ${row.contact.name || row.leadId.company_name}`}
                    type="checkbox"
                    checked={selected.includes(row._id)}
                    onChange={() => toggle(row._id)}
                  />
                </td>
                <td>
                  <div className="tf-table-company">
                    <span className="tf-avatar">
                      {initial(row.leadId.company_name)}
                    </span>
                    <div>
                      <Link to={`/bd/leads?openLead=${row.leadId._id}`}>
                        <strong>{row.leadId.company_name}</strong>
                      </Link>
                      <Link
                        className="text-[#434655]"
                        to={`/bd/contacts/${row.pocId}`}
                      >
                        {row.contact.name || "Contact"}
                        {row.contact.designation
                          ? ` · ${row.contact.designation}`
                          : ""}
                      </Link>
                      <p className="tf-small">
                        {row.contact.phone || "Phone not recorded"}
                      </p>
                      {row.contact.email && (
                        <p className="tf-small">{row.contact.email}</p>
                      )}
                    </div>
                  </div>
                </td>
                {show("Call outcome") && (
                  <td>
                    <span
                      className={`tf-chip ${["Wrong Number", "No Answer"].includes(row.callOutcome || "") ? "gray" : ""}`}
                    >
                      {row.callOutcome || "Not recorded"}
                    </span>
                    {row.daysUnreached !== null && (
                      <p className="tf-small mt-1">
                        {row.daysUnreached} days unreached
                      </p>
                    )}
                  </td>
                )}
                {show("WhatsApp") && (
                  <td>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle size={11} />
                      {row.whatsapp}
                    </span>
                  </td>
                )}
                {show("Email") && (
                  <td>
                    <span className="inline-flex items-center gap-1">
                      <Mail size={11} />
                      {row.email}
                    </span>
                  </td>
                )}
                {show("LinkedIn") && (
                  <td>
                    <span className="tf-chip purple">{row.linkedin}</span>
                  </td>
                )}
                {show("Lifecycle stage") && (
                  <td>
                    <Link
                      to={`/bd/leads?openLead=${row.leadId._id}`}
                      className="tf-chip"
                    >
                      {row.leadId.stage}
                    </Link>
                  </td>
                )}
                {show("Last contacted") && (
                  <td>{displayTime(row.lastCallAt || row.lastActivityAt)}</td>
                )}
                {show("Next follow-up") && (
                  <td
                    className={
                      row.priority === "Urgent" ? "text-[#ba1a1a]" : ""
                    }
                  >
                    {displayTime(row.dueAt)}
                    <p className="tf-small mt-1 max-w-36">
                      {row.nextAction || "Next action needed"}
                    </p>
                  </td>
                )}
                <td>
                  <div className="tf-row-actions">
                    <button
                      type="button"
                      title="Record call"
                      aria-label={`Record call for ${row.contact.name}`}
                      className="tf-icon-button"
                      onClick={() => onActivity(row, true)}
                    >
                      <Phone size={13} />
                    </button>
                    <button
                      type="button"
                      title="Update communication"
                      aria-label={`Update communication for ${row.contact.name}`}
                      className="tf-icon-button"
                      onClick={() => onActivity(row)}
                    >
                      <MessageCircle size={13} />
                    </button>
                    <button
                      type="button"
                      title="Send email"
                      aria-label={`Send email to ${row.contact.name}`}
                      className="tf-icon-button"
                      onClick={() => onEmail(row)}
                    >
                      <Mail size={13} />
                    </button>
                    <Link
                      title="Open contact details"
                      aria-label={`Open details for ${row.contact.name}`}
                      className="tf-icon-button"
                      to={`/bd/contacts/${row.pocId}`}
                    >
                      <MoreHorizontal size={14} />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.queue.length && (
        <p className="tf-empty">
          No matching contacts. Use Quick Add Activity to start tracking an
          existing company contact.
        </p>
      )}
      <div className="tf-table-footer">
        <span>
          Showing {data.queue.length ? (data.page - 1) * 20 + 1 : 0}–
          {Math.min(data.page * 20, data.queueCount)} of {data.queueCount}{" "}
          contacts
        </span>
        <div className="flex gap-2">
          <button
            className="tf-button"
            disabled={filters.page <= 1}
            onClick={() => onFilter({ page: filters.page - 1 })}
          >
            Previous
          </button>
          <span className="tf-button primary">{data.page}</span>
          <button
            className="tf-button"
            disabled={filters.page >= data.pages}
            onClick={() => onFilter({ page: filters.page + 1 })}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
