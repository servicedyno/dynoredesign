import useIsMobile from "@/hooks/useIsMobile";
import { FC, memo } from "react";
import FeeSection from "./FeeSection";
import FeaturesSection from "./Features";
import GoLiveSection from "./GoLive";
import HeroSection from "./Hero";
import SocialProofSection from "./SocialProof";
import TrustBadgesSection from "./TrustBadges";
import UseCaseSection from "./UseCase";
import WhyChooseDynopaySection from "./WhyChooseDynoPay";
import { HomeContainer, HomeFullWidthContainer, HomeWrapper } from "./styled";

interface HomePageProps {}

const HomePage: FC<HomePageProps> = () => {
  useIsMobile("md");

  return (
    <HomeWrapper>
      <HomeContainer>
        <HeroSection />
      </HomeContainer>

      <HomeFullWidthContainer>
        <SocialProofSection />
      </HomeFullWidthContainer>

      <HomeFullWidthContainer>
        <GoLiveSection />
      </HomeFullWidthContainer>

      <HomeContainer>
        <FeaturesSection />
      </HomeContainer>

      <HomeFullWidthContainer>
        <WhyChooseDynopaySection />
      </HomeFullWidthContainer>

      <HomeFullWidthContainer>
        <FeeSection />
      </HomeFullWidthContainer>

      <HomeContainer>
        <TrustBadgesSection />
      </HomeContainer>

      <HomeContainer>
        <UseCaseSection />
      </HomeContainer>
    </HomeWrapper>
  );
};

export default memo(HomePage);
