import type { ManagerData } from "../manager/managerTypes";
import type { MonitoringConfig } from "../bd/MonitoringSettings";
export interface AdminData extends ManagerData {
  accounts: { _id: string; name: string; stage: string; priority: string }[];
  config: MonitoringConfig;
  managers: { _id: string; name: string }[];
  recipients: string[];
  contactCount: number;
  urgent: number;
  managerMatrix: {
    _id: string;
    name: string;
    executives: string[];
    team: number;
    territories: string[];
    assigned: number;
    calls: number;
    connected: number;
    pending: number;
    overdue: number;
    incomplete: number;
    proposals: number;
    proposalTarget: number;
    onboardings: number;
    sla: number | null;
    stalled: number;
  }[];
  velocity: {
    stage: string;
    count: number;
    withoutCritical: number;
    dwellDays: number | null;
    recorded: number;
  }[];
  outcomes: { stage: string; count: number }[];
  proposals: {
    _id: string;
    leadId: string;
    company: string;
    title: string;
    reference: string;
    status: string;
    priority: string;
    followupAt?: string;
  }[];
  requirements: {
    positions: number;
    filled: number;
    active: number;
    activePositions: number;
  };
  qualified: {
    _id: string;
    name: string;
    expectedAt?: string;
    positions: number;
    probability: number | null;
  }[];
  executiveAudit: {
    _id: string;
    kind: string;
    actor: string;
    company?: string;
    createdAt: string;
    message: string;
  }[];
}
export interface DirectiveAction {
  kind: "directive" | "meeting";
  recipients?: string[];
  title?: string;
  message?: string;
}
