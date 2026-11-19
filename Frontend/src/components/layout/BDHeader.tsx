import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Calendar, Menu, Search } from "lucide-react";
import { API_BASE_URL } from "../../config";
import { workspaceApi } from "../bd/workspaceApi";

export default function BDHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [companies, setCompanies] = useState<
    { _id: string; company_name?: string; website_url?: string }[]
  >([]);
  const [unread, setUnread] = useState(0);
  const [date, setDate] = useState(new Date());
  useEffect(() => {
    const controller = new AbortController();
    async function update() {
      setDate(new Date());
      try {
        const result = await workspaceApi<{ unread: number }>(
          "/notifications",
          "GET",
          undefined,
          controller.signal,
        );
        setUnread(result.unread);
      } catch {
        /* The dashboard displays connection failures. */
      }
    }
    void update();
    const timer = setInterval(update, 60000);
    const shortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) &&
        !target.isContentEditable
      ) {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("keydown", shortcut);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    if (search.trim().length < 2) {
      setCompanies([]);
      return;
    }
    const timer = setTimeout(async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/leads?limit=6&search=${encodeURIComponent(search)}`,
        {
          signal: controller.signal,
          headers: { "x-auth-token": localStorage.getItem("token") || "" },
        },
      ).catch(() => null);
      if (response?.ok) {
        const data = await response.json();
        if (!controller.signal.aborted) setCompanies(data.leads || []);
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [search]);
  function submit(event: FormEvent) {
    event.preventDefault();
    navigate(
      `/bd/dashboard?search=${encodeURIComponent(search)}#bd-action-queue`,
    );
    setCompanies([]);
  }
  return (
    <header className="tf-header">
      <button
        type="button"
        aria-label="Open navigation"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <Menu size={20} />
      </button>
      <form onSubmit={submit} className="tf-global-search">
        <Search size={16} className="absolute left-3 top-2.5 text-slate-500" />
        <input
          ref={input}
          aria-label="Search companies, contacts, or deals"
          placeholder="Search companies, contacts, or deals (Press / to focus)…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {companies.length > 0 && (
          <div
            className="tf-search-results"
            aria-label="Company search results"
          >
            {companies.map((company) => (
              <button
                type="button"
                key={company._id}
                onClick={() => {
                  setSearch("");
                  navigate(`/bd/leads?openLead=${company._id}`);
                }}
              >
                {company.company_name || company.website_url}
              </button>
            ))}
            <button type="submit">Search follow-up queue →</button>
          </div>
        )}
      </form>
      <p className="tf-header-date tf-small flex items-center gap-1 whitespace-nowrap">
        <Calendar size={14} />
        {date.toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Kolkata",
        })}
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Urgent notifications"
          onClick={() => navigate("/bd/dashboard?notifications=1")}
          className="tf-icon-button relative"
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1 text-[9px] text-white">
              {unread}
            </span>
          )}
        </button>
        <Link className="tf-header-user" to="/bd/profile">
          <div className="text-right">
            <strong>{user.name}</strong>
            <p className="text-[11px] text-slate-500">BD Executive</p>
          </div>
          <span className="tf-avatar">
            {user.name
              ?.split(" ")
              .map((part: string) => part[0])
              .slice(0, 2)
              .join("")}
          </span>
        </Link>
      </div>
    </header>
  );
}
