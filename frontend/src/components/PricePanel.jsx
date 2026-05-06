import { Activity, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import Button from "./Button";
import { useAppStore } from "../store/useAppStore";
import { money } from "../utils";

const units = {
  steel: "/MT",
  cement: "/bag",
  sand: "/cft",
  aggregate: "/cft",
  copper: "/kg",
};

export default function PricePanel() {
  const { materialPrices, fluctuatePrices } = useAppStore();

  useEffect(() => {
    const timer = setInterval(fluctuatePrices, 6500);
    return () => clearInterval(timer);
  }, [fluctuatePrices]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Real-Time Price Panel</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Simulated market fluctuation for core materials.</p>
        </div>
        <Button variant="secondary" icon={RefreshCw} onClick={fluctuatePrices}>
          Fluctuate
        </Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Object.entries(materialPrices).map(([key, value]) => (
          <div key={key} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold capitalize">{key}</p>
              <Activity className="h-4 w-4 text-teal-700 dark:text-teal-300" />
            </div>
            <p className="mt-3 text-xl font-bold">{money(value)}</p>
            <p className="text-xs text-slate-500">{units[key] || "/unit"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

