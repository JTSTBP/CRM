import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Contact,
  CalendarClock,
  PanelsTopLeft,
  PhoneCall,
  Target,
  BarChart3,
  Settings,
  Menu,
  ChevronDown,
  LogOut,
  Mail,
} from "lucide-react";
import { API_BASE_URL } from "../../config";

interface Props {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  collapsed?: boolean;
  onCollapse?: () => void;
}

export default function BDSidebar({
  isOpen,
  setIsOpen,
  collapsed,
  onCollapse,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [contactsOpen, setContactsOpen] = useState(false);
  const items = [
    { label: "Dashboard", path: "/bd/dashboard", Icon: LayoutDashboard },
    { label: "Leads & Contacts", path: "/bd/leads", Icon: Contact },
    {
      label: "Follow-ups Queue",
      path: "/bd/dashboard#bd-action-queue",
      Icon: CalendarClock,
    },
    {
      label: "Pipelines & Deals",
      path: "/bd/dashboard#bd-pipeline",
      Icon: PanelsTopLeft,
    },
    {
      label: "Callbacks & Retries",
      path: "/bd/dashboard#bd-recovery",
      Icon: PhoneCall,
    },
    {
      label: "Performance & Targets",
      path: "/bd/dashboard#bd-targets",
      Icon: Target,
    },
    { label: "Reports & Analytics", path: "/bd/reports", Icon: BarChart3 },
    { label: "Settings", path: "/bd/profile", Icon: Settings },
  ];
  async function logout() {
    try {
      await fetch(API_BASE_URL + "/api/attendance/logout", {
        method: "POST",
        headers: { "x-auth-token": localStorage.getItem("token") || "" },
      });
    } catch {
      // End the local session if the logout request is unavailable.
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login");
    }
  }
  return (
    <aside
      className={`bd-territory-nav fixed inset-y-0 left-0 z-50 flex h-screen flex-col transition-all lg:sticky lg:top-0 lg:translate-x-0 ${collapsed ? "is-collapsed" : ""} ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
    >
      <div className="tf-brand">
        {!collapsed && (
          <Link to="/bd/dashboard" className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Jobs Territory"
              className="h-8 w-8 object-contain"
            />
            <strong>Jobs Territory</strong>
          </Link>
        )}
        <button
          type="button"
          aria-label="Collapse navigation"
          title="Collapse navigation"
          onClick={() => {
            if (window.innerWidth >= 1024) onCollapse?.();
            else setIsOpen(false);
          }}
        >
          <Menu size={18} />
        </button>
      </div>
      {!collapsed && <p className="tf-nav-label">Workspace</p>}
      <nav
        aria-label="BD workspace navigation"
        className="flex-1 space-y-1 overflow-y-auto p-2"
      >
        {items.map(({ label, path, Icon }) => {
          const current = location.pathname + location.hash;
          const active =
            path === "/bd/dashboard"
              ? current === path
              : path.includes("#")
                ? current === path
                : location.pathname.startsWith(path);
          return (
            <div key={path}>
              <div className="flex items-center">
                <Link
                  to={path}
                  title={collapsed ? label : undefined}
                  onClick={() => setIsOpen(false)}
                  className={`tf-nav-link min-w-0 flex-1 ${active ? "is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={18} />
                  {!collapsed && <span>{label}</span>}
                </Link>
                {label === "Leads & Contacts" && !collapsed && (
                  <button
                    type="button"
                    aria-label="Show company and contact pages"
                    aria-expanded={contactsOpen}
                    onClick={() => setContactsOpen(!contactsOpen)}
                    className="p-1"
                  >
                    <ChevronDown size={14} />
                  </button>
                )}
              </div>
              {label === "Leads & Contacts" && contactsOpen && !collapsed && (
                <div className="ml-7 space-y-1 py-1 text-xs">
                  <Link
                    className="block p-2"
                    to="/bd/leads"
                    onClick={() => setIsOpen(false)}
                  >
                    Company Details
                  </Link>
                  <Link
                    className="block p-2"
                    to="/bd/contacts"
                    onClick={() => setIsOpen(false)}
                  >
                    Contact Directory
                  </Link>
                  <Link
                    className="block p-2"
                    to="/bd/add-lead"
                    onClick={() => setIsOpen(false)}
                  >
                    Company Approvals
                  </Link>
                </div>
              )}
            </div>
          );
        })}
        <Link to="/bd/email-sending" title="Send Email" className="tf-nav-link">
          <Mail size={18} />
          {!collapsed && <span>Send Email</span>}
        </Link>
      </nav>
      <div className="tf-nav-footer">
        <span className="flex items-center gap-2">
          {!collapsed && (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              BD TERMINAL ACTIVE
            </>
          )}
        </span>
        <button
          type="button"
          title="Logout"
          aria-label="Logout"
          onClick={() => void logout()}
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}
