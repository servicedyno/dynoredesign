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
  COMPANY_SELECT,
} from "../Actions/CompanyAction";

const companyInitialState: ICompanyReducer = {
  companyList: [],
  loading: false,
  taxValidation: null,
  selectedCompanyId: null,
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
        // Auto-select first company if none selected
        selectedCompanyId: state.selectedCompanyId || (payload.length > 0 ? payload[0].company_id : null),
      };

    case COMPANY_DELETE:
      const tempList = state.companyList.filter(
        (x) => x.company_id !== payload
      );
      return {
        ...state,
        loading: false,
        companyList: [...tempList],
        // Clear selection if deleted company was selected
        selectedCompanyId: state.selectedCompanyId === payload ? (tempList.length > 0 ? tempList[0].company_id : null) : state.selectedCompanyId,
      };

    case COMPANY_SELECT:
      return {
        ...state,
        selectedCompanyId: payload,
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
