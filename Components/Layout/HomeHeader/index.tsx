import DynopayLogo from "@/assets/Images/auth/dynopay-logo.svg";
import LanguageSwitcher from "@/Components/UI/LanguageSwitcher";
import useIsMobile from "@/hooks/useIsMobile";
import { Button } from "@mui/material";
import Image from "next/image";
import { useRouter } from "next/router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import HomeButton from "../HomeButton";
import {
  Actions,
  ClickableLogo,
  DesktopLanguageWrapper,
  FixedHeader,
  HeaderContainer,
  HeaderDivider,
  LeftGroup,
  MenuCloseIcon,
  MenuOpenIcon,
  MobileDrawer,
  MobileLanguageWrapper,
  MobileMenuButton,
  MobileMenuDrawer,
  MobileNavContent,
  MobileNavItem,
  NavLinks,
  RightGroup,
  StyledGetStartedButton,
  StyledSignInButton,
} from "./styled";

/* ================= TYPES ================= */

type SectionId = "how-it-works" | "features" | "use-cases";

type TranslationKey = "howItWorks" | "features" | "useCases" | "documentation";

interface HeaderItem {
  translationKey: TranslationKey;
  path: string;
  sectionId?: SectionId;
}

/* ================= CONSTANTS ================= */

const HEADER_OFFSET_PX = 100;
const SCROLL_THRESHOLD_PX = 10;

const HEADER_ITEMS: readonly HeaderItem[] = [
  { translationKey: "howItWorks", sectionId: "how-it-works", path: "/" },
  { translationKey: "features", sectionId: "features", path: "/" },
  { translationKey: "useCases", sectionId: "use-cases", path: "/" },
  { translationKey: "documentation", path: "/" },
] as const;

/* ================= COMPONENT ================= */

const HomeHeader = memo(function HomeHeader() {
  const router = useRouter();
  const { t } = useTranslation("landing");
  const isMobile = useIsMobile("md");

  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState<boolean>(true);

  const lastScrollY = useRef<number>(0);
  const ticking = useRef<boolean>(false);

  /* ================= NAVIGATION ================= */

  const navigateHome = useCallback(() => {
    void router.push("/");
  }, [router]);

  const scrollToSection = useCallback((id?: SectionId) => {
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;

    const top =
      el.getBoundingClientRect().top + window.pageYOffset - HEADER_OFFSET_PX;

    window.scrollTo({ top, behavior: "smooth" });
  }, []);

  const handleNav = useCallback(
    (item: HeaderItem) => {
      if (item.sectionId) {
        if (router.pathname !== "/") {
          void router.push("/").then(() => {
            setTimeout(() => scrollToSection(item.sectionId), 80);
          });
        } else {
          scrollToSection(item.sectionId);
        }
      } else {
        void router.push(item.path);
      }

      setMobileMenuOpen(false);
    },
    [router, scrollToSection],
  );

  /* ================= HEADER VISIBILITY ================= */

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        let visible = isHeaderVisible;

        if (currentY < SCROLL_THRESHOLD_PX) {
          visible = true;
        } else if (currentY > lastScrollY.current) {
          visible = false;
        } else {
          visible = true;
        }

        lastScrollY.current = currentY;
        setIsHeaderVisible(visible);
        ticking.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHeaderVisible]);

  /* ================= SCROLL LOCK ================= */

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    if (mobileMenuOpen) {
      const scrollBarWidth = window.innerWidth - html.clientWidth;

      html.style.overflow = "hidden";
      body.style.overflow = "hidden";
      body.style.paddingRight = `${scrollBarWidth}px`;
    } else {
      html.style.overflow = "";
      body.style.overflow = "";
      body.style.paddingRight = "";
    }

    return () => {
      html.style.overflow = "";
      body.style.overflow = "";
      body.style.paddingRight = "";
    };
  }, [mobileMenuOpen]);

  /* ================= RENDER ================= */

  return (
    <FixedHeader
      sx={{
        transform: isHeaderVisible ? "translateY(0)" : "translateY(-100%)",
      }}
    >
      <HeaderContainer aria-label="Primary navigation">
        <LeftGroup>
          <ClickableLogo
            type="button"
            aria-label="Go to home"
            onClick={navigateHome}
          >
            <Image
              src={DynopayLogo}
              alt="Dynopay"
              width={134}
              height={45}
              draggable={false}
              priority
            />
          </ClickableLogo>

          <NavLinks>
            {HEADER_ITEMS.map((item) => (
              <Button
                key={item.translationKey}
                disableRipple
                onClick={() => handleNav(item)}
              >
                {t(item.translationKey)}
              </Button>
            ))}
          </NavLinks>
        </LeftGroup>

        <RightGroup>
          <Actions>
            {!isMobile && (
              <DesktopLanguageWrapper>
                <LanguageSwitcher />
              </DesktopLanguageWrapper>
            )}

            <StyledSignInButton
              disableRipple
              onClick={() => void router.push("/auth/login")}
            >
              {t("signIn")}
            </StyledSignInButton>

            <StyledGetStartedButton>
              <HomeButton
                variant="primary"
                label={t("getStarted")}
                showIcon={false}
                navigateTo="/auth/register"
                sx={{
                  borderRadius: "8px",
                  padding: "8px 12px",
                  minWidth: "98px",
                }}
              />
            </StyledGetStartedButton>
          </Actions>

          <MobileMenuButton
            aria-label="Toggle menu"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            {mobileMenuOpen ? <MenuCloseIcon /> : <MenuOpenIcon />}
          </MobileMenuButton>
        </RightGroup>
      </HeaderContainer>

      <MobileMenuDrawer
        anchor="right"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        ModalProps={{ keepMounted: true }}
      >
        <MobileDrawer>
          <MobileNavContent>
            {HEADER_ITEMS.map((item) => (
              <MobileNavItem
                key={item.translationKey}
                onClick={() => handleNav(item)}
              >
                {t(item.translationKey)}
              </MobileNavItem>
            ))}

            <MobileLanguageWrapper>
              <LanguageSwitcher showBig={true} />
            </MobileLanguageWrapper>
          </MobileNavContent>
        </MobileDrawer>
      </MobileMenuDrawer>

      <HeaderDivider />
    </FixedHeader>
  );
});

export default HomeHeader;
