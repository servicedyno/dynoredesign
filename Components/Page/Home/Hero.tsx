import HomeButton from "@/Components/Layout/HomeButton";
import HomeSectionTitle from "@/Components/UI/SectionTitle";
import { useDevice } from "@/hooks/useDevice";
import useIsMobile from "@/hooks/useIsMobile";
import Image from "next/image";
import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  BitcoinFloat,
  ButtonsRow,
  DashboardDesktopBox,
  DashboardDesktopStage,
  DashboardMobileBox,
  DesktopShowcase,
  EthereumFloat,
  LitecoinDesktopFloat,
  LitecoinMobileFloat,
  MobilePaymentBox,
  MobileSection,
  MobileWalletBox,
  PaymentCard,
  Root,
  TitleArea,
  TopSection,
  WalletCard,
} from "./styled";

import BitcoinBg_png from "@/assets/Images/home/Bitcoin-bg.png";
import Dashboard_png from "@/assets/Images/home/Dashboard.png";
import EthereumBg_png from "@/assets/Images/home/Ethereum-bg.png";
import LitecoinBg_png from "@/assets/Images/home/Litecoin-bg.png";
import Payment_png from "@/assets/Images/home/Payment-Container.png";
import Wallet_png from "@/assets/Images/home/Wallet.png";

import BitcoinBg_svg from "@/assets/Images/home/Bitcoin-bg.svg";
import Dashboard_svg from "@/assets/Images/home/Dashboard.svg";
import EthereumBg_svg from "@/assets/Images/home/Ethereum-bg.svg";
import LitecoinBg_svg from "@/assets/Images/home/Litecoin-bg.svg";
import Payment_svg from "@/assets/Images/home/Payment-Container.svg";
import Wallet_svg from "@/assets/Images/home/Wallet.svg";

type DeviceOS = "ios" | "android" | "web";
type DeviceBrowser = "safari" | "chrome" | "firefox" | "edge" | "other";

type LandingTranslationKey =
  | "heroBadge"
  | "heroTitle"
  | "heroHighlight"
  | "heroSubtitle"
  | "startAcceptingCrypto"
  | "learnMore";

const HeroSection = () => {
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

  const assets = useMemo(
    () => ({
      dashboard: isSafariLike ? Dashboard_png : Dashboard_svg,
      wallet: isSafariLike ? Wallet_png : Wallet_svg,
      payment: isSafariLike ? Payment_png : Payment_svg,
      bitcoinBg: isSafariLike ? BitcoinBg_png : BitcoinBg_svg,
      ethereumBg: isSafariLike ? EthereumBg_png : EthereumBg_svg,
      litecoinBg: isSafariLike ? LitecoinBg_png : LitecoinBg_svg,
    }),
    [isSafariLike],
  );

  const isIOS = os === "ios";

  return (
    <Root>
      <TopSection>
        <TitleArea>
          <HomeSectionTitle
            type="large"
            badgeText={tLanding("heroBadge")}
            title={tLanding("heroTitle")}
            highlightText={tLanding("heroHighlight")}
            subtitle={tLanding("heroSubtitle")}
          />

          <BitcoinFloat>
            <Image
              src={assets.bitcoinBg}
              alt="background"
              fill
              className="bitcoinImg"
              draggable={false}
            />
          </BitcoinFloat>

          <EthereumFloat>
            <Image
              src={assets.ethereumBg}
              alt="background"
              fill
              className="ethereumImg"
              draggable={false}
            />
          </EthereumFloat>
        </TitleArea>

        <ButtonsRow>
          <HomeButton
            variant="primary"
            label={tLanding("startAcceptingCrypto")}
          />
          <HomeButton variant="outlined" label={tLanding("learnMore")} />
        </ButtonsRow>
      </TopSection>

      <DesktopShowcase>
        <DashboardDesktopStage>
          <DashboardDesktopBox>
            <LitecoinDesktopFloat>
              <Image
                src={assets.litecoinBg}
                alt="Bitcoin Background"
                fill
                className="litecoinDesktopImg"
                draggable={false}
              />
            </LitecoinDesktopFloat>

            <Image
              src={assets.dashboard}
              alt="Dashboard Container"
              fill
              className="dashboardDesktopImg"
              priority
              quality={100}
              draggable={false}
            />
          </DashboardDesktopBox>
        </DashboardDesktopStage>

        <WalletCard>
          <Image
            src={assets.wallet}
            alt="Wallet Container"
            fill
            className={isIOS ? "walletImgIOS" : "walletImg"}
            quality={100}
            draggable={false}
          />
        </WalletCard>

        <PaymentCard>
          <Image
            src={assets.payment}
            alt="Payment Container"
            fill
            className={isIOS ? "paymentImgIOS" : "paymentImg"}
            quality={100}
            draggable={false}
          />
        </PaymentCard>
      </DesktopShowcase>

      <MobileSection>
        <MobileWalletBox>
          <Image
            src={assets.wallet}
            alt="Wallet Container"
            fill
            className={isIOS ? "walletMobileImgIOS" : "walletMobileImg"}
            quality={100}
            draggable={false}
          />
        </MobileWalletBox>

        <MobilePaymentBox>
          <Image
            src={assets.payment}
            alt="Payment Container"
            fill
            className={isIOS ? "paymentMobileImgIOS" : "paymentMobileImg"}
            quality={100}
            draggable={false}
          />
        </MobilePaymentBox>

        <LitecoinMobileFloat>
          <Image
            src={assets.litecoinBg}
            alt="Dashboard Mobile"
            fill
            className={isIOS ? "litecoinMobileImgIOS" : "litecoinMobileImg"}
            draggable={false}
          />
        </LitecoinMobileFloat>

        <DashboardMobileBox>
          <Image
            src={assets.dashboard}
            alt="Dashboard Mobile"
            fill
            className={isIOS ? "dashboardMobileImgIOS" : "dashboardMobileImg"}
            draggable={false}
            quality={100}
            priority={Boolean(isMobile)}
          />
        </DashboardMobileBox>
      </MobileSection>
    </Root>
  );
};

export default memo(HeroSection);
