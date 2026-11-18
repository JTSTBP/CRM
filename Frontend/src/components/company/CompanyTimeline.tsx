import { useEffect, useState } from "react";
import { History, Search } from "lucide-react";
import { workspaceApi, displayTime } from "../bd/workspaceApi";
import { webLink } from "../contacts/contactTypes";
import type { CompanyTimeline as TimelineData } from "./companyTypes";
export default function CompanyTimeline({
  leadId,
  initial,
  compact = false,
  onMore,
}: {
  leadId: string;
  initial: TimelineData;
  compact?: boolean;
  onMore?: () => void;
}) {
  const [result, setResult] = useState(initial),
    [filter, setFilter] = useState("All"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    setResult(initial);
  }, [initial]);
  useEffect(() => {
    if (compact) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      workspaceApi<TimelineData>(
        `/company/${leadId}/timeline?${new URLSearchParams({ type: filter, search, page: String(page) })}`,
        "GET",
        undefined,
        controller.signal,
      )
        .then(setResult)
        .catch((err) => {
          if (!controller.signal.aborted) setError(err.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [leadId, compact, filter, search, page, initial]);
  return (
    <section className="co-card">
      <header className="co-section-head">
        <h2>
          <History size={18} />
          Recent Activity & Governance Log
        </h2>
        {compact ? (
          <button className="co-text" onClick={onMore}>
            View all activity →
          </button>
        ) : (
          <span className="co-badge">{result.total} records</span>
        )}
      </header>
      {!compact && (
        <div className="co-timeline-controls">
          <label className="co-search">
            <Search size={15} />
            <input
              aria-label="Search company timeline"
              placeholder="Search activity…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <select
            aria-label="Filter company timeline"
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setPage(1);
            }}
          >
            {[
              "All",
              "Calls",
              "WhatsApp",
              "Email",
              "LinkedIn",
              "Proposals",
              "Mandates",
              "Notes",
              "Tasks",
              "Company",
              "Communication",
            ].map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </div>
      )}
      {error && (
        <p role="alert" className="co-error">
          {error}
        </p>
      )}
      <div className="co-timeline" aria-busy={loading}>
        {(compact ? initial.items.slice(0, 5) : result.items).map((item) => (
          <article key={item.id}>
            <span className="co-timeline-dot">
              <History size={15} />
            </span>
            <div className="co-inset">
              <header>
                <strong>{item.title.replace(/-/g, " ")}</strong>
                <span className="co-micro">{displayTime(item.at)}</span>
              </header>
              <p className="co-muted">{item.body}</p>
              <span className="co-micro">
                {item.actor} · {item.type}
              </span>
              {item.url && webLink(item.url) && (
                <a href={webLink(item.url)} target="_blank" rel="noreferrer">
                  Open document ↗
                </a>
              )}
              {item.details?.nextAction ? (
                <p className="co-micro">
                  Next: {String(item.details.nextAction)}
                </p>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      {!(compact ? initial.items : result.items).length && (
        <p className="co-empty">No matching activity recorded.</p>
      )}
      {!compact && result.total > 40 && (
        <div className="co-pagination">
          <button
            className="co-button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {Math.ceil(result.total / 40)}
          </span>
          <button
            className="co-button"
            disabled={page * 40 >= result.total || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
