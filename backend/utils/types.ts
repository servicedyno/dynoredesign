export interface IUserType {
  user_id: number;
  name: string;
  password: string;
  email: string;
  username: string;
  photo: string;
  mobile: string;
  telegram_id: string;
  oldPassword: string;
  newPassword: string;
  customer_id: string;
  customer_name: string;
  id: string;
  ref: string;
  adm_id: string;
  pathType: string;
  role: string;
}

export interface ICompany {
  user_id: number;
  company_name: string;
  email: string;
  mobile: string;
  photo: string;
  website: string;
}

export interface IFundData {
  number: string;
  expiry: string;
  cvc: string;
  name: string;
  focus: string;
  paymentType: string;
  currency: string;
  amount: number;
  uniqueRef: string;
  mode: "pin" | "avs_noauth" | "otp";
  pin: string;
  city: string;
  address: string;
  state: string;
  country: string;
  zipcode: string;
  otp: string;
  account_number: string;
  network: string;
  mobile: string;
}

export interface FW_API_Response {
  status: string;
  message: string;
  data: Data;
  meta: Meta;
}

export interface Data {
  id: number;
  tx_ref: string;
  flw_ref: string;
  device_fingerprint: string;
  amount: number;
  charged_amount: number;
  app_fee: number;
  merchant_fee: number;
  processor_response: string;
  auth_model: string;
  currency: string;
  ip: string;
  narration: string;
  status: string;
  payment_type: string;
  plan: any;
  fraud_status: string;
  charge_type: string;
  created_at: string;
  account_id: number;
  customer: Customer;
  card: Card;
  meta: Meta;
}

export interface Customer {
  id: number;
  phone_number: any;
  name: string;
  email: string;
  created_at: string;
}

export interface Card {
  first_6digits: string;
  last_4digits: string;
  issuer: string;
  country: string;
  type: string;
  expiry: string;
}

export interface Meta {
  authorization: Authorization;
}

export interface Authorization {
  mode: string;
  redirect: string;
  fields: string[];
  transfer_reference: string;
  transfer_account: string;
  transfer_bank: string;
  account_expiration: number;
  transfer_note: string;
  transfer_amount: string;
}

export interface IWebHook {
  id: number;
  txRef: string;
  flwRef: string;
  orderRef: string;
  paymentPlan: any;
  paymentPage: any;
  createdAt: string;
  amount: number;
  charged_amount: number;
  status: string;
  IP: string;
  currency: string;
  appfee: number;
  merchantfee: number;
  merchantbearsfee: number;
  customer: IWebHookCustomer;
  entity: IWebHookEntity;
  "event.type": string;
}

export interface ITatumWebHook {
  address: string;
  asset: string;
  blockNumber: number;
  counterAddress: string;
  txId: string;
  chain: string;
  subscriptionType: string;
  type: string;
  amount: string;
}

export interface IWebHookCustomer {
  id: number;
  phone: string;
  fullName: string;
  customertoken: any;
  email: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: any;
  AccountId: number;
}

export interface IWebHookEntity {
  account_number: string;
  first_name: string;
  last_name: string;
  createdAt: string;
}

export interface IVerifyResponse {
  status: string;
  messge: string;
  data: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    device_fingerprint: string;
    amount: number;
    currency: string;
    charged_amount: number;
    app_fee: number;
    merchant_fee: number;
    processor_response: string;
    auth_model: string;
    ip: string;
    narration: string;
    status: string;
    payment_type: string;
    created_at: string;
    account_id: number;
    meta: any;
    amount_settled: number;
    customer: Customer;
  };
}

export interface virtualAccount {
  currency: string;
  xpub: string;
  customerId: string;
}

export interface IAdminWallet {
  wallet_id: number;
  wallet_type: string;
  wallet_address: string;
  xpub: string;
  mnemonic: string;
  privateKey: string;
  amount: number;
  fee: number;
  currency_type: string;
  customer_id: string;
  wallet_account_id: string;
}

export interface ITemporaryAddress {
  temp_id: number;
  user_id: number;
  wallet_type: string;
  wallet_address: string;
  wallet_account_id: string;
  subscription_id: string;
  index: number;
  privateKey: string;
  txId: string;
  admin_txId: string;
  status: string;
  admin_status: string;
  blockchain_fee: string;
  amount_to_be_paid: number;
}

export interface IGenerateUserAddressParams {
  currency: string;
  xpub: string;
  index?: number;
  mnemonic: string;
}