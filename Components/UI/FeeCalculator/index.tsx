import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Typography,
  CircularProgress,
  InputAdornment,
  SelectChangeEvent,
} from "@mui/material";
import { styled, alpha, useTheme } from "@mui/material/styles";
import axiosBaseApi from "@/axiosConfig";

/* ================= TYPES ================= */

interface FeeResult {
  payment_amount: number;
  currency: string;
  cryptocurrency: string;
  fee_breakdown: {
    platform_fee: number;
    platform_fee_percent: number;
    blockchain_fee: number;
    total_fees: number;
  };
  net_to_merchant: number;
  usd_equivalents: {
    payment_amount_usd: number;
    total_fees_usd: number;
    net_to_merchant_usd: number;
    exchange_rate: number;
  };
}

interface FeeCalculatorProps {
  compact?: boolean;
}

/* ================= CONSTANTS ================= */

const FIAT_CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "NZD", "CHF", "JPY", "BRL", "NGN"];

const CRYPTO_OPTIONS = [
  { value: "BTC", label: "Bitcoin (BTC)", network: "Bitcoin" },
  { value: "ETH", label: "Ethereum (ETH)", network: "Ethereum" },
  { value: "LTC", label: "Litecoin (LTC)", network: "Litecoin" },
  { value: "DOGE", label: "Dogecoin (DOGE)", network: "Dogecoin" },
  { value: "TRX", label: "Tron (TRX)", network: "Tron" },
  { value: "BCH", label: "Bitcoin Cash (BCH)", network: "Bitcoin Cash" },
  { value: "SOL", label: "Solana (SOL)", network: "Solana" },
  { value: "XRP", label: "Ripple (XRP)", network: "XRP Ledger" },
  { value: "USDT-TRC20", label: "USDT (TRC20)", network: "Tron" },
  { value: "USDT-ERC20", label: "USDT (ERC20)", network: "Ethereum" },
  { value: "USDC", label: "USDC (ERC20)", network: "Ethereum" },
  { value: "POLYGON", label: "Polygon (MATIC)", network: "Polygon" },
  { value: "RLUSD-XRPL", label: "RLUSD (XRP Ledger)", network: "XRP Ledger" },
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", AUD: "A$", CAD: "C$",
  NZD: "NZ$", CHF: "CHF", JPY: "¥", BRL: "R$", NGN: "₦",
};

/* ================= STYLED COMPONENTS ================= */

const CalculatorCard = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";
  return {
    background: isDark ? "#141625" : "#FFFFFF",
    border: `1px solid ${isDark ? "#2A2D42" : "#E7E8EF"}`,
    borderRadius: "20px",
    padding: "32px",
    position: "relative",
    overflow: "hidden",
    "&::before": {
      content: '""',
      position: "absolute",
      bottom: 0,
      left: "50%",
      transform: "translateX(-50%)",
      width: "80%",
      height: "60%",
      background: `radial-gradient(at center bottom, ${isDark ? "#6A7BFF3D" : "#0004FF1A"}, transparent)`,
      filter: "blur(80px)",
      opacity: 0.5,
      zIndex: 0,
      pointerEvents: "none",
    },
    "& > *": { position: "relative", zIndex: 1 },
    [theme.breakpoints.down("md")]: {
      padding: "20px",
    },
  };
});

const ResultRow = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 0",
  "&:not(:last-child)": {
    borderBottom: `1px solid ${theme.palette.mode === "dark" ? "#2A2D42" : "#E7E8EF"}`,
  },
}));

const ResultLabel = styled(Typography)(({ theme }) => ({
  fontSize: "14px",
  fontWeight: 400,
  fontFamily: "OutfitRegular",
  color: theme.palette.text.secondary,
}));

const ResultValue = styled(Typography)(({ theme }) => ({
  fontSize: "14px",
  fontWeight: 500,
  fontFamily: "OutfitMedium",
  color: theme.palette.text.primary,
}));

const HighlightBox = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";
  return {
    background: isDark ? "rgba(106,123,255,0.1)" : "#0004FF08",
    border: `1px solid ${isDark ? "rgba(106,123,255,0.2)" : "#0004FF1A"}`,
    borderRadius: "12px",
    padding: "16px",
    marginTop: "16px",
  };
});

const SummaryRow = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  "&:not(:last-child)": { marginBottom: "8px" },
}));

const SummaryLabel = styled(Typography)(({ theme }) => ({
  fontSize: "16px",
  fontWeight: 500,
  fontFamily: "OutfitMedium",
  color: theme.palette.text.secondary,
}));

const SummaryValue = styled(Typography)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";
  return {
    fontSize: "20px",
    fontWeight: 600,
    fontFamily: "OutfitSemiBold",
    color: isDark ? "#A5B4FC" : "#0004FF",
  };
});

const NetworkNote = styled(Typography)(({ theme }) => ({
  fontSize: "12px",
  fontWeight: 400,
  fontFamily: "OutfitRegular",
  color: theme.palette.text.secondary,
  marginTop: "12px",
  textAlign: "center",
  fontStyle: "italic",
}));

const styledSelect = {
  fontFamily: "OutfitRegular",
  fontSize: "14px",
  borderRadius: "12px",
  "& .MuiOutlinedInput-notchedOutline": {
    borderRadius: "12px",
  },
};

const styledInput = {
  fontFamily: "OutfitRegular",
  fontSize: "14px",
  "& .MuiOutlinedInput-root": {
    borderRadius: "12px",
    fontFamily: "OutfitMedium",
  },
  "& .MuiInputLabel-root": {
    fontFamily: "OutfitRegular",
  },
};

/* ================= COMPONENT ================= */

const FeeCalculator: React.FC<FeeCalculatorProps> = ({ compact = false }) => {
  const { t } = useTranslation("fees");
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [amount, setAmount] = useState<string>("100");
  const [currency, setCurrency] = useState<string>("USD");
  const [crypto, setCrypto] = useState<string>("BTC");
  const [result, setResult] = useState<FeeResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const symbol = useMemo(() => CURRENCY_SYMBOLS[currency] || currency + " ", [currency]);

  const formatAmount = useCallback(
    (val: number) => `${symbol}${val.toFixed(2)}`,
    [symbol]
  );

  const calculateFees = useCallback(async (amt: string, cur: string, cry: string) => {
    const numAmt = parseFloat(amt);
    if (!numAmt || numAmt <= 0) {
      setResult(null);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { data } = await axiosBaseApi.post("pay/calculateFees", {
        amount: numAmt,
        cryptocurrency: cry,
        currency: cur,
      });
      if (data?.data) {
        setResult(data.data);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Calculation failed";
      setError(errorMsg);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced calculation
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      calculateFees(amount, currency, crypto);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [amount, currency, crypto, calculateFees]);

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^\d*\.?\d{0,2}$/.test(val)) {
      setAmount(val);
    }
  }, []);

  const handleCurrencyChange = useCallback((e: SelectChangeEvent<string>) => {
    setCurrency(e.target.value);
  }, []);

  const handleCryptoChange = useCallback((e: SelectChangeEvent<string>) => {
    setCrypto(e.target.value);
  }, []);

  return (
    <CalculatorCard>
      {/* Inputs */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: compact
            ? { xs: "1fr", sm: "1fr 1fr", md: "2fr 1fr 1.5fr" }
            : { xs: "1fr", sm: "1fr 1fr", md: "2fr 1fr 2fr" },
          gap: 2,
          mb: 3,
        }}
      >
        <TextField
          label={t("inputAmount")}
          value={amount}
          onChange={handleAmountChange}
          variant="outlined"
          fullWidth
          type="text"
          inputMode="decimal"
          sx={styledInput}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Typography sx={{ fontFamily: "OutfitMedium", color: isDark ? "#A5B4FC" : "#0004FF" }}>
                  {symbol}
                </Typography>
              </InputAdornment>
            ),
          }}
        />

        <FormControl fullWidth>
          <InputLabel sx={{ fontFamily: "OutfitRegular" }}>{t("inputCurrency")}</InputLabel>
          <Select
            value={currency}
            onChange={handleCurrencyChange}
            label={t("inputCurrency")}
            sx={styledSelect}
          >
            {FIAT_CURRENCIES.map((c) => (
              <MenuItem key={c} value={c} sx={{ fontFamily: "OutfitRegular" }}>
                {c}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel sx={{ fontFamily: "OutfitRegular" }}>{t("inputCrypto")}</InputLabel>
          <Select
            value={crypto}
            onChange={handleCryptoChange}
            label={t("inputCrypto")}
            sx={styledSelect}
          >
            {CRYPTO_OPTIONS.map((c) => (
              <MenuItem key={c.value} value={c.value} sx={{ fontFamily: "OutfitRegular" }}>
                {c.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Results */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={28} sx={{ color: isDark ? "#6A7BFF" : "#0004FF" }} />
          <Typography sx={{ ml: 2, fontFamily: "OutfitRegular", color: "text.secondary", fontSize: "14px" }}>
            {t("calculating")}
          </Typography>
        </Box>
      ) : result ? (
        <>
          {/* Fee Breakdown */}
          <Box>
            <ResultRow>
              <ResultLabel>{t("resultPlatformFee")} ({result.fee_breakdown.platform_fee_percent}%)</ResultLabel>
              <ResultValue>{formatAmount(result.fee_breakdown.platform_fee)}</ResultValue>
            </ResultRow>
            <ResultRow>
              <ResultLabel>{t("resultBlockchainFee")}</ResultLabel>
              <ResultValue>{formatAmount(result.fee_breakdown.blockchain_fee)}</ResultValue>
            </ResultRow>
            <ResultRow>
              <ResultLabel sx={{ fontWeight: 500, fontFamily: "OutfitMedium" }}>{t("resultTotalFees")}</ResultLabel>
              <ResultValue sx={{ fontWeight: 600, fontFamily: "OutfitSemiBold" }}>
                {formatAmount(result.fee_breakdown.total_fees)}
              </ResultValue>
            </ResultRow>
          </Box>

          {/* Summary Highlight */}
          <HighlightBox>
            <SummaryRow>
              <SummaryLabel>{t("resultCustomerPays")}</SummaryLabel>
              <SummaryValue>{formatAmount(result.payment_amount)}</SummaryValue>
            </SummaryRow>
            <SummaryRow>
              <SummaryLabel>{t("resultYouReceive")}</SummaryLabel>
              <SummaryValue sx={{ fontSize: "24px" }}>
                {formatAmount(result.net_to_merchant)}
              </SummaryValue>
            </SummaryRow>
          </HighlightBox>

          <NetworkNote>{t("networkNote")}</NetworkNote>
        </>
      ) : (
        <Box sx={{ textAlign: "center", py: 3 }}>
          <Typography sx={{ fontFamily: "OutfitRegular", color: "text.secondary", fontSize: "14px" }}>
            {error || t("enterAmount")}
          </Typography>
        </Box>
      )}
    </CalculatorCard>
  );
};

export default memo(FeeCalculator);
