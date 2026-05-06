const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, options = {}) {
  const token = localStorage.getItem("ccip_token");
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new ApiError(data?.detail || "Request failed", response.status);
  }
  return data;
}

export const endpoints = {
  signup: (payload) => api("/auth/signup", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => api("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  createProject: (payload) => api("/project/create", { method: "POST", body: JSON.stringify(payload) }),
  listProjects: () => api("/project/list"),
  deleteProject: (id) => api(`/project/${id}`, { method: "DELETE" }),
  recalculate: (id, payload) => api(`/estimate/project/${id}/recalculate`, { method: "POST", body: JSON.stringify(payload) }),
  calculate: (payload) => api("/estimate/calculate", { method: "POST", body: JSON.stringify(payload) }),
  saveVersion: (payload) => api("/estimate/version", { method: "POST", body: JSON.stringify(payload) }),
  listVersions: (projectId) => api(`/estimate/version/${projectId}`),
  explain: (payload) => api("/ai/explain", { method: "POST", body: JSON.stringify(payload) }),
  scenario: (payload) => api("/scenario/run", { method: "POST", body: JSON.stringify(payload) }),
  prices: () => api("/admin/prices"),
  updatePrices: (prices) => api("/admin/prices", { method: "POST", body: JSON.stringify({ prices }) }),
  templates: () => api("/admin/templates"),
  updateTemplates: (templates) => api("/admin/templates", { method: "POST", body: JSON.stringify({ templates }) }),
  analyzeDocuments: (files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    return api("/documents/analyze", { method: "POST", body: formData });
  },
};
