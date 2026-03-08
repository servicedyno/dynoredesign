import { Box, Typography, useTheme } from "@mui/material";
import { FC, memo } from "react";
import useIsMobile from "@/hooks/useIsMobile";

const stats = [
  {
    value: "$2M+",
    label: "Transactions Processed",
    sublabel: "in crypto payments",
    gradient: "linear-gradient(135deg, #0004FF 0%, #4D50FF 100%)",
  },
  {
    value: "500+",
    label: "Active Merchants",
    sublabel: "across 30+ countries",
    gradient: "linear-gradient(135deg, #1C993D 0%, #47B464 100%)",
  },
  {
    value: "15+",
    label: "Cryptocurrencies",
    sublabel: "BTC, ETH, USDT & more",
    gradient: "linear-gradient(135deg, #F59E0B 0%, #F97316 100%)",
  },
  {
    value: "99.9%",
    label: "Uptime",
    sublabel: "enterprise-grade reliability",
    gradient: "linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)",
  },
];

const SocialProofSection: FC = () => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");

  return (
    <Box
      sx={{
        py: isMobile ? 5 : 8,
        px: isMobile ? 2 : 4,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle background accent */}
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${theme.palette.primary.main}08 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* Section header */}
      <Box sx={{ textAlign: "center", mb: isMobile ? 4 : 6, position: "relative" }}>
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
            px: 2,
            py: 0.75,
            borderRadius: "20px",
            bgcolor: `${theme.palette.primary.main}0A`,
            border: `1px solid ${theme.palette.primary.main}18`,
            mb: 2,
          }}
        >
          <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: theme.palette.primary.main, animation: "pulse 2s infinite" }} />
          <Typography
            sx={{
              fontSize: "12px",
              fontFamily: "UrbanistSemibold",
              fontWeight: 600,
              color: theme.palette.primary.main,
              textTransform: "uppercase",
              letterSpacing: "1.5px",
            }}
          >
            Trusted Worldwide
          </Typography>
        </Box>
        <Typography
          sx={{
            fontSize: isMobile ? "28px" : "40px",
            fontFamily: "UrbanistSemibold",
            fontWeight: 700,
            color: theme.palette.text.primary,
            lineHeight: 1.15,
            mb: 1.5,
          }}
        >
          Numbers That Speak{isMobile ? <br /> : " "}for Themselves
        </Typography>
        <Typography
          sx={{
            fontSize: isMobile ? "14px" : "16px",
            fontFamily: "UrbanistMedium",
            color: theme.palette.text.secondary,
            maxWidth: 520,
            mx: "auto",
            lineHeight: 1.5,
          }}
        >
          Join hundreds of businesses already accepting crypto payments with confidence
        </Typography>
      </Box>

      {/* Stats grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
          gap: isMobile ? 1.5 : 2.5,
          maxWidth: 1000,
          mx: "auto",
          position: "relative",
        }}
      >
        {stats.map((stat) => (
          <Box
            key={stat.label}
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: isMobile ? 0.75 : 1,
              p: isMobile ? 2.5 : 3.5,
              borderRadius: "16px",
              bgcolor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              position: "relative",
              overflow: "hidden",
              transition: "transform 0.25s ease, box-shadow 0.25s ease",
              "&:hover": {
                transform: "translateY(-4px)",
                boxShadow: "0 12px 40px rgba(0,0,0,0.08)",
              },
            }}
          >
            {/* Top accent bar */}
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: "40%",
                height: "3px",
                borderRadius: "0 0 3px 3px",
                background: stat.gradient,
              }}
            />

            <Typography
              sx={{
                fontSize: isMobile ? "32px" : "42px",
                fontFamily: "UrbanistSemibold",
                fontWeight: 800,
                background: stat.gradient,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                lineHeight: 1.1,
                mt: 0.5,
              }}
            >
              {stat.value}
            </Typography>
            <Typography
              sx={{
                fontSize: isMobile ? "13px" : "15px",
                fontFamily: "UrbanistSemibold",
                fontWeight: 600,
                color: theme.palette.text.primary,
                lineHeight: 1.2,
              }}
            >
              {stat.label}
            </Typography>
            <Typography
              sx={{
                fontSize: isMobile ? "11px" : "12px",
                fontFamily: "UrbanistMedium",
                color: theme.palette.text.secondary,
                lineHeight: 1.3,
              }}
            >
              {stat.sublabel}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Pulse animation */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </Box>
  );
};

export default memo(SocialProofSection);
