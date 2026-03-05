import InfoIcon from "@/assets/Icons/info-icon.svg";
import Wallet from "@/Components/Page/Wallet";
import { SetupWarnnigContainer } from "@/Components/Page/Wallet/styled";
import AddWalletModal from "@/Components/UI/AddWalletModal";
import { WarningIconContainer } from "@/Components/UI/AddWalletModal/styled";
import CustomButton from "@/Components/UI/Buttons";
import useIsMobile from "@/hooks/useIsMobile";
import { useWalletData } from "@/hooks/useWalletData";
import { theme } from "@/styles/theme";
import { pageProps } from "@/utils/types";
import {
  AddRounded,
  ArrowOutward as ArrowOutwardIcon,
} from "@mui/icons-material";
import { Box, Typography } from "@mui/material";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const WalletPage = ({
  setPageName,
  setPageDescription,
  setPageAction,
  setPageHeaderSx,
  setPageWarning,
}: pageProps) => {
  const router = useRouter();
  const namespaces = ["walletScreen", "common"];
  const isMobile = useIsMobile("md");
  const { t } = useTranslation(namespaces);
  const tDashboard = useCallback(
    (key: string, defaultValue?: string) =>
      t(key, { ns: "walletScreen", defaultValue }),
    [t],
  );

  const [openCreate, setOpenCreate] = useState(false);
  const [currentCryptocurrency, setCurrentCryptocurrency] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem("walletAction");

    if (!stored) return;

    const { openCreate, cryptocurrency } = JSON.parse(stored);

    if (openCreate && cryptocurrency) {
      setOpenCreate(true);
      setCurrentCryptocurrency(cryptocurrency);
    }

    sessionStorage.removeItem("walletAction");
  }, []);

  const { walletWarning } = useWalletData();

  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName(tDashboard("walletsTitle"));
      setPageDescription(
        tDashboard(
          "walletsDescription",
          "Manage your cryptocurrency wallet addresses",
        ),
      );
    }
  }, [setPageName, setPageDescription, tDashboard]);

  useEffect(() => {
    if (setPageHeaderSx) {
      setPageHeaderSx({
        [theme.breakpoints.down("sm")]: {
          flexDirection: "column",
          justifyContent: "start",
          alignItems: "start",
          gap: 0.5,
        },

        "& .pageAction": {
          [theme.breakpoints.down("sm")]: {
            width: "100%",
          },
        },
      });
    }
    return () => {
      if (setPageHeaderSx) {
        setPageHeaderSx(null);
      }
    };
  }, [setPageHeaderSx]);

  useEffect(() => {
    if (!setPageWarning) return;
    setPageWarning(
      <>
        {walletWarning && (
          <SetupWarnnigContainer>
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
            <Box>
              <Typography
                sx={{
                  fontFamily: "UrbanistSemibold",
                  fontWeight: "600",
                  fontSize: isMobile ? "10px" : "15px",
                  lineHeight: "130%",
                  letterSpacing: 0,
                }}
              >
                {t("walletSetUpWarnnigTitle")}
              </Typography>
              <Typography
                sx={{
                  fontFamily: "UrbanistMedium",
                  fontWeight: "500",
                  fontSize: isMobile ? "10px" : "15px",
                  lineHeight: "130%",
                  letterSpacing: 0,
                }}
              >
                {(() => {
                  const text = t("walletSetUpWarnnigSubtitle");
                  const boldText = t("walletSetUpWarnnigSubtitleBold");
                  const parts = text.split(boldText);
                  if (parts.length === 2) {
                    return (
                      <>
                        {parts[0]}
                        <Typography
                          component="span"
                          sx={{
                            fontFamily: "UrbanistSemibold",
                            fontWeight: "600",
                            fontSize: isMobile ? "10px" : "15px",
                            lineHeight: "130%",
                            letterSpacing: 0,
                          }}
                        >
                          {boldText}
                        </Typography>
                        {parts[1]}
                      </>
                    );
                  }
                  return text;
                })()}
              </Typography>
            </Box>
          </SetupWarnnigContainer>
        )}
      </>,
    );
    return () => setPageWarning(null);
  }, [setPageWarning, isMobile, t, walletWarning]);

  useEffect(() => {
    if (!setPageAction) return;
    setPageAction(
      <>
        <CustomButton
          label={tDashboard("createPaymentLink", "Create payment link")}
          variant="outlined"
          size="medium"
          endIcon={<ArrowOutwardIcon sx={{ fontSize: isMobile ? 14 : 16 }} />}
          onClick={() => {
            router.push("/create-pay-link");
          }}
          sx={{
            border: `1px solid ${theme.palette.primary.main}`,
            color: theme.palette.primary.main,
            height: isMobile ? 34 : 40,
            px: isMobile ? 1.5 : 2.5,
            fontSize: isMobile ? 13 : 15,
            "&:hover": {
              border: `1px solid ${theme.palette.primary.main}`,
              color: theme.palette.primary.main,
            },
            "&:disabled": {
              border: `1px solid ${theme.palette.border.main}`,
              color: theme.palette.text.primary,
            },
            [theme.breakpoints.down("sm")]: {
              flex: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            },
          }}
        />
        <CustomButton
          label={tDashboard("addWallet", "Add wallet")}
          variant="primary"
          size="medium"
          endIcon={<AddRounded sx={{ fontSize: isMobile ? 18 : 20 }} />}
          onClick={() => setOpenCreate(true)}
          sx={{
            height: isMobile ? 34 : 40,
            px: isMobile ? 1.5 : 2.5,
            fontSize: isMobile ? 13 : 15,
            [theme.breakpoints.down("sm")]: {
              flex: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            },
          }}
        />
      </>,
    );
    return () => setPageAction(null);
  }, [setPageAction, tDashboard, isMobile, router]);

  return (
    <>
      <Head>
        <title>DynoPay - Wallet</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Box
        sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
      >
        <Wallet />
        <AddWalletModal
          open={openCreate}
          currentCryptocurrency={currentCryptocurrency}
          onClose={() => setOpenCreate(false)}
        />
      </Box>
    </>
  );
};

export default WalletPage;
