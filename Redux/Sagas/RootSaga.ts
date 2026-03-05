import { takeEvery } from "redux-saga/effects";
import { USER_INIT } from "../Actions/UserAction";
import { UserSaga } from "./UserSaga";
import { TOAST_INIT } from "../Actions/ToastAction";
import { ToastSaga } from "./ToastSaga";
import { COMPANY_INIT } from "../Actions/CompanyAction";
import { CompanySaga } from "./CompanySaga";
import { WALLET_INIT } from "../Actions/WalletAction";
import { WalletSaga } from "./WalletSaga";
import { API_INIT } from "../Actions/ApiAction";
import { ApiSaga } from "./ApiSaga";
import { TRANSACTION_INIT } from "../Actions/TransactionAction";
import { TransactionSaga } from "./TransactionSaga";
import { DASHBOARD_INIT } from "../Actions/DashboardAction";
import { DashboardSaga } from "./DashboardSaga";
import { PAYLINK_INIT } from "../Actions/PaymentLinkAction";
import { PaymentLinkSaga } from "./PaymentLinkSaga";

function* RootSaga() {
  yield takeEvery(USER_INIT, UserSaga);
  yield takeEvery(TOAST_INIT, ToastSaga);
  yield takeEvery(COMPANY_INIT, CompanySaga);
  yield takeEvery(API_INIT, ApiSaga);
  yield takeEvery(WALLET_INIT, WalletSaga);
  yield takeEvery(TRANSACTION_INIT, TransactionSaga);
  yield takeEvery(DASHBOARD_INIT, DashboardSaga);
  yield takeEvery(PAYLINK_INIT, PaymentLinkSaga);
}

export default RootSaga;
