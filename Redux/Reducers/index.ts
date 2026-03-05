import { combineReducers } from "@reduxjs/toolkit";
import userReducer from "./userReducer";
import toastReducer from "./toastReducer";
import companyReducer from "./companyReducer";
import walletReducer from "./walletReducer";
import apiReducer from "./apiReducer";
import transactionReducer from "./transactionReducer";
import dashboardReducer from "./dashboardReducer";
import paymentLinkReducer from "./paymentLinkReducer";

export default combineReducers({
  userReducer,
  toastReducer,
  companyReducer,
  apiReducer,
  walletReducer,
  transactionReducer,
  dashboardReducer,
  paymentLinkReducer,
});
