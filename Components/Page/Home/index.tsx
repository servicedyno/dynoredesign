import { FC, memo } from "react";
import FeeSection from "./FeeSection";
import HeroSection from "./Hero";
import SocialProofSection from "./SocialProof";
import CoreValueProps from "./CoreValueProps";
import FinalCTA from "./FinalCTA";
import { HomeContainer, HomeFullWidthContainer, HomeWrapper } from "./styled";

const HomePage: FC = () => {
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

      <HomeFullWidthContainer>
        <FinalCTA />
      </HomeFullWidthContainer>
    </HomeWrapper>
  );
};

export default memo(HomePage);
