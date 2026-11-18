export interface ContactPerson {
  _id: string;
  name?: string;
  designation?: string;
  phone?: string;
  alternate_phone?: string;
  email?: string;
  linkedin_url?: string;
  stage?: string;
  approvalStatus?: string;
  createdAt?: string;
  requirementId?: string;
}
export interface ContactTask {
  _id: string;
  title: string;
  description?: string;
  completed: boolean;
  monitoringDisposition?: string;
  due_date: string;
  created_at: string;
}
export interface ContactData {
  poc: ContactPerson;
  lead: {
    _id: string;
    company_name: string;
    website_url?: string;
    linkedin_link?: string;
    industry_name?: string;
    company_size?: string;
    company_info?: string;
    lead_source?: string;
    hiring_needs?: string[];
    no_of_positions?: number;
    no_of_designations?: number;
    stage: string;
    createdAt: string;
    assignedBy?: { _id: string; name: string };
    assignedTo?: { _id: string; name: string }[];
    points_of_contact: ContactPerson[];
  };
  remarks: {
    _id: string;
    content?: string;
    created_at: string;
    profile?: { name: string };
    poc_id?: string;
    fileUrl?: string;
    voiceUrl?: string;
  }[];
  tasks: ContactTask[];
  activities: {
    _id: string;
    type: string;
    description: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }[];
  calls: {
    _id: string;
    timestamp: string;
    stage: string;
    remarks?: string;
    device?: string;
  }[];
}
export const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";
export function webLink(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(
      /^https?:\/\//i.test(value) ? value : `https://${value}`,
    );
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
