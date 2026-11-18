import type { ReactNode } from "react";
import { isPhoneBrowser, startMobileDial } from "./mobileCall";
export default function MobileCallLink({
  leadId,
  pocId,
  phone,
  onDial,
  children,
  className,
}: {
  leadId: string;
  pocId: string;
  phone: string;
  onDial?: () => void;
  children?: ReactNode;
  className?: string;
}) {
  if (!isPhoneBrowser())
    return (
      <span className={className} title="Call from the mobile website">
        {children || phone}
      </span>
    );
  return (
    <a
      className={className}
      href={`tel:${phone}`}
      onClick={() => {
        if (startMobileDial(leadId, pocId)) onDial?.();
      }}
    >
      {children || phone}
    </a>
  );
}
