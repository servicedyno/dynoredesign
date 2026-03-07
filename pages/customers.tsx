import CustomersPage from "@/Components/Page/Customers";
import { pageProps } from "@/utils/types";
import { Box } from "@mui/material";
import { useEffect } from "react";

const Customers = ({ setPageName, setPageDescription }: pageProps) => {
  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName("Customers");
      setPageDescription("Manage your customer wallets and transactions");
    }
  }, [setPageName, setPageDescription]);

  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      <CustomersPage />
    </Box>
  );
};

export default Customers;
