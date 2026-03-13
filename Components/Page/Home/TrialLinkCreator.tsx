import React, { useState } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Paper,
  IconButton,
  Snackbar,
  Alert,
  InputAdornment,
  Select,
  MenuItem,
  useTheme,
} from "@mui/material";
import { Icon } from "@iconify/react";
import axiosBaseApi from "@/axiosConfig";

const CURRENCIES = [
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "\u20ac" },
  { code: "GBP", symbol: "\u00a3" },
];

interface TrialLinkResult {
  link_url: string;
  slug: string;
  claim_token: string;
  amount: number;
  currency: string;
}

const TrialLinkCreator: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrialLinkResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Theme-derived colors
  const paperBg = theme.palette.background.paper;
  const fieldBg = theme.palette.background.default;
  const borderColor = isDark ? "#1e1f2e" : theme.palette.divider;
  const textPrimary = theme.palette.text.primary;
  const textSecondary = theme.palette.text.secondary;
  const textMuted = isDark ? "#3a3a4a" : theme.palette.text.secondary;

  const handleCreate = async () => {
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) < 5) {
      setError("Please enter an amount of at least $5");
      return;
    }
    if (parseFloat(amount) > 500) {
      setError("Maximum amount is $500 for trial links");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await axiosBaseApi.post("public/create-trial-link", {
        amount: parseFloat(amount),
        currency,
        description: description || undefined,
      });
      setResult(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
  };

  const currencySymbol = CURRENCIES.find(c => c.code === currency)?.symbol || "$";

  // Success state — show generated link
  if (result) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          maxWidth: 440,
          width: "100%",
          bgcolor: paperBg,
          borderRadius: 3,
          border: `1px solid ${borderColor}`,
        }}
      >
        <Box sx={{ textAlign: "center", mb: 2 }}>
          <Box sx={{ width: 48, height: 48, borderRadius: "50%", bgcolor: "rgba(71,180,100,0.15)", display: "flex", alignItems: "center", justifyContent: "center", mx: "auto", mb: 1.5 }}>
            <Icon icon="mdi:check-circle" width={28} color="#47B464" />
          </Box>
          <Typography sx={{ color: textPrimary, fontWeight: 700, fontSize: 18 }}>Payment Link Created!</Typography>
          <Typography sx={{ color: textSecondary, fontSize: 13, mt: 0.5 }}>
            {currencySymbol}{result.amount.toFixed(2)} {result.currency}
          </Typography>
        </Box>

        {/* Payment Link */}
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ color: textSecondary, fontSize: 12, mb: 0.5 }}>Payment Link</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, borderRadius: 1.5, bgcolor: fieldBg, border: `1px solid ${borderColor}` }}>
            <Typography sx={{ color: textSecondary, fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {result.link_url}
            </Typography>
            <IconButton size="small" onClick={() => copyToClipboard(result.link_url, "Link")} sx={{ color: theme.palette.primary.main }}>
              <Icon icon="mdi:content-copy" width={16} />
            </IconButton>
          </Box>
        </Box>

        {/* Claim Token */}
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ color: textSecondary, fontSize: 12, mb: 0.5 }}>Claim Token (save this!)</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, borderRadius: 1.5, bgcolor: fieldBg, border: "1px solid rgba(245,166,35,0.3)" }}>
            <Typography sx={{ color: "#F5A623", fontSize: 11, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>
              {result.claim_token}
            </Typography>
            <IconButton size="small" onClick={() => copyToClipboard(result.claim_token, "Token")} sx={{ color: "#F5A623" }}>
              <Icon icon="mdi:content-copy" width={16} />
            </IconButton>
          </Box>
          <Typography sx={{ color: "#E8484A", fontSize: 11, mt: 0.5, display: "flex", alignItems: "center", gap: 0.5 }}>
            <Icon icon="mdi:alert-circle-outline" width={13} /> Save this token! You'll need it to claim your funds.
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
          <Button
            variant="outlined"
            fullWidth
            size="small"
            onClick={() => { setResult(null); setAmount(""); setDescription(""); }}
            sx={{ borderColor: borderColor, color: textSecondary, fontSize: 13, "&:hover": { borderColor: theme.palette.primary.main } }}
          >
            Create Another
          </Button>
          <Button
            variant="contained"
            fullWidth
            size="small"
            onClick={() => window.open(result.link_url, "_blank")}
            sx={{ bgcolor: theme.palette.primary.main, fontSize: 13, "&:hover": { bgcolor: isDark ? "#5563e0" : "#0003cc" } }}
          >
            Open Link
          </Button>
        </Box>

        <Snackbar open={!!copied} autoHideDuration={2000} onClose={() => setCopied(null)}>
          <Alert severity="success" onClose={() => setCopied(null)}>{copied} copied!</Alert>
        </Snackbar>
      </Paper>
    );
  }

  // Input form
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        maxWidth: 440,
        width: "100%",
        bgcolor: paperBg,
        borderRadius: 3,
        border: `1px solid ${borderColor}`,
      }}
    >
      <Typography sx={{ color: textPrimary, fontWeight: 700, fontSize: 16, mb: 0.5 }}>
        Create a Payment Link
      </Typography>
      <Typography sx={{ color: textSecondary, fontSize: 13, mb: 2 }}>
        No account needed. Generate a link in seconds.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2, fontSize: 13 }}>{error}</Alert>}

      {/* Amount + Currency */}
      <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
        <TextField
          label="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="42.00"
          fullWidth
          size="small"
          InputProps={{
            startAdornment: <InputAdornment position="start"><Typography sx={{ color: textSecondary }}>{currencySymbol}</Typography></InputAdornment>,
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              bgcolor: fieldBg,
              color: textPrimary,
              "& fieldset": { borderColor: borderColor },
              "&:hover fieldset": { borderColor: theme.palette.primary.main },
              "&.Mui-focused fieldset": { borderColor: theme.palette.primary.main },
            },
            "& .MuiInputLabel-root": { color: textSecondary },
          }}
        />
        <Select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          size="small"
          sx={{
            minWidth: 90,
            bgcolor: fieldBg,
            color: textPrimary,
            "& .MuiOutlinedInput-notchedOutline": { borderColor: borderColor },
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: theme.palette.primary.main },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: theme.palette.primary.main },
            "& .MuiSelect-icon": { color: textSecondary },
          }}
        >
          {CURRENCIES.map(c => (
            <MenuItem key={c.code} value={c.code}>{c.code}</MenuItem>
          ))}
        </Select>
      </Box>

      {/* Description */}
      <TextField
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="e.g., Web design project"
        fullWidth
        size="small"
        sx={{
          mb: 2,
          "& .MuiOutlinedInput-root": {
            bgcolor: fieldBg,
            color: textPrimary,
            "& fieldset": { borderColor: borderColor },
            "&:hover fieldset": { borderColor: theme.palette.primary.main },
            "&.Mui-focused fieldset": { borderColor: theme.palette.primary.main },
          },
          "& .MuiInputLabel-root": { color: textSecondary },
        }}
      />

      <Button
        variant="contained"
        fullWidth
        onClick={handleCreate}
        disabled={loading || !amount}
        sx={{
          bgcolor: theme.palette.primary.main,
          py: 1.2,
          fontSize: 15,
          fontWeight: 600,
          borderRadius: 2,
          "&:hover": { bgcolor: isDark ? "#5563e0" : "#0003cc" },
          "&.Mui-disabled": { bgcolor: isDark ? "#0004FF60" : `${theme.palette.primary.main}40`, color: isDark ? "#fff8" : `${textPrimary}80` },
        }}
      >
        {loading ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : "Generate Payment Link"}
      </Button>

      <Typography sx={{ color: textMuted, fontSize: 11, textAlign: "center", mt: 1.5 }}>
        Min $5 {"\u2022"} Max $500 {"\u2022"} Expires in 24h
      </Typography>
    </Paper>
  );
};

export default TrialLinkCreator;
