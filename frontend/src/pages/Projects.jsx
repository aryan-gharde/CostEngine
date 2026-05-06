import { CalendarDays, Layers, MapPin, Plus, Ruler, ShieldCheck } from "lucide-react";
import { useState } from "react";
import Button from "../components/Button";
import CostDashboard from "../components/CostDashboard";
import PricePanel from "../components/PricePanel";
import ProjectWizard from "../components/ProjectWizard";
import ScenarioPanel from "../components/ScenarioPanel";
import VersionPanel from "../components/VersionPanel";
import { useAppStore } from "../store/useAppStore";
import { money, shortMoney } from "../utils";

export default function Projects() {
  const { projects, selectedProject, setSelectedProject } = useAppStore();
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">Projects / Estimate Workbook</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-950 dark:text-white">{selectedProject ? selectedProject.name : "Projects"}</h1>
              {selectedProject ? (
                <>
                  <span className="rounded-md bg-slate-950 px-3 py-1 text-xs font-bold text-white dark:bg-white dark:text-slate-950">Draft</span>
                  <span className="rounded-md bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-200">Estimate v{selectedProject.id}</span>
                </>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{selectedProject ? "Operational estimate workspace with scenario, BOQ, price signals, and version control." : "Open or create a project to begin estimating."}</p>
          </div>
          <Button icon={Plus} onClick={() => setWizardOpen(true)}>
            Create Project
          </Button>
        </div>

        {selectedProject ? (
          <div className="mt-5 grid gap-3 md:grid-cols-5">
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
              <p className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500"><MapPin className="h-3.5 w-3.5" /> Location</p>
              <p className="mt-2 font-semibold">{selectedProject.location}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
              <p className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500"><Ruler className="h-3.5 w-3.5" /> Area</p>
              <p className="mt-2 font-semibold">{selectedProject.area.toLocaleString("en-IN")} sqft</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
              <p className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500"><Layers className="h-3.5 w-3.5" /> Scope</p>
              <p className="mt-2 font-semibold">{selectedProject.floors} floors / {selectedProject.quality_tier}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
              <p className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500"><ShieldCheck className="h-3.5 w-3.5" /> Risk Buffer</p>
              <p className="mt-2 font-semibold">{Math.round((selectedProject.estimate?.risk_buffer || 0) * 100)}%</p>
            </div>
            <div className="rounded-lg bg-slate-950 p-4 text-white dark:bg-white dark:text-slate-950">
              <p className="flex items-center gap-2 text-xs font-bold uppercase opacity-70"><CalendarDays className="h-3.5 w-3.5" /> Current Total</p>
              <p className="mt-2 text-xl font-bold">{money(selectedProject.estimate?.total_cost)}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
        {projects.map((project) => (
          <button key={project.id} onClick={() => setSelectedProject(project)} className={`rounded-lg border p-4 text-left transition ${selectedProject?.id === project.id ? "border-teal-500 bg-teal-50 dark:bg-teal-950" : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold">{project.name}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{project.location}</p>
              </div>
              <span className="rounded bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Draft</span>
            </div>
            <p className="mt-3 text-lg font-bold">{shortMoney(project.estimate?.total_cost)}</p>
            <p className="mt-1 text-xs text-slate-500">{money(project.estimate?.cost_per_sqft)} / sqft</p>
          </button>
        ))}
      </div>

      {selectedProject ? (
        <>
          <CostDashboard project={selectedProject} />
          <PricePanel />
          <ScenarioPanel />
          <VersionPanel />
        </>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-bold">No project selected</h2>
          <p className="mt-2 text-sm text-slate-500">Create a project to generate the first estimate.</p>
        </div>
      )}

      <ProjectWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
