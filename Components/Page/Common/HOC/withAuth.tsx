import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import jwt from "jsonwebtoken";

import { TokenData } from "@/utils/types";
import Loading from "@/Components/UI/Loading";
const withAuth = (WrappedComponent: any) => {
  const AuthChecker = (props: any) => {
    const Router = useRouter();
    const [accessToken, setAccessToken] = useState<any>("");
    useEffect(() => {
      if (localStorage.getItem("token")) {
        const token = localStorage.getItem("token");
        const tokenData = jwt.decode(token ?? "") as TokenData;
        const pathname = Router.pathname.split("/");
        setAccessToken(token);
      } else {
        Router.replace("/auth/login");
      }

      // Router.replace("/maintenance");
    }, [Router.pathname]);

    return accessToken ? <WrappedComponent {...props} /> : <Loading />;
  };
  return AuthChecker;
};

export default withAuth;
