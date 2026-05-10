export default function MetricCard({ label, value, subtext, accent = "bg-teal-500" }) {
  return (
    <div className="glass-panel p-4">
      <div className="mb-3 h-1 w-14 rounded-full bg-gradient-to-r from-[#6366F1] to-[#22D3EE]" />
      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#111827]">{value}</p>
      {subtext ? <p className="mt-1 text-sm text-[#64748B]">{subtext}</p> : null}
    </div>
  );
}
