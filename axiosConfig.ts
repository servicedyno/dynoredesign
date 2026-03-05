import unAuthorizedHelper from "@/helpers/unAutorizedHelper";
import axios from "axios";

const apiBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;
console.log("url for base", apiBaseUrl);

const axiosBaseApi = axios.create({
  baseURL: apiBaseUrl + "api/",
  headers: {
    "Content-Type": "application/json",
  },
});

// Auth endpoints that should NOT send Authorization headers
const AUTH_ENDPOINTS = ["user/login", "user/register", "user/checkEmail", "user/forgot", "user/reset", "user/confirmOTP", "user/generateOTP"];

const isAuthEndpoint = (url: string) => AUTH_ENDPOINTS.some((ep) => url.includes(ep));

// Request interceptor: attach token (skip for auth endpoints)
axiosBaseApi.interceptors.request.use(
  (config: any) => {
    const requestUrl = config.url || "";
    if (isAuthEndpoint(requestUrl)) {
      // Don't send Authorization header for auth endpoints
      delete config.headers.Authorization;
      return config;
    }

    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      delete axiosBaseApi.defaults.headers.common.Authorization;
    }
    return config;
  },
  (error) => {
    console.error("Request error:", error);
    return Promise.reject(error);
  },
);

// Response interceptor: handle errors like 500 and 403
axiosBaseApi.interceptors.response.use(
  (response) => response, // success responses
  (error) => {
    console.error("API Response error:", error.response ?? error.message);

    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || "";
      if (!isAuthEndpoint(requestUrl)) {
        // Remove token from browser storage
        localStorage.removeItem("token");

        // Remove axios default header
        delete axiosBaseApi.defaults.headers.common.Authorization;

        // Redirect to login
        window.location.href = "/auth/login";
      }
    }

    // Handle 403 (Unauthorized/Login Expired) - redirect to login
    if (error.response?.status === 403) {
      unAuthorizedHelper(error);
      return Promise.reject(error);
    }

    // Optional: you can return a standard format to always handle errors consistently
    return Promise.reject(error);
  },
);

export default axiosBaseApi;
