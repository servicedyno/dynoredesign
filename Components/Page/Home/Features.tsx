import React from "react";
import { useTranslation } from "react-i18next";
import Image from "next/image";
import HomeCard from "@/Components/UI/HomeCard";
import { Box, Grid } from "@mui/material";
import useIsMobile from "@/hooks/useIsMobile";
import {
  FeatureIcon,
  GoLiveDescription,
  FeatureTitle,
} from "@/Components/UI/HomeCard/styled";
import HomeSectionTitle from "@/Components/UI/SectionTitle";
import HomeButton from "@/Components/Layout/HomeButton";

import PaymentLinkSuccessImage_svg from "@/assets/Images/home/payment-link-success.svg";
import TransactionDashboardImage_svg from "@/assets/Images/home/transaction-dashboard.svg";
import WalletSelectorImage_svg from "@/assets/Images/home/wallet-selector.svg";
import APIKeyImage_svg from "@/assets/Images/home/api-key.svg";
import ProgressCounterImage_svg from "@/assets/Images/home/progress-counter.svg";
import WebhookInfoImage_svg from "@/assets/Images/home/webhook-info.svg";

import PaymentLinkSuccessImage_png from "@/assets/Images/home/payment-link-success.png";
import TransactionDashboardImage_png from "@/assets/Images/home/transaction-dashboard.png";
import WalletSelectorImage_png from "@/assets/Images/home/wallet-selector.png";
import APIKeyImage_png from "@/assets/Images/home/api-key.png";
import ProgressCounterImage_png from "@/assets/Images/home/progress-counter.png";
import WebhookInfoImage_png from "@/assets/Images/home/webhook-info.png";

import LinkIcon from "@/assets/Icons/home/link-icon.svg";
import DashboardIcon from "@/assets/Icons/home/dashboard-icon.svg";
import WalletIcon from "@/assets/Icons/home/wallet-icon.svg";
import APIKeyIcon from "@/assets/Icons/home/code-icon.svg";
import ProgressCounterIcon from "@/assets/Icons/home/trend-down-icon.svg";
import WebhookIcon from "@/assets/Icons/home/webhook-icon.svg";
import { useDevice } from "@/hooks/useDevice";

const FeaturesSection = () => {
  const isMobile = useIsMobile("md");
  const { os, browser } = useDevice();
  const { t } = useTranslation("landing");

  const cardData = [
    {
      titleKey: "feature1Title",
      descriptionKey: "feature1Description",
      image: os === "ios" || browser === "safari" ? PaymentLinkSuccessImage_png : PaymentLinkSuccessImage_svg,
      icon: LinkIcon,
      order: { xs: 3, md: 1 },
    },
    {
      titleKey: "feature2Title",
      descriptionKey: "feature2Description",
      image: os === "ios" || browser === "safari" ? TransactionDashboardImage_png : TransactionDashboardImage_svg,
      icon: DashboardIcon,
      order: { xs: 2, md: 2 },
    },
    {
      titleKey: "feature3Title",
      descriptionKey: "feature3Description",
      image: os === "ios" || browser === "safari" ? WalletSelectorImage_png : WalletSelectorImage_svg,
      icon: WalletIcon,
      order: { xs: 1, md: 3 },
    },
    {
      titleKey: "feature4Title",
      descriptionKey: "feature4Description",
      image: os === "ios" || browser === "safari" ? APIKeyImage_png : APIKeyImage_svg,
      icon: APIKeyIcon,
      order: { xs: 6, md: 4 },
    },
    {
      titleKey: "feature5Title",
      descriptionKey: "feature5Description",
      image: os === "ios" || browser === "safari" ? ProgressCounterImage_png : ProgressCounterImage_svg,
      icon: ProgressCounterIcon,
      order: { xs: 5, md: 5 },
    },
    {
      titleKey: "feature6Title",
      descriptionKey: "feature6Description",
      image: os === "ios" || browser === "safari" ? WebhookInfoImage_png : WebhookInfoImage_svg,
      icon: WebhookIcon,
      order: { xs: 4, md: 6 },
    },
  ];

  return (
    <section
      id="features"
      style={{
        padding: isMobile ? "60px 0px" : "83px 0px",
      }}
    >
      {/* Section Title */}
      <HomeSectionTitle
        type="small"
        badgeText={t("features")}
        title={t("featuresTitle")}
        highlightText={t("featuresHighlight")}
        subtitle={t("featuresSubtitle")}
        sx={{ maxWidth: "100%" }}
      />

      {/* Feature Cards */}
      <Box sx={{ paddingTop: isMobile ? 5 : 8 }}>
        <Grid container spacing={4}>
          {cardData.slice(0, 3).map((card) => (
            <Grid
              key={card.titleKey}
              item
              xs={12}
              sm={12}
              md={4}
              lg={4}
              xl={4}
              sx={{ order: card.order }}
              display="flex"
              justifyContent="center"
            >
              <HomeCard
                height={isMobile ? 405 : 500}
                width={isMobile ? 360 : 395}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "start",
                    alignItems: "start",
                    width: "100%",
                    height: "100%",
                    padding: isMobile ? "20px" : "25px",
                  }}
                >
                  <FeatureIcon sx={{ mb: 2 }}>
                    <Image src={card.icon} alt={`${t(card.titleKey)} icon`} width={24} height={24} />
                  </FeatureIcon>

                  <FeatureTitle sx={{ mb: 1 }}>{t(card.titleKey)}</FeatureTitle>
                  <GoLiveDescription sx={{ mb: 2 }}>
                    {t(card.descriptionKey)}
                  </GoLiveDescription>

                  <Box
                    sx={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Image
                      src={card.image}
                      alt={t(card.titleKey)}
                      quality={100}
                      priority={cardData.indexOf(card) < 3}
                      style={{
                        width: isMobile ? "110%" : "100%",
                        height: "100%",
                        objectFit: "contain",
                      }}
                      draggable={false}
                    />
                  </Box>
                </Box>
              </HomeCard>
            </Grid>
          ))}
          {cardData.slice(3, cardData.length).map((card) => (
            <Grid
              key={card.titleKey}
              item
              xs={12}
              sm={12}
              md={4}
              lg={4}
              xl={4}
              sx={{ order: card.order }}
              display="flex"
              justifyContent="center"
            >
              <HomeCard
                height={isMobile ? 405 : 400}
                width={isMobile ? 360 : 395}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "start",
                    alignItems: "start",
                    width: "100%",
                    height: "100%",
                    paddingX: isMobile ? "20px" : "25px",
                    paddingTop: isMobile ? "20px" : "25px",
                  }}
                >
                  <FeatureIcon sx={{ mb: 2 }}>
                    <Image src={card.icon} alt={`${t(card.titleKey)} icon`} width={24} height={24} />
                  </FeatureIcon>

                  <FeatureTitle sx={{ mb: 1 }}>{t(card.titleKey)}</FeatureTitle>
                  <GoLiveDescription sx={{ mb: "3px" }}>
                    {t(card.descriptionKey)}
                  </GoLiveDescription>

                  <Box
                    sx={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      paddingTop: card.titleKey === "feature4Title" ? "15px" : "0px",
                    }}
                  >
                    <Image
                      src={card.image}
                      alt={t(card.titleKey)}
                      quality={100}
                      priority={cardData.indexOf(card) < 3}
                      style={{
                        width: "110%",
                        height: "100%",
                        // objectFit: "contain",
                      }}
                      draggable={false}
                    />
                  </Box>
                </Box>
              </HomeCard>
            </Grid>
          ))}
        </Grid>

        {/* CTA Button */}
        <Box sx={{ display: "flex", justifyContent: "center", mt: isMobile ? 5 : 8 }}>
          <HomeButton variant="primary" label={t("startAcceptingCrypto")} />
        </Box>
      </Box>
    </section>
  );
};

export default FeaturesSection;