import LoadingIcon from "@/assets/Icons/LoadingIcon";
import axiosBaseApi from "@/axiosConfig";
import FormManager from "@/Components/Page/Common/FormManager";
import Dropdown from "@/Components/UI/Dropdown";
import PopupModal from "@/Components/UI/PopupModal";
import TextBox from "@/Components/UI/TextBox";
import { countDecimals, getCurrencySymbol } from "@/helpers";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import {
  ISavedAddressTypes,
  ITransaction,
  IWallet,
  menuItem,
  pageProps,
} from "@/utils/types";
import {
  Box,
  Button,
  Checkbox,
  Collapse,
  FormControlLabel,
  Grid,
  Radio,
  RadioGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import React, { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import * as yup from "yup";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';


const OTPInitial = {
  otp: "",
};

const minimumDollar = 10;

const Withdraw = ({ setPageName }: pageProps) => {
  const dispatch = useDispatch();
  const [cryptoData, setCryptoData] = useState<IWallet[]>([]);
  const [walletInitial, setWalletInitial] = useState({
    currency: "ETH",
    amount: 0,
    address: "",
    saveAddress: false,
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [wallets, setWallets] = useState<menuItem[]>([]);
  const [maxAmount, setMaxAmount] = useState(0);
  const [transactions, setTransactions] = useState<any>();
  const [countdown, setCountdown] = useState(-1);
  const [finalValues, setFinalValues] = useState<any>();
  const [resendOtp, setResendOTP] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<ISavedAddressTypes[]>(
    []
  );
  const [addressLoading, setAddressLoading] = useState(false);

  const [validAddress, setValidAddress] = useState(true);
  const [currentAddress, setCurrentAddress] = useState<menuItem[]>([]);
  const [addressOpen, setAddressOpen] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [label, setLabel] = useState("");
  const [open, setOpen] = useState(false);

  const [fees, setFees] = useState<{
    fast: number;
    fast_in_usd: number;
    medium: number;
    medium_in_usd: number;
    slow: number;
    slow_in_usd: number;
  }>();
  const [currentFees, setCurrentFees] = useState("fast");

  const [feeToPay, setFeeToPay] = useState(0);
  const [feeType, setFeeType] = useState("amount");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loading2, setLoading2] = useState(false);
  useEffect(() => {
    setPageName("Withdraw");
    getWallets();
    getWalletAddresses();
  }, []);

  const schema = yup.object().shape({
    amount: yup
      .number()
      .typeError("Amount must be a number. Please enter a valid number.")
      .required("amount is required!")
      .min(10)
      .max(maxAmount),
    address: yup.string().required("address is required!"),
  });

  const otpSchema = yup.object().shape({
    otp: yup
      .string()
      .required("OTP is required!")
      .length(6, "OTP must be 6 digit number"),
  });

  const resetAllStates = () => {
    setLoading2(false);
    setFees(undefined);
    setFinalValues(undefined);
    setCurrentFees("fast");
    setFeeToPay(0);
    setOtpSent(false);
    setFeeType("amount");

    const ETHIndex = wallets.findIndex((x) => x.value === "ETH");
    setCurrentIndex(ETHIndex);

    setWalletInitial({
      currency: "ETH",
      amount: 0,
      address: "",
      saveAddress: false,
    });
  };

  const handleSubmit = async (values: any) => {
    console.log(values);
    setLoading2(true);
    const amount = Number(
      Number(cryptoData[currentIndex].transfer_rate) * values.amount
    ).toFixed(8);
    setFinalValues({ ...values, amount });
    try {
      if (Boolean(fees)) {
        const {
          data: { data, message },
        } = await axiosBaseApi.post("/wallet/sendConfirmationOTP", {
          ...values,
          amount,
        });
        setOtpSent(true);
        setCountdown(60);
        setResendOTP(true);
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message,
          },
        });
      } else {
        const {
          data: { data },
        } = await axiosBaseApi.post("/wallet/estimateFees", {
          ...values,
          amount,
        });
        setFees(data);
        const feesInUSD = Math.ceil(
          Number(data[currentFees]) /
          Number(cryptoData[currentIndex].transfer_rate)
        );

        console.log(
          feeToPay,
          feesInUSD,
          cryptoData[currentIndex].transfer_rate
        );

        const tempAmount = Number(
          Number(cryptoData[currentIndex].amount_in_usd) -
          (feeType === "wallet" ? minimumDollar + feesInUSD : minimumDollar)
        );
        setMaxAmount(Number(tempAmount.toFixed(8)));
        setFeeToPay(data[currentFees]);
      }

      setLoading2(false);
    } catch (e: any) {
      const message = e?.response?.data?.message ?? e.message;
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: message,
          severity: "error",
        },
      });
      setTransactions(undefined);
      setFees(undefined);
    }
    setLoading2(false);
  };

  const handleOTPSubmit = async (values: any) => {
    try {
      setLoading2(true);
      const {
        data: { data },
      } = await axiosBaseApi.post("/wallet/withdrawAssets", {
        ...finalValues,
        ...values,
        feeType,
        feeToPay,
      });
      setTransactions(data);
      resetAllStates();
    } catch (e: any) {
      const message = e?.response?.data?.message ?? e.message;
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: message,
          severity: "error",
        },
      });
    }
    setLoading2(false);
  };

  const handleOTPResend = async () => {
    const {
      data: { data, message },
    } = await axiosBaseApi.post("/wallet/sendConfirmationOTP", {
      ...finalValues,
    });
    setResendOTP(true);
    dispatch({
      type: TOAST_SHOW,
      payload: {
        message,
      },
    });
  };
  useEffect(() => {
    if (resendOtp) {
      setCountdown(60);
      const timeOutId = setTimeout(() => {
        setResendOTP(false);
      }, 60000);
      return () => clearTimeout(timeOutId);
    }
  }, [resendOtp]);

  useEffect(() => {
    if (countdown !== -1) {
      const timerId = setInterval(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearInterval(timerId);
    }
  }, [countdown]);

  const getWallets = async () => {
    try {
      const {
        data: { data },
      } = await axiosBaseApi.get("/wallet/getWallet");

      const tempWallets = data.filter((x: any) => x.currency_type === "CRYPTO");
      const tempWalletData: menuItem[] = [];
      const allCurrency = [];
      for (let i = 0; i < data.length; i++) {
        const x = data[i];
        if (x.currency_type === "CRYPTO") {
          tempWalletData.push({
            label: x.wallet_type,
            value: x.wallet_type,
          });
          allCurrency.push(x.wallet_type);
        }
      }
      const ETHIndex = tempWalletData.findIndex((x) => x.value === "ETH");

      setCurrentIndex(ETHIndex);
      setWallets(tempWalletData);
      setCryptoData(tempWallets);

      const tempAmount = Number(
        Number(tempWallets[ETHIndex].amount_in_usd) - minimumDollar
      );
      setMaxAmount(Number(tempAmount.toFixed(2)));
      setLoading(false);
    } catch (e: any) {
      const message = e?.response?.data?.message ?? e.message;
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: message,
          severity: "error",
        },
      });
    }
  };

  const getWalletAddresses = async () => {
    try {
      const {
        data: { data },
      } = await axiosBaseApi.get("/wallet/getWalletAddresses");
      updateNewList(data, "ETH");
      setSavedAddresses(data);
    } catch (e: any) {
      const message = e?.response?.data?.message ?? e.message;
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: message,
          severity: "error",
        },
      });
    }
  };

  const updateNewList = (data: ISavedAddressTypes[], currency: string) => {
    const tempAddressData: menuItem[] = [];

    const currentCurrencyWallets = data.filter(
      (x: any) => x.currency === currency
    );
    for (let i = 0; i < currentCurrencyWallets.length; i++) {
      const x = currentCurrencyWallets[i];

      tempAddressData.push({
        label: (x.label ? x.label + "-" : "") + x.wallet_address,
        value: x.wallet_address,
      });
    }

    setCurrentAddress(tempAddressData);
  };

  const addWalletAddress = async () => {
    setAddressLoading(true);
    try {
      const currency = cryptoData[currentIndex].wallet_type;
      const {
        data: { data, message },
      } = await axiosBaseApi.post("/wallet/addWalletAddress", {
        wallet_address: newAddress,
        currency,
        label: label,
      });
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: message,
        },
      });
      setCurrentAddress([
        ...currentAddress,
        { label: (label ? label + "-" : "") + newAddress, value: newAddress },
      ]);
      console.log(data);
      setSavedAddresses([...savedAddresses, { ...data }]);
      setOpen(false);
      setNewAddress("");
    } catch (e: any) {
      console.log(e);
      const message = e?.response?.data?.message ?? e.message;
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: message,
          severity: "error",
        },
      });
      setValidAddress(false);
    }
    setAddressLoading(false);
  };

  return (
    <Box>
      {loading ? (
        <>
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
        <Box sx={{ maxWidth: "500px" }}>
          <PopupModal
            open={open}
            handleClose={() => setOpen(false)}
            headerText={`Add ${cryptoData[currentIndex].wallet_type} Address`}
            showClose
          >
            <Box
              sx={{
                minWidth: { md: "450px", xs: "90vw" },
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 1,
              }}
            >
              <TextBox
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value);
                }}
                label="address label (optional)"
                placeholder="Enter address label"
                fullWidth
              />
              <TextBox
                value={newAddress}
                onChange={(e) => {
                  setNewAddress(e.target.value);
                  setValidAddress(true);
                }}
                error={!validAddress || !newAddress}
                fullWidth
                label="address"
                helperText={
                  (!validAddress || !newAddress) &&
                  "please add an valid address"
                }
                placeholder="Enter new Address"
              />
              <Button
                variant="rounded"
                sx={{ mt: 2 }}
                disabled={
                  addressLoading ? addressLoading : !validAddress || !newAddress
                }
                onClick={() => addWalletAddress()}
              >
                Add{" "}
              </Button>
            </Box>
          </PopupModal>
          <FormManager
            initialValues={walletInitial}
            yupSchema={schema}
            onSubmit={handleSubmit}
          >
            {({
              errors,
              handleBlur,
              handleChange,
              submitDisable,
              touched,
              values,
              revalidate,
            }) => (
              <>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    flexDirection: "column",
                    width: "100%",
                  }}
                >
                  <Dropdown
                    fullWidth={true}
                    label={"Currency"}
                    menuItems={wallets}
                    value={values.currency}
                    error={touched.currency && errors.currency}
                    helperText={
                      touched.currency && errors.currency && errors.currency
                    }
                    getValue={(value: any) => {
                      const e: any = {
                        target: {
                          name: "currency",
                          value,
                        },
                      };
                      const index = cryptoData.findIndex(
                        (x) => x.wallet_type === value
                      );
                      setCurrentIndex(index);
                      setFees(undefined);
                      setOtpSent(false);
                      updateNewList(
                        savedAddresses,
                        cryptoData[index].wallet_type
                      );
                      const tempAmount = Number(
                        Number(cryptoData[index].amount_in_usd) - minimumDollar
                      );
                      setMaxAmount(Number(tempAmount.toFixed(8)));
                      handleChange(e);
                    }}
                    onBlur={handleBlur}
                  />
                  <Typography>
                    Balance :{" "}
                    {getCurrencySymbol(
                      values.currency,
                      countDecimals(cryptoData[currentIndex].amount) > 8
                        ? cryptoData[currentIndex].amount.toFixed(8)
                        : cryptoData[currentIndex].amount
                    )}{" "}
                    ($ {cryptoData[currentIndex].amount_in_usd})
                  </Typography>
                </Box>
                <Box
                  sx={{ mt: 3, display: "flex", alignItems: "center", gap: 2 }}
                >
                  <TextBox
                    name="amount"
                    fullWidth
                    label={"Amount in $"}
                    placeholder="Enter amount in $"
                    value={values.amount}
                    error={touched.amount && errors.amount}
                    helperText={
                      touched.amount && errors.amount && errors.amount
                    }
                    onChange={handleChange}
                    onBlur={handleBlur}
                  />
                  {!errors.amount && (
                    <Typography sx={{ mt: 2, whiteSpace: "nowrap" }}>
                      = ({" "}
                      {Number(
                        Number(cryptoData[currentIndex].transfer_rate) *
                        values.amount
                      ).toFixed(8)}{" "}
                      {cryptoData[currentIndex].wallet_type})
                    </Typography>
                  )}
                </Box>
                <Box sx={{ mt: 3 }}>
                  <TextBox
                    name="address"
                    fullWidth
                    label={"Address"}
                    disabled={Boolean(fees)}
                    placeholder="Enter address"
                    value={values.address}
                    error={touched.address && errors.address}
                    helperText={
                      touched.address && errors.address && errors.address
                    }
                    onChange={handleChange}
                    onBlur={handleBlur}
                  />
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      ml: 1,
                    }}
                  >
                    {currentAddress.findIndex(
                      (x) => x.value === values.address
                    ) === -1 && (
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              color="secondary"
                              value={values.saveAddress}
                              onChange={(e: any) => {
                                const event: any = {
                                  target: {
                                    name: "saveAddress",
                                    value: e.target.checked,
                                  },
                                };
                                handleChange(event);
                              }}
                            />
                          }
                          label="Save this address"
                          sx={{ "& span": { fontSize: 12, fontWeight: 500 } }}
                        />
                      )}
                    <Typography
                      sx={{
                        textAlign: "right",
                        color: "text.secondary",
                        fontSize: 12,
                        mt: 1,
                        ml: "auto",
                        textDecoration: "underline",
                        cursor: "pointer",
                      }}
                      onClick={() => setAddressOpen(!addressOpen)}
                    >
                      {addressOpen
                        ? "hide address book"
                        : "select from address book"}
                    </Typography>
                  </Box>
                  <Collapse in={addressOpen}>
                    <Box
                      sx={{
                        mt: 1,
                        p: 3,
                        textAlign: "center",
                        color: "text.secondary",
                        border: "1px solid",
                        borderRadius: "10px",
                      }}
                    >
                      {currentAddress.length > 0 ? (
                        <>
                          {currentAddress.map((x) => (
                            <Typography
                              key={x.value}
                              sx={{
                                cursor: "pointer",
                                "&:hover": {
                                  textDecoration: "underline",
                                },
                              }}
                              onClick={() => {
                                const e: any = {
                                  target: {
                                    name: "address",
                                    value: x.value,
                                  },
                                };
                                handleChange(e);
                              }}
                            >
                              {x.label}
                            </Typography>
                          ))}
                        </>
                      ) : (
                        <Typography>No Addresses found!</Typography>
                      )}
                      <Button sx={{ mt: 1 }} onClick={() => setOpen(true)}>
                        + Add new
                      </Button>
                    </Box>
                  </Collapse>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Typography sx={{ my: 2 }}>
                    How you want to <br />
                    pay the fees:{" "}
                  </Typography>
                  <RadioGroup
                    aria-labelledby="demo-radio-buttons-group-label"
                    value={feeType}
                    onChange={(e) => {
                      setFeeType(e.target.value);

                      const feesInUSD = Math.ceil(
                        Number(feeToPay) /
                        Number(cryptoData[currentIndex].transfer_rate)
                      );

                      const tempAmount = Number(
                        Number(cryptoData[currentIndex].amount_in_usd) -
                        (e.target.value === "wallet"
                          ? minimumDollar + feesInUSD
                          : minimumDollar)
                      );
                      setMaxAmount(Number(tempAmount.toFixed(8)));
                    }}
                    name="radio-buttons-group"
                    row
                  >
                    <FormControlLabel
                      value="amount"
                      control={<Radio />}
                      label="From Amount"
                    />
                    <FormControlLabel
                      value="wallet"
                      control={<Radio />}
                      label="From Wallet"
                    />
                  </RadioGroup>
                </Box>

                <Collapse in={Boolean(fees)}>
                  {fees && (
                    <Box>
                      <Typography sx={{ my: 2 }}>
                        Choose Fees to Pay:{" "}
                      </Typography>
                      <RadioGroup
                        aria-labelledby="demo-radio-buttons-group-label"
                        value={currentFees}
                        onChange={(e) => {
                          const current = e.target.value;
                          const tempFees: any = { ...fees };
                          setCurrentFees(current);

                          const feesInUSD = Math.ceil(
                            Number(tempFees[current]) /
                            Number(cryptoData[currentIndex].transfer_rate)
                          );

                          const tempAmount = Number(
                            Number(cryptoData[currentIndex].amount_in_usd) -
                            (feeType === "wallet"
                              ? minimumDollar + feesInUSD
                              : minimumDollar)
                          );

                          console.log(
                            "radio========>",
                            tempFees[current],
                            feesInUSD,
                            tempAmount
                          );
                          setMaxAmount(Number(tempAmount.toFixed(8)));

                          setFeeToPay(tempFees[current]);
                        }}
                        name="radio-buttons-group"
                        row
                      >
                        {fees?.fast && (
                          <FormControlLabel
                            value="fast"
                            control={<Radio />}
                            label={`Fast: ${fees.fast_in_usd}$ (${fees.fast} ${cryptoData[currentIndex].wallet_type})`}
                          />
                        )}
                        {fees?.medium && (
                          <FormControlLabel
                            value="medium"
                            control={<Radio />}
                            label={`Medium: ${fees.medium_in_usd}$ (${fees.medium} ${cryptoData[currentIndex].wallet_type})`}
                          />
                        )}

                        {fees?.slow && (
                          <FormControlLabel
                            value="slow"
                            control={<Radio />}
                            label={`Slow: ${fees.slow_in_usd}$ (${fees.slow} ${cryptoData[currentIndex].wallet_type})`}
                          />
                        )}
                      </RadioGroup>
                    </Box>
                  )}
                </Collapse>
                <Collapse in={!otpSent}>
                  <Box
                    sx={{
                      mt: 3,
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                    }}
                  >
                    {loading2 && <LoadingIcon size={25} />}

                    <Button
                      variant="rounded"
                      type="submit"
                      disabled={submitDisable ? submitDisable : loading2}
                      sx={{ py: 1.5, ml: 2 }}
                    >
                      {Boolean(fees) ? "Send OTP" : "Estimate Fee"}
                    </Button>
                  </Box>
                </Collapse>
              </>
            )}
          </FormManager>
          <Collapse in={otpSent}>
            <FormManager
              initialValues={OTPInitial}
              yupSchema={otpSchema}
              onSubmit={handleOTPSubmit}
            >
              {({
                errors,
                handleBlur,
                handleChange,
                submitDisable,
                touched,
                values,
              }) => (
                <Box sx={{ mt: 2 }}>
                  <TextBox
                    name="otp"
                    fullWidth
                    label={"OTP"}
                    uppercase
                    placeholder="Enter otp"
                    value={values.otp}
                    error={touched.otp && errors.otp}
                    helperText={touched.otp && errors.otp && errors.otp}
                    onChange={handleChange}
                    onBlur={handleBlur}
                  />
                  <Typography
                    sx={{
                      ml: 2,
                      fontWeight: 500,
                      fontSize: "14px",
                      color: resendOtp ? "text.disabled" : "text.secondary",
                      cursor: resendOtp ? "not-allowed" : "pointer",
                    }}
                    onClick={() => {
                      if (!resendOtp) {
                        setResendOTP(true);
                        handleOTPResend();
                      }
                    }}
                  >
                    Resend Code {resendOtp ? `in ${countdown}s` : ""}
                  </Typography>
                  <Box
                    sx={{
                      mt: 3,
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                    }}
                  >
                    {loading2 && <LoadingIcon size={25} />}

                    <Button
                      variant="rounded"
                      type="submit"
                      disabled={submitDisable ? submitDisable : loading2}
                      sx={{ py: 1.5, ml: 2 }}
                    >
                      Withdraw
                    </Button>
                  </Box>
                </Box>
              )}
            </FormManager>
          </Collapse>
          {
            transactions && (
              <>
                {transactions.length > 0 ? (
                  transactions.map((transaction: ITransaction, index: number) => (
                    <Typography mt={5} key={index}>
                      {transaction.status === 'failed' ? (
                        <Box display="flex" alignItems="center">
                          <Typography>
                            {`Transaction ID (${index}): N/A`}
                          </Typography>
                          <Tooltip title={`Transaction from ${transaction.fromAddress} to ${transaction.toAddress} failed (${transaction.errorMessage})` || "Unknown error"} arrow>
                            <ErrorIcon color="error" sx={{ml: 1}} />
                          </Tooltip>
                        </Box>
                      ) : (
                        <>
                        <Typography>
                          {`Transaction ID (${index}): ${transaction.txId}`}
                        </Typography>
                        <CheckCircleIcon color="success" />
                      </>
                      )}
                    </Typography>
                  ))
                ) : (
                  <Typography mt={5}>
                    {"Transaction ID: Not Found"}
                  </Typography>
                )}
              </>
            )
          }

          {/* <Grid item md={6} xs={12}>
              
            </Grid> */}
        </Box>
      )}
    </Box>
  );
};

export default Withdraw;
