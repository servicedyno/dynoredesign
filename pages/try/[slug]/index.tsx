import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Chip,
  Button,
  Divider,
  IconButton,
  Snackbar,
  Alert,
} from "@mui/material";
import { Icon } from "@iconify/react";
import axiosBaseApi from "@/axiosConfig";

interface TrialLinkData {
  id: string;
  slug: string;
  amount: string;
  fiat_currency: string;
  description: string | null;
  status: string;
  deposit_address: string | null;
  accepted_currencies: string[];
  expires_at: string;
  paid_at: string | null;
  paid_currency: string | null;
  paid_amount_crypto: string | null;
  qr_code_url: string | null;
  checkout_url: string | null;
  is_expired: boolean;
  is_paid: boolean;
  is_claimed: boolean;
}

const CRYPTO_ICONS: Record<string, { icon: string; color: string; label: string }> = {
  BTC: { icon: "cryptocurrency-color:btc", color: "#F7931A", label: "Bitcoin" },
  ETH: { icon: "cryptocurrency-color:eth", color: "#627EEA", label: "Ethereum" },
  "USDT-TRC20": { icon: "cryptocurrency-color:usdt", color: "#26A17B", label: "USDT (TRC20)" },
  "USDT-ERC20": { icon: "cryptocurrency-color:usdt", color: "#26A17B", label: "USDT (ERC20)" },
  LTC: { icon: "cryptocurrency-color:ltc", color: "#BFBBBB", label: "Litecoin" },
  DOGE: { icon: "cryptocurrency-color:doge", color: "#C2A633", label: "Dogecoin" },
  TRX: { icon: "cryptocurrency-color:trx", color: "#FF0013", label: "TRON" },
  SOL: { icon: "cryptocurrency-color:sol", color: "#9945FF", label: "Solana" },
  XRP: { icon: "cryptocurrency-color:xrp", color: "#23292F", label: "Ripple" },
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "\u20ac", GBP: "\u00a3", AUD: "A$", CAD: "C$", CHF: "CHF",
  JPY: "\u00a5", CNY: "\u00a5", HKD: "HK$", NZD: "NZ$", SGD: "S$",
};

export default function TrialPaymentPage() {
  const router = useRouter();
  const { slug } = router.query;

  const [loading, setLoading] = useState(true);
  const [linkData, setLinkData] = useState<TrialLinkData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchTrialLink = useCallback(async () => {
    if (!slug) return;
    try {
      setLoading(true);
      const response = await axiosBaseApi.get(`public/trial/${slug}`);
      setLinkData(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load payment link");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchTrialLink();
  }, [fetchTrialLink]);

  // Auto-refresh for active links
  useEffect(() => {
    if (!linkData || linkData.status !== "active") return;
    const interval = setInterval(fetchTrialLink, 15000);
    return () => clearInterval(interval);
  }, [linkData, fetchTrialLink]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
  };

  const currencySymbol = linkData ? (CURRENCY_SYMBOLS[linkData.fiat_currency] || linkData.fiat_currency) : "$";
  const formattedAmount = linkData ? `${currencySymbol}${parseFloat(linkData.amount).toFixed(2)}` : "";

  // Time remaining
  const getTimeRemaining = () => {
    if (!linkData?.expires_at) return "";
    const diff = new Date(linkData.expires_at).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m remaining`;
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#0a0b14" }}>
        <CircularProgress sx={{ color: "#0004FF" }} />
      </Box>
    );
  }

  if (error || !linkData) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#0a0b14", p: 3 }}>
        <Paper sx={{ p: 4, maxWidth: 420, width: "100%", textAlign: "center", bgcolor: "#12131C", borderRadius: 3, border: "1px solid #1e1f2e" }}>
          <Icon icon="mdi:alert-circle-outline" width={48} color="#E8484A" />
          <Typography variant="h6" sx={{ color: "#fff", mt: 2 }}>{error || "Link not found"}</Typography>
          <Button variant="contained" sx={{ mt: 3, bgcolor: "#0004FF" }} onClick={() => router.push("/")}>Go Home</Button>
        </Paper>
      </Box>
    );
  }

  // Paid state
  if (linkData.is_paid && !linkData.is_claimed) {
    return (
      <>
        <Head><title>Payment Received | DynoPay</title></Head>
        <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#0a0b14", p: 3 }}>
          <Paper sx={{ p: 4, maxWidth: 480, width: "100%", textAlign: "center", bgcolor: "#12131C", borderRadius: 3, border: "1px solid #1e1f2e" }}>
            <Box sx={{ width: 72, height: 72, borderRadius: "50%", bgcolor: "rgba(71,180,100,0.15)", display: "flex", alignItems: "center", justifyContent: "center", mx: "auto", mb: 3 }}>
              <Icon icon="mdi:check-circle" width={40} color="#47B464" />
            </Box>
            <Typography variant="h5" sx={{ color: "#fff", fontWeight: 700, mb: 1 }}>Payment Received!</Typography>
            <Typography sx={{ color: "#9e9ea7", mb: 3 }}>{formattedAmount} has been received via {linkData.paid_currency}</Typography>
            <Divider sx={{ borderColor: "#1e1f2e", my: 2 }} />
            <Typography sx={{ color: "#9e9ea7", fontSize: 14, mb: 3 }}>
              Claim your funds to create your DynoPay account and start accepting crypto payments.
            </Typography>
            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={() => router.push(`/try/${slug}/claim`)}
              sx={{ bgcolor: "#0004FF", py: 1.5, fontSize: 16, fontWeight: 600, borderRadius: 2, "&:hover": { bgcolor: "#0003cc" } }}
            >
              Claim Your Funds
            </Button>
          </Paper>
        </Box>
      </>
    );
  }

  // Claimed state
  if (linkData.is_claimed) {
    return (
      <>
        <Head><title>Funds Claimed | DynoPay</title></Head>
        <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#0a0b14", p: 3 }}>
          <Paper sx={{ p: 4, maxWidth: 420, width: "100%", textAlign: "center", bgcolor: "#12131C", borderRadius: 3, border: "1px solid #1e1f2e" }}>
            <Icon icon="mdi:check-all" width={48} color="#47B464" />
            <Typography variant="h6" sx={{ color: "#fff", mt: 2 }}>Funds have been claimed</Typography>
            <Typography sx={{ color: "#9e9ea7", mt: 1, mb: 3 }}>This payment has been completed and funds claimed.</Typography>
            <Button variant="contained" sx={{ bgcolor: "#0004FF" }} onClick={() => router.push("/")}>Go to DynoPay</Button>
          </Paper>
        </Box>
      </>
    );
  }

  // Expired state
  if (linkData.is_expired || linkData.status === "expired") {
    return (
      <>
        <Head><title>Link Expired | DynoPay</title></Head>
        <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#0a0b14", p: 3 }}>
          <Paper sx={{ p: 4, maxWidth: 420, width: "100%", textAlign: "center", bgcolor: "#12131C", borderRadius: 3, border: "1px solid #1e1f2e" }}>
            <Icon icon="mdi:clock-alert-outline" width={48} color="#F5A623" />
            <Typography variant="h6" sx={{ color: "#fff", mt: 2 }}>Payment Link Expired</Typography>
            <Typography sx={{ color: "#9e9ea7", mt: 1, mb: 3 }}>This trial payment link has expired. Create a new one to continue.</Typography>
            <Button variant="contained" sx={{ bgcolor: "#0004FF" }} onClick={() => router.push("/")}>Create New Link</Button>
          </Paper>
        </Box>
      </>
    );
  }

  // Active state — awaiting payment
  return (
    <>
      <Head>
        <title>Pay {formattedAmount} | DynoPay</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Box sx={{ minHeight: "100vh", bgcolor: "#0a0b14", display: "flex", flexDirection: "column", alignItems: "center", py: 4, px: 2 }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 4, cursor: "pointer" }} onClick={() => router.push("/")}>
          <Icon icon="mdi:lightning-bolt" width={28} color="#0004FF" />
          <Typography sx={{ color: "#fff", fontWeight: 700, fontSize: 20 }}>DynoPay</Typography>
        </Box>

        {/* Main card */}
        <Paper sx={{ maxWidth: 480, width: "100%", bgcolor: "#12131C", borderRadius: 3, border: "1px solid #1e1f2e", overflow: "hidden" }}>
          {/* Amount header */}
          <Box sx={{ p: 3, textAlign: "center", background: "linear-gradient(135deg, #0004FF15 0%, #12131C 100%)" }}>
            <Typography sx={{ color: "#9e9ea7", fontSize: 14, mb: 0.5 }}>Payment Amount</Typography>
            <Typography sx={{ color: "#fff", fontSize: 36, fontWeight: 800, letterSpacing: "-0.5px" }}>
              {formattedAmount}
            </Typography>
            {linkData.description && (
              <Typography sx={{ color: "#9e9ea7", fontSize: 14, mt: 1 }}>{linkData.description}</Typography>
            )}
            <Chip
              label={getTimeRemaining()}
              size="small"
              sx={{ mt: 1.5, bgcolor: "rgba(255,255,255,0.08)", color: "#9e9ea7", fontSize: 12 }}
              icon={<Icon icon="mdi:clock-outline" width={14} color="#9e9ea7" />}
            />
          </Box>

          <Divider sx={{ borderColor: "#1e1f2e" }} />

          {/* Pay Now section */}
          <Box sx={{ p: 3 }}>
            {linkData.checkout_url ? (
              <>
                <Typography sx={{ color: "#9e9ea7", fontSize: 13, mb: 2, textTransform: "uppercase", letterSpacing: 1 }}>
                  Pay with Bitcoin
                </Typography>
                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  onClick={() => window.location.href = linkData.checkout_url!}
                  startIcon={<Icon icon="cryptocurrency-color:btc" width={24} />}
                  sx={{
                    bgcolor: "#F7931A",
                    py: 1.8,
                    fontSize: 16,
                    fontWeight: 700,
                    borderRadius: 2,
                    textTransform: "none",
                    "&:hover": { bgcolor: "#e8850f" },
                  }}
                >
                  Pay {formattedAmount} with BTC
                </Button>
                <Typography sx={{ color: "#676768", fontSize: 12, mt: 2, textAlign: "center" }}>
                  You will be redirected to the DynoPay secure checkout
                </Typography>
              </>
            ) : (
              <>
                <Typography sx={{ color: "#9e9ea7", fontSize: 13, mb: 2, textTransform: "uppercase", letterSpacing: 1 }}>
                  Pay with
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {linkData.accepted_currencies.map((crypto) => {
                    const info = CRYPTO_ICONS[crypto] || { icon: "mdi:currency-btc", color: "#888", label: crypto };
                    return (
                      <Box
                        key={crypto}
                        sx={{
                          display: "flex", alignItems: "center", gap: 2, p: 1.5,
                          borderRadius: 2, border: "1px solid #1e1f2e",
                          transition: "all 0.2s", cursor: "default",
                          "&:hover": { borderColor: "#0004FF", bgcolor: "rgba(0,4,255,0.05)" },
                        }}
                      >
                        <Icon icon={info.icon} width={28} />
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{info.label}</Typography>
                          <Typography sx={{ color: "#676768", fontSize: 12 }}>{crypto}</Typography>
                        </Box>
                        <Icon icon="mdi:chevron-right" width={20} color="#676768" />
                      </Box>
                    );
                  })}
                </Box>
              </>
            )}
          </Box>

          <Divider sx={{ borderColor: "#1e1f2e" }} />

          {/* Info footer */}
          <Box sx={{ p: 2.5, display: "flex", alignItems: "center", gap: 1.5, bgcolor: "rgba(0,4,255,0.04)" }}>
            <Icon icon="mdi:shield-check-outline" width={20} color="#0004FF" />
            <Typography sx={{ color: "#9e9ea7", fontSize: 12 }}>
              Secured by DynoPay. Payments are confirmed on-chain.
            </Typography>
          </Box>
        </Paper>

        {/* Share link */}
        <Box sx={{ mt: 3, maxWidth: 480, width: "100%" }}>
          <Typography sx={{ color: "#676768", fontSize: 12, mb: 1, textAlign: "center" }}>Share this payment link</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, borderRadius: 2, bgcolor: "#12131C", border: "1px solid #1e1f2e" }}>
            <Typography sx={{ color: "#9e9ea7", fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", px: 1 }}>
              {typeof window !== "undefined" ? window.location.href : ""}
            </Typography>
            <IconButton size="small" onClick={() => copyToClipboard(typeof window !== "undefined" ? window.location.href : "")} sx={{ color: "#0004FF" }}>
              <Icon icon="mdi:content-copy" width={18} />
            </IconButton>
          </Box>
        </Box>

        {/* Powered by footer */}
        <Typography sx={{ color: "#3a3a4a", fontSize: 12, mt: 4, textAlign: "center" }}>
          Powered by DynoPay — Accept crypto payments with zero setup
        </Typography>
      </Box>

      <Snackbar open={copied} autoHideDuration={2000} onClose={() => setCopied(false)}>
        <Alert severity="success" onClose={() => setCopied(false)}>Link copied to clipboard!</Alert>
      </Snackbar>
    </>
  );
}
