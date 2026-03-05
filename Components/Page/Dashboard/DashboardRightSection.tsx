import { ArrowOutward } from "@mui/icons-material";
import { Box, IconButton, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import ReferralAndKnowledge from "@/Components/Layout/ReferralAndKnowledge";
import CustomButton from "@/Components/UI/Buttons";
import PanelCard from "@/Components/UI/PanelCard";
import FeeTierProgress from "./FeeTierProgress";

import { formatNumberWithComma, getCurrencySymbol } from "@/helpers";
import useIsMobile from "@/hooks/useIsMobile";
import { useDashboardData } from "@/hooks/useDashboardData";
import { theme } from "@/styles/theme";

import CheckCircleIcon from "@/assets/Icons/correct-icon.png";
import CurrencyIcon from "@/assets/Icons/dollar-sign-icon.svg";
import CrownIcon from "@/assets/Icons/premium-icon.svg";
import BgDesktopImage from "@/assets/Images/bg-white.png";
import BgMobileImage from "@/assets/Images/premium-card-bg.png";

import { PremiumTierCard } from "./styled";

const DEFAULT_MONTHLY_LIMIT = 50000;
const DEFAULT_USED_AMOUNT = 0;
const CURRENT_TIER = "Standard";

const DashboardRightSection = () => {
  const muiTheme = useTheme();
  const isMobile = useIsMobile("md");

  const { t } = useTranslation(["dashboardLayout", "common"]);
  const tDashboard = useCallback(
    (key: string) => t(key, { ns: "dashboardLayout" }),
    [t],
  );

  const { feeTiers } = useDashboardData();

  const monthlyLimit = feeTiers.monthlyLimit || DEFAULT_MONTHLY_LIMIT;
  const currentTier = feeTiers.currentTier || CURRENT_TIER;
  const [usedAmount, setUsedAmount] = useState(feeTiers.usedAmount || DEFAULT_USED_AMOUNT);

  useEffect(() => {
    if (feeTiers.usedAmount > 0) {
      setUsedAmount(feeTiers.usedAmount);
    }
  }, [feeTiers.usedAmount]);

  useEffect(() => {
    if (usedAmount > monthlyLimit) {
      setUsedAmount(monthlyLimit);
    }
  }, [usedAmount, monthlyLimit]);

  return (
    <Box sx={{ px: { xs: "16px", md: "0px" } }}>
      <PanelCard
        title={tDashboard("feeTierProgress")}
        subTitle={tDashboard("yourProgressTowardsTheNextFeeTier")}
        showHeaderBorder={false}
        headerPadding={theme.spacing(2.5, 2.5, 0, 2.5)}
        bodyPadding={
          isMobile
            ? theme.spacing("12px", 2, 2, 2)
            : theme.spacing("22px", 2.5, 2.5, 2.5)
        }
        headerActionLayout="inline"
        headerSx={{ alignItems: "start" }}
        headerAction={
          <IconButton
            sx={{
              position: "absolute",
              right: "12px",
              top: "12px",
              backgroundColor: "#E9ECF2",
              p: "8px",
              width: isMobile ? 32 : 40,
              height: isMobile ? 32 : 40,
              "&:hover": { backgroundColor: "#E9ECF2" },
            }}
          >
            <Image
              src={CurrencyIcon}
              alt="Currency"
              width={18}
              height={18}
              draggable={false}
              style={{ width: "clamp(14px, 2vw, 18px)", height: "auto " }}
            />
          </IconButton>
        }
      >
        <Box>
          {/* Monthly Volume */}
          <Box
            sx={{
              height: isMobile ? "16px" : "18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: isMobile ? "8px" : "14px",
            }}
          >
            <Typography
              sx={{
                fontSize: isMobile ? 10 : 13,
                color: muiTheme.palette.text.secondary,
                fontFamily: "UrbanistMedium",
                lineHeight: 1.2,
                letterSpacing: 0,
                fontWeight: 500,
              }}
            >
              {tDashboard("monthlyVolume")}
            </Typography>

            <Typography component="div" sx={{ fontFamily: "UrbanistMedium" }}>
              <Box
                component="span"
                sx={{
                  fontSize: isMobile ? 13 : 15,
                  color: muiTheme.palette.text.primary,
                  lineHeight: 1.2,
                  letterSpacing: 0,
                  fontWeight: 500,
                }}
              >
                {getCurrencySymbol("USD", formatNumberWithComma(usedAmount))}
              </Box>
              <Box
                component="span"
                sx={{
                  px: "6px",
                  fontSize: isMobile ? 10 : 13,
                  lineHeight: 1.2,
                  letterSpacing: 0,
                  fontWeight: 500,
                  color: muiTheme.palette.text.secondary,
                }}
              >
                /
              </Box>
              <Box
                component="span"
                sx={{
                  fontSize: isMobile ? 10 : 13,
                  lineHeight: 1.2,
                  letterSpacing: 0,
                  fontWeight: 500,
                  color: muiTheme.palette.text.secondary,
                }}
              >
                {getCurrencySymbol("USD", monthlyLimit.toLocaleString())}
              </Box>
            </Typography>
          </Box>

          {/* Progress */}
          <FeeTierProgress
            monthlyLimit={monthlyLimit}
            usedAmount={usedAmount}
            currentTier={currentTier}
          />

          {/* Current Tier Badge */}
          <Box
            sx={{
              mt: isMobile ? 1.5 : 3,
              height: isMobile ? "32px" : "40px",
              width: "100%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 0.75,
              px: 1.5,
              py: isMobile ? "8px" : "11px",
              borderRadius: "100px",
              background: theme.palette.success.main,
              border: `1px solid ${theme.palette.success.light}`,
            }}
          >
            <Typography
              component="div"
              sx={{
                fontSize: isMobile ? 13 : 15,
                fontWeight: 500,
                color: theme.palette.success.dark,
                fontFamily: "UrbanistMedium",
                lineHeight: 1.2,
                letterSpacing: "0",
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              {tDashboard("currentTier")}:
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Image
                  src={CheckCircleIcon}
                  alt="Active Tier"
                  width={16}
                  height={16}
                  draggable={false}
                />
                {currentTier}
              </Box>
            </Typography>
          </Box>

          {/* Premium Upgrade Card */}
          <PremiumTierCard
            sx={{ mt: isMobile ? 1.5 : 2, position: "relative" }}
          >
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                top: "6px",
                left: "-10px",
                zIndex: -1,
                maxWidth: 310,
              }}
            >
              <Image
                src={isMobile ? BgMobileImage : BgDesktopImage}
                alt="Background"
                fill
                sizes={isMobile ? "100vw" : "310px"}
                draggable={false}
                style={{ objectFit: "contain" }}
              />
            </Box>

            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Box>
                <Typography
                  sx={{
                    fontSize: isMobile ? 13 : 15,
                    fontWeight: 500,
                    fontFamily: "UrbanistMedium",
                    lineHeight: "1.2",
                    letterSpacing: "0",
                    wordBreak: "break-all",
                  }}
                >
                  {tDashboard("upgradeToPremiumTier")}
                </Typography>

                <Typography
                  sx={{
                    fontSize: isMobile ? 10 : 13,
                    fontWeight: 500,
                    color: theme.palette.text.secondary,
                    fontFamily: "UrbanistMedium",
                    mt: isMobile ? 0.75 : 1.2,
                    lineHeight: "1.2",
                    letterSpacing: "0",
                    wordBreak: "break-all",
                  }}
                >
                  {tDashboard("lowerFeesAndPrioritySupport")}
                </Typography>
              </Box>

              <Box
                sx={{
                  width: isMobile ? 32 : 49,
                  height: isMobile ? 32 : 49,
                  border: `1px solid ${theme.palette.border.main}`,
                  borderRadius: "50%",
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Image
                  src={CrownIcon}
                  alt="Premium"
                  width={isMobile ? 14 : 18}
                  height={isMobile ? 12 : 18}
                  draggable={false}
                />
              </Box>
            </Box>

            <Box mt={2.5}>
              <CustomButton
                label={tDashboard("learnMore")}
                variant="secondary"
                size={isMobile ? "small" : "medium"}
                endIcon={<ArrowOutward sx={{ fontSize: 16 }} />}
                fullWidth
              />
            </Box>
          </PremiumTierCard>
        </Box>
      </PanelCard>

      {isMobile && (
        <Box mt={2}>
          <ReferralAndKnowledge isMobile />
        </Box>
      )}
    </Box>
  );
};

export default DashboardRightSection;
