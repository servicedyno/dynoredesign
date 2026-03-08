import React, { memo } from "react";
import { useTranslation } from "react-i18next";
import { Box } from "@mui/material";
import useIsMobile from "@/hooks/useIsMobile";
import HomeSectionTitle from "@/Components/UI/SectionTitle";
import HomeButton from "@/Components/Layout/HomeButton";
import FeeCalculator from "@/Components/UI/FeeCalculator";

const FeeSection = () => {
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("fees");

  return (
    <section
      id="fee-calculator"
      style={{
        padding: isMobile ? "60px 0px" : "96px 0px",
        maxWidth: 1280,
        margin: "0 auto",
      }}
    >
      <HomeSectionTitle
        type="small"
        badgeText={t("feeSectionBadge")}
        title={`${t("feeSectionTitle")}`}
        highlightText={t("feeSectionHighlight")}
        subtitle={t("feeSectionSubtitle")}
        sx={{ maxWidth: "100%" }}
      />

      <Box sx={{ pt: isMobile ? 4 : 6, maxWidth: 720, mx: "auto" }}>
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
