import { ReducerAction } from "@/utils/types";
import { apiReducer as IApiReducer } from "@/utils/types";
import {
  API_ERROR,
  API_DELETE,
  API_FETCH,
  API_INIT,
  API_INSERT,
  API_UPDATE,
  API_REGENERATE,
  API_TOGGLE_STATUS,
} from "../Actions/ApiAction";

const apiInitialState: IApiReducer = {
  apiList: [],
  loading: false,
};

const apiReducer = (state = apiInitialState, action: ReducerAction) => {
  const { payload } = action;

  switch (action.type) {
    case API_INIT:
      return {
        ...state,
        loading: true,
      };
    case API_INSERT:
      return {
        ...state,
        loading: false,
        apiList: [...state.apiList, payload],
      };

    case API_FETCH:
      return {
        ...state,
        loading: false,
        apiList: payload,
      };

    case API_DELETE:
      const tempList = state.apiList.filter((x: any) => x.api_id !== payload);
      return {
        ...state,
        loading: false,
        apiList: [...tempList],
      };

    case API_UPDATE:
      return {
        ...state,
        loading: false,
        apiList: state.apiList.map((api: any) =>
          (api.api_id === payload?.api_id || api._id === payload?._id) ? { ...api, ...payload } : api
        ),
      };

    case API_REGENERATE:
      return {
        ...state,
        loading: false,
      };

    case API_TOGGLE_STATUS:
      return {
        ...state,
        loading: false,
        apiList: state.apiList.map((api: any) =>
          (api.api_id === payload?.id || api._id === payload?.id)
            ? { ...api, status: payload.status }
            : api
        ),
      };

    case API_ERROR:
      return {
        ...state,
        loading: false,
      };
    default:
      return {
        ...state,
      };
  }
};

export default apiReducer;
