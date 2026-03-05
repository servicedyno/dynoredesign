import { Box, Button, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";

import { useTheme } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { rootReducer } from "@/utils/types";
import {
  createEncryption,
  generateRedirectUrl,
  getCurrencySymbol,
} from "@/helpers";
import LoadingIcon from "@/assets/Icons/LoadingIcon";
import axiosBaseApi from "@/axiosConfig";
import { useRouter } from "next/router";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import {
  CommonApiRes,
  CommonDetails,
  currencyData,
} from "@/utils/types/paymentTypes";
import { NorthEastRounded } from "@mui/icons-material";
import { paymentTypes } from "@/utils/enums";

const QRCodeComponent = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const walletState = useSelector((state: rootReducer) => state.walletReducer);
  const [loading, setLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<currencyData>();
  const [accountDetails, setAccountDetails] = useState<CommonDetails>();

  useEffect(() => {
    if (accountDetails) {
      setLoading(false);
      console.log(accountDetails);
    }
  }, [accountDetails]);

  useEffect(() => {
    if (walletState.amount && walletState.currency) {
      if (walletState.currency !== "NGN") {
        getCurrencyRate();
      } else {
        setSelectedCurrency({
          currency: "NGN",
          amount: walletState.amount.toString(),
          transferRate: "1",
        });
      }
    }
  }, [walletState.amount]);

  useEffect(() => {
    if (selectedCurrency?.currency) {
      initiateQRCodeTransfer();
    }
  }, [selectedCurrency]);

  const getCurrencyRate = async () => {
    try {
      const {
        data: { data },
      } = await axiosBaseApi.post("/wallet/getCurrencyRates", {
        source: walletState.currency,
        amount: walletState.amount,
        currencyList: ["NGN"],
      });

      setSelectedCurrency(data[0]);
    } catch (e: any) {
      const message = e.response.data.message ?? e.message;
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: message,
          severity: "error",
        },
      });
    }
  };

  const handleSubmit = async () => {
    try {
      const {
        data: { data },
      } = await axiosBaseApi.post("/wallet/verifyPayment", {
        uniqueRef: accountDetails?.hash,
      });
      const redirectUri = generateRedirectUrl(data);
      window.location.replace(redirectUri);
    } catch (e: any) {
      const message = e.response.data.message ?? e.message;
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: message,
          severity: "error",
        },
      });
    }
  };

  const initiateQRCodeTransfer = async () => {
    const finalPayload = {
      paymentType: paymentTypes.QR_CODE,
      currency: selectedCurrency?.currency,
      amount: selectedCurrency?.amount,
    };
    const res = createEncryption(JSON.stringify(finalPayload));

    const {
      data: { data },
    }: { data: CommonApiRes } = await axiosBaseApi.post("/wallet/addFunds", {
      data: res,
    });
    setAccountDetails(data);
  };

  return (
    <Box
      sx={{
        maxWidth: "450px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        mt: 5,
      }}
    >
      {loading ? (
        <>
          <Typography>Please wait</Typography>
          <Box
            sx={{
              height: "375px",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LoadingIcon size={75} />
          </Box>
        </>
      ) : (
        <>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              p: 3,
              mt: 2,
              background: theme.palette.secondary.main + "11",
              border: "1px solid #a2a2a2",
              borderRadius: "5px",
              gap: 2,
              "& .topText": {
                color: "text.disabled",
                fontSize: 12,
                textTransform: "uppercase",
              },
              "& .mainText": {
                fontWeight: 600,
                fontSize: 22,
              },
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography className="topText">Amount</Typography>
                <Typography className="mainText">
                  {selectedCurrency?.currency + " " + selectedCurrency?.amount}
                  {selectedCurrency?.currency !== walletState.currency && (
                    <Typography
                      component={"span"}
                      ml={1}
                      fontSize={14}
                      color="text.disabled"
                    >
                      (
                      {walletState.currency +
                        " " +
                        getCurrencySymbol(
                          walletState.currency,
                          walletState.amount
                        )}
                      )
                    </Typography>
                  )}
                </Typography>
              </Box>
              {selectedCurrency?.currency !== walletState.currency && (
                <Box>
                  <Typography className="topText" textAlign={"right"}>
                    Transfer Rate
                  </Typography>
                  <Typography fontSize={14} fontWeight={600}>
                    ({" "}
                    {walletState.currency +
                      " " +
                      getCurrencySymbol(walletState.currency, 1)}
                    {" = "}
                    {selectedCurrency &&
                      " " +
                        getCurrencySymbol(
                          selectedCurrency.currency,
                          selectedCurrency.transferRate
                        )}
                    )
                  </Typography>
                </Box>
              )}
            </Box>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
              }}
            >
              <Box sx={{ "& img": { maxHeight: "350px", width: "100%" } }}>
                <img src={accountDetails?.qr_image} />
              </Box>
              <Typography textAlign={"center"}>
                Scan the QR Code above on your Bank’s mobile app to complete the
                payment.
              </Typography>
            </Box>
          </Box>
          <Button variant="rounded" sx={{ mt: 3 }} onClick={handleSubmit}>
            I have completed this payment
          </Button>
        </>
      )}
    </Box>
  );
};

export default QRCodeComponent;
