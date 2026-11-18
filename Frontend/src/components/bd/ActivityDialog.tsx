import { useEffect, useRef } from "react";
import ContactActivity from "./ContactActivity";
import { secondaryClass } from "./workspaceApi";

export default function ActivityDialog({
  leadId,
  pocId,
  onClose,
  onSaved,
  callMode,
  businessKind,
}: {
  leadId: string;
  pocId: string;
  onClose: () => void;
  onSaved?: (outcome?: string) => void;
  callMode?: boolean;
  businessKind?: "proposal" | "onboarding";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label="Record company communication"
      onCancel={onClose}
      className="m-auto max-h-[90vh] w-[min(96vw,1100px)] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-xl backdrop:bg-slate-900/50"
    >
      <div className="mb-3 flex justify-end">
        <button type="button" onClick={onClose} className={secondaryClass}>
          Close activity
        </button>
      </div>
      <ContactActivity
        key={`${leadId}:${pocId}`}
        leadId={leadId}
        pocId={pocId}
        onSaved={onSaved}
        onChanged={callMode ? undefined : onSaved}
        callMode={callMode}
        businessKind={businessKind}
      />
    </dialog>
  );
}
