import { useEffect, useRef, useState, type FormEvent } from "react";
import { TerritoryModal } from "../bd/TerritoryDialog";
import { hasMobileDial } from "../phone/mobileCall";
import {
  workspaceApi,
  toLocalInput,
  fieldClass,
  primaryClass,
  secondaryClass,
  type ContactWorkspace,
} from "../bd/workspaceApi";
const types = [
  ["call", "Call"],
  ["whatsapp", "WhatsApp"],
  ["email", "Email"],
  ["linkedin", "LinkedIn connection"],
  ["linkedinFollowup", "LinkedIn follow-up"],
];
export default function LogContactActivity({
  leadId,
  pocId,
  onClose,
  onSaved,
}: {
  leadId: string;
  pocId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<ContactWorkspace | null>(null),
    [type, setType] = useState(""),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  useEffect(() => {
    const controller = new AbortController();
    workspaceApi<ContactWorkspace>(
      `/contact/${leadId}/${pocId}`,
      "GET",
      undefined,
      controller.signal,
    )
      .then(setData)
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [leadId, pocId]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || saving) return;
    setSaving(true);
    setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const dueDefault = toLocalInput(data.state?.dueAt);
    const dueChanged = String(fields.dueAt || "") !== dueDefault;
    const { dueAt, ...details } = fields;
    try {
      await workspaceApi(`/contact/${leadId}/${pocId}`, "POST", {
        ...details,
        activityType: type,
        requestId: requestId.current,
        revision: data.state?.revision ?? 0,
        ...(dueChanged
          ? { dueAt: dueAt ? new Date(String(dueAt)).toISOString() : "" }
          : {}),
        [type + "Confirmed"]: fields.confirmed === "on",
      });
      onSaved();
      onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save activity.",
      );
      setSaving(false);
    }
  }
  const state = data?.state;
  return (
    <TerritoryModal
      title="Log Activity"
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {!data ? (
        <p className="mt-3 text-sm">
          {error ? "Close and try again." : "Loading contact…"}
        </p>
      ) : (
        <form onSubmit={save} className="mt-4 space-y-4">
          <p className="text-sm text-slate-600">
            {data.company.name} · <strong>{data.contact.name}</strong>
          </p>
          <label className="block space-y-1 text-xs font-semibold">
            Activity type
            <select
              required
              className={fieldClass}
              value={type}
              onChange={(event) => setType(event.target.value)}
              disabled={saving}
            >
              <option value="">Select activity</option>
              {types
                .filter(
                  ([key]) => key !== "call" || hasMobileDial(leadId, pocId),
                )
                .map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
          {type && (
            <div key={type} className="space-y-4">
              {!state && (
                <label className="block space-y-1 text-xs font-semibold">
                  Responsible executive
                  <select
                    required
                    name="ownerId"
                    className={fieldClass}
                    defaultValue={
                      data.owners.length === 1 ? data.owners[0]._id : ""
                    }
                  >
                    <option value="">Select executive</option>
                    {data.owners.map((owner) => (
                      <option key={owner._id} value={owner._id}>
                        {owner.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block space-y-1 text-xs font-semibold">
                {type === "call" ? "Call outcome" : "Activity status"}
                <select
                  required
                  name={type === "call" ? "callOutcome" : type}
                  className={fieldClass}
                  defaultValue={
                    type === "call"
                      ? ""
                      : state?.[type as "whatsapp"] || "Pending"
                  }
                >
                  {type === "call" && <option value="">Select outcome</option>}
                  {(type === "call"
                    ? [
                        "Connected",
                        "Busy",
                        "No Answer",
                        "Wrong Number",
                        "Not Interested",
                        "Callback Requested",
                      ]
                    : type === "linkedin"
                      ? [
                          "Not Sent",
                          "Sent",
                          "Pending",
                          "Accepted",
                          "Rejected",
                          "Unknown",
                        ]
                      : ["Sent", "Pending", "Failed", "Not Applicable"]
                  ).map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              {type !== "call" && (
                <label className="flex gap-2 text-xs text-slate-600">
                  <input type="checkbox" name="confirmed" />
                  {type === "linkedin"
                    ? "I verified this connection status."
                    : "I confirm this message was sent externally (required for Sent)."}
                </label>
              )}
              {type === "email" && (
                <label className="block space-y-1 text-xs font-semibold">
                  Email subject
                  <input
                    name="emailSubject"
                    defaultValue={state?.emailSubject || ""}
                    className={fieldClass}
                    maxLength={2000}
                  />
                </label>
              )}
              {type.startsWith("linkedin") && (
                <label className="block space-y-1 text-xs font-semibold">
                  LinkedIn profile URL
                  <input
                    type="url"
                    name="linkedinUrl"
                    defaultValue={
                      state?.linkedinUrl || data.contact.linkedinUrl || ""
                    }
                    className={fieldClass}
                  />
                </label>
              )}
              <label className="block space-y-1 text-xs font-semibold">
                Notes
                <textarea
                  name="remarks"
                  rows={3}
                  maxLength={2000}
                  className={fieldClass}
                  placeholder="What happened during this activity?"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-xs font-semibold">
                  Next action
                  <input
                    name="nextAction"
                    defaultValue={state?.nextAction || ""}
                    maxLength={2000}
                    className={fieldClass}
                  />
                </label>
                <label className="block space-y-1 text-xs font-semibold">
                  Follow-up date and time
                  <input
                    type="datetime-local"
                    name="dueAt"
                    defaultValue={toLocalInput(state?.dueAt)}
                    className={fieldClass}
                  />
                </label>
              </div>
              {type !== "call" && (
                <label className="block space-y-1 text-xs font-semibold">
                  Reason if Not Applicable
                  <input
                    name="channelReason"
                    defaultValue={state?.channelReason || ""}
                    className={fieldClass}
                    maxLength={2000}
                  />
                </label>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={secondaryClass}
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </button>
            <button className={primaryClass} disabled={saving || !type}>
              {saving ? "Saving…" : "Save Activity"}
            </button>
          </div>
        </form>
      )}
    </TerritoryModal>
  );
}
