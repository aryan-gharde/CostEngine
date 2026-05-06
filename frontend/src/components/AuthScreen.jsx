import { Building2, LogIn, UserPlus } from "lucide-react";
import { useState } from "react";
import Button from "./Button";
import { useAppStore } from "../store/useAppStore";

export default function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "Aarav Mehta", email: "demo@siteiq.in", password: "demo12345" });
  const { authenticate, loading } = useAppStore();

  const submit = (event) => {
    event.preventDefault();
    authenticate(mode, form);
  };

  return (
    <div className="min-h-screen bg-[#eef2f3] px-5 py-8 text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="flex flex-col justify-between bg-slate-950 p-8 text-white">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-semibold">
              <Building2 className="h-4 w-4" />
              SiteIQ Cost Intelligence
            </div>
            <h1 className="mt-10 max-w-xl text-4xl font-bold leading-tight md:text-5xl">
              Construction estimates that behave like a real operating model.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
              Create projects, generate category estimates, edit line items, save versions, test delay scenarios, and ask Llama 3 for cost reasoning.
            </p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {["RCC + MEP templates", "Risk buffers", "Version compare"].map((item) => (
              <div key={item} className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm font-medium text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-col justify-center p-6 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">Secure workspace</p>
          <h2 className="mt-2 text-3xl font-bold">{mode === "login" ? "Log in" : "Create account"}</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Demo credentials are prefilled. Signup also creates a mock session.</p>

          {mode === "signup" ? (
            <label className="mt-6 block">
              <span className="text-sm font-semibold">Name</span>
              <input className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
          ) : null}

          <label className="mt-5 block">
            <span className="text-sm font-semibold">Email</span>
            <input type="email" className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>

          <label className="mt-5 block">
            <span className="text-sm font-semibold">Password</span>
            <input type="password" className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </label>

          <Button className="mt-6 w-full" loading={loading.auth} icon={mode === "login" ? LogIn : UserPlus}>
            {mode === "login" ? "Log in" : "Sign up"}
          </Button>
          <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")} className="mt-4 rounded-md py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-950">
            {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}

