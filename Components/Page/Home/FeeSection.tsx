import React, { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography, useTheme } from "@mui/material";
import useIsMobile from "@/hooks/useIsMobile";
import HomeSectionTitle from "@/Components/UI/SectionTitle";
import HomeButton from "@/Components/Layout/HomeButton";
import FeeCalculator from "@/Components/UI/FeeCalculator";

const competitors = [
  { name: "DynoPay", fee: "1.5%", extra: "", highlight: true },
  { name: "PayPal", fee: "2.9%", extra: "+ $0.30", highlight: false },
  { name: "Stripe", fee: "2.9%", extra: "+ $0.30", highlight: false },
];

const FeeSection = () => {
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("fees");
  const { t: tLanding } = useTranslation("landing");
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="fee-calculator"
      style={{
        padding: isMobile ? "80px 0" : "120px 0",
        maxWidth: 1280,
        margin: "0 auto",
      }}
    >
      <HomeSectionTitle
        type="small"
        badgeText={t("feeSectionBadge")}
        title={t("feeSectionTitle")}
        highlightText={t("feeSectionHighlight")}
        subtitle={t("feeSectionSubtitle")}
        sx={{ maxWidth: "100%" }}
      />

      {/* Fee Comparison */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          gap: isMobile ? 1.5 : 2.5,
          mt: isMobile ? 4 : 6,
          mb: isMobile ? 4 : 5,
          flexWrap: "wrap",
        }}
      >
        {competitors.map((c, idx) => (
          <Box
            key={c.name}
            sx={{
              px: isMobile ? 2.5 : 4,
              py: isMobile ? 2 : 2.5,
              borderRadius: "16px",
              border: c.highlight
                ? "2px solid"
                : `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
              borderColor: c.highlight
                ? isDark
                  ? "#6A7BFF"
                  : "#0004FF"
                : undefined,
              bgcolor: c.highlight
                ? isDark
                  ? "rgba(106,123,255,0.08)"
                  : "rgba(0,4,255,0.04)"
                : isDark
                  ? "rgba(255,255,255,0.02)"
                  : "rgba(0,0,0,0.015)",
              textAlign: "center",
              minWidth: isMobile ? 100 : 150,
              transition: "all 0.4s ease",
              transform: isVisible ? "translateY(0)" : "translateY(15px)",
              opacity: isVisible ? 1 : 0,
              transitionDelay: `${idx * 100}ms`,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {c.highlight && (
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "60%",
                  height: "2px",
                  background: "linear-gradient(90deg, #0004FF, #6A4DFF)",
                  borderRadius: "0 0 2px 2px",
                }}
              />
            )}
            <Typography
              sx={{
                fontSize: "13px",
                fontFamily: "OutfitMedium",
                color: c.highlight ? theme.palette.primary.main : theme.palette.text.secondary,
                mb: 0.5,
                fontWeight: c.highlight ? 600 : 400,
              }}
            >
              {c.name}
            </Typography>
            <Typography
              sx={{
                fontSize: isMobile ? "22px" : "28px",
                fontFamily: "OutfitSemiBold",
                fontWeight: 700,
                color: c.highlight ? theme.palette.text.primary : theme.palette.text.secondary,
                lineHeight: 1.1,
              }}
            >
              {c.fee}
            </Typography>
            {c.extra && (
              <Typography
                sx={{
                  fontSize: "12px",
                  fontFamily: "OutfitRegular",
                  color: theme.palette.text.secondary,
                  mt: 0.3,
                }}
              >
                {c.extra}
              </Typography>
            )}
          </Box>
        ))}
      </Box>

      {/* Calculator */}
      <Box sx={{ maxWidth: 720, mx: "auto" }}>
        <FeeCalculator compact />
      </Box>

      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <HomeButton
          variant="outlined"
          label={t("viewFullBreakdown")}
          navigateTo="/fees"
          showIcon
        />
      </Box>
    </section>
  );
};

export default memo(FeeSection);
