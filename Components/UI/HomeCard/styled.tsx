import { getBrowser } from "@/hooks/useDevice";
import { homeTheme } from "@/styles/homeTheme";
import { theme } from "@/styles/theme";
import { Box, Card, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

interface StyledCardProps {
  height?: number | string;
  width?: number | string;
}

// HomeCard
export const StyledCard = styled(Card)(({ theme }) => {
  const { isDesktopSafari } =
    typeof window !== "undefined" ? getBrowser() : { isDesktopSafari: false };

  return {
    backgroundColor: theme.palette.common.white,
    border: `1px solid ${homeTheme.palette.border.main}`,
    boxShadow: "none !important",
    borderRadius: "20px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    position: "relative",

    "&::before": {
      content: '""',
      position: "absolute",
      bottom: 0,
      top: isDesktopSafari ? "180px" : "220px",
      width: "100%",
      height: "120%",
      background: isDesktopSafari
        ? "radial-gradient(ellipse at bottom, rgba(0,4,255,0.45) 0%, #FFFFFF 70%)"
        : "radial-gradient(at center bottom, #0004FF4D, #FFFFFF)",
      filter: isDesktopSafari ? "blur(140px)" : "blur(100px)",
      opacity: isDesktopSafari ? 0.7 : 0.5,
      zIndex: 0,
      pointerEvents: "none",
    },

    "& > *": {
      position: "relative",
      zIndex: 1,
    },

    [theme.breakpoints.down("md")]: {
      height: "auto",
    },
  };
});

export const CardBody = styled(Box)(() => ({
  flex: 1,
}));

export const GoLiveCount = styled(Typography)(({ theme }) => ({
  fontSize: "48px",
  fontWeight: 500,
  lineHeight: "48px",
  letterSpacing: 0,
  fontFamily: "OutfitMedium",
  color: theme.palette.primary.main,
  opacity: 0.2,
}));

export const FeatureTitle = styled(Typography)(({ theme }) => ({
  fontSize: "18px",
  fontWeight: 500,
  lineHeight: "28px",
  letterSpacing: 0,
  fontFamily: "OutfitMedium",
  color: theme.palette.text.primary,
}));

export const GoLiveDescription = styled(Typography)(({ theme }) => ({
  fontSize: "14px",
  fontWeight: 400,
  lineHeight: "20px",
  letterSpacing: 0,
  fontFamily: "OutfitRegular",
  color: theme.palette.text.secondary,
}));

export const FeatureIcon = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "48px",
  height: "48px",
  minHeight: "48px",
  minWidth: "48px",
  borderRadius: "16px",
  background: homeTheme.palette.background.default,
}));

export const WhyChooseUsCard = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  textAlign: "center",
  flexDirection: "column",
  width: "100%",
  height: "100%",
  minWidth: "328px",
  minHeight: "218px",
  padding: "25px",
  background: theme.palette.primary.contrastText,
  border: `1px solid #E7E8EF`,
  boxShadow: "none !important",
  borderRadius: "20px",
  margin: "0 auto",
  [theme.breakpoints.up("md")]: {
    minWidth: "294px",
    maxWidth: "294px",
    minHeight: "218px",
    maxHeight: "218px",
  },
}));

export const WhyChooseDynoPayTitle = styled(Typography)(() => ({
  fontSize: "18px",
  fontWeight: 500,
  lineHeight: "28px",
  fontStyle: "semibold",
  letterSpacing: 0,
  textAlign: "center",
  fontFamily: "OutfitMedium",
  color: homeTheme.palette.text.primary,
}));

export const WhyChooseDynoPayDescription = styled(Typography)(() => ({
  fontSize: "14px",
  fontWeight: 400,
  lineHeight: "20px",
  letterSpacing: 0,
  textAlign: "center",
  fontFamily: "OutfitRegular",
  color: homeTheme.palette.text.secondary,
}));

export const WhyChooseDynoPayIcon = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "56px",
  height: "56px",
  minHeight: "56px",
  minWidth: "56px",
  borderRadius: "20px",
  background: "#0004FF1A",
}));

export const CardHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: theme.spacing(2.5, 2.5, 0, 2.5),
  gap: theme.spacing(2),
  position: "relative",
  [theme.breakpoints.down("md")]: {
    padding: theme.spacing(2, 2, 0, 2),
  },
}));

export const HeaderContent = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flex: 1,
});

export const HeaderTitle = styled(Typography)({
  fontSize: "20px",
  fontWeight: 500,
  lineHeight: 1.2,
  letterSpacing: "-0.02em",
  fontFamily: "OutfitMedium",
  color: "#242428",
  [theme.breakpoints.down("md")]: {
    fontSize: "15px",
  },
});

export const HeaderIcon = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "40px",
  height: "40px",
  borderRadius: "50%",
  background: theme.palette.grey[100],
  color: theme.palette.text.secondary,
  "& svg": {
    fontSize: "20px",
  },
}));

export const CardFooter = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  padding: theme.spacing(2, 3),
  borderTop: `1px solid ${theme.palette.border.main}`,
  gap: theme.spacing(1.5),
}));

export const HeaderSubTitle = styled(Typography)(({ theme }) => ({
  fontSize: "13px",
  fontWeight: 400,
  lineHeight: 1.2,
  letterSpacing: "-0.02em",
  color: theme.palette.text.secondary,
  fontFamily: "OutfitRegular",
}));

export const SuccessChip = styled(Box)(({ theme }) => ({
  backgroundColor: "#22C55E1A",
  height: "50px",
  width: "100%",
  border: "1px solid",
  borderColor: "#22C55E33",
  borderRadius: "9999px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "12px",
}));

export const TypographyTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  fontFamily: "OutfitSemiBold",
  lineHeight: "24px",
  letterSpacing: 0,
  color: "#131520",
}));

export const TypographyDescription = styled(Typography)(({ theme }) => ({
  fontSize: "14px",
  fontFamily: "OutfitRegular",
  fontWeight: 400,
  lineHeight: "20px",
  letterSpacing: 0,
  color: "#676B7E",
}));

export const TypographyTime = styled(Typography)(({ theme }) => ({
  fontSize: "12px",
  fontFamily: "OutfitRegular",
  fontWeight: 400,
  lineHeight: "16px",
  letterSpacing: 0,
  color: "#676B7E",
}));
