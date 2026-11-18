import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  Copy,
  ExternalLink,
  History,
  Linkedin,
  Mail,
  MessageCircle,
  MessageSquare,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_BASE_URL } from "../../config";
import ContactActivity from "../../components/bd/ContactActivity";
import ActivityDialog from "../../components/bd/ActivityDialog";
import BusinessEvents from "../../components/bd/BusinessEvents";
import {
  workspaceApi,
  displayTime,
  type ContactWorkspace,
} from "../../components/bd/workspaceApi";
import RequirementsDialog from "../../components/contacts/RequirementsDialog";
import ContactTimeline from "../../components/contacts/ContactTimeline";
import {
  initials,
  webLink,
  type ContactData,
  type ContactTask,
} from "../../components/contacts/contactTypes";
import AddPOCModal from "../../components/modals/AddPOCModal";
import EditPOCModal from "../../components/modals/EditPOCModal";
import TaskModal from "../../components/modals/TaskModal";
import RemarkModal from "../../components/modals/RemarkModal";
import SendEmailModal from "../../components/modals/SendEmailModal";
import "../../components/contacts/contactDetail.css";

type Dialog =
  | "activity"
  | "call"
  | "task"
  | "remark"
  | "email"
  | "add"
  | "edit"
  | "requirements"
  | null;
export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const currentId = useRef(id);
  currentId.current = id;
  const prefix = location.pathname.startsWith("/admin")
    ? "/admin"
    : location.pathname.startsWith("/manager")
      ? "/manager"
      : "/bd";
  const [data, setData] = useState<ContactData | null>(null);
  const [workspace, setWorkspace] = useState<ContactWorkspace | null>(null);
  const [error, setError] = useState("");
  const [workspaceError, setWorkspaceError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState("overview");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [more, setMore] = useState(false);
  const [schedule, setSchedule] = useState(false);
  const [busyTask, setBusyTask] = useState("");
  const [savedAt, setSavedAt] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const reload = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      setRefreshing(true);
      setError("");
      try {
        const response = await fetch(`${API_BASE_URL}/api/leads/poc/${id}`, {
          signal,
          headers: { "x-auth-token": localStorage.getItem("token") || "" },
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.message || "Could not load contact.");
        if (signal?.aborted || currentId.current !== id) return;
        setData(result);
        setWorkspaceError("");
        try {
          const detail = await workspaceApi<ContactWorkspace>(
            `/contact/${result.lead._id}/${id}`,
            "GET",
            undefined,
            signal,
          );
          if (!signal?.aborted && currentId.current === id)
            setWorkspace(detail);
        } catch (err) {
          if (!signal?.aborted && currentId.current === id)
            setWorkspaceError(
              err instanceof Error
                ? err.message
                : "Communication data unavailable.",
            );
        }
        if (!signal?.aborted && currentId.current === id) {
          setSavedAt(new Date().toISOString());
          setVersion((v) => v + 1);
        }
      } catch (err) {
        if (!signal?.aborted && currentId.current === id)
          setError(
            err instanceof Error ? err.message : "Could not load contact.",
          );
      } finally {
        if (!signal?.aborted && currentId.current === id) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [id],
  );
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setWorkspace(null);
    setLoading(true);
    setDialog(null);
    setTab("overview");
    setMore(false);
    setSchedule(false);
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);
  const saved = () => {
    void reload();
  };
  async function olderHistory() {
    if (!workspace || !data || historyLoading) return;
    setHistoryLoading(true);
    try {
      const older = await workspaceApi<ContactWorkspace>(
        `/contact/${data.lead._id}/${data.poc._id}?historyPage=${workspace.historyPage + 1}`,
      );
      if (currentId.current !== id) return;
      setWorkspace((current) =>
        current
          ? {
              ...current,
              historyPage: older.historyPage,
              historyTotal: older.historyTotal,
              history: [
                ...new Map(
                  [...current.history, ...older.history].map((event) => [
                    event._id,
                    event,
                  ]),
                ).values(),
              ],
            }
          : older,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not load older records.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }
  async function completeTask(task: ContactTask) {
    setBusyTask(task._id);
    try {
      await workspaceApi(`/task/${task._id}/complete`, "PATCH", {
        requestId: crypto.randomUUID(),
      });
      toast.success("Task completed");
      await reload();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not complete task",
      );
    } finally {
      setBusyTask("");
    }
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy. Select and copy the address.");
    }
  }
  if (loading)
    return (
      <div className="contact-command cc-empty" role="status">
        Loading contact workspace…
      </div>
    );
  if (!data)
    return (
      <div className="contact-command cc-card">
        <p role="alert">{error || "Contact not found."}</p>
        <button className="cc-button" onClick={() => void reload()}>
          Try again
        </button>
        <Link to={`${prefix}/contacts`}>Back to Contacts Workspace</Link>
      </div>
    );
  const { poc, lead, calls, tasks, remarks } = data;
  const state = workspace?.state;
  const owners = lead.assignedTo?.length
    ? lead.assignedTo
    : lead.assignedBy
      ? [lead.assignedBy]
      : [];
  const ownerName =
    workspace?.owners.find((owner) => owner._id === state?.ownerId)?.name ||
    owners.map((owner) => owner.name).join(", ") ||
    "Unassigned";
  const linkedIn = webLink(state?.linkedinUrl || poc.linkedin_url);
  const website = webLink(lead.website_url);
  const companyLinkedIn = webLink(lead.linkedin_link);
  const phone = String(poc.phone || "");
  const phoneDigits = phone.replace(/\D/g, "");
  const lastCall = state?.lastCallAt || calls[0]?.timestamp;
  const completed = tasks.filter(
    (task) => task.completed && !task.monitoringDisposition,
  ).length;
  const visibleTasks = tasks.filter((task) => !task.monitoringDisposition);
  const companyLink = `${prefix}/leads?openLead=${lead._id}`;
  const timeline = () => setTab("timeline");
  const date = (value?: string) =>
    value
      ? new Date(value).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Kolkata",
        })
      : "Not recorded";
  return (
    <div className="contact-command">
      <div className="cc-toolbar">
        <div className="cc-breadcrumb">
          <Link to={`${prefix}/contacts`}>
            <ArrowLeft size={14} /> Back to Contacts Workspace
          </Link>
          <span>/</span>
          <Link to={companyLink}>{lead.company_name}</Link>
          <ChevronRight size={12} />
          <strong>{poc.name || "Unnamed contact"}</strong>
        </div>
        <div className="cc-actions">
          <button className="cc-button" onClick={() => setDialog("activity")}>
            <ClipboardList size={14} />
            Log Activity
          </button>
          <button className="cc-button" onClick={() => setDialog("task")}>
            <Plus size={14} />
            New Task
          </button>
          <button
            className="cc-button cc-primary"
            onClick={() => setDialog("activity")}
          >
            <CheckSquare size={14} />
            Update Communication
          </button>
          <div className="cc-more">
            <button
              className="cc-button cc-icon"
              aria-label="More contact options"
              aria-expanded={more}
              onClick={() => setMore(!more)}
            >
              <MoreVertical size={16} />
            </button>
            {more && (
              <div className="cc-dropdown">
                <button
                  onClick={() => {
                    setDialog("edit");
                    setMore(false);
                  }}
                >
                  <Pencil size={14} />
                  Edit contact
                </button>
                <button
                  disabled={refreshing}
                  onClick={() => {
                    setMore(false);
                    void reload();
                  }}
                >
                  <RefreshCw size={14} />
                  Refresh record
                </button>
                <Link to={companyLink}>
                  <Building2 size={14} />
                  Company master card
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
      {error && (
        <p role="alert" className="cc-error">
          {error} <button onClick={() => void reload()}>Retry</button>
        </p>
      )}
      <div className="cc-grid">
        <aside className="cc-profile-rail">
          <section className="cc-card cc-profile">
            <div className="cc-identity">
              <div className="cc-avatar">{initials(poc.name)}</div>
              <h1>{poc.name || "Unnamed contact"}</h1>
              <p>
                {poc.designation || "Designation not provided"} <span>·</span>{" "}
                <Link to={companyLink}>{lead.company_name}</Link>
              </p>
              <div className="cc-badges">
                <span className="cc-tag">{poc.stage || "New"}</span>
                {poc.approvalStatus && (
                  <span className="cc-tag">{poc.approvalStatus}</span>
                )}
              </div>
            </div>
            <div className="cc-owner cc-inset">
              <span className="cc-small-avatar">{initials(ownerName)}</span>
              <div>
                <span className="cc-label">Assigned owner</span>
                <strong>{ownerName}</strong>
              </div>
            </div>
            <div className="cc-contact-strip">
              <div className="cc-inset">
                <span className="cc-label">Direct email</span>
                {poc.email ? (
                  <div className="cc-inline">
                    <a href={`mailto:${poc.email}`}>
                      <Mail size={13} />
                      {poc.email}
                    </a>
                    <button
                      aria-label="Copy email address"
                      onClick={() => void copy(poc.email!)}
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                ) : (
                  <span className="cc-muted">Not provided</span>
                )}
              </div>
              <div className="cc-inset">
                <span className="cc-label">Phone number</span>
                {phone ? (
                  <a href={`tel:${phone}`}>
                    <strong>{phone}</strong>
                  </a>
                ) : (
                  "Not provided"
                )}
                {poc.alternate_phone && (
                  <p className="cc-micro">
                    Alt:{" "}
                    <a href={`tel:${poc.alternate_phone}`}>
                      {poc.alternate_phone}
                    </a>
                  </p>
                )}
              </div>
              <div className="cc-inset">
                <span className="cc-label">LinkedIn network</span>
                {linkedIn ? (
                  <a href={linkedIn} target="_blank" rel="noreferrer">
                    <Linkedin size={13} /> View Profile{" "}
                    <ExternalLink size={11} />
                  </a>
                ) : (
                  <span className="cc-muted">No profile added</span>
                )}
              </div>
            </div>
            <div className="cc-quick">
              <h2 className="cc-label">Quick actions</h2>
              <button disabled={!poc.email} onClick={() => setDialog("email")}>
                <Mail size={14} />
                Email
              </button>
              <button onClick={() => setDialog("call")}>
                <Phone size={14} />
                Call / Log call
              </button>
              <button onClick={() => setDialog("remark")}>
                <MessageSquare size={14} />
                Remark
              </button>
              <button onClick={() => setDialog("task")}>
                <CheckSquare size={14} />
                Task
              </button>
              <button
                aria-expanded={schedule}
                onClick={() => setSchedule(!schedule)}
              >
                <Calendar size={14} />
                Schedule
              </button>
              {schedule && (
                <div className="cc-schedule">
                  <a
                    href={`https://calendar.google.com/calendar/r/eventedit?text=${encodeURIComponent(`Meeting with ${poc.name || lead.company_name}`)}${poc.email ? `&add=${encodeURIComponent(poc.email)}` : ""}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Google Calendar <ExternalLink size={11} />
                  </a>
                  <a
                    href={`https://outlook.office.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(`Meeting with ${poc.name || lead.company_name}`)}${poc.email ? `&to=${encodeURIComponent(poc.email)}` : ""}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Outlook Calendar <ExternalLink size={11} />
                  </a>
                  <button
                    onClick={() => {
                      setSchedule(false);
                      setDialog("task");
                    }}
                  >
                    Schedule CRM follow-up
                  </button>
                </div>
              )}
              {phoneDigits ? (
                <a
                  href={`https://wa.me/${phoneDigits}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle size={14} />
                  WhatsApp
                </a>
              ) : (
                <button disabled>
                  <MessageCircle size={14} />
                  WhatsApp · no phone
                </button>
              )}
            </div>
          </section>
          <section className="cc-card">
            <header className="cc-section-heading">
              <h2>About this Contact</h2>
              <button
                className="cc-icon"
                aria-label="Edit contact information"
                onClick={() => setDialog("edit")}
              >
                <Pencil size={14} />
              </button>
            </header>
            <dl className="cc-facts">
              <div>
                <dt>Contact ID</dt>
                <dd title={poc._id}>#{poc._id.slice(-8).toUpperCase()}</dd>
              </div>
              <div>
                <dt>Lead source</dt>
                <dd>{lead.lead_source || "Not recorded"}</dd>
              </div>
              <div>
                <dt>First ingested</dt>
                <dd>{date(poc.createdAt || lead.createdAt)}</dd>
              </div>
              <div>
                <dt>Contact status</dt>
                <dd>{poc.stage || "New"}</dd>
              </div>
            </dl>
            <div className="cc-tags">
              <span className="cc-label">Operational context</span>
              {lead.industry_name && (
                <span className="cc-tag">{lead.industry_name}</span>
              )}
              {poc.designation && (
                <span className="cc-tag">{poc.designation}</span>
              )}
              {poc.requirementId && (
                <span className="cc-tag">Requirement: {poc.requirementId}</span>
              )}
            </div>
          </section>
        </aside>
        <div className="cc-main-rail">
          {!lastCall && (
            <section className="cc-outreach">
              <div>
                <h2>
                  <Phone size={15} />
                  First outreach pending
                </h2>
                <p>
                  No call has been recorded for this contact. Start the call
                  workflow and save the confirmed outcome.
                </p>
              </div>
              <button className="cc-button" onClick={() => setDialog("call")}>
                Start Call Workflow
              </button>
            </section>
          )}
          <nav className="cc-tabs" aria-label="Contact sections">
            {[
              ["overview", "Overview"],
              ["timeline", "Activities & Timeline"],
              ["business", "Proposals & Requirements"],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={tab === value}
                onClick={() => setTab(value)}
              >
                {value === "overview" ? (
                  <Users size={15} />
                ) : value === "timeline" ? (
                  <History size={15} />
                ) : (
                  <ClipboardList size={15} />
                )}{" "}
                {label}
              </button>
            ))}
          </nav>
          {workspaceError && (
            <p role="alert" className="cc-error">
              {workspaceError}{" "}
              <button onClick={() => void reload()}>
                Retry communication data
              </button>
            </p>
          )}
          {tab === "overview" && (
            <>
              <section className="cc-card">
                <header className="cc-section-heading">
                  <h2>Record Overview</h2>
                  <span className="cc-micro">
                    Updated{" "}
                    {savedAt
                      ? new Date(savedAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </span>
                </header>
                <div className="cc-record-grid">
                  <div className="cc-inset">
                    <span className="cc-label">
                      <Phone size={12} />
                      Last call
                    </span>
                    <strong>{date(lastCall)}</strong>
                  </div>
                  <div className="cc-inset">
                    <span className="cc-label">Contact status</span>
                    <strong className="cc-tag">{poc.stage || "New"}</strong>
                  </div>
                  <div className="cc-inset">
                    <span className="cc-label">Company name</span>
                    <Link to={companyLink}>{lead.company_name}</Link>
                  </div>
                  <div className="cc-inset">
                    <span className="cc-label">
                      <Linkedin size={12} />
                      LinkedIn
                    </span>
                    <strong>{state?.linkedin || "Unknown"}</strong>
                  </div>
                </div>
              </section>
              <div className="cc-communication">
                <ContactActivity
                  key={`${id}:${version}`}
                  leadId={lead._id}
                  pocId={poc._id}
                  communicationOnly
                  onSaved={saved}
                  onChanged={saved}
                />
              </div>
              {workspace && (
                <BusinessEvents
                  key={`plan:${id}:${version}`}
                  data={workspace}
                  onSaved={async () => {
                    await reload();
                    toast.success("Business workspace updated");
                  }}
                  contactView
                />
              )}
              <div className="cc-stats">
                {[
                  {
                    label: "Total calls",
                    value: calls.length,
                    Icon: Phone,
                    action: "+ Quick Log",
                    click: () => setDialog("call"),
                    note: `Latest: ${calls[0]?.stage || "None"}`,
                  },
                  {
                    label: "Associated tasks",
                    value: visibleTasks.length,
                    Icon: CheckSquare,
                    action: "See pending tasks",
                    click: () => setTab("timeline"),
                    note: `${completed} / ${visibleTasks.length} completed`,
                  },
                  {
                    label: "Total remarks",
                    value: remarks.length,
                    Icon: MessageSquare,
                    action: "+ Add Note",
                    click: () => setDialog("remark"),
                    note: remarks[0]?.content || "No notes logged",
                  },
                ].map(({ label, value, Icon, action, click, note }) => (
                  <section key={label} className="cc-card">
                    <div className="cc-stat-head">
                      <Icon size={22} />
                      <div>
                        <span className="cc-label">{label}</span>
                        <strong>{value}</strong>
                      </div>
                    </div>
                    <p className="cc-micro cc-clamp">{note}</p>
                    <button className="cc-text-button" onClick={click}>
                      {action}
                    </button>
                  </section>
                ))}
              </div>
            </>
          )}
          {tab === "business" &&
            (workspace ? (
              <BusinessEvents
                key={`business:${id}:${version}`}
                data={workspace}
                onSaved={async () => {
                  await reload();
                  toast.success("Business workspace updated");
                }}
                contactView
              />
            ) : (
              <p className="cc-empty">
                Business records unavailable. Retry communication data.
              </p>
            ))}
          {tab === "timeline" && (
            <>
              <ContactTimeline
                data={data}
                workspace={workspace}
                onOlder={() => void olderHistory()}
                historyLoading={historyLoading}
              />
              <section className="cc-card">
                <header className="cc-section-heading">
                  <h2>
                    <CheckSquare size={16} />
                    Contact tasks
                  </h2>
                  <button
                    className="cc-text-button"
                    onClick={() => setDialog("task")}
                  >
                    + New Task
                  </button>
                </header>
                {visibleTasks.map((task) => (
                  <div className="cc-task" key={task._id}>
                    <div>
                      <strong>{task.title}</strong>
                      <p className="cc-muted">{task.description}</p>
                      <p className="cc-micro">
                        Due {displayTime(task.due_date)}
                      </p>
                    </div>
                    {task.completed ? (
                      <span className="cc-tag cc-success">Completed</span>
                    ) : (
                      <button
                        className="cc-button"
                        disabled={Boolean(busyTask)}
                        onClick={() => void completeTask(task)}
                      >
                        {busyTask === task._id ? "Saving…" : "Complete"}
                      </button>
                    )}
                  </div>
                ))}
                {!visibleTasks.length && (
                  <p className="cc-empty">No tasks linked to this contact.</p>
                )}
              </section>
            </>
          )}
        </div>
        <aside className="cc-account-rail">
          <section className="cc-card">
            <header className="cc-section-heading">
              <h2>
                <Building2 size={16} />
                Company
              </h2>
              <Link
                className="cc-text-button"
                to={`${prefix}/leads/${lead._id}`}
              >
                View Master Card
              </Link>
            </header>
            <div className="cc-inset">
              <div className="cc-company-name">
                <span className="cc-small-avatar">
                  {initials(lead.company_name)}
                </span>
                <div>
                  <h3>{lead.company_name}</h3>
                  <div className="cc-inline">
                    {website && (
                      <a href={website} target="_blank" rel="noreferrer">
                        Website <ExternalLink size={10} />
                      </a>
                    )}
                    {companyLinkedIn && (
                      <a
                        href={companyLinkedIn}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Linkedin size={11} />
                        LinkedIn
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <dl className="cc-facts">
                <div>
                  <dt>Industry</dt>
                  <dd>{lead.industry_name || "Not recorded"}</dd>
                </div>
                <div>
                  <dt>Headcount</dt>
                  <dd>{lead.company_size || "Not recorded"}</dd>
                </div>
                <div>
                  <dt>Hiring positions</dt>
                  <dd>{lead.no_of_positions ?? "Not recorded"}</dd>
                </div>
                <div>
                  <dt>Lifecycle</dt>
                  <dd>{lead.stage}</dd>
                </div>
              </dl>
            </div>
            {lead.company_info && (
              <p className="cc-muted cc-prewrap mt-3">{lead.company_info}</p>
            )}
            {lead.stage === "Onboarded" && (
              <div className="cc-inset cc-success mt-3">
                <strong>Client onboarded</strong>
                <p>Recorded company lifecycle status</p>
              </div>
            )}
          </section>
          <section className="cc-card">
            <header className="cc-section-heading">
              <h2>
                <Users size={16} />
                Other Contacts (
                {lead.points_of_contact.filter((p) => p._id !== poc._id).length}
                )
              </h2>
              <button
                className="cc-text-button"
                onClick={() => setDialog("add")}
              >
                <Plus size={12} />
                Add
              </button>
            </header>
            <div className="cc-other-contacts">
              {lead.points_of_contact.map((person) => (
                <Link
                  key={person._id}
                  to={`${prefix}/contacts/${person._id}`}
                  className={person._id === poc._id ? "is-current" : ""}
                  aria-current={person._id === poc._id ? "page" : undefined}
                >
                  <span className="cc-small-avatar">
                    {initials(person.name)}
                  </span>
                  <div>
                    <strong>{person.name || "Unnamed contact"}</strong>
                    <p>{person.designation || "Designation not provided"}</p>
                  </div>
                  {person._id === poc._id && (
                    <span className="cc-current-dot" />
                  )}
                </Link>
              ))}
            </div>
          </section>
          <section className="cc-card">
            <header className="cc-section-heading">
              <h2>
                <ClipboardList size={16} />
                Hiring Requirements ({lead.hiring_needs?.length || 0})
              </h2>
              <button
                className="cc-text-button"
                onClick={() => setDialog("requirements")}
              >
                + New
              </button>
            </header>
            {lead.hiring_needs?.length ? (
              lead.hiring_needs.map((need, index) => (
                <div key={`${need}:${index}`} className="cc-inset mb-2">
                  <strong>{need}</strong>
                  <p className="cc-micro">
                    {lead.stage} · Company hiring requirement
                  </p>
                </div>
              ))
            ) : (
              <p className="cc-empty">
                No hiring requirements recorded. Use + New to add them.
              </p>
            )}
            {workspace?.company.planning?.openRequirements != null && (
              <p className="cc-primary-text">
                <strong>
                  {workspace.company.planning.openRequirements} open positions
                  planned
                </strong>
              </p>
            )}
          </section>
          <ContactTimeline
            data={data}
            workspace={workspace}
            compact
            onMore={timeline}
          />
        </aside>
      </div>
      {(dialog === "activity" || dialog === "call") && (
        <ActivityDialog
          leadId={lead._id}
          pocId={poc._id}
          callMode={dialog === "call"}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
      <TaskModal
        isOpen={dialog === "task"}
        onClose={() => setDialog(null)}
        leadId={lead._id}
        pocId={poc._id}
        onSuccess={saved}
      />
      <RemarkModal
        isOpen={dialog === "remark"}
        onClose={() => setDialog(null)}
        leadId={lead._id}
        poc={poc as { _id: string; name: string }}
        onSuccess={saved}
      />
      <SendEmailModal
        open={dialog === "email"}
        onClose={() => {
          setDialog(null);
          saved();
        }}
        company={lead}
        poc={poc}
      />
      <AddPOCModal
        isOpen={dialog === "add"}
        onClose={() => setDialog(null)}
        leadId={lead._id}
        onSuccess={saved}
      />
      <EditPOCModal
        isOpen={dialog === "edit"}
        onClose={() => setDialog(null)}
        leadId={lead._id}
        poc={poc}
        onSuccess={saved}
      />
      {dialog === "requirements" && (
        <RequirementsDialog
          lead={lead}
          onClose={() => setDialog(null)}
          onSaved={async () => {
            await reload();
            toast.success("Requirements saved");
          }}
        />
      )}
    </div>
  );
}
