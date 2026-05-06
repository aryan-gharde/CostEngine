import { GitCompare, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Button from "./Button";
import { useAppStore } from "../store/useAppStore";
import { shortMoney } from "../utils";

export default function VersionPanel() {
  const { selectedProject, versions, fetchVersions, loading } = useAppStore();
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");

  useEffect(() => {
    if (selectedProject?.id) fetchVersions(selectedProject.id);
  }, [selectedProject?.id, fetchVersions]);

  const left = useMemo(() => versions.find((version) => String(version.id) === String(leftId)), [versions, leftId]);
  const right = useMemo(() => versions.find((version) => String(version.id) === String(rightId)), [versions, rightId]);

  const delta = left && right ? Number(right.estimate.total_cost || 0) - Number(left.estimate.total_cost || 0) : 0;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Version Control</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Save estimates from the cost dashboard and compare revisions.</p>
        </div>
        <Button variant="secondary" icon={RefreshCw} loading={loading.versions} disabled={!selectedProject} onClick={() => fetchVersions(selectedProject?.id)}>
          Refresh Versions
        </Button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label>
          <span className="text-sm font-semibold">Version A</span>
          <select value={leftId} onChange={(event) => setLeftId(event.target.value)} className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
            <option value="">Select version</option>
            {versions.map((version) => (
              <option key={version.id} value={version.id}>{version.name} - {shortMoney(version.estimate.total_cost)}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-sm font-semibold">Version B</span>
          <select value={rightId} onChange={(event) => setRightId(event.target.value)} className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
            <option value="">Select version</option>
            {versions.map((version) => (
              <option key={version.id} value={version.id}>{version.name} - {shortMoney(version.estimate.total_cost)}</option>
            ))}
          </select>
        </label>
      </div>

      {left && right ? (
        <div className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-950 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase text-slate-500">A total</p>
            <p className="text-xl font-bold">{shortMoney(left.estimate.total_cost)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">B total</p>
            <p className="text-xl font-bold">{shortMoney(right.estimate.total_cost)}</p>
          </div>
          <div>
            <p className="flex items-center gap-2 text-xs uppercase text-slate-500"><GitCompare className="h-3 w-3" /> Delta</p>
            <p className={`text-xl font-bold ${delta > 0 ? "text-red-600" : "text-emerald-600"}`}>{delta >= 0 ? "+" : ""}{shortMoney(delta)}</p>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
          {versions.length ? "Choose two saved versions to compare." : "No versions saved yet."}
        </div>
      )}
    </section>
  );
}

