import { Save, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import Button from "../components/Button";
import { useAppStore } from "../store/useAppStore";

export default function Admin() {
  const { materialPrices, templates, fetchAdminConfig, savePrices, saveTemplates, loading } = useAppStore();
  const [priceDraft, setPriceDraft] = useState(materialPrices);
  const [templateDraft, setTemplateDraft] = useState(templates);

  useEffect(() => {
    fetchAdminConfig();
  }, [fetchAdminConfig]);

  useEffect(() => {
    setPriceDraft(materialPrices);
  }, [materialPrices]);

  useEffect(() => {
    setTemplateDraft(templates);
  }, [templates]);

  const updatePrice = (key, value) => setPriceDraft((current) => ({ ...current, [key]: Number(value) }));
  const updateTemplate = (key, value) => setTemplateDraft((current) => ({ ...current, [key]: value }));
  const addTemplate = () => setTemplateDraft((current) => ({ ...current, [`template_${Object.keys(current).length + 1}`]: "New template specification" }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">Admin</p>
          <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Pricing and Templates</h1>
        </div>
        <Button variant="secondary" icon={Settings2} loading={loading.admin} onClick={fetchAdminConfig}>
          Reload Config
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Update Material Prices</h2>
            <Button icon={Save} loading={loading.savePrices} onClick={() => savePrices(priceDraft)}>Save Prices</Button>
          </div>
          <div className="mt-4 grid gap-3">
            {Object.entries(priceDraft).map(([key, value]) => (
              <label key={key} className="grid gap-2 sm:grid-cols-[1fr_180px] sm:items-center">
                <span className="text-sm font-semibold capitalize">{key}</span>
                <input type="number" min="1" value={value} onChange={(event) => updatePrice(key, event.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Edit Templates</h2>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={addTemplate}>Add Template</Button>
              <Button icon={Save} loading={loading.saveTemplates} onClick={() => saveTemplates(templateDraft)}>Save Templates</Button>
            </div>
          </div>
          <div className="mt-4 grid gap-4">
            {Object.entries(templateDraft).map(([key, value]) => (
              <label key={key}>
                <span className="text-sm font-semibold capitalize">{key.replaceAll("_", " ")}</span>
                <textarea value={value} onChange={(event) => updateTemplate(key, event.target.value)} rows={3} className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
              </label>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

