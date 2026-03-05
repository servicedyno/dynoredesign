import { call, put } from "redux-saga/effects";

import axios from "@/axiosConfig";
import { TOAST_SHOW } from "../Actions/ToastAction";
import { WALLET_API_ERROR, WALLET_FETCH, WALLET_ADD_ADDRESS, WALLET_UPDATE, WALLET_DELETE, VERIFY_OTP } from "../Actions/WalletAction";
interface IWalletAction {
  crudType: string;
  payload: any;
}

export function* WalletSaga(action: IWalletAction): unknown {
  switch (action.crudType) {
    case WALLET_FETCH:
      yield getWallet();
      break;

    case WALLET_ADD_ADDRESS:
      yield validateWalletAddress(action.payload);
      break;

    case WALLET_UPDATE:
      yield updateWallet(action.payload);
      break;

    case WALLET_DELETE:
      yield deleteWallet(action.payload);
      break;

    default:
      yield put({ type: WALLET_API_ERROR });
      break;
  }
}

export function* getWallet(): unknown {
  try {
    const response = yield call(axios.get, "wallet/getWallet");
    const apiData = response?.data?.data;

    // API returns company-grouped data: [{company_id, wallets: [...]}]
    // Flatten to a single wallet list for the reducer
    let flatWallets: any[] = [];
    if (Array.isArray(apiData)) {
      for (const companyGroup of apiData) {
        if (Array.isArray(companyGroup.wallets)) {
          flatWallets = flatWallets.concat(
            companyGroup.wallets.map((w: any) => ({
              ...w,
              company_name: companyGroup.company_name,
              id: w.wallet_id,
            }))
          );
        }
      }
    }

    yield put({
      type: WALLET_FETCH,
      payload: flatWallets,
    });
  } catch (e: any) {
    const message = e?.response?.data?.message ?? e?.message ?? "Failed to fetch wallets";
    yield put({
      type: TOAST_SHOW,
      payload: {
        message: message,
        severity: "error",
      },
    });
    yield put({
      type: WALLET_API_ERROR,
    });
  }
}

export function* validateWalletAddress(payload: any): unknown {
  try {
    console.log("Sending payload:", payload);
    const {
      data: { data, message },
    } = yield call(
      axios.post,
      "wallet/validateWalletAddress",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    yield put({
      type: TOAST_SHOW,
      payload: { message },
    });
    yield put({
      type: WALLET_ADD_ADDRESS,
      payload: data,
    });
  } catch (e: any) {
    const message = e?.response?.data?.message ?? e?.message ?? "Failed to validate wallet address";
    yield put({
      type: TOAST_SHOW,
      payload: {
        message: message,
        severity: "error",
      },
    });
    yield put({
      type: WALLET_API_ERROR,
    });
  }
}

export function* updateWallet(payload: any): unknown {
  try {
    const { id, otp, ...updateData } = payload;
    const response = yield call(axios.put, `wallet/address/${id}`, {
      ...updateData,
      otp,
    });
    const responseData = response?.data;

    if (responseData?.success === false) {
      throw new Error(responseData.message || "Failed to update wallet");
    }

    yield put({
      type: TOAST_SHOW,
      payload: { message: responseData?.message || "Wallet updated successfully" },
    });
    yield put({
      type: WALLET_UPDATE,
      payload: responseData?.data || responseData,
    });
    // Re-fetch wallets to ensure sync
    yield getWallet();
  } catch (e: any) {
    const message = e?.response?.data?.message ?? e?.message ?? "Failed to update wallet";
    yield put({
      type: TOAST_SHOW,
      payload: { message, severity: "error" },
    });
    yield put({ type: WALLET_API_ERROR });
  }
}

export function* deleteWallet(payload: any): unknown {
  try {
    const { id, otp } = payload;
    const response = yield call(axios.post, `wallet/wallet/delete/verify`, {
      wallet_id: id,
      otp,
    });
    const responseData = response?.data;

    if (responseData?.success === false) {
      throw new Error(responseData.message || "Failed to delete wallet");
    }

    yield put({
      type: TOAST_SHOW,
      payload: { message: responseData?.message || "Wallet deleted successfully" },
    });
    yield put({
      type: WALLET_DELETE,
      payload: { id },
    });
  } catch (e: any) {
    const message = e?.response?.data?.message ?? e?.message ?? "Failed to delete wallet";
    yield put({
      type: TOAST_SHOW,
      payload: { message, severity: "error" },
    });
    yield put({ type: WALLET_API_ERROR });
  }
}


export async function verifyOtp(payload: any): Promise<{ status: boolean; message: string }> {
  try {

    console.log("Verifying OTP with payload:", payload);

    const response = await axios.post(
      "/wallet/verifyOtp",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    const httpStatus = response.status; 
    const { data, message, success } = response.data;

    // Dispatch VERIFY_OTP action
    return { status:httpStatus === 200,message };
  } catch (e: any) {
    const message =
      e.response?.data?.message ?? e.message ?? "OTP verification failed";

    return {status:false,message};
  }
}
