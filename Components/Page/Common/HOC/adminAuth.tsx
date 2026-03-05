import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import jwt from "jsonwebtoken";

import { TokenData } from "@/utils/types";
import Loading from "@/Components/UI/Loading";
const adminAuth = (WrappedComponent: any) => {
  const AuthChecker = (props: any) => {
    const Router = useRouter();
    const [accessToken, setAccessToken] = useState<any>("");
    useEffect(() => {
      if (localStorage.getItem("admin_token")) {
        const token = localStorage.getItem("admin_token");
        const tokenData = jwt.decode(token ?? "") as TokenData;
        const pathname = Router.pathname.split("/");
        if (tokenData?.role && tokenData?.role === "ADMIN") {
          setAccessToken(token);
        } else {
          Router.replace("/admin/login");
        }
      } else {
        Router.replace("/admin/login");
      }

      // Router.replace("/maintenance");
    }, [Router.pathname]);

    return accessToken ? <WrappedComponent {...props} /> : <Loading />;
  };
  return AuthChecker;
};

export default adminAuth;
