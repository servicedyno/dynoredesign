import useIsMobile from "@/hooks/useIsMobile";
import { FC, memo } from "react";
import FeaturesSection from "./Features";
import GoLiveSection from "./GoLive";
import HeroSection from "./Hero";
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
        <GoLiveSection />
      </HomeFullWidthContainer>

      <HomeContainer>
        <FeaturesSection />
      </HomeContainer>

      <HomeFullWidthContainer>
        <WhyChooseDynopaySection />
      </HomeFullWidthContainer>

      <HomeContainer>
        <UseCaseSection />
      </HomeContainer>
    </HomeWrapper>
  );
};

export default memo(HomePage);
