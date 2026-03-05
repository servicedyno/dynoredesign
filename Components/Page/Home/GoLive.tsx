import HomeCard from "@/Components/UI/HomeCard";
import { GoLiveCount } from "@/Components/UI/HomeCard/styled";
import HomeSectionTitle from "@/Components/UI/SectionTitle";
import { useDevice } from "@/hooks/useDevice";
import useIsMobile from "@/hooks/useIsMobile";
import { Grid } from "@mui/material";
import Image, { StaticImageData } from "next/image";
import React, { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  CardContent,
  CardDescription,
  CardsWrapper,
  CardTitle,
  ImageBox,
  SectionRoot,
  StyledGridItem,
} from "./styled";

import AllWalletsImage_png from "@/assets/Images/home/all-wallets.png";
import AllWalletsImage_svg from "@/assets/Images/home/all-wallets.svg";
import CompanySelectorImage_png from "@/assets/Images/home/company-dropdown.png";
import CompanySelectorImage_svg from "@/assets/Images/home/company-dropdown.svg";
import PaymentLinkAddImage_png from "@/assets/Images/home/payment-link-create.png";
import PaymentLinkAddImage_svg from "@/assets/Images/home/payment-link-create.svg";

type DeviceOS = "ios" | "android" | "web";
type DeviceBrowser = "safari" | "chrome" | "firefox" | "edge" | "other";

type LandingTranslationKey =
  | "howItWorks"
  | "goLiveTitle"
  | "goLiveHighlight"
  | "goLiveSubtitle"
  | "goLiveCard1Title"
  | "goLiveCard1Description"
  | "goLiveCard2Title"
  | "goLiveCard2Description"
  | "goLiveCard3Title"
  | "goLiveCard3Description";

type GoLiveCardKey = 1 | 2 | 3;

interface GoLiveCardConfig {
  id: GoLiveCardKey;
  titleKey: LandingTranslationKey;
  descriptionKey: LandingTranslationKey;
  imageSvg: StaticImageData;
  imagePng: StaticImageData;
}

const GoLiveSection: React.FC = () => {
  const isMobile = useIsMobile("md");
  const { os, browser } = useDevice() as {
    os: DeviceOS;
    browser: DeviceBrowser;
  };
  const { t } = useTranslation("landing");

  const tLanding = (key: LandingTranslationKey): string => {
    const value = t(key, { ns: "landing" });
    return typeof value === "string" ? value : String(value);
  };

  const isSafariLike = useMemo<boolean>(
    () => os === "ios" || browser === "safari",
    [os, browser],
  );

  const cards = useMemo<GoLiveCardConfig[]>(
    () => [
      {
        id: 1,
        titleKey: "goLiveCard1Title",
        descriptionKey: "goLiveCard1Description",
        imageSvg: CompanySelectorImage_svg,
        imagePng: CompanySelectorImage_png,
      },
      {
        id: 2,
        titleKey: "goLiveCard2Title",
        descriptionKey: "goLiveCard2Description",
        imageSvg: AllWalletsImage_svg,
        imagePng: AllWalletsImage_png,
      },
      {
        id: 3,
        titleKey: "goLiveCard3Title",
        descriptionKey: "goLiveCard3Description",
        imageSvg: PaymentLinkAddImage_svg,
        imagePng: PaymentLinkAddImage_png,
      },
    ],
    [],
  );

  const cardSize = useMemo(() => {
    const width = isMobile ? 338 : 395;
    const height = isMobile ? 645 : 612;
    return { width, height };
  }, [isMobile]);

  const sectionPaddingVariant = isMobile ? "mobile" : "desktop";

  return (
    <SectionRoot id="how-it-works" data-pad={sectionPaddingVariant}>
      <HomeSectionTitle
        type="small"
        badgeText={tLanding("howItWorks")}
        title={tLanding("goLiveTitle")}
        highlightText={tLanding("goLiveHighlight")}
        subtitle={tLanding("goLiveSubtitle")}
        sx={{ maxWidth: "100%" }}
      />

      <CardsWrapper data-pt={isMobile ? "mobile" : "desktop"}>
        <Grid container spacing={4} justifyContent="center">
          {cards.map((card, idx) => {
            const index = idx + 1;
            const imgSrc = isSafariLike ? card.imagePng : card.imageSvg;
            const imgWidthVariant =
              isMobile && card.id === 3
                ? "wide3"
                : isMobile
                  ? "wide"
                  : "normal";

            return (
              <StyledGridItem
                key={card.id}
                item
                xs={12}
                sm={12}
                md={6}
                lg={4}
                xl={4}
              >
                <HomeCard height={cardSize.height} width={cardSize.width}>
                  <CardContent data-mobile={isMobile ? "true" : "false"}>
                    <GoLiveCount>0{index}</GoLiveCount>

                    <CardTitle>{tLanding(card.titleKey)}</CardTitle>
                    <CardDescription>
                      {tLanding(card.descriptionKey)}
                    </CardDescription>

                    <ImageBox>
                      <Image
                        src={imgSrc}
                        alt={tLanding(card.titleKey)}
                        quality={100}
                        priority={idx < 3}
                        className={imgWidthVariant}
                        draggable={false}
                      />
                    </ImageBox>
                  </CardContent>
                </HomeCard>
              </StyledGridItem>
            );
          })}
        </Grid>
      </CardsWrapper>
    </SectionRoot>
  );
};

export default memo(GoLiveSection);
