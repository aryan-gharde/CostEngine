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
    <div className="min-h-screen bg-[#f5f7fb] px-5 py-8 text-[#111827]">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-[0_18px_60px_rgba(15,23,42,0.10)] backdrop-blur-xl lg:grid-cols-[1.15fr_0.85fr]">
        <div className="flex flex-col justify-between border-r border-slate-200 bg-gradient-to-br from-white via-[#f8fafc] to-[#eef2ff] p-8 text-[#111827]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md border border-indigo-100 bg-[#EEF2FF] px-3 py-2 text-sm font-semibold text-[#3730A3]">
              <Building2 className="h-4 w-4" />
              SiteIQ Cost Intelligence
            </div>
            <h1 className="mt-10 max-w-xl text-4xl font-bold leading-tight md:text-5xl">
              Construction estimates that behave like a real operating model.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#475569]">
              Create projects, generate category estimates, edit line items, save versions, test delay scenarios, and ask Llama 3 for cost reasoning.
            </p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {["RCC + MEP templates", "Risk buffers", "Version compare"].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm font-semibold text-[#334155] shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                {item}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-col justify-center p-6 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#4F46E5]">Secure workspace</p>
          <h2 className="mt-2 text-3xl font-bold">{mode === "login" ? "Log in" : "Create account"}</h2>
          <p className="mt-2 text-sm text-[#64748B]">Demo credentials are prefilled. Signup also creates a mock session.</p>

          {mode === "signup" ? (
            <label className="mt-6 block">
              <span className="text-sm font-semibold">Name</span>
              <input className="input-glass mt-2 w-full rounded-md px-3 py-3" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
          ) : null}

          <label className="mt-5 block">
            <span className="text-sm font-semibold">Email</span>
            <input type="email" className="input-glass mt-2 w-full rounded-md px-3 py-3" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>

          <label className="mt-5 block">
            <span className="text-sm font-semibold">Password</span>
            <input type="password" className="input-glass mt-2 w-full rounded-md px-3 py-3" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </label>

          <Button className="mt-6 w-full" loading={loading.auth} icon={mode === "login" ? LogIn : UserPlus}>
            {mode === "login" ? "Log in" : "Sign up"}
          </Button>
          <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")} className="mt-4 rounded-md py-2 text-sm font-semibold text-[#4F46E5] hover:bg-[#EEF2FF]">
            {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
