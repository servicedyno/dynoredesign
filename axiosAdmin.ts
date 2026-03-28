import axios from "axios";
const apiBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
// Ensure trailing slash before appending "api/"
const normalizedBase = apiBaseUrl.endsWith("/") ? apiBaseUrl : (apiBaseUrl ? apiBaseUrl + "/" : "");

const adminBaseApi = axios.create({
  baseURL: normalizedBase + "api/",
  headers: {
    "Content-Type": "application/json",
  },
});

adminBaseApi.interceptors.request.use(
  (config: any) => {
    const token = localStorage.getItem("admin_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      delete adminBaseApi.defaults.headers.common.Authorization;
    }
    return config;
  },

  (error) => console.error(error)
);

export default adminBaseApi;
