import ActivityDialog from "../bd/ActivityDialog";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  poc: {
    _id: string;
    name: string;
    phone: string;
    email?: string;
    stage: string;
  };
  onSuccess: () => void;
  /** Called after a successful save when stage is 'Busy' or 'No Answer' */
  onBusyOrNoAnswer?: (poc: any, savedStage: string) => void;
}

export default function PostCallFeedbackModal({
  isOpen,
  onClose,
  leadId,
  poc,
  onSuccess,
  onBusyOrNoAnswer,
}: Props) {
  if (!isOpen) return null;
  return (
    <ActivityDialog
      leadId={leadId}
      pocId={poc._id}
      callMode
      onClose={onClose}
      onSaved={(outcome) => {
        onSuccess();
        if (outcome && ["Busy", "No Answer"].includes(outcome))
          onBusyOrNoAnswer?.(poc, outcome);
        onClose();
      }}
    />
  );
}
