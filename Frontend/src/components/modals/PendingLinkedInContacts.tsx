import { useState, type FormEvent } from 'react';
import { Linkedin, Mail, Phone, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config';

interface PendingContact {
    _id: string;
    linkedin_url?: string;
    name?: string;
    designation?: string;
    phone?: string;
    alternate_phone?: string;
    email?: string;
    approvalStatus: 'pending' | 'rejected';
    rejectionReason?: string;
}

interface Props {
    leadId: string;
    contacts: PendingContact[];
    isAdmin: boolean;
    onChange: () => Promise<void>;
}

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm';
const buttonClass = 'rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50';
const alternativeInputClass = 'w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[0.7rem] font-bold outline-none focus:border-sky-500 disabled:bg-slate-50';

export default function PendingLinkedInContacts({ leadId, contacts, isAdmin, onChange }: Props) {
    const [saving, setSaving] = useState(false);
    const [addingAlternative, setAddingAlternative] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    async function submit(event: FormEvent<HTMLFormElement>, contactId?: string) {
        event.preventDefault();
        event.stopPropagation();
        if (saving) return;

        const form = event.currentTarget;
        const fields = Object.fromEntries(new FormData(form));
        const path = contactId ? `approve-poc/${contactId}` : 'poc';
        const body = contactId ? { details: fields } : { ...fields, approvalStatus: 'pending' };
        setSaving(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/leads/${leadId}/${path}`, {
                method: contactId ? 'PATCH' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': localStorage.getItem('token') || '',
                },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.message || 'Could not save the contact.');
            }
            form.reset();
            if (!contactId) setAddingAlternative(false);
            setEditingId(null);
            await onChange();
            toast.success(contactId ? 'Contact approved' : 'LinkedIn contact submitted for approval');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not save the contact.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-bold text-slate-700">Pending &amp; Rejected Contacts</h4>
                {!addingAlternative && (
                    <button type="button" onClick={() => setAddingAlternative(true)} className={buttonClass}>
                        Add Alternative
                    </button>
                )}
            </div>
            {addingAlternative && (
                <form onSubmit={event => submit(event)} className="space-y-3">
                    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-100/60 p-4 sm:grid-cols-2 lg:grid-cols-5">
                        {['Name', 'Phone', 'Alt Phone', 'Email'].map(label => (
                            <input key={label} aria-label={label} placeholder={label} disabled className={alternativeInputClass} />
                        ))}
                        <input
                            autoFocus
                            aria-label="LinkedIn profile URL"
                            name="linkedin_url"
                            type="url"
                            required
                            placeholder="LinkedIn profile URL"
                            className={alternativeInputClass}
                        />
                        <input aria-label="Stage" value="New" disabled className={alternativeInputClass} />
                    </div>
                    <p className="text-xs text-slate-500">Enter the LinkedIn profile URL. An admin fills in the remaining fields in Company Approvals.</p>
                    <div className="flex gap-3">
                        <button type="submit" disabled={saving} className={buttonClass}>Submit for approval</button>
                        <button type="button" disabled={saving} onClick={() => setAddingAlternative(false)} className="text-sm font-semibold text-slate-600">Cancel</button>
                    </div>
                </form>
            )}
            {contacts.length === 0 && <p className="text-sm text-slate-500">No pending or rejected contacts for this company.</p>}
            {contacts.map(contact => (
                <div key={contact._id} className="space-y-2 rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-500">
                                <User size={16} aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-bold text-sky-600">{contact.name || 'Name pending'}</span>
                                    {contact.approvalStatus === 'rejected' ? (
                                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[0.6rem] font-bold uppercase text-rose-700">Rejected</span>
                                    ) : (
                                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[0.6rem] font-bold uppercase text-amber-700">Pending approval</span>
                                    )}
                                </div>
                                <p className="text-[0.65rem] font-medium uppercase tracking-wider text-slate-400">{contact.designation || 'Position pending'}</p>
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-slate-600">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Phone size={12} className="text-slate-400" aria-hidden="true" />
                                        <span>{contact.phone || 'Phone pending'}</span>
                                        {contact.alternate_phone && <span className="font-medium text-slate-500">/ {contact.alternate_phone}</span>}
                                    </div>
                                    <div className="flex min-w-0 items-center gap-2">
                                        <Mail size={12} className="shrink-0 text-slate-400" aria-hidden="true" />
                                        <span className="break-all">{contact.email || 'Email pending'}</span>
                                    </div>
                                    {contact.linkedin_url && (
                                        <div className="flex min-w-0 items-center gap-2">
                                            <Linkedin size={12} className="shrink-0 text-slate-400" aria-hidden="true" />
                                            {/^https:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\//i.test(contact.linkedin_url) ? (
                                                <a href={contact.linkedin_url} target="_blank" rel="noreferrer" className="break-all text-sky-700 hover:underline">LinkedIn profile</a>
                                            ) : <span className="break-all">{contact.linkedin_url}</span>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        {isAdmin && contact.approvalStatus === 'pending' && editingId !== contact._id && (
                            <button type="button" disabled={saving} onClick={() => setEditingId(contact._id)} className="text-sm font-semibold text-sky-700">
                                Review
                            </button>
                        )}
                    </div>
                    {contact.approvalStatus === 'rejected' && (
                        <p className="whitespace-pre-wrap break-words rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-800">
                            <strong className="mr-1">Rejection reason</strong>
                            {contact.rejectionReason || 'No reason was recorded.'}
                        </p>
                    )}
                    {isAdmin && contact.approvalStatus === 'pending' && editingId === contact._id && (
                        <form onSubmit={event => submit(event, contact._id)} className="grid gap-3 sm:grid-cols-2">
                            {([
                                ['name', 'Name', 'text', true],
                                ['phone', 'Phone', 'tel', true],
                                ['designation', 'Designation', 'text', false],
                                ['email', 'Email', 'email', false],
                            ] as const).map(([field, label, type, required]) => (
                                <label key={field} className="space-y-1 text-xs font-semibold text-slate-600">
                                    {label}
                                    <input name={field} type={type} required={required} defaultValue={contact[field]} className={inputClass} />
                                </label>
                            ))}
                            <div className="flex gap-3 sm:col-span-2">
                                <button type="submit" disabled={saving} className={buttonClass}>Save and approve</button>
                                <button type="button" disabled={saving} onClick={() => setEditingId(null)} className="text-sm font-semibold text-slate-600">Cancel</button>
                            </div>
                        </form>
                    )}
                </div>
            ))}
        </section>
    );
}
