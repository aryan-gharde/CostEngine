import Sidebar from "./Sidebar";
import Toast from "./Toast";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-[#eef2f3] text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <div className="grid lg:grid-cols-[18rem_1fr]">
        <Sidebar />
        <main className="min-h-screen overflow-hidden p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
      <Toast />
    </div>
  );
}

