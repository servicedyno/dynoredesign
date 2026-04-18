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

// Helper: get last company id from localStorage
function getLastCompanyId(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const val = localStorage.getItem("last_company_id");
    return val ? parseInt(val, 10) : null;
  } catch {
    return null;
  }
}

// Helper: save last company id to localStorage
function saveLastCompanyId(companyId: number | null) {
  if (typeof window === "undefined") return;
  try {
    if (companyId != null) {
      localStorage.setItem("last_company_id", String(companyId));
    }
  } catch {}
}

const companyInitialState: ICompanyReducer = {
  companyList: [],
  loading: false,
  fetched: false,
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

    case COMPANY_FETCH: {
      // Resolve which company to select:
      // 1. Already selected in Redux → keep it
      // 2. last_company_id from localStorage (persisted from prior session) → use if valid
      // 3. First company in list → fallback
      const lastSaved = getLastCompanyId();
      const validIds = (payload || []).map((c: any) => c.company_id);
      let selected = state.selectedCompanyId;
      if (!selected || !validIds.includes(selected)) {
        if (lastSaved && validIds.includes(lastSaved)) {
          selected = lastSaved;
        } else {
          selected = validIds.length > 0 ? validIds[0] : null;
        }
      }
      if (selected) saveLastCompanyId(selected);
      return {
        ...state,
        loading: false,
        fetched: true,
        companyList: payload,
        selectedCompanyId: selected,
      };
    }

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
      saveLastCompanyId(payload);
      return {
        ...state,
        selectedCompanyId: payload,
      };

    case COMPANY_API_ERROR:
      return {
        ...state,
        loading: false,
        fetched: true,
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
