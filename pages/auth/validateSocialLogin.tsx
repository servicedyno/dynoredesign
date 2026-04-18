import axiosBaseApi from "@/axiosConfig";
import Loading from "@/Components/UI/Loading";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { USER_LOGIN } from "@/Redux/Actions/UserAction";
import { rootReducer } from "@/utils/types";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import React, { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

const ValidateSocialLogin = () => {
  const session = useSession();
  const router = useRouter();
  const dispatch = useDispatch();
  const userState = useSelector((state: rootReducer) => state.userReducer);
  const connectingRef = useRef(false);

  useEffect(() => {
    const tempSession: any = session.data;
    if (tempSession?.token && !connectingRef.current) {
      connectingRef.current = true;
      connectSocial(tempSession.token);
    }
  }, [session]);

  useEffect(() => {
    if (userState.name) {
      router.replace("/dashboard");
    }
  }, [userState]); // eslint-disable-line

  const connectSocial = async (token: any) => {
    try {
      const {
        data: { data, message },
      } = await axiosBaseApi.post("user/connectSocial", {
        ...token,
        photo: token?.picture,
      });
      dispatch({
        type: TOAST_SHOW,
        payload: { message },
      });
      dispatch({
        type: USER_LOGIN,
        payload: { ...data.userData, accessToken: data.accessToken },
      });
      // Clean up NextAuth session to prevent stale re-login
      await signOut({ redirect: false });
    } catch (e: any) {
      const message =
        e.response?.data?.message ?? e.message ?? "Social login failed";
      dispatch({
        type: TOAST_SHOW,
        payload: { message, severity: "error" },
      });
      // Clean up NextAuth session on failure too
      await signOut({ redirect: false });
      connectingRef.current = false;
      router.replace("/auth/login");
    }
  };

  return <Loading />;
};

export default ValidateSocialLogin;
