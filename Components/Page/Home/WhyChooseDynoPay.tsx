import React from "react";
import { useTranslation } from "react-i18next";
import Image from "next/image";
import HomeCard from "@/Components/UI/HomeCard";
import { Box, Grid, Typography } from "@mui/material";
import useIsMobile from "@/hooks/useIsMobile";
import {
  WhyChooseUsCard,
  WhyChooseDynoPayIcon,
  WhyChooseDynoPayTitle,
  WhyChooseDynoPayDescription,
} from "@/Components/UI/HomeCard/styled";
import HomeSectionTitle from "@/Components/UI/SectionTitle";
import LowerFeesIcon from "@/assets/Icons/home/lower-arrow-icon.svg";
import FullControlOfFundsIcon from "@/assets/Icons/home/shield-icon.svg";
import FastIntegrationIcon from "@/assets/Icons/home/light-bolt-icon.svg";
import GlobalReachIcon from "@/assets/Icons/home/global-icon.svg";

const WhyChooseDynopaySection = () => {
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("landing");

  const whyChooseItems = [
    {
      icon: LowerFeesIcon,
      titleKey: "whyChoose1Title",
      descriptionKey: "whyChoose1Description",
    },
    {
      icon: FullControlOfFundsIcon,
      titleKey: "whyChoose2Title",
      descriptionKey: "whyChoose2Description",
    },
    {
      icon: FastIntegrationIcon,
      titleKey: "whyChoose3Title",
      descriptionKey: "whyChoose3Description",
    },
    {
      icon: GlobalReachIcon,
      titleKey: "whyChoose4Title",
      descriptionKey: "whyChoose4Description",
    },
  ];

  return (
    <section
      style={{
        padding: "96px 0px",
        maxWidth: "1280px",
        margin: "0 auto",
      }}
    >
      {/* Why Choose DynoPay Section Title */}
      <HomeSectionTitle
        type="small"
        badgeText={t("whyChooseBadge")}
        title={t("whyChooseTitle")}
        highlightText={t("whyChooseHighlight")}
        subtitle={t("whyChooseSubtitle")}
        sx={{ maxWidth: "100%" }}
      />
      {/* Why Choose DynoPay Section Cards */}
      <Box
        sx={{
          paddingTop: isMobile ? 5 : 8,
          paddingX: 2,
        }}
      >
        <Grid container spacing={3}>
          {whyChooseItems.map((item, index) => (
            <Grid key={index} item xs={12} sm={6} md={6} lg={3} xl={3}>
              <Box
                sx={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <WhyChooseUsCard>
                  <WhyChooseDynoPayIcon>
                    <Image
                      src={item.icon}
                      alt={t(item.titleKey)}
                      width={28}
                      height={28}
                      draggable={false}
                    />
                  </WhyChooseDynoPayIcon>

                  <WhyChooseDynoPayTitle sx={{ marginTop: 2 }}>
                    {t(item.titleKey)}
                  </WhyChooseDynoPayTitle>
                  <WhyChooseDynoPayDescription sx={{ marginTop: 1 }}>
                    {t(item.descriptionKey)}
                  </WhyChooseDynoPayDescription>
                </WhyChooseUsCard>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>
    </section>
  );
};

export default WhyChooseDynopaySection;
