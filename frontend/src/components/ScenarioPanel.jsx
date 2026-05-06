import { SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import Button from "./Button";
import { useAppStore } from "../store/useAppStore";
import { shortMoney } from "../utils";

export default function ScenarioPanel() {
  const { selectedProject, runScenario, loading } = useAppStore();
  const [delay, setDelay] = useState(2);
  const [quality, setQuality] = useState(selectedProject?.quality_tier || "Medium");
  const currentTotal = Number(selectedProject?.estimate?.total_cost || 0);
  const preview = useMemo(() => {
    const currentQuality = selectedProject?.estimate?.project?.quality_tier || selectedProject?.quality_tier || "Medium";
    const rates = { Medium: 2000, High: 3200 };
    const qualityFactor = (rates[quality] || rates[currentQuality]) / (rates[currentQuality] || 2000);
    const delayFactor = 1 + delay * 0.012;
    const total = Math.round(currentTotal * qualityFactor * delayFactor);
    return { total, delta: total - currentTotal, delayFactor, qualityFactor };
  }, [currentTotal, delay, quality, selectedProject?.estimate?.project?.quality_tier, selectedProject?.quality_tier]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Scenario Simulation</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Model delay inflation and quality tier changes.</p>
        </div>
        <Button icon={SlidersHorizontal} loading={loading.scenario} disabled={!selectedProject} onClick={() => runScenario(delay, quality)}>
          Run Scenario
        </Button>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-4">
        <label className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <span className="text-sm font-semibold">Delay: {delay} months</span>
          <input type="range" min="0" max="18" value={delay} onChange={(event) => setDelay(Number(event.target.value))} className="mt-4 w-full accent-teal-700" />
        </label>
        <label className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <span className="text-sm font-semibold">Quality</span>
          <select value={quality} onChange={(event) => setQuality(event.target.value)} className="mt-3 w-full rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
            <option>Medium</option>
            <option>High</option>
          </select>
        </label>
        </div>
        <div className="grid gap-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-950 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-bold uppercase text-slate-500">Current</p>
            <p className="mt-2 text-xl font-bold">{shortMoney(currentTotal)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-bold uppercase text-slate-500">Scenario</p>
            <p className="mt-2 text-xl font-bold">{shortMoney(preview.total)}</p>
          </div>
          <div className={`rounded-lg border p-4 ${preview.delta > 0 ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200" : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"}`}>
            <p className="text-xs font-bold uppercase opacity-70">Delta</p>
            <p className="mt-2 text-xl font-bold">{preview.delta >= 0 ? "+" : ""}{shortMoney(preview.delta)}</p>
          </div>
        </div>
      </div>
      {selectedProject?.estimate?.scenario ? (
        <div className="mt-4 rounded-lg bg-teal-50 p-4 text-sm font-semibold text-teal-900 dark:bg-teal-950 dark:text-teal-100">
          Applied: {selectedProject.estimate.scenario.delay_months} month delay, {selectedProject.estimate.scenario.quality_tier} quality, inflation factor {selectedProject.estimate.scenario.inflation_factor}.
        </div>
      ) : null}
    </section>
  );
}
