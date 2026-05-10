import { Download, FileBarChart, FileText, RefreshCw, Send, Table2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Button from "../components/Button";
import { useAppStore } from "../store/useAppStore";
import { money, shortMoney } from "../utils";

const reportTemplates = [
  { id: "executive", name: "Executive Cost Summary", icon: FileBarChart, description: "Portfolio totals, risk exposure, and spend curve for leadership review." },
  { id: "client", name: "Client Estimate Pack", icon: FileText, description: "Client-facing estimate with assumptions, exclusions, and category split." },
  { id: "boq", name: "BOQ Detail Report", icon: Table2, description: "Trade-wise material and labour rows with quantities, units, rates, and totals." },
  { id: "variance", name: "Version Variance Report", icon: FileBarChart, description: "Highlights cost movement, risk buffers, and high-value packages." },
  { id: "cashflow", name: "Cashflow Projection", icon: FileBarChart, description: "Monthly planned spend curve for procurement and billing planning." },
];

export default function Reports() {
  const { projects, selectedProject, fetchProjects, loading, setToast } = useAppStore();
  const [range, setRange] = useState("Quarter");
  const [template, setTemplate] = useState("executive");
  const project = selectedProject || projects[0];

  const portfolio = useMemo(() => {
    const total = projects.reduce((sum, item) => sum + Number(item.estimate?.total_cost || 0), 0);
    const risk = projects.reduce((sum, item) => sum + Number(item.estimate?.risk_amount || 0), 0);
    const area = projects.reduce((sum, item) => sum + Number(item.area || 0), 0);
    return { total, risk, area, cpsf: area ? total / area : 0 };
  }, [projects]);

  const curve = useMemo(() => {
    const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    const base = portfolio.total || 12000000;
    return labels.map((month, index) => ({ month, planned: Math.round((base * (0.1 + index * 0.045)) / 100000), cumulative: Math.round((base * (0.18 + index * 0.13)) / 100000) }));
  }, [portfolio.total]);

  const projectBars = useMemo(
    () => projects.map((item) => ({ name: item.name.slice(0, 14), cost: Math.round((item.estimate?.total_cost || 0) / 100000), risk: Math.round((item.estimate?.risk_amount || 0) / 100000) })),
    [projects]
  );
  const categoryData = useMemo(() => project?.estimate?.categories || [], [project?.estimate?.categories]);

  const exportCsv = () => {
    const rows = [
      "Project,Location,Area,Quality,Cost per sqft,Expected Cost,Risk Buffer",
      ...projects.map((item) => `${item.name},${item.location},${item.area},${item.quality_tier},${item.estimate?.cost_per_sqft || 0},${item.estimate?.total_cost || 0},${item.estimate?.risk_buffer || 0}`),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${template}-construction-report.csv`;
    link.click();
    setToast({ type: "success", message: "Report exported" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">Reports</p>
          <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Professional Report Templates</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Generate board, client, BOQ, variance, and cashflow views from the same estimate data.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={range} onChange={(event) => setRange(event.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-slate-900">
            <option>Month</option>
            <option>Quarter</option>
            <option>Year</option>
          </select>
          <Button variant="secondary" icon={RefreshCw} loading={loading.projects} onClick={fetchProjects}>Refresh</Button>
          <Button icon={Download} onClick={exportCsv}>Export Report</Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        {reportTemplates.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} onClick={() => setTemplate(item.id)} className={`rounded-lg border p-4 text-left transition ${template === item.id ? "border-teal-500 bg-teal-50 dark:bg-teal-950" : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"}`}>
              <Icon className="h-5 w-5 text-teal-700 dark:text-teal-300" />
              <p className="mt-3 text-sm font-bold">{item.name}</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">{item.description}</p>
            </button>
          );
        })}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Template Preview</p>
            <h2 className="mt-1 text-2xl font-bold">{reportTemplates.find((item) => item.id === template)?.name}</h2>
            <p className="mt-1 text-sm text-slate-500">Prepared for {project?.name || "portfolio"} | {range} view</p>
          </div>
          <Button variant="secondary" icon={Send} onClick={() => setToast({ type: "success", message: "Report package marked ready for review" })}>
            Mark Ready
          </Button>
        </div>

        {template === "executive" ? (
          <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["Portfolio Cost", shortMoney(portfolio.total)],
                ["Risk Exposure", shortMoney(portfolio.risk)],
                ["Tracked Area", `${portfolio.area.toLocaleString("en-IN")} sqft`],
                ["Average / sqft", money(portfolio.cpsf)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
                  <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
                  <p className="mt-2 text-2xl font-bold">{value}</p>
                </div>
              ))}
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projectBars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`Rs. ${value} L`, ""]} />
                  <Bar dataKey="cost" fill="#6366F1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="risk" fill="#22D3EE" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        {template === "client" ? (
          <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-5 dark:bg-slate-950">
                <h3 className="text-lg font-bold">{project?.name || "Client Estimate"}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  This estimate includes structure, finishing, MEP, labour, and a risk buffer. Final commercial value is subject to approved drawings, specifications, market rates, and vendor quotations.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"><p className="text-xs uppercase text-slate-500">Expected</p><p className="mt-2 text-xl font-bold">{shortMoney(project?.estimate?.total_cost)}</p></div>
                <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"><p className="text-xs uppercase text-slate-500">Min</p><p className="mt-2 text-xl font-bold">{shortMoney(project?.estimate?.min_cost)}</p></div>
                <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"><p className="text-xs uppercase text-slate-500">Max</p><p className="mt-2 text-xl font-bold">{shortMoney(project?.estimate?.max_cost)}</p></div>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" outerRadius={95}>
                    {categoryData.map((entry, index) => <Cell key={entry.name} fill={["#6366F1", "#22D3EE", "#818CF8", "#9CA3AF"][index % 4]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => money(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        {template === "boq" ? (
          <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200 scrollbar-thin dark:border-slate-800">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500 dark:bg-slate-950">
                <tr><th className="px-3 py-3">Item</th><th>Trade</th><th>Qty</th><th>Unit</th><th>Rate</th><th className="text-right">Amount</th></tr>
              </thead>
              <tbody>
                {(project?.estimate?.line_items || []).map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-3 font-semibold">{row.name}</td><td>{row.category}</td><td>{row.quantity}</td><td>{row.unit}</td><td>{money(row.price)}</td><td className="text-right font-bold">{money(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {template === "variance" ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {(project?.estimate?.categories || []).map((category) => (
              <div key={category.name} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-sm font-bold">{category.name}</p>
                <p className="mt-2 text-2xl font-bold">{shortMoney(category.value)}</p>
                <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">Variance watch: compare against saved versions</p>
              </div>
            ))}
          </div>
        ) : null}

        {template === "cashflow" ? (
          <div className="mt-5 h-96">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curve}>
                <defs>
                  <linearGradient id="planned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [`Rs. ${value} L`, ""]} />
                <Area type="monotone" dataKey="planned" stroke="#6366F1" fill="url(#planned)" strokeWidth={3} />
                <Area type="monotone" dataKey="cumulative" stroke="#22D3EE" fill="#22D3EE22" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </section>
    </div>
  );
}
