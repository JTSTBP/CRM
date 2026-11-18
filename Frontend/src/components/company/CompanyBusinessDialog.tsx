import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import BusinessEvents from "../bd/BusinessEvents";
import {
  businessWorkspace,
  type CompanyWorkspace,
  type Proposal,
} from "./companyTypes";
import { workspaceApi } from "../bd/workspaceApi";
export default function CompanyBusinessDialog({
  data,
  proposal,
  kind = "proposal",
  onClose,
  onSaved,
}: {
  data: CompanyWorkspace;
  proposal?: Proposal;
  kind?: "proposal" | "onboarding";
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  async function saved() {
    if (proposal)
      await workspaceApi(`/proposals/${proposal._id}`, "PATCH", {
        action: "sent",
        revision: proposal.revision,
        requestId: crypto.randomUUID(),
      });
    await onSaved();
    onClose();
  }
  return (
    <dialog
      ref={ref}
      aria-label="Record confirmed company business outcome"
      onCancel={onClose}
      className="co-dialog co-dialog-wide"
    >
      <header className="co-section-head">
        <h2>
          {kind === "onboarding"
            ? "Record verified client activation"
            : "Record confirmed proposal dispatch"}
        </h2>
        <button
          className="co-icon"
          aria-label="Close business outcome"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      {proposal && (
        <p className="co-muted">
          Use reference {proposal.reference} and its assigned executive. Count
          only an actually sent proposal.
        </p>
      )}
      <BusinessEvents
        data={businessWorkspace(data)}
        initialKind={kind}
        initialReference={proposal?.reference}
        initialOwnerId={proposal?.ownerId}
        outcomeOnly
        onSaved={saved}
      />
    </dialog>
  );
}
