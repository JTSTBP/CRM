import { useMemo, useState } from "react";
import {
  Activity,
  CheckSquare,
  MessageSquare,
  Phone,
  Search,
} from "lucide-react";
import { displayTime, type ContactWorkspace } from "../bd/workspaceApi";
import { webLink, type ContactData } from "./contactTypes";

interface TimelineItem {
  id: string;
  type: string;
  title: string;
  body: string;
  date: string;
  attachment?: string;
}

export default function ContactTimeline({
  data,
  workspace,
  compact = false,
  onMore,
  onOlder,
  historyLoading,
}: {
  data: ContactData;
  workspace: ContactWorkspace | null;
  compact?: boolean;
  onMore?: () => void;
  onOlder?: () => void;
  historyLoading?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All touchpoints");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const items = useMemo<TimelineItem[]>(
    () =>
      [
        ...data.remarks.map((r) => ({
          id: `remark-${r._id}`,
          type: "Remarks",
          title: `Remark · ${r.profile?.name || "CRM user"}`,
          body: r.content || "Attachment",
          date: r.created_at,
          attachment: webLink(r.fileUrl || r.voiceUrl),
        })),
        ...data.tasks.map((t) => ({
          id: `task-${t._id}`,
          type: "Tasks",
          title: t.title,
          body: `${t.completed ? "Completed" : "Pending"} · Due ${displayTime(t.due_date)}${t.description ? ` · ${t.description}` : ""}`,
          date: t.created_at,
        })),
        ...data.calls.map((c) => ({
          id: `call-${c._id}`,
          type: "Calls",
          title: `Call · ${c.stage}`,
          body: [c.remarks, c.device].filter(Boolean).join(" · "),
          date: c.timestamp,
        })),
        ...data.activities
          .filter((a) => a.type !== "Call Logged")
          .map((a) => ({
            id: `activity-${a._id}`,
            type: "Company activity",
            title: a.type,
            body: [
              a.description,
              ...Object.entries(a.metadata || {})
                .filter(
                  ([key]) =>
                    !["pocId", "leadId", "_id", "__v", "taskId"].includes(key),
                )
                .map(
                  ([key, value]) =>
                    `${key.replace(/_/g, " ")}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`,
                ),
            ].join(" · "),
            date: a.timestamp,
          })),
        ...(workspace?.history || []).map((e) => ({
          id: `event-${e._id}`,
          type: "Communication",
          title: `${e.kind.replace(/-/g, " ")} · ${e.actorId?.name || "CRM user"}`,
          body:
            [
              e.data.title,
              e.data.remarks,
              e.data.reason,
              e.data.strategy,
              e.data.nextAction,
              ...["callOutcome", "whatsapp", "email", "linkedin"]
                .filter((key) => e.data[key])
                .map((key) => `${key}: ${String(e.data[key])}`),
            ]
              .filter(Boolean)
              .map(String)
              .join(" · ") || "Confirmed CRM update",
          date: e.createdAt,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [data, workspace],
  );
  const visible = items.filter(
    (item) =>
      (filter === "All touchpoints" || item.type === filter) &&
      `${item.title} ${item.body}`.toLowerCase().includes(search.toLowerCase()),
  );
  const displayed = compact ? visible.slice(0, 3) : visible;
  return (
    <section className="cc-card cc-timeline">
      <header className="cc-section-heading">
        <h2>
          <Activity size={16} /> Communication timeline
        </h2>
        <span className="cc-tag">{items.length} records</span>
      </header>
      {!compact && (
        <div className="cc-timeline-filters">
          <label className="cc-search">
            <Search size={14} />
            <input
              aria-label="Search contact activity"
              placeholder="Search activities…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Filter contact activity"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {[
              "All touchpoints",
              "Calls",
              "Tasks",
              "Remarks",
              "Communication",
              "Company activity",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <button
            className="cc-button"
            onClick={() =>
              setCollapsed(
                collapsed.size ? new Set() : new Set(items.map((i) => i.id)),
              )
            }
          >
            {collapsed.size ? "Expand all" : "Collapse all"}
          </button>
        </div>
      )}
      <div className="cc-timeline-list">
        {displayed.map((item) => (
          <article key={item.id} className="cc-timeline-item">
            <span className="cc-timeline-dot">
              {item.type === "Calls" ? (
                <Phone size={14} />
              ) : item.type === "Tasks" ? (
                <CheckSquare size={14} />
              ) : item.type === "Remarks" ? (
                <MessageSquare size={14} />
              ) : (
                <Activity size={14} />
              )}
            </span>
            <div className="cc-inset">
              <button
                className="cc-timeline-title"
                aria-expanded={!collapsed.has(item.id)}
                onClick={() =>
                  setCollapsed((current) => {
                    const next = new Set(current);
                    if (next.has(item.id)) next.delete(item.id);
                    else next.add(item.id);
                    return next;
                  })
                }
              >
                {item.title}
              </button>
              <p className="cc-micro">
                {displayTime(item.date)} · {item.type}
              </p>
              {!collapsed.has(item.id) && (
                <>
                  <p className="cc-muted cc-prewrap">{item.body}</p>
                  {"attachment" in item && item.attachment && (
                    <a href={item.attachment} target="_blank" rel="noreferrer">
                      Open attachment
                    </a>
                  )}
                </>
              )}
            </div>
          </article>
        ))}
      </div>
      {!displayed.length && (
        <p className="cc-empty">No matching activity recorded.</p>
      )}
      {compact && onMore && (
        <button className="cc-text-button" onClick={onMore}>
          View all activity
        </button>
      )}
      {!compact &&
        onOlder &&
        workspace &&
        workspace.history.length < workspace.historyTotal && (
          <button
            className="cc-button mt-3"
            disabled={historyLoading}
            onClick={onOlder}
          >
            {historyLoading ? "Loading…" : "Load older communication records"}
          </button>
        )}
    </section>
  );
}
