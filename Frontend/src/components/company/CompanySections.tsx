import { useState } from "react";
import { Link } from "react-router-dom";
import MobileCallLink from '../phone/MobileCallLink';
import {
  Briefcase,
  CheckSquare,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Users,
} from "lucide-react";
import { displayTime, workspaceApi } from "../bd/workspaceApi";
import { initials, webLink } from "../contacts/contactTypes";
import type { CompanyWorkspace, Mandate, Proposal } from "./companyTypes";
import type { CompanyAction } from "./CompanyDialog";

export function Mandates({
  data,
  onAction,
  onSummary,
  compact = false,
}: {
  data: CompanyWorkspace;
  onAction: (action: CompanyAction) => void;
  onSummary: () => void;
  compact?: boolean;
}) {
  const rows = compact
    ? data.mandates
        .filter((record) =>
          ["Open", "Sourcing", "Paused"].includes(record.status),
        )
        .slice(0, 2)
    : data.mandates;
  return (
    <section className="co-card">
      <header className="co-section-head">
        <h2>
          <Briefcase size={18} />
          Active Hiring Requirements Snapshot
        </h2>
        <div className="co-actions">
          <button
            className="co-button"
            onClick={() => onAction({ kind: "mandate" })}
          >
            <Plus size={14} />
            Add Mandate
          </button>
          <button className="co-text" onClick={onSummary}>
            Edit hiring summary
          </button>
        </div>
      </header>
      {rows.map((record) => (
        <MandateCard
          key={record._id}
          record={record}
          onEdit={() => onAction({ kind: "mandate", record })}
        />
      ))}
      {!rows.length && (
        <p className="co-empty">
          No {compact ? "active " : ""}hiring mandates recorded. Add a mandate
          to track scope and fulfillment.
        </p>
      )}
      {!compact && (
        <div className="co-inset">
          <h3>Company hiring summary</h3>
          <p className="co-muted">
            {data.company.hiring_needs?.join(" · ") ||
              "No legacy requirements recorded."}
          </p>
          <p className="co-micro">
            Positions: {data.company.no_of_positions ?? "Not recorded"} ·
            Designations: {data.company.no_of_designations ?? "Not recorded"}
          </p>
        </div>
      )}
    </section>
  );
}
function MandateCard({
  record,
  onEdit,
}: {
  record: Mandate;
  onEdit: () => void;
}) {
  const progress = record.positions
    ? Math.round((record.filled / record.positions) * 100)
    : 0;
  return (
    <article className="co-mandate co-inset">
      <div className="co-section-head">
        <div>
          <h3>
            {record.title} <span className="co-badge">{record.status}</span>
          </h3>
          <p className="co-muted">
            {record.location || "Location not recorded"} · Priority:{" "}
            {record.priority}
          </p>
          <p className="co-micro">
            Target closure: {displayTime(record.dueAt)}
            {record.sourcingSlaDays
              ? ` · Sourcing SLA: ${record.sourcingSlaDays} days`
              : ""}
          </p>
        </div>
        <button className="co-text" onClick={onEdit}>
          Update progress
        </button>
      </div>
      <div className="co-mini-grid">
        {[
          ["Open vacancies", record.positions - record.filled],
          ["Candidate submissions", record.submissions],
          ["Interviews scheduled", record.interviews],
          ["Positions filled", `${record.filled} / ${record.positions}`],
        ].map(([label, value]) => (
          <div key={label}>
            <span className="co-label">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <footer>
        <span className="co-user-avatar">{initials(record.ownerId?.name)}</span>
        <div>
          <strong>{record.ownerId?.name || "Unassigned"}</strong>
          <p className="co-micro">
            Responsible executive · manually recorded counts
          </p>
        </div>
        <div className="co-progress-wrap">
          <span>{progress}% fulfilled</span>
          <progress
            max={100}
            value={progress}
            aria-label={`${record.title} fulfillment`}
          />
        </div>
      </footer>
      {record.note && <p className="co-muted co-prewrap">{record.note}</p>}
    </article>
  );
}
export function Stakeholders({
  data,
  prefix,
  onAdd,
  onRole,
  onCall,
  compact = false,
}: {
  data: CompanyWorkspace;
  prefix: string;
  onAdd: () => void;
  onRole: (action: CompanyAction) => void;
  onCall: (id: string) => void;
  compact?: boolean;
}) {
  const contacts = [...data.contacts].sort(
    (a, b) =>
      Number(Boolean(b.primaryContact)) - Number(Boolean(a.primaryContact)) ||
      Number(Boolean(b.decisionMaker)) - Number(Boolean(a.decisionMaker)),
  );
  return (
    <section className="co-card">
      <header className="co-section-head">
        <h2>
          <Users size={18} />
          Key Stakeholders & Decision-Makers
        </h2>
        <button className="co-button co-primary" onClick={onAdd}>
          <Plus size={14} />
          Add New Contact
        </button>
      </header>
      <div className="co-contact-grid">
        {(compact ? contacts.slice(0, 3) : contacts).map((person) => (
          <article
            className={`co-inset ${person.primaryContact ? "co-primary-contact" : ""}`}
            key={person._id}
          >
            <div className="co-contact-head">
              <Link
                className="co-user-avatar"
                aria-label={`Open ${person.name || "contact"} details`}
                to={`${prefix}/contacts/${person._id}`}
              >
                {initials(person.name)}
              </Link>
              <div>
                <h3>
                  <Link to={`${prefix}/contacts/${person._id}`}>
                    {person.name || "Unnamed contact"}
                  </Link>
                </h3>
                <p className="co-muted">
                  {person.designation || "Designation not recorded"}
                </p>
                {person.primaryContact && (
                  <span className="co-badge">Primary contact</span>
                )}
                {person.decisionMaker && (
                  <span className="co-badge co-purple">Decision maker</span>
                )}
              </div>
              <Link
                className="co-button"
                to={`${prefix}/contacts/${person._id}`}
              >
                Workspace →
              </Link>
            </div>
            <div className="co-contact-links">
              {person.phone && (
                <MobileCallLink leadId={data.company._id} pocId={person._id} phone={person.phone} onDial={() => onCall(person._id)}>
                  <Phone size={14} />
                  {person.phone}
                </MobileCallLink>
              )}
              {person.email && (
                <a href={`mailto:${person.email}`}>
                  <Mail size={14} />
                  {person.email}
                </a>
              )}
              {person.linkedin_url && webLink(person.linkedin_url) && (
                <a
                  href={webLink(person.linkedin_url)}
                  target="_blank"
                  rel="noreferrer"
                >
                  LinkedIn ↗
                </a>
              )}
            </div>
            {!compact && (
              <div className="co-actions">
                <button
                  className="co-text"
                  onClick={() => onRole({ kind: "contact", contact: person })}
                >
                  Edit stakeholder role
                </button>
                <button className="co-text" onClick={() => onCall(person._id)}>
                  Record activity
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {!contacts.length && (
        <p className="co-empty">
          No approved contacts yet. Add a contact or submit an alternative for
          approval.
        </p>
      )}
    </section>
  );
}
export function ProposalScopes({
  data,
  onAction,
  onSend,
  onDispatch,
  onAdd,
  compact = false,
}: {
  data: CompanyWorkspace;
  onAction: (action: CompanyAction) => void;
  onSend: (record: Proposal) => void;
  onDispatch: (record: Proposal) => void;
  onAdd: () => void;
  compact?: boolean;
}) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const canReview = (record: Proposal) =>
    user.role === "Admin" ||
    (user.role === "Manager" && record.reviewerId === (user.id || user._id));
  return (
    <section className="co-card">
      <header className="co-section-head">
        <h2>
          <FileText size={18} />
          Proposals & Scope
        </h2>
        <button className="co-button co-primary" onClick={onAdd}>
          <Plus size={14} />
          Add Proposal
        </button>
      </header>
      {(compact ? data.drafts.slice(0, 1) : data.drafts).map((record) => (
        <article className="co-inset co-proposal" key={record._id}>
          <header className="co-section-head">
            <h3>{record.title}</h3>
            <span
              className={`co-badge ${record.status === "Rejected" ? "co-danger" : ""}`}
            >
              {record.status}
            </span>
          </header>
          <p className="co-prewrap">{record.scope}</p>
          <div className="co-mini-grid">
            <div>
              <span className="co-label">Reference</span>
              <strong>{record.reference}</strong>
            </div>
            <div>
              <span className="co-label">Created</span>
              {displayTime(record.createdAt)}
            </div>
            <div>
              <span className="co-label">Recipients</span>
              {record.recipientPocIds
                .map(
                  (id) =>
                    data.contacts.find((person) => person._id === id)?.name ||
                    "Removed contact",
                )
                .join(", ")}
            </div>
            <div>
              <span className="co-label">Next feedback follow-up</span>
              {displayTime(record.followupAt)}
            </div>
          </div>
          <p className="co-muted">
            Reviewer:{" "}
            {data.reviewers.find((person) => person._id === record.reviewerId)
              ?.name ||
              data.company.assignedBy?.reporter?.name ||
              "Assigned reviewer"}
          </p>
          {record.reviewReason && (
            <p className="co-review-reason">Decision: {record.reviewReason}</p>
          )}
          <div className="co-actions">
            {["Draft", "Rejected"].includes(record.status) && (
              <button
                className="co-button"
                onClick={() => onAction({ kind: "proposal", record })}
              >
                Edit scope
              </button>
            )}
            {record.status === "Draft" && (
              <button
                className="co-button"
                onClick={() =>
                  onAction({ kind: "review", record, action: "submit" })
                }
              >
                Submit for review
              </button>
            )}
            {record.status === "In Review" && canReview(record) && (
              <>
                <button
                  className="co-button co-primary"
                  onClick={() =>
                    onAction({ kind: "review", record, action: "approve" })
                  }
                >
                  Approve
                </button>
                <button
                  className="co-button"
                  onClick={() =>
                    onAction({ kind: "review", record, action: "reject" })
                  }
                >
                  Reject with reason
                </button>
              </>
            )}
            {record.status === "Approved" && (
              <>
                <button className="co-button" onClick={() => onSend(record)}>
                  Compose proposal email
                </button>
                <button
                  className="co-button co-primary"
                  onClick={() => onDispatch(record)}
                >
                  Record confirmed send
                </button>
                <button
                  className="co-text"
                  onClick={() =>
                    onAction({ kind: "review", record, action: "sent" })
                  }
                >
                  Link existing confirmed send
                </button>
              </>
            )}
          </div>
        </article>
      ))}
      {!data.drafts.length && (
        <p className="co-empty">
          No draft scopes recorded. Drafts and approvals are separate from
          sent-proposal targets.
        </p>
      )}
    </section>
  );
}
export function CompanyAgenda({
  data,
  onAdd,
  onSaved,
  onOpenTask,
}: {
  data: CompanyWorkspace;
  onAdd: () => void;
  onSaved: () => Promise<void>;
  onOpenTask?: (id: string) => void;
}) {
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  async function complete(id: string) {
    setSaving(id);
    setError("");
    try {
      await workspaceApi(`/task/${id}/complete`, "PATCH", {
        requestId: crypto.randomUUID(),
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete task.");
    } finally {
      setSaving("");
    }
  }
  return (
    <section className="co-card">
      <header className="co-section-head">
        <h2>
          <CheckSquare size={18} />
          Upcoming Agenda
        </h2>
        <button className="co-text" onClick={onAdd}>
          + Follow-up
        </button>
      </header>
      {error && (
        <p role="alert" className="co-error">
          {error}
        </p>
      )}
      {data.tasks
        .filter((task) => !task.completed)
        .slice(0, 8)
        .map((task) => (
          <article key={task._id} className="co-inset co-agenda-item">
            <span
              className={
                new Date(task.due_date) < new Date() ? "co-red" : "co-blue"
              }
            >
              {displayTime(task.due_date)}
            </span>
            <h3>{task.title}</h3>
            <p className="co-muted">{task.description}</p>
            <div className="co-actions">
              <button
                className="co-text"
                disabled={Boolean(saving)}
                onClick={() => void complete(task._id)}
              >
                {saving === task._id ? "Saving…" : "Mark complete"}
              </button>
              {task.poc_id && onOpenTask && (
                <button
                  className="co-text"
                  onClick={() => onOpenTask(task.poc_id!)}
                >
                  Contact activity
                </button>
              )}
            </div>
          </article>
        ))}
      {!data.stats.openFollowups && (
        <p className="co-empty">
          No open follow-ups. Schedule the next account action.
        </p>
      )}
    </section>
  );
}
export function CompanyNotes({
  data,
  onAdd,
}: {
  data: CompanyWorkspace;
  onAdd: () => void;
}) {
  return (
    <section className="co-card">
      <header className="co-section-head">
        <h2>
          <MessageSquare size={18} />
          Notes & Documents
        </h2>
        <button className="co-text" onClick={onAdd}>
          + Add Note / Document
        </button>
      </header>
      {[...data.company.remarks].reverse().map((note) => (
        <article key={note._id} className="co-inset co-note">
          <p className="co-prewrap">{note.content}</p>
          {note.fileUrl && webLink(note.fileUrl) && (
            <a href={webLink(note.fileUrl)} target="_blank" rel="noreferrer">
              Open document ↗
            </a>
          )}
          <footer className="co-micro">
            {note.profile?.name || "CRM user"} · {displayTime(note.created_at)}
          </footer>
        </article>
      ))}
      {!data.company.remarks.length && (
        <p className="co-empty">No account notes or document links recorded.</p>
      )}
    </section>
  );
}
