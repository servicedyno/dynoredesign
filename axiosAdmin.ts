import axios from "axios";
const apiBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

const adminBaseApi = axios.create({
  baseURL: apiBaseUrl + "api/",
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
