import { call, put } from "redux-saga/effects";
import axiosBaseApi from "@/axiosConfig";
import {
  DASHBOARD_FETCH,
  DASHBOARD_CHART_FETCH,
  DASHBOARD_FEE_TIERS_FETCH,
  DASHBOARD_RECENT_TX_FETCH,
  DASHBOARD_ERROR,
} from "../Actions/DashboardAction";

interface DashboardSagaAction {
  type: string;
  payload?: any;
  crudType?: string;
}

export function* DashboardSaga(action: DashboardSagaAction): Generator<any, void, any> {
  const { crudType, payload } = action;

  try {
    switch (crudType) {
      case DASHBOARD_FETCH: {
        // Build params with company_id if available
        const params: any = {};
        if (payload?.company_id) params.company_id = payload.company_id;

        // Single API call — /dashboard already returns all stats
        const response: any = yield call(axiosBaseApi.get, "/dashboard", { params });
        const apiData = response?.data?.data;

        if (apiData) {
          const totalTx = apiData.total_transactions?.count ?? 0;
          const totalVol = apiData.total_volume?.amount ?? 0;
          const totalVolFormatted = apiData.total_volume?.amount_formatted ?? "$0.00 USD";

          yield put({
            type: DASHBOARD_FETCH,
            payload: {
              stats: {
                totalTransactions: totalTx,
                totalVolume: totalVol,
                totalVolumeFormatted: totalVolFormatted,
                currency: apiData.total_volume?.currency || "USD",
                currencySymbol: apiData.total_volume?.currency_info?.symbol || "$",
                activeWallets: apiData.active_wallets?.count ?? 0,
                transactionChange: apiData.total_transactions?.change_percent ?? 0,
                volumeChange: apiData.total_volume?.change_percent ?? 0,
                pendingTransactions: apiData.pending_transactions?.count ?? 0,
                activeWalletsList: apiData.active_wallets?.wallets ?? [],
                feeTier: apiData.fee_tier ?? null,
                todaySummary: apiData.today_summary ? {
                  volumeToday: apiData.today_summary.volume_today ?? 0,
                  volumeTodayFormatted: apiData.today_summary.volume_today_formatted ?? "$0.00",
                  volumeYesterday: apiData.today_summary.volume_yesterday ?? 0,
                  volumeYesterdayFormatted: apiData.today_summary.volume_yesterday_formatted ?? "$0.00",
                  volumeChangePercent: apiData.today_summary.volume_change_percent ?? 0,
                  transactionsToday: apiData.today_summary.transactions_today ?? 0,
                  transactionsYesterday: apiData.today_summary.transactions_yesterday ?? 0,
                  transactionsChangePercent: apiData.today_summary.transactions_change_percent ?? 0,
                  pendingCount: apiData.today_summary.pending_count ?? 0,
                  currency: apiData.today_summary.currency ?? "USD",
                } : undefined,
              },
            },
          });
        } else {
          yield put({ type: DASHBOARD_ERROR });
        }
        break;
      }

      case DASHBOARD_CHART_FETCH: {
        const period = payload?.period || "7d";
        const params: any = { period };
        if (payload?.company_id) params.company_id = payload.company_id;
        if (payload?.startDate) params.startDate = payload.startDate;
        if (payload?.endDate) params.endDate = payload.endDate;

        const response = yield call(axiosBaseApi.get, "/dashboard/chart", { params });
        const apiData = response?.data?.data;
        if (apiData) {
          yield put({
            type: DASHBOARD_CHART_FETCH,
            payload: {
              chartData: (apiData.chart_data || []).map((item: any) => ({
                date: item.date,
                value: item.volume ?? 0,
                transactionCount: item.transaction_count ?? 0,
              })),
            },
          });
        } else {
          yield put({ type: DASHBOARD_ERROR });
        }
        break;
      }

      case DASHBOARD_FEE_TIERS_FETCH: {
        const feeTierParams: any = {};
        if (payload?.company_id) feeTierParams.company_id = payload.company_id;
        const response = yield call(axiosBaseApi.get, "/dashboard/fee-tiers", { params: feeTierParams });
        const apiData = response?.data?.data;
        if (apiData) {
          const userTier = apiData.user_tier || {};
          yield put({
            type: DASHBOARD_FEE_TIERS_FETCH,
            payload: {
              feeTiers: {
                monthlyLimit: userTier.amount_to_next_tier
                  ? userTier.total_volume + userTier.amount_to_next_tier
                  : 50000,
                usedAmount: userTier.total_volume ?? 0,
                currentTier: userTier.current_tier ?? "Standard",
                tiers: apiData.tiers || [],
                percentToNextTier: userTier.percent_to_next_tier ?? 0,
                amountToNextTier: userTier.amount_to_next_tier ?? 0,
                nextTier: userTier.next_tier ?? "",
              },
            },
          });
        } else {
          yield put({ type: DASHBOARD_ERROR });
        }
        break;
      }

      case DASHBOARD_RECENT_TX_FETCH: {
        const recentTxParams: any = {};
        if (payload?.company_id) recentTxParams.company_id = payload.company_id;
        const response = yield call(axiosBaseApi.get, "/dashboard/recent-transactions", { params: recentTxParams });
        const apiData = response?.data?.data;
        if (apiData) {
          yield put({
            type: DASHBOARD_RECENT_TX_FETCH,
            payload: {
              recentTransactions: apiData.transactions || [],
            },
          });
        } else {
          yield put({ type: DASHBOARD_ERROR });
        }
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error("DashboardSaga error:", error);
    yield put({ type: DASHBOARD_ERROR });
  }
}
