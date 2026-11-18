import { useEffect, useId, useState, type FormEvent } from "react";
import {
  workspaceApi,
  fieldClass,
  primaryClass,
  secondaryClass,
  displayTime,
  toLocalInput,
  type ContactWorkspace,
} from "./workspaceApi";
import BusinessEvents from "./BusinessEvents";

const channels = ["Sent", "Pending", "Failed", "Not Applicable"];
const linkedin = [
  "Not Sent",
  "Sent",
  "Pending",
  "Accepted",
  "Rejected",
  "Unknown",
];
const outcomes = [
  "Connected",
  "Busy",
  "No Answer",
  "Wrong Number",
  "Not Interested",
  "Callback Requested",
];
const recovery = {
  alternativeFound: "Alternative number found",
  alternativeVerified: "Alternative number verified",
  emailAvailable: "Valid email available",
  emailSent: "Personalized email sent",
  linkedinAvailable: "LinkedIn profile available",
  linkedinSent: "LinkedIn request sent",
  linkedinAccepted: "LinkedIn request accepted",
  decisionMaker: "Alternative decision-maker identified",
};
interface Props {
  leadId: string;
  pocId: string;
  onSaved?: (outcome?: string) => void;
  onChanged?: () => void;
  callMode?: boolean;
  businessKind?: "proposal" | "onboarding";
  communicationOnly?: boolean;
}

export default function ContactActivity({
  leadId,
  pocId,
  onSaved,
  onChanged,
  callMode = false,
  businessKind,
  communicationOnly = false,
}: Props) {
  const formId = useId();
  const [data, setData] = useState<ContactWorkspace | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(callMode);
  const [callOutcome, setCallOutcome] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    workspaceApi<ContactWorkspace>(
      `/contact/${leadId}/${pocId}`,
      "GET",
      undefined,
      controller.signal,
    )
      .then(setData)
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [leadId, pocId]);
  async function refresh() {
    const result = await workspaceApi<ContactWorkspace>(
      `/contact/${leadId}/${pocId}`,
    );
    setData(result);
    setVersion((value) => value + 1);
    setCallOutcome("");
  }
  async function olderHistory() {
    if (!data || saving) return;
    setSaving(true);
    try {
      const older = await workspaceApi<ContactWorkspace>(
        `/contact/${leadId}/${pocId}?historyPage=${data.historyPage + 1}`,
      );
      setData((current) =>
        current
          ? {
              ...current,
              historyPage: older.historyPage,
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
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not load history.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || saving) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const recoveryValues = Object.fromEntries(
      Object.keys(recovery).map((key) => [key, fields[`recovery.${key}`]]),
    );
    setSaving(true);
    setError("");
    try {
      await workspaceApi(`/contact/${leadId}/${pocId}`, "POST", {
        ...fields,
        callOutcome,
        recovery: recoveryValues,
        requestId,
        revision: data.state?.revision ?? 0,
        dueAt: fields.dueAt ? new Date(String(fields.dueAt)).toISOString() : "",
        whatsappConfirmed: fields.whatsappConfirmed === "on",
        emailConfirmed: fields.emailConfirmed === "on",
        linkedinConfirmed: fields.linkedinConfirmed === "on",
        linkedinFollowupConfirmed: fields.linkedinFollowupConfirmed === "on",
        callNotApplicable: fields.callNotApplicable === "on",
        meaningfulContactConfirmed: fields.meaningfulContactConfirmed === "on",
      });
      setRequestId(crypto.randomUUID());
      await refresh();
      setOpen(false);
      onSaved?.(callOutcome);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save activity.",
      );
    } finally {
      setSaving(false);
    }
  }
  const state = data?.state;
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Communication &amp; follow-ups
          </h2>
          <p className="text-xs text-slate-500">
            Record confirmed activity and the next client action.
          </p>
          {data && (
            <p className="mt-2 text-sm font-semibold text-sky-800">
              {data.company.name || "Company"} ·{" "}
              {data.contact.name || "Contact"}
            </p>
          )}
        </div>
        <button
          type="button"
          className={primaryClass}
          disabled={!data || saving}
          onClick={() => setOpen(!open)}
        >
          {open ? "Hide form" : "Update communication"}
        </button>
      </div>
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
          <button
            type="button"
            className={secondaryClass}
            onClick={() =>
              void refresh().catch((error) => setError(error.message))
            }
          >
            Reload
          </button>
        </div>
      )}
      {!data && !error && (
        <p className="text-sm text-slate-500">Loading communication history…</p>
      )}
      {data && (
        <>
          {callMode && data.contact.phone && (
            <a
              className="inline-flex rounded border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800"
              href={`tel:${data.contact.phone}`}
            >
              Dial {data.contact.phone}
            </a>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
            {[
              ["Last call", state?.callOutcome || "Not recorded"],
              ["WhatsApp", state?.whatsapp || "Pending"],
              ["Email", state?.email || "Pending"],
              ["LinkedIn", state?.linkedin || "Unknown"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-slate-50 p-2">
                <p className="text-slate-500">{label}</p>
                <p className="mt-1 font-semibold">{value}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {["whatsapp", "email", "linkedin"].map((channel) => (
              <button
                type="button"
                key={channel}
                className={secondaryClass}
                onClick={() => {
                  setOpen(true);
                  setTimeout(
                    () =>
                      document.getElementById(`${formId}-${channel}`)?.focus(),
                    0,
                  );
                }}
              >
                Update{" "}
                {channel === "whatsapp"
                  ? "WhatsApp"
                  : channel === "email"
                    ? "email"
                    : "LinkedIn"}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            {state?.attempts || 0} recorded attempts · Last call{" "}
            {displayTime(state?.lastCallAt)} · Next action{" "}
            {state?.nextAction ? `${state.nextAction} · ` : ""}
            {displayTime(state?.dueAt)}
          </p>
          <p className="text-xs text-slate-500">
            LinkedIn requested {displayTime(state?.linkedinSentAt)} · Accepted{" "}
            {displayTime(state?.linkedinAcceptedAt)} · Last verified{" "}
            {displayTime(state?.linkedinCheckedAt)}
          </p>
          {state?.linkedin === "Accepted" &&
            state.linkedinFollowup !== "Sent" && (
              <p className="rounded-lg bg-sky-50 p-2 text-xs text-sky-800">
                Send a personalized follow-up referencing your company’s hiring
                needs or the conversation you have already had.
              </p>
            )}
          {open && (
            <form
              key={version}
              onSubmit={submit}
              className="space-y-4 border-t border-slate-100 pt-4"
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="space-y-1 text-xs font-semibold">
                  Responsible BD executive
                  <select
                    name="ownerId"
                    defaultValue={state?.ownerId || data.owners[0]?._id || ""}
                    required
                    className={fieldClass}
                    disabled={Boolean(state)}
                  >
                    <option value="">Select executive</option>
                    {data.owners.map((owner) => (
                      <option key={owner._id} value={owner._id}>
                        {owner.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs font-semibold">
                  Call outcome
                  <select
                    value={callOutcome}
                    onChange={(event) => setCallOutcome(event.target.value)}
                    required={callMode}
                    className={fieldClass}
                  >
                    <option value="">
                      No new call — update other channels
                    </option>
                    {outcomes.map((outcome) => (
                      <option key={outcome}>{outcome}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-start gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    name="callNotApplicable"
                    defaultChecked={state?.callNotApplicable}
                  />
                  A call was not applicable for this outreach. Record the reason
                  below.
                </label>
                {(
                  ["whatsapp", "email", "linkedin", "linkedinFollowup"] as const
                ).map((channel) => (
                  <div
                    key={channel}
                    className="space-y-1 text-xs font-semibold"
                  >
                    <label htmlFor={`${formId}-${channel}`}>
                      {
                        {
                          whatsapp: "WhatsApp",
                          email: "Personalized email",
                          linkedin: "LinkedIn connection",
                          linkedinFollowup: "LinkedIn follow-up message",
                        }[channel]
                      }
                    </label>
                    <select
                      aria-label={`${channel} status`}
                      id={`${formId}-${channel}`}
                      name={channel}
                      defaultValue={
                        state?.[channel] ||
                        (channel === "linkedin" ? "Unknown" : "Pending")
                      }
                      className={fieldClass}
                    >
                      {(channel === "linkedin" ? linkedin : channels).map(
                        (status) => (
                          <option key={status}>{status}</option>
                        ),
                      )}
                    </select>
                    <label className="flex items-start gap-2 py-1 font-normal text-slate-600">
                      <input
                        aria-label={`${channel} manual confirmation`}
                        type="checkbox"
                        name={`${channel}Confirmed`}
                      />
                      {channel === "linkedin"
                        ? "I verified this connection status"
                        : "I confirm an externally sent message for this update"}
                    </label>
                  </div>
                ))}
                <label className="space-y-1 text-xs font-semibold">
                  LinkedIn profile URL
                  <input
                    type="url"
                    name="linkedinUrl"
                    defaultValue={
                      state?.linkedinUrl || data.contact.linkedinUrl || ""
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold">
                  Email subject
                  <input
                    name="emailSubject"
                    defaultValue={state?.emailSubject}
                    className={fieldClass}
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold">
                  Alternative phone
                  <input
                    name="alternativePhone"
                    defaultValue={
                      state?.alternativePhone || data.contact.alternativePhone
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold">
                  Alternative decision-maker details
                  <input
                    name="alternativeContact"
                    defaultValue={state?.alternativeContact}
                    className={fieldClass}
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold">
                  Next action
                  <input
                    name="nextAction"
                    defaultValue={state?.nextAction}
                    className={fieldClass}
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold">
                  Follow-up date and time (your local time)
                  <input
                    type="datetime-local"
                    name="dueAt"
                    defaultValue={
                      state?.dueAt && new Date(state.dueAt) > new Date()
                        ? toLocalInput(state.dueAt)
                        : ""
                    }
                    required={callOutcome === "Callback Requested"}
                    className={fieldClass}
                  />
                </label>
              </div>
              {["Busy", "No Answer"].includes(callOutcome) && (
                <p className="text-xs text-slate-500">
                  If you leave the time empty, a retry is scheduled for 10 AM
                  IST on the next configured working day.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-semibold">
                  Communication remarks
                  <textarea
                    name="remarks"
                    defaultValue={state?.remarks}
                    maxLength={2000}
                    rows={2}
                    className={fieldClass}
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold">
                  Reason for Not Applicable
                  <textarea
                    name="channelReason"
                    defaultValue={state?.channelReason}
                    rows={2}
                    className={fieldClass}
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold sm:col-span-2">
                  Contact strategy / meaningful contact notes
                  <textarea
                    name="strategy"
                    defaultValue={state?.strategy}
                    rows={2}
                    className={fieldClass}
                  />
                </label>
                <label className="flex gap-2 text-xs sm:col-span-2">
                  <input type="checkbox" name="meaningfulContactConfirmed" />I
                  confirm a meaningful two-way conversation occurred. Describe
                  it above.
                </label>
              </div>
              {(callOutcome === "Wrong Number" ||
                state?.callOutcome === "Wrong Number") && (
                <fieldset className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                  <legend className="px-1 text-sm font-bold">
                    Wrong Number — recovery checklist
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Object.entries(recovery).map(([key, label]) => (
                      <label
                        key={key}
                        className="space-y-1 text-xs font-semibold"
                      >
                        {label}
                        <select
                          name={`recovery.${key}`}
                          defaultValue={state?.recovery?.[key] || "Pending"}
                          className={fieldClass}
                        >
                          {[
                            "Completed",
                            "Pending",
                            "Not Available",
                            "Not Applicable",
                          ].map((value) => (
                            <option key={value}>{value}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  <label className="block space-y-1 text-xs font-semibold">
                    Explain unavailable or not applicable steps
                    <textarea
                      name="recoveryReason"
                      defaultValue={state?.recoveryReason}
                      className={fieldClass}
                    />
                  </label>
                </fieldset>
              )}
              <button disabled={saving} className={primaryClass}>
                {saving ? "Saving…" : "Save confirmed activity"}
              </button>
            </form>
          )}
          {!open && !communicationOnly && (
            <BusinessEvents
              initialKind={businessKind}
              data={data}
              onSaved={async () => {
                await refresh();
                onChanged?.();
              }}
            />
          )}
          {!communicationOnly && (
            <details className="rounded-xl border border-slate-200 p-3">
              <summary className="cursor-pointer text-sm font-semibold">
                Communication timeline
              </summary>
              <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                {data.history.map((event) => (
                  <article
                    key={event._id}
                    className="rounded-lg bg-slate-50 p-3 text-xs"
                  >
                    <p className="font-semibold">
                      {event.kind} · {event.actorId?.name || "Recorded user"} ·{" "}
                      {displayTime(event.createdAt)}
                    </p>
                    {event.kind === "activity" && (
                      <p className="mt-1">
                        {event.data.callLogged
                          ? `Call recorded: ${String(event.data.callOutcome)}`
                          : "Channel update"}{" "}
                        · WhatsApp {String(event.data.whatsapp)} · Email{" "}
                        {String(event.data.email)} · LinkedIn{" "}
                        {String(event.data.linkedin)}
                      </p>
                    )}
                    <p className="mt-1 whitespace-pre-wrap text-slate-600">
                      {String(
                        event.data.remarks ||
                          event.data.reason ||
                          event.data.strategy ||
                          "",
                      )}
                    </p>
                    {Boolean(event.data.nextAction) && (
                      <p className="mt-1">
                        Next action {String(event.data.nextAction)} ·{" "}
                        {displayTime(String(event.data.dueAt || ""))}
                      </p>
                    )}
                  </article>
                ))}
                {data.calls.map((call) => (
                  <p
                    key={call._id}
                    className="border-l-2 border-sky-200 pl-3 text-xs text-slate-600"
                  >
                    Call · {displayTime(call.timestamp)} · {call.stage} ·{" "}
                    {call.remarks}
                  </p>
                ))}
                {!data.history.length && !data.calls.length && (
                  <p className="text-xs text-slate-500">
                    No recorded communication history.
                  </p>
                )}
              </div>
              {data.history.length < data.historyTotal && (
                <button
                  type="button"
                  disabled={saving}
                  className={`${secondaryClass} mt-3`}
                  onClick={() => void olderHistory()}
                >
                  Load older communication records
                </button>
              )}
            </details>
          )}
        </>
      )}
    </section>
  );
}
