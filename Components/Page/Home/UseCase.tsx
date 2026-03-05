import HomeSectionTitle from "@/Components/UI/SectionTitle";
import { Box, Grid, Typography } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import Image from "next/image";
import { homeTheme } from "@/styles/homeTheme";
import useCase1 from "@/assets/Images/UseCase/use-case-1.svg";
import useCase2 from "@/assets/Images/UseCase/use-case-2.svg";
import useCase3 from "@/assets/Images/UseCase/use-case-3.svg";
import { styled } from "@mui/material/styles";
import useCase4 from "@/assets/Images/UseCase/use-case-4.svg";
import { theme } from "@/styles/theme";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import UseCaseBanner from "@/Components/UI/UseCaseBanner";
import useIsMobile from "@/hooks/useIsMobile";

const UseCaseCard = styled(Box)(() => ({
  backgroundColor: "#FFFFFF",
  borderRadius: "20px",
  padding: "26px",
  height: "100%",
  display: "flex",
  alignItems: "start",
  gap: "20px",
  border: `1px solid ${homeTheme.palette.border.main}`,
  position: "relative",
  overflow: "hidden",
}));

const UseCaseImage = styled(Box)(() => ({
  width: "163px",
  height: "133px",
  borderRadius: "10px",
  overflow: "hidden",
  zIndex: 1,
  [theme.breakpoints.down("md")]: {
    width: "121px",
    height: "133px",
  },
}));

const UseCaseTitleWrapper = styled(Box)(() => ({
  display: "flex",
  flexDirection: "column",
  gap: "13px",
  flex: 1,
}));

const UseCaseTitle = styled(Typography)(() => ({
  fontSize: "18px",
  fontWeight: 500,
  fontFamily: "OutfitSemiBold",
  color: homeTheme.palette.text.primary,
  lineHeight: "28px",
  letterSpacing: 0,
}));

const UseCaseDescription = styled(Typography)(() => ({
  fontSize: "14px",
  lineHeight: "20px",
  fontWeight: 400,
  maxWidth: "244px",
  fontFamily: "OutfitRegular",
  letterSpacing: 0,
  color: homeTheme.palette.text.secondary,
}));

const UseCaseTag = styled(Typography)(() => ({
  padding: "6px 9px",
  borderRadius: "100px",
  width: "fit-content",
  backgroundColor: theme.palette.success.main,
  fontSize: "13px",
  lineHeight: "18px",
  fontWeight: 500,
  fontFamily: "OutfitMedium",
  color: theme.palette.success.dark,
  border: `1px solid ${theme.palette.success.light}`,
  display: "flex",
  justifyContent: "start",
  gap: "5px",
  alignItems: "center",
}));

const UseCaseSection = () => {
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("landing");

  const useCases = [
    {
      image: useCase1,
      titleKey: "useCase1Title",
      descriptionKey: "useCase1Description",
      tagKey: "useCase1Tag",
    },
    {
      image: useCase2,
      titleKey: "useCase2Title",
      descriptionKey: "useCase2Description",
      tagKey: "useCase2Tag",
    },
    {
      image: useCase3,
      titleKey: "useCase3Title",
      descriptionKey: "useCase3Description",
      tagKey: "useCase3Tag",
    },
    {
      image: useCase4,
      titleKey: "useCase4Title",
      descriptionKey: "useCase4Description",
      tagKey: "useCase4Tag",
    },
  ];

  return (
    <section id="use-cases">
      <Box sx={{ py: "53px" }}>
        <Box
          sx={{
            p: "30px 0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            [theme.breakpoints.down("md")]: {
              p: "30px 0",
              gap: 5,
            },
          }}
        >
          <HomeSectionTitle
            type="small"
            badgeText={t("useCases")}
            title={t("useCaseTitle")}
            highlightText={t("useCaseHighlight")}
            subtitle={t("useCaseSubtitle")}
          />

          <Grid container spacing={isMobile ? "25px" : 3} sx={{ width: "100%" }}>
            {useCases.map((useCase) => (
              <Grid item xs={12} md={6} key={useCase.titleKey}>
                <UseCaseCard>
                  <Box
                    sx={{
                      width: "203px",
                      height: "203px",
                      bgcolor: `${homeTheme.palette.primary.main}0D`,
                      borderRadius: "100%",
                      filter: "blur(25px)",
                      position: "absolute",
                      top: "-50%",
                      left: "-15%",
                      zIndex: 0,
                    }}
                  />
                  <UseCaseImage>
                    <Image
                      src={useCase.image}
                      alt={t(useCase.titleKey)}
                      width={163}
                      height={133}
                      style={{
                        objectFit: "cover",
                        height: "100%",
                        width: "100%",
                      }}
                      draggable={false}
                    />
                  </UseCaseImage>

                  <UseCaseTitleWrapper>
                    <UseCaseTitle>{t(useCase.titleKey)}</UseCaseTitle>

                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "11px",
                      }}
                    >
                      <UseCaseDescription>
                        {t(useCase.descriptionKey)}
                      </UseCaseDescription>

                      <UseCaseTag>
                        <CheckCircleRoundedIcon sx={{ fontSize: 16 }} />
                        {t(useCase.tagKey)}
                      </UseCaseTag>
                    </Box>
                  </UseCaseTitleWrapper>
                </UseCaseCard>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>
      <Box sx={{ pb: "53px" }}>
        <UseCaseBanner />
      </Box>
    </section>
  );
};

export default UseCaseSection;
