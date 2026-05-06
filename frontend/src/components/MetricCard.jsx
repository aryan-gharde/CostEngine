export default function MetricCard({ label, value, subtext, accent = "bg-teal-500" }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900`}>
      <div className={`mb-3 h-1 w-14 rounded-full ${accent}`} />
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{value}</p>
      {subtext ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtext}</p> : null}
    </div>
  );
}
