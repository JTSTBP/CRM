import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { workspaceApi } from "../bd/workspaceApi";
import type { ContactData } from "./contactTypes";

export default function RequirementsDialog({
  lead,
  onClose,
  onSaved,
}: {
  lead: ContactData["lead"];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      await workspaceApi(`/requirements/${lead._id}`, "POST", {
        requestId,
        hiringNeeds: String(fields.get("requirements") || "")
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
        positions: fields.get("positions"),
        designations: fields.get("designations"),
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save requirements.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-label="Company hiring requirements"
      onCancel={onClose}
      className="cc-requirements-dialog"
    >
      <header className="cc-section-heading">
        <h2>Company hiring requirements</h2>
        <button
          type="button"
          className="cc-icon"
          aria-label="Close requirements form"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <p className="cc-muted">
        {lead.company_name} · Shared across this company’s contacts.
      </p>
      <form onSubmit={save} className="cc-requirements-form">
        <label>
          Hiring requirements{" "}
          <span className="cc-micro">
            One role or requirement per line. Clear the field to remove all.
          </span>
          <textarea
            name="requirements"
            rows={5}
            maxLength={10050}
            defaultValue={(lead.hiring_needs || []).join("\n")}
          />
        </label>
        <div className="cc-record-grid">
          <label>
            Total open positions
            <input
              name="positions"
              type="number"
              step="1"
              min="0"
              max="100000"
              defaultValue={lead.no_of_positions ?? ""}
            />
          </label>
          <label>
            Number of designations
            <input
              name="designations"
              type="number"
              step="1"
              min="0"
              max="100000"
              defaultValue={lead.no_of_designations ?? ""}
            />
          </label>
        </div>
        {error && (
          <p className="cc-error" role="alert">
            {error}
          </p>
        )}
        <div className="cc-actions">
          <button className="cc-button cc-primary" disabled={saving}>
            {saving ? "Saving…" : "Save requirements"}
          </button>
          <button
            type="button"
            className="cc-button"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}
