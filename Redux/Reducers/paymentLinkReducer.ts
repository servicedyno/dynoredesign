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
  fetched: boolean;
}

const paymentLinkInitialState: PaymentLinkState = {
  paymentLinks: [],
  selectedLink: null,
  loading: false,
  createLoading: false,
  feePreview: null,
  fetched: false,
};

const paymentLinkReducer = (
  state = paymentLinkInitialState,
  action: ReducerAction
) => {
  const { payload } = action;

  switch (action.type) {
    case PAYLINK_INIT:
      // Only set loading for FETCH/CREATE/UPDATE/DELETE — NOT for FEE_PREVIEW
      // Bug fix: FEE_PREVIEW was setting loading=true for new users (0 payment links)
      // and never resetting it, causing the Create button to silently do nothing.
      if ((action as any).crudType === PAYLINK_FEE_PREVIEW) {
        return state; // fee preview should not affect loading state
      }
      return {
        ...state,
        loading: state.paymentLinks.length === 0,
        ...((action as any).crudType === PAYLINK_CREATE && { createLoading: true }),
      };

    case PAYLINK_FETCH:
      return {
        ...state,
        loading: false,
        fetched: true,
        paymentLinks: payload.paymentLinks || [],
      };

    case PAYLINK_CREATE:
      return {
        ...state,
        loading: false,
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
          (link: any) => {
            const linkId = String(link._id || link.link_id || link.id);
            return linkId !== String(payload.id);
          }
        ),
      };

    case PAYLINK_ERROR:
      return {
        ...state,
        loading: false,
        createLoading: false,
        fetched: true,
      };

    case PAYLINK_FEE_PREVIEW:
      return {
        ...state,
        loading: false,
        feePreview: payload.feePreview,
      };

    default:
      return state;
  }
};

export default paymentLinkReducer;
