import { Save, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import Button from "../components/Button";
import { useAppStore } from "../store/useAppStore";

export default function Admin() {
  const {
    materialPrices,
    templates,
    fetchAdminConfig,
    savePrices,
    saveTemplates,
    loading,
  } = useAppStore();

  // FIX 1: Safe default — never initialise from store directly.
  // materialPrices / templates may be undefined on first render (store not
  // yet hydrated), which would make Object.entries() throw.
  const [priceDraft, setPriceDraft]       = useState({});
  const [templateDraft, setTemplateDraft] = useState({});

  // Fetch config once on mount
  useEffect(() => {
    fetchAdminConfig();
  }, [fetchAdminConfig]);

  // FIX 2: Sync drafts from store only when store data arrives / changes.
  // Guard with truthiness so a null / undefined response doesn't wipe a
  // draft the user is mid-edit.
  useEffect(() => {
    if (materialPrices) {
      console.log("materialPrices:", materialPrices);
      setPriceDraft(materialPrices);
    }
  }, [materialPrices]);

  useEffect(() => {
    if (templates) {
      setTemplateDraft(templates);
    }
  }, [templates]);

  // Debug visible in DevTools during development
  console.log("priceDraft:", priceDraft);

  // FIX 3: Prevent NaN keep the raw string while the user is typing so
  // the input feels responsive; convert to Number only when the field has
  // a real value. The backend receives numbers; "" is a safe transient state.
  const updatePrice = (key, value) =>
    setPriceDraft((current) => ({
      ...current,
      [key]: value === "" ? "" : Number(value),
    }));

  const updateTemplate = (key, value) =>
    setTemplateDraft((current) => ({ ...current, [key]: value }));

  const addTemplate = () =>
    setTemplateDraft((current) => ({
      ...current,
      [`template_${Object.keys(current).length + 1}`]: "New template specification",
    }));

  // FIX 4: After save, refetch so the store — and therefore the draft —
  // reflects exactly what the backend persisted (handles rounding, defaults,
  // server-side transformations, etc.).
  const handleSavePrices = async () => {
    await savePrices(priceDraft);
    fetchAdminConfig();
  };

  const handleSaveTemplates = async () => {
    await saveTemplates(templateDraft);
    fetchAdminConfig();
  };

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
        {/* Material Prices  */}
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Update Material Prices</h2>
            {/* FIX 4: use handleSavePrices so refetch runs after save */}
            <Button icon={Save} loading={loading.savePrices} onClick={handleSavePrices}>
              Save Prices
            </Button>
          </div>

          <div className="mt-4 grid gap-3">
            {/* FIX 5: guard against null / empty renders nothing instead of throwing */}
            {priceDraft && Object.entries(priceDraft).map(([key, value]) => (
              <label key={key} className="grid gap-2 sm:grid-cols-[1fr_180px] sm:items-center">
                <span className="text-sm font-semibold capitalize">{key}</span>
                <input
                  type="number"
                  min="1"
                  value={value}
                  onChange={(event) => updatePrice(key, event.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
            ))}
          </div>
        </section>

        {/* Templates  */}
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Edit Templates</h2>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={addTemplate}>Add Template</Button>
              {/* FIX 4: use handleSaveTemplates so refetch runs after save */}
              <Button icon={Save} loading={loading.saveTemplates} onClick={handleSaveTemplates}>
                Save Templates
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-4">
            {/* FIX 5: guard against null / empty */}
            {templateDraft && Object.entries(templateDraft).map(([key, value]) => (
              <label key={key}>
                <span className="text-sm font-semibold capitalize">{key.replaceAll("_", " ")}</span>
                <textarea
                  value={value}
                  onChange={(event) => updateTemplate(key, event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
