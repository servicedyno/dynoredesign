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
  flexDirection: "row",
  alignItems: "stretch",
  width: "100%",
  maxWidth: "1060px",
  minHeight: "min(720px, calc(100dvh - 80px))",
  maxHeight: "calc(100dvh - 80px)",
  margin: "auto",
  background: theme.palette.mode === "dark" ? "#0B0D17" : "#f4f6fa",
  borderRadius: "16px",
  overflow: "hidden",
  boxShadow:
    theme.palette.mode === "dark"
      ? "0 4px 40px rgba(0,0,0,0.4)"
      : "0 4px 40px rgba(47,47,101,0.12)",
  border: `1px solid ${theme.palette.mode === "dark" ? "#1f2237" : "#e2e5ed"}`,

  [theme.breakpoints.down("lg")]: {
    flexDirection: "column",
    maxWidth: "520px",
    minHeight: "auto",
    maxHeight: "none",
    margin: "24px auto",
    borderRadius: "16px",
  },

  [theme.breakpoints.down("sm")]: {
    margin: "16px auto",
    borderRadius: "12px",
  },
}));

/** Page-level background wrapper */
export const AuthPageBackground = styled(Box)(({ theme }) => ({
  width: "100%",
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
  background: theme.palette.mode === "dark" ? "#080A14" : "#f0f2f7",
  padding: "40px 24px",
  boxSizing: "border-box",

  [theme.breakpoints.down("sm")]: {
    padding: "0",
    background: theme.palette.mode === "dark" ? "#0B0D17" : "#f4f6fa",
  },
}));

export const BrandPanel = styled(Box)(({ theme }) => ({
  flex: "0 0 48%",
  maxWidth: "48%",
  position: "relative",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  background: "#6C5CE7",

  [theme.breakpoints.down("lg")]: {
    display: "none",
  },
}));

export const FormPanel = styled(Box)(({ theme }) => ({
  flex: 1,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "32px 40px",
  overflow: "auto",
  background: theme.palette.mode === "dark" ? "#0B0D17" : "#fff",
  scrollbarWidth: "none",
  "&::-webkit-scrollbar": { display: "none" },

  [theme.breakpoints.down("md")]: {
    padding: "24px 20px",
  },

  [theme.breakpoints.down("sm")]: {
    padding: "20px 16px",
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
  borderRadius: "12px",
  padding: "8px",
  background: theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.015)",
  textAlign: "center",
  border: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "#E9ECF2"}`,
  boxShadow: "none",

  [theme.breakpoints.down("sm")]: {
    padding: "12px",
    width: "100%",
    borderRadius: "10px",
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
