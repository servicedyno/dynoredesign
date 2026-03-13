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
  Chip,
  IconButton,
  Snackbar,
  InputAdornment,
  Divider,
  useTheme,
} from "@mui/material";
import { Icon } from "@iconify/react";
import axiosBaseApi from "@/axiosConfig";

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "\u20ac", GBP: "\u00a3", AUD: "A$", CAD: "C$",
};

interface ManageLinkData {
  slug: string;
  amount: number;
  currency: string;
  description: string | null;
  status: string;
  link_url: string;
  creator_email: string;
  expires_at: string;
  paid_at: string | null;
  paid_currency: string | null;
  paid_amount_crypto: string | null;
  claimed_at: string | null;
  is_expired: boolean;
  is_paid: boolean;
  is_claimed: boolean;
  can_claim: boolean;
}

const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string; bgColor: string }> = {
  active: { color: "#3b82f6", icon: "mdi:clock-outline", label: "Awaiting Payment", bgColor: "rgba(59,130,246,0.1)" },
  paid: { color: "#22c55e", icon: "mdi:check-circle", label: "Payment Received", bgColor: "rgba(34,197,94,0.1)" },
  claimed: { color: "#8b5cf6", icon: "mdi:gift-outline", label: "Funds Claimed", bgColor: "rgba(139,92,246,0.1)" },
  expired: { color: "#ef4444", icon: "mdi:timer-off-outline", label: "Expired", bgColor: "rgba(239,68,68,0.1)" },
};

export default function ManageTrialLinkPage() {
  const router = useRouter();
  const { token } = router.query;
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [loading, setLoading] = useState(true);
  const [linkData, setLinkData] = useState<ManageLinkData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Claim form state
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimEmail, setClaimEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState(false);

  const fetchLinkData = useCallback(async () => {
    if (!token || typeof token !== "string") return;
    try {
      setLoading(true);
      setError(null);
      const response = await axiosBaseApi.get(`public/trial/manage/${token}`);
      const data = response.data.data;
      setLinkData(data);
      // Pre-fill email from creator email
      if (data.creator_email) {
        setClaimEmail(data.creator_email);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid or expired management link");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchLinkData();
  }, [fetchLinkData]);

  // Auto-refresh for active links (every 15 seconds)
  useEffect(() => {
    if (!linkData || linkData.status !== "active") return;
    const interval = setInterval(fetchLinkData, 15000);
    return () => clearInterval(interval);
  }, [linkData, fetchLinkData]);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || typeof token !== "string") return;

    setClaimError(null);
    setSubmitting(true);

    try {
      await axiosBaseApi.post("public/claim-funds", {
        management_token: token,
        email: claimEmail.trim(),
        password,
        company_name: companyName || undefined,
      });
      setClaimSuccess(true);
    } catch (err: any) {
      setClaimError(err.response?.data?.message || "Failed to claim funds");
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
  };

  // Theme colors
  const paperBg = theme.palette.background.paper;
  const fieldBg = theme.palette.background.default;
  const borderColor = isDark ? "#1e1f2e" : theme.palette.divider;
  const textPrimary = theme.palette.text.primary;
  const textSecondary = theme.palette.text.secondary;

  const inputSx = {
    "& .MuiOutlinedInput-root": {
      bgcolor: fieldBg,
      color: textPrimary,
      "& fieldset": { borderColor },
      "&:hover fieldset": { borderColor: theme.palette.primary.main },
      "&.Mui-focused fieldset": { borderColor: theme.palette.primary.main },
    },
    "& .MuiInputLabel-root": { color: textSecondary },
  };

  // Loading state
  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: theme.palette.background.default }}>
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (error || !linkData) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: theme.palette.background.default, px: 2 }}>
        <Head><title>Invalid Link | DynoPay</title></Head>
        <Paper elevation={0} sx={{ p: 4, maxWidth: 440, width: "100%", textAlign: "center", bgcolor: paperBg, borderRadius: 3, border: `1px solid ${borderColor}` }}>
          <Icon icon="mdi:link-off" width={48} color="#ef4444" />
          <Typography sx={{ color: textPrimary, fontWeight: 700, fontSize: 20, mt: 2, mb: 1 }}>
            Invalid Management Link
          </Typography>
          <Typography sx={{ color: textSecondary, fontSize: 14, mb: 3 }}>
            {error || "This link is invalid or has expired."}
          </Typography>
          <Button variant="contained" onClick={() => router.push("/")} sx={{ bgcolor: theme.palette.primary.main }}>
            Go to Homepage
          </Button>
        </Paper>
      </Box>
    );
  }

  const currencySymbol = CURRENCY_SYMBOLS[linkData.currency] || "$";
  const statusConfig = STATUS_CONFIG[linkData.status] || STATUS_CONFIG.active;

  // Claim success screen
  if (claimSuccess) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: theme.palette.background.default, px: 2 }}>
        <Head><title>Funds Claimed! | DynoPay</title></Head>
        <Paper elevation={0} sx={{ p: 4, maxWidth: 440, width: "100%", textAlign: "center", bgcolor: paperBg, borderRadius: 3, border: `1px solid ${borderColor}` }}>
          <Box sx={{ width: 60, height: 60, borderRadius: "50%", bgcolor: "rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center", mx: "auto", mb: 2 }}>
            <Icon icon="mdi:party-popper" width={32} color="#22c55e" />
          </Box>
          <Typography sx={{ color: textPrimary, fontWeight: 800, fontSize: 22, mb: 1 }}>
            Funds Claimed Successfully!
          </Typography>
          <Typography sx={{ color: textSecondary, fontSize: 14, mb: 1 }}>
            Your account has been created and {currencySymbol}{Number(linkData.amount).toFixed(2)} {linkData.currency} will be credited.
          </Typography>
          <Typography sx={{ color: theme.palette.primary.main, fontSize: 13, fontWeight: 600, mb: 3 }}>
            Your first $500 in transactions are fee-free!
          </Typography>
          <Button
            variant="contained"
            fullWidth
            onClick={() => router.push("/auth/login")}
            sx={{ bgcolor: theme.palette.primary.main, py: 1.2, fontSize: 15, fontWeight: 600, borderRadius: 2 }}
          >
            Sign In to Dashboard
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: theme.palette.background.default, px: 2, py: 4 }}>
      <Head>
        <title>Manage Payment Link | DynoPay</title>
      </Head>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, sm: 4 },
          maxWidth: 480,
          width: "100%",
          bgcolor: paperBg,
          borderRadius: 3,
          border: `1px solid ${borderColor}`,
        }}
      >
        {/* Header */}
        <Box sx={{ textAlign: "center", mb: 3 }}>
          <Typography sx={{ color: textPrimary, fontWeight: 800, fontSize: { xs: 22, sm: 26 } }}>
            {currencySymbol}{Number(linkData.amount).toFixed(2)}
          </Typography>
          <Typography sx={{ color: textSecondary, fontSize: 13, mt: 0.3 }}>
            {linkData.currency}{linkData.description ? ` — ${linkData.description}` : ""}
          </Typography>
        </Box>

        {/* Status Badge */}
        <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
          <Chip
            icon={<Icon icon={statusConfig.icon} width={18} />}
            label={statusConfig.label}
            sx={{
              bgcolor: statusConfig.bgColor,
              color: statusConfig.color,
              fontWeight: 600,
              fontSize: 13,
              px: 1,
              "& .MuiChip-icon": { color: statusConfig.color },
            }}
          />
        </Box>

        <Divider sx={{ borderColor, mb: 3 }} />

        {/* Payment Link — always visible */}
        <Box sx={{ mb: 2.5 }}>
          <Typography sx={{ color: textSecondary, fontSize: 12, fontWeight: 600, mb: 0.5 }}>
            Payment Link
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, borderRadius: 1.5, bgcolor: fieldBg, border: `1px solid ${borderColor}` }}>
            <Typography sx={{ color: textSecondary, fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>
              {linkData.link_url}
            </Typography>
            <IconButton size="small" onClick={() => copyToClipboard(linkData.link_url, "Payment link")} sx={{ color: theme.palette.primary.main }}>
              <Icon icon="mdi:content-copy" width={16} />
            </IconButton>
          </Box>
        </Box>

        {/* Status-specific content */}
        {linkData.status === "active" && (
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: isDark ? "rgba(59,130,246,0.06)" : "rgba(59,130,246,0.04)", border: `1px solid ${isDark ? "rgba(59,130,246,0.15)" : "rgba(59,130,246,0.1)"}`, mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <CircularProgress size={14} sx={{ color: "#3b82f6" }} />
              <Typography sx={{ color: textPrimary, fontSize: 13, fontWeight: 600 }}>Waiting for payment</Typography>
            </Box>
            <Typography sx={{ color: textSecondary, fontSize: 12 }}>
              Share the payment link above with your customer. This page auto-refreshes when payment is received.
            </Typography>
            <Typography sx={{ color: textSecondary, fontSize: 11, mt: 1 }}>
              Expires: {new Date(linkData.expires_at).toLocaleString()}
            </Typography>
          </Box>
        )}

        {linkData.status === "paid" && (
          <>
            {/* Payment details */}
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: isDark ? "rgba(34,197,94,0.06)" : "rgba(34,197,94,0.04)", border: `1px solid ${isDark ? "rgba(34,197,94,0.15)" : "rgba(34,197,94,0.1)"}`, mb: 2 }}>
              <Typography sx={{ color: textPrimary, fontSize: 13, fontWeight: 600, mb: 0.5 }}>
                Payment received!
              </Typography>
              {linkData.paid_currency && (
                <Typography sx={{ color: textSecondary, fontSize: 12 }}>
                  {linkData.paid_amount_crypto} {linkData.paid_currency} {linkData.paid_at ? `on ${new Date(linkData.paid_at).toLocaleString()}` : ""}
                </Typography>
              )}
            </Box>

            {/* Claim form */}
            {!showClaimForm ? (
              <Button
                variant="contained"
                fullWidth
                onClick={() => setShowClaimForm(true)}
                sx={{
                  bgcolor: "#22c55e",
                  py: 1.3,
                  fontSize: 15,
                  fontWeight: 700,
                  borderRadius: 2,
                  "&:hover": { bgcolor: "#16a34a" },
                }}
              >
                Claim Your Funds
              </Button>
            ) : (
              <Box component="form" onSubmit={handleClaim}>
                <Typography sx={{ color: textPrimary, fontSize: 14, fontWeight: 600, mb: 0.5 }}>
                  Create your DynoPay account to claim
                </Typography>
                <Typography sx={{ color: textSecondary, fontSize: 12, mb: 2 }}>
                  Set up your account and your funds will be credited instantly.
                </Typography>

                {claimError && <Alert severity="error" sx={{ mb: 2, fontSize: 13 }}>{claimError}</Alert>}

                <TextField
                  label="Email"
                  type="email"
                  value={claimEmail}
                  onChange={(e) => setClaimEmail(e.target.value)}
                  fullWidth
                  size="small"
                  required
                  sx={{ mb: 1.5, ...inputSx }}
                />
                <TextField
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  fullWidth
                  size="small"
                  required
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                          <Icon icon={showPassword ? "mdi:eye-off" : "mdi:eye"} width={18} color={textSecondary} />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ mb: 1.5, ...inputSx }}
                />
                <TextField
                  label="Business Name (optional)"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  fullWidth
                  size="small"
                  sx={{ mb: 2, ...inputSx }}
                />

                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button
                    variant="outlined"
                    onClick={() => setShowClaimForm(false)}
                    sx={{ borderColor, color: textSecondary, flex: 0.4 }}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={submitting || !claimEmail || !password || password.length < 8}
                    sx={{
                      flex: 0.6,
                      bgcolor: "#22c55e",
                      fontWeight: 600,
                      "&:hover": { bgcolor: "#16a34a" },
                      "&.Mui-disabled": { bgcolor: "rgba(34,197,94,0.3)" },
                    }}
                  >
                    {submitting ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : "Claim & Create Account"}
                  </Button>
                </Box>
              </Box>
            )}
          </>
        )}

        {linkData.status === "claimed" && (
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: isDark ? "rgba(139,92,246,0.06)" : "rgba(139,92,246,0.04)", border: `1px solid ${isDark ? "rgba(139,92,246,0.15)" : "rgba(139,92,246,0.1)"}`, mb: 2, textAlign: "center" }}>
            <Typography sx={{ color: textPrimary, fontSize: 14, fontWeight: 600, mb: 0.5 }}>
              Funds have been claimed
            </Typography>
            <Typography sx={{ color: textSecondary, fontSize: 12, mb: 1.5 }}>
              {linkData.claimed_at ? `Claimed on ${new Date(linkData.claimed_at).toLocaleString()}` : ""}
            </Typography>
            <Button variant="contained" size="small" onClick={() => router.push("/auth/login")} sx={{ bgcolor: theme.palette.primary.main }}>
              Sign In to Dashboard
            </Button>
          </Box>
        )}

        {linkData.status === "expired" && (
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: isDark ? "rgba(239,68,68,0.06)" : "rgba(239,68,68,0.04)", border: `1px solid ${isDark ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.1)"}`, textAlign: "center" }}>
            <Typography sx={{ color: textPrimary, fontSize: 14, fontWeight: 600 }}>
              This payment link has expired
            </Typography>
            <Typography sx={{ color: textSecondary, fontSize: 12, mt: 0.5 }}>
              Create a new payment link to accept payments.
            </Typography>
          </Box>
        )}

        <Snackbar open={!!copied} autoHideDuration={2000} onClose={() => setCopied(null)}>
          <Alert severity="success" onClose={() => setCopied(null)}>{copied} copied!</Alert>
        </Snackbar>
      </Paper>
    </Box>
  );
}

// Mark as public page — no auth required, no layout wrapper
ManageTrialLinkPage.layout = "none" as const;
