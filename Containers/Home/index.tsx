import { FC, ReactNode, memo } from "react";

import HomeFooter from "@/Components/Layout/HomeFooter";
import HomeHeader from "@/Components/Layout/HomeHeader";
import ScrollToTopButton from "@/Components/Layout/ScrollToTopButton";
import { MainBox, MainSection } from "./styled";

interface HomeLayoutProps {
  children: ReactNode;
}

const HomeLayout: FC<HomeLayoutProps> = ({ children }) => {
  return (
    <MainBox>
      <HomeHeader />

      <MainSection>{children}</MainSection>

      <HomeFooter />

      <ScrollToTopButton />
    </MainBox>
  );
};

export default memo(HomeLayout);
