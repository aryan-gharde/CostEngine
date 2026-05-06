import { ArrowLeft, ArrowRight, Check, FileUp, X } from "lucide-react";
import { useMemo, useState } from "react";
import Button from "./Button";
import { endpoints } from "../api";
import { useAppStore } from "../store/useAppStore";

const materialOptions = ["TMT steel", "Portland cement", "AAC blocks", "Premium tiles", "UPVC windows", "Copper wiring"];

export default function ProjectWizard({ open, onClose }) {
  const { createProject, loading, setToast } = useAppStore();
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [takeoffRows, setTakeoffRows] = useState([]);
  const [takeoffSummary, setTakeoffSummary] = useState(null);
  const [form, setForm] = useState({
    name: "Lakeview Residences",
    location: "Pune, Maharashtra",
    area: 4200,
    floors: 3,
    quality_tier: "Medium",
    finish_level: "Standard",
    custom_rate_per_sqft: 2000,
    material_preferences: ["TMT steel", "Portland cement"],
  });

  const canContinue = useMemo(() => form.name && form.location && Number(form.area) > 0 && Number(form.floors) > 0, [form]);

  if (!open) return null;

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateQuality = (tier) =>
    setForm((current) => ({
      ...current,
      quality_tier: tier,
      custom_rate_per_sqft: current.custom_rate_per_sqft || (tier === "Medium" ? 2000 : 3200),
    }));

  const analyzeFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const result = await endpoints.analyzeDocuments(files);
      const suggested = result.suggested_project || {};
      setForm((current) => ({
        ...current,
        name: suggested.name || current.name,
        location: suggested.location || current.location,
        area: suggested.area || current.area,
        floors: suggested.floors || current.floors,
        material_preferences: suggested.material_preferences?.length ? suggested.material_preferences : current.material_preferences,
      }));
      setTakeoffRows(result.material_rows || []);
      setTakeoffSummary(result.summary);
      setToast({ type: "success", message: "Uploaded documents mapped into the project wizard" });
    } catch (error) {
      setToast({ type: "error", message: error.message });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };
  const toggleMaterial = (item) => {
    const exists = form.material_preferences.includes(item);
    update("material_preferences", exists ? form.material_preferences.filter((value) => value !== item) : [...form.material_preferences, item]);
  };

  const submit = async () => {
    await createProject({
      ...form,
      area: Number(form.area),
      floors: Number(form.floors),
      custom_rate_per_sqft: Number(form.custom_rate_per_sqft || 0) || undefined,
      line_items: takeoffRows.length ? takeoffRows : undefined,
      risk_buffer: takeoffRows.length ? 0.14 : undefined,
    });
    onClose();
    setStep(1);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-soft dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
          <div>
            <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Create Project</p>
            <h2 className="text-2xl font-bold text-slate-950 dark:text-white">Estimate setup</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close project wizard">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className={`rounded-md border p-3 ${step === item ? "border-teal-500 bg-teal-50 dark:bg-teal-950" : "border-slate-200 dark:border-slate-800"}`}>
              <p className="text-xs font-semibold uppercase text-slate-500">Step {item}</p>
              <p className="mt-1 text-sm font-bold">{item === 1 ? "Project basics" : item === 2 ? "Quality profile" : "Materials"}</p>
            </div>
          ))}
        </div>

        <div className="p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
            <div>
              <p className="text-sm font-bold">Start from documents</p>
              <p className="text-xs text-slate-500">Upload CAD/PDF/Excel/CSV to prefill project fields and BOQ rows.</p>
            </div>
            <label className="inline-flex cursor-pointer">
              <input type="file" multiple accept=".csv,.xlsx,.xlsm,.pdf,.dxf,.dwg" className="hidden" onChange={analyzeFiles} />
              <span className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                <FileUp className="h-4 w-4" />
                {uploading ? "Analyzing..." : "Upload Files"}
              </span>
            </label>
            {takeoffSummary ? (
              <div className="basis-full rounded-md bg-teal-50 p-3 text-sm font-semibold text-teal-900 dark:bg-teal-950 dark:text-teal-100">
                {takeoffSummary.material_rows} mapped rows, {Math.round(takeoffSummary.average_confidence * 100)}% average confidence.
              </div>
            ) : null}
          </div>

          {step === 1 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-sm font-semibold">Project Name</span>
                <input className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-700 dark:bg-slate-950" value={form.name} onChange={(event) => update("name", event.target.value)} />
              </label>
              <label>
                <span className="text-sm font-semibold">Location</span>
                <input className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-700 dark:bg-slate-950" value={form.location} onChange={(event) => update("location", event.target.value)} />
              </label>
              <label>
                <span className="text-sm font-semibold">Area (sqft)</span>
                <input type="number" min="1" className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-700 dark:bg-slate-950" value={form.area} onChange={(event) => update("area", event.target.value)} />
              </label>
              <label>
                <span className="text-sm font-semibold">Floors</span>
                <input type="number" min="1" className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-700 dark:bg-slate-950" value={form.floors} onChange={(event) => update("floors", event.target.value)} />
              </label>
              <label>
                <span className="text-sm font-semibold">Rate per sqft</span>
                <input type="number" min="1" className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-700 dark:bg-slate-950" value={form.custom_rate_per_sqft} onChange={(event) => update("custom_rate_per_sqft", event.target.value)} />
              </label>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="text-sm font-semibold">Quality Tier</span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {["Medium", "High"].map((tier) => (
                    <button key={tier} onClick={() => updateQuality(tier)} className={`rounded-md border px-4 py-4 text-left font-semibold ${form.quality_tier === tier ? "border-teal-500 bg-teal-50 text-teal-900 dark:bg-teal-950 dark:text-teal-100" : "border-slate-200 dark:border-slate-700"}`}>
                      {tier}
                      <span className="block text-xs font-medium text-slate-500">{tier === "Medium" ? "Default Rs. 2,000/sqft" : "Default Rs. 3,200/sqft"}</span>
                    </button>
                  ))}
                </div>
              </div>
              <label>
                <span className="text-sm font-semibold">Finish Level</span>
                <select className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-700 dark:bg-slate-950" value={form.finish_level} onChange={(event) => update("finish_level", event.target.value)}>
                  {["Basic", "Standard", "Premium", "Luxury"].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {step === 3 ? (
            <div>
              <span className="text-sm font-semibold">Material Preferences</span>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {materialOptions.map((item) => {
                  const active = form.material_preferences.includes(item);
                  return (
                    <button key={item} onClick={() => toggleMaterial(item)} className={`flex min-h-16 items-center justify-between rounded-md border px-4 text-left text-sm font-semibold ${active ? "border-teal-500 bg-teal-50 text-teal-900 dark:bg-teal-950 dark:text-teal-100" : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"}`}>
                      {item}
                      {active ? <Check className="h-4 w-4" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200 p-5 dark:border-slate-800">
          <Button type="button" variant="secondary" icon={ArrowLeft} disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))}>
            Back
          </Button>
          {step < 3 ? (
            <Button type="button" icon={ArrowRight} disabled={!canContinue} onClick={() => setStep((current) => current + 1)}>
              Next
            </Button>
          ) : (
            <Button type="button" icon={Check} loading={loading.createProject} onClick={submit}>
              Generate Estimate
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
