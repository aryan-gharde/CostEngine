import jsPDF from "jspdf";
import { Bot, Calculator, Copy, Download, Lock, Plus, RotateCcw, Save, Send, Sparkles, Trash2, Unlock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import Button from "./Button";
import MetricCard from "./MetricCard";
import { useAppStore } from "../store/useAppStore";
import { money, percent, shortMoney } from "../utils";

const COLORS = ["#6366F1", "#22D3EE", "#818CF8", "#9CA3AF"];
const tabs = ["Structure", "Finishing", "MEP", "Labour"];

export default function CostDashboard({ project }) {
  const { updateEstimate, saveVersion, explainCost, loading } = useAppStore();
  const [activeTab, setActiveTab] = useState("Structure");
  const [lineItems, setLineItems] = useState(project?.estimate?.line_items || []);
  const [riskBuffer, setRiskBuffer] = useState(project?.estimate?.risk_buffer || 0.12);
  const [versionName, setVersionName] = useState("Baseline estimate");
  const [aiQuestion, setAiQuestion] = useState("Explain Cost");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", text: "I can explain this estimate, flag cost drivers, and suggest substitutions from the current BOQ." },
  ]);
  const [editMode, setEditMode] = useState(true);

  useEffect(() => {
    setLineItems(project?.estimate?.line_items || []);
    setRiskBuffer(project?.estimate?.risk_buffer || 0.12);
  }, [project?.id, project?.estimate]);

  const estimate = project?.estimate;
  const rowAmount = (row) => Number(row.quantity || 0) * (1 + Number(row.waste_percent || 0)) * Number(row.price || 0);
  const localSubtotal = useMemo(() => lineItems.reduce((sum, row) => sum + rowAmount(row), 0), [lineItems]);
  const localTotal = Math.round(localSubtotal * (1 + Number(riskBuffer || 0)));
  const savedTotal = Number(estimate?.total_cost || 0);
  const workingDelta = localTotal - savedTotal;
  const displayDelta = Math.abs(workingDelta) < 100 ? 0 : workingDelta;
  const changedRows = useMemo(() => {
    const original = new Map((estimate?.line_items || []).map((row) => [row.id, row]));
    return new Set(
      lineItems
        .filter((row) => {
          const before = original.get(row.id);
          return !before || Number(before.quantity) !== Number(row.quantity) || Number(before.price) !== Number(row.price) || Number(before.waste_percent || 0) !== Number(row.waste_percent || 0);
        })
        .map((row) => row.id)
    );
  }, [estimate?.line_items, lineItems]);

  const rowsByCategory = useMemo(() => {
    const grouped = Object.fromEntries(tabs.map((category) => [category, []]));
    for (const row of lineItems) {
      if (!grouped[row.category]) grouped[row.category] = [];
      grouped[row.category].push(row);
    }
    return grouped;
  }, [lineItems]);

  const activeRows = rowsByCategory[activeTab] || [];
  const categoryTotals = useMemo(
    () =>
      tabs.map((category) => {
        const rows = rowsByCategory[category] || [];
        return {
          name: category,
          rows: rows.length,
          value: Math.round(rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)),
        };
      }),
    [rowsByCategory]
  );
  const activeCategoryTotal = useMemo(() => categoryTotals.find((item) => item.name === activeTab)?.value || 0, [activeTab, categoryTotals]);

  const workingEstimate = useMemo(
    () => ({
      ...estimate,
      line_items: lineItems,
      categories: categoryTotals,
      subtotal: Math.round(localSubtotal),
      risk_buffer: riskBuffer,
      risk_amount: Math.round(localSubtotal * riskBuffer),
      total_cost: localTotal,
      expected_cost: localTotal,
      min_cost: Math.round(localTotal * 0.92),
      max_cost: Math.round(localTotal * 1.14),
      cost_per_sqft: project?.area ? Math.round((localTotal / project.area) * 100) / 100 : 0,
    }),
    [categoryTotals, estimate, lineItems, localSubtotal, localTotal, project?.area, riskBuffer]
  );

  const updateRow = (id, key, value) => {
    setLineItems((rows) =>
      rows.map((row) =>
        row.id === id
          ? {
              ...row,
              [key]: value,
              amount: Math.round(
                Number(key === "quantity" ? value : row.quantity) *
                  (1 + Number(key === "waste_percent" ? value : row.waste_percent || 0)) *
                  Number(key === "price" ? value : row.price)
              ),
            }
          : row
      )
    );
  };

  const addRow = () => {
    const id = `custom-${Date.now()}`;
    setLineItems((rows) => [
      ...rows,
      {
        id,
        name: `New ${activeTab} item`,
        category: activeTab,
        quantity: 1,
        waste_percent: 0.03,
        unit: "unit",
        price: 0,
        amount: 0,
      },
    ]);
  };

  const duplicateRow = (row) => {
    setLineItems((rows) => [
      ...rows,
      {
        ...row,
        id: `${row.id}-copy-${Date.now()}`,
        name: `${row.name} copy`,
      },
    ]);
  };

  const removeRow = (id) => {
    setLineItems((rows) => rows.filter((row) => row.id !== id));
  };

  const resetRows = () => {
    setLineItems(project?.estimate?.line_items || []);
    setRiskBuffer(project?.estimate?.risk_buffer || 0.12);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Construction Cost Estimate", 14, 18);
    doc.setFontSize(10);
    doc.text(`Project: ${project.name}`, 14, 30);
    doc.text(`Location: ${project.location}`, 14, 37);
    doc.text(`Total: ${money(estimate.total_cost)}`, 14, 44);
    doc.text(`Cost per sqft: ${money(estimate.cost_per_sqft)}`, 14, 51);
    let y = 64;
    estimate.categories.forEach((category) => {
      doc.text(`${category.name}: ${money(category.value)}`, 14, y);
      y += 7;
    });
    doc.save(`${project.name.replace(/\s+/g, "-").toLowerCase()}-estimate.pdf`);
  };

  const askAI = async (question) => {
    setAiQuestion(question);
    setChatMessages((messages) => [...messages, { role: "user", text: question }]);
    const response = await explainCost(question);
    if (response?.answer) {
      setChatMessages((messages) => [...messages, { role: "assistant", text: response.answer }]);
    }
  };

  const submitChat = async (event) => {
    event.preventDefault();
    const question = chatInput.trim();
    if (!question) return;
    setChatInput("");
    await askAI(question);
  };

  if (!estimate) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Total Cost" value={shortMoney(estimate.total_cost)} subtext={`${percent(estimate.risk_buffer)} risk buffer`} accent="bg-teal-500" />
        <MetricCard label="Cost per sqft" value={money(estimate.cost_per_sqft)} subtext={`${project.area.toLocaleString("en-IN")} sqft`} accent="bg-blue-500" />
        <MetricCard label="Min / Expected / Max" value={shortMoney(estimate.expected_cost)} subtext={`${shortMoney(estimate.min_cost)} - ${shortMoney(estimate.max_cost)}`} accent="bg-amber-500" />
        <MetricCard label="Unsaved Working Total" value={shortMoney(localTotal)} subtext="Updates after edits" accent="bg-slate-500" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_390px]">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold">BOQ Cost Workbook</h2>
                  <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200">{changedRows.size} changed rows</span>
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Estimator-grade editable rows with category subtotals and live working total.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" icon={editMode ? Unlock : Lock} onClick={() => setEditMode((value) => !value)}>
                  {editMode ? "Editing On" : "Locked"}
                </Button>
                <Button variant="secondary" icon={RotateCcw} onClick={resetRows}>
                  Reset
                </Button>
                <Button icon={Calculator} loading={loading.recalculate} onClick={() => updateEstimate(lineItems, riskBuffer)}>
                  Recalculate
                </Button>
              </div>
            </div>
          </div>

          <div className="grid border-b border-slate-200 dark:border-slate-800 sm:grid-cols-4">
            {categoryTotals.map((category) => (
              <button
                key={category.name}
                onClick={() => setActiveTab(category.name)}
                className={`border-b-2 px-4 py-4 text-left transition ${activeTab === category.name ? "border-teal-600 bg-white dark:bg-slate-900" : "border-transparent bg-slate-50 hover:bg-white dark:bg-slate-950 dark:hover:bg-slate-900"}`}
              >
                <p className="text-sm font-bold">{category.name}</p>
                <p className="mt-1 text-xs text-slate-500">{category.rows} rows</p>
                <p className="mt-2 text-base font-bold">{shortMoney(category.value)}</p>
              </button>
            ))}
          </div>

          <div className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Active trade</p>
              <h3 className="text-xl font-bold">{activeTab}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={Plus} disabled={!editMode} onClick={addRow}>
                Add Row
              </Button>
              <Button variant="secondary" icon={Download} onClick={exportPdf}>
                Export PDF
              </Button>
            </div>
          </div>

          <div className="mt-4 max-h-[520px] overflow-auto rounded-lg border border-slate-200 scrollbar-thin dark:border-slate-800">
            <table className="w-full min-w-[940px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase text-slate-500 dark:bg-slate-950">
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="px-3 py-3">Item</th>
                  <th>Unit</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Waste</th>
                  <th>Variance</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map((row) => (
                  <tr key={row.id} className={`border-b border-slate-100 dark:border-slate-800 ${changedRows.has(row.id) ? "bg-amber-50/70 dark:bg-amber-950/20" : ""}`}>
                    <td className="px-3 py-3">
                      <input disabled={!editMode} className="w-full min-w-52 rounded-md border border-transparent bg-transparent px-2 py-2 font-semibold outline-none focus:border-teal-500 focus:bg-white disabled:opacity-80 dark:focus:bg-slate-950" value={row.name} onChange={(event) => updateRow(row.id, "name", event.target.value)} />
                    </td>
                    <td>
                      <input disabled={!editMode} className="w-20 rounded-md border border-slate-200 bg-white px-2 py-2 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950" value={row.unit} onChange={(event) => updateRow(row.id, "unit", event.target.value)} />
                    </td>
                    <td>
                      <input disabled={!editMode} type="number" min="0" className="w-28 rounded-md border border-slate-200 bg-white px-2 py-2 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950" value={row.quantity} onChange={(event) => updateRow(row.id, "quantity", event.target.value)} />
                    </td>
                    <td>
                      <input disabled={!editMode} type="number" min="0" className="w-32 rounded-md border border-slate-200 bg-white px-2 py-2 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950" value={row.price} onChange={(event) => updateRow(row.id, "price", event.target.value)} />
                    </td>
                    <td>
                      <input
                        disabled={!editMode}
                        type="number"
                        min="0"
                        max="25"
                        step="0.5"
                        className="w-24 rounded-md border border-slate-200 bg-white px-2 py-2 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950"
                        value={Math.round(Number(row.waste_percent || 0) * 1000) / 10}
                        onChange={(event) => updateRow(row.id, "waste_percent", Number(event.target.value || 0) / 100)}
                      />
                    </td>
                    <td>
                      <span className={`rounded-md px-2 py-1 text-xs font-bold ${changedRows.has(row.id) ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"}`}>
                        {changedRows.has(row.id) ? "Edited" : "Base"}
                      </span>
                    </td>
                    <td className="text-right font-semibold">{money(row.amount)}</td>
                    <td>
                      <div className="flex justify-end gap-1 pr-3">
                        <button disabled={!editMode} onClick={() => duplicateRow(row)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800" title="Duplicate row">
                          <Copy className="h-4 w-4" />
                        </button>
                        <button disabled={!editMode} onClick={() => removeRow(row.id)} className="rounded-md p-2 text-red-600 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-950" title="Delete row">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-100 font-bold dark:bg-slate-950">
                  <td className="px-5 py-4" colSpan={6}>{activeTab} subtotal</td>
                  <td className="text-right">{shortMoney(activeCategoryTotal)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
            <label>
              <span className="text-sm font-semibold">Risk buffer</span>
              <select className="mt-2 rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900" value={riskBuffer} onChange={(event) => setRiskBuffer(Number(event.target.value))}>
                {[0.1, 0.12, 0.15, 0.18, 0.2].map((item) => (
                  <option key={item} value={item}>{percent(item)}</option>
                ))}
              </select>
            </label>
            <label className="min-w-64 flex-1">
              <span className="text-sm font-semibold">Version name</span>
              <input className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900" value={versionName} onChange={(event) => setVersionName(event.target.value)} />
            </label>
            <Button variant="secondary" icon={Save} loading={loading.saveVersion} onClick={() => saveVersion(versionName || "Estimate version", workingEstimate)}>
              Save Version
            </Button>
          </div>
          </div>

          <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Working total</p>
              <p className="text-2xl font-bold">{shortMoney(localTotal)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className={`rounded-md px-3 py-2 text-sm font-bold ${displayDelta > 0 ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"}`}>
                {displayDelta === 0 ? "No variance" : `${displayDelta > 0 ? "+" : ""}${shortMoney(displayDelta)} vs saved`}
              </span>
              <Button icon={Calculator} loading={loading.recalculate} onClick={() => updateEstimate(lineItems, riskBuffer)}>
                Commit Recalculation
              </Button>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-bold">Cost Distribution</h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={estimate.categories} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={2}>
                    {estimate.categories.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => money(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid gap-2">
              {estimate.categories.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: COLORS[index] }} />{item.name}</span>
                  <strong>{shortMoney(item.value)}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">AI Advisor</h2>
                <p className="text-xs text-slate-500">Chat with the current estimate</p>
              </div>
              <Bot className="h-5 w-5 text-teal-700" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Explain Cost", "How to reduce cost?", "When should I start construction?"].map((question) => (
                <Button key={question} variant={aiQuestion === question ? "primary" : "secondary"} icon={Sparkles} loading={loading.ai && aiQuestion === question} className="flex-1 px-3" onClick={() => askAI(question)}>
                  {question}
                </Button>
              ))}
            </div>
            <div className="mt-4 max-h-72 space-y-3 overflow-y-auto rounded-lg bg-slate-50 p-3 text-sm leading-6 dark:bg-slate-950">
              {chatMessages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`rounded-lg p-3 ${message.role === "user" ? "ml-8 bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "mr-8 bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}>
                  {message.text}
                </div>
              ))}
            </div>
            <form onSubmit={submitChat} className="mt-3 flex gap-2">
              <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Ask about rates, savings, timing..." className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-700 dark:bg-slate-950" />
              <Button type="submit" icon={Send} loading={loading.ai} className="px-3">
                Send
              </Button>
            </form>
            <p className="mt-2 text-xs text-slate-500">Uses HuggingFace Llama when `LLAMA_API_KEY` is set; otherwise demo fallback keeps the chat working.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
