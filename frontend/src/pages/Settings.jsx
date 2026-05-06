import { Bell, Building2, Save, ShieldCheck, User } from "lucide-react";
import { useState } from "react";
import Button from "../components/Button";
import { useAppStore } from "../store/useAppStore";

export default function Settings() {
  const { user, updateProfile, setToast } = useAppStore();
  const [profile, setProfile] = useState({
    name: user?.name || "",
    email: user?.email || "",
    role: user?.role || "Senior Estimator",
    company: user?.company || "SiteIQ Construction Advisory",
    phone: user?.phone || "",
    defaultCurrency: user?.defaultCurrency || "INR",
    defaultUnit: user?.defaultUnit || "sqft",
  });
  const [notifications, setNotifications] = useState({
    estimateApprovals: true,
    priceAlerts: true,
    weeklyReports: false,
  });

  const update = (key, value) => setProfile((current) => ({ ...current, [key]: value }));
  const save = () => updateProfile(profile);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">Settings</p>
        <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Workspace and Profile</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage estimator profile, company defaults, notifications, and security preferences.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-teal-700" />
            <h2 className="text-lg font-bold">Profile</h2>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-sm font-semibold">Name</span>
              <input value={profile.name} onChange={(event) => update("name", event.target.value)} className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-950" />
            </label>
            <label>
              <span className="text-sm font-semibold">Email</span>
              <input value={profile.email} onChange={(event) => update("email", event.target.value)} className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-950" />
            </label>
            <label>
              <span className="text-sm font-semibold">Role</span>
              <input value={profile.role} onChange={(event) => update("role", event.target.value)} className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-950" />
            </label>
            <label>
              <span className="text-sm font-semibold">Phone</span>
              <input value={profile.phone} onChange={(event) => update("phone", event.target.value)} className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-950" />
            </label>
          </div>
          <Button icon={Save} className="mt-5" onClick={save}>Save Profile</Button>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-teal-700" />
            <h2 className="text-lg font-bold">Company Defaults</h2>
          </div>
          <div className="mt-5 grid gap-4">
            <label>
              <span className="text-sm font-semibold">Company</span>
              <input value={profile.company} onChange={(event) => update("company", event.target.value)} className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-950" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-sm font-semibold">Currency</span>
                <select value={profile.defaultCurrency} onChange={(event) => update("defaultCurrency", event.target.value)} className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
                  <option>INR</option>
                  <option>USD</option>
                  <option>AED</option>
                </select>
              </label>
              <label>
                <span className="text-sm font-semibold">Area Unit</span>
                <select value={profile.defaultUnit} onChange={(event) => update("defaultUnit", event.target.value)} className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
                  <option>sqft</option>
                  <option>sqm</option>
                </select>
              </label>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-teal-700" />
            <h2 className="text-lg font-bold">Notifications</h2>
          </div>
          <div className="mt-4 grid gap-3">
            {[
              ["estimateApprovals", "Estimate approval changes"],
              ["priceAlerts", "Material price alerts"],
              ["weeklyReports", "Weekly cost report digest"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
                <span className="font-semibold">{label}</span>
                <input type="checkbox" checked={notifications[key]} onChange={(event) => setNotifications((current) => ({ ...current, [key]: event.target.checked }))} className="h-5 w-5 accent-teal-700" />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-teal-700" />
            <h2 className="text-lg font-bold">Security</h2>
          </div>
          <div className="mt-4 grid gap-3">
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
              <p className="font-bold">Session-based demo login</p>
              <p className="mt-1 text-sm text-slate-500">Production should use JWT rotation, MFA, and organization-level RBAC.</p>
            </div>
            <Button variant="secondary" onClick={() => setToast({ type: "success", message: "Password reset email simulated" })}>Send Password Reset</Button>
          </div>
        </section>
      </div>
    </div>
  );
}

