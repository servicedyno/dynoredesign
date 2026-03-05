import Logo from "@/assets/Icons/home/dynopay-whiteLogo.svg";
import Facebook from "@/assets/Icons/home/Facebook.svg";
import Instagram from "@/assets/Icons/home/instagram.svg";
import LinkedIn from "@/assets/Icons/home/LinkeIn.svg";
import X from "@/assets/Icons/home/X.svg";
import useIsMobile from "@/hooks/useIsMobile";
import Image, { StaticImageData } from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { FC, memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  BottomSection,
  ContentRow,
  CopyrightText,
  DescriptionText,
  FooterContainer,
  FooterWrapper,
  LogoWrapper,
  Navigation,
  NavigationList,
  SocialItem,
  SocialsWrapper,
  TopSection,
} from "./styled";

interface SocialItemType {
  readonly label: string;
  readonly icon: StaticImageData;
  readonly link: string;
}

interface RouteItemType {
  readonly labelKey: string;
  readonly link: string;
}

const SOCIALS: readonly SocialItemType[] = [
  { label: "X", icon: X, link: "#" },
  { label: "Instagram", icon: Instagram, link: "#" },
  { label: "LinkedIn", icon: LinkedIn, link: "#" },
  { label: "Facebook", icon: Facebook, link: "#" },
] as const;

const ROUTES: readonly RouteItemType[] = [
  { labelKey: "documentation", link: "#" },
  { labelKey: "footerSandbox", link: "#" },
  { labelKey: "footerTerms", link: "/terms-conditions" },
  { labelKey: "footerPrivacy", link: "/privacy-policy" },
  { labelKey: "footerApiStatus", link: "/api-status" },
  { labelKey: "footerSupport", link: "#" },
] as const;

const HomeFooter: FC = () => {
  const router = useRouter();
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("landing");

  const routeItems = useMemo(
    () =>
      ROUTES.map((item) => (
        <Link key={item.labelKey} href={item.link}>
          <Navigation>{t(item.labelKey)}</Navigation>
        </Link>
      )),
    [t],
  );

  const socialItems = useMemo(
    () =>
      SOCIALS.map((item) => (
        <Link
          key={item.label}
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
        >
          <SocialItem>
            <Image src={item.icon} alt={item.label} width={20} height={20} />
          </SocialItem>
        </Link>
      )),
    [],
  );

  return (
    <FooterWrapper>
      <FooterContainer>
        <TopSection>
          <LogoWrapper onClick={() => router.push("/")}>
            <Image
              src={Logo}
              alt="DynoPay logo"
              width={134}
              height={45}
              priority
            />
          </LogoWrapper>

          <ContentRow>
            <DescriptionText>
              {t("footerDescription1")}
              <br />
              {t("footerDescription2")}
            </DescriptionText>

            <NavigationList>{routeItems}</NavigationList>
          </ContentRow>
        </TopSection>

        <BottomSection>
          <CopyrightText>{t("footerCopyright")}</CopyrightText>
          <SocialsWrapper>{socialItems}</SocialsWrapper>
        </BottomSection>
      </FooterContainer>
    </FooterWrapper>
  );
};

export default memo(HomeFooter);
