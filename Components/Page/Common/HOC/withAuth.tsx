import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

import Loading from "@/Components/UI/Loading";

const withAuth = (WrappedComponent: any) => {
  const AuthChecker = (props: any) => {
    const Router = useRouter();
    const [isReady, setIsReady] = useState(false);
    const checkedRef = useRef(false);

    useEffect(() => {
      if (checkedRef.current) return;
      checkedRef.current = true;

      const token = localStorage.getItem("token");
      if (token) {
        setIsReady(true);
      } else {
        Router.replace("/auth/login");
      }
    }, []);

    // On subsequent navigations, just verify token still exists
    useEffect(() => {
      if (!isReady) return;
      const token = localStorage.getItem("token");
      if (!token) {
        Router.replace("/auth/login");
      }
    }, [Router.pathname, isReady]);

    return isReady ? <WrappedComponent {...props} /> : <Loading />;
  };
  return AuthChecker;
};

export default withAuth;
