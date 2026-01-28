import adminFeeModel from "./adminFeeModel";
import adminFeeTransactionModel from "./adminFeeTransactionModel";
import adminTransferFeeModel from "./adminTransferFeeModel";
import adminWalletModel from "./adminWalletModel";
import { apiModel, planModel, subscriptionModel } from "./apiModels";
import { companyModel } from "./companyModels";

import {
  customerModel,
  customerTransactionModel,
  customerWalletModel,
} from "./customerModels";
import feesModel from "./feesModel";
import {
  paymentLinkModel,
  userModel,
  userTempAddressModel,
  userTransactionModel,
  userWalletModel,
  userWalletAddressModel,
  userExchangeModel,
} from "./userModels";

// Phase 1: New models
import taxRateModel from "./taxRateModel";
import invoiceModel from "./invoiceModel";
import notificationModel from "./notificationModel";
import notificationPreferencesModel from "./notificationPreferencesModel";
import kycModel from "./kycModel";

// USDT Pool System models
import {
  usdtPoolAddressModel,
  usdtPoolTransactionModel,
  usdtPoolSweepModel,
} from "./usdtPoolModels";

export {
  apiModel,
  adminFeeModel,
  planModel,
  feesModel,
  subscriptionModel,
  userModel,
  companyModel,
  userWalletModel,
  adminFeeTransactionModel,
  adminTransferFeeModel,
  adminWalletModel,
  customerModel,
  customerWalletModel,
  paymentLinkModel,
  customerTransactionModel,
  userWalletAddressModel,
  userTransactionModel,
  userTempAddressModel,
  userExchangeModel,
  // Phase 1: New models
  taxRateModel,
  invoiceModel,
  notificationModel,
  notificationPreferencesModel,
  kycModel,
  // USDT Pool System models
  usdtPoolAddressModel,
  usdtPoolTransactionModel,
  usdtPoolSweepModel,
};
