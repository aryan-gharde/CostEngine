import { Building2, Home, Layers3, LayoutGrid } from "lucide-react";

const modes = [
  {
    id: "overall",
    title: "Overall Construction",
    description: "Single project-level cost workbook using total built-up area.",
    icon: Building2,
    status: "Workbook ready",
  },
  {
    id: "building",
    title: "Building Wise",
    description: "Compare tower or block-level estimates in one project.",
    icon: LayoutGrid,
    status: "Demo placeholder",
  },
  {
    id: "floor",
    title: "Floor Wise",
    description: "Break cost by slab, repeated floor, and floor finish package.",
    icon: Layers3,
    status: "Demo placeholder",
  },
  {
    id: "flat",
    title: "Flat Wise",
    description: "Upload a plan, detect rooms, confirm area, and estimate materials.",
    icon: Home,
    status: "Fully functional",
  },
];

export default function EstimationModes({ activeMode, onSelect }) {
  return (
    <section className="glass-panel p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#4F46E5]">Project estimation modes</p>
          <h2 className="mt-1 text-2xl font-bold text-[#111827]">Choose how this project should be estimated</h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-[#64748B]">
          These modes live inside the project workspace. Flat Wise is enabled for this investor-demo workflow.
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const active = activeMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onSelect(mode.id)}
              className={`group min-h-44 rounded-2xl border p-4 text-left shadow-[0_12px_32px_rgba(15,23,42,0.06)] transition ${active ? "border-[#4F46E5] bg-[#EEF2FF] ring-2 ring-[#4F46E5]/20" : "border-slate-200 bg-white/82 hover:border-[#4F46E5]/40 hover:bg-white hover:shadow-[0_14px_34px_rgba(79,70,229,0.12)]"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`rounded-xl p-2 ${active ? "bg-[#4F46E5] text-white" : "bg-[#EEF2FF] text-[#4F46E5]"}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${mode.id === "flat" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  {mode.status}
                </span>
              </div>
              <h3 className="mt-4 text-base font-bold text-[#111827]">{mode.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#64748B]">{mode.description}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
