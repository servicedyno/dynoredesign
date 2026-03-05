import CreatePaymentLinkPage from "@/Components/Page/CreatePaymentLink";
import useIsMobile from "@/hooks/useIsMobile";
import { pageProps, rootReducer } from "@/utils/types";
import { Box, Typography, useTheme } from "@mui/material";
import {
  BusinessRounded,
  AccountBalanceWalletRounded,
  ArrowForwardRounded,
} from "@mui/icons-material";
import Head from "next/head";
import { useRouter } from "next/router";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { CompanyAction } from "@/Redux/Actions";
import { COMPANY_FETCH } from "@/Redux/Actions/CompanyAction";
import { WalletAction } from "@/Redux/Actions";
import { WALLET_FETCH } from "@/Redux/Actions/WalletAction";

const CreatePaymentLink = ({ setPageName, setPageDescription }: pageProps) => {
  const namespaces = ["createPaymentLinkScreen", "common"];
  const { t } = useTranslation(namespaces);
  const isMobile = useIsMobile("md");
  const theme = useTheme();
  const router = useRouter();
  const dispatch = useDispatch();

  const companyState = useSelector(
    (state: rootReducer) => state.companyReducer,
  );
  const walletState = useSelector((state: rootReducer) => state.walletReducer);
  const hasCompany = companyState.companyList?.length > 0;
  const hasWallet = walletState.walletList?.length > 0;
  const setupComplete = hasCompany && hasWallet;

  useEffect(() => {
    dispatch(CompanyAction(COMPANY_FETCH));
    dispatch(WalletAction(WALLET_FETCH));
  }, [dispatch]);

  const tCreatePaymentLink = useCallback(
    (key: string, defaultValue?: string) =>
      t(key, { ns: "createPaymentLinkScreen", defaultValue }),
    [t],
  );

  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName(
        tCreatePaymentLink("createPaymentLinkTitle", "Create Payment Link"),
      );
      setPageDescription("");
    }
  }, [setPageName, setPageDescription, tCreatePaymentLink]);

  const missingSteps = [];
  if (!hasCompany) missingSteps.push({ label: "Create a Company", icon: BusinessRounded, path: "/company" });
  if (!hasWallet) missingSteps.push({ label: "Add a Wallet", icon: AccountBalanceWalletRounded, path: "/wallet" });

  return (
    <>
      <Head>
        <title>DynoPay - Create Payment Link</title>
        <meta name="description" content="Create a new payment link" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {setupComplete ? (
        <Box sx={{ mt: isMobile ? "4px" : "0px" }}>
          <CreatePaymentLinkPage paymentLinkData={{}} disabled={false} />
        </Box>
      ) : (
        <Box
          data-testid="payment-link-setup-guard"
          sx={{
            maxWidth: "600px",
            mx: "auto",
            mt: isMobile ? 4 : 8,
            px: 3,
            textAlign: "center",
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: "16px",
              backgroundColor: theme.palette.primary.light,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mx: "auto",
              mb: 2.5,
            }}
          >
            <BusinessRounded sx={{ fontSize: 32, color: theme.palette.primary.main }} />
          </Box>
          <Typography
            data-testid="setup-required-title"
            sx={{
              fontSize: isMobile ? "18px" : "22px",
              fontFamily: "UrbanistSemibold",
              fontWeight: 600,
              color: theme.palette.text.primary,
              mb: 1,
            }}
          >
            Complete setup to create payment links
          </Typography>
          <Typography
            sx={{
              fontSize: isMobile ? "13px" : "15px",
              fontFamily: "UrbanistMedium",
              fontWeight: 500,
              color: theme.palette.text.secondary,
              mb: 3,
              lineHeight: 1.5,
            }}
          >
            Before you can create a payment link, you need to complete the
            following steps:
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {missingSteps.map((step) => {
              const Icon = step.icon;
              return (
                <Box
                  key={step.path}
                  data-testid={`setup-guard-step-${step.path.replace("/", "")}`}
                  onClick={() => router.push(step.path)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    p: isMobile ? "12px 16px" : "14px 20px",
                    borderRadius: "12px",
                    border: `1px solid ${theme.palette.border.main}`,
                    backgroundColor: "#fff",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    "&:hover": {
                      borderColor: theme.palette.primary.main,
                      backgroundColor: theme.palette.primary.light,
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: "10px",
                      backgroundColor: theme.palette.primary.light,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
                  </Box>
                  <Typography
                    sx={{
                      flex: 1,
                      fontSize: isMobile ? "14px" : "15px",
                      fontFamily: "UrbanistSemibold",
                      fontWeight: 600,
                      color: theme.palette.text.primary,
                      textAlign: "left",
                    }}
                  >
                    {step.label}
                  </Typography>
                  <ArrowForwardRounded
                    sx={{ fontSize: 20, color: theme.palette.primary.main }}
                  />
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </>
  );
};

export default CreatePaymentLink;
