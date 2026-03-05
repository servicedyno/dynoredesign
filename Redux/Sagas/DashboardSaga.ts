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
        // Fetch both dashboard summary and analytics in parallel
        const [response, analyticsResponse] = yield call(function* () {
          const r1: any = yield call(axiosBaseApi.get, "/dashboard");
          let r2: any = null;
          try {
            r2 = yield call(axiosBaseApi.post, "/wallet/getUserAnalytics");
          } catch (e) {
            // Analytics is supplementary - don't fail if it errors
          }
          return [r1, r2];
        });

        const apiData = response?.data?.data;
        const analytics = analyticsResponse?.data?.data;

        if (apiData) {
          // Use analytics data for totals if dashboard returns 0
          let totalTx = apiData.total_transactions?.count ?? 0;
          let totalVol = apiData.total_volume?.amount ?? 0;
          let totalVolFormatted = apiData.total_volume?.amount_formatted ?? "$0.00 USD";

          if (analytics) {
            if (totalTx === 0 && analytics.totalTransactionsIncoming > 0) {
              totalTx = analytics.totalTransactionsIncoming + (analytics.totalTransactionOutgoing || 0);
            }
            if (totalVol === 0 && analytics.revenue_performance) {
              totalVol = analytics.revenue_performance.reduce(
                (sum: number, rp: any) => sum + (rp.amount_in_usd || 0), 0
              );
              if (totalVol > 0) {
                const currency = apiData.total_volume?.currency_info || { symbol: "$", code: "USD" };
                totalVolFormatted = `${currency.symbol}${totalVol.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency.code}`;
              }
            }
          }

          yield put({
            type: DASHBOARD_FETCH,
            payload: {
              stats: {
                totalTransactions: totalTx,
                totalVolume: totalVol,
                activeWallets: apiData.active_wallets?.count ?? 0,
                transactionChange: apiData.total_transactions?.change_percent ?? 0,
                volumeChange: apiData.total_volume?.change_percent ?? 0,
                pendingTransactions: apiData.pending_transactions?.count ?? 0,
                totalVolumeFormatted: totalVolFormatted,
                activeWalletsList: apiData.active_wallets?.wallets ?? [],
                feeTier: apiData.fee_tier ?? null,
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
        const response = yield call(axiosBaseApi.get, "/dashboard/fee-tiers");
        const apiData = response?.data?.data;
        if (apiData) {
          const userTier = apiData.user_tier || {};
          yield put({
            type: DASHBOARD_FEE_TIERS_FETCH,
            payload: {
              feeTiers: {
                monthlyLimit: userTier.amount_to_next_tier
                  ? userTier.monthly_volume + userTier.amount_to_next_tier
                  : 50000,
                usedAmount: userTier.monthly_volume ?? 0,
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
        const response = yield call(axiosBaseApi.get, "/dashboard/recent-transactions");
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
