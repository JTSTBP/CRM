import type {
  ContactData,
  ContactPerson,
  ContactTask,
} from "../contacts/contactTypes";
import type {
  ContactState,
  ContactWorkspace,
  BusinessRecord,
} from "../bd/workspaceApi";
export interface CompanyUser {
  _id: string;
  name: string;
  role?: string;
  status?: string;
  reporter?: { _id: string; name: string; role: string };
}
export interface Mandate {
  _id: string;
  title: string;
  status: "Open" | "Sourcing" | "Paused" | "Filled" | "Cancelled";
  priority: "Low" | "Normal" | "High";
  positions: number;
  filled: number;
  submissions: number;
  interviews: number;
  location?: string;
  dueAt?: string;
  sourcingSlaDays?: number;
  note?: string;
  revision: number;
  ownerId: CompanyUser;
  createdAt: string;
}
export interface Proposal {
  _id: string;
  title: string;
  reference: string;
  scope: string;
  positions?: number;
  ownerId: string;
  reviewerId?: string;
  recipientPocIds: string[];
  status: "Draft" | "In Review" | "Approved" | "Rejected" | "Sent";
  followupAt?: string;
  reviewReason?: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export interface TimelineEntry {
  id: string;
  type: string;
  title: string;
  body?: string;
  at: string;
  actor?: string;
  pocId?: string;
  url?: string;
  details?: Record<string, unknown>;
}
export interface CompanyTimeline {
  items: TimelineEntry[];
  total: number;
  page: number;
}
export interface CompanyWorkspace {
  company: Omit<ContactData["lead"], "assignedBy" | "assignedTo"> & {
    updatedAt: string;
    status: string;
    company_email?: string;
    assignedBy?: CompanyUser;
    assignedTo?: CompanyUser[];
    createdBy?: CompanyUser;
    remarks: ContactData["remarks"];
    bdPlanning?: ContactWorkspace["company"]["planning"];
    companyProfile?: {
      headquarters?: string;
      businessModel?: string;
      footprint?: string;
      territory?: string;
      priority?: string;
      tier?: string;
    };
  };
  contacts: (ContactPerson & {
    decisionMaker?: boolean;
    primaryContact?: boolean;
    stakeholderTier?: string;
    stakeholderRole?: string;
    stakeholderNote?: string;
  })[];
  owners: CompanyUser[];
  reviewers: CompanyUser[];
  drafts: Proposal[];
  states: ContactState[];
  tasks: (ContactTask & { poc_id?: string; type?: string })[];
  business: BusinessRecord[];
  mandates: Mandate[];
  history: CompanyTimeline;
  config: ContactWorkspace["config"];
  stageEnteredAt: string | null;
  stageHistory: { stage: string; at: string }[];
  stats: {
    contacts: number;
    approvedContacts: number;
    decisionMakers: number;
    openPositions: number | null;
    proposals: number;
    awaitingFeedback: number;
    openFollowups: number;
    dueToday: number;
    calls: number;
    lastTouch: { at: string; label: string; pocId?: string } | null;
  };
}
export function businessWorkspace(data: CompanyWorkspace): ContactWorkspace {
  return {
    state: null,
    history: [],
    historyPage: 1,
    historyTotal: 0,
    calls: [],
    owners: data.owners,
    business: data.business,
    config: data.config,
    contact: { name: "Company account" },
    company: {
      _id: data.company._id,
      name: data.company.company_name,
      stage: data.company.stage,
      planning: data.company.bdPlanning,
    },
  };
}
export const journeyStages = [
  "New",
  "Contacted",
  "Proposal Sent",
  "Negotiation",
  "Won",
  "Onboarded",
];
export const companyTabs = [
  ["overview", "Overview"],
  ["contacts", "Contacts & Decision-Makers"],
  ["hiring", "Hiring Requirements"],
  ["proposals", "Proposals & Scope"],
  ["timeline", "Activity Timeline"],
  ["notes", "Notes & Documents"],
] as const;
