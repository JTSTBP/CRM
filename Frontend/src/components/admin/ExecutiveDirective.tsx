import { useRef, useState, type FormEvent } from "react";
import { TerritoryModal } from "../bd/TerritoryDialog";
import {
  workspaceApi,
  fieldClass,
  primaryClass,
  secondaryClass,
} from "../bd/workspaceApi";
import type { AdminData, DirectiveAction } from "./adminTypes";
export default function ExecutiveDirective({
  data,
  action,
  onClose,
  onSaved,
}: {
  data: AdminData;
  action: DirectiveAction;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [selected, setSelected] = useState(
      action.recipients || data.recipients,
    ),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const requestId = useRef(crypto.randomUUID());
  const people = [
    ...data.managers.map((person) => ({ ...person, role: "Manager" })),
    ...data.employees.map((person) => ({ ...person, role: "BD Executive" })),
  ];
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await workspaceApi<{ message: string }>(
        "/admin/directive",
        "POST",
        {
          ...fields,
          kind: action.kind,
          recipientIds: selected,
          requestId: requestId.current,
          ...(fields.dueAt
            ? { dueAt: new Date(String(fields.dueAt)).toISOString() }
            : {}),
        },
      );
      onSaved(result.message);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save directive.",
      );
      setSaving(false);
    }
  }
  return (
    <TerritoryModal
      title={
        action.kind === "meeting"
          ? "Schedule All-Hands BD Sync"
          : "Executive Directive"
      }
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <form className="ae-directive" onSubmit={save}>
        <p>
          Creates CRM in-app notifications
          {action.kind === "meeting" ? " and scheduled meeting tasks" : ""}. No
          external messages are sent.
        </p>
        <label>
          Title
          <input
            name="title"
            maxLength={200}
            required
            defaultValue={action.title}
            className={fieldClass}
          />
        </label>
        <label>
          Instructions
          <textarea
            name="message"
            maxLength={2000}
            required
            rows={3}
            defaultValue={action.message}
            className={fieldClass}
          />
        </label>
        {action.kind === "meeting" && (
          <label>
            Meeting date and time
            <input
              type="datetime-local"
              required
              name="dueAt"
              className={fieldClass}
            />
          </label>
        )}
        <fieldset>
          <legend>Active recipients ({selected.length})</legend>
          <div className="ae-button-row">
            <button
              type="button"
              className={secondaryClass}
              onClick={() => setSelected(data.recipients)}
            >
              Select filtered team
            </button>
            <button
              type="button"
              className={secondaryClass}
              onClick={() => setSelected([])}
            >
              Clear
            </button>
          </div>
          <div className="ae-recipient-list">
            {people.map((person) => (
              <label key={person._id}>
                <input
                  type="checkbox"
                  checked={selected.includes(person._id)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, person._id]
                        : current.filter((id) => id !== person._id),
                    )
                  }
                />
                <span>
                  {person.name}
                  <small>{person.role}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="ae-error">
            {error}
          </p>
        )}
        <div className="ae-button-row">
          <button
            disabled={saving}
            type="button"
            className={secondaryClass}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            disabled={saving || !selected.length || selected.length > 200}
            className={primaryClass}
          >
            {saving ? "Saving…" : "Save & Notify"}
          </button>
        </div>
        {selected.length > 200 && (
          <p>Select up to 200 recipients per directive.</p>
        )}
      </form>
    </TerritoryModal>
  );
}
