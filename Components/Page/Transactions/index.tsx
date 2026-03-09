import EmptyDataModel from "@/Components/UI/EmptyDataModel";
import { TransactionAction } from "@/Redux/Actions";
import { TRANSACTION_FETCH, TRANSACTION_EXPORT } from "@/Redux/Actions/TransactionAction";
import { ICustomerTransactions, rootReducer } from "@/utils/types";
import { DateRange } from "@/utils/types/dashboard";
import { ExtendedTransaction } from "@/utils/types/transaction";
import { Box, CircularProgress } from "@mui/material";
import { endOfDay, isWithinInterval, parseISO, startOfDay } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import TransactionsTable from "./TransactionsTable";
import TransactionsTopBar from "./TransactionsTopBar";

const walletMapping: { [key: string]: string } = {
  all: "all",
  wallet1: "BTC",
  wallet2: "ETH",
  wallet3: "LTC",
  wallet4: "DOGE",
  wallet5: "BCH",
  wallet6: "TRX",
  wallet7: "USDT-ERC20",
  wallet8: "USDT-TRC20",
};

const TransactionPage = () => {
  const dispatch = useDispatch();

  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
  });
  const [selectedWallet, setSelectedWallet] = useState("all");

  const transactionState = useSelector(
    (state: rootReducer) => state.transactionReducer,
  );

  const selectedCompanyId = useSelector(
    (state: rootReducer) => (state as any).companyReducer?.selectedCompanyId
  );

  useEffect(() => {
    const payload = selectedCompanyId ? { company_id: selectedCompanyId } : undefined;
    dispatch(TransactionAction(TRANSACTION_FETCH, payload));
  }, [dispatch, selectedCompanyId]);

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
  };

  const processedTransactions: ExtendedTransaction[] = useMemo(() => {
    if (!transactionState?.customers_transactions) return [];

    return transactionState.customers_transactions
      .filter((item: ICustomerTransactions) => {
        if (searchTerm) {
          const lowerSearch = searchTerm.toLowerCase();
          const matchesId = item.id?.toLowerCase().includes(lowerSearch);
          const matchesAmount = item.base_amount
            ?.toString()
            .includes(lowerSearch);
          const matchesCrypto = item.base_currency
            ?.toLowerCase()
            .includes(lowerSearch);

          if (!matchesId && !matchesAmount && !matchesCrypto) return false;
        }

        if (selectedWallet !== "all") {
          const targetCurrency = walletMapping[selectedWallet];
          const itemCrypto = (item as any).crypto_currency || (item as any).crypto || item.base_currency;
          if (targetCurrency && itemCrypto !== targetCurrency) {
            return false;
          }
        }

        if (dateRange.startDate && dateRange.endDate && item.createdAt) {
          try {
            const transactionDate = parseISO(item.createdAt);
            if (
              !isWithinInterval(transactionDate, {
                start: startOfDay(dateRange.startDate),
                end: endOfDay(dateRange.endDate),
              })
            ) {
              return false;
            }
          } catch (e) {
            console.error("Date parsing error", item.createdAt);
            return false;
          }
        }

        return true;
      })
      .map((item: ICustomerTransactions) => {
        const cryptoCurrency = (item as any).crypto_currency || (item as any).crypto || item.base_currency;
        const cryptoAmount = Number((item as any).crypto_amount) || Number(item.base_amount) || 0;
        const autoConverted = (item as any).auto_converted === true || (item as any).auto_converted === 'true';
        const autoConvertTarget = (item as any).auto_convert || null;

        return {
          id: String((item as any).transaction_id || item.id || `TX-${Math.random().toString(36).substr(2, 9)}`),
          crypto: cryptoCurrency,
          amount: `${cryptoAmount} ${cryptoCurrency}`,
          usdValue: (() => {
            const raw = Number((item as any).usd_value) || Number(item.base_amount) || 0;
            if (raw === 0) return "$0.00";
            if (raw >= 1) return `$${raw.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            if (raw >= 0.01) return `$${raw.toFixed(4).replace(/0+$/, "").replace(/\.$/, ".00")}`;
            return `$${raw.toFixed(6).replace(/0+$/, "").replace(/\.$/, ".00")}`;
          })(),
          dateTime: formatDateTime(item.createdAt),
          status:
            item.status === "success" || item.status === "successful" || item.status === "Completed" || item.status === "completed" || item.status === "confirmed"
              ? "done"
              : item.status === "failed" || item.status === "expired" || item.status === "Expired"
                ? "failed"
                : "pending",
          fees: (() => {
            const txFee = Number((item as any).transaction_fee) || 0;
            const fixedFee = Number((item as any).fixed_fee) || 0;
            const blockchainFee = Number((item as any).blockchain_buffer_fee) || 0;
            return txFee + fixedFee + blockchainFee;
          })(),
          feesBreakdown: {
            platform: Number((item as any).transaction_fee) || 0,
            blockchain: Number((item as any).blockchain_buffer_fee) || 0,
            fixed: Number((item as any).fixed_fee) || 0,
          },
          confirmations: (item as any).confirmations
            ? `${(item as any).confirmations}/${(item as any).required_confirmations || 0}`
            : "0/0",
          incomingTransactionId: (item as any).incoming_tx_hash || (item as any).incoming_txid || (item as any).incomingTransactionId || (item as any).transaction_reference || "",
          outgoingTransactionId: (item as any).outgoing_tx_hash || (item as any).outgoing_txid || (item as any).outgoingTransactionId || "",
          callbackUrl: (item as any).callback_url || (item as any).callbackUrl || "",
          webhookResponse: (item as any).webhook_response || (item as any).webhookResponse || null,
          autoConverted,
          autoConvertTarget,
        };
      });
  }, [
    transactionState.customers_transactions,
    searchTerm,
    selectedWallet,
    dateRange.startDate,
    dateRange.endDate,
  ]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
  };

  const handleWalletChange = (wallet: string) => {
    setSelectedWallet(wallet);
  };

  const handleExport = () => {
    dispatch(TransactionAction(TRANSACTION_EXPORT, {
      wallet: selectedWallet !== "all" ? walletMapping[selectedWallet] : undefined,
      startDate: dateRange.startDate?.toISOString(),
      endDate: dateRange.endDate?.toISOString(),
      search: searchTerm || undefined,
      company_id: selectedCompanyId || undefined,
    }));
  };

  if (transactionState.loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (
    transactionState?.customers_transactions?.length === 0 &&
    !transactionState.loading
  ) {
    return <EmptyDataModel pageName="transactions" />;
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        "> :not(:last-child)": {
          marginBottom: { md: "20px", xs: "16px" },
        },
      }}
    >
      <TransactionsTopBar
        onSearch={handleSearch}
        onDateRangeChange={handleDateRangeChange}
        onWalletChange={handleWalletChange}
        onExport={handleExport}
      />
      <TransactionsTable transactions={processedTransactions} rowsPerPage={10} />
    </Box>
  );
};

export default TransactionPage;
