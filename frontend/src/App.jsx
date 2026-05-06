import { useEffect } from "react";
import AuthScreen from "./components/AuthScreen";
import Layout from "./components/Layout";
import Admin from "./pages/Admin";
import Dashboard from "./pages/Dashboard";
import Intake from "./pages/Intake";
import Projects from "./pages/Projects";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import { useAppStore } from "./store/useAppStore";

export default function App() {
  const { user, page, darkMode, fetchProjects, fetchAdminConfig } = useAppStore();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (user) {
      fetchProjects();
      fetchAdminConfig();
    }
  }, [user, fetchProjects, fetchAdminConfig]);

  if (!user) return <AuthScreen />;

  return (
    <Layout>
      {page === "Dashboard" ? <Dashboard /> : null}
      {page === "Projects" ? <Projects /> : null}
      {page === "Intake" ? <Intake /> : null}
      {page === "Reports" ? <Reports /> : null}
      {page === "Admin" ? <Admin /> : null}
      {page === "Settings" ? <Settings /> : null}
    </Layout>
  );
}
