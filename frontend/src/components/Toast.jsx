import { X } from "lucide-react";
import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";

export default function Toast() {
  const { toast, setToast } = useAppStore();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(timer);
  }, [toast, setToast]);

  if (!toast) return null;

  return (
    <div className={`fixed right-5 top-5 z-50 flex max-w-sm items-start gap-3 rounded-lg border p-4 shadow-soft ${toast.type === "error" ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
      <p className="text-sm font-medium">{toast.message}</p>
      <button onClick={() => setToast(null)} className="rounded p-1 hover:bg-black/5" aria-label="Dismiss notification">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

