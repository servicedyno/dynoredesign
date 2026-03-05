import InfoIcon from "@/assets/Icons/info-icon.svg";
import WalletIcon from "@/assets/Icons/wallet-icon.svg";
import axiosBaseApi from "@/axiosConfig";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import CustomButton from "@/Components/UI/Buttons";
import CryptocurrencySelector from "@/Components/UI/CryptocurrencySelector";
import OtpDialog from "@/Components/UI/OtpDialog";
import PopupModal from "@/Components/UI/PopupModal";
import useIsMobile from "@/hooks/useIsMobile";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { verifyOtp } from "@/Redux/Sagas/WalletSaga";
import { theme } from "@/styles/theme";
import { rootReducer } from "@/utils/types";
import { Address, AddWalletModalProps } from "@/utils/types/wallet";
import { Box, Typography } from "@mui/material";
import Image from "next/image";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import PanelCard from "../PanelCard";
import {
  WarningContainer,
  WarningContent,
  WarningIconContainer,
} from "./styled";

const AddWalletModal: React.FC<AddWalletModalProps> = ({
  open,
  onClose,
  currentCryptocurrency = "",
  fiatData = [],
  cryptoData = [],
  onWalletAdded,
  headerExtra,
}) => {
  const dispatch = useDispatch();
  const userState = useSelector((state: rootReducer) => state.userReducer);
  const isMobile = useIsMobile("sm");
  const { t } = useTranslation("walletScreen");
  const tWallet = useCallback(
    (key: string): string => {
      const result = t(key, { ns: "walletScreen" });
      return typeof result === "string" ? result : String(result);
    },
    [t],
  );
  const [walletName, setWalletName] = useState("");
  const [cryptocurrency, setCryptocurrency] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [xrpTag, setXrpTag] = useState("");
  const [errors, setErrors] = useState<{
    walletName?: string;
    cryptocurrency?: string;
    walletAddress?: string;
    xrpTag?: string;
  }>({});
  const [popupLoading, setPopupLoading] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [address, setAddress] = useState<Address | null>(null);
  const [otpError, setOtpError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [closeCryptoDropdown, setCloseCryptoDropdown] = useState(false);

  // Chains that use destination tags (XRP Ledger)
  const TAG_BASED_CHAINS = ["XRP", "RLUSD"];

  useEffect(() => {
    if (currentCryptocurrency) {
      setCryptocurrency(currentCryptocurrency);
    }
  }, [currentCryptocurrency]);

  const validate = () => {
    const newErrors: typeof errors = {};

    if (!walletName.trim()) {
      newErrors.walletName = tWallet("walletNameRequired");
    }

    if (!cryptocurrency) {
      newErrors.cryptocurrency = tWallet("cryptocurrencyRequired");
    }

    if (!walletAddress.trim()) {
      newErrors.walletAddress = tWallet("walletAddressRequired");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    if (!otpModalOpen) {
      setOtpError("");
    }
  }, [otpModalOpen]);

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    try {
      setIsSubmitting(true);
      setPopupLoading(true);

      const values: any = {
        wallet_address: walletAddress.trim(),
        currency: cryptocurrency,
      };

      if (TAG_BASED_CHAINS.includes(cryptocurrency) && xrpTag.trim()) {
        values.destination_tag = xrpTag.trim();
      }

      const response: any = await axiosBaseApi.post(
        "/wallet/validateWalletAddress",
        values,
      );

      if (response.status !== 200 || response.error) {
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: response?.data?.message ?? "Failed to add wallet address",
            severity: "error",
          },
        });
        setPopupLoading(false);
        setIsSubmitting(false);
        return;
      }

      setAddress(values);
      setPopupLoading(false);
      setIsSubmitting(false);

      setWalletName("");
      setCryptocurrency("BTC");
      setWalletAddress("");
      setErrors({});
      onClose();
      setOtpModalOpen(true);
    } catch (error: any) {
      console.error("Error adding wallet address:", error);
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message:
            error?.response?.data?.message ??
            error.message ??
            "Something went wrong",
          severity: "error",
        },
      });
      setPopupLoading(false);
      setIsSubmitting(false);
    }
  };

  const handleOtpVerify = async (otp: string) => {
    setOtpLoading(true);
    setOtpError("");

    let currencyType: "FIAT" | "CRYPTO" | null = null;

    if (fiatData.some((item) => item.wallet_type === address?.currency)) {
      currencyType = "FIAT";
    } else if (
      cryptoData.some((item) => item.wallet_type === address?.currency)
    ) {
      currencyType = "CRYPTO";
    }

    try {
      const response = await verifyOtp({
        otp: otp,
        wallet_address: address?.wallet_address,
        currency: address?.currency,
        currency_type: currencyType,
      });

      if (response.status) {
        setOtpModalOpen(false);
        setAddress(null);
        handleClose();
        onWalletAdded?.();
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: response?.message,
            severity: "success",
          },
        });
      } else {
        setOtpError(response?.message || "Invalid OTP. Please try again.");
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: response?.message || "OTP verification failed",
            severity: "error",
          },
        });
      }
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message || "OTP verification failed";
      setOtpError(errorMessage);
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: errorMessage,
          severity: "error",
        },
      });
      console.error("OTP verification failed:", error);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!address) return;

    try {
      setOtpError("");
      const response: any = await axiosBaseApi.post(
        "/wallet/validateWalletAddress",
        address,
      );

      if (response.status === 200 && !response.error) {
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: "OTP has been resent to your email",
            severity: "success",
          },
        });
      } else {
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: response?.data?.message ?? "Failed to resend OTP",
            severity: "error",
          },
        });
      }
    } catch (error: any) {
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: error?.response?.data?.message ?? "Failed to resend OTP",
          severity: "error",
        },
      });
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;

    setCloseCryptoDropdown(true);
    setWalletName("");
    setCryptocurrency("");
    setWalletAddress("");
    setXrpTag("");
    setErrors({});
    setPopupLoading(false);
    setOtpModalOpen(false);
    setAddress(null);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <PopupModal
      open={open}
      handleClose={handleClose}
      showHeader={false}
      hasFooter={false}
      transparent={true}
      disableEscapeKeyDown={isSubmitting}
      onClose={(event, reason) => {
        if (isSubmitting) {
          return;
        }
        if (reason === "backdropClick" || reason === "escapeKeyDown") {
          handleClose();
        }
      }}
      sx={{
        "& .MuiDialog-paper": {
          width: "100%",
          maxWidth: "481px",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          p: 2,
        },
      }}
    >
      {headerExtra && (
        <Box sx={{ px: isMobile ? 2 : 3.75, pt: isMobile ? 2 : 2.5 }}>
          {headerExtra}
        </Box>
      )}
      <PanelCard
        title={tWallet("addWalletTitle")}
        showHeaderBorder={false}
        headerIcon={
          <Image
            src={WalletIcon}
            alt="wallet icon"
            width={14}
            height={14}
            draggable={false}
          />
        }
        bodyPadding={
          isMobile
            ? theme.spacing(1.5, 2, 2, 2)
            : theme.spacing(1.5, 3.75, 3.75, 3.75)
        }
        headerPadding={
          isMobile
            ? theme.spacing(2, 2, 0, 2)
            : theme.spacing(3.75, 3.75, 0, 3.75)
        }
        headerActionLayout="inline"
      >
        <Typography
          sx={{
            fontSize: isMobile ? "13px" : "15px",
            fontWeight: 500,
            fontFamily: "UrbanistMedium",
            lineHeight: isMobile ? "16px" : "18px",
            mb: isMobile ? "14px" : "16px",
          }}
        >
          {tWallet("addWalletDescription")}
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <InputField
            label={tWallet("walletName")}
            placeholder={tWallet("walletNamePlaceholder")}
            value={walletName}
            onChange={(e) => {
              setWalletName(e.target.value);
            }}
            error={!!errors.walletName}
            helperText={errors.walletName}
          />
          <CryptocurrencySelector
            label={tWallet("cryptocurrency") + " *"}
            value={cryptocurrency}
            onChange={(value) => {
              setCryptocurrency(value);
            }}
            error={!!errors.cryptocurrency}
            helperText={errors.cryptocurrency}
            sxIconChip={{
              [theme.breakpoints.down("sm")]: {
                height: "26px",
                padding: "4px 6px",
                "& img": {
                  width: "14px",
                  height: "14px",
                },
              },
            }}
            closeDropdownTrigger={closeCryptoDropdown}
          />
          <InputField
            label={tWallet("walletAddress") + " *"}
            placeholder={tWallet("walletAddressPlaceholder")}
            value={walletAddress}
            onChange={(e) => {
              setWalletAddress(e.target.value);
              if (errors.walletAddress) {
                setErrors({ ...errors, walletAddress: undefined });
              }
            }}
            error={!!errors.walletAddress}
            helperText={errors.walletAddress}
          />

          <WarningContainer>
            <WarningIconContainer>
              <Image
                src={InfoIcon}
                alt="info icon"
                width={16}
                height={16}
                draggable={false}
                style={{ filter: "brightness(0)" }}
              />
            </WarningIconContainer>
            <WarningContent>
              <p>{tWallet("warningMessage")}</p>
            </WarningContent>
          </WarningContainer>

          {TAG_BASED_CHAINS.includes(cryptocurrency) && (
            <>
              <InputField
                label={tWallet("XRPTag")}
                placeholder={tWallet("XRPTagPlaceholder")}
                value={xrpTag}
                onChange={(e) => {
                  setXrpTag(e.target.value);
                  if (errors.xrpTag) {
                    setErrors({ ...errors, xrpTag: undefined });
                  }
                }}
                error={!!errors.xrpTag}
                helperText={errors.xrpTag}
              />

              <WarningContainer>
                <WarningIconContainer>
                  <Image
                    src={InfoIcon}
                    alt="info icon"
                    width={16}
                    height={16}
                    draggable={false}
                    style={{ filter: "brightness(0)" }}
                  />
                </WarningIconContainer>
                <WarningContent>
                  <p>{tWallet("XRPTagWarning")}</p>
                </WarningContent>
              </WarningContainer>
            </>
          )}
        </Box>
        <Box
          sx={{ display: "flex", gap: "20px", mt: isMobile ? "14px" : "20px" }}
        >
          <CustomButton
            label={tWallet("cancel")}
            variant="outlined"
            onClick={handleClose}
            disabled={isSubmitting}
            sx={{
              flex: 1,
              [theme.breakpoints.down("sm")]: {
                height: "32px",
                fontSize: "13px",
              },
            }}
          />
          <CustomButton
            label={tWallet("continue")}
            variant="primary"
            onClick={handleSubmit}
            disabled={popupLoading || isSubmitting}
            sx={{
              flex: 1,
              [theme.breakpoints.down("sm")]: {
                height: "32px",
                fontSize: "13px",
              },
            }}
          />
        </Box>
      </PanelCard>

      <OtpDialog
        open={otpModalOpen}
        onClose={() => {
          setOtpModalOpen(false);
          setOtpError("");
        }}
        title={tWallet("emailVerification")}
        subtitle={tWallet("emailVerificationSubtitle")}
        contactInfo={userState.email}
        contactType="email"
        otpLength={6}
        onVerify={handleOtpVerify}
        onResendCode={handleResendCode}
        loading={otpLoading}
        error={otpError}
        onClearError={() => setOtpError("")}
        countdown={0}
      />
    </PopupModal>
  );
};

export default AddWalletModal;
