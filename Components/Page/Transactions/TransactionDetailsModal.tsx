import CustomButton from "@/Components/UI/Buttons";
import PopupModal from "@/Components/UI/PopupModal";
import CopyIcon from "@/assets/Icons/copy-icon.svg";
import { Box, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import React, { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import CorrectIcon from "@/assets/Icons/correct-icon.png";
import HashIcon from "@/assets/Icons/hash-icon.svg";
import RightArrowIcon from "@/assets/Icons/right-arrow-icon.svg";
import WrongIcon from "@/assets/Icons/wrong-icon.png";
import BNBIcon from "@/assets/cryptocurrency/BNB-icon.svg";
import BitcoinIcon from "@/assets/cryptocurrency/Bitcoin-icon.svg";
import BitcoinCashIcon from "@/assets/cryptocurrency/BitcoinCash-icon.svg";
import DogecoinIcon from "@/assets/cryptocurrency/Dogecoin-icon.svg";
import EthereumIcon from "@/assets/cryptocurrency/Ethereum-icon.svg";
import LitecoinIcon from "@/assets/cryptocurrency/Litecoin-icon.svg";
import TronIcon from "@/assets/cryptocurrency/Tron-icon.svg";
import USDTIcon from "@/assets/cryptocurrency/USDT-icon.svg";

import RoundedStackIcon from "@/assets/Icons/roundedStck-icon.svg";
import TransactionIcon from "@/assets/Icons/transaction-icon.svg";

import InputField from "@/Components/UI/AuthLayout/InputFields";
import PanelCard from "@/Components/UI/PanelCard";
import Toast from "@/Components/UI/Toast";
import useIsMobile from "@/hooks/useIsMobile";
import { HourGlassIcon } from "@/utils/customIcons";
import { TransactionDetailsModalProps } from "@/utils/types/transaction";
import {
  ActionButtonGroup,
  CopyButton,
  DetailRow,
  ExplorerButton,
  HashRow,
  HeaderTitleRow,
  SectionDivider,
  SectionTitle,
  SectionTitleWithIcon,
  StatusBadge,
  StatusIconWrapper,
  StatusText,
  TitleColumn,
  TitleLabel,
  TitleValue,
  WebhookResponseBox,
} from "./TransactionDetailsModal.styled";
import { CryptoIconChip } from "./styled";

const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({
  open,
  onClose,
  transaction,
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("transactions");
  const tTransactions = useCallback(
    (key: string, options?: any): string => {
      const result = t(key, { ns: "transactions", ...options });
      return typeof result === "string" ? result : String(result);
    },
    [t],
  );
  const [openToast, setOpenToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!transaction) return null;

  const getCryptoIcon = (crypto: string) => {
    switch (crypto) {
      case "BTC":
        return BitcoinIcon;
      case "ETH":
        return EthereumIcon;
      case "LTC":
        return LitecoinIcon;
      case "BNB":
        return BNBIcon;
      case "DOGE":
        return DogecoinIcon;
      case "BCH":
        return BitcoinCashIcon;
      case "TRX":
        return TronIcon;
      case "USDT":
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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);

    setOpenToast(false);

    setTimeout(() => {
      setOpenToast(true);
    }, 0);

    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }

    toastTimer.current = setTimeout(() => {
      setOpenToast(false);
    }, 2000);
  };

  const handleViewOnExplorer = () => {
    // const explorerUrl = `https://blockchain.info/tx/${
    //   transaction.incomingTransactionId || transaction.id
    // }`;
    // window.open(explorerUrl, "_blank");
  };

  return (
    <>
      <PopupModal
        open={open}
        handleClose={onClose}
        showHeader={false}
        transparent
        hasFooter={false}
        sx={{
          "& .MuiDialog-paper": {
            width: "100%",
            maxWidth: "641px",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            p: isMobile ? theme.spacing(2) : "20px 0",
          },
        }}
      >
        <PanelCard
          title={tTransactions("transactionDetails")}
          showHeaderBorder={false}
          headerPadding={theme.spacing(3.75, 3.75, 0, 3.75)}
          bodyPadding={
            isMobile
              ? theme.spacing("12px", 2, 2, 2)
              : theme.spacing(3, 3.75, 3.75, 3.75)
          }
          headerActionLayout="inline"
          headerAction={
            <StatusBadge status={transaction.status}>
              <StatusIconWrapper>
                {getStatusIcon(transaction.status)}
              </StatusIconWrapper>
              <StatusText status={transaction.status}>
                {tTransactions(transaction.status)}
              </StatusText>
            </StatusBadge>
          }
          headerIcon={
            <Image
              src={TransactionIcon}
              alt="Transaction Details"
              width={18}
              height={14}
              draggable={false}
            />
          }
          sx={{
            width: "100%",
            borderRadius: "14px",
            mx: "auto",
          }}
        >
          <Box>
            <HeaderTitleRow>
              <TitleColumn>
                <TitleLabel>{tTransactions("transactionId")}</TitleLabel>
                <TitleValue>{transaction.id}</TitleValue>
              </TitleColumn>
              <TitleColumn>
                <TitleLabel>{tTransactions("dateTime")}</TitleLabel>
                <TitleValue>{transaction.dateTime}</TitleValue>
              </TitleColumn>
            </HeaderTitleRow>
          </Box>
          <SectionDivider />

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: isMobile ? "10px" : "20px",
            }}
          >
            <SectionTitleWithIcon>
              <Image
                src={RoundedStackIcon}
                alt="Amount Details"
                width={15}
                height={15}
                draggable={false}
              />
              <SectionTitle>{tTransactions("amountDetails")}</SectionTitle>
            </SectionTitleWithIcon>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: isMobile ? "8px" : "14px",
              }}
            >
              <DetailRow>
                <TitleLabel>{tTransactions("cryptocurrency")}</TitleLabel>
                <CryptoIconChip sx={{ width: "fit-content" }}>
                  <Image
                    src={getCryptoIcon(transaction.crypto)}
                    alt={transaction.crypto}
                    draggable={false}
                  />
                  <Typography
                    component={"span"}
                    sx={{
                      color:
                        transaction.crypto === "BTC"
                          ? theme.palette.text.primary
                          : theme.palette.text.secondary,
                    }}
                  >
                    {transaction.crypto}
                  </Typography>
                </CryptoIconChip>
              </DetailRow>
              <DetailRow>
                <TitleLabel>{tTransactions("amount")}</TitleLabel>
                <TitleValue>{transaction.amount}</TitleValue>
              </DetailRow>
              <DetailRow>
                <TitleLabel>{tTransactions("usdValue")}</TitleLabel>
                <TitleValue>{transaction.usdValue}</TitleValue>
              </DetailRow>
              {transaction.fees && (
                <DetailRow>
                  <TitleLabel>{tTransactions("fees")}</TitleLabel>
                  <TitleValue>{transaction.fees}</TitleValue>
                </DetailRow>
              )}
              {transaction.confirmations && (
                <DetailRow>
                  <TitleLabel>{tTransactions("confirmations")}</TitleLabel>
                  <TitleValue>{transaction.confirmations}</TitleValue>
                </DetailRow>
              )}
            </Box>
          </Box>
          <SectionDivider />

          {(transaction.incomingTransactionId ||
            transaction.outgoingTransactionId) && (
            <>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: isMobile ? "10px" : "20px",
                }}
              >
                <SectionTitleWithIcon>
                  <Image
                    src={HashIcon}
                    alt="Transaction Hashes"
                    width={20}
                    height={20}
                    draggable={false}
                  />
                  <SectionTitle>
                    {tTransactions("transactionHashes")}
                  </SectionTitle>
                </SectionTitleWithIcon>
                <Box
                  sx={{ display: "flex", flexDirection: "column", gap: "16px" }}
                >
                  {transaction.incomingTransactionId && (
                    <Box>
                      <HashRow>
                        <InputField
                          value={transaction.incomingTransactionId}
                          readOnly
                          label={
                            <TitleLabel>
                              {tTransactions("incomingTransactionId")}
                            </TitleLabel>
                          }
                          inputHeight={isMobile ? "32px" : "40px"}
                          sx={{
                            gap: isMobile ? "6px" : "12px",
                          }}
                        />
                        <ActionButtonGroup>
                          <CopyButton
                            onClick={() =>
                              handleCopy(transaction.incomingTransactionId!)
                            }
                            title={tTransactions("copy")}
                          >
                            <Image
                              src={CopyIcon}
                              alt="Copy"
                              width={isMobile ? 12 : 16}
                              height={isMobile ? 12 : 16}
                              draggable={false}
                            />
                          </CopyButton>
                          <ExplorerButton
                            title={tTransactions("viewOnExplorer")}
                          >
                            <Image
                              src={RightArrowIcon}
                              alt="Right Arrow"
                              width={isMobile ? 12 : 16}
                              height={isMobile ? 12 : 16}
                              draggable={false}
                            />
                          </ExplorerButton>
                        </ActionButtonGroup>
                      </HashRow>
                    </Box>
                  )}
                  {transaction.outgoingTransactionId && (
                    <Box>
                      <HashRow>
                        <InputField
                          value={transaction.outgoingTransactionId}
                          readOnly
                          label={
                            <TitleLabel>
                              {tTransactions("outgoingTransactionId")}
                            </TitleLabel>
                          }
                          inputHeight={isMobile ? "32px" : "40px"}
                          sx={{
                            gap: isMobile ? "6px" : "12px",
                          }}
                        />

                        <ActionButtonGroup>
                          <CopyButton
                            onClick={() =>
                              handleCopy(transaction.outgoingTransactionId!)
                            }
                            title={tTransactions("copy")}
                          >
                            <Image
                              src={CopyIcon}
                              alt="Copy"
                              width={isMobile ? 12 : 16}
                              height={isMobile ? 12 : 16}
                              draggable={false}
                            />
                          </CopyButton>
                          <ExplorerButton
                            title={tTransactions("viewOnExplorer")}
                          >
                            <Image
                              src={RightArrowIcon}
                              alt="Right Arrow"
                              width={isMobile ? 12 : 16}
                              height={isMobile ? 12 : 16}
                              draggable={false}
                            />
                          </ExplorerButton>
                        </ActionButtonGroup>
                      </HashRow>
                    </Box>
                  )}
                </Box>
              </Box>
              <SectionDivider />
            </>
          )}

          {(transaction.callbackUrl || transaction.webhookResponse) && (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: isMobile ? "10px" : "20px",
              }}
            >
              <SectionTitle>
                {tTransactions("callbackInformation")}
              </SectionTitle>
              <Box
                sx={{ display: "flex", flexDirection: "column", gap: "16px" }}
              >
                {transaction.callbackUrl && (
                  <Box>
                    <HashRow>
                      <InputField
                        value={transaction.callbackUrl}
                        readOnly
                        label={
                          <TitleLabel>
                            {tTransactions("callbackUrl")}
                          </TitleLabel>
                        }
                        inputHeight={isMobile ? "32px" : "40px"}
                        sx={{
                          gap: isMobile ? "6px" : "12px",
                        }}
                      />
                      <CopyButton
                        onClick={() => handleCopy(transaction.callbackUrl!)}
                        title={tTransactions("copy")}
                      >
                        <Image
                          src={CopyIcon}
                          alt="Copy"
                          width={isMobile ? 12 : 16}
                          height={isMobile ? 12 : 16}
                          draggable={false}
                        />
                      </CopyButton>
                    </HashRow>
                  </Box>
                )}
                {transaction.webhookResponse && (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: isMobile ? "6px" : "12px",
                      scrollbarWidth: "none",
                    }}
                  >
                    <TitleLabel>{tTransactions("webhookResponse")}</TitleLabel>
                    <Box
                      sx={{
                        border: `1px solid ${theme.palette.border.main}`,
                        borderRadius: "6px",
                      }}
                    >
                      <WebhookResponseBox>
                        <pre
                          style={{
                            margin: 0,
                            fontFamily: "UrbanistMedium",
                            fontSize: isMobile ? "10px" : "13px",
                            lineHeight: 1.2,
                            letterSpacing: 0,
                          }}
                        >
                          {JSON.stringify(transaction.webhookResponse, null, 2)}
                        </pre>
                      </WebhookResponseBox>
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          )}

          <Box
            sx={{
              display: "flex",
              gap: isMobile ? "12px" : 2.5,
              marginTop: isMobile ? 2 : 3,
            }}
          >
            <CustomButton
              label={tTransactions("close")}
              variant="outlined"
              size="medium"
              onClick={onClose}
              fullWidth
              sx={{
                [theme.breakpoints.down("md")]: {
                  width: "fit-content",
                  flex: 1,
                  height: "32px",
                },
              }}
            />
            <CustomButton
              label={tTransactions("viewOnExplorer")}
              variant="primary"
              size="medium"
              onClick={handleViewOnExplorer}
              fullWidth
              sx={{
                [theme.breakpoints.down("md")]: {
                  width: "fit-content",
                  flex: 1,
                  height: "32px",
                },
              }}
            />
          </Box>
        </PanelCard>
      </PopupModal>
      <Toast
        open={openToast}
        message={tTransactions("copiedToClipboard")}
        severity="success"
      />
    </>
  );
};

export default TransactionDetailsModal;
