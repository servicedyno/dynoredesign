import { useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { DashboardAction } from "@/Redux/Actions";
import {
  DASHBOARD_FETCH,
  DASHBOARD_CHART_FETCH,
  DASHBOARD_FEE_TIERS_FETCH,
  DASHBOARD_RECENT_TX_FETCH,
} from "@/Redux/Actions/DashboardAction";
import { rootReducer } from "@/utils/types";

export const useDashboardData = () => {
  const dispatch = useDispatch();

  const dashboardState = useSelector(
    (state: rootReducer) => state.dashboardReducer
  );

  const selectedCompanyId = useSelector(
    (state: any) => state.companyReducer?.selectedCompanyId
  );

  const companyList = useSelector(
    (state: any) => state.companyReducer?.companyList
  );

  const companiesFetched = useSelector(
    (state: any) => state.companyReducer?.fetched ?? false
  );

  // Only fetch dashboard data once companies have been fetched AND a company is selected
  // (or if user truly has no companies after fetch completes).
  // This prevents the flash where aggregate data shows briefly before company-specific data.
  const hasCompanies = companyList && companyList.length > 0;
  const shouldFetch = companiesFetched && (!hasCompanies || selectedCompanyId != null);

  useEffect(() => {
    if (!shouldFetch) return;
    const payload = selectedCompanyId ? { company_id: selectedCompanyId } : undefined;
    dispatch(DashboardAction(DASHBOARD_FETCH, payload));
    dispatch(DashboardAction(DASHBOARD_FEE_TIERS_FETCH, payload));
    dispatch(DashboardAction(DASHBOARD_RECENT_TX_FETCH, payload));
  }, [dispatch, selectedCompanyId, shouldFetch]);

  const fetchChartData = useCallback(
    (period: string, startDate?: string, endDate?: string) => {
      if (!companiesFetched) return;
      dispatch(
        DashboardAction(DASHBOARD_CHART_FETCH, { period, startDate, endDate, company_id: selectedCompanyId })
      );
    },
    [dispatch, selectedCompanyId, companiesFetched]
  );

  const refreshDashboard = useCallback(() => {
    if (!shouldFetch) return;
    const payload = selectedCompanyId ? { company_id: selectedCompanyId } : undefined;
    dispatch(DashboardAction(DASHBOARD_FETCH, payload));
    dispatch(DashboardAction(DASHBOARD_FEE_TIERS_FETCH, payload));
    dispatch(DashboardAction(DASHBOARD_RECENT_TX_FETCH, payload));
  }, [dispatch, selectedCompanyId, shouldFetch]);

  return {
    stats: dashboardState.stats,
    chartData: dashboardState.chartData,
    feeTiers: dashboardState.feeTiers,
    recentTransactions: dashboardState.recentTransactions,
    loading: dashboardState.loading || !companiesFetched,
    chartLoading: dashboardState.chartLoading,
    fetchChartData,
    refreshDashboard,
  };
};
