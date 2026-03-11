import unAuthorizedHelper from "@/helpers/unAutorizedHelper";
import axios from "axios";

const apiBaseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
console.log("url for base", apiBaseUrl);

const axiosBaseApi = axios.create({
  baseURL: apiBaseUrl + "/api/",
  headers: {
    "Content-Type": "application/json",
  },
});

// Auth endpoints that should NOT send Authorization headers
const AUTH_ENDPOINTS = ["user/login", "user/register", "user/checkEmail", "user/forgot", "user/reset", "user/confirmOTP", "user/generateOTP"];

const isAuthEndpoint = (url: string) => AUTH_ENDPOINTS.some((ep) => url.includes(ep));

// --- Token Refresh State ---
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

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

// Response interceptor: handle 401 with token refresh
axiosBaseApi.interceptors.response.use(
  (response) => response, // success responses
  async (error) => {
    const originalRequest = error.config;

    // Skip auth redirect for public pages (homepage, checkout, fees, etc.) — visitors are not logged in
    const isCheckoutPage = typeof window !== "undefined" && window.location.pathname.startsWith("/pay");
    const isPublicPage = typeof window !== "undefined" && ["/", "/fees", "/terms-conditions", "/privacy-policy", "/aml-policy", "/system-status", "/documentation"].includes(window.location.pathname);
    const hasToken = typeof window !== "undefined" && !!localStorage.getItem("token");

    if (error.response?.status === 401 && !isAuthEndpoint(originalRequest?.url || "")) {
      // On public/checkout pages without a token, don't redirect — just reject the error
      if ((isCheckoutPage || isPublicPage) && !hasToken) {
        return Promise.reject(error);
      }

      // Don't retry if this was already a retry or a refresh-token call
      if (originalRequest._retry || (originalRequest.url || "").includes("user/refresh-token")) {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        delete axiosBaseApi.defaults.headers.common.Authorization;
        window.location.href = "/auth/login";
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request while refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosBaseApi(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) {
        isRefreshing = false;
        localStorage.removeItem("token");
        delete axiosBaseApi.defaults.headers.common.Authorization;
        window.location.href = "/auth/login";
        return Promise.reject(error);
      }

      try {
        const { data: refreshResponse } = await axios.post(
          `${apiBaseUrl}/api/user/refresh-token`,
          { refresh_token: refreshToken },
          { headers: { "Content-Type": "application/json" } }
        );

        const newAccessToken = refreshResponse?.data?.accessToken;
        const newRefreshToken = refreshResponse?.data?.refreshToken;

        if (newAccessToken) {
          localStorage.setItem("token", newAccessToken);
          if (newRefreshToken) {
            localStorage.setItem("refreshToken", newRefreshToken);
          }
          axiosBaseApi.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
          processQueue(null, newAccessToken);

          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return axiosBaseApi(originalRequest);
        } else {
          throw new Error("No access token in refresh response");
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        delete axiosBaseApi.defaults.headers.common.Authorization;
        window.location.href = "/auth/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle 403 (Unauthorized/Login Expired) - redirect to login
    // Only redirect if the user was actually logged in (has a token).
    // Public pages (homepage, checkout) may trigger 403 from CSRF or other
    // non-auth reasons — redirecting unauthenticated visitors to login is wrong.
    if (error.response?.status === 403) {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (token) {
        unAuthorizedHelper(error);
      }
      return Promise.reject(error);
    }

    return Promise.reject(error);
  },
);

export default axiosBaseApi;
