import { Building2, FileSearch, FileText, LayoutDashboard, LogOut, Moon, Settings, Sun, UserCog } from "lucide-react";
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
  const { page, setPage, user, logout, darkMode, toggleTheme } = useAppStore();

  return (
    <aside className="flex h-full min-h-screen w-full flex-col border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 lg:w-72">
      <div className="flex items-center gap-3 rounded-lg bg-slate-950 p-4 text-white dark:bg-white dark:text-slate-950">
        <Building2 className="h-6 w-6" />
        <div>
          <p className="text-sm font-bold">SiteIQ</p>
          <p className="text-xs opacity-70">Cost Intelligence</p>
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
              className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition ${active ? "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"}`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <p className="text-sm font-bold text-slate-950 dark:text-white">{user?.name}</p>
        <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button type="button" variant="secondary" icon={darkMode ? Sun : Moon} onClick={toggleTheme} className="px-2">
            {darkMode ? "Light" : "Dark"}
          </Button>
          <Button type="button" variant="ghost" icon={LogOut} onClick={logout} className="px-2">
            Exit
          </Button>
        </div>
      </div>
    </aside>
  );
}
