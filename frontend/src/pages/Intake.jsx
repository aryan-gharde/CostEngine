import { AlertTriangle, BrainCircuit, CheckCircle2, FileSpreadsheet, FileText, Plus, UploadCloud } from "lucide-react";
import { useMemo, useState } from "react";
import Button from "../components/Button";
import { endpoints } from "../api";
import { useAppStore } from "../store/useAppStore";
import { money, shortMoney } from "../utils";

const acceptedTypes = ".csv,.xlsx,.xlsm,.pdf,.dxf,.dwg";

export default function Intake() {
  const { createProject, loading, setToast } = useAppStore();
  const [files, setFiles] = useState([]);
  const [result, setResult] = useState(null);
  const [uploading, setUploading] = useState(false);

  const materialRows = result?.material_rows || [];
  const suggestedProject = result?.suggested_project;
  const topRows = materialRows.slice(0, 12);

  const categoryRows = useMemo(() => {
    const rows = result?.category_totals || [];
    return rows.length ? rows : ["Structure", "Finishing", "MEP", "Labour"].map((name) => ({ name, value: 0 }));
  }, [result]);

  const onFileChange = (event) => {
    setFiles(Array.from(event.target.files || []));
    setResult(null);
  };

  const analyze = async () => {
    if (!files.length) {
      setToast({ type: "error", message: "Choose at least one CAD, PDF, Excel, or CSV file." });
      return;
    }
    setUploading(true);
    try {
      const response = await endpoints.analyzeDocuments(files);
      setResult(response);
      setToast({ type: "success", message: "Documents analyzed and mapped to estimate fields" });
    } catch (error) {
      setToast({ type: "error", message: error.message });
    } finally {
      setUploading(false);
    }
  };

  const createFromExtraction = async () => {
    if (!suggestedProject) return;
    await createProject({
      ...suggestedProject,
      area: Number(suggestedProject.area || 2500),
      floors: Number(suggestedProject.floors || 2),
      line_items: materialRows,
      risk_buffer: 0.14,
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">Document Intake / AI Takeoff</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">Upload drawings and material sheets</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Upload CAD drawings, PDFs, Excel, or CSV files. The parser extracts quantities, maps material columns, detects trade categories, and prepares a project estimate with confidence scores.
            </p>
          </div>
          <Button icon={BrainCircuit} loading={uploading} onClick={analyze}>
            Analyze with AI Mapping
          </Button>
        </div>

        <label className="mt-5 flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition hover:border-teal-500 hover:bg-teal-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-teal-950">
          <UploadCloud className="h-10 w-10 text-teal-700 dark:text-teal-300" />
          <span className="mt-3 text-lg font-bold">Drop files here or click to browse</span>
          <span className="mt-1 text-sm text-slate-500">Supported: CAD DXF/DWG, PDF, XLSX, CSV</span>
          <input type="file" multiple accept={acceptedTypes} className="hidden" onChange={onFileChange} />
        </label>

        {files.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {files.map((file) => (
              <div key={`${file.name}-${file.size}`} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                {file.name.toLowerCase().endsWith(".pdf") ? <FileText className="h-5 w-5 text-red-600" /> : <FileSpreadsheet className="h-5 w-5 text-teal-700" />}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {result ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-bold uppercase text-slate-500">Files analyzed</p>
              <p className="mt-2 text-2xl font-bold">{result.summary.files}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-bold uppercase text-slate-500">Mapped rows</p>
              <p className="mt-2 text-2xl font-bold">{result.summary.material_rows}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-bold uppercase text-slate-500">Mapped value</p>
              <p className="mt-2 text-2xl font-bold">{shortMoney(result.summary.mapped_value)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-bold uppercase text-slate-500">Avg confidence</p>
              <p className="mt-2 text-2xl font-bold">{Math.round(result.summary.average_confidence * 100)}%</p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">AI-Mapped Materials</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Rows normalized from material schedules, BOQs, and extracted PDF text.</p>
                </div>
                <Button icon={Plus} loading={loading.createProject} disabled={!suggestedProject} onClick={createFromExtraction}>
                  Create Project From Takeoff
                </Button>
              </div>
              <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 scrollbar-thin dark:border-slate-800">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-slate-100 text-xs uppercase text-slate-500 dark:bg-slate-950">
                    <tr>
                      <th className="px-3 py-3">Mapped Item</th>
                      <th>Trade</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Rate</th>
                      <th>Amount</th>
                      <th>Confidence</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topRows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-3 font-semibold">{row.name}</td>
                        <td>{row.category}</td>
                        <td>{row.quantity}</td>
                        <td>{row.unit}</td>
                        <td>{money(row.price)}</td>
                        <td className="font-bold">{money(row.amount)}</td>
                        <td>
                          <span className={`rounded-md px-2 py-1 text-xs font-bold ${row.confidence >= 0.8 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"}`}>
                            {Math.round(row.confidence * 100)}%
                          </span>
                        </td>
                        <td className="max-w-48 truncate text-slate-500">{row.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!topRows.length ? <p className="p-6 text-sm text-slate-500">No material rows found. For scanned PDFs, connect an OCR worker or upload CSV/XLSX schedules.</p> : null}
              </div>
            </section>

            <aside className="space-y-6">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-lg font-bold">Suggested Project</h2>
                <div className="mt-4 grid gap-3">
                  {[
                    ["Name", suggestedProject?.name],
                    ["Location", suggestedProject?.location],
                    ["Area", `${Number(suggestedProject?.area || 0).toLocaleString("en-IN")} sqft`],
                    ["Floors", suggestedProject?.floors],
                    ["Quality", suggestedProject?.quality_tier],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-950">
                      <span className="font-semibold text-slate-500">{label}</span>
                      <strong className="text-right">{value}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-lg font-bold">Category Mapping</h2>
                <div className="mt-4 grid gap-2">
                  {categoryRows.map((row) => (
                    <div key={row.name} className="flex items-center justify-between rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-950">
                      <span className="font-semibold">{row.name}</span>
                      <strong>{shortMoney(row.value)}</strong>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-bold">Drawing Takeoff</h2>
              <div className="mt-4 grid gap-3">
                {(result.drawing_takeoff || []).map((item) => (
                  <div key={item.file} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                    <p className="font-bold">{item.file}</p>
                    <p className="mt-2 text-sm text-slate-500">Area: {item.drawing_area_sqft ? `${item.drawing_area_sqft.toLocaleString("en-IN")} sqft` : "Needs scale/conversion"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(item.cad_entities || []).map((entity) => (
                        <span key={entity.type} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold dark:bg-slate-800">{entity.type}: {entity.count}</span>
                      ))}
                    </div>
                    {(item.notes || []).map((note) => <p key={note} className="mt-2 text-xs text-amber-700 dark:text-amber-300">{note}</p>)}
                  </div>
                ))}
                {!result.drawing_takeoff?.length ? <p className="text-sm text-slate-500">Upload DXF/DWG files to see drawing entity takeoff.</p> : null}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="flex items-center gap-2 text-lg font-bold"><AlertTriangle className="h-5 w-5 text-amber-600" /> Extraction Log and Assumptions</h2>
              <div className="mt-4 grid gap-2">
                {result.extraction_log.map((log) => (
                  <div key={`${log.file}-${log.status}`} className="flex items-center justify-between rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-950">
                    <span className="min-w-0 truncate font-semibold">{log.file}</span>
                    <span className="ml-3 rounded-md bg-white px-2 py-1 text-xs font-bold dark:bg-slate-900">{log.status}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-2">
                {result.assumptions.map((assumption) => (
                  <p key={assumption} className="flex gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                    {assumption}
                  </p>
                ))}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
