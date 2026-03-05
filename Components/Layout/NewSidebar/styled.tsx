import { styled } from "@mui/material";

export const SidebarWrapper = styled("aside")(({ theme }) => ({
  height: "100%",
  background: theme.palette.common.white,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  borderRadius: "14px",
  border: `1px solid ${theme.palette.border.main}`,
  padding: "16px",
  overflow: "auto",
  scrollbarWidth: "none",
}));

export const Menu = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  background: theme.palette.common.white,
  borderRadius: "12px",
}));

export const MenuItem = styled("div", {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active?: boolean }>(
  ({ active, theme }) => ({
    display: "flex",
    alignItems: "center",
    gap: "10px",
    maxHeight: "44px",
    padding: "10px 14px",
    borderRadius: "7px",
    cursor: "pointer",
    background: active ? theme.palette.primary.light : "transparent",
    fontSize: "14px",
    fontWeight: 500,
    color: active ? theme.palette.primary.main : theme.palette.text.primary,
    transition: "all 0.2s ease",
    position: "relative",

    "&:hover": {
      background: theme.palette.primary.light,
    },
  }),
);

export const ActiveIndicator = styled("div", {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active?: boolean }>(
  ({ active, theme }) => ({
    position: "absolute",
    left: "-16px",
    top: 0,
    bottom: 0,
    width: "6px",
    background: active ? theme.palette.primary.main : "transparent",
    borderRadius: "0 7px 7px 0",
    transition: "all 0.2s ease",
  }),
);

export const IconBox = styled("div", {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active?: boolean }>(
  ({ active, theme }) => ({
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "26px",
    height: "26px",
    borderRadius: "6px",
    background: active ? theme.palette.primary.light : "transparent",

    "& img": {
      filter: active
        ? "brightness(0) saturate(100%) invert(13%) sepia(94%) saturate(7151%) hue-rotate(240deg) brightness(101%) contrast(150%)"
        : "brightness(0) saturate(100%) invert(15%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(95%) contrast(100%)",
    },
  }),
);

export const SidebarFooter = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  [theme.breakpoints.down("md")]: {
    gap: "10px",
  },
}));

export const HelpSupportBtn = styled("button")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  padding: "12px 14px",
  maxHeight: "40px",
  borderRadius: "6px",
  cursor: "pointer",
  background: theme.palette.common.white,
  border: `1px solid ${theme.palette.border.main}`,
  fontWeight: 500,
  color: theme.palette.text.secondary,
}));

export const KnowledgeBaseTitle = styled("div")(({ theme }) => ({
  fontSize: "15px",
  fontFamily: "UrbanistMedium",
  fontWeight: 500,
  color: theme.palette.text.secondary,
  [theme.breakpoints.down("md")]: {
    fontSize: "13px",
  },
}));

export const ReferralCard = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  padding: "24px 20px",
  borderRadius: "12px",
  border: `1px solid ${theme.palette.border.main}`,
  fontWeight: 500,
  color: theme.palette.text.secondary,
  background: theme.palette.secondary.main,
  position: "relative",
  [theme.breakpoints.down("md")]: {
    padding: "13px 14px 13px 14px",
  },
}));

export const ReferralCardTitle = styled("div")(({ theme }) => ({
  fontSize: "15px",
  fontWeight: 500,
  fontFamily: "UrbanistMedium",
  color: theme.palette.text.primary,
  [theme.breakpoints.down("md")]: {
    fontSize: "13px",
  },
  lineHeight: "1.2",
  letterSpacing: "0",
}));

export const ReferralCardContent = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  zIndex: 1,
  color: theme.palette.text.primary,
  position: "relative",
  [theme.breakpoints.down("md")]: {
    gap: "6.41px",
  },
}));

export const ReferralCardContentValueContainer = styled("div")(({ theme }) => ({
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
}));

export const ReferralCardContentValue = styled("span")(({ theme }) => ({
  borderRadius: "7px",
  padding: "11px",
  border: `1px dashed ${theme.palette.border.main}`,
  background: theme.palette.common.white,
  fontSize: "15px",
  fontWeight: 500,
  fontFamily: "UrbanistMedium",
  color: theme.palette.primary.main,
  flex: 1,
  lineHeight: 1.2,
  maxHeight: "40px",
  [theme.breakpoints.down("md")]: {
    fontSize: "13px",
    padding: "8px 10px",
    maxHeight: "32px",
  },
}));

export const CopyButton = styled("button")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "40px",
  height: "40px",
  padding: "6px",
  borderRadius: "7px",
  border: `1px solid ${theme.palette.primary.main}`,
  backgroundColor: theme.palette.common.white,
  cursor: "pointer",
  transition: "all 0.2s ease",
  "&:hover": {
    backgroundColor: theme.palette.primary.light,
  },
  "&:active": {
    transform: "scale(0.95)",
  },
  [theme.breakpoints.down("md")]: {
    width: "32px",
    height: "32px",
    padding: "6px",
  },
}));
