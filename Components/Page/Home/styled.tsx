import { Box } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

// HomePage
export const HomeWrapper = styled(Box)(({ theme }) => ({
  width: "100%",
  paddingTop: 65,
  [theme.breakpoints.down("md")]: {
    paddingTop: 76,
  },
}));

export const HomeContainer = styled(Box)(({ theme }) => ({
  width: "100%",
  maxWidth: 1280,
  margin: "0 auto",
  paddingLeft: theme.spacing(3),
  paddingRight: theme.spacing(3),
}));

export const HomeFullWidthContainer = styled(Box)(({ theme }) => ({
  width: "100%",
  margin: "0 auto",
  paddingLeft: theme.spacing(3),
  paddingRight: theme.spacing(3),
  backgroundColor: alpha(theme.palette.background.default, 0.3),
}));

// HeroSection
export const Root = styled(Box)(() => ({
  width: "100%",
}));

export const TopSection = styled(Box)(({ theme }) => ({
  paddingTop: "32px",
  zIndex: 20,
  [theme.breakpoints.up("sm")]: {
    paddingTop: "48px",
  },
  [theme.breakpoints.up("md")]: {
    paddingTop: "72px",
  },
  [theme.breakpoints.up("lg")]: {
    paddingTop: "88px",
  },
}));

export const TitleArea = styled(Box)(() => ({
  position: "relative",
}));

export const ButtonsRow = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: 10,
  marginTop: 24,
  justifyContent: "center",
  zIndex: 10,
  [theme.breakpoints.up("sm")]: {
    flexDirection: "row",
    gap: theme.spacing(2),
  },
}));
