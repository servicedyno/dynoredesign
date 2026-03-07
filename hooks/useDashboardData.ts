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

  useEffect(() => {
    const payload = selectedCompanyId ? { company_id: selectedCompanyId } : undefined;
    dispatch(DashboardAction(DASHBOARD_FETCH, payload));
    dispatch(DashboardAction(DASHBOARD_FEE_TIERS_FETCH, payload));
    dispatch(DashboardAction(DASHBOARD_RECENT_TX_FETCH, payload));
  }, [dispatch, selectedCompanyId]);

  const fetchChartData = useCallback(
    (period: string, startDate?: string, endDate?: string) => {
      dispatch(
        DashboardAction(DASHBOARD_CHART_FETCH, { period, startDate, endDate, company_id: selectedCompanyId })
      );
    },
    [dispatch, selectedCompanyId]
  );

  const refreshDashboard = useCallback(() => {
    const payload = selectedCompanyId ? { company_id: selectedCompanyId } : undefined;
    dispatch(DashboardAction(DASHBOARD_FETCH, payload));
    dispatch(DashboardAction(DASHBOARD_FEE_TIERS_FETCH, payload));
    dispatch(DashboardAction(DASHBOARD_RECENT_TX_FETCH, payload));
  }, [dispatch, selectedCompanyId]);

  return {
    stats: dashboardState.stats,
    chartData: dashboardState.chartData,
    feeTiers: dashboardState.feeTiers,
    recentTransactions: dashboardState.recentTransactions,
    loading: dashboardState.loading,
    chartLoading: dashboardState.chartLoading,
    fetchChartData,
    refreshDashboard,
  };
};
