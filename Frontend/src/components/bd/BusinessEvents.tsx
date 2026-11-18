import { useState, type FormEvent } from "react";
import {
  fieldClass,
  primaryClass,
  secondaryClass,
  displayTime,
  toLocalInput,
  workspaceApi,
  type ContactWorkspace,
} from "./workspaceApi";

export default function BusinessEvents({
  data,
  onSaved,
  initialKind,
  contactView = false,
  initialReference,
  initialOwnerId,
  outcomeOnly = false,
}: {
  data: ContactWorkspace;
  onSaved: () => Promise<void>;
  initialKind?: "proposal" | "onboarding";
  contactView?: boolean;
  initialReference?: string;
  initialOwnerId?: string;
  outcomeOnly?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(initialKind));
  const [kind, setKind] = useState(initialKind || "proposal");
  const [feedbackId, setFeedbackId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function plan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true);
    setMessage("");
    try {
      await workspaceApi(`/opportunity/${data.company._id}`, "POST", {
        ...fields,
        qualifiedForProposal: fields.qualifiedForProposal === "on",
        expectedOnboardingAt: fields.expectedOnboardingAt
          ? new Date(String(fields.expectedOnboardingAt)).toISOString()
          : "",
        requestId: crypto.randomUUID(),
      });
      await onSaved();
      setMessage("Opportunity planning saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    setSaving(true);
    setMessage("");
    try {
      if (feedbackId) {
        await workspaceApi(`/business/${feedbackId}`, "PATCH", {
          ...fields,
          requestId: crypto.randomUUID(),
        });
      } else {
        await workspaceApi("/business", "POST", {
          ...fields,
          leadId: data.company._id,
          kind,
          occurredAt: fields.occurredAt
            ? new Date(String(fields.occurredAt)).toISOString()
            : undefined,
          confirmed: fields.confirmed === "on",
          agreementConfirmed: fields.agreementConfirmed === "on",
          handoverConfirmed: fields.handoverConfirmed === "on",
        });
      }
      setOpen(false);
      setFeedbackId("");
      await onSaved();
      setMessage("Business outcome recorded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section
      className={`space-y-3 rounded-xl border border-slate-200 bg-white p-4 ${contactView ? "cc-business" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold">
          {contactView
            ? "Mandates & Requirements Onboarding"
            : "Proposals & verified onboarding"}
        </h3>
        <button
          type="button"
          onClick={() => {
            setOpen(!open);
            setFeedbackId("");
          }}
          className={secondaryClass}
        >
          Record business outcome
        </button>
      </div>
      {message && (
        <p role="status" className="text-sm text-slate-700">
          {message}
        </p>
      )}
      {open && (
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          {feedbackId ? (
            <>
              <label className="space-y-1 text-xs font-semibold">
                Client response
                <select name="status" className={fieldClass}>
                  <option>Awaiting feedback</option>
                  <option>Accepted</option>
                  <option>Rejected</option>
                </select>
              </label>
              <label className="space-y-1 text-xs font-semibold">
                Feedback remarks
                <input required name="reason" className={fieldClass} />
              </label>
            </>
          ) : (
            <>
              <label className="space-y-1 text-xs font-semibold">
                Record type
                <select
                  value={kind}
                  disabled={Boolean(initialReference)}
                  onChange={(event) =>
                    setKind(event.target.value as "proposal" | "onboarding")
                  }
                  className={fieldClass}
                >
                  <option value="proposal">Proposal sent</option>
                  <option value="onboarding">
                    Client activation completed
                  </option>
                </select>
              </label>
              <label className="space-y-1 text-xs font-semibold">
                Responsible executive
                <select
                  required
                  name="ownerId"
                  defaultValue={
                    initialOwnerId ||
                    data.state?.ownerId ||
                    data.owners[0]?._id ||
                    ""
                  }
                  className={fieldClass}
                >
                  <option value="">Select executive</option>
                  {data.owners.map((owner) => (
                    <option key={owner._id} value={owner._id}>
                      {owner.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs font-semibold">
                Unique proposal / activation reference
                <input
                  name="reference"
                  defaultValue={initialReference}
                  readOnly={Boolean(initialReference)}
                  required
                  maxLength={150}
                  className={fieldClass}
                />
              </label>
              <label className="space-y-1 text-xs font-semibold">
                Evidence or confirmation reference
                <input
                  name="evidence"
                  required
                  maxLength={1000}
                  className={fieldClass}
                  placeholder="Email reference, agreement or handover record"
                />
              </label>
              <label className="space-y-1 text-xs font-semibold">
                Actual send / activation time (your local time)
                <input
                  type="datetime-local"
                  required
                  name="occurredAt"
                  defaultValue={toLocalInput(new Date().toISOString())}
                  className={fieldClass}
                />
              </label>
              <label className="flex gap-2 text-xs sm:col-span-2">
                <input type="checkbox" required name="confirmed" />I confirm
                this proposal was sent or this client activation was completed.
              </label>
              {kind === "onboarding" && (
                <>
                  <label className="flex gap-2 text-xs">
                    <input
                      type="checkbox"
                      required={data.config.requireAgreement}
                      name="agreementConfirmed"
                    />
                    Agreement / approval completed
                  </label>
                  <label className="flex gap-2 text-xs">
                    <input
                      type="checkbox"
                      required={data.config.requireHandover}
                      name="handoverConfirmed"
                    />
                    Handover confirmed
                  </label>
                </>
              )}
              <p className="text-xs text-slate-500 sm:col-span-2">
                Use the actual event time. Reuse the same reference for a
                resend. Each client activation is counted once.
              </p>
            </>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <button disabled={saving} className={primaryClass}>
              Save record
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setFeedbackId("");
              }}
              className={secondaryClass}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {!outcomeOnly && (
        <div className="max-h-48 space-y-2 overflow-y-auto">
          {data.business.map((record) => (
            <div
              key={record._id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"
            >
              <span>
                <strong>{record.reference}</strong> · {record.kind} ·{" "}
                {record.status} · {displayTime(record.sentAt)}
              </span>
              {record.kind === "proposal" && (
                <button
                  type="button"
                  onClick={() => {
                    setFeedbackId(record._id);
                    setOpen(true);
                  }}
                  className="font-semibold text-sky-700"
                >
                  Update client response
                </button>
              )}
            </div>
          ))}
          {!data.business.length && (
            <p className="text-xs text-slate-500">
              No confirmed business events recorded.
            </p>
          )}
        </div>
      )}
      {!outcomeOnly && (
        <details
          className="rounded-lg border p-3"
          open={contactView || undefined}
        >
          <summary className="cursor-pointer text-xs font-semibold">
            Opportunity qualification &amp; expected onboarding
          </summary>
          <form onSubmit={plan} className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex gap-2 text-xs">
              <input
                name="qualifiedForProposal"
                type="checkbox"
                defaultChecked={data.company.planning?.qualifiedForProposal}
              />
              Qualified opportunity awaiting a proposal
            </label>
            <label className="space-y-1 text-xs font-semibold">
              Expected onboarding (your local time)
              <input
                type="datetime-local"
                name="expectedOnboardingAt"
                defaultValue={toLocalInput(
                  data.company.planning?.expectedOnboardingAt,
                )}
                className={fieldClass}
              />
            </label>
            <label className="space-y-1 text-xs font-semibold sm:col-span-2">
              Planning notes
              <textarea
                name="note"
                required
                defaultValue={data.company.planning?.note}
                className={fieldClass}
              />
            </label>
            <label className="space-y-1 text-xs font-semibold">
              Open requirements (positions)
              <input
                type="number"
                min="0"
                max="100000"
                step="1"
                name="openRequirements"
                defaultValue={data.company.planning?.openRequirements ?? ""}
                className={fieldClass}
              />
            </label>
            <label className="space-y-1 text-xs font-semibold">
              Probability weight (%)
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                name="probability"
                defaultValue={data.company.planning?.probability ?? ""}
                className={fieldClass}
              />
            </label>
            <div>
              <button disabled={saving} className={secondaryClass}>
                Save opportunity plan
              </button>
            </div>
          </form>
        </details>
      )}
    </section>
  );
}
