import { homeTheme } from "@/styles/homeTheme";
import { Box, Typography, styled } from "@mui/material";

export const Wrapper = styled(Box)(() => ({
  width: "100%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  textAlign: "center",
  "&[data-align='start']": {
    alignItems: "flex-start",
    textAlign: "left",
  },
}));

export const Badge = styled(Box)(() => ({
  textAlign: "center",
  width: "fit-content",
  fontSize: 14,
  lineHeight: "20px",
  letterSpacing: "0px !important",
  fontWeight: 500,
  fontFamily: "OutfitMedium",
  color: homeTheme.palette.primary.main,
  backgroundColor: homeTheme.palette.background.default,
  padding: "6px 16px",
  borderRadius: "9999px",
  alignSelf: "center",
  "&[data-align='start']": {
    alignSelf: "flex-start",
    textAlign: "left",
  },
}));

export const Heading = styled(Typography)(({ theme }) => ({
  fontWeight: 500,
  fontFamily: "OutfitMedium",
  color: homeTheme.palette.text.primary,
  padding: "0 15px",
  textAlign: "center",
  "&[data-align='start']": {
    textAlign: "left",
  },

  "&[data-type='large']": {
    fontSize: "60px",
    lineHeight: "60px",
    maxWidth: 705,
    marginTop: "24px",
    marginBottom: "15px",
  },

  "&[data-type='small']": {
    fontSize: "36px",
    lineHeight: "40px",
    maxWidth: "auto",
    marginTop: "16px",
    marginBottom: "16px",
  },

  [theme.breakpoints.down("md")]: {
    "&[data-type='large']": {
      fontSize: "45px",
      lineHeight: "48px",
    },
    "&[data-type='small']": {
      fontSize: "36px",
      lineHeight: "40px",
    },
  },
}));

export const SubText = styled(Typography)(({ theme }) => ({
  padding: 0,
  fontWeight: 400,
  letterSpacing: "0px !important",
  fontFamily: "OutfitRegular",
  color: homeTheme.palette.text.secondary,
  textAlign: "center",
  "&[data-align='start']": {
    textAlign: "left",
  },

  "&[data-type='large']": {
    fontSize: "18px",
    lineHeight: "28px",
    maxWidth: 500,
  },

  "&[data-type='small']": {
    fontSize: "16px",
    lineHeight: "24px",
    maxWidth: 576,
  },

  [theme.breakpoints.down("md")]: {
    "&[data-type='large']": {
      fontSize: "18px",
      lineHeight: "28px",
    },
    "&[data-type='small']": {
      fontSize: "16px",
      lineHeight: "24px",
    },
  },
}));

export const HighlightText = styled("span")(() => ({
  background: "linear-gradient(90deg, #0004FF 0%, #6A4DFF 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  color: "transparent",
  fontWeight: 500,
}));
