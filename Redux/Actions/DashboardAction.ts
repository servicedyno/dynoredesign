export const DASHBOARD_INIT: any = "DASHBOARD_INIT";
export const DASHBOARD_FETCH = "DASHBOARD_FETCH";
export const DASHBOARD_CHART_FETCH = "DASHBOARD_CHART_FETCH";
export const DASHBOARD_FEE_TIERS_FETCH = "DASHBOARD_FEE_TIERS_FETCH";
export const DASHBOARD_RECENT_TX_FETCH = "DASHBOARD_RECENT_TX_FETCH";
export const DASHBOARD_ERROR = "DASHBOARD_ERROR";

export const DashboardAction = (type?: string, data?: any) => {
  return { type: DASHBOARD_INIT, payload: data, crudType: type };
};
