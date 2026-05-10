import { Building2, FileSearch, FileText, LayoutDashboard, LogOut, Settings, Sun, UserCog } from "lucide-react";
import Button from "./Button";
import { useAppStore } from "../store/useAppStore";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Projects", icon: Building2 },
  { label: "Intake", icon: FileSearch },
  { label: "Reports", icon: FileText },
  { label: "Admin", icon: Settings },
  { label: "Settings", icon: UserCog },
];

export default function Sidebar() {
  const { page, setPage, user, logout } = useAppStore();

  return (
    <aside className="flex h-full min-h-screen w-full flex-col border-r border-slate-200 bg-white/85 p-4 shadow-[10px_0_30px_rgba(15,23,42,0.04)] backdrop-blur-xl lg:w-72">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-[#111827] shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
        <div className="rounded-xl bg-gradient-to-br from-[#4F46E5] to-[#0891B2] p-2 shadow-[0_10px_24px_rgba(79,70,229,0.18)]">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold">SiteIQ</p>
          <p className="text-xs text-[#64748B]">Cost Intelligence</p>
        </div>
      </div>

      <nav className="mt-6 grid gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = page === item.label;
          return (
            <button
              key={item.label}
              onClick={() => setPage(item.label)}
              className={`flex min-h-11 items-center gap-3 rounded-md border-l-2 px-3 text-sm font-semibold ${active ? "border-l-[#4F46E5] bg-[#EEF2FF] text-[#3730A3] shadow-[0_10px_24px_rgba(79,70,229,0.10)]" : "border-l-transparent text-[#475569] hover:bg-[#EEF2FF] hover:text-[#3730A3]"}`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="glass-panel mt-auto p-4">
        <p className="text-sm font-bold text-[#111827]">{user?.name}</p>
        <p className="mt-1 break-all text-xs text-[#64748B]">{user?.email}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button type="button" variant="secondary" icon={Sun} disabled className="px-2">
            Light
          </Button>
          <Button type="button" variant="ghost" icon={LogOut} onClick={logout} className="px-2">
            Exit
          </Button>
        </div>
      </div>
    </aside>
  );
}
