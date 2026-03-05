import { Box, styled, Typography } from "@mui/material";

export const WrapperBox = styled(Box)(() => ({
  position: "relative",
  width: "fit-content",
}));

export const TriggerBox = styled(Box)(() => ({
  border: "1px solid #e8f0ff",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderRadius: 6,
  cursor: "pointer",
  backgroundColor: "#fff",

  "&:focus-visible": {
    outline: "2px solid #1976d2",
    outlineOffset: 2,
  },
}));

export const TriggerLeft = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  gap: 6,
}));

export const TriggerRight = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: 14,

  [theme.breakpoints.down("md")]: {
    gap: 10,
  },
}));

export const TriggerDivider = styled(Box)(() => ({
  width: 1,
  background: "#D9D9D9",
}));

export const DropdownContainer = styled(Box)(() => ({
  position: "absolute",
  top: 0,
  right: 0,
  width: 169,
  border: "1px solid #e8f0ff",
  backgroundColor: "#fff",
  zIndex: 2000,
  padding: "10px 6px 6px",
  boxShadow: "0px 8px 24px rgba(0, 0, 0, 0.08)",
  borderRadius: 6,
}));

export const DropdownHeader = styled(Box)(() => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0px 8px 12px",
  cursor: "pointer",
}));

export const HeaderSelectedLeft = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  gap: 6,
}));

export const HeaderRight = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  gap: 14,
}));

export const HeaderDivider = styled(Box)(({ theme }) => ({
  width: 1,
  background: "#ddd",
  height: 16,

  [theme.breakpoints.down("md")]: {
    height: 14,
  },
}));

export const DropdownListItem = styled(Box)(() => ({
  padding: 7,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderRadius: 63,
  cursor: "pointer",
  marginBottom: 6,
  transition: "background 0.2s ease",

  "&[data-selected='true']": {
    background: "#E8F0FF",
  },

  "&:hover": {
    background: "#e8f0ff",
  },

  "&:focus-visible": {
    outline: "2px solid #1976d2",
    outlineOffset: 2,
  },
}));

export const ListItemLeft = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  gap: 6,
}));

export const LangTextDesktop = styled(Typography)(({ theme }) => ({
  fontSize: 15,
  fontWeight: 500,
  fontFamily: "UrbanistMedium",
  lineHeight: 1.2,
  letterSpacing: 0,
  paddingTop: 0,

  [theme.breakpoints.down("md")]: {
    lineHeight: "100%",
    paddingTop: 2.5,
  },
}));

export const LangTextMobile = styled(Typography)(({ theme }) => ({
  fontSize: 10.5,
  fontWeight: 500,
  fontFamily: "UrbanistMedium",
  lineHeight: "100%",
  letterSpacing: 0,
  paddingTop: 2.5,

  [theme.breakpoints.up("md")]: {
    fontSize: 15,
    lineHeight: 1.2,
    paddingTop: 0,
  },
}));

export const ExpandIconBox = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
}));

export const CheckIconBox = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  minWidth: 11,
  justifyContent: "flex-end",
}));
