import React, { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography, useTheme } from "@mui/material";
import useIsMobile from "@/hooks/useIsMobile";
import HomeButton from "@/Components/Layout/HomeButton";

const FinalCTA: React.FC = () => {
  const { t } = useTranslation("landing");
  const theme = useTheme();
  const isMobile = useIsMobile("md");
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
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{
        padding: isMobile ? "80px 16px" : "120px 32px",
        maxWidth: 1280,
        margin: "0 auto",
      }}
    >
      <Box
        sx={{
          position: "relative",
          borderRadius: "28px",
          overflow: "hidden",
          textAlign: "center",
          py: isMobile ? 6 : 8,
          px: isMobile ? 3 : 6,
          border: `1px solid ${isDark ? "rgba(106,123,255,0.2)" : "rgba(0,4,255,0.1)"}`,
          bgcolor: isDark ? "rgba(106,123,255,0.04)" : "rgba(0,4,255,0.02)",
          transition: "all 0.5s ease",
          transform: isVisible ? "translateY(0)" : "translateY(20px)",
          opacity: isVisible ? 1 : 0,
        }}
      >
        {/* Background glow */}
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: isDark
              ? "radial-gradient(circle, rgba(106,123,255,0.08) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(0,4,255,0.05) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <Typography
          sx={{
            fontSize: isMobile ? "32px" : "44px",
            fontFamily: "OutfitMedium",
            fontWeight: 600,
            color: theme.palette.text.primary,
            lineHeight: 1.15,
            mb: 1.5,
            position: "relative",
            zIndex: 1,
          }}
        >
          {t("finalCtaTitle")}
        </Typography>

        <Typography
          sx={{
            fontSize: isMobile ? "16px" : "18px",
            fontFamily: "OutfitRegular",
            color: theme.palette.text.secondary,
            mb: 4,
            position: "relative",
            zIndex: 1,
            maxWidth: 480,
            mx: "auto",
            lineHeight: 1.5,
          }}
        >
          {t("finalCtaSubtitle")}
        </Typography>

        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            mb: 3,
            position: "relative",
            zIndex: 1,
          }}
        >
          <HomeButton variant="primary" label={t("startAcceptingCrypto")} />
        </Box>

        {/* Fee-free badge in CTA */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            mb: 3,
            position: "relative",
            zIndex: 1,
          }}
        >
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.8,
              px: 2,
              py: 0.7,
              borderRadius: "20px",
              border: `1px solid ${isDark ? "rgba(16,185,129,0.3)" : "rgba(16,185,129,0.25)"}`,
              bgcolor: isDark ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.06)",
            }}
          >
            <Typography sx={{ fontSize: "13px", lineHeight: 1 }}>🎉</Typography>
            <Typography
              sx={{
                fontSize: "13px",
                fontFamily: "OutfitMedium",
                fontWeight: 500,
                color: "#10B981",
                lineHeight: 1,
              }}
            >
              First $500 fee-free for new merchants
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            gap: isMobile ? 2 : 3,
            position: "relative",
            zIndex: 1,
            flexWrap: "wrap",
          }}
        >
          <Typography
            component="a"
            href="/help-support"
            sx={{
              fontSize: "14px",
              fontFamily: "OutfitMedium",
              color: theme.palette.text.secondary,
              textDecoration: "none",
              transition: "color 0.2s ease",
              cursor: "pointer",
              "&:hover": {
                color: theme.palette.primary.main,
              },
            }}
          >
            {t("finalCtaChat")}
          </Typography>
          <Typography
            sx={{
              color: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
              userSelect: "none",
            }}
          >
            |
          </Typography>
          <Typography
            component="a"
            href="/documentation"
            sx={{
              fontSize: "14px",
              fontFamily: "OutfitMedium",
              color: theme.palette.text.secondary,
              textDecoration: "none",
              transition: "color 0.2s ease",
              cursor: "pointer",
              "&:hover": {
                color: theme.palette.primary.main,
              },
            }}
          >
            {t("finalCtaDocs")}
          </Typography>
        </Box>
      </Box>
    </section>
  );
};

export default memo(FinalCTA);
