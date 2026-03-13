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
import TrialLinkCreator from "./TrialLinkCreator";
import { HomeContainer, HomeFullWidthContainer, HomeWrapper } from "./styled";
import { Box, Typography } from "@mui/material";

interface HomePageProps {}

const HomePage: FC<HomePageProps> = () => {
  useIsMobile("md");

  return (
    <HomeWrapper>
      <HomeContainer>
        <HeroSection />
      </HomeContainer>

      {/* Try Before You Sign Up — Trial Link Creator */}
      <HomeFullWidthContainer>
        <Box
          id="try-it"
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            py: { xs: 6, md: 8 },
            px: 2,
            background: "linear-gradient(180deg, #0a0b14 0%, #12131C 50%, #0a0b14 100%)",
          }}
        >
          <Typography
            sx={{
              color: "#0004FF",
              fontSize: 13,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 2,
              mb: 1,
            }}
          >
            Try It Now
          </Typography>
          <Typography
            variant="h4"
            sx={{
              color: "#fff",
              fontWeight: 800,
              textAlign: "center",
              mb: 1,
              fontSize: { xs: 24, md: 32 },
            }}
          >
            Create a Payment Link — No Account Needed
          </Typography>
          <Typography
            sx={{
              color: "#676768",
              textAlign: "center",
              mb: 4,
              maxWidth: 500,
              fontSize: { xs: 14, md: 16 },
            }}
          >
            Generate a crypto payment link in seconds. Share it with anyone. Get paid. Then claim your funds.
          </Typography>
          <TrialLinkCreator />
        </Box>
      </HomeFullWidthContainer>

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
