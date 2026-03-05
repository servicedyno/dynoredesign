import EmptyDataModel from "@/Components/UI/EmptyDataModel";
import useIsMobile from "@/hooks/useIsMobile";
import { PaymentLinkData, PaymentLinksProps } from "@/utils/types/paymentLink";
import { Box, CircularProgress } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { PaymentLinkAction } from "@/Redux/Actions";
import { PAYLINK_FETCH } from "@/Redux/Actions/PaymentLinkAction";
import { rootReducer } from "@/utils/types";
import PaymentLinksTable from "./PaymentLinksTable";
import PaymentLinksTopBar from "./PaymentLinksTopBar";

const PaymentLinksPage = ({
  setPageName,
  setPageDescription,
  setPageAction,
}: PaymentLinksProps) => {
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setPageName?.("");
    setPageDescription?.("");
    setPageAction?.(null);
  }, []);

  useEffect(() => {
    dispatch(PaymentLinkAction(PAYLINK_FETCH));
  }, [dispatch]);

  const isMobile = useIsMobile("md");

  const paymentLinkState = useSelector(
    (state: rootReducer) => state.paymentLinkReducer
  );

  // Map API data to PaymentLinkData format
  const paymentLinks: PaymentLinkData[] = useMemo(() => {
    return paymentLinkState.paymentLinks.map((link: any) => ({
      id: link._id || link.link_id || link.id,
      description: link.description || "",
      usdValue: link.amount ? link.amount.toLocaleString() : "0",
      cryptoValue: link.crypto_amount
        ? `${link.crypto_amount} ${link.crypto_currency || ""}`
        : undefined,
      createdAt: link.created_at || link.createdAt || "",
      expiresAt: link.expires_at || link.expiresAt || "",
      status: link.status || "pending",
      timesUsed: link.times_used || link.timesUsed || 0,
    }));
  }, [paymentLinkState.paymentLinks]);

  // Filter by search query
  const filteredLinks = useMemo(() => {
    if (!searchQuery) return paymentLinks;
    const q = searchQuery.toLowerCase();
    return paymentLinks.filter(
      (link) =>
        link.description.toLowerCase().includes(q) ||
        link.id.toLowerCase().includes(q)
    );
  }, [paymentLinks, searchQuery]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
  };

  if (paymentLinkState.loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (filteredLinks?.length === 0) {
    return <EmptyDataModel pageName="payment-links" />;
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        "> :not(:last-child)": {
          marginBottom: isMobile ? "10px" : "20px",
        },
      }}
    >
      <PaymentLinksTopBar onSearch={handleSearch} />

      <PaymentLinksTable paymentLinks={filteredLinks} rowsPerPage={5} />
    </Box>
  );
};

export default PaymentLinksPage;
