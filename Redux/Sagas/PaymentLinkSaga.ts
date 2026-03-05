import { call, put } from "redux-saga/effects";
import axiosBaseApi from "@/axiosConfig";
import {
  PAYLINK_FETCH,
  PAYLINK_CREATE,
  PAYLINK_UPDATE,
  PAYLINK_DELETE,
  PAYLINK_ERROR,
  PAYLINK_FEE_PREVIEW,
} from "../Actions/PaymentLinkAction";
import { TOAST_SHOW } from "../Actions/ToastAction";

interface PaymentLinkSagaAction {
  type: string;
  payload?: any;
  crudType?: string;
}

export function* PaymentLinkSaga(action: PaymentLinkSagaAction): Generator<any, void, any> {
  const { crudType, payload } = action;

  try {
    switch (crudType) {
      case PAYLINK_FETCH: {
        const response = yield call(axiosBaseApi.get, "/pay/getPaymentLinks");
        const apiData = response?.data?.data;
        if (apiData !== undefined) {
          yield put({
            type: PAYLINK_FETCH,
            payload: {
              paymentLinks: Array.isArray(apiData) ? apiData : apiData?.paymentLinks || [],
            },
          });
        } else {
          yield put({ type: PAYLINK_ERROR });
        }
        break;
      }

      case PAYLINK_CREATE: {
        const response = yield call(axiosBaseApi.post, "/pay/createPaymentLink", payload);
        const apiData = response?.data?.data;
        if (apiData) {
          yield put({
            type: PAYLINK_CREATE,
            payload: {
              paymentLink: apiData,
            },
          });
          yield put({
            type: TOAST_SHOW,
            payload: {
              message: response?.data?.message || "Payment link created successfully",
              severity: "success",
            },
          });
        } else {
          yield put({ type: PAYLINK_ERROR });
          yield put({
            type: TOAST_SHOW,
            payload: {
              message: response?.data?.message || "Failed to create payment link",
              severity: "error",
            },
          });
        }
        break;
      }

      case PAYLINK_UPDATE: {
        const { id, ...updateData } = payload;
        const response = yield call(axiosBaseApi.put, `/pay/links/${id}`, updateData);
        const apiData = response?.data?.data;
        if (apiData) {
          yield put({
            type: PAYLINK_UPDATE,
            payload: {
              paymentLink: apiData,
            },
          });
          yield put({
            type: TOAST_SHOW,
            payload: {
              message: response?.data?.message || "Payment link updated successfully",
              severity: "success",
            },
          });
        } else {
          yield put({ type: PAYLINK_ERROR });
          yield put({
            type: TOAST_SHOW,
            payload: {
              message: response?.data?.message || "Failed to update payment link",
              severity: "error",
            },
          });
        }
        break;
      }

      case PAYLINK_DELETE: {
        const { id } = payload;
        const response = yield call(axiosBaseApi.delete, `/pay/deletePaymentLink/${id}`);
        if (response?.data) {
          yield put({
            type: PAYLINK_DELETE,
            payload: { id },
          });
          yield put({
            type: TOAST_SHOW,
            payload: {
              message: response?.data?.message || "Payment link deleted successfully",
              severity: "success",
            },
          });
        } else {
          yield put({ type: PAYLINK_ERROR });
          yield put({
            type: TOAST_SHOW,
            payload: {
              message: response?.data?.message || "Failed to delete payment link",
              severity: "error",
            },
          });
        }
        break;
      }

      case PAYLINK_FEE_PREVIEW: {
        const response = yield call(axiosBaseApi.get, "/pay/fee-preview");
        const apiData = response?.data?.data;
        if (apiData) {
          yield put({
            type: PAYLINK_FEE_PREVIEW,
            payload: {
              feePreview: apiData,
            },
          });
        } else {
          yield put({ type: PAYLINK_ERROR });
          yield put({
            type: TOAST_SHOW,
            payload: {
              message: response?.data?.message || "Failed to fetch fee preview",
              severity: "error",
            },
          });
        }
        break;
      }

      default:
        break;
    }
  } catch (error: any) {
    console.error("PaymentLinkSaga error:", error);
    const message = error?.response?.data?.message ?? error?.message ?? "Payment link operation failed";
    yield put({ type: PAYLINK_ERROR });
    yield put({
      type: TOAST_SHOW,
      payload: { message, severity: "error" },
    });
  }
}
