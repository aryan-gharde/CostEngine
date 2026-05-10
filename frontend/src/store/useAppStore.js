import { create } from "zustand";
import { endpoints } from "../api";

const savedUser = localStorage.getItem("ccip_user");
const savedToken = localStorage.getItem("ccip_token");

const initialPriceMap = {
  steel: 62500,
  cement: 410,
  sand: 72,
  aggregate: 96,
  copper: 820,
};

export const useAppStore = create((set, get) => ({
  user: savedUser ? JSON.parse(savedUser) : null,
  token: savedToken || null,
  page: "Dashboard",
  projects: [],
  selectedProject: null,
  versions: [],
  materialPrices: initialPriceMap,
  templates: {},
  darkMode: false,
  loading: {},
  toast: null,

  setPage: (page) => set({ page }),
  setSelectedProject: (project) => set({ selectedProject: project, page: "Projects" }),
  setToast: (toast) => set({ toast }),
  setLoading: (key, value) => set((state) => ({ loading: { ...state.loading, [key]: value } })),
  updateProfile: (profile) => {
    const user = { ...get().user, ...profile };
    localStorage.setItem("ccip_user", JSON.stringify(user));
    set({ user, toast: { type: "success", message: "Profile settings saved" } });
  },
  toggleTheme: () => {
    localStorage.setItem("ccip_theme", "light");
    set({ darkMode: false });
  },

  authenticate: async (mode, payload) => {
    get().setLoading("auth", true);
    try {
      const data = mode === "signup" ? await endpoints.signup(payload) : await endpoints.login(payload);
      localStorage.setItem("ccip_token", data.token);
      localStorage.setItem("ccip_user", JSON.stringify(data.user));
      set({ token: data.token, user: data.user, toast: { type: "success", message: `Welcome, ${data.user.name}` } });
      await get().fetchProjects();
    } catch (error) {
      set({ toast: { type: "error", message: error.message } });
    } finally {
      get().setLoading("auth", false);
    }
  },

  logout: () => {
    localStorage.removeItem("ccip_token");
    localStorage.removeItem("ccip_user");
    set({ user: null, token: null, projects: [], selectedProject: null, versions: [], page: "Dashboard" });
  },

  fetchProjects: async () => {
    get().setLoading("projects", true);
    try {
      const projects = await endpoints.listProjects();
      set((state) => ({
        projects,
        selectedProject:
          state.selectedProject && projects.find((project) => project.id === state.selectedProject.id)
            ? projects.find((project) => project.id === state.selectedProject.id)
            : projects[0] || null,
      }));
    } catch (error) {
      set({ toast: { type: "error", message: error.message } });
    } finally {
      get().setLoading("projects", false);
    }
  },

  createProject: async (payload) => {
    get().setLoading("createProject", true);
    try {
      const project = await endpoints.createProject(payload);
      set((state) => ({
        projects: [project, ...state.projects],
        selectedProject: project,
        page: "Projects",
        toast: { type: "success", message: "Project created and estimate generated" },
      }));
      await get().fetchVersions(project.id);
    } catch (error) {
      set({ toast: { type: "error", message: error.message } });
    } finally {
      get().setLoading("createProject", false);
    }
  },

  deleteProject: async (projectId) => {
    get().setLoading(`delete-${projectId}`, true);
    try {
      await endpoints.deleteProject(projectId);
      set((state) => {
        const projects = state.projects.filter((project) => project.id !== projectId);
        return {
          projects,
          selectedProject: state.selectedProject?.id === projectId ? projects[0] || null : state.selectedProject,
          toast: { type: "success", message: "Project deleted" },
        };
      });
    } catch (error) {
      set({ toast: { type: "error", message: error.message } });
    } finally {
      get().setLoading(`delete-${projectId}`, false);
    }
  },

  updateEstimate: async (lineItems, riskBuffer) => {
    const project = get().selectedProject;
    if (!project) return;
    get().setLoading("recalculate", true);
    try {
      const updated = await endpoints.recalculate(project.id, {
        project: {
          name: project.name,
          location: project.location,
          area: project.area,
          floors: project.floors,
          quality_tier: project.quality_tier,
          finish_level: project.finish_level,
          material_preferences: project.material_preferences,
        },
        line_items: lineItems,
        risk_buffer: riskBuffer,
        material_prices: get().materialPrices,
      });
      set((state) => ({
        selectedProject: updated,
        projects: state.projects.map((item) => (item.id === updated.id ? updated : item)),
        toast: { type: "success", message: "Estimate recalculated" },
      }));
    } catch (error) {
      set({ toast: { type: "error", message: error.message } });
    } finally {
      get().setLoading("recalculate", false);
    }
  },

  saveVersion: async (name, estimate) => {
    const project = get().selectedProject;
    if (!project) return;
    get().setLoading("saveVersion", true);
    try {
      const version = await endpoints.saveVersion({ project_id: project.id, name, estimate });
      set((state) => ({
        versions: [version, ...state.versions],
        toast: { type: "success", message: "Version saved" },
      }));
    } catch (error) {
      set({ toast: { type: "error", message: error.message } });
    } finally {
      get().setLoading("saveVersion", false);
    }
  },

  fetchVersions: async (projectId) => {
    if (!projectId) return;
    get().setLoading("versions", true);
    try {
      const versions = await endpoints.listVersions(projectId);
      set({ versions });
    } catch (error) {
      set({ toast: { type: "error", message: error.message } });
    } finally {
      get().setLoading("versions", false);
    }
  },

  runScenario: async (delayMonths, qualityTier) => {
    const project = get().selectedProject;
    if (!project?.estimate) return;
    get().setLoading("scenario", true);
    try {
      const estimate = await endpoints.scenario({ estimate: project.estimate, delay_months: delayMonths, quality_tier: qualityTier });
      set((state) => ({
        selectedProject: { ...state.selectedProject, estimate },
        toast: { type: "success", message: "Scenario applied" },
      }));
    } catch (error) {
      set({ toast: { type: "error", message: error.message } });
    } finally {
      get().setLoading("scenario", false);
    }
  },

  explainCost: async (question) => {
    const estimate = get().selectedProject?.estimate;
    if (!estimate) return null;
    get().setLoading("ai", true);
    try {
      const response = await endpoints.explain({ estimate, question });
      return response;
    } catch (error) {
      set({ toast: { type: "error", message: error.message } });
      return null;
    } finally {
      get().setLoading("ai", false);
    }
  },

  fetchAdminConfig: async () => {
    get().setLoading("admin", true);
    try {
      const [materialPrices, templates] = await Promise.all([endpoints.prices(), endpoints.templates()]);
      set({ materialPrices: materialPrices || initialPriceMap, templates: templates || {} });
    } catch (error) {
      set({ toast: { type: "error", message: error.message } });
    } finally {
      get().setLoading("admin", false);
    }
  },

  savePrices: async (prices) => {
    get().setLoading("savePrices", true);
    try {
      const materialPrices = await endpoints.updatePrices(prices);
      set({ materialPrices, toast: { type: "success", message: "Material prices updated" } });
    } catch (error) {
      set({ toast: { type: "error", message: error.message } });
    } finally {
      get().setLoading("savePrices", false);
    }
  },

  saveTemplates: async (templates) => {
    get().setLoading("saveTemplates", true);
    try {
      const saved = await endpoints.updateTemplates(templates);
      set({ templates: saved, toast: { type: "success", message: "Templates updated" } });
    } catch (error) {
      set({ toast: { type: "error", message: error.message } });
    } finally {
      get().setLoading("saveTemplates", false);
    }
  },

  fluctuatePrices: () => {
    set((state) => ({
      materialPrices: Object.fromEntries(
        Object.entries(state.materialPrices).map(([key, value]) => {
          const drift = 1 + (Math.random() - 0.5) * 0.035;
          return [key, Math.max(1, Math.round(value * drift))];
        })
      ),
    }));
  },
}));
