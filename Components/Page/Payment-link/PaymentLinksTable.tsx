import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from "@mui/material";
import React, { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FooterText,
  StatusChip,
  TableBodyCell,
  TableFooter,
  TransactionsTableContainer,
  TransactionsTableScrollWrapper,
} from "./styled";

import KeyboardArrowLeftRoundedIcon from "@mui/icons-material/KeyboardArrowLeftRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";

import ActionIcon from "@/assets/Icons/Actions.svg";
import CopyIcon from "@/assets/Icons/copy-icon.svg";
import DescriptiontoIcon from "@/assets/Icons/crypto-icon.svg";
import TimeUsedIcon from "@/assets/Icons/cryptocurrency_link.svg";
import CryptoIcon from "@/assets/Icons/CryptoIcon.svg";
import EditIcon from "@/assets/Icons/edit-icon.svg";
import EyeIcon from "@/assets/Icons/eye-icon.svg";
import HexagonIcon from "@/assets/Icons/hexagon-icon.svg";
import TimeIcon from "@/assets/Icons/time-icon.svg";
import TransactionIcon from "@/assets/Icons/transaction-icon.svg";
import TrashIcon from "@/assets/Icons/trash-icon.svg";
import UsdIcon from "@/assets/Icons/USDIcon.svg";

import Image from "next/image";

import FalseIcon from "@/assets/Icons/False.svg";
import TrueIcon from "@/assets/Icons/True.svg";

import { MobileNavigationButtons } from "@/Components/Page/Transactions/styled";
import CustomButton from "@/Components/UI/Buttons";
import RowsPerPageSelector from "@/Components/UI/RowsPerPageSelector";
import Toast from "@/Components/UI/Toast";
import useIsMobile from "@/hooks/useIsMobile";
import { HourGlassIcon } from "@/utils/customIcons";
import {
  PaymentLinkData,
  PaymentLinksTableProps,
} from "@/utils/types/paymentLink";
import { useRouter } from "next/router";
import PaymentLinkSuccessModal from "../CreatePaymentLink/PaymentLinkSuccessModal";
import { CopyButton } from "../Transactions/TransactionDetailsModal.styled";

const headerIconMap: Record<string, any> = {
  linkIdHeader: TransactionIcon,
  descriptionHeader: DescriptiontoIcon,
  usdValueHeader: UsdIcon,
  cryptoValueHeader: CryptoIcon,
  createdHeader: TimeIcon,
  expiresHeader: TimeIcon,
  statusHeader: HexagonIcon,
  timesUsedHeader: TimeUsedIcon,
  actionsHeader: ActionIcon,
};

const Header = React.memo(({ label }: { label: string }) => {
  const { t } = useTranslation("paymentLinks");
  const isMobile = useIsMobile("md");
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: isMobile ? "6px" : "10px",
      }}
    >
      {headerIconMap[label] && (
        <Image
          src={headerIconMap[label]}
          alt={label}
          width={isMobile ? 15 : 18}
          height={isMobile ? 15 : 18}
          draggable={false}
          style={{
            filter:
              "brightness(0) saturate(100%) invert(15%) sepia(0%) saturate(0%) brightness(95%) contrast(100%)",
            marginTop: "-1px",
          }}
        />
      )}

      <Typography
        sx={{
          fontSize: isMobile ? "10px" : "15px",
          fontWeight: 500,
          fontFamily: "UrbanistMedium",
          lineHeight: 1.2,
          letterSpacing: 0,
          color: "#242428",
          whiteSpace: "nowrap",
        }}
      >
        {t(label)}
      </Typography>
    </Box>
  );
});

Header.displayName = "Header";

const PaymentLinksTable = ({
  paymentLinks,
  rowsPerPage = 10,
}: PaymentLinksTableProps) => {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(rowsPerPage);
  const { t } = useTranslation("paymentLinks");
  const tCommon = useCallback((key: string) => t(key, { ns: "common" }), [t]);
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const [openToast, setOpenToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openViewModel, setOpenViewModel] = useState<boolean>(false);
  const [viewModelData, setViewModelData] = useState<{
    value: string;
    cryptoValue: string;
    expire: string;
    description: string;
    blockchainFees: string;
    linkId: string;
  }>({
    value: "",
    cryptoValue: "",
    expire: "",
    description: "",
    blockchainFees: "",
    linkId: "",
  });
  const [paymentLink, setPaymentLink] = useState<string>(
    "https://pay.dynopay.com/9vpej",
  );
  const [deleteModel, setDeleteModel] = useState<boolean>(false);
  const [deleteId, setDeletId] = useState<string>("");

  const total = paymentLinks.length;
  const start = page * rows;
  const end = Math.min(start + rows, total);

  const paginatedData = paymentLinks.slice(start, end);

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
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

  function getDateDiffShort(from: string, to: string): string {
    if (!from || !to) return "";

    const start = new Date(from).getTime();
    const end = new Date(to).getTime();

    let diff = Math.abs(end - start);

    const SECOND = 1000;
    const MINUTE = 60 * SECOND;
    const HOUR = 60 * MINUTE;
    const DAY = 24 * HOUR;
    const MONTH = 30 * DAY;
    const YEAR = 365 * DAY;

    if (diff >= YEAR) return `${Math.floor(diff / YEAR)}y`;
    if (diff >= MONTH) return `${Math.floor(diff / MONTH)}m`;
    if (diff >= DAY) return `${Math.floor(diff / DAY)}d`;
    if (diff >= HOUR) return `${Math.floor(diff / HOUR)}h`;
    if (diff >= MINUTE) return `${Math.floor(diff / MINUTE)}m`;
    return `${Math.floor(diff / SECOND)}s`;
  }

  const handleViewModelOpen = (row: PaymentLinkData) => {
    setViewModelData({
      value: row.usdValue,
      cryptoValue: row.cryptoValue || "",
      expire: getDateDiffShort(row.createdAt, row.expiresAt),
      description: row.description,
      blockchainFees: row.status,
      linkId: row.id,
    });
    setOpenViewModel(true);
  };

  const handleCopyLink = () => {
    if (paymentLink) {
      navigator.clipboard.writeText(paymentLink);
    }
  };

  function formatUtcToDisplay(dateString: string): string {
    if (!dateString) return "";

    const date = new Date(dateString);

    const pad = (n: number) => n.toString().padStart(2, "0");

    const month = pad(date.getUTCMonth() + 1);
    const day = pad(date.getUTCDate());
    const year = date.getUTCFullYear();

    const hours = pad(date.getUTCHours());
    const minutes = pad(date.getUTCMinutes());
    const seconds = pad(date.getUTCSeconds());

    return `${month}.${day}.${year} ${hours}:${minutes}:${seconds}`;
  }

  return (
    <>
      <PaymentLinkSuccessModal
        open={openViewModel}
        onClose={() => setOpenViewModel(false)}
        paymentLink={paymentLink}
        paymentSettings={viewModelData}
        onCopyLink={handleCopyLink}
      />
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
        <TransactionsTableContainer>
          <TransactionsTableScrollWrapper>
            <Table>
              <TableHead
                sx={{
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                  backgroundColor: "#E5EDFF",
                }}
              >
                <TableRow sx={{ backgroundColor: "#E5EDFF" }}>
                  <TableCell>
                    <Header label="linkIdHeader" />
                  </TableCell>
                  <TableCell>
                    <Header label="descriptionHeader" />
                  </TableCell>
                  <TableCell>
                    <Header label="usdValueHeader" />
                  </TableCell>
                  <TableCell>
                    <Header label="cryptoValueHeader" />
                  </TableCell>
                  <TableCell>
                    <Header label="createdHeader" />
                  </TableCell>
                  <TableCell>
                    <Header label="expiresHeader" />
                  </TableCell>
                  <TableCell>
                    <Header label="statusHeader" />
                  </TableCell>
                  <TableCell>
                    <Header label="timesUsedHeader" />
                  </TableCell>
                  <TableCell align="center">
                    <Header label="actionsHeader" />
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody sx={{ overflowY: "auto" }}>
                {paginatedData.map((row, index) => (
                  <TableRow
                    key={index}
                    sx={{
                      height: isMobile ? "59px" : "63px",
                      borderTop: index === 0 ? "none" : "1px solid #E5E7EB",
                    }}
                  >
                    <TableBodyCell sx={{ pl: "15px" }}>{row.id}</TableBodyCell>
                    <TableBodyCell>{row.description}</TableBodyCell>
                    <TableBodyCell>${row.usdValue}</TableBodyCell>
                    <TableBodyCell>{row.cryptoValue}</TableBodyCell>
                    <TableBodyCell>
                      {formatUtcToDisplay(row.createdAt)}
                    </TableBodyCell>
                    <TableBodyCell>
                      {formatUtcToDisplay(row.expiresAt)}
                    </TableBodyCell>

                    <TableBodyCell>
                      <StatusChip status={row.status}>
                        {row.status === "active" ? (
                          <Image
                            src={TrueIcon}
                            alt="True Icon"
                            width={isMobile ? 12 : 14}
                            height={isMobile ? 12 : 14}
                            draggable={false}
                          />
                        ) : row.status === "expired" ? (
                          <Image
                            src={FalseIcon}
                            alt="False Icon"
                            width={isMobile ? 12 : 14}
                            height={isMobile ? 12 : 14}
                            draggable={false}
                          />
                        ) : row.status === "paid" ? (
                          <Image
                            src={TrueIcon}
                            alt="True Icon"
                            width={isMobile ? 12 : 14}
                            height={isMobile ? 12 : 14}
                            draggable={false}
                            style={{
                              filter:
                                "brightness(0) saturate(100%) invert(29%) sepia(88%) saturate(2646%) hue-rotate(189deg) brightness(95%) contrast(101%)",
                            }}
                          />
                        ) : (
                          <HourGlassIcon
                            fill={"#F57C00"}
                            size={isMobile ? 12 : 14}
                          />
                        )}
                        {row.status === "active"
                          ? "Active"
                          : row.status === "expired"
                            ? "Expired"
                            : row.status === "paid"
                              ? "Paid"
                              : "Pending"}
                      </StatusChip>
                    </TableBodyCell>

                    <TableBodyCell>{row.timesUsed}</TableBodyCell>

                    <TableBodyCell
                      align="center"
                      sx={{
                        height: isMobile ? "58px" : "62px",
                        width: "fit-content",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      {row.status !== "expired" && (
                        <CopyButton onClick={() => handleCopy(row.id)}>
                          <Image
                            src={CopyIcon}
                            alt="Copy Icon"
                            width={isMobile ? 12 : 14}
                            height={isMobile ? 12 : 14}
                            draggable={false}
                          />
                        </CopyButton>
                      )}
                      <CopyButton
                        onClick={() => {
                          row.status === "paid" || row.status === "expired"
                            ? router.push(`/pay-links/${row?.id}`)
                            : handleViewModelOpen(row);
                        }}
                        sx={{
                          borderColor: theme.palette.text.primary,
                          "&:hover": {
                            backgroundColor: "transparent",
                            boxShadow: "none",
                          },
                        }}
                      >
                        <Image
                          src={EyeIcon}
                          alt="Eye Icon"
                          width={isMobile ? 12 : 20}
                          height={isMobile ? 12 : 14}
                          draggable={false}
                        />
                      </CopyButton>
                      {row.status !== "expired" && row.status !== "paid" && (
                        <CopyButton
                          onClick={() => router.push(`/pay-links/${row?.id}`)}
                          sx={{
                            borderColor: theme.palette.text.primary,
                            "&:hover": {
                              backgroundColor: "transparent",
                              boxShadow: "none",
                            },
                          }}
                        >
                          <Image
                            src={EditIcon}
                            alt="Edit Icon"
                            width={isMobile ? 12 : 20}
                            height={isMobile ? 12 : 16}
                            draggable={false}
                            style={{
                              filter: "brightness(0) saturate(100%) invert(0%)",
                            }}
                          />
                        </CopyButton>
                      )}
                      {row.status !== "expired" && row.status !== "paid" && (
                        <CopyButton
                          onClick={() => {
                            if (row.status !== "active") {
                              setDeleteModel(true);
                              setDeletId(row.id);
                            }
                          }}
                          sx={{
                            borderColor:
                              row.status === "active"
                                ? theme.palette.secondary.contrastText
                                : theme.palette.text.primary,
                            "&:hover": {
                              backgroundColor: "transparent",
                              boxShadow: "none",
                              cursor:
                                row.status === "active"
                                  ? "not-allowed"
                                  : "pointer",
                            },
                          }}
                        >
                          <Image
                            src={TrashIcon}
                            alt="Trash Icon"
                            width={isMobile ? 12 : 20}
                            height={isMobile ? 12 : 16}
                            draggable={false}
                            style={{
                              filter:
                                row.status === "active"
                                  ? ""
                                  : "brightness(0) saturate(100%) invert(0%)",
                            }}
                          />
                        </CopyButton>
                      )}
                    </TableBodyCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TransactionsTableScrollWrapper>

          <TableFooter>
            <RowsPerPageSelector
              value={rows}
              onChange={(value) => {
                setRows(value);
                setPage(0);
              }}
              menuItems={[
                { value: 5, label: 5 },
                { value: 10, label: 10 },
                { value: 15, label: 15 },
                { value: 20, label: 20 },
              ]}
            />
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <FooterText>
                {t("showingLinks", {
                  count: end,
                  total: total,
                })}
              </FooterText>
              <CustomButton
                label={t("previous")}
                variant="outlined"
                size="medium"
                sx={{
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
                    lineHeight: "100%",
                    fontWeight: 500,
                  },
                  [theme.breakpoints.down("md")]: {
                    display: "none",
                  },
                }}
                startIcon={
                  <KeyboardArrowLeftRoundedIcon
                    sx={{ height: "20px", width: "20px" }}
                  />
                }
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(p - 1, 0))}
              />
              <CustomButton
                label={t("next")}
                variant="outlined"
                size="medium"
                sx={{
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
                    lineHeight: "100%",
                    fontWeight: 500,
                  },
                  [theme.breakpoints.down("md")]: {
                    display: "none",
                  },
                }}
                endIcon={
                  <KeyboardArrowRightRoundedIcon
                    sx={{ height: "20px", width: "20px" }}
                  />
                }
                disabled={end >= total}
                onClick={() => setPage((p) => p + 1)}
              />

              <MobileNavigationButtons
                onClick={() => setPage((p) => Math.max(p - 1, 0))}
                disabled={page === 0}
              >
                <KeyboardArrowLeftRoundedIcon
                  sx={{ height: "16px", width: "16px", color: "inherit" }}
                />
              </MobileNavigationButtons>
              <MobileNavigationButtons
                onClick={() => setPage((p) => p + 1)}
                disabled={end >= total}
              >
                <KeyboardArrowRightRoundedIcon
                  sx={{ height: "16px", width: "16px", color: "inherit" }}
                />
              </MobileNavigationButtons>
            </Box>
          </TableFooter>
        </TransactionsTableContainer>
      </Box>

      <Toast
        open={openToast}
        message={tCommon("copiedToClipboard")}
        severity="success"
      />

      <Dialog
        open={deleteModel}
        onClose={() => {
          setDeleteModel(false);
          setDeletId("");
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            p: 0,
            maxWidth: 576,
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pb: 0,
            pt: isMobile ? "16px" : "30px",
            px: isMobile ? "16px" : "30px",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: isMobile ? "16px" : "24px",
            }}
          >
            <Image
              src={TrashIcon}
              alt="Info Icon"
              width={isMobile ? 12 : 22}
              height={isMobile ? 12 : 16}
              draggable={false}
            />
            <Typography
              sx={{
                fontWeight: 500,
                fontSize: isMobile ? "16px" : "20px",
                fontFamily: "UrbanistMedium",
                color: "text.primary",
                lineHeight: "24px",
              }}
            >
              {t("deleteModelTitle")} {deleteId}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ px: isMobile ? "16px" : "30px", pt: 1.5, pb: 0 }}>
          <Typography
            sx={{
              fontSize: isMobile ? "13px" : "15px",
              color: "text.secondary",
              lineHeight: "18px",
              fontFamily: "UrbanistMedium",
            }}
          >
            {t("deleteModelDescription")}
          </Typography>
        </DialogContent>
        <DialogActions
          sx={{
            justifyContent: "flex-end",
            gap: 1,
            px: 2.5,
            pb: 2.5,
            pt: 3,
          }}
        >
          <CustomButton
            label={t("cancel")}
            variant="outlined"
            size={isMobile ? "small" : "medium"}
            onClick={() => {
              setDeleteModel(false);
              setDeletId("");
            }}
            sx={{ fontSize: isMobile ? "13px" : "14px", width: "100%" }}
          />
          <CustomButton
            label={t("delete")}
            variant="danger"
            size={isMobile ? "small" : "medium"}
            onClick={() => {
              setDeleteModel(false);
              setDeletId("");
            }}
            sx={{ fontSize: isMobile ? "13px" : "14px", width: "100%" }}
          />
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PaymentLinksTable;
