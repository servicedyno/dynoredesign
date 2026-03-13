import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Alert,
  InputAdornment,
  IconButton,
  Divider,
} from "@mui/material";
import { Icon } from "@iconify/react";
import axiosBaseApi from "@/axiosConfig";

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "\u20ac", GBP: "\u00a3", AUD: "A$", CAD: "C$",
};

export default function ClaimFundsPage() {
  const router = useRouter();
  const { slug } = router.query;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [linkData, setLinkData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [claimToken, setClaimToken] = useState("");

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

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password || !claimToken) {
      setError("Please fill in all required fields");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    try {
      setSubmitting(true);
      await axiosBaseApi.post("public/claim-funds", {
        slug,
        claim_token: claimToken,
        email,
        password,
        company_name: companyName || undefined,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to claim funds");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#0a0b14" }}>
        <CircularProgress sx={{ color: "#0004FF" }} />
      </Box>
    );
  }

  if (success) {
    return (
      <>
        <Head><title>Welcome to DynoPay!</title></Head>
        <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#0a0b14", p: 3 }}>
          <Paper sx={{ p: 4, maxWidth: 480, width: "100%", textAlign: "center", bgcolor: "#12131C", borderRadius: 3, border: "1px solid #1e1f2e" }}>
            <Box sx={{ width: 80, height: 80, borderRadius: "50%", bgcolor: "rgba(71,180,100,0.15)", display: "flex", alignItems: "center", justifyContent: "center", mx: "auto", mb: 3 }}>
              <Icon icon="mdi:party-popper" width={44} color="#47B464" />
            </Box>
            <Typography variant="h5" sx={{ color: "#fff", fontWeight: 700, mb: 1 }}>Welcome to DynoPay!</Typography>
            <Typography sx={{ color: "#9e9ea7", mb: 1 }}>Your account has been created and funds are being processed.</Typography>
            <Box sx={{ bgcolor: "rgba(0,4,255,0.08)", borderRadius: 2, p: 2, my: 3 }}>
              <Typography sx={{ color: "#0004FF", fontWeight: 600, fontSize: 14 }}>
                \ud83c\udf89 Your first $500 in transactions are fee-free!
              </Typography>
            </Box>
            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={() => router.push("/auth/login")}
              sx={{ bgcolor: "#0004FF", py: 1.5, fontSize: 16, fontWeight: 600, borderRadius: 2, "&:hover": { bgcolor: "#0003cc" } }}
            >
              Go to Dashboard
            </Button>
          </Paper>
        </Box>
      </>
    );
  }

  // Check if link is claimable
  if (linkData && linkData.status !== "paid") {
    return (
      <>
        <Head><title>Cannot Claim | DynoPay</title></Head>
        <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#0a0b14", p: 3 }}>
          <Paper sx={{ p: 4, maxWidth: 420, width: "100%", textAlign: "center", bgcolor: "#12131C", borderRadius: 3, border: "1px solid #1e1f2e" }}>
            <Icon icon="mdi:information-outline" width={48} color="#F5A623" />
            <Typography variant="h6" sx={{ color: "#fff", mt: 2 }}>
              {linkData.status === "claimed" ? "Already Claimed" : 
               linkData.status === "active" ? "Payment Not Yet Received" :
               "Link Expired"}
            </Typography>
            <Typography sx={{ color: "#9e9ea7", mt: 1, mb: 3 }}>
              {linkData.status === "claimed" ? "These funds have already been claimed." :
               linkData.status === "active" ? "This payment link hasn't been paid yet. Wait for the customer to complete the payment." :
               "This trial link has expired."}
            </Typography>
            <Button variant="contained" sx={{ bgcolor: "#0004FF" }} onClick={() => router.push(`/try/${slug}`)}>Back to Payment</Button>
          </Paper>
        </Box>
      </>
    );
  }

  const currencySymbol = linkData ? (CURRENCY_SYMBOLS[linkData.fiat_currency] || linkData.fiat_currency) : "$";
  const formattedAmount = linkData ? `${currencySymbol}${parseFloat(linkData.amount).toFixed(2)}` : "";

  return (
    <>
      <Head><title>Claim Your Funds | DynoPay</title></Head>
      <Box sx={{ minHeight: "100vh", bgcolor: "#0a0b14", display: "flex", flexDirection: "column", alignItems: "center", py: 4, px: 2 }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 4, cursor: "pointer" }} onClick={() => router.push("/")}>
          <Icon icon="mdi:lightning-bolt" width={28} color="#0004FF" />
          <Typography sx={{ color: "#fff", fontWeight: 700, fontSize: 20 }}>DynoPay</Typography>
        </Box>

        <Paper sx={{ maxWidth: 480, width: "100%", bgcolor: "#12131C", borderRadius: 3, border: "1px solid #1e1f2e", overflow: "hidden" }}>
          {/* Header */}
          <Box sx={{ p: 3, textAlign: "center", background: "linear-gradient(135deg, rgba(71,180,100,0.1) 0%, #12131C 100%)" }}>
            <Box sx={{ width: 56, height: 56, borderRadius: "50%", bgcolor: "rgba(71,180,100,0.15)", display: "flex", alignItems: "center", justifyContent: "center", mx: "auto", mb: 2 }}>
              <Icon icon="mdi:cash-check" width={28} color="#47B464" />
            </Box>
            <Typography variant="h6" sx={{ color: "#fff", fontWeight: 700 }}>Claim Your Funds</Typography>
            <Typography sx={{ color: "#47B464", fontWeight: 700, fontSize: 24, mt: 1 }}>{formattedAmount}</Typography>
            <Typography sx={{ color: "#9e9ea7", fontSize: 13, mt: 0.5 }}>
              Paid via {linkData?.paid_currency || "crypto"}
            </Typography>
          </Box>

          <Divider sx={{ borderColor: "#1e1f2e" }} />

          {/* Form */}
          <Box component="form" onSubmit={handleClaim} sx={{ p: 3 }}>
            <Typography sx={{ color: "#9e9ea7", fontSize: 13, mb: 2 }}>
              Create your DynoPay account to receive your funds and start accepting crypto payments.
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2, bgcolor: "rgba(232,72,74,0.1)", color: "#E8484A" }}>{error}</Alert>}

            <TextField
              label="Claim Token"
              value={claimToken}
              onChange={(e) => setClaimToken(e.target.value)}
              fullWidth
              required
              placeholder="Paste your claim token here"
              sx={{ mb: 2, "& .MuiOutlinedInput-root": { bgcolor: "#0a0b14", color: "#fff", "& fieldset": { borderColor: "#1e1f2e" } }, "& .MuiInputLabel-root": { color: "#676768" } }}
              size="small"
            />

            <TextField
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              placeholder="you@company.com"
              sx={{ mb: 2, "& .MuiOutlinedInput-root": { bgcolor: "#0a0b14", color: "#fff", "& fieldset": { borderColor: "#1e1f2e" } }, "& .MuiInputLabel-root": { color: "#676768" } }}
              size="small"
            />

            <TextField
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
              placeholder="Min. 8 characters"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: "#676768" }}>
                      <Icon icon={showPassword ? "mdi:eye-off" : "mdi:eye"} width={20} />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2, "& .MuiOutlinedInput-root": { bgcolor: "#0a0b14", color: "#fff", "& fieldset": { borderColor: "#1e1f2e" } }, "& .MuiInputLabel-root": { color: "#676768" } }}
              size="small"
            />

            <TextField
              label="Business Name (optional)"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              fullWidth
              placeholder="Your business name"
              sx={{ mb: 3, "& .MuiOutlinedInput-root": { bgcolor: "#0a0b14", color: "#fff", "& fieldset": { borderColor: "#1e1f2e" } }, "& .MuiInputLabel-root": { color: "#676768" } }}
              size="small"
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={submitting}
              sx={{ bgcolor: "#0004FF", py: 1.5, fontSize: 16, fontWeight: 600, borderRadius: 2, "&:hover": { bgcolor: "#0003cc" }, "&.Mui-disabled": { bgcolor: "#0004FF80" } }}
            >
              {submitting ? <CircularProgress size={24} sx={{ color: "#fff" }} /> : "Claim Funds & Create Account"}
            </Button>

            <Box sx={{ mt: 2, p: 2, bgcolor: "rgba(0,4,255,0.05)", borderRadius: 2 }}>
              <Typography sx={{ color: "#9e9ea7", fontSize: 12, display: "flex", alignItems: "center", gap: 1 }}>
                <Icon icon="mdi:gift-outline" width={16} color="#0004FF" />
                Your first $500 in transactions will be fee-free!
              </Typography>
            </Box>
          </Box>
        </Paper>

        <Typography sx={{ color: "#3a3a4a", fontSize: 12, mt: 4, textAlign: "center" }}>
          Powered by DynoPay
        </Typography>
      </Box>
    </>
  );
}
