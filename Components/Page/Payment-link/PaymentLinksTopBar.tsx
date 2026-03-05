import SearchIcon from "@/assets/Icons/search-icon.svg";
import useIsMobile from "@/hooks/useIsMobile";
import { Box, InputBase } from "@mui/material";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { SearchIconButton } from "../Transactions/styled";

const PaymentLinksTopBar = ({
  onSearch,
}: {
  onSearch: (value: string) => void;
}) => {
  const { t } = useTranslation("paymentLinks");
  const isMobile = useIsMobile("md");

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        maxWidth: isMobile ? "100%" : "50%",
        p: { xs: "0px 16px", md: "0px" },
      }}
    >
      <InputBase
        placeholder={t("searchInputPlaceholder")}
        onChange={(e) => onSearch(e.target.value)}
        sx={{
          height: isMobile ? "32px" : "40px",
          width: "100%",
          borderRadius: "6px",
          border: "1px solid #E9ECF2",
          backgroundColor: "#FFFFFF",
          px: "10px",
          fontFamily: "UrbanistMedium",
          fontSize: isMobile ? "10px" : "13px",
          color: "#242428",
        }}
      />

      <SearchIconButton>
        <Image src={SearchIcon} alt="search" width={20} height={20} />
      </SearchIconButton>
    </Box>
  );
};

export default PaymentLinksTopBar;
