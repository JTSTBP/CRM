import { useEffect, useState, type FormEvent } from "react";
import { CalendarDays } from "lucide-react";
import { workspaceApi } from "./workspaceApi";
interface Report {
  range: { from: string; to: string };
  totals: Record<string, number>;
}
const dayKey = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export default function ActivityDateFilter({
  refreshKey,
}: {
  refreshKey: number;
}) {
  const today = dayKey(new Date()),
    [from, setFrom] = useState(today),
    [to, setTo] = useState(today),
    [applied, setApplied] = useState({ from: today, to: today }),
    [result, setResult] = useState<{ key: string; report: Report } | null>(
      null,
    ),
    [failure, setFailure] = useState<{ key: string; message: string } | null>(
      null,
    ),
    [retry, setRetry] = useState(0);
  const isToday = applied.from === today && applied.to === today,
    key = JSON.stringify([applied, refreshKey, retry]);
  const report = result?.key === key ? result.report : null,
    error = failure?.key === key ? failure.message : "",
    loading = !isToday && !report && !error;
  useEffect(() => {
    if (isToday) return;
    const controller = new AbortController(),
      query = new URLSearchParams({
        period: "custom",
        from: applied.from,
        to: applied.to,
      });
    workspaceApi<Report>(
      `/activity-report?${query}`,
      "GET",
      undefined,
      controller.signal,
    )
      .then((report) => setResult({ key, report }))
      .catch((error) => {
        if (!controller.signal.aborted)
          setFailure({ key, message: error.message });
      });
    return () => controller.abort();
  }, [isToday, applied, key]);
  function preset(kind: string) {
    let start = today;
    if (kind === "week") {
      const at = new Date(`${today}T12:00:00+05:30`);
      start = dayKey(new Date(+at - ((at.getUTCDay() + 6) % 7) * 86400000));
    }
    if (kind === "month") start = today.slice(0, 7) + "-01";
    setFrom(start);
    setTo(today);
    setApplied({ from: start, to: today });
  }
  function apply(event: FormEvent) {
    event.preventDefault();
    setApplied({ from, to });
  }
  return (
    <section className="tf-card !p-4" aria-label="Dashboard date filter">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays size={16} /> Activity Date Filter
        </h2>
        <div className="flex flex-wrap gap-2">
          {[
            ["today", "Today"],
            ["week", "This Week"],
            ["month", "This Month"],
          ].map(([kind, label]) => (
            <button
              className="tf-button"
              key={kind}
              onClick={() => preset(kind)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <form onSubmit={apply} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs font-semibold">
          From date
          <input
            aria-label="From date"
            type="date"
            value={from}
            max={today}
            required
            onChange={(event) => setFrom(event.target.value)}
            className="rounded border border-blue-100 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          To date
          <input
            aria-label="To date"
            type="date"
            value={to}
            min={from}
            max={today}
            required
            onChange={(event) => setTo(event.target.value)}
            className="rounded border border-blue-100 bg-white px-3 py-2 text-sm"
          />
        </label>
        <button className="tf-button primary">Apply Dates</button>
      </form>
      <p className="tf-small mt-3">
        {isToday
          ? "Showing today’s live dashboard."
          : "Activity report: " +
            applied.from +
            " – " +
            applied.to +
            " (IST)."}{" "}
        Today’s queues and daily target cards remain live.
      </p>
      {loading && (
        <p role="status" className="mt-3 text-sm">
          Loading selected activity…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}{" "}
          <button
            className="underline"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry report
          </button>
        </p>
      )}
      {!isToday && report && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {[
            ["Companies touched", report.totals.companies],
            ["Calls", report.totals.calls],
            ["Connected", report.totals.connected],
            ["WhatsApp sent", report.totals.whatsapp],
            ["Email sent", report.totals.email],
            ["LinkedIn requests", report.totals.linkedinSent],
            [
              "Proposals / target",
              `${report.totals.proposals} / ${report.totals.proposalTarget}`,
            ],
            ["Onboardings", report.totals.onboardings],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="min-w-0 rounded-lg bg-blue-50 p-3"
            >
              <p className="tf-small">{label}</p>
              <strong className="mt-1 block text-lg text-blue-800">
                {value}
              </strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
