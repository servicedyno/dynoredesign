export const COMPANY_INIT: any = "COMPANY_INIT";
export const COMPANY_INSERT = "COMPANY_INSERT";
export const COMPANY_FETCH = "COMPANY_FETCH";
export const COMPANY_UPDATE = "COMPANY_UPDATE";
export const COMPANY_DELETE = "COMPANY_DELETE";
export const COMPANY_API_ERROR = "COMPANY_API_ERROR";
export const COMPANY_VALIDATE_TAX = "COMPANY_VALIDATE_TAX";

export const CompanyAction = (type?: string, data?: any) => {
  return { type: COMPANY_INIT, payload: data, crudType: type };
};
