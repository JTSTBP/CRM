import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  Download,
  LayoutGrid,
  Linkedin,
  Mail,
  MessageCircle,
  Network,
  Phone,
  Search,
  Table2,
  Users,
} from "lucide-react";
import { displayTime } from "../bd/workspaceApi";
import { initials, webLink } from "../contacts/contactTypes";
import type { CompanyWorkspace } from "./companyTypes";
import type { CompanyAction } from "./CompanyDialog";
import "./companyStakeholders.css";
type Person = CompanyWorkspace["contacts"][number];
export default function CompanyStakeholders({
  data,
  prefix,
  onRole,
  onCall,
  onEmail,
  onSchedule,
}: {
  data: CompanyWorkspace;
  prefix: string;
  onRole: (action: CompanyAction) => void;
  onCall: (id: string) => void;
  onEmail: (id: string) => void;
  onSchedule: (id?: string) => void;
}) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All Contacts"),
    [sort, setSort] = useState("Last Activity"),
    [view, setView] = useState<"Cards" | "Table">("Cards"),
    [expanded, setExpanded] = useState<Set<string>>(new Set());
  const stateFor = (id: string) =>
    data.states.find((state) => state.pocId === id);
  const tier = (person: Person) =>
    person.stakeholderTier && person.stakeholderTier !== "Unmapped"
      ? person.stakeholderTier
      : "Unmapped";
  const activityAt = (id: string) => {
    const state = stateFor(id);
    return state?.lastActivityAt || state?.lastCallAt || "";
  };
  const visible = useMemo(
    () =>
      data.contacts
        .filter(
          (person) =>
            `${person.name} ${person.designation} ${person.stakeholderRole || ""} ${person.email || ""} ${person.phone || ""}`
              .toLowerCase()
              .includes(search.toLowerCase()) &&
            (filter === "All Contacts" ||
              (filter === "Decision Makers" && person.decisionMaker) ||
              tier(person) === filter),
        )
        .sort((a, b) =>
          sort === "Name"
            ? (a.name || "").localeCompare(b.name || "")
            : sort === "Role"
              ? (a.designation || "").localeCompare(b.designation || "")
              : Number(Boolean(b.primaryContact)) -
                  Number(Boolean(a.primaryContact)) ||
                (new Date(activityAt(b._id)).getTime() || 0) -
                  (new Date(activityAt(a._id)).getTime() || 0),
        ),
    [data, search, filter, sort],
  );
  const reached = data.contacts.filter((person) => {
    const state = stateFor(person._id);
    return state?.callOutcome === "Connected" || state?.linkedin === "Accepted";
  }).length;
  const percent = data.contacts.length
    ? Math.round((reached / data.contacts.length) * 1000) / 10
    : 0;
  const emails = data.contacts.filter((person) =>
    Boolean(person.email?.trim()),
  ).length;
  const tasks = data.tasks.filter(
    (task) =>
      !task.completed &&
      task.poc_id &&
      data.contacts.some((person) => person._id === task.poc_id),
  );
  const groups = [
    "Executive Sponsor",
    "Primary Buyer",
    "Hiring & Operations",
    "Unmapped",
  ];
  const counts = (label: string) =>
    data.contacts.filter(
      (person) =>
        label === "All Contacts" ||
        (label === "Decision Makers" && person.decisionMaker) ||
        tier(person) === label,
    ).length;
  function exportContacts() {
    const cell = (value: unknown) => {
      let text = String(value ?? "");
      if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const rows = [
      [
        "Name",
        "Designation",
        "Email",
        "Phone",
        "Stakeholder tier",
        "Account role",
        "Decision maker",
        "Primary contact",
        "Last activity",
      ],
      ...visible.map((person) => [
        person.name,
        person.designation,
        person.email,
        person.phone,
        tier(person),
        person.stakeholderRole,
        person.decisionMaker ? "Yes" : "No",
        person.primaryContact ? "Yes" : "No",
        activityAt(person._id),
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "company-stakeholders.csv";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const contactActions = (person: Person) => (
    <div className="st-actions">
      <button
        className={person.primaryContact ? "co-button co-primary" : "co-button"}
        onClick={() => onCall(person._id)}
      >
        <Phone size={12} />
        Log Call
      </button>
      {person.phone && (
        <a
          className="co-button st-whatsapp"
          href={`https://wa.me/${person.phone.replace(/\D/g, "")}`}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle size={12} />
          WhatsApp
        </a>
      )}
      <button
        className="co-button"
        disabled={!person.email}
        onClick={() => onEmail(person._id)}
      >
        <Mail size={12} />
        Email
      </button>
      <button className="co-button" onClick={() => onSchedule(person._id)}>
        <Calendar size={12} />
        Schedule
      </button>
    </div>
  );
  return (
    <div className="st-workspace">
      <div className="st-main">
        <section className="co-card st-architecture">
          <header className="co-section-head">
            <div>
              <h2>
                <Network size={17} />
                Account Decision Architecture
              </h2>
              <p className="co-micro">
                Map executive sponsorship, mandate ownership and hiring
                stakeholders.
              </p>
            </div>
            <span className="co-badge">
              {
                groups.filter((group) =>
                  data.contacts.some((person) => tier(person) === group),
                ).length
              }{" "}
              stakeholder groups
            </span>
          </header>
          {groups.map((group, index) => {
            const people = data.contacts.filter(
              (person) => tier(person) === group,
            );
            return people.length ? (
              <div className={`st-tier st-tier-${index}`} key={group}>
                <h3>
                  {group === "Unmapped"
                    ? "Needs role mapping"
                    : `Tier ${index + 1}: ${group}`}
                </h3>
                <div>
                  {people.map((person) => (
                    <button
                      key={person._id}
                      className={person.primaryContact ? "is-primary" : ""}
                      onClick={() =>
                        onRole({ kind: "contact", contact: person })
                      }
                    >
                      <span className="co-user-avatar">
                        {initials(person.name)}
                      </span>
                      <span>
                        <strong>{person.name || "Unnamed contact"}</strong>
                        <small>
                          {person.stakeholderRole ||
                            person.designation ||
                            "Add account role"}
                        </small>
                      </span>
                      {person.decisionMaker && (
                        <span className="co-badge">Decision maker</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ) : null;
          })}
          {!data.contacts.length && (
            <p className="co-empty">
              Add approved contacts to map this account.
            </p>
          )}
        </section>
        <section className="co-card st-controls">
          <div>
            <label className="co-search">
              <Search size={14} />
              <input
                aria-label="Search company contacts"
                placeholder="Search contacts by name, role, email or phone…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="st-view">
              {(["Cards", "Table"] as const).map((mode) => (
                <button
                  aria-pressed={view === mode}
                  key={mode}
                  onClick={() => setView(mode)}
                >
                  {mode === "Cards" ? (
                    <LayoutGrid size={13} />
                  ) : (
                    <Table2 size={13} />
                  )}{" "}
                  {mode}
                </button>
              ))}
            </div>
            <label className="st-sort">
              Sort
              <select
                aria-label="Sort company contacts"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                {["Last Activity", "Name", "Role"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <button className="co-button" onClick={exportContacts}>
              <Download size={13} />
              Export
            </button>
          </div>
          <nav aria-label="Stakeholder filters">
            {[
              "All Contacts",
              "Decision Makers",
              "Executive Sponsor",
              "Primary Buyer",
              "Hiring & Operations",
              "Unmapped",
            ].map((label) => (
              <button
                key={label}
                aria-pressed={filter === label}
                onClick={() => setFilter(label)}
              >
                {label} ({counts(label)})
              </button>
            ))}
          </nav>
        </section>
        {view === "Cards" ? (
          <div className="st-contact-list">
            {visible.map((person) => {
              const state = stateFor(person._id),
                show = person.primaryContact || expanded.has(person._id);
              const next = tasks.find((task) => task.poc_id === person._id);
              const note =
                person.stakeholderNote ||
                data.company.remarks
                  .filter(
                    (remark) =>
                      "poc_id" in remark && remark.poc_id === person._id,
                  )
                  .at(-1)?.content;
              return (
                <article
                  className={`co-card st-contact ${person.primaryContact ? "st-primary" : ""}`}
                  key={person._id}
                >
                  <header>
                    <span className="co-user-avatar">
                      {initials(person.name)}
                    </span>
                    <div className="st-person">
                      <h3>{person.name || "Unnamed contact"}</h3>
                      <div className="st-badges">
                        {person.decisionMaker && (
                          <span className="co-badge">Decision maker</span>
                        )}
                        <span className="co-badge co-neutral">
                          {tier(person)}
                        </span>
                        {person.stakeholderRole && (
                          <span className="co-badge co-purple">
                            {person.stakeholderRole}
                          </span>
                        )}
                      </div>
                      <p className="co-muted">
                        {person.designation || "Designation not recorded"}
                      </p>
                    </div>
                    {contactActions(person)}
                  </header>
                  <div className="st-details">
                    {person.email && (
                      <span>
                        <Mail size={12} />
                        {person.email}
                      </span>
                    )}
                    {person.phone && (
                      <span>
                        <Phone size={12} />
                        {person.phone}
                      </span>
                    )}
                    {webLink(person.linkedin_url) && (
                      <a
                        href={webLink(person.linkedin_url)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Linkedin size={12} />
                        LinkedIn
                      </a>
                    )}
                  </div>
                  {show && (
                    <div className="st-channel-grid">
                      {[
                        [
                          "Last call",
                          state?.callOutcome || "Not recorded",
                          displayTime(state?.lastCallAt),
                        ],
                        [
                          "WhatsApp status",
                          state?.whatsapp || "Not recorded",
                          "Delivery/read receipts untracked",
                        ],
                        [
                          "Email outreach",
                          state?.email || "Not recorded",
                          state?.emailSubject || "Open tracking unavailable",
                        ],
                        [
                          "Relationship status",
                          state?.linkedin || "Unknown",
                          "Recorded LinkedIn status",
                        ],
                      ].map(([label, value, detail]) => (
                        <div key={label}>
                          <span className="co-label">{label}</span>
                          <strong>{value}</strong>
                          <small>{detail}</small>
                        </div>
                      ))}
                    </div>
                  )}
                  {note && (
                    <p className="st-note">
                      <MessageCircle size={14} />
                      {note}
                    </p>
                  )}
                  {next && (
                    <div className="st-next">
                      <Calendar size={14} />
                      <span>
                        Next action: {next.title} · {displayTime(next.due_date)}
                      </span>
                      <button
                        className="co-text"
                        onClick={() => onCall(person._id)}
                      >
                        Open call brief →
                      </button>
                    </div>
                  )}
                  <footer>
                    <button
                      className="co-text"
                      onClick={() =>
                        onRole({ kind: "contact", contact: person })
                      }
                    >
                      Edit stakeholder role & notes
                    </button>
                    {!person.primaryContact && (
                      <button
                        className="co-text"
                        aria-expanded={Boolean(show)}
                        onClick={() =>
                          setExpanded((current) => {
                            const next = new Set(current);
                            if (next.has(person._id)) next.delete(person._id);
                            else next.add(person._id);
                            return next;
                          })
                        }
                      >
                        {show
                          ? "Hide activity summary"
                          : "Show activity summary"}
                      </button>
                    )}
                    <Link
                      className="co-text"
                      to={`${prefix}/contacts/${person._id}`}
                    >
                      Contact workspace →
                    </Link>
                  </footer>
                </article>
              );
            })}
          </div>
        ) : (
          <section className="co-card st-table">
            <table>
              <thead>
                <tr>
                  {[
                    "Contact",
                    "Account role",
                    "Email / Phone",
                    "Call outcome",
                    "WhatsApp",
                    "Email",
                    "LinkedIn",
                    "Actions",
                  ].map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((person) => (
                  <tr key={person._id}>
                    <td>
                      <Link to={`${prefix}/contacts/${person._id}`}>
                        {person.name}
                      </Link>
                      <p>{person.designation}</p>
                    </td>
                    <td>
                      {tier(person)}
                      <p>{person.stakeholderRole}</p>
                    </td>
                    <td>
                      {person.email}
                      <p>{person.phone}</p>
                    </td>
                    <td>
                      {stateFor(person._id)?.callOutcome || "Not recorded"}
                    </td>
                    <td>{stateFor(person._id)?.whatsapp || "Not recorded"}</td>
                    <td>{stateFor(person._id)?.email || "Not recorded"}</td>
                    <td>{stateFor(person._id)?.linkedin || "Unknown"}</td>
                    <td>
                      <button
                        className="co-text"
                        onClick={() =>
                          onRole({ kind: "contact", contact: person })
                        }
                      >
                        Edit role
                      </button>
                      <button
                        className="co-text"
                        onClick={() => onCall(person._id)}
                      >
                        Log activity
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        {!visible.length && (
          <p className="co-card co-empty">
            No contacts match the current filters.
          </p>
        )}
      </div>
      <aside className="st-insights">
        <section className="co-card">
          <header className="co-section-head">
            <h2>
              <Users size={16} />
              Stakeholder Penetration
            </h2>
          </header>
          <div className="st-penetration">
            <div>
              <strong>{percent}%</strong>
              <p className="co-micro">
                {reached} of {data.contacts.length} contacts reached
              </p>
            </div>
            <div
              className="st-ring"
              style={{
                background: `conic-gradient(#004ac6 ${percent}%,#e5eeff 0)`,
              }}
              aria-label={`${percent}% have a connected call or accepted LinkedIn connection`}
            >
              <span>{percent}%</span>
            </div>
          </div>
          <p className="co-micro">
            Based on connected calls or accepted LinkedIn connections.
          </p>
          <div className="st-channel-grid">
            <div>
              <span className="co-label">Email availability</span>
              <strong>
                {emails}/{data.contacts.length}
              </strong>
              <small>Addresses recorded, not verified</small>
            </div>
            <div>
              <span className="co-label">Scheduled calls</span>
              <strong>
                {
                  tasks.filter(
                    (task) =>
                      task.type === "Call" &&
                      new Date(task.due_date) >= new Date() &&
                      new Date(task.due_date).getTime() <=
                        Date.now() + 7 * 86400000,
                  ).length
                }
              </strong>
              <small>Next 7 days</small>
            </div>
          </div>
        </section>
        <section className="co-card">
          <header className="co-section-head">
            <h2>
              <Calendar size={16} />
              Scheduled Touchpoints
            </h2>
            <button className="co-text" onClick={() => onSchedule()}>
              + Schedule
            </button>
          </header>
          {tasks.slice(0, 6).map((task) => (
            <button
              className="co-inset st-touchpoint"
              key={task._id}
              onClick={() => onCall(task.poc_id!)}
            >
              <span className="co-micro">{displayTime(task.due_date)}</span>
              <strong>
                {
                  data.contacts.find((person) => person._id === task.poc_id)
                    ?.name
                }
              </strong>
              <p>{task.title}</p>
            </button>
          ))}
          {!tasks.length && (
            <p className="co-empty">No contact-linked touchpoints scheduled.</p>
          )}
        </section>
        <section className="co-card">
          <header className="co-section-head">
            <h2>Hiring Needs Scope</h2>
            <span className="co-badge">
              {data.stats.openPositions ?? "—"} open
            </span>
          </header>
          {data.mandates
            .filter((record) =>
              ["Open", "Sourcing", "Paused"].includes(record.status),
            )
            .map((record) => (
              <div className="co-inset st-scope" key={record._id}>
                <strong>{record.title}</strong>
                <span>{record.positions - record.filled} open</span>
              </div>
            ))}
          {!data.mandates.length && (
            <p className="co-muted">
              {data.company.hiring_needs?.join(" · ") ||
                "No requirements recorded."}
            </p>
          )}
        </section>
        <section className="co-card">
          <header className="co-section-head">
            <h2>Account Governance</h2>
          </header>
          {(data.company.assignedTo?.length
            ? data.company.assignedTo
            : data.company.assignedBy
              ? [data.company.assignedBy]
              : []
          ).map((owner) => (
            <div className="co-owner" key={owner._id}>
              <span className="co-user-avatar">{initials(owner.name)}</span>
              <div>
                <strong>{owner.name}</strong>
                <p className="co-micro">
                  Account owner
                  {owner.reporter ? ` · Manager: ${owner.reporter.name}` : ""}
                </p>
              </div>
            </div>
          ))}
        </section>
      </aside>
    </div>
  );
}
