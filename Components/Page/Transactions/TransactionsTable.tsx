import BitcoinIcon from "@/assets/cryptocurrency/Bitcoin-icon.svg";
import BitcoinCashIcon from "@/assets/cryptocurrency/BitcoinCash-icon.svg";
import DogecoinIcon from "@/assets/cryptocurrency/Dogecoin-icon.svg";
import EthereumIcon from "@/assets/cryptocurrency/Ethereum-icon.svg";
import LitecoinIcon from "@/assets/cryptocurrency/Litecoin-icon.svg";
import TronIcon from "@/assets/cryptocurrency/Tron-icon.svg";
import USDTIcon from "@/assets/cryptocurrency/USDT-icon.svg";
import { ArrowOutward as ArrowOutwardIcon } from "@mui/icons-material";
import { Box, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import CorrectIcon from "@/assets/Icons/correct-icon.png";
import WrongIcon from "@/assets/Icons/wrong-icon.png";

import CryptoIcon from "@/assets/Icons/crypto-icon.svg";
import CurrencyIcon from "@/assets/Icons/dollar-sign-icon.svg";
import HexagonIcon from "@/assets/Icons/hexagon-icon.svg";
import RoundedStackIcon from "@/assets/Icons/roundedStck-icon.svg";
import SwapHorizIcon from "@/assets/Icons/swap-round-icon.svg";
import TimeIcon from "@/assets/Icons/time-icon.svg";
import TransactionIcon from "@/assets/Icons/transaction-icon.svg";

import KeyboardArrowLeftRoundedIcon from "@mui/icons-material/KeyboardArrowLeftRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";

import CustomButton from "@/Components/UI/Buttons";
import RowsPerPageSelector from "@/Components/UI/RowsPerPageSelector";
import useIsMobile from "@/hooks/useIsMobile";
import { HourGlassIcon } from "@/utils/customIcons";
import {
  ExtendedTransaction,
  TransactionsTableProps,
} from "@/utils/types/transaction";
import { TransactionAction } from "@/Redux/Actions";
import { TRANSACTION_DETAIL_FETCH } from "@/Redux/Actions/TransactionAction";
import { useDispatch } from "react-redux";
import { Text } from "../CreatePaymentLink/styled";
import {
  CryptoIconChip,
  MobileNavigationButtons,
  StatusBadge,
  StatusIconWrapper,
  StatusText,
  TransactionsTableBody,
  TransactionsTableCell,
  TransactionsTableFooter,
  TransactionsTableFooterText,
  TransactionsTableHeader,
  TransactionsTableHeaderItem,
  TransactionsTableRow,
} from "./styled";
import TransactionDetailsModal from "./TransactionDetailsModal";

const TransactionsTable: React.FC<TransactionsTableProps> = ({
  transactions,
  rowsPerPage: initialRowsPerPage = 10,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { t } = useTranslation("transactions");
  const tTransactions = useCallback(
    (key: string, options?: any): string => {
      const result = t(key, { ns: "transactions", ...options });
      return typeof result === "string" ? result : String(result);
    },
    [t],
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);
  const [selectedTransaction, setSelectedTransaction] =
    useState<ExtendedTransaction | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const isMobile = useIsMobile("md");

  const totalPages = Math.ceil(transactions.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentTransactions = transactions.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [transactions]);

  const getCryptoIcon = (crypto: string) => {
    switch (crypto) {
      case "BTC":
        return BitcoinIcon;
      case "ETH":
        return EthereumIcon;
      case "LTC":
        return LitecoinIcon;
      case "DOGE":
        return DogecoinIcon;
      case "BCH":
        return BitcoinCashIcon;
      case "TRX":
        return TronIcon;
      case "USDT-ERC20":
        return USDTIcon;
      case "USDT-TRC20":
        return USDTIcon;
      default:
        return BitcoinIcon;
    }
  };

  const getStatusIcon = (status: "done" | "pending" | "failed") => {
    switch (status) {
      case "done":
        return <Image src={CorrectIcon} alt="correct" draggable={false} />;
      case "pending":
        return <HourGlassIcon fill={"#F57C00"} size={isMobile ? 12 : 16} />;
      case "failed":
        return <Image src={WrongIcon} alt="incorrect" draggable={false} />;
    }
  };

  const handleRowsPerPageChange = (value: number) => {
    setRowsPerPage(value);
    setCurrentPage(1);
  };

  const handleRowClick = (transaction: ExtendedTransaction) => {
    setSelectedTransaction(transaction);
    setModalOpen(true);
    // Fetch full transaction detail from API
    if (transaction.id) {
      dispatch(TransactionAction(TRANSACTION_DETAIL_FETCH, { id: transaction.id }));
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedTransaction(null);
  };

  const HeaderData = [
    {
      label: isMobile ? tTransactions("id") : tTransactions("transactionId"),
      key: "id",
      icon: TransactionIcon,
    },
    {
      label: tTransactions("crypto"),
      key: "crypto",
      icon: CryptoIcon,
    },
    {
      label: tTransactions("amount"),
      key: "amount",
      icon: RoundedStackIcon,
    },
    {
      label: tTransactions("usdValue"),
      key: "usdValue",
      icon: CurrencyIcon,
    },
    {
      label: tTransactions("dateTime"),
      key: "dateTime",
      icon: TimeIcon,
    },
    {
      label: tTransactions("status"),
      key: "status",
      icon: HexagonIcon,
    },
  ];

  const navButtonStyle = {
    width: "fit-content",
    height: "36px",
    padding: "0px 12px",
    "&:disabled": {
      backgroundColor: theme.palette.common.white,
      color: theme.palette.text.primary,
      border: `1px solid ${theme.palette.border.main}`,
      cursor: "not-allowed",
      opacity: 0.5,
    },
    ".custom-button-label": {
      fontSize: "13px !important",
      fontFamily: "UrbanistMedium",
      lineHeight: "16px",
      fontWeight: 500,
    },
    [theme.breakpoints.down("md")]: {
      display: "none",
    },
  };

  const formatAmount = (amount: any) => {
    const [value, unit] = amount.split(" ");
    return `${Number(value).toFixed(4)} ${unit}`;
  };

  const formatUsd = (usdValue: any) => {
    const value = usdValue.replace("$", "");
    return `$${Number(value).toFixed(3)}`;
  };

  const isDataEmpty = currentTransactions.length === 0;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        maxHeight: "fit-content",
        p: { xs: "0px 0px 0px 16px", sm: "0px 16px", md: "0px" },
      }}
    >
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "none",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            minWidth: "max-content",
            height: "100%",
          }}
        >
          {/* Header Section */}
          <Box sx={{ display: "flex", height: isMobile ? 44 : 56 }}>
            <TransactionsTableHeader>
              {HeaderData.map((item) => (
                <TransactionsTableHeaderItem key={item.key}>
                  <Image
                    src={item.icon}
                    alt={item.label}
                    style={{
                      filter: `brightness(0) saturate(100%) invert(15%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(95%) contrast(100%)`,
                    }}
                    draggable={false}
                  />
                  <span>{item.label}</span>
                </TransactionsTableHeaderItem>
              ))}
            </TransactionsTableHeader>
          </Box>

          {/* Body Section */}
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              backgroundColor: theme.palette.common.white,
            }}
          >
            <TransactionsTableBody>
              {isDataEmpty ? (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100%",
                    mt: 3,
                  }}
                >
                  {t("transactionsNotAvailable", { ns: "common" })}
                </Box>
              ) : (
                currentTransactions.map((transaction) => (
                  <TransactionsTableRow
                    key={transaction.id}
                    onClick={() => handleRowClick(transaction)}
                    sx={{
                      paddingY: isMobile ? "9px !important" : "10px !important",
                      cursor: "pointer",
                    }}
                  >
                    <TransactionsTableCell>
                      {transaction.id}
                    </TransactionsTableCell>

                    <TransactionsTableCell>
                      <CryptoIconChip sx={{ width: "fit-content" }}>
                        <Image
                          src={getCryptoIcon(transaction.crypto)}
                          alt={transaction.crypto}
                          draggable={false}
                        />
                        <Typography
                          component="span"
                          sx={{ color: theme.palette.text.secondary }}
                        >
                          {transaction.crypto}
                        </Typography>
                      </CryptoIconChip>
                      <Box
                        sx={{
                          display: "flex",
                          gap: "3px",
                          alignItems: "center",
                        }}
                      >
                        <Image
                          src={SwapHorizIcon}
                          alt="swap horiz"
                          width={15}
                          height={15}
                          draggable={false}
                          style={{
                            filter:
                              "brightness(0) saturate(100%) invert(41%) sepia(2%) saturate(168%) hue-rotate(201deg) brightness(95%) contrast(88%)",
                          }}
                        />
                        <ArrowOutwardIcon
                          sx={{
                            fontSize: isMobile ? 14 : 16,
                            transform: "rotate(45deg)",
                            color: theme.palette.text.secondary,
                            lineHeight: "100%",
                          }}
                        />
                        <Text
                          sx={{
                            fontSize: isMobile ? "10px" : "13px",
                            color: theme.palette.text.secondary,
                          }}
                        >
                          USDT
                        </Text>
                      </Box>
                    </TransactionsTableCell>

                    <TransactionsTableCell>
                      {formatAmount(transaction.amount)}
                    </TransactionsTableCell>

                    <TransactionsTableCell>
                      {formatUsd(transaction.usdValue)}
                    </TransactionsTableCell>

                    <TransactionsTableCell>
                      {transaction.dateTime}
                    </TransactionsTableCell>

                    <TransactionsTableCell>
                      <StatusBadge status={transaction.status}>
                        <StatusIconWrapper status={transaction.status}>
                          {getStatusIcon(transaction.status)}
                        </StatusIconWrapper>
                        <StatusText status={transaction.status}>
                          {tTransactions(transaction.status)}
                        </StatusText>
                      </StatusBadge>
                    </TransactionsTableCell>
                  </TransactionsTableRow>
                ))
              )}
            </TransactionsTableBody>
          </Box>
        </Box>
      </Box>

      {/* Footer Section */}
      <Box
        sx={{
          backgroundColor: theme.palette.common.white,
          borderEndStartRadius: "14px",
          borderEndEndRadius: "14px",
        }}
      >
        <TransactionsTableFooter>
          <RowsPerPageSelector
            value={rowsPerPage}
            onChange={handleRowsPerPageChange}
            menuItems={[5, 10, 15, 20].map((v) => ({ value: v, label: v }))}
          />

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <TransactionsTableFooterText>
              {tTransactions("showingTransactions", {
                count: currentTransactions.length,
                total: transactions.length,
              })}
            </TransactionsTableFooterText>

            <CustomButton
              label={tTransactions("previous")}
              variant="outlined"
              sx={navButtonStyle}
              startIcon={
                <KeyboardArrowLeftRoundedIcon
                  sx={{ height: "20px", width: "20px" }}
                />
              }
              disabled={currentPage === 1 || isDataEmpty}
              onClick={() => setCurrentPage((prev) => prev - 1)}
            />

            <CustomButton
              label={tTransactions("next")}
              variant="outlined"
              sx={navButtonStyle}
              endIcon={
                <KeyboardArrowRightRoundedIcon
                  sx={{ height: "20px", width: "20px" }}
                />
              }
              disabled={currentPage === totalPages || isDataEmpty}
              onClick={() => setCurrentPage((prev) => prev + 1)}
            />

            {/* Mobile Nav */}
            <MobileNavigationButtons
              onClick={() => setCurrentPage((prev) => prev - 1)}
              disabled={currentPage === 1 || isDataEmpty}
            >
              <KeyboardArrowLeftRoundedIcon
                sx={{ height: "16px", width: "16px", color: "inherit" }}
              />
            </MobileNavigationButtons>

            <MobileNavigationButtons
              onClick={() => setCurrentPage((prev) => prev + 1)}
              disabled={currentPage === totalPages || isDataEmpty}
            >
              <KeyboardArrowRightRoundedIcon
                sx={{ height: "16px", width: "16px", color: "inherit" }}
              />
            </MobileNavigationButtons>
          </Box>
        </TransactionsTableFooter>
      </Box>

      <TransactionDetailsModal
        open={modalOpen}
        onClose={handleCloseModal}
        transaction={selectedTransaction}
      />
    </Box>
  );
};

export default TransactionsTable;
