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

  useEffect(() => {
    dispatch(DashboardAction(DASHBOARD_FETCH));
    dispatch(DashboardAction(DASHBOARD_FEE_TIERS_FETCH));
    dispatch(DashboardAction(DASHBOARD_RECENT_TX_FETCH));
  }, [dispatch]);

  const fetchChartData = useCallback(
    (period: string, startDate?: string, endDate?: string) => {
      dispatch(
        DashboardAction(DASHBOARD_CHART_FETCH, { period, startDate, endDate })
      );
    },
    [dispatch]
  );

  const refreshDashboard = useCallback(() => {
    dispatch(DashboardAction(DASHBOARD_FETCH));
    dispatch(DashboardAction(DASHBOARD_FEE_TIERS_FETCH));
    dispatch(DashboardAction(DASHBOARD_RECENT_TX_FETCH));
  }, [dispatch]);

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
