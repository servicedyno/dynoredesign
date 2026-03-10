import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import {
  AccountBalanceWalletRounded,
  VpnKeyRounded,
  PersonRounded,
  NotificationsRounded,
  BusinessRounded,
  SecurityRounded,
  WebhookRounded,
  CurrencyExchangeRounded,
} from "@mui/icons-material";
import { useRouter } from "next/router";
import Head from "next/head";
import useIsMobile from "@/hooks/useIsMobile";
import { pageProps } from "@/utils/types";
import { useEffect } from "react";

interface SettingsCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
}

const SettingsPage = ({
  setPageName,
  setPageDescription,
  setPageAction,
}: pageProps) => {
  const theme = useTheme();
  const router = useRouter();
  const isMobile = useIsMobile("md");

  useEffect(() => {
    setPageName?.("Settings");
    setPageDescription?.("Manage your account, wallets, and payment configuration");
    setPageAction?.(null);
  }, []);

  const settingsCards: SettingsCard[] = [
    {
      title: "Wallet Addresses",
      description: "Manage your crypto wallet addresses for receiving payments",
      icon: <AccountBalanceWalletRounded sx={{ fontSize: 28 }} />,
      path: "/wallet",
      color: "#6366F1",
    },
    {
      title: "Company Profile",
      description: "Update your business information, logo, and company details",
      icon: <BusinessRounded sx={{ fontSize: 28 }} />,
      path: "/company",
      color: "#8B5CF6",
    },
    {
      title: "Payment Settings",
      description: "Configure payment tolerance, accepted currencies, and checkout options",
      icon: <CurrencyExchangeRounded sx={{ fontSize: 28 }} />,
      path: "/company",
      color: "#EC4899",
    },
    {
      title: "API Keys",
      description: "Manage your API keys for programmatic integration",
      icon: <VpnKeyRounded sx={{ fontSize: 28 }} />,
      path: "/developer-keys",
      color: "#F59E0B",
    },
    {
      title: "Profile & Security",
      description: "Update your personal info, password, and security preferences",
      icon: <SecurityRounded sx={{ fontSize: 28 }} />,
      path: "/profile",
      color: "#10B981",
    },
    {
      title: "Notifications",
      description: "Configure email, push, and webhook notification preferences",
      icon: <NotificationsRounded sx={{ fontSize: 28 }} />,
      path: "/notifications",
      color: "#3B82F6",
    },
    {
      title: "Webhook Configuration",
      description: "Set up webhook endpoints for real-time payment event notifications",
      icon: <WebhookRounded sx={{ fontSize: 28 }} />,
      path: "/company",
      color: "#EF4444",
    },
    {
      title: "My Account",
      description: "View account details, referral code, and manage your subscription",
      icon: <PersonRounded sx={{ fontSize: 28 }} />,
      path: "/profile",
      color: "#14B8A6",
    },
  ];

  return (
    <>
      <Head>
        <title>Settings - DynoPay</title>
      </Head>
      <Box sx={{ px: { xs: 2, md: 0 }, py: { xs: 1, md: 0 }, maxWidth: "1200px" }}>
        {/* Card Grid */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(3, 1fr)",
            },
            gap: { xs: "12px", md: "16px" },
          }}
        >
          {settingsCards.map((card, index) => (
            <Box
              key={index}
              onClick={() => router.push(card.path)}
              sx={{
                p: { xs: "16px", md: "20px 24px" },
                borderRadius: "14px",
                bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "#fff",
                border: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "#E9ECF2"}`,
                cursor: "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                "&:hover": {
                  borderColor: card.color + "60",
                  boxShadow: `0 4px 16px ${card.color}15`,
                  transform: "translateY(-2px)",
                },
              }}
            >
              {/* Icon */}
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: "12px",
                  bgcolor: card.color + "15",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: card.color,
                }}
              >
                {card.icon}
              </Box>

              {/* Text */}
              <Box>
                <Typography
                  sx={{
                    fontSize: { xs: "14px", md: "16px" },
                    fontFamily: "UrbanistSemibold",
                    fontWeight: 600,
                    color: theme.palette.text.primary,
                    mb: 0.5,
                  }}
                >
                  {card.title}
                </Typography>
                <Typography
                  sx={{
                    fontSize: { xs: "12px", md: "13px" },
                    fontFamily: "UrbanistMedium",
                    color: theme.palette.text.secondary,
                    lineHeight: 1.5,
                  }}
                >
                  {card.description}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </>
  );
};

export default SettingsPage;
