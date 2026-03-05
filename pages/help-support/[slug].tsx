import { GetStaticPaths, GetStaticProps, NextPage } from "next";
import HelpAndSupportData from "@/hooks/useHelpAndSupportData";
import GettingStartedWithDynopay from "@/Components/Page/HelpAndSupport/Slugs/getting-started-with-dynopay";
import { HelpArticle } from "@/pages/help-support/index";
import { Box } from "@mui/material";
import { theme } from "@/styles/theme";
import useIsMobile from "@/hooks/useIsMobile";
import { useTranslation } from "react-i18next";
import { SearchIconButton } from "@/Components/Page/HelpAndSupport/styled";
import Image from "next/image";
import SearchIcon from "@/assets/Icons/search-icon.svg";
import { pageProps } from "@/utils/types";
import { useEffect } from "react";

interface HelpDetailProps {
  article: HelpArticle;
}

const HelpDetail = ({
  article,
  setPageName,
  setPageDescription,
}: HelpDetailProps & pageProps) => {
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("helpAndSupport");

  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName(t("helpAndSupportTitle"));
      setPageDescription(t("helpAndSupportDescription"));
    }
  }, [setPageName, setPageDescription, t]);

  return (
    <Box sx={{ flex: 1, display: "flex", minHeight: 0 }}>
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "auto"
        }}
      >
        <Box sx={{ position: "sticky", top: 0, left: 0, pb: "20px", backgroundColor: theme.palette.secondary.main, zIndex: 1 }}>
          <Box sx={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Box
              sx={{
                "& input:focus": {
                  borderColor: "#0004FF",
                },
              }}>
              <input
                type="text"
                // value={searchTerm}
                // onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t("searchPlaceholder")}
                style={{
                  width: isMobile ? "300px" : "639px",
                  fontSize: isMobile ? "10px" : "13px",
                  fontFamily: "UrbanistMedium",
                  lineHeight: "100%",
                  letterSpacing: 0,
                  fontWeight: 500,
                  padding: "12px 13.5px",
                  border: "1px solid #E9ECF2",
                  backgroundColor: "#FFFFFF",
                  borderRadius: "6px",
                  outline: "none",
                  transition: "0.2s",
                }}
              />
            </Box>
            <SearchIconButton
            // onClick={handleSearch}
            >
              <Image src={SearchIcon} alt="search" width={20} height={20} />
            </SearchIconButton>
          </Box>
        </Box>

        <GettingStartedWithDynopay data={article} />
      </Box>
    </Box>
  );
};

export default HelpDetail;

export const getStaticPaths: GetStaticPaths = async () => {
  const paths = (HelpAndSupportData as HelpArticle[]).map((item) => ({
    params: { slug: item.slug },
  }));

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<HelpDetailProps> = async ({
  params,
}) => {
  const article = (HelpAndSupportData as HelpArticle[]).find(
    (item) => item.slug === params?.slug
  );

  if (!article) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      article,
    },
  };
};