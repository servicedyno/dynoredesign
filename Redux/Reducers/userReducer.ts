import { ReducerAction } from "@/utils/types";
import {
  USER_API_ERROR,
  USER_EMAIL_CHECK,
  USER_INIT,
  USER_LOGIN,
  USER_PROFILE_FETCH,
  USER_REGISTER,
  USER_RESET_PASSWORD,
  USER_SEND_OTP,
  USER_SEND_RESET_LINK,
  USER_UPDATE,
} from "../Actions/UserAction";

const userInitialState = {
  email: "",
  name: "",
  mobile: "",
  loading: false,
  error: null as { message: string; actionType: string } | null,
  profile: null as any,
  profileLoading: false,
};

const userReducer = (state = userInitialState, action: ReducerAction) => {
  const { payload } = action;

  switch (action.type) {
    case USER_INIT:
      return {
        ...state,
        ...(action.crudType !== USER_SEND_OTP && action.crudType !== USER_PROFILE_FETCH && { loading: true }),
        ...(action.crudType === USER_PROFILE_FETCH && { profileLoading: true }),
      };

    case USER_LOGIN:
      localStorage.setItem("token", payload.accessToken);
      return {
        ...state,
        email: payload.email,
        name: payload.name,
        loading: false,
        error: null,
      };
    case USER_REGISTER:
      localStorage.setItem("token", payload.accessToken);
      return {
        ...state,
        email: payload.email,
        name: payload.name,
        loading: false,
        error: null,
      };
    case USER_UPDATE:
      localStorage.setItem("token", payload.accessToken);
      return { ...state };

    case USER_PROFILE_FETCH:
      return {
        ...state,
        profileLoading: false,
        profile: payload,
      };

    case USER_EMAIL_CHECK:
      return {
        ...state,
        email: payload.email,
        mobile: payload.mobile,
        loading: false,
        error: null,
      };
    case USER_API_ERROR:
      return {
        ...state,
        loading: false,
        profileLoading: false,
        error: action.payload || null,
      };
    case USER_SEND_RESET_LINK:
      return {
        ...state,
        email: payload.email,
        loading: false,
        error: null,
      };
    case USER_RESET_PASSWORD:
      return {
        ...state,
        token: payload.token,
        email: payload.email,
        newPassword: payload.newPassword,
        loading: false,
        error: null,
      };
    default:
      return {
        ...state,
      };
  }
};

export default userReducer;
