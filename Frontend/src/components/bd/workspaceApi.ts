import { API_BASE_URL } from "../../config";

export async function workspaceApi<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/bd-workspace${path}`, {
    method,
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-auth-token": localStorage.getItem("token") || "",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(data?.message || "Could not complete the request.");
  return data;
}
export const fieldClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100";
export const primaryClass =
  "rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50";
export const secondaryClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
export const displayTime = (date?: string) =>
  date
    ? new Date(date).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Not recorded";
export const toLocalInput = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

export interface ContactState {
  pocId?: string;
  _id: string;
  revision: number;
  ownerId: string;
  attempts: number;
  callOutcome?: string;
  lastCallAt?: string;
  firstUnsuccessfulAt?: string;
  callNotApplicable?: boolean;
  whatsapp?: string;
  email?: string;
  emailSubject?: string;
  linkedin?: string;
  linkedinUrl?: string;
  linkedinFollowup?: string;
  channelReason?: string;
  alternativePhone?: string;
  alternativeContact?: string;
  recovery?: Record<string, string>;
  recoveryReason?: string;
  nextAction?: string;
  dueAt?: string;
  remarks?: string;
  strategy?: string;
  linkedinSentAt?: string;
  linkedinAcceptedAt?: string;
  linkedinCheckedAt?: string;
  resolvedAt?: string;
}
export interface BusinessRecord {
  _id: string;
  kind: "proposal" | "onboarding";
  reference: string;
  status: string;
  sentAt: string;
}
export interface ContactWorkspace {
  state: ContactState | null;
  historyTotal: number;
  historyPage: number;
  owners: { _id: string; name: string }[];
  history: {
    _id: string;
    kind: string;
    createdAt: string;
    actorId?: { name: string };
    data: Record<string, unknown>;
  }[];
  calls: { _id: string; timestamp: string; stage: string; remarks?: string }[];
  business: BusinessRecord[];
  config: { requireAgreement: boolean; requireHandover: boolean };
  contact: {
    name: string;
    phone?: string;
    email?: string;
    linkedinUrl?: string;
    alternativePhone?: string;
  };
  company: {
    _id: string;
    name: string;
    stage: string;
    planning?: {
      qualifiedForProposal?: boolean;
      expectedOnboardingAt?: string;
      note?: string;
      openRequirements?: number;
      probability?: number;
    };
  };
}
