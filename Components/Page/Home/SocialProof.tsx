import { Box, Typography, useTheme } from "@mui/material";
import { FC, memo } from "react";
import useIsMobile from "@/hooks/useIsMobile";

const stats = [
  { value: "10K+", label: "Transactions Processed", icon: "💳" },
  { value: "500+", label: "Active Merchants", icon: "🏪" },
  { value: "15+", label: "Cryptocurrencies", icon: "🪙" },
  { value: "99.9%", label: "Uptime Guarantee", icon: "⚡" },
];

const SocialProofSection: FC = () => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");

  return (
    <Box
      sx={{
        py: isMobile ? 4 : 6,
        px: isMobile ? 2 : 4,
      }}
    >
      {/* Section header */}
      <Typography
        sx={{
          textAlign: "center",
          fontSize: isMobile ? "13px" : "14px",
          fontFamily: "UrbanistSemibold",
          fontWeight: 600,
          color: theme.palette.primary.main,
          textTransform: "uppercase",
          letterSpacing: "1.5px",
          mb: 1,
        }}
      >
        Trusted by Businesses Worldwide
      </Typography>
      <Typography
        sx={{
          textAlign: "center",
          fontSize: isMobile ? "22px" : "32px",
          fontFamily: "UrbanistSemibold",
          fontWeight: 700,
          color: theme.palette.text.primary,
          mb: isMobile ? 3 : 5,
          lineHeight: 1.2,
        }}
      >
        Growing Every Day
      </Typography>

      {/* Stats grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
          gap: isMobile ? 2 : 3,
          maxWidth: 900,
          mx: "auto",
        }}
      >
        {stats.map((stat) => (
          <Box
            key={stat.label}
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
              p: isMobile ? 2.5 : 3,
              borderRadius: "14px",
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.background.paper,
              transition: "transform 0.2s, box-shadow 0.2s",
              "&:hover": {
                transform: "translateY(-2px)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
              },
            }}
          >
            <Typography sx={{ fontSize: isMobile ? "24px" : "28px" }}>
              {stat.icon}
            </Typography>
            <Typography
              sx={{
                fontSize: isMobile ? "26px" : "34px",
                fontFamily: "UrbanistSemibold",
                fontWeight: 700,
                color: theme.palette.primary.main,
                lineHeight: 1,
              }}
            >
              {stat.value}
            </Typography>
            <Typography
              sx={{
                fontSize: isMobile ? "12px" : "14px",
                fontFamily: "UrbanistMedium",
                color: theme.palette.text.secondary,
                textAlign: "center",
                lineHeight: 1.3,
              }}
            >
              {stat.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default memo(SocialProofSection);
