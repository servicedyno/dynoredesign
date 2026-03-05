import PanelCard from "@/Components/UI/PanelCard";
import { Box, Typography, useMediaQuery } from "@mui/material";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { PaymentLinkAction } from "@/Redux/Actions";
import { PAYLINK_CREATE, PAYLINK_UPDATE, PAYLINK_FEE_PREVIEW } from "@/Redux/Actions/PaymentLinkAction";
import PaymentLinkSuccessModal from "./PaymentLinkSuccessModal";
import { TabContentContainer } from "./styled";

import BitcoinIcon from "@/assets/cryptocurrency/Bitcoin-icon.svg";
import BitcoinCashIcon from "@/assets/cryptocurrency/BitcoinCash-icon.svg";
import DogecoinIcon from "@/assets/cryptocurrency/Dogecoin-icon.svg";
import EthereumIcon from "@/assets/cryptocurrency/Ethereum-icon.svg";
import LitecoinIcon from "@/assets/cryptocurrency/Litecoin-icon.svg";
import PolygonIcon from "@/assets/cryptocurrency/Polygon-icon.svg";
import RLUSDIcon from "@/assets/cryptocurrency/RLUSD-icon.svg";
import SolanaIcon from "@/assets/cryptocurrency/Solana-icon.svg";
import TronIcon from "@/assets/cryptocurrency/Tron-icon.svg";
import USDTIcon from "@/assets/cryptocurrency/USDT-icon.svg";
import USDT2Icon from "@/assets/cryptocurrency/USDT2-icon.svg";
import XRPIcon from "@/assets/cryptocurrency/XRP-icon.svg";

import useIsMobile from "@/hooks/useIsMobile";
import i18n from "@/i18n";
import { theme } from "@/styles/theme";
import { PaymentLink } from "@/utils/types/paymentLink";

import {
  ActionButtons,
  CryptoSelection,
  DescriptionSection,
  PaymentLinkHeader,
  PaymentSettingsBasic,
  PostPaymentSettings,
  TabNavigation,
  TaxSection,
} from "@/Components/UI/pay-link";
import SaveChangeModel from "@/Components/UI/pay-link/SaveChangeModel";
import {
  CreatePaymentLinkPageProps,
  ICryptoItem,
} from "@/utils/types/create-pay-link";

function truncateByWords(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;

  const trimmed = text.slice(0, maxLength);
  const words = `${trimmed}...`;
  return words;
}

const CreatePaymentLinkPage = ({
  paymentLinkData,
  disabled,
}: CreatePaymentLinkPageProps) => {
  const isMobile = useIsMobile("md");
  const dispatch = useDispatch();
  const { t } = useTranslation("createPaymentLinkScreen");
  const paymentLinkState = useSelector((state: any) => state.paymentLinkReducer);
  const feePreview = paymentLinkState?.feePreview;
  const tPaymentLink = useCallback(
    (key: string): string => {
      const result = t(key, { ns: "createPaymentLinkScreen" });
      return typeof result === "string" ? result : String(result);
    },
    [t],
  );
  const currentLng = i18n.language;
  const hasPaymentLinkData = Object.keys(paymentLinkData).length > 0;
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [cryptoItems, setCryptoItems] = useState<ICryptoItem[]>([]);
  const [filteredCryptoItems, setFilteredCryptoItems] = useState<ICryptoItem[]>(
    [],
  );
  const [showFilteredCryptoItems, setShowFilteredCryptoItems] =
    useState<boolean>(false);
  const [activeTab, setActiveTab] = useState(0);
  const [blockchainFees, setBlockchainFees] = useState("company");
  const expireAnchorEl = useRef<HTMLElement | null>(null);
  const expireTriggerRef = useRef<HTMLDivElement>(null);
  const [expireOpen, setExpireOpen] = useState<boolean>(false);
  const [successModalOpen, setSuccessModalOpen] = useState<boolean>(false);
  const [saveChangeModalOpen, setSaveChangeModalOpen] =
    useState<boolean>(false);
  const [paymentLink, setPaymentLink] = useState("");
  const currencyTriggerRef = useRef<HTMLButtonElement | null>(null);
  const currencyAnchorEl = useRef<HTMLButtonElement | null>(null);
  const [includeTax, setIncludeTax] = useState<boolean>(
    disabled ? true : false,
  );
  const [showAllCoins, setShowAllCoins] = useState(false);
  const MIN_WIDTH = 390;
  const MAX_WIDTH = 900;
  const BASE_COUNT = 15;
  const STEP = 10;

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [count, setCount] = useState(BASE_COUNT);

  const [currencyOpen, setCurrencyOpen] = useState(false);

  const currencies = ["USD", "EUR", "GBP", "INR", "AED"];

  const handleCurrencyOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
    currencyAnchorEl.current = e.currentTarget;
    setCurrencyOpen(true);
  };

  const handleCurrencyClose = () => {
    setCurrencyOpen(false);
  };

  const handleCurrencySelect = (currency: string) => {
    setPaymentSettings((prev) => ({ ...prev, currency }));
    setPaymentSettingsTouched((p) => ({ ...p, currency: true }));
    setPaymentSettingsErrors((p) => ({ ...p, currency: "" }));
    setCurrencyOpen(false);
  };

  // Payment Settings (Tab 0) form data
  const [paymentSettings, setPaymentSettings] = useState({
    value: hasPaymentLinkData
      ? (paymentLinkData as PaymentLink).amount.toString()
      : "",
    cryptoValue: "",
    currency: hasPaymentLinkData
      ? (paymentLinkData as PaymentLink).currency
      : "",
    clientName: hasPaymentLinkData
      ? (paymentLinkData as PaymentLink).clientName
      : "",
    expire: hasPaymentLinkData ? (paymentLinkData as PaymentLink).expire : "no",
    description: hasPaymentLinkData
      ? (paymentLinkData as PaymentLink).description
      : "",
    blockchainFees: hasPaymentLinkData
      ? (paymentLinkData as PaymentLink).blockchainFees
      : "company",
    linkId: hasPaymentLinkData ? (paymentLinkData as PaymentLink).link_id : "",
    acceptedCryptoCurrency: hasPaymentLinkData
      ? (paymentLinkData as PaymentLink).acceptedCryptoCurrency
      : [],
  });

  // Validation errors for Payment Settings tab
  const [paymentSettingsErrors, setPaymentSettingsErrors] = useState({
    value: "",
    currency: "",
    description: "",
  });

  // Touched fields for Payment Settings tab
  const [paymentSettingsTouched, setPaymentSettingsTouched] = useState({
    value: false,
    currency: false,
    description: false,
  });

  // Post-Payment Settings (Tab 1) form data
  const [postPaymentSettings, setPostPaymentSettings] = useState({
    callbackUrl: hasPaymentLinkData
      ? (paymentLinkData as PaymentLink).payment_url
      : "",
    redirectUrl: hasPaymentLinkData
      ? (paymentLinkData as PaymentLink).redirect_url
      : "",
    webhookUrl: hasPaymentLinkData
      ? (paymentLinkData as PaymentLink).webhook_url
      : "",
  });

  const handleTabChange = (tab: number) => {
    setActiveTab(tab);
  };

  const handleBlockchainFeesChange = (value: string) => {
    setBlockchainFees(value);
    setPaymentSettings((prev) => ({ ...prev, blockchainFees: value }));
  };

  const validatePaymentSettings = () => {
    const errors: { value: string; description: string; currency: string } = {
      value: "",
      currency: "",
      description: "",
    };

    if (!paymentSettings.value || paymentSettings.value.trim() === "") {
      errors.value = tPaymentLink("valueRequired");
    } else {
      const numValue = parseFloat(paymentSettings.value);
      if (isNaN(numValue) || numValue <= 0) {
        errors.value = tPaymentLink("valueInvalid");
      } else if (numValue > 999999999) {
        errors.value = tPaymentLink("valueTooLarge");
      } else if (paymentSettings.value.split(".")[1]?.length > 2) {
        errors.value = tPaymentLink("valueDecimalPlaces");
      }
    }

    if (
      paymentSettings.description &&
      paymentSettings.description.length > 500
    ) {
      errors.description = tPaymentLink("descriptionMaxLength");
    }

    setPaymentSettingsErrors(errors);
    return !errors.value && !errors.currency && !errors.description;
  };

  const handlePaymentSettingsChange = (field: string, value: string) => {
    setPaymentSettings((prev) => ({ ...prev, [field]: value }));

    if (paymentSettingsErrors[field as keyof typeof paymentSettingsErrors]) {
      setPaymentSettingsErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handlePaymentSettingsBlur = (field: string) => {
    setPaymentSettingsTouched((prev) => ({ ...prev, [field]: true }));
    validatePaymentSettings();
  };

  const handlePostPaymentSettingsChange = (field: string, value: string) => {
    setPostPaymentSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleExpireOpen = (event: React.MouseEvent<HTMLElement>) => {
    expireAnchorEl.current = event.currentTarget;
    setExpireOpen(true);
  };

  const handleExpireClose = () => {
    setExpireOpen(false);
    expireAnchorEl.current = null;
  };

  const handleExpireSelect = (value: string) => {
    handlePaymentSettingsChange("expire", value);
    handleExpireClose();
  };

  const validateCurrency = useCallback(
    (value: string) => {
      if (!value) return tPaymentLink("currencyRequired");
      return "";
    },
    [tPaymentLink],
  );

  // Handle click outside for expire dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        expireTriggerRef.current &&
        !expireTriggerRef.current.contains(event.target as Node) &&
        expireAnchorEl.current &&
        !(expireAnchorEl.current as HTMLElement).contains(event.target as Node)
      ) {
        handleExpireClose();
      }
    };

    if (expireOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [expireOpen]);

  const handleSaveChanges = () => {
    setSaveChangeModalOpen(true);
  };

  // Fetch fee preview when amount or currency changes
  useEffect(() => {
    const amount = parseFloat(paymentSettings.value);
    if (amount > 0 && paymentSettings.currency) {
      const timer = setTimeout(() => {
        dispatch(
          PaymentLinkAction(PAYLINK_FEE_PREVIEW, {
            amount,
            currency: paymentSettings.currency,
          })
        );
      }, 500); // debounce
      return () => clearTimeout(timer);
    }
  }, [paymentSettings.value, paymentSettings.currency, dispatch]);

  const handleCreatePaymentLink = () => {
    if (activeTab === 0) {
      setPaymentSettingsTouched({
        value: true,
        currency: true,
        description: true,
      });

      if (!validatePaymentSettings()) {
        return;
      }

      // Build API payload
      const apiPayload = {
        amount: parseFloat(paymentSettings.value),
        currency: paymentSettings.currency,
        description: paymentSettings.description,
        clientName: paymentSettings.clientName,
        expire: paymentSettings.expire,
        blockchainFees: paymentSettings.blockchainFees,
        acceptedCryptoCurrency: paymentSettings.acceptedCryptoCurrency,
        redirect_url: postPaymentSettings.redirectUrl,
        webhook_url: postPaymentSettings.webhookUrl,
        payment_url: postPaymentSettings.callbackUrl,
      };

      // Dispatch to Redux saga which calls the API
      if (hasPaymentLinkData) {
        dispatch(
          PaymentLinkAction(PAYLINK_UPDATE, {
            id: (paymentLinkData as PaymentLink).link_id,
            ...apiPayload,
          })
        );
      } else {
        dispatch(PaymentLinkAction(PAYLINK_CREATE, apiPayload));
      }

      const generatedLink = `https://pay.dynopay.com/${Math.random()
        .toString(36)
        .substring(7)}`;
      setPaymentLink(generatedLink);
      setSuccessModalOpen(true);
    } else if (activeTab === 1) {
      const apiPayload = {
        amount: parseFloat(paymentSettings.value) || 0,
        currency: paymentSettings.currency,
        description: paymentSettings.description,
        redirect_url: postPaymentSettings.redirectUrl,
        webhook_url: postPaymentSettings.webhookUrl,
        payment_url: postPaymentSettings.callbackUrl,
      };

      dispatch(PaymentLinkAction(PAYLINK_CREATE, apiPayload));

      const generatedLink = `https://pay.dynopay.com/${Math.random()
        .toString(36)
        .substring(7)}`;
      setPaymentLink(generatedLink);
      setSuccessModalOpen(true);
    }
  };

  const handleCloseSuccessModal = () => {
    setSuccessModalOpen(false);
  };

  const handleCopyLink = () => {
    if (paymentLink) {
      navigator.clipboard.writeText(paymentLink);
      dispatch({
        type: "TOAST_SHOW",
        payload: { message: "Payment link copied!", severity: "success" },
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const trigger = currencyTriggerRef.current;
      const popover = currencyAnchorEl.current;

      if (
        trigger &&
        !trigger.contains(event.target as Node) &&
        popover &&
        !popover.contains(event.target as Node)
      ) {
        setCurrencyOpen(false);

        setPaymentSettingsTouched((p) => ({ ...p, currency: true }));

        const error = validateCurrency(paymentSettings.currency);
        setPaymentSettingsErrors((p) => ({ ...p, currency: error }));
      }
    };

    if (currencyOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [currencyOpen, paymentSettings.currency, validateCurrency]);

  const disable = {
    pointerEvents: disabled ? "none" : "auto",
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "not-allowed" : "inherit",
    filter: disabled ? "grayscale(1)" : "none",
  };

  const ALL_CRYPTO_ITEMS: ICryptoItem[] = React.useMemo(
    () => [
      {
        name: "Bitcoin",
        label: "BTC",
        icon: BitcoinIcon,
        fullOrder: 15,
        shortOrder: 1,
      },
      {
        name: "Ethereum",
        label: "ETH",
        icon: EthereumIcon,
        fullOrder: 5,
        shortOrder: 2,
      },
      {
        name: "Tron",
        label: "TRX",
        icon: TronIcon,
        fullOrder: 4,
        shortOrder: 3,
      },
      {
        name: "Litecoin",
        label: "LTC",
        icon: LitecoinIcon,
        fullOrder: 3,
        shortOrder: 4,
      },
      {
        name: "Dogecoin",
        label: "DOGE",
        icon: DogecoinIcon,
        fullOrder: 8,
        shortOrder: 5,
      },
      {
        name: "Bitcoin Cash",
        label: "BCH",
        icon: BitcoinCashIcon,
        fullOrder: 1,
        shortOrder: 6,
      },
      {
        name: "USDT",
        label: "TRC-20",
        icon: USDTIcon,
        fullOrder: 2,
        shortOrder: 7,
      },
      {
        name: "USDT",
        label: "ERC-20",
        icon: USDTIcon,
        fullOrder: 6,
        shortOrder: 8,
      },
      {
        name: "USDT",
        label: "FRC-20",
        icon: USDT2Icon,
        fullOrder: 7,
        shortOrder: 9,
      },
      {
        name: "Solana",
        label: "SOL",
        icon: SolanaIcon,
        fullOrder: 9,
        shortOrder: 10,
      },
      {
        name: "XRP",
        label: "XRP",
        icon: XRPIcon,
        fullOrder: 10,
        shortOrder: 11,
      },
      {
        name: "POLYGON",
        label: "POLYGON",
        icon: PolygonIcon,
        fullOrder: 11,
        shortOrder: 12,
      },
      {
        name: "POLYGON USDT",
        label: "ERC-20",
        icon: PolygonIcon,
        fullOrder: 12,
        shortOrder: 13,
      },
      {
        name: "RLUSD",
        label: "XRP",
        icon: RLUSDIcon,
        fullOrder: 13,
        shortOrder: 14,
      },
      {
        name: "RLUSD",
        label: "ERC-20",
        icon: RLUSDIcon,
        fullOrder: 14,
        shortOrder: 15,
      },
    ],
    [],
  );

  const handleSearch = () => {
    if (searchTerm.trim() !== "") {
      const filterdData = cryptoItems.filter(
        (item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.label.toLowerCase().includes(searchTerm.toLowerCase()),
      );
      setFilteredCryptoItems(filterdData);
    } else {
      setFilteredCryptoItems([]);
    }
    setShowFilteredCryptoItems(true);
  };

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setShowFilteredCryptoItems(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const fullSorted = [...ALL_CRYPTO_ITEMS].sort(
      (a, b) => a.fullOrder - b.fullOrder,
    );

    if (!hasPaymentLinkData) {
      setCryptoItems(
        fullSorted
          .filter((item) => item.shortOrder <= 9)
          .sort((a, b) => a.shortOrder - b.shortOrder),
      );
    } else {
      setCryptoItems(fullSorted);
    }
  }, [ALL_CRYPTO_ITEMS, hasPaymentLinkData, showAllCoins]);

  const isLarge = useMediaQuery("(min-width:1000px)");
  const isSmall = useMediaQuery("(min-width:650px)");

  const walletNotSetUp = ["BCH"];

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const clampedWidth = Math.min(Math.max(windowWidth, MIN_WIDTH), MAX_WIDTH);

    const extra = Math.floor((clampedWidth - MIN_WIDTH) / STEP);
    setCount(BASE_COUNT + extra);
  }, [windowWidth]);

  return (
    <div>
      <PaymentLinkSuccessModal
        open={successModalOpen}
        onClose={handleCloseSuccessModal}
        paymentLink={paymentLink}
        paymentSettings={paymentSettings}
        onCopyLink={handleCopyLink}
      />
      <SaveChangeModel
        open={saveChangeModalOpen}
        onClose={() => setSaveChangeModalOpen(false)}
        onSave={handleCreatePaymentLink}
      />

      <PanelCard
        bodyPadding={
          isMobile
            ? 2
            : hasPaymentLinkData
              ? theme.spacing("30px", 2.4, "30px", 2.5)
              : theme.spacing("30px", 2.5, "30px", 2.5)
        }
        sx={{
          mb: hasPaymentLinkData ? 10 : 0,
          maxWidth: { xs: "100%", md: "959px" },
          width: "100%",
          borderRadius: { xs: "8px", md: "14px" },
        }}
      >
        <TabNavigation
          activeTab={activeTab}
          onChange={handleTabChange}
          tPaymentLink={tPaymentLink}
          hasPaymentLinkData={hasPaymentLinkData}
        />

        {activeTab === 0 && (
          <TabContentContainer
            sx={{
              padding: isMobile
                ? "14px 0px 0px 0px"
                : hasPaymentLinkData
                  ? "0px"
                  : "16px 0px 0px 0px",
            }}
          >
            {hasPaymentLinkData && (
              <PaymentLinkHeader
                tPaymentLink={tPaymentLink}
                paymentLinkData={paymentLinkData as PaymentLink}
                disabled={disabled}
                isMobile={isMobile}
                count={count}
                truncateByWords={truncateByWords}
              />
            )}

            <TabContentContainer sx={{ ...disable }}>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: "column", md: "row" },
                  gap: { xs: "12px", md: 3 },
                }}
              >
                <PaymentSettingsBasic
                  isMobile={isMobile}
                  tPaymentLink={tPaymentLink}
                  paymentSettings={paymentSettings}
                  paymentSettingsTouched={paymentSettingsTouched}
                  paymentSettingsErrors={paymentSettingsErrors}
                  currencyOpen={currencyOpen}
                  currencies={currencies}
                  expireOpen={expireOpen}
                  blockchainFees={blockchainFees}
                  disable={disable}
                  handlePaymentSettingsChange={handlePaymentSettingsChange}
                  handlePaymentSettingsBlur={handlePaymentSettingsBlur}
                  handleCurrencyOpen={handleCurrencyOpen}
                  handleCurrencyClose={handleCurrencyClose}
                  handleCurrencySelect={handleCurrencySelect}
                  handleExpireOpen={handleExpireOpen}
                  handleExpireClose={handleExpireClose}
                  handleExpireSelect={handleExpireSelect}
                  handleBlockchainFeesChange={handleBlockchainFeesChange}
                  currencyAnchorEl={currencyAnchorEl}
                  currencyTriggerRef={currencyTriggerRef}
                  expireAnchorEl={expireAnchorEl}
                  expireTriggerRef={expireTriggerRef}
                />
                <Box sx={{ flex: 1 }}>
                  <DescriptionSection
                    isMobile={isMobile}
                    tPaymentLink={tPaymentLink}
                    paymentSettings={paymentSettings}
                    paymentSettingsTouched={paymentSettingsTouched}
                    paymentSettingsErrors={paymentSettingsErrors}
                    handlePaymentSettingsChange={handlePaymentSettingsChange}
                    handlePaymentSettingsBlur={handlePaymentSettingsBlur}
                  />
                </Box>
              </Box>

              <Box
                sx={{
                  height: "1px",
                  backgroundColor: theme.palette.border.main,
                }}
              />

              <CryptoSelection
                isMobile={isMobile}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                handleSearch={handleSearch}
                cryptoItems={cryptoItems}
                filteredCryptoItems={filteredCryptoItems}
                showFilteredCryptoItems={showFilteredCryptoItems}
                showAllCoins={showAllCoins}
                setShowAllCoins={setShowAllCoins}
                hasPaymentLinkData={hasPaymentLinkData}
                isLarge={isLarge}
                isSmall={isSmall}
                walletNotSetUp={walletNotSetUp}
                paymentSettings={paymentSettings}
                setPaymentSettings={setPaymentSettings}
              />

              <Box
                sx={{
                  height: "1px",
                  backgroundColor: theme.palette.border.main,
                }}
              />

              <TaxSection
                isMobile={isMobile}
                tPaymentLink={tPaymentLink}
                includeTax={includeTax}
                setIncludeTax={setIncludeTax}
                currentLng={currentLng}
              />

              {hasPaymentLinkData && (
                <Box
                  sx={{
                    height: "1px",
                    backgroundColor: theme.palette.border.main,
                  }}
                />
              )}

              {hasPaymentLinkData && (
                <PostPaymentSettings
                  hasPaymentLinkData={hasPaymentLinkData}
                  isMobile={isMobile}
                  tPaymentLink={tPaymentLink}
                  postPaymentSettings={postPaymentSettings}
                  handleChange={handlePostPaymentSettingsChange}
                />
              )}
            </TabContentContainer>

            {feePreview && (
              <Box
                data-testid="fee-preview-display"
                sx={{
                  p: isMobile ? "10px 14px" : "12px 16px",
                  backgroundColor: theme.palette.primary.light,
                  borderRadius: "8px",
                  border: `1px solid ${theme.palette.border.main}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 1,
                }}
              >
                <Typography sx={{ fontSize: 13, fontFamily: "UrbanistMedium", color: theme.palette.text.secondary }}>
                  Estimated Fee
                </Typography>
                <Typography sx={{ fontSize: 14, fontFamily: "UrbanistSemiBold", color: theme.palette.text.primary }}>
                  {feePreview.fee != null ? `${feePreview.fee} ${feePreview.currency || paymentSettings.currency}` : "—"}
                </Typography>
              </Box>
            )}

            <Box
              sx={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                gap: isMobile ? "14px" : "24px",
              }}
            >
              <ActionButtons
                isMobile={isMobile}
                hasPaymentLinkData={hasPaymentLinkData}
                disabled={disabled}
                tPaymentLink={tPaymentLink}
                handleCreatePaymentLink={
                  hasPaymentLinkData
                    ? handleSaveChanges
                    : handleCreatePaymentLink
                }
                paymentSettingsErrors={paymentSettingsErrors}
                paymentSettings={paymentSettings}
              />
            </Box>
          </TabContentContainer>
        )}

        {activeTab === 1 && (
          <TabContentContainer
            sx={{ padding: isMobile ? "14px 0px 0px 0px" : "16px 0px 0px 0px" }}
          >
            <PostPaymentSettings
              hasPaymentLinkData={hasPaymentLinkData}
              isMobile={isMobile}
              tPaymentLink={tPaymentLink}
              postPaymentSettings={postPaymentSettings}
              handleChange={handlePostPaymentSettingsChange}
              showHelpers={true}
              showCreateButton={true}
              onCreate={handleCreatePaymentLink}
            />
          </TabContentContainer>
        )}
      </PanelCard>
    </div>
  );
};

export default CreatePaymentLinkPage;
