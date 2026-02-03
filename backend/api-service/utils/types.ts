export interface IUserType {
  user_id: number;
  name: string;
  password: string;
  email: string;
  photo: string;
  mobile: string;
  telegram_id: string;
  oldPassword: string;
  newPassword: string;
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
  plan: Record<string, unknown> | null;
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
  phone_number: string | null;
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
  paymentPlan: Record<string, unknown> | null;
  paymentPage: Record<string, unknown> | null;
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

export interface IWebHookCustomer {
  id: number;
  phone: string;
  fullName: string;
  customertoken: string | null;
  email: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: Date | null;
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
    meta: Record<string, unknown> | null;
    amount_settled: number;
    customer: Customer;
  };
}

export interface virtualAccount {
  currency: string;
  xpub: string;
  customerId: string;
}

// JWT Token payload type for customer API service
export interface CustomerJwtPayload {
  id?: number;
  user_id?: number;
  customer_id?: string;
  email?: string;
  name?: string;
  company_id?: number;
}

// Company data type from API key
export interface CompanyData {
  company_id: number;
  company_name: string;
  user_id: number;
  webhook_url?: string;
  webhook_secret?: string;
}
