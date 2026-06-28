import SearchIcon from "@/assets/Icons/search-icon.svg";
import useIsMobile from "@/hooks/useIsMobile";
import { Box, InputBase, MenuItem, Select, useTheme } from "@mui/material";
import Image from "next/image";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SearchIconButton } from "../Transactions/styled";

export type PaymentLinkStatusFilter = "all" | "active" | "completed" | "expired" | "pending";

interface PaymentLinksTopBarProps {
  onSearch: (value: string) => void;
  onStatusFilter: (status: PaymentLinkStatusFilter) => void;
  onDateFilter: (start: string, end: string) => void;
  statusFilter: PaymentLinkStatusFilter;
}

const PaymentLinksTopBar = ({
  onSearch,
  onStatusFilter,
  onDateFilter,
  statusFilter,
}: PaymentLinksTopBarProps) => {
  const { t } = useTranslation("paymentLinks");
  const isMobile = useIsMobile("md");
  const theme = useTheme();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (val && endDate) onDateFilter(val, endDate);
    if (!val && !endDate) onDateFilter("", "");
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    if (startDate && val) onDateFilter(startDate, val);
    if (!startDate && !val) onDateFilter("", "");
  };

  const selectSx = {
    height: isMobile ? "32px" : "40px",
    borderRadius: "6px",
    border: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "#E9ECF2"}`,
    backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "#FFFFFF",
    fontFamily: "UrbanistMedium",
    fontSize: isMobile ? "10px" : "13px",
    color: theme.palette.text.primary,
    "& .MuiOutlinedInput-notchedOutline": { border: "none" },
    "& .MuiSelect-select": {
      py: 0,
      display: "flex",
      alignItems: "center",
    },
  };

  const inputSx = {
    height: isMobile ? "32px" : "40px",
    borderRadius: "6px",
    border: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "#E9ECF2"}`,
    backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "#FFFFFF",
    px: "10px",
    fontFamily: "UrbanistMedium",
    fontSize: isMobile ? "10px" : "13px",
    color: theme.palette.text.primary,
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: isMobile ? "stretch" : "center",
        flexDirection: isMobile ? "column" : "row",
        gap: "8px",
        p: { xs: "0px 16px", md: "0px" },
        flexWrap: "wrap",
      }}
    >
      {/* Search */}
      <Box sx={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: isMobile ? "100%" : "200px", maxWidth: isMobile ? "100%" : "280px" }}>
        <InputBase
          placeholder={t("searchInputPlaceholder")}
          onChange={(e) => onSearch(e.target.value)}
          sx={{
            ...inputSx,
            width: "100%",
          }}
        />
        <SearchIconButton>
          <Image src={SearchIcon} alt="search" width={20} height={20} className="themed-icon-primary" />
        </SearchIconButton>
      </Box>

      {/* Status Filter */}
      <Select
        value={statusFilter}
        onChange={(e) => onStatusFilter(e.target.value as PaymentLinkStatusFilter)}
        size="small"
        displayEmpty
        sx={{ ...selectSx, minWidth: isMobile ? "100%" : "140px" }}
      >
        <MenuItem value="all">All Statuses</MenuItem>
        <MenuItem value="active">Active</MenuItem>
        <MenuItem value="completed">Completed</MenuItem>
        <MenuItem value="expired">Expired</MenuItem>
        <MenuItem value="pending">Pending</MenuItem>
      </Select>

      {/* Date Range */}
      <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <InputBase
          type="date"
          value={startDate}
          onChange={(e) => handleStartDateChange(e.target.value)}
          placeholder="From"
          sx={{ ...inputSx, width: isMobile ? "100%" : "150px" }}
          inputProps={{ style: { fontFamily: "UrbanistMedium", fontSize: isMobile ? "10px" : "13px" } }}
        />
        <InputBase
          type="date"
          value={endDate}
          onChange={(e) => handleEndDateChange(e.target.value)}
          placeholder="To"
          sx={{ ...inputSx, width: isMobile ? "100%" : "150px" }}
          inputProps={{ style: { fontFamily: "UrbanistMedium", fontSize: isMobile ? "10px" : "13px" } }}
        />
        {(startDate || endDate) && (
          <Box
            component="button"
            onClick={() => { setStartDate(""); setEndDate(""); onDateFilter("", ""); }}
            sx={{
              border: "none",
              background: "none",
              color: theme.palette.primary.main,
              cursor: "pointer",
              fontFamily: "UrbanistMedium",
              fontSize: "12px",
              whiteSpace: "nowrap",
              p: "4px 8px",
              borderRadius: "4px",
              "&:hover": { bgcolor: theme.palette.primary.main + "10" },
            }}
          >
            Clear
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default PaymentLinksTopBar;
