import { useCallback, useEffect, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  FileText,
  Flag,
  Gauge,
  Globe,
  Layers,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Phone,
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import { workspaceApi, displayTime } from "../../components/bd/workspaceApi";
import BusinessEvents from "../../components/bd/BusinessEvents";
import LogContactActivity from "../../components/company/LogContactActivity";
import { initials, webLink } from "../../components/contacts/contactTypes";
import RequirementsDialog from "../../components/contacts/RequirementsDialog";
import CompanyDialog, {
  type CompanyAction,
} from "../../components/company/CompanyDialog";
import CompanyBusinessDialog from "../../components/company/CompanyBusinessDialog";
import CompanyStakeholders from "../../components/company/CompanyStakeholders";
import CompanyTimeline from "../../components/company/CompanyTimeline";
import {
  CompanyAgenda,
  CompanyNotes,
  Mandates,
  ProposalScopes,
  Stakeholders,
} from "../../components/company/CompanySections";
import {
  businessWorkspace,
  companyTabs,
  journeyStages,
  type CompanyWorkspace,
  type Proposal,
} from "../../components/company/companyTypes";
import AddPOCModal from "../../components/modals/AddPOCModal";
import LeadModal from "../../components/modals/LeadModal";
import TaskModal from "../../components/modals/TaskModal";
import SendEmailModal from "../../components/modals/SendEmailModal";
import PendingLinkedInContacts from "../../components/modals/PendingLinkedInContacts";
import "../../components/contacts/contactDetail.css";
import "../../components/company/companyDetail.css";

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>(),
    location = useLocation();
  const [params] = useSearchParams();
  const prefix = location.pathname.startsWith("/admin")
    ? "/admin"
    : location.pathname.startsWith("/manager")
      ? "/manager"
      : "/bd";
  const [data, setData] = useState<CompanyWorkspace | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState(
    params.get("tab") === "tasks"
      ? "overview"
      : companyTabs.some(([key]) => key === params.get("tab"))
        ? params.get("tab")!
        : "overview",
  );
  const [taskContact, setTaskContact] = useState<string | undefined>();
  const [action, setAction] = useState<CompanyAction | null>(null),
    [addContact, setAddContact] = useState(false),
    [edit, setEdit] = useState(false),
    [task, setTask] = useState(false),
    [requirements, setRequirements] = useState(false),
    [more, setMore] = useState(false);
  const [activity, setActivity] = useState<{
      id: string;
      call?: boolean;
    } | null>(null),
    [emailContact, setEmailContact] = useState<string | null>(null),
    [business, setBusiness] = useState<{
      kind: "proposal" | "onboarding";
      proposal?: Proposal;
    } | null>(null);
  const currentId = useRef(id);
  currentId.current = id;
  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      setRefreshing(true);
      setError("");
      try {
        const result = await workspaceApi<CompanyWorkspace>(
          `/company/${id}`,
          "GET",
          undefined,
          signal,
        );
        if (!signal?.aborted && currentId.current === id) setData(result);
      } catch (err) {
        if (!signal?.aborted && currentId.current === id)
          setError(
            err instanceof Error ? err.message : "Could not load company.",
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
    setLoading(true);
    setAction(null);
    setActivity(null);
    setAddContact(false);
    setEdit(false);
    setTask(false);
    setTaskContact(undefined);
    setRequirements(false);
    setMore(false);
    setEmailContact(null);
    setBusiness(null);
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  const saved = async () => {
    await load();
  };
  const savedNotice = async () => {
    await load();
    toast.success("Company workspace updated");
  };
  if (loading)
    return (
      <div className="contact-command company-command co-empty" role="status">
        Loading company workspace…
      </div>
    );
  if (!data)
    return (
      <div className="contact-command company-command co-card">
        <p role="alert">{error || "Company not found."}</p>
        <button className="co-button" onClick={() => void load()}>
          Retry
        </button>
        <Link to={`${prefix}/leads`}>Back to Companies List</Link>
      </div>
    );
  const { company, stats } = data,
    profile = company.companyProfile || {};
  const mainContact =
    data.contacts.find((person) => person.primaryContact) ||
    data.contacts.find((person) => person.decisionMaker) ||
    data.contacts[0];
  const owners = company.assignedTo?.length
    ? company.assignedTo
    : company.assignedBy
      ? [company.assignedBy]
      : [];
  const managers = [
    ...new Set(owners.map((owner) => owner.reporter?.name).filter(Boolean)),
  ].join(", ");
  const openTasks = data.tasks.filter((item) => !item.completed),
    nextTask = openTasks[0],
    isOverdue = nextTask && new Date(nextTask.due_date) < new Date();
  const nextContact =
    data.contacts.find((person) => person._id === nextTask?.poc_id) ||
    mainContact;
  const state = data.states.find((item) => item.pocId === nextContact?._id);
  const stageDays = data.stageEnteredAt
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(data.stageEnteredAt).getTime()) / 86400000,
        ),
      )
    : null;
  const elapsed = Math.max(
    0,
    Math.floor((Date.now() - new Date(company.createdAt).getTime()) / 86400000),
  );
  const pendingContacts = company.points_of_contact.filter((person) =>
    ["pending", "rejected"].includes(person.approvalStatus || ""),
  );
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const date = (value?: string | null) =>
    value
      ? new Date(value).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Kolkata",
        })
      : "Not recorded";
  const contacts = () => setTab("contacts");
  const call = (contactId?: string, callMode = false) => {
    if (contactId) setActivity({ id: contactId, call: callMode });
    else setAddContact(true);
  };
  const addProposal = () => setAction({ kind: "proposal" });
  const sendProposal = (proposal: Proposal) => {
    const recipient = proposal.recipientPocIds.find((pocId) =>
      data.contacts.some((person) => person._id === pocId && person.email),
    );
    if (recipient) setEmailContact(recipient);
    else toast.error("Add an email address to a proposal recipient first.");
  };
  const stakeholders = (compact = false) => (
    <Stakeholders
      data={data}
      prefix={prefix}
      onAdd={() => setAddContact(true)}
      onRole={setAction}
      onCall={(id) => call(id)}
      compact={compact}
    />
  );
  const mandates = (compact = false) => (
    <Mandates
      data={data}
      onAction={setAction}
      onSummary={() => setRequirements(true)}
      compact={compact}
    />
  );
  const proposals = (compact = false) => (
    <ProposalScopes
      data={data}
      onAction={setAction}
      onSend={sendProposal}
      onDispatch={(proposal) => setBusiness({ kind: "proposal", proposal })}
      onAdd={addProposal}
      compact={compact}
    />
  );
  const contactEmail = data.contacts.find(
    (person) => person._id === emailContact,
  );
  return (
    <div className="contact-command company-command">
      <div className="co-toolbar">
        <div>
          <Link to={`${prefix}/leads`}>
            <ArrowLeft size={15} />
            Back to Companies List
          </Link>
          <span className="co-muted">
            {" "}
            / Companies / {company.company_name}
          </span>
          <h2>Company 360° Workspace</h2>
        </div>
        <div className="co-actions">
          <button className="co-button" onClick={() => setAddContact(true)}>
            <Users size={16} />
            Add Contact
          </button>
          <button className="co-button" onClick={() => setTask(true)}>
            <Calendar size={16} />
            Add Follow-up
          </button>
          <button className="co-button" onClick={addProposal}>
            <FileText size={16} />
            Add Proposal
          </button>
          <button
            className="co-button co-primary"
            onClick={() => setEdit(true)}
          >
            <Pencil size={16} />
            Edit Company
          </button>
          <div className="co-more">
            <button
              className="co-button co-icon"
              aria-label="More company options"
              aria-expanded={more}
              onClick={() => setMore(!more)}
            >
              <MoreHorizontal size={18} />
            </button>
            {more && (
              <div className="co-menu">
                <button
                  onClick={() => {
                    setMore(false);
                    void load();
                  }}
                  disabled={refreshing}
                >
                  <RefreshCw size={14} />
                  Refresh company
                </button>
                <button
                  onClick={() => {
                    setMore(false);
                    setAction({ kind: "profile" });
                  }}
                >
                  Edit company intelligence
                </button>
                <button
                  onClick={() => {
                    setMore(false);
                    setAction({ kind: "note" });
                  }}
                >
                  Add note / document
                </button>
                <button
                  onClick={() => {
                    setMore(false);
                    setBusiness({ kind: "onboarding" });
                  }}
                >
                  Record client activation
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {error && (
        <div className="co-error" role="alert">
          {error}
          <button className="co-text" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}
      <section className="co-card co-hero">
        <div className="co-company-avatar">
          {initials(company.company_name)}
        </div>
        <div className="co-hero-main">
          <div className="co-title-row">
            <h1>{company.company_name}</h1>
            {webLink(company.website_url) && (
              <a
                className="co-badge"
                href={webLink(company.website_url)}
                target="_blank"
                rel="noreferrer"
              >
                <Globe size={13} />
                {company.website_url
                  ?.replace(/^https?:\/\//, "")
                  .replace(/\/$/, "")}{" "}
                ↗
              </a>
            )}
            {webLink(company.linkedin_link) && (
              <a
                className="co-badge co-neutral"
                href={webLink(company.linkedin_link)}
                target="_blank"
                rel="noreferrer"
              >
                LinkedIn ↗
              </a>
            )}
          </div>
          <p>
            <Building2 size={15} />
            {company.industry_name || "Industry not recorded"} <span>·</span>
            <Users size={15} />
            {company.company_size || "Headcount not recorded"}
          </p>
          <p>
            <MapPin size={15} />
            HQ: {profile.headquarters || "Not recorded"}
            <span>·</span>
            <Briefcase size={15} />
            Assigned:{" "}
            <strong>
              {owners.map((owner) => owner.name).join(", ") || "Unassigned"}
            </strong>
          </p>
          <p>
            <Shield size={15} />
            Manager: {managers || "Not recorded"}
          </p>
          <p className="co-hero-meta">
            Lead Source:{" "}
            <strong>{company.lead_source || "Not recorded"}</strong>
            <span>·</span>Created: {date(company.createdAt)}
            <span>·</span>Last updated: {displayTime(company.updatedAt)}
          </p>
        </div>
        <div className="co-hero-badges">
          <span className="co-badge">
            {company.stage === "Onboarded"
              ? "Client onboarded"
              : company.stage === "Lost"
                ? "Closed opportunity"
                : "Active prospect"}{" "}
            · {company.stage}
          </span>
          <span className="co-badge co-purple">
            {profile.priority || "Normal"} priority
          </span>
          {stats.openPositions !== null && (
            <span className="co-badge">
              Hiring: {stats.openPositions} open positions
            </span>
          )}
          <span className="co-badge co-neutral">
            {company.status === "approved" ? "Approved record" : company.status}
          </span>
        </div>
      </section>
      <section className="co-card co-journey">
        <header>
          <span className="co-label">Account journey stage</span>
          <span className="co-badge">
            {stageDays === null
              ? "Stage entry date unknown"
              : `In stage: ${stageDays} days`}
          </span>
          {company.stage === "Contacted" &&
            stageDays !== null &&
            stageDays >= 2 && (
              <p className="co-stage-notice">
                Stage review: Contacted for over 48 hours. Review the next
                account action.
              </p>
            )}
          <div className="co-outcomes">
            <span>Outcomes:</span>
            {["Lost", "No vendor", "Future Reference"].map((stage) => (
              <button
                key={stage}
                onClick={() => setAction({ kind: "stage", stage })}
              >
                {stage}
              </button>
            ))}
          </div>
        </header>
        <div className="co-stage-grid">
          {journeyStages.map((stage, index) => {
            const logged = data.stageHistory.find(
              (item) => item.stage === stage,
            );
            return (
              <button
                key={stage}
                className={`${company.stage === stage ? "is-current" : ""} ${logged ? "is-recorded" : ""}`}
                onClick={() => setAction({ kind: "stage", stage })}
              >
                <strong>
                  {String(index + 1).padStart(2, "0")}.{" "}
                  {stage === "Won" ? "Mandate Won" : stage}
                </strong>
                <span className="co-stage-track" />
                <span>
                  {company.stage === stage
                    ? "Active stage"
                    : logged
                      ? "Recorded milestone"
                      : "Upcoming stage"}
                </span>
                <small>
                  {logged ? date(logged.at) : "No milestone date recorded"}
                </small>
              </button>
            );
          })}
        </div>
      </section>
      <section className="co-kpis" aria-label="Company account metrics">
        {[
          {
            label: "Total contacts",
            value: stats.contacts,
            detail: `${stats.approvedContacts} approvals recorded`,
            Icon: Users,
            click: contacts,
          },
          {
            label: "Decision makers",
            value: stats.decisionMakers,
            detail: "Explicitly marked stakeholders",
            Icon: Flag,
            click: contacts,
          },
          {
            label: "Active openings",
            value: stats.openPositions ?? "—",
            detail: "Remaining positions",
            Icon: Briefcase,
            click: () => setTab("hiring"),
          },
          {
            label: "Proposals",
            value: stats.proposals,
            detail: `${stats.awaitingFeedback} awaiting feedback`,
            Icon: FileText,
            click: () => setTab("proposals"),
          },
          {
            label: "Open follow-ups",
            value: stats.openFollowups,
            detail: `${stats.dueToday} due today`,
            Icon: Calendar,
            click: () => setTask(true),
          },
          {
            label: "Last touch",
            value: stats.lastTouch ? date(stats.lastTouch.at) : "Not recorded",
            detail: stats.lastTouch?.label || "No confirmed activity yet",
            Icon: MessageSquare,
            click: () => setTab("timeline"),
          },
        ].map(({ label, value, detail, Icon, click }) => (
          <button className="co-card" key={label} onClick={click}>
            <span className="co-kpi-title">
              {label}
              <Icon size={18} />
            </span>
            <strong>{value}</strong>
            <span className="co-muted">{detail}</span>
          </button>
        ))}
      </section>
      <nav className="co-tabs" aria-label="Company sections">
        {companyTabs.map(([key, label]) => (
          <button
            aria-pressed={tab === key}
            key={key}
            onClick={() => setTab(key)}
          >
            {key === "overview" ? (
              <Layers size={16} />
            ) : key === "contacts" ? (
              <Users size={16} />
            ) : key === "hiring" ? (
              <Briefcase size={16} />
            ) : key === "proposals" ? (
              <FileText size={16} />
            ) : key === "notes" ? (
              <MessageSquare size={16} />
            ) : (
              <Calendar size={16} />
            )}{" "}
            {label}
            {key === "contacts"
              ? ` (${stats.contacts})`
              : key === "hiring"
                ? ` (${data.mandates.filter((record) => ["Open", "Sourcing", "Paused"].includes(record.status)).length} active)`
                : ""}
          </button>
        ))}
      </nav>
      <div
        className={`co-body-grid ${tab === "contacts" ? "st-contact-layout" : ""}`}
      >
        <div className="co-main-column">
          {tab === "overview" && (
            <>
              <section className="co-card co-next-action">
                <header className="co-section-head">
                  <h2>
                    <Zap size={22} />
                    Priority BD Next Best Action
                  </h2>
                </header>
                <span className={`co-badge ${isOverdue ? "co-danger" : ""}`}>
                  {nextTask
                    ? isOverdue
                      ? "Overdue follow-up"
                      : "Scheduled account action"
                    : "Plan next outreach"}
                </span>
                <h2 className="co-action-title">
                  {nextTask?.title ||
                    `Connect with ${nextContact?.name || "a company stakeholder"}`}
                </h2>
                <p className="co-muted co-prewrap">
                  {nextTask?.description ||
                    state?.nextAction ||
                    "Record a meaningful client conversation and confirm the next step for this account."}
                </p>
                <div className="co-inset co-execution">
                  <Target size={22} />
                  <div>
                    <span className="co-label">Target execution window</span>
                    <strong>
                      {nextTask
                        ? displayTime(nextTask.due_date)
                        : "Schedule the next action"}
                    </strong>
                    <p className="co-muted">
                      Contact: {nextContact?.name || "No contact added yet"} ·{" "}
                      {nextContact?.designation || "Role not recorded"}
                    </p>
                  </div>
                </div>
                <div className="co-actions">
                  <button
                    className="co-button co-primary"
                    onClick={() => call(nextContact?._id, true)}
                  >
                    <Phone size={16} />
                    {nextContact
                      ? "Open contact call workflow"
                      : "Add account contact"}
                  </button>
                  <button className="co-button" onClick={() => setTask(true)}>
                    <Calendar size={16} />
                    Schedule Follow-up
                  </button>
                  {nextContact && (
                    <Link
                      className="co-button"
                      to={`${prefix}/contacts/${nextContact._id}`}
                    >
                      View Contact Workspace <ArrowRight size={15} />
                    </Link>
                  )}
                </div>
              </section>
              <section className="co-card">
                <header className="co-section-head">
                  <h2>
                    <Gauge size={18} />
                    Client Engagement Health
                  </h2>
                  <span className={`co-badge ${isOverdue ? "co-danger" : ""}`}>
                    {isOverdue
                      ? "Follow-up overdue"
                      : stats.openFollowups
                        ? "Follow-up scheduled"
                        : "Next action needed"}
                  </span>
                </header>
                <div className="co-mini-grid">
                  {[
                    [
                      "Last touchpoint",
                      stats.lastTouch?.label || "Not recorded",
                      displayTime(stats.lastTouch?.at),
                    ],
                    [
                      "Days in CRM",
                      `${elapsed} days`,
                      "Since company creation",
                    ],
                    [
                      "Outreach status",
                      `${stats.calls} recorded calls`,
                      `${data.contacts.length} approved / legacy contacts`,
                    ],
                    [
                      "Follow-up status",
                      stats.openFollowups
                        ? `${stats.openFollowups} open tasks`
                        : "No open tasks",
                      `${stats.dueToday} due today`,
                    ],
                  ].map(([label, value, detail]) => (
                    <div key={label}>
                      <span className="co-label">{label}</span>
                      <strong>{value}</strong>
                      <p className="co-muted">{detail}</p>
                    </div>
                  ))}
                </div>
                <div className="co-stage-progress">
                  <span>Journey position: {company.stage}</span>
                  <progress
                    value={Math.max(0, journeyStages.indexOf(company.stage))}
                    max={5}
                    aria-label="Current account journey position"
                  />
                </div>
              </section>
              <section className="co-card">
                <header className="co-section-head">
                  <h2>
                    <Flag size={18} />
                    Opportunity & Onboarding Milestones
                  </h2>
                  <button
                    className="co-text"
                    onClick={() => setTab("proposals")}
                  >
                    View full scope →
                  </button>
                </header>
                <div className="co-milestones">
                  {[
                    {
                      name: "Qualified",
                      done: company.bdPlanning?.qualifiedForProposal,
                      detail: "Opportunity plan",
                    },
                    {
                      name: "Proposal scope",
                      done: data.drafts.length > 0,
                      detail: data.drafts[0]?.status || "Not drafted",
                    },
                    {
                      name: "Client sign-off",
                      done: data.business.some(
                        (record) => record.status === "Accepted",
                      ),
                      detail: "Confirmed client response",
                    },
                    {
                      name: "Onboarding",
                      done: data.business.some(
                        (record) => record.kind === "onboarding",
                      ),
                      detail: "Verified activation",
                    },
                  ].map((milestone) => (
                    <div key={milestone.name}>
                      <span className={milestone.done ? "is-done" : ""}>
                        {milestone.done ? (
                          <CheckCircle2 size={20} />
                        ) : (
                          <Flag size={20} />
                        )}
                      </span>
                      <strong>{milestone.name}</strong>
                      <p>{milestone.detail}</p>
                    </div>
                  ))}
                </div>
                <div className="co-mini-grid">
                  <div>
                    <span className="co-label">Open positions planned</span>
                    <strong>
                      {company.bdPlanning?.openRequirements ?? "Not recorded"}
                    </strong>
                  </div>
                  <div>
                    <span className="co-label">
                      Win probability (estimated)
                    </span>
                    <strong>
                      {company.bdPlanning?.probability != null
                        ? `${company.bdPlanning.probability}%`
                        : "Not recorded"}
                    </strong>
                  </div>
                  <div>
                    <span className="co-label">Expected onboarding</span>
                    <strong>
                      {date(company.bdPlanning?.expectedOnboardingAt)}
                    </strong>
                  </div>
                  <div>
                    <span className="co-label">Verified activations</span>
                    <strong>
                      {
                        data.business.filter(
                          (record) => record.kind === "onboarding",
                        ).length
                      }
                    </strong>
                  </div>
                </div>
                <div className="co-actions mt-4">
                  <button
                    className="co-text"
                    onClick={() => setTab("proposals")}
                  >
                    Edit opportunity plan
                  </button>
                  <button
                    className="co-text"
                    onClick={() => setBusiness({ kind: "onboarding" })}
                  >
                    Record client activation
                  </button>
                </div>
              </section>
              {proposals(true)}
              {mandates(true)}
              {stakeholders(true)}
              <CompanyTimeline
                leadId={company._id}
                initial={data.history}
                compact
                onMore={() => setTab("timeline")}
              />
            </>
          )}
          {tab === "contacts" && (
            <>
              <CompanyStakeholders
                data={data}
                prefix={prefix}
                onRole={setAction}
                onCall={(id) => call(id, true)}
                onEmail={setEmailContact}
                onSchedule={(id) => {
                  setTaskContact(id);
                  setTask(true);
                }}
              />
              <PendingLinkedInContacts
                leadId={company._id}
                contacts={
                  pendingContacts as Parameters<
                    typeof PendingLinkedInContacts
                  >[0]["contacts"]
                }
                isAdmin={user.role === "Admin"}
                onChange={saved}
              />
            </>
          )}
          {tab === "hiring" && mandates()}
          {tab === "proposals" && (
            <>
              {proposals()}
              <div className="co-business">
                <BusinessEvents
                  key={company.updatedAt + String(data.business.length)}
                  data={businessWorkspace(data)}
                  onSaved={savedNotice}
                  contactView
                />
              </div>
            </>
          )}
          {tab === "timeline" && (
            <CompanyTimeline leadId={company._id} initial={data.history} />
          )}
          {tab === "notes" && (
            <CompanyNotes
              data={data}
              onAdd={() => setAction({ kind: "note" })}
            />
          )}
        </div>
        <aside className="co-side-column">
          <section className="co-card">
            <header className="co-section-head">
              <h2>
                <Sparkles size={18} />
                Company Intelligence
              </h2>
              <button
                className="co-text"
                onClick={() => setAction({ kind: "profile" })}
              >
                Edit
              </button>
            </header>
            <dl className="co-facts">
              {[
                ["Industry", company.industry_name],
                ["Business model", profile.businessModel],
                ["Company size", company.company_size],
                ["Headquarters", profile.headquarters],
                ["Store / operating footprint", profile.footprint],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value || "Not recorded"}</dd>
                </div>
              ))}
            </dl>
            {company.company_info && (
              <p className="co-muted co-prewrap">{company.company_info}</p>
            )}
          </section>
          <section className="co-card">
            <header className="co-section-head">
              <h2>
                <Shield size={18} />
                Ownership & Governance
              </h2>
            </header>
            {owners.map((owner) => (
              <div className="co-owner co-inset" key={owner._id}>
                <span className="co-user-avatar">{initials(owner.name)}</span>
                <div>
                  <strong>{owner.name}</strong>
                  <p className="co-muted">
                    {owner.role || "Assigned executive"}
                  </p>
                </div>
              </div>
            ))}
            <dl className="co-facts">
              {[
                ["Reporting manager", managers],
                ["Operating territory", profile.territory],
                ["Account created", date(company.createdAt)],
                ["Last record update", displayTime(company.updatedAt)],
                ["Account tier", profile.tier],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value || "Not recorded"}</dd>
                </div>
              ))}
            </dl>
          </section>
          <CompanyAgenda
            data={data}
            onAdd={() => setTask(true)}
            onSaved={saved}
            onOpenTask={(contactId) => call(contactId)}
          />
          <section className="co-card">
            <header className="co-section-head">
              <h2>
                <MessageSquare size={18} />
                BD Scratchpad
              </h2>
              <button
                className="co-text"
                onClick={() => setAction({ kind: "note" })}
              >
                + Add Note
              </button>
            </header>
            {company.remarks.length ? (
              <>
                <p className="co-inset co-prewrap">
                  {company.remarks[company.remarks.length - 1].content}
                </p>
                <p className="co-micro mt-2">
                  {company.remarks[company.remarks.length - 1].profile?.name} ·{" "}
                  {displayTime(
                    company.remarks[company.remarks.length - 1].created_at,
                  )}
                </p>
                <button
                  className="co-text mt-2"
                  onClick={() => setTab("notes")}
                >
                  All notes & documents →
                </button>
              </>
            ) : (
              <p className="co-empty">No account notes recorded.</p>
            )}
          </section>
        </aside>
      </div>
      {action && (
        <CompanyDialog
          data={data}
          action={action}
          onClose={() => setAction(null)}
          onSaved={savedNotice}
        />
      )}
      {business && (
        <CompanyBusinessDialog
          data={data}
          kind={business.kind}
          proposal={business.proposal}
          onClose={() => setBusiness(null)}
          onSaved={savedNotice}
        />
      )}
      {requirements && (
        <RequirementsDialog
          lead={company}
          onClose={() => setRequirements(false)}
          onSaved={savedNotice}
        />
      )}
      {activity && (
        <LogContactActivity
          leadId={company._id}
          pocId={activity.id}
          onClose={() => setActivity(null)}
          onSaved={() => void saved()}
        />
      )}
      <AddPOCModal
        isOpen={addContact}
        leadId={company._id}
        onClose={() => setAddContact(false)}
        onSuccess={() => void saved()}
      />
      <TaskModal
        isOpen={task}
        pocId={taskContact}
        leadId={company._id}
        onClose={() => {
          setTask(false);
          setTaskContact(undefined);
        }}
        onSuccess={() => void saved()}
      />
      {edit && (
        <LeadModal
          isOpen
          leadId={company._id}
          initialMode="edit"
          onClose={() => {
            setEdit(false);
            void saved();
          }}
          onUpdate={() => void saved()}
        />
      )}
      <SendEmailModal
        open={Boolean(contactEmail)}
        company={company}
        poc={contactEmail || null}
        onClose={() => {
          setEmailContact(null);
          void saved();
        }}
      />
    </div>
  );
}
