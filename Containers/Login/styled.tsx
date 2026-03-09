import { Box, Card, styled } from "@mui/material";

export const LoginWrapper = styled(Box)(({ theme }) => ({
  background: theme.palette.mode === "dark" ? "#0B0D17" : "#f4f6fa",
  width: "100%",
  height: "100dvh",
  minHeight: "100dvh",
  position: "relative",
  overflow: "auto",
}));

export const ContentWrapper = styled(Box)(() => ({
  position: "relative",
  zIndex: 20,
  width: "100%",
  maxWidth: "100%",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "60px 16px 40px 16px",
  minHeight: "100dvh",
  boxSizing: "border-box",
  scrollbarWidth: "none",
  "&::-webkit-scrollbar": {
    display: "none",
  },
}));

/* ── New Split Layout ────────────────────────────────── */

export const SplitLayoutWrapper = styled(Box)(({ theme }) => ({
  display: "flex",
  width: "100%",
  minHeight: "100dvh",
  background: theme.palette.mode === "dark" ? "#0B0D17" : "#f4f6fa",

  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
  },
}));

export const BrandPanel = styled(Box)(({ theme }) => ({
  flex: "0 0 44%",
  position: "relative",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  padding: "60px 48px",
  overflow: "hidden",
  background:
    theme.palette.mode === "dark"
      ? "linear-gradient(145deg, #0f1128 0%, #1a1040 40%, #0d2847 100%)"
      : "linear-gradient(145deg, #1a1040 0%, #2d1b69 40%, #1e3a5f 100%)",
  color: "#fff",

  "&::before": {
    content: '""',
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage:
      'url("https://images.unsplash.com/photo-1579547621113-e4bb2a19bdd6?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGdlb21ldHJpY3xlbnwwfHx8Ymx1ZXwxNzczMDQ1MDE4fDA&ixlib=rb-4.1.0&q=85&w=800")',
    backgroundSize: "cover",
    backgroundPosition: "center",
    opacity: 0.15,
    zIndex: 0,
  },

  "& > *": {
    position: "relative",
    zIndex: 1,
  },

  [theme.breakpoints.down("md")]: {
    flex: "none",
    padding: "36px 24px 28px",
    minHeight: "auto",
  },
}));

export const FormPanel = styled(Box)(({ theme }) => ({
  flex: 1,
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  padding: "40px 48px",
  overflow: "auto",
  minHeight: "100dvh",
  background: theme.palette.mode === "dark" ? "#0B0D17" : "#f4f6fa",
  scrollbarWidth: "none",
  "&::-webkit-scrollbar": { display: "none" },

  [theme.breakpoints.down("md")]: {
    padding: "24px 16px 40px",
    minHeight: "auto",
    alignItems: "flex-start",
  },
}));

/* ── Original components (kept for backwards compat) ─── */

export const AuthContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-start",
  alignItems: "center",
  gap: "24px",
  overflow: "visible",
  position: "relative",
  zIndex: 1,
  padding: "0",
  width: "100%",
  maxWidth: "480px",

  [theme.breakpoints.down("sm")]: {
    gap: "16px",
    padding: "0",
    width: "100%",
  },
}));

export const CardWrapper = styled(Card)(({ theme }) => ({
  width: "100%",
  maxWidth: "480px",
  height: "fit-content",
  borderRadius: "16px",
  padding: "8px",
  background: theme.palette.background.paper,
  textAlign: "center",
  border: `1px solid ${theme.palette.mode === "dark" ? "#1f2237" : "#E9ECF2"}`,
  boxShadow:
    theme.palette.mode === "dark"
      ? "0 2px 12px rgba(0,0,0,0.3)"
      : "0 2px 12px rgba(47,47,101,0.08)",

  [theme.breakpoints.down("sm")]: {
    padding: "16px",
    width: "100%",
    borderRadius: "12px",
  },
}));

export const ImageCenter = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  height: "100%",
  cursor: "pointer",
}));
