import { ReducerAction } from "@/utils/types";
import { companyReducer as ICompanyReducer } from "@/utils/types";
import {
  COMPANY_API_ERROR,
  COMPANY_DELETE,
  COMPANY_FETCH,
  COMPANY_INIT,
  COMPANY_INSERT,
  COMPANY_UPDATE,
  COMPANY_VALIDATE_TAX,
} from "../Actions/CompanyAction";

const companyInitialState: ICompanyReducer = {
  companyList: [],
  loading: false,
  taxValidation: null,
};

const companyReducer = (state = companyInitialState, action: ReducerAction) => {
  const { payload } = action;

  switch (action.type) {
    case COMPANY_INIT:
      return {
        ...state,
        loading: true,
      };
    case COMPANY_INSERT:
      return {
        ...state,
        loading: false,
        companyList: [...state.companyList, payload],
      };

    case COMPANY_UPDATE:
      // Defensive: avoid crashes if list contains undefined entries
      // or if API returns an unexpected payload.
      if (!payload?.id || !payload?.data) {
        return {
          ...state,
          loading: false,
        };
      }

      const index = (state.companyList ?? []).findIndex(
        (x: any) => x?.company_id === payload.id
      );

      if (index < 0) {
        // If we can't find the company, keep the list unchanged.
        return {
          ...state,
          loading: false,
        };
      }

      const tempArray = [...state.companyList];
      tempArray[index] = payload.data;

      return {
        ...state,
        loading: false,
        companyList: tempArray,
      };

    case COMPANY_FETCH:
      return {
        ...state,
        loading: false,
        companyList: payload,
      };

    case COMPANY_DELETE:
      const tempList = state.companyList.filter(
        (x) => x.company_id !== payload
      );
      return {
        ...state,
        loading: false,
        companyList: [...tempList],
      };

    case COMPANY_API_ERROR:
      return {
        ...state,
        loading: false,
      };

    case COMPANY_VALIDATE_TAX:
      return {
        ...state,
        loading: false,
        taxValidation: payload,
      };

    default:
      return {
        ...state,
      };
  }
};

export default companyReducer;
