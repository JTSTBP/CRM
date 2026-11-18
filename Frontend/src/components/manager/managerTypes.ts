export interface Executive {
  _id: string;
  name: string;
  territories: string[];
  calls: number;
  connected: number;
  companies: number;
  whatsapp: number;
  email: number;
  linkedinSent: number;
  linkedinAccepted: number;
  proposals: number;
  proposalTarget: number;
  dailyProposals: number;
  dailyTarget: number;
  onboardings: number;
  onboardingTarget: number;
  pending: number;
  overdue: number;
  incomplete: number;
  workedContacts: number;
  reportStatus: string;
  submitted: boolean;
  score: number | null;
  parts: { label: string; weight: number; value: number | null }[];
}
export interface QueueRow {
  id: string;
  stateId?: string;
  leadId: string;
  company: string;
  pocId?: string;
  contact: string;
  ownerId: string;
  owner: string;
  reasons: string[];
  critical: boolean;
  dueAt?: string;
  callOutcome?: string;
  attempts?: number;
  daysUnreached?: number | null;
  nextAction?: string;
  linkedin?: string;
  linkedinFollowup?: string;
}
export interface ManagerData {
  today: string;
  generatedAt: string;
  range: { from: string; to: string; days: number };
  employees: { _id: string; name: string }[];
  territories: string[];
  companies: { _id: string; name: string; ownerIds: string[] }[];
  roster: Executive[];
  periodTotals: Record<string, number>;
  previousCalls: number;
  alerts: QueueRow[];
  queue: QueueRow[];
  followups: {
    id: string;
    leadId: string;
    company: string;
    title: string;
    ownerId: string;
    owner: string;
    dueAt: string;
  }[];
  stalledCount: number;
  compliance: {
    rate: number | null;
    submitted: number;
    total: number;
    incomplete: number;
    checklist: {
      label: string;
      rate: number | null;
      complete: number;
      total: number;
    }[];
  };
  health: {
    onTime: number;
    late: number;
    rate: number | null;
    overdue: number;
    dueToday: number;
    aging: { label: string; count: number }[];
  };
  callbacks: {
    busy: number;
    noAnswer: number;
    requested: number;
    unscheduled: string[];
  };
  recovery: { key: string; count: number }[];
  linkedin: {
    sent: number;
    pending: number;
    accepted: number;
    rejected: number;
    awaitingFollowup: number;
  };
  lifecycle: { stage: string; count: number }[];
  trend: {
    day: string;
    calls: number;
    connected: number;
    whatsapp: number;
    proposals: number;
  }[];
  funnel: { label: string; count: number }[];
  accountability: { score: number | null; provisional: boolean };
  remainingWorkingDays: number;
  plannedNextWeek: number;
  config: { cutoff: string };
  audit: {
    _id: string;
    kind: string;
    createdAt: string;
    leadId?: { company_name: string };
    data: { reason?: string; remarks?: string };
  }[];
}
export interface ManagerAction {
  kind:
    | "task"
    | "reassign"
    | "remind"
    | "compliance"
    | "research"
    | "corep"
    | "lifecycle";
  stateIds?: string[];
  leadId?: string;
  ownerId?: string;
  employeeIds?: string[];
}
export function exportCsv(name: string, rows: (string | number | null)[][]) {
  const cell = (value: string | number | null) => {
    const text = String(value ?? "");
    return (
      '"' +
      (/^[=+@\-\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""') +
      '"'
    );
  };
  const blob = new Blob(
    ["\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8;" },
  );
  const url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name + ".csv";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
