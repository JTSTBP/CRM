import { useEffect, useState } from "react";
import { API_BASE_URL } from "../../config";
import { fieldClass, primaryClass } from "./workspaceApi";

interface Company {
  _id: string;
  company_name?: string;
  website_url?: string;
}
interface Contact {
  _id: string;
  name?: string;
  phone?: string;
  approvalStatus?: string;
}
export default function ContactPicker({
  onSelect,
}: {
  onSelect: (lead: string, contact: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [leadId, setLeadId] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactId, setContactId] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/leads?search=${encodeURIComponent(search)}&limit=30`,
          {
            signal: controller.signal,
            headers: { "x-auth-token": localStorage.getItem("token") || "" },
          },
        );
        if (!response.ok) throw new Error("Could not load companies.");
        const data = await response.json();
        setCompanies(data.leads || []);
        setError("");
      } catch (error) {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Could not load companies.",
          );
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    setContacts([]);
    setContactId("");
    if (leadId)
      void fetch(`${API_BASE_URL}/api/leads/${leadId}`, {
        signal: controller.signal,
        headers: { "x-auth-token": localStorage.getItem("token") || "" },
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Could not load contacts.");
          const data = await response.json();
          setContacts(
            (data.points_of_contact || []).filter(
              (contact: Contact) =>
                !["pending", "rejected"].includes(contact.approvalStatus || ""),
            ),
          );
        })
        .catch((error) => {
          if (!controller.signal.aborted) setError(error.message);
        });
    return () => controller.abort();
  }, [leadId]);
  return (
    <div className="space-y-3 rounded-xl border border-sky-100 bg-sky-50/40 p-4">
      <p className="text-sm font-semibold">
        Choose a contact to record activity, a proposal, or completed
        onboarding.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-xs font-semibold">
          Find company
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setLeadId("");
              setContactId("");
            }}
            placeholder="Company name or domain"
            className={fieldClass}
          />
        </label>
        <label className="space-y-1 text-xs font-semibold">
          Company
          <select
            value={leadId}
            onChange={(event) => setLeadId(event.target.value)}
            className={fieldClass}
          >
            <option value="">Select company</option>
            {companies.map((company) => (
              <option key={company._id} value={company._id}>
                {company.company_name || company.website_url}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold">
          Contact
          <select
            value={contactId}
            onChange={(event) => setContactId(event.target.value)}
            className={fieldClass}
          >
            <option value="">Select approved contact</option>
            {contacts.map((contact) => (
              <option key={contact._id} value={contact._id}>
                {contact.name || contact.phone || "Contact"}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={!leadId || !contactId}
        onClick={() => onSelect(leadId, contactId)}
        className={primaryClass}
      >
        Open activity form
      </button>
    </div>
  );
}
