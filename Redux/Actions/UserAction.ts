export const USER_INIT: any = "USER_INIT";
export const USER_LOGIN = "USER_LOGIN";
export const USER_EMAIL_CHECK = "USER_EMAIL_CHECK";
export const USER_SEND_OTP = "USER_SEND_OTP";
export const USER_SEND_RESET_LINK = "USER_SEND_RESET_LINK";
export const USER_CONFIRM_CODE = "USER_CONFIRM_CODE";
export const USER_REGISTER = "USER_REGISTER";
export const USER_API_ERROR = "USER_API_ERROR";
export const USER_UPDATE = "USER_UPDATE";
export const USER_UPDATE_PASSWORD = "USER_UPDATE_PASSWORD";
export const USER_RESET_PASSWORD = "USER_RESET_PASSWORD";
export const USER_PROFILE_FETCH = "USER_PROFILE_FETCH";

export const UserAction = (type?: string, data?: any) => {
  return { type: USER_INIT, payload: data, crudType: type };
};
