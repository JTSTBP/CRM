import { useRef, useState, type FormEvent } from "react";
import { TerritoryModal } from "../bd/TerritoryDialog";
import { workspaceApi } from "../bd/workspaceApi";
import type { ManagerAction, ManagerData } from "./managerTypes";
export default function ManagerActionDialog({
  action,
  data,
  onClose,
  onSaved,
}: {
  action: ManagerAction;
  data: ManagerData;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [leadId, setLeadId] = useState(
      action.leadId ||
        data.companies.find((company) =>
          company.ownerIds.includes(action.ownerId || ""),
        )?._id ||
        data.companies[0]?._id ||
        "",
    );
  const requestId = useRef(crypto.randomUUID());
  const names = {
    task: "Assign a team task",
    reassign: "Reassign contact ownership",
    remind: "Send an in-app reminder",
    compliance: "Remind team about daily records",
    research: "Assign contact research",
    corep: "Add a supporting executive",
    lifecycle: "Review a stalled company",
  };
  const task = ["task", "research", "lifecycle"].includes(action.kind),
    owner = ["task", "reassign", "corep", "lifecycle", "research"].includes(
      action.kind,
    ),
    company = ["task", "corep", "lifecycle"].includes(action.kind);
  const employees =
    company && action.kind !== "corep"
      ? data.employees.filter((person) =>
          data.companies
            .find((item) => item._id === leadId)
            ?.ownerIds.includes(person._id),
        )
      : data.employees;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await workspaceApi<{ message: string }>(
        "/manager/action",
        "POST",
        {
          ...action,
          ...fields,
          ...(company ? { leadId } : {}),
          ...(fields.dueAt
            ? { dueAt: new Date(String(fields.dueAt)).toISOString() }
            : {}),
          requestId: requestId.current,
        },
      );
      onSaved(result.message);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save.");
      setSaving(false);
    }
  }
  return (
    <TerritoryModal
      title={names[action.kind]}
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <form className="mc-form" onSubmit={submit}>
        <p>
          {action.stateIds?.length
            ? `${action.stateIds.length} selected contact(s). `
            : ""}
          Every action is recorded in the manager audit trail.
        </p>
        {company && (
          <label>
            Company
            <select
              required
              value={leadId}
              onChange={(event) => setLeadId(event.target.value)}
            >
              {data.companies.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {owner && (
          <label>
            {action.kind === "research"
              ? "Executive (leave blank for current owner)"
              : "Executive"}
            <select
              key={leadId}
              name="ownerId"
              required={action.kind !== "research"}
              defaultValue={action.ownerId || ""}
            >
              <option value="">Choose active executive</option>
              {employees.map((person) => (
                <option value={person._id} key={person._id}>
                  {person.name}
                </option>
              ))}
            </select>
            {!employees.length && (
              <small>
                No active executive is assigned. Add a supporting executive
                first.
              </small>
            )}
          </label>
        )}
        {task && (
          <>
            <label>
              Task title
              <input
                required
                name="title"
                maxLength={200}
                defaultValue={
                  action.kind === "research" ? "Verify contact details" : ""
                }
              />
            </label>
            <label>
              Due date and time
              <input required type="datetime-local" name="dueAt" />
            </label>
          </>
        )}
        <label>
          Reason / instructions
          <textarea required name="reason" maxLength={2000} rows={3} />
        </label>
        {action.kind === "compliance" && (
          <p>
            Creates in-app reminders for executives with incomplete records or a
            missing report after cutoff. It does not send email or external push
            messages.
          </p>
        )}
        {error && (
          <p role="alert" className="mc-error">
            {error}
          </p>
        )}
        <div className="mc-actions">
          <button type="button" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button className="mc-primary" disabled={saving}>
            {saving ? "Saving…" : "Save action"}
          </button>
        </div>
      </form>
    </TerritoryModal>
  );
}
