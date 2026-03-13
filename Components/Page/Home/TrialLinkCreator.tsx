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
  manage_url: string;
  slug: string;
  amount: number;
  currency: string;
}

const TrialLinkCreator: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
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
    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address");
      return;
    }
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
        email: email.trim(),
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

  // Shared input styling
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

  // Success state — clean confirmation, no token to save
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
        <Box sx={{ textAlign: "center", mb: 2.5 }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              bgcolor: "rgba(71,180,100,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mx: "auto",
              mb: 1.5,
            }}
          >
            <Icon icon="mdi:check-circle" width={30} color="#47B464" />
          </Box>
          <Typography sx={{ color: textPrimary, fontWeight: 700, fontSize: 18 }}>
            Payment Link Created!
          </Typography>
          <Typography sx={{ color: textSecondary, fontSize: 13, mt: 0.5 }}>
            {currencySymbol}{result.amount.toFixed(2)} {result.currency}
          </Typography>
        </Box>

        {/* Payment Link — share with customer */}
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ color: textSecondary, fontSize: 12, mb: 0.5, fontWeight: 600 }}>
            Payment Link
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              p: 1,
              borderRadius: 1.5,
              bgcolor: fieldBg,
              border: `1px solid ${borderColor}`,
            }}
          >
            <Typography
              sx={{
                color: textSecondary,
                fontSize: 12,
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {result.link_url}
            </Typography>
            <IconButton
              size="small"
              onClick={() => copyToClipboard(result.link_url, "Payment link")}
              sx={{ color: theme.palette.primary.main }}
            >
              <Icon icon="mdi:content-copy" width={16} />
            </IconButton>
          </Box>
        </Box>

        {/* Email confirmation notice */}
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 1.5,
            p: 1.5,
            borderRadius: 2,
            bgcolor: isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.06)",
            border: `1px solid ${isDark ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.12)"}`,
            mb: 2,
          }}
        >
          <Icon icon="mdi:email-check-outline" width={20} color={isDark ? "#818cf8" : "#6366f1"} style={{ marginTop: 2, flexShrink: 0 }} />
          <Box>
            <Typography sx={{ color: textPrimary, fontSize: 13, fontWeight: 600 }}>
              Management link sent to your email
            </Typography>
            <Typography sx={{ color: textSecondary, fontSize: 12, mt: 0.3 }}>
              Check your inbox to track payment status and claim funds when paid. No tokens to save!
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="outlined"
            fullWidth
            size="small"
            onClick={() => {
              setResult(null);
              setAmount("");
              setDescription("");
              setEmail("");
            }}
            sx={{
              borderColor,
              color: textSecondary,
              fontSize: 13,
              "&:hover": { borderColor: theme.palette.primary.main },
            }}
          >
            Create Another
          </Button>
          <Button
            variant="contained"
            fullWidth
            size="small"
            onClick={() => copyToClipboard(result.link_url, "Payment link")}
            sx={{
              bgcolor: theme.palette.primary.main,
              fontSize: 13,
              "&:hover": { bgcolor: isDark ? "#5563e0" : "#0003cc" },
            }}
          >
            Copy Link
          </Button>
        </Box>

        <Snackbar open={!!copied} autoHideDuration={2000} onClose={() => setCopied(null)}>
          <Alert severity="success" onClose={() => setCopied(null)}>
            {copied} copied!
          </Alert>
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
        No account needed. We'll email you a link to manage it.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2, fontSize: 13 }}>
          {error}
        </Alert>
      )}

      {/* Email */}
      <TextField
        label="Your Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        fullWidth
        size="small"
        sx={{ mb: 2, ...inputSx }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Icon icon="mdi:email-outline" width={18} color={isDark ? "#676768" : "#9ca3af"} />
            </InputAdornment>
          ),
        }}
      />

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
            startAdornment: (
              <InputAdornment position="start">
                <Typography sx={{ color: textSecondary }}>{currencySymbol}</Typography>
              </InputAdornment>
            ),
          }}
          sx={inputSx}
        />
        <Select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          size="small"
          sx={{
            minWidth: 90,
            bgcolor: fieldBg,
            color: textPrimary,
            "& .MuiOutlinedInput-notchedOutline": { borderColor },
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: theme.palette.primary.main },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: theme.palette.primary.main },
            "& .MuiSelect-icon": { color: textSecondary },
          }}
        >
          {CURRENCIES.map((c) => (
            <MenuItem key={c.code} value={c.code}>
              {c.code}
            </MenuItem>
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
        sx={{ mb: 2, ...inputSx }}
      />

      <Button
        variant="contained"
        fullWidth
        onClick={handleCreate}
        disabled={loading || !amount || !email}
        sx={{
          bgcolor: theme.palette.primary.main,
          py: 1.2,
          fontSize: 15,
          fontWeight: 600,
          borderRadius: 2,
          "&:hover": { bgcolor: isDark ? "#5563e0" : "#0003cc" },
          "&.Mui-disabled": {
            bgcolor: isDark ? "#0004FF60" : `${theme.palette.primary.main}40`,
            color: isDark ? "#fff8" : `${textPrimary}80`,
          },
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
