import { AlertTriangle, Clock3, Eye, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Button from "../components/Button";
import MetricCard from "../components/MetricCard";
import ProjectWizard from "../components/ProjectWizard";
import { useAppStore } from "../store/useAppStore";
import { money, shortMoney } from "../utils";

export default function Dashboard() {
  const { projects, selectedProject, setSelectedProject, deleteProject, fetchProjects, loading } = useAppStore();
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const portfolio = useMemo(() => {
    const total = projects.reduce((sum, project) => sum + Number(project.estimate?.total_cost || 0), 0);
    const area = projects.reduce((sum, project) => sum + Number(project.area || 0), 0);
    const risk = projects.reduce((sum, project) => sum + Number(project.estimate?.risk_amount || 0), 0);
    return { total, area, avg: area ? total / area : 0, risk };
  }, [projects]);

  const atRiskProjects = useMemo(() => projects.filter((project) => Number(project.estimate?.risk_buffer || 0) >= 0.15), [projects]);

  const chartData = useMemo(
    () =>
      projects.map((project) => ({
        name: project.name.length > 14 ? `${project.name.slice(0, 14)}...` : project.name,
        cost: Math.round((project.estimate?.total_cost || 0) / 100000),
      })),
    [projects]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">Executive dashboard</p>
          <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Construction Cost Intelligence Platform</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={RefreshCw} loading={loading.projects} onClick={fetchProjects}>
            Refresh
          </Button>
          <Button icon={Plus} onClick={() => setWizardOpen(true)}>
            Create Project
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Active Projects" value={projects.length} subtext={selectedProject ? `Selected: ${selectedProject.name}` : "No project selected"} accent="bg-teal-500" />
        <MetricCard label="Portfolio Cost" value={shortMoney(portfolio.total)} subtext="Expected estimate total" accent="bg-amber-500" />
        <MetricCard label="Average Cost / sqft" value={shortMoney(portfolio.avg)} subtext={`${portfolio.area.toLocaleString("en-IN")} sqft tracked`} accent="bg-blue-500" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Portfolio Risk</h2>
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <p className="mt-4 text-3xl font-bold">{shortMoney(portfolio.risk)}</p>
          <p className="mt-1 text-sm text-slate-500">Buffer currently carried across active estimates.</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, projects.length ? 42 + atRiskProjects.length * 12 : 0)}%` }} />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Projects at Risk</h2>
            <span className="rounded-md bg-red-50 px-3 py-1 text-sm font-bold text-red-700 dark:bg-red-950 dark:text-red-200">{atRiskProjects.length}</span>
          </div>
          <div className="mt-4 grid gap-2">
            {(atRiskProjects.length ? atRiskProjects : projects.slice(0, 2)).map((project) => (
              <button key={project.id} onClick={() => setSelectedProject(project)} className="flex items-center justify-between rounded-md bg-slate-50 p-3 text-left hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800">
                <span>
                  <span className="block text-sm font-bold">{project.name}</span>
                  <span className="text-xs text-slate-500">{Math.round((project.estimate?.risk_buffer || 0) * 100)}% buffer</span>
                </span>
                <strong className="text-sm">{shortMoney(project.estimate?.risk_amount)}</strong>
              </button>
            ))}
            {!projects.length ? <p className="text-sm text-slate-500">Create a project to start tracking risk.</p> : null}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Recent Activity</h2>
            <Clock3 className="h-5 w-5 text-teal-700" />
          </div>
          <div className="mt-4 grid gap-3">
            {projects.slice(0, 3).map((project) => (
              <div key={project.id} className="border-l-2 border-teal-600 pl-3">
                <p className="text-sm font-bold">{project.name} estimate updated</p>
                <p className="text-xs text-slate-500">{money(project.estimate?.cost_per_sqft)} / sqft in {project.location}</p>
              </div>
            ))}
            {!projects.length ? <p className="text-sm text-slate-500">No activity yet.</p> : null}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Projects</h2>
            <span className="rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Live workspace</span>
          </div>
          <div className="mt-4 overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3">Project</th>
                  <th>Location</th>
                  <th>Area</th>
                  <th>Quality</th>
                  <th>Expected</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-4 font-semibold">{project.name}</td>
                    <td className="text-slate-500 dark:text-slate-400">{project.location}</td>
                    <td>{Number(project.area).toLocaleString("en-IN")} sqft</td>
                    <td>{project.quality_tier}</td>
                    <td className="font-semibold">{shortMoney(project.estimate?.total_cost)}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" icon={Eye} onClick={() => setSelectedProject(project)}>
                          Open
                        </Button>
                        <Button variant="danger" icon={Trash2} loading={loading[`delete-${project.id}`]} onClick={() => deleteProject(project.id)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!projects.length ? (
              <div className="py-12 text-center text-sm text-slate-500">
                No projects yet. Create one to generate your first estimate.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-bold">Portfolio Cost by Project</h2>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => [`Rs. ${value} L`, "Cost"]} />
                <Bar dataKey="cost" fill="#6366F1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <ProjectWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
