import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { workspaceApi, toLocalInput } from "../bd/workspaceApi";
import type { CompanyWorkspace, Mandate, Proposal } from "./companyTypes";
export type CompanyAction =
  | { kind: "profile" | "note" }
  | { kind: "stage"; stage: string }
  | { kind: "mandate"; record?: Mandate }
  | { kind: "proposal"; record?: Proposal }
  | {
      kind: "review";
      record: Proposal;
      action: "submit" | "approve" | "reject" | "sent";
    }
  | { kind: "contact"; contact: CompanyWorkspace["contacts"][number] };
export default function CompanyDialog({
  data,
  action,
  onClose,
  onSaved,
}: {
  data: CompanyWorkspace;
  action: CompanyAction;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  const titles = {
    profile: "Company intelligence & governance",
    note: "Add a note or document link",
    stage: "Update account journey",
    mandate: "Hiring mandate & fulfillment",
    proposal: "Proposal scope & internal review",
    review: "Proposal workflow",
    contact: "Contact role & decision maker",
  };
  const record =
    action.kind === "mandate" || action.kind === "proposal"
      ? action.record
      : undefined;
  const field = (
    label: string,
    name: string,
    value?: string | number,
    type = "text",
    required = false,
  ) => (
    <label key={name}>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value ?? ""}
        required={required}
        maxLength={type === "text" ? 300 : undefined}
      />
    </label>
  );
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fields = Object.fromEntries(form);
    let path = `/company/${data.company._id}/${action.kind}`,
      method = "POST";
    let body: Record<string, unknown> = { ...fields, requestId };
    if (action.kind === "stage")
      body.confirmed = form.get("confirmed") === "on";
    if (action.kind === "mandate") {
      if (action.record) {
        path = `/mandates/${action.record._id}`;
        method = "PATCH";
        body.revision = action.record.revision;
      } else path = `/company/${data.company._id}/mandates`;
      body.dueAt = fields.dueAt
        ? new Date(String(fields.dueAt)).toISOString()
        : "";
    }
    if (action.kind === "proposal") {
      path = action.record
        ? `/proposals/${action.record._id}`
        : `/company/${data.company._id}/proposals`;
      method = action.record ? "PATCH" : "POST";
      body = {
        ...body,
        recipientPocIds: form.getAll("recipientPocIds"),
        revision: action.record?.revision,
        action: "update",
        followupAt: fields.followupAt
          ? new Date(String(fields.followupAt)).toISOString()
          : "",
      };
    }
    if (action.kind === "review") {
      path = `/proposals/${action.record._id}`;
      method = "PATCH";
      body = {
        ...body,
        revision: action.record.revision,
        action: action.action,
      };
    }
    if (action.kind === "contact") {
      path = `/company/${data.company._id}/contact/${action.contact._id}`;
      method = "PATCH";
      body = {
        ...body,
        decisionMaker: form.get("decisionMaker") === "on",
        primaryContact: form.get("primaryContact") === "on",
      };
    }
    setSaving(true);
    setError("");
    try {
      await workspaceApi(path, method, body);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <dialog
      ref={ref}
      aria-label={titles[action.kind]}
      onCancel={onClose}
      className="co-dialog"
    >
      <header className="co-section-head">
        <h2>{titles[action.kind]}</h2>
        <button
          type="button"
          className="co-icon"
          aria-label="Close company form"
          disabled={saving}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <p className="co-muted">{data.company.company_name}</p>
      <form onSubmit={save} className="co-form">
        {action.kind === "profile" && (
          <>
            {field(
              "Headquarters",
              "headquarters",
              data.company.companyProfile?.headquarters,
            )}
            {field(
              "Business model",
              "businessModel",
              data.company.companyProfile?.businessModel,
            )}
            {field(
              "Store / operating footprint",
              "footprint",
              data.company.companyProfile?.footprint,
            )}
            {field(
              "Operating territory",
              "territory",
              data.company.companyProfile?.territory,
            )}
            {field("Account tier", "tier", data.company.companyProfile?.tier)}
            <label>
              Account priority
              <select
                name="priority"
                defaultValue={data.company.companyProfile?.priority || "Normal"}
              >
                {["Low", "Normal", "High"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          </>
        )}
        {action.kind === "note" && (
          <>
            <label className="co-full">
              Note or document description
              <textarea required name="content" rows={4} maxLength={2000} />
            </label>
            <label className="co-full">
              Document link (optional)
              <input
                name="url"
                type="url"
                placeholder="https://…"
                maxLength={2000}
              />
              <small>
                Save a link to an existing document. Sharing permissions remain
                with its host.
              </small>
            </label>
          </>
        )}
        {action.kind === "stage" && (
          <>
            <label>
              Account stage
              <select name="stage" defaultValue={action.stage}>
                {[
                  "New",
                  "Contacted",
                  "Proposal Sent",
                  "Negotiation",
                  "Won",
                  "Onboarded",
                  "Lost",
                  "No vendor",
                  "Future Reference",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="co-full">
              Reason / milestone evidence
              <textarea required name="reason" maxLength={2000} rows={3} />
            </label>
            <label className="co-check co-full">
              <input name="confirmed" type="checkbox" required />I confirm this
              milestone occurred. Sent proposals and onboardings require a
              recorded business outcome.
            </label>
          </>
        )}
        {action.kind === "contact" && (
          <>
            <p className="co-full">{action.contact.name}</p>
            <label>
              Stakeholder tier
              <select
                name="stakeholderTier"
                defaultValue={action.contact.stakeholderTier || "Unmapped"}
              >
                {[
                  "Unmapped",
                  "Executive Sponsor",
                  "Primary Buyer",
                  "Hiring & Operations",
                ].map((tier) => (
                  <option key={tier}>{tier}</option>
                ))}
              </select>
            </label>
            {field(
              "Account role label",
              "stakeholderRole",
              action.contact.stakeholderRole,
            )}
            <label className="co-full">
              Relationship / influence notes
              <textarea
                name="stakeholderNote"
                rows={3}
                maxLength={2000}
                defaultValue={action.contact.stakeholderNote}
              />
            </label>
            <label className="co-check">
              <input
                type="checkbox"
                name="decisionMaker"
                defaultChecked={action.contact.decisionMaker}
              />
              Decision maker
            </label>
            <label className="co-check">
              <input
                type="checkbox"
                name="primaryContact"
                defaultChecked={action.contact.primaryContact}
              />
              Primary account contact
            </label>
            <p className="co-muted co-full">
              Setting a primary contact replaces the previous primary contact
              for this company.
            </p>
          </>
        )}
        {action.kind === "mandate" &&
          (() => {
            const mandate = record as Mandate | undefined;
            return (
              <>
                {field("Mandate title", "title", mandate?.title, "text", true)}
                <label>
                  Responsible executive
                  <select
                    name="ownerId"
                    defaultValue={
                      mandate?.ownerId?._id || data.owners[0]?._id || ""
                    }
                    required
                  >
                    <option value="">Select active owner</option>
                    {data.owners.map((owner) => (
                      <option key={owner._id} value={owner._id}>
                        {owner.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Status
                  <select
                    name="status"
                    defaultValue={mandate?.status || "Open"}
                  >
                    {["Open", "Sourcing", "Paused", "Filled", "Cancelled"].map(
                      (value) => (
                        <option key={value}>{value}</option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Priority
                  <select
                    name="priority"
                    defaultValue={mandate?.priority || "Normal"}
                  >
                    {["Low", "Normal", "High"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                {[
                  [
                    "Total positions",
                    "positions",
                    mandate?.positions ?? 1,
                    1,
                    100000,
                  ],
                  [
                    "Candidate submissions",
                    "submissions",
                    mandate?.submissions ?? 0,
                    0,
                    1000000,
                  ],
                  [
                    "Interviews scheduled",
                    "interviews",
                    mandate?.interviews ?? 0,
                    0,
                    1000000,
                  ],
                  [
                    "Positions filled",
                    "filled",
                    mandate?.filled ?? 0,
                    0,
                    100000,
                  ],
                  [
                    "Sourcing SLA (days, optional)",
                    "sourcingSlaDays",
                    mandate?.sourcingSlaDays ?? "",
                    1,
                    365,
                  ],
                ].map(([label, name, value, min, max]) => (
                  <label key={String(name)}>
                    {label}
                    <input
                      name={String(name)}
                      type="number"
                      step="1"
                      min={Number(min)}
                      max={Number(max)}
                      defaultValue={value}
                      required={name !== "sourcingSlaDays"}
                    />
                  </label>
                ))}
                {field("Hiring location", "location", mandate?.location)}
                {field(
                  "Target closure (local time)",
                  "dueAt",
                  toLocalInput(mandate?.dueAt),
                  "datetime-local",
                )}
                <label className="co-full">
                  Scope / progress notes
                  <textarea
                    name="note"
                    rows={3}
                    maxLength={2000}
                    defaultValue={mandate?.note}
                  />
                  <small>
                    These counts are recorded manually from confirmed
                    recruitment activity.
                  </small>
                </label>
              </>
            );
          })()}
        {action.kind === "proposal" &&
          (() => {
            const proposal = record as Proposal | undefined;
            return (
              <>
                {field(
                  "Proposal title",
                  "title",
                  proposal?.title,
                  "text",
                  true,
                )}
                {field(
                  "Unique proposal reference",
                  "reference",
                  proposal?.reference,
                  "text",
                  true,
                )}
                <label>
                  Responsible executive
                  <select
                    name="ownerId"
                    required
                    defaultValue={
                      proposal?.ownerId || data.owners[0]?._id || ""
                    }
                  >
                    <option value="">Select active owner</option>
                    {data.owners.map((owner) => (
                      <option key={owner._id} value={owner._id}>
                        {owner.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Internal reviewer
                  <select
                    name="reviewerId"
                    required
                    defaultValue={
                      proposal?.reviewerId || data.reviewers[0]?._id || ""
                    }
                  >
                    <option value="">Select active reviewer</option>
                    {data.reviewers.map((owner) => (
                      <option key={owner._id} value={owner._id}>
                        {owner.name}
                      </option>
                    ))}
                  </select>
                  {!data.reviewers.length && (
                    <small>
                      Assign an active reporting manager before submitting a
                      proposal.
                    </small>
                  )}
                </label>
                <label>
                  Scoped positions
                  <input
                    name="positions"
                    type="number"
                    min="0"
                    max="100000"
                    step="1"
                    required
                    defaultValue={
                      proposal?.positions ?? data.stats.openPositions ?? 0
                    }
                  />
                </label>
                {field(
                  "Next feedback follow-up (local time)",
                  "followupAt",
                  toLocalInput(proposal?.followupAt),
                  "datetime-local",
                )}
                <fieldset className="co-full">
                  <legend>Recipient contacts</legend>
                  {data.contacts.map((contact) => (
                    <label key={contact._id} className="co-check">
                      <input
                        type="checkbox"
                        name="recipientPocIds"
                        value={contact._id}
                        defaultChecked={
                          proposal?.recipientPocIds.includes(contact._id) ??
                          Boolean(contact.primaryContact)
                        }
                      />
                      {contact.name} · {contact.designation || "Contact"}
                    </label>
                  ))}
                </fieldset>
                <label className="co-full">
                  Proposal scope
                  <textarea
                    required
                    name="scope"
                    rows={4}
                    maxLength={2000}
                    defaultValue={proposal?.scope}
                  />
                </label>
                <p className="co-muted co-full">
                  Drafts and internal approvals do not count as sent proposals.
                  Record dispatch only after the proposal is actually sent.
                </p>
              </>
            );
          })()}
        {action.kind === "review" && (
          <>
            <p className="co-full">
              <strong>{action.record.title}</strong> · {action.record.reference}
            </p>
            <p className="co-inset co-full">{action.record.scope}</p>
            {["approve", "reject"].includes(action.action) ? (
              <label className="co-full">
                Review decision and reason
                <textarea name="reason" required rows={3} maxLength={2000} />
              </label>
            ) : (
              <p className="co-muted co-full">
                {action.action === "submit"
                  ? "Submit this scope to the assigned internal reviewer."
                  : "Link this approved scope to an already confirmed sent proposal with the same reference."}
              </p>
            )}
          </>
        )}
        {error && (
          <p className="co-error co-full" role="alert">
            {error}
          </p>
        )}
        <footer className="co-full co-actions">
          <button disabled={saving} className="co-button co-primary">
            {saving
              ? "Saving…"
              : action.kind === "review"
                ? {
                    submit: "Submit for review",
                    approve: "Approve scope",
                    reject: "Reject scope",
                    sent: "Confirm dispatch link",
                  }[action.action]
                : "Save changes"}
          </button>
          <button
            type="button"
            className="co-button"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>
        </footer>
      </form>
    </dialog>
  );
}
