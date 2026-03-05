import Router from "next/router";

const unAuthorizedHelper = (e: any) => {
  const {
    response: { status },
  } = e;
  if (status === 403) {
    localStorage.removeItem("token");
    Router.replace("/auth/login");
  }
};

export default unAuthorizedHelper;
