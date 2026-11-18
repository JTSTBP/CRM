import { useState } from "react";
import { Link } from "react-router-dom";
import { displayTime, secondaryClass, workspaceApi } from "./workspaceApi";

export interface ScheduledTask {
  _id: string;
  title: string;
  due_date: string;
  type?: string;
  poc_id?: string;
  lead_id?: { _id: string; company_name?: string };
  user_id?: { _id: string; name?: string };
}
export default function ScheduledTasks({
  tasks,
  prefix,
  onSaved,
}: {
  tasks: ScheduledTask[];
  prefix: string;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  async function complete(id: string) {
    setSaving(id);
    setMessage("");
    try {
      const result = await workspaceApi<{ message: string }>(
        `/task/${id}/complete`,
        "PATCH",
        { requestId: crypto.randomUUID() },
      );
      setMessage(result.message);
      onSaved();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not complete task.",
      );
    } finally {
      setSaving("");
    }
  }
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div>
        <h2 className="text-sm font-bold">Scheduled tasks &amp; callbacks</h2>
        <p className="mt-1 text-xs text-slate-500">
          Earliest 20 pending tasks, including existing CRM tasks
        </p>
      </div>
      {message && (
        <p role="status" className="text-xs text-sky-800">
          {message}
        </p>
      )}
      <div className="grid max-h-72 gap-2 overflow-y-auto lg:grid-cols-2">
        {tasks.map((task) => (
          <article
            key={task._id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-3 text-xs"
          >
            <div className="min-w-0">
              <p className="font-semibold">{task.title}</p>
              <p className="mt-1 text-slate-500">
                {task.lead_id?.company_name || "General task"} ·{" "}
                {task.user_id?.name || "Unassigned"}
              </p>
              <p
                className={
                  new Date(task.due_date) < new Date()
                    ? "mt-1 text-rose-700"
                    : "mt-1 text-slate-500"
                }
              >
                Due {displayTime(task.due_date)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {task.lead_id && (
                <Link
                  className="font-semibold text-sky-700"
                  to={`${prefix}/leads?openLead=${task.lead_id._id}&tab=tasks`}
                >
                  Open
                </Link>
              )}
              <button
                type="button"
                disabled={Boolean(saving)}
                onClick={() => void complete(task._id)}
                className={secondaryClass}
              >
                {saving === task._id ? "Saving…" : "Complete"}
              </button>
            </div>
          </article>
        ))}
        {!tasks.length && (
          <p className="text-sm text-slate-500">No pending tasks.</p>
        )}
      </div>
    </section>
  );
}
