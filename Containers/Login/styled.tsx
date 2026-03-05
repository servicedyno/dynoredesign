import { Box, Card, styled } from "@mui/material";

export const LoginWrapper = styled(Box)(() => ({
  background: "#f4f6fa",
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

export const AuthContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-start",
  alignItems: "center",
  gap: "30px",
  overflow: "visible",
  position: "relative",
  zIndex: 1,
  padding: "0",
  width: "100%",
  maxWidth: "536px",

  [theme.breakpoints.down("sm")]: {
    gap: "16px",
    padding: "0",
    width: "100%",
  },
}));

export const CardWrapper = styled(Card)(({ theme }) => ({
  width: "536px",
  height: "fit-content",
  borderRadius: "14px",
  padding: "8px",
  background: "#fff",
  textAlign: "center",
  border: "1px solid #E9ECF2",
  boxShadow: "rgba(47, 47, 101, 0.15) 0 4px 16px 0",

  [theme.breakpoints.down("sm")]: {
    padding: "16px",
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
