import Router from "next/router";

const unAuthorizedHelper = (e: any) => {
  const status = e?.response?.status;
  if (status === 401 || status === 403) {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    Router.replace("/auth/login");
  }
};

export default unAuthorizedHelper;
