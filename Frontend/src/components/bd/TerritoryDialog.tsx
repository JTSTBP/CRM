import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { workspaceApi } from "./workspaceApi";

export function TerritoryModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={onClose}
      className="tf-modal"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button type="button" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export interface TerritoryAction {
  kind: "bulk" | "lifecycle" | "report";
  ids?: string[];
  leadId?: string;
}
export default function TerritoryDialog({
  action,
  onClose,
  onSaved,
}: {
  action: TerritoryAction;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(crypto.randomUUID());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const path =
        action.kind === "bulk"
          ? "/bulk-followup"
          : action.kind === "lifecycle"
            ? `/lifecycle/${action.leadId}`
            : "/submit";
      await workspaceApi(path, "POST", {
        ...fields,
        ids: action.ids,
        requestId: requestId.current,
        ...(fields.dueAt
          ? { dueAt: new Date(String(fields.dueAt)).toISOString() }
          : {}),
      });
      onSaved();
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }
  const title =
    action.kind === "bulk"
      ? `Schedule ${action.ids?.length || 0} follow-ups`
      : action.kind === "lifecycle"
        ? "Review lifecycle delay"
        : "Submit daily activity report";
  return (
    <TerritoryModal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        {action.kind === "report" ? (
          <>
            <p className="tf-muted">
              Complete today’s communication updates before submission. If the
              cutoff has passed, record the reason for submitting late.
            </p>
            <label>
              Late submission reason
              <textarea name="reason" maxLength={2000} rows={3} />
            </label>
          </>
        ) : (
          <>
            {action.kind === "lifecycle" && (
              <label>
                Reason for delay
                <select name="reason" required>
                  {[
                    "Waiting for client response",
                    "Meeting pending",
                    "Proposal under preparation",
                    "Client requested more time",
                    "No current hiring requirement",
                    "Unable to reach decision-maker",
                    "Other",
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Next action
              <textarea name="nextAction" required maxLength={2000} rows={3} />
            </label>
            <label>
              Follow-up date and time (your local time)
              <input type="datetime-local" name="dueAt" required />
            </label>
            <p className="tf-small">
              {action.kind === "bulk"
                ? "This schedules tasks for the selected contacts. Communication outcomes still need to be recorded after the outreach."
                : "This records the review and next action. Change the pipeline stage when a business event occurs."}
            </p>
          </>
        )}
        {error && (
          <p role="alert" className="tf-status-message tf-error">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            className="tf-button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button disabled={saving} className="tf-button primary">
            {saving
              ? "Saving…"
              : action.kind === "report"
                ? "Submit report"
                : "Save follow-up"}
          </button>
        </div>
      </form>
    </TerritoryModal>
  );
}
