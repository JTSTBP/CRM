import { useState, type FormEvent } from "react";
import { workspaceApi, fieldClass, primaryClass } from "./workspaceApi";

export interface MonitoringConfig {
  cutoff: string;
  workingDays: number[];
  holidays: string[];
  linkedinDays: number;
  recoveryDays: number;
  callbackNoticeMinutes: number;
  proposalTarget: number;
  onboardingTarget: number;
  requireAgreement: boolean;
  requireHandover: boolean;
}
export default function MonitoringSettings({
  config,
  employees,
  onSaved,
}: {
  config: MonitoringConfig;
  employees: { _id: string; name: string }[];
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function save(event: FormEvent<HTMLFormElement>, target: boolean) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    const numbers = target
      ? ["proposalTarget", "onboardingTarget"]
      : [
          "proposalTarget",
          "onboardingTarget",
          "linkedinDays",
          "recoveryDays",
          "callbackNoticeMinutes",
        ];
    const payload: Record<string, unknown> = {
      ...fields,
      requestId: crypto.randomUUID(),
    };
    numbers.forEach((field) => {
      payload[field] = Number(fields[field]);
    });
    if (!target) {
      payload.workingDays = new FormData(form)
        .getAll("workingDays")
        .map(Number);
      payload.holidays = String(fields.holidays || "")
        .split(/[\s,]+/)
        .filter(Boolean);
      payload.requireAgreement = fields.requireAgreement === "on";
      payload.requireHandover = fields.requireHandover === "on";
    }
    setSaving(true);
    setMessage("");
    try {
      const result = await workspaceApi<{ message: string }>(
        target ? "/targets" : "/settings",
        "PUT",
        payload,
      );
      setMessage(result.message);
      onSaved();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save settings.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <details className="rounded-2xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-bold">
        Admin settings &amp; employee targets
      </summary>
      {message && (
        <p role="status" className="my-3 text-sm">
          {message}
        </p>
      )}
      <form
        onSubmit={(event) => void save(event, false)}
        className="mt-4 space-y-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 text-xs font-semibold">
            Daily submission cutoff (IST)
            <input
              type="time"
              required
              name="cutoff"
              defaultValue={config.cutoff}
              className={fieldClass}
            />
          </label>
          {(
            [
              ["proposalTarget", "Default daily proposals"],
              ["onboardingTarget", "Default monthly onboardings"],
              ["linkedinDays", "LinkedIn review interval (days)"],
              ["recoveryDays", "Wrong-number escalation (days)"],
              ["callbackNoticeMinutes", "Callback notice (minutes)"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="space-y-1 text-xs font-semibold">
              {label}
              <input
                type="number"
                required
                min={1}
                max={1000}
                name={key}
                defaultValue={config[key]}
                className={fieldClass}
              />
            </label>
          ))}
        </div>
        <fieldset className="flex flex-wrap gap-3">
          <legend className="mb-2 text-xs font-semibold">Working days</legend>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
            (day, index) => (
              <label key={day} className="flex gap-1 text-xs">
                <input
                  type="checkbox"
                  name="workingDays"
                  value={index}
                  defaultChecked={config.workingDays.includes(index)}
                />
                {day}
              </label>
            ),
          )}
        </fieldset>
        <label className="block space-y-1 text-xs font-semibold">
          Holidays (YYYY-MM-DD, separated by commas)
          <input
            name="holidays"
            defaultValue={config.holidays.join(", ")}
            className={fieldClass}
          />
        </label>
        <fieldset className="flex flex-wrap gap-4 text-xs">
          <legend className="mb-2 font-semibold">
            Required onboarding confirmations
          </legend>
          <label className="flex gap-2">
            <input
              type="checkbox"
              name="requireAgreement"
              defaultChecked={config.requireAgreement}
            />
            Completed agreement / approval
          </label>
          <label className="flex gap-2">
            <input
              type="checkbox"
              name="requireHandover"
              defaultChecked={config.requireHandover}
            />
            Confirmed handover
          </label>
        </fieldset>
        <button disabled={saving} className={primaryClass}>
          Save monitoring settings
        </button>
      </form>
      <form
        onSubmit={(event) => void save(event, true)}
        className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="space-y-1 text-xs font-semibold">
          Executive
          <select name="userId" required className={fieldClass}>
            <option value="">Select executive</option>
            {employees.map((employee) => (
              <option key={employee._id} value={employee._id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold">
          Effective date
          <input
            type="date"
            name="effectiveDate"
            required
            className={fieldClass}
          />
        </label>
        <label className="space-y-1 text-xs font-semibold">
          Daily proposals
          <input
            type="number"
            name="proposalTarget"
            min={1}
            max={1000}
            required
            defaultValue={5}
            className={fieldClass}
          />
        </label>
        <label className="space-y-1 text-xs font-semibold">
          Monthly onboardings
          <input
            type="number"
            name="onboardingTarget"
            min={1}
            max={1000}
            required
            defaultValue={10}
            className={fieldClass}
          />
        </label>
        <div className="sm:col-span-2 lg:col-span-4">
          <button disabled={saving} className={primaryClass}>
            Save effective employee targets
          </button>
        </div>
      </form>
    </details>
  );
}
