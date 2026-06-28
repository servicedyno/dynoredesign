import { FC, memo, useEffect } from "react";
import FeeSection from "./FeeSection";
import HeroSection from "./Hero";
import SocialProofSection from "./SocialProof";
import CoreValueProps from "./CoreValueProps";
import FinalCTA from "./FinalCTA";
import Testimonials from "./Testimonials";
import FAQ from "./FAQ";
import { HomeContainer, HomeFullWidthContainer, HomeWrapper } from "./styled";

const HomePage: FC = () => {
  // ─── Visitor tracking: notify admin of new unique visitors ───
  useEffect(() => {
    // Fire once per browser session (sessionStorage clears on tab close)
    if (typeof window === "undefined") return;
    const key = "dynopay_visitor_tracked";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    const apiBase = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
    fetch(`${apiBase}/api/track/visitor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page: window.location.pathname,
        referrer: document.referrer || null,
      }),
    }).catch(() => {}); // Fire-and-forget — never block the UI
  }, []);

  return (
    <HomeWrapper>
      <HomeContainer>
        <HeroSection />
      </HomeContainer>

      <HomeFullWidthContainer>
        <SocialProofSection />
      </HomeFullWidthContainer>

      <HomeContainer>
        <CoreValueProps />
      </HomeContainer>

      <HomeFullWidthContainer>
        <FeeSection />
      </HomeFullWidthContainer>

      <HomeContainer>
        <Testimonials />
      </HomeContainer>

      <HomeFullWidthContainer>
        <FAQ />
      </HomeFullWidthContainer>

      <HomeFullWidthContainer>
        <FinalCTA />
      </HomeFullWidthContainer>
    </HomeWrapper>
  );
};

export default memo(HomePage);
