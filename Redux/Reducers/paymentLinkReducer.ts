import { ReducerAction } from "@/utils/types";
import {
  PAYLINK_FETCH,
  PAYLINK_CREATE,
  PAYLINK_UPDATE,
  PAYLINK_DELETE,
  PAYLINK_ERROR,
  PAYLINK_INIT,
  PAYLINK_FEE_PREVIEW,
} from "../Actions/PaymentLinkAction";

export interface PaymentLinkState {
  paymentLinks: any[];
  selectedLink: any | null;
  loading: boolean;
  createLoading: boolean;
  feePreview: any | null;
}

const paymentLinkInitialState: PaymentLinkState = {
  paymentLinks: [],
  selectedLink: null,
  loading: false,
  createLoading: false,
  feePreview: null,
};

const paymentLinkReducer = (
  state = paymentLinkInitialState,
  action: ReducerAction
) => {
  const { payload } = action;

  switch (action.type) {
    case PAYLINK_INIT:
      return {
        ...state,
        loading: true,
      };

    case PAYLINK_FETCH:
      return {
        ...state,
        loading: false,
        paymentLinks: payload.paymentLinks || [],
      };

    case PAYLINK_CREATE:
      return {
        ...state,
        createLoading: false,
        paymentLinks: [payload.paymentLink, ...state.paymentLinks],
      };

    case PAYLINK_UPDATE:
      return {
        ...state,
        loading: false,
        paymentLinks: state.paymentLinks.map((link: any) =>
          link._id === payload.paymentLink._id ? payload.paymentLink : link
        ),
      };

    case PAYLINK_DELETE:
      return {
        ...state,
        loading: false,
        paymentLinks: state.paymentLinks.filter(
          (link: any) => link._id !== payload.id
        ),
      };

    case PAYLINK_ERROR:
      return {
        ...state,
        loading: false,
        createLoading: false,
      };

    case PAYLINK_FEE_PREVIEW:
      return {
        ...state,
        feePreview: payload.feePreview,
      };

    default:
      return state;
  }
};

export default paymentLinkReducer;
