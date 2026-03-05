import { homeTheme } from "@/styles/homeTheme";
import { Box, Grid, Typography } from "@mui/material";
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
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
}));

export const HomeFullWidthContainer = styled(Box)(({ theme }) => ({
  width: "100%",
  margin: "0 auto",
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
  backgroundColor: alpha(homeTheme.palette.background.default, 0.3),
}));

// HeroSection
export const Root = styled(Box)(() => ({
  width: "100%",
}));

export const TopSection = styled(Box)(({ theme }) => ({
  paddingTop: "24px",
  zIndex: 20,
  [theme.breakpoints.up("sm")]: {
    paddingTop: "35px",
  },
  [theme.breakpoints.up("md")]: {
    paddingTop: "48px",
  },
  [theme.breakpoints.up("lg")]: {
    paddingTop: "63px",
  },
}));

export const TitleArea = styled(Box)(() => ({
  position: "relative",
}));

export const BitcoinFloat = styled(Box)(({ theme }) => ({
  position: "absolute",
  width: 40,
  height: 40,
  zIndex: 10,
  filter: "blur(1px)",
  animation: "heroFloatBitcoin 5s ease-in-out infinite",
  bottom: "40%",
  left: "0%",
  "& .bitcoinImg": {
    objectFit: "fill",
  },
  [theme.breakpoints.up("sm")]: {
    bottom: "10%",
    left: "5%",
  },
  [theme.breakpoints.up("md")]: {
    bottom: "15%",
    left: "15%",
  },
  [theme.breakpoints.up("lg")]: {
    bottom: "15%",
    left: "20%",
  },
  "@keyframes heroFloatBitcoin": {
    "0%, 100%": {
      transform: "translateY(0px) rotate(0deg)",
      opacity: 0.8,
    },
    "50%": {
      transform: "translateY(-20px) rotate(5deg)",
      opacity: 1,
    },
  },
}));

export const EthereumFloat = styled(Box)(({ theme }) => ({
  position: "absolute",
  width: 36,
  height: 58,
  zIndex: 10,
  filter: "blur(1px)",
  animation: "heroFloatEthereum 5s ease-in-out infinite",
  top: "0%",
  right: "0%",
  "& .ethereumImg": {
    objectFit: "cover",
  },
  [theme.breakpoints.up("sm")]: {
    top: "70%",
    bottom: "0%",
    right: "5%",
  },
  [theme.breakpoints.up("md")]: {
    top: "70%",
    bottom: "15%",
    right: "15%",
  },
  [theme.breakpoints.up("lg")]: {
    top: "70%",
    bottom: "20%",
    right: "20%",
  },
  "@keyframes heroFloatEthereum": {
    "0%, 100%": {
      transform: "translateY(0px) rotate(0deg)",
      opacity: 0.8,
    },
    "50%": {
      transform: "translateY(-25px) rotate(-5deg)",
      opacity: 1,
    },
  },
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

export const DesktopShowcase = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(8),
  marginBottom: theme.spacing(8),
  position: "relative",
  alignItems: "center",
  justifyContent: "center",
  display: "none",
  [theme.breakpoints.up("md")]: {
    display: "flex",
  },
  "&:before": {
    content: '""',
    position: "absolute",
    top: "-10%",
    left: 0,
    width: "100%",
    height: "110%",
    backgroundColor: alpha(homeTheme.palette.primary.main, 0.05),
    filter: "blur(100px)",
    borderRadius: "1000px",
    zIndex: 0,
  },
}));

export const DashboardDesktopStage = styled(Box)(({ theme }) => ({
  position: "relative",
  width: "100%",
  height: 400,
  zIndex: 2,
  [theme.breakpoints.up("lg")]: {
    height: 487,
  },
}));

export const DashboardDesktopBox = styled(Box)(() => ({
  position: "relative",
  width: "100%",
  height: "100%",
  zIndex: 1,
  "& .dashboardDesktopImg": {
    objectFit: "contain",
    transform: "scale(1.2)",
  },
}));

export const LitecoinDesktopFloat = styled(Box)(() => ({
  position: "absolute",
  top: -50,
  left: "30%",
  width: 97,
  height: 97,
  zIndex: 0,
  pointerEvents: "none",
  filter: "blur(3px)",
  opacity: 0.8,
  animation: "heroFloatLitecoinDesktop 6s ease-in-out infinite",
  "& .litecoinDesktopImg": {
    objectFit: "contain",
    opacity: 0.8,
  },
  "@keyframes heroFloatLitecoinDesktop": {
    "0%, 100%": {
      transform: "translateY(0px) translateX(0px) rotate(0deg)",
      opacity: 0.8,
    },
    "33%": {
      transform: "translateY(-15px) translateX(10px) rotate(3deg)",
      opacity: 1,
    },
    "66%": {
      transform: "translateY(10px) translateX(-10px) rotate(-3deg)",
      opacity: 0.9,
    },
  },
}));

export const WalletCard = styled(Box)(({ theme }) => ({
  position: "absolute",
  top: "50%",
  left: 0,
  transform: "translate(-5%, -25%)",
  width: 200,
  height: 120,
  zIndex: 3,
  display: "none",
  borderRadius: 16,
  boxShadow: "0px 3.24px 24.89px rgba(18, 19, 92, 0.16)",
  [theme.breakpoints.up("md")]: {
    display: "block",
  },
  [theme.breakpoints.up("lg")]: {
    width: 258,
    height: 168,
  },
  "& .walletImg": {
    objectFit: "fill",
    transform: "scale(1.4)",
  },
  "& .walletImgIOS": {
    objectFit: "fill",
    transform: "scale(1.4)",
  },
}));

export const PaymentCard = styled(Box)(({ theme }) => ({
  position: "absolute",
  top: "49%",
  right: "8%",
  transform: "translate(35%, -47%)",
  width: 240,
  height: 200,
  zIndex: 3,
  display: "none",
  borderRadius: 16,
  boxShadow: "0px 3.24px 24.89px rgba(18, 19, 92, 0.16)",
  [theme.breakpoints.up("md")]: {
    display: "block",
  },
  [theme.breakpoints.up("lg")]: {
    width: 308,
    height: 251,
  },
  "& .paymentImg": {
    objectFit: "fill",
    transform: "scale(1.2)",
  },
  "& .paymentImgIOS": {
    objectFit: "fill",
    transform: "scale(1.2)",
  },
}));

export const MobileSection = styled(Box)(({ theme }) => ({
  display: "block",
  marginTop: theme.spacing(4),
  marginBottom: theme.spacing(10),
  position: "relative",
  height: 450,
  [theme.breakpoints.up("md")]: {
    display: "none",
  },
  "&:before": {
    content: '""',
    position: "absolute",
    top: "0%",
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: alpha(homeTheme.palette.primary.main, 0.05),
    filter: "blur(100px)",
    borderRadius: "1000px",
    zIndex: 0,
  },
}));

export const MobileWalletBox = styled(Box)(() => ({
  position: "absolute",
  top: "0%",
  left: 0,
  width: 258,
  height: 168,
  filter: "blur(1px)",
  "& .walletMobileImg": {
    objectFit: "fill",
    transform: "scale(1.3)",
  },
  "& .walletMobileImgIOS": {
    objectFit: "fill",
    transform: "scale(1)",
  },
}));

export const MobilePaymentBox = styled(Box)(() => ({
  position: "absolute",
  bottom: "0%",
  right: 0,
  width: 308,
  height: 251,
  filter: "blur(1px)",
  "& .paymentMobileImg": {
    objectFit: "fill",
    transform: "scale(1.3)",
  },
  "& .paymentMobileImgIOS": {
    objectFit: "fill",
    transform: "scale(1)",
  },
}));

export const LitecoinMobileFloat = styled(Box)(() => ({
  position: "absolute",
  top: "0%",
  right: -16,
  width: 97,
  height: 97,
  filter: "blur(3px)",
  zIndex: 0,
  animation: "heroFloatLitecoinMobile 6s ease-in-out infinite",
  "& .litecoinMobileImg": {
    objectFit: "cover",
    transform: "scale(1.2)",
  },
  "& .litecoinMobileImgIOS": {
    objectFit: "cover",
    transform: "scale(1)",
  },
  "@keyframes heroFloatLitecoinMobile": {
    "0%, 100%": {
      transform: "translateY(0px) translateX(0px) rotate(0deg)",
      opacity: 0.8,
    },
    "33%": {
      transform: "translateY(-15px) translateX(10px) rotate(3deg)",
      opacity: 1,
    },
    "66%": {
      transform: "translateY(10px) translateX(-10px) rotate(-3deg)",
      opacity: 0.9,
    },
  },
}));

export const DashboardMobileBox = styled(Box)(() => ({
  position: "absolute",
  top: "50%",
  left: "10%",
  transform: "translateY(-50%)",
  width: 847,
  height: 367,
  "& .dashboardMobileImg": {
    objectFit: "cover",
    transform: "scale(1.12)",
  },
  "& .dashboardMobileImgIOS": {
    objectFit: "cover",
    transform: "scale(1.026)",
  },
}));

// GoLive
export const SectionRoot = styled("section")(({ theme }) => ({
  padding: "96px 0",
  maxWidth: 1280,
  margin: "0 auto",
}));

export const CardsWrapper = styled(Box)(({ theme }) => ({
  paddingTop: theme.spacing(8),
  "&[data-pt='mobile']": {
    paddingTop: theme.spacing(5),
  },
}));

export const StyledGridItem = styled(Grid)(() => ({
  display: "flex",
  justifyContent: "center",
}));

export const CardContent = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-start",
  alignItems: "flex-start",
  width: "100%",
  height: "100%",
  paddingLeft: 33,
  paddingRight: 33,
  paddingTop: 33,
  paddingBottom: 0,
  "&[data-mobile='true']": {
    paddingLeft: 30,
    paddingRight: 30,
    paddingBottom: 24,
  },
}));

export const CardTitle = styled(Typography)(({ theme }) => ({
  marginBottom: 12,
  fontSize: 20,
  fontWeight: 500,
  lineHeight: "28px",
  letterSpacing: 0,
  fontFamily: "OutfitMedium",
  color: theme.palette.text.primary,
}));

export const CardDescription = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(1),
  fontSize: 16,
  fontWeight: 400,
  lineHeight: "24px",
  letterSpacing: 0,
  fontFamily: "OutfitRegular",
  color: theme.palette.text.secondary,
}));

export const ImageBox = styled(Box)(() => ({
  width: "100%",
  height: "100%",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  "& img": {
    height: "100%",
    objectFit: "contain",
  },
  "& img.normal": {
    width: "100%",
  },
  "& img.wide": {
    width: "120%",
  },
  "& img.wide3": {
    width: "110%",
  },
}));

export const UseCaseContainer = styled(Box)(() => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
}));
