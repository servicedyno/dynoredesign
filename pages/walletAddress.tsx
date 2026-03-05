import LoadingIcon from "@/assets/Icons/LoadingIcon";
import FormManager from "@/Components/Page/Common/FormManager";
import DataTable from "@/Components/UI/DataTable";
import Dropdown from "@/Components/UI/Dropdown";
import PopupModal from "@/Components/UI/PopupModal";
import TextBox from "@/Components/UI/TextBox";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import NoData from "@/Components/UI/NoData";
import { getCurrencySymbol, countDecimals } from "@/helpers";
import {
  WALLET_FETCH,
  WALLET_FUND_CREATE,
  WALLET_ADD_ADDRESS,
  WalletAction,
  VERIFY_OTP,
} from "@/Redux/Actions/WalletAction";
import { IWallet, pageProps, rootReducer } from "@/utils/types";
import { Search, ContentCopy, DeleteOutline } from "@mui/icons-material";
import {
  Box,
  Button,
  Divider,
  InputAdornment,
  Typography,
  useTheme,
  TextField,
  Grid,
  IconButton,
  Tooltip,
} from "@mui/material";
import Head from "next/head";
import { useRouter } from "next/router";
import React, { useEffect, useState, useRef, use } from "react";
import { useDispatch, useSelector } from "react-redux";
import * as yup from "yup";
import { verifyOtp } from '@/Redux/Sagas/WalletSaga'
import axiosBaseApi from "@/axiosConfig";

const columns = ["#", "Company Name", "Email", "Amount"];

const fundInitial = {
  amount: "",
  currency: "USD",
};

const otpInitial = {
  otp1: "",
  otp2: "",
  otp3: "",
  otp4: "",
  otp5: "",
  otp6: "",
};

type Address = {
  wallet_address: string;
  currency: string;
};

const WalletAddress = ({ setPageName }: pageProps) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const router = useRouter();
  const walletState = useSelector((state: rootReducer) => state.walletReducer);
  const [fiatData, setFiatData] = useState<IWallet[]>([]);
  const [cryptoData, setCryptoData] = useState<IWallet[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [totalBalance, setTotalBalance] = useState(0);
  const [open, setOpen] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [popupLoading, setPopupLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [walletData, setWalletData] = useState<any>(null);
  const [showOtpLoader, setShowOtpLoader] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Validating wallet address...");
  const [address,setAddress] = useState<Address | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IWallet | null>(null);

  const fundSchema = yup.object().shape({
    wallet_address: yup.string().required("Wallet address is required!"),
    currency: yup.string().required("Currency is required!"),
  });
  
  const otpSchema = yup.object().shape({
    otp1: yup.string().required("Required"),
    otp2: yup.string().required("Required"),
    otp3: yup.string().required("Required"),
    otp4: yup.string().required("Required"),
    otp5: yup.string().required("Required"),
    otp6: yup.string().required("Required"),
  });

  useEffect(() => {
    setPageName("Wallet Address");
    dispatch(WalletAction(WALLET_FETCH));
  }, []);

  useEffect(() => {
    let total = 0;
    for (let i = 0; i < walletState.walletList.length; i++) {
      const currentWallet = walletState.walletList[i];
      total += Number(currentWallet.amount_in_usd);
    }
    const tempFiat = walletState.walletList.filter(
      (x) => x.currency_type === "FIAT"
    );
    const tempCrypto = walletState.walletList.filter(
      (x) => x.currency_type === "CRYPTO"
    );
    setTotalBalance(total);
    setCryptoData(tempCrypto);
    setFiatData(tempFiat);
    setLoading(false);
  }, [walletState.walletList]);

  useEffect(() => {
    if (walletState.amount !== 0) {
      router.push("/payment");
    }
  }, [walletState.amount]);

  // Listen to OTP verification response and handle wallet addition
  useEffect(() => {
    if (walletState.loading === false && walletData) {
      // Check if OTP verification was successful
      // You can add a specific flag in your reducer to track OTP verification success
      if (walletState.otpVerified) {
        // OTP verified successfully, now add the wallet address
        dispatch(WalletAction(WALLET_ADD_ADDRESS, { ...walletData }));
        setWalletData(null);
      }
    }
  }, [walletState.loading, walletState.otpVerified, walletData]);

  // Reset loader state when OTP modal closes
  useEffect(() => {
    if (!otpModalOpen) {
      setShowOtpLoader(false);
    }
  }, [otpModalOpen]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      // Clear any existing intervals
      setShowOtpLoader(false);
      setLoadingMessage("Validating wallet address...");
    };
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  };

  const handleSubmit = async (values: any) => {
    try {
    console.log({values});
    setPopupLoading(true);
    // dispatch(WalletAction(WALLET_ADD_ADDRESS, { ...values }));
    setPopupLoading(false);
    setAddress(values)





    const response = await axiosBaseApi.post("/wallet/validateWalletAddress", values);
    if (response.status !== 200) {
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: response?.data?.message ?? "Failed to add wallet address",
          severity: "error",
        },
      });
      return false;
    }

    setWalletData(values);
    setOpen(false);
    setShowOtpLoader(true);
  
    
    // Simulate loading time with changing messages
    const messages = [
      "Validating wallet address...",
      "Checking address format...",
      "Generating OTP...",
      "Almost done..."
    ];
    
    let messageIndex = 0;
    const messageInterval = setInterval(() => {
      if (messageIndex < messages.length) {
        setLoadingMessage(messages[messageIndex]);
        messageIndex++;
      }
    }, 1000); // Change message every 500ms
    
    // Show OTP modal after 2 seconds
    setTimeout(() => {
      clearInterval(messageInterval);
      setShowOtpLoader(false);
      setOtpModalOpen(true);
      setLoadingMessage("Validating wallet address..."); // Reset message
    }, 2000); // 2 seconds total

  } catch (error: any) {
    console.error("Error adding wallet address:", error);
    dispatch({
      type: TOAST_SHOW,
      payload: {
        message: error?.response?.data?.message ?? error.message ?? "Something went wrong",
        severity: "error",
      },
    });
    // Do NOT close the modal
  } finally {
    setPopupLoading(false);
  }
  };

  const handleOtpSubmit = async (values: any) => {
    setOtpLoading(true);
    
    let currencyType: "FIAT" | "CRYPTO" | null = null;

    if (fiatData.some(item => item.wallet_type === address?.currency)) {
      currencyType = "FIAT";
    } else if (cryptoData.some(item => item.wallet_type === address?.currency)) {
      currencyType = "CRYPTO";
    }
    
    console.log("Currency Type:", currencyType);
    // Combine OTP values into a single string
    const otp = Object.values(values).join('');
    try {
      const response = await verifyOtp({ 
        otp: otp ,
        wallet_address : address?.wallet_address,
        currency : address?.currency,
        currency_type : currencyType,
      })
      console.log(response)
      // Dispatch VERIFY_OTP action to verify the OTP
      if(response.status){
        setOtpModalOpen(false);
        setWalletData(null);
        dispatch(WalletAction(WALLET_FETCH));
      }
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message:response?.message,
          severity: response.status ? "success" : "error",
        },
      });
            
      // The Redux action will handle the API call and response
      // You can listen to walletState.loading or other state changes for feedback
      
    } catch (error) {
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message:"OTP verification failed"
        },
      });
      console.error("OTP verification failed:", error);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleDeleteClick = (wallet: IWallet) => {
    setDeleteTarget(wallet);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      const response = await axiosBaseApi.post("/wallet/deleteWalletAddress", {
        currency: deleteTarget.wallet_type,
      });
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: response?.data?.message ?? "Wallet address removed",
          severity: "success",
        },
      });
      setDeleteModalOpen(false);
      setDeleteTarget(null);
      dispatch(WalletAction(WALLET_FETCH));
    } catch (error: any) {
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message:
            error?.response?.data?.message ?? error.message ?? "Failed to remove",
          severity: "error",
        },
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string, handleChange: any, values: any) => {
    // Handle OTP input change and auto-focus to next field
    const fieldName = `otp${index + 1}`;
    const e: any = {
      target: {
        name: fieldName,
        value,
      },
    };
    handleChange(e);

    // Auto-focus to next field if current field has a value
    if (value && index < 5) {
      const nextField = document.querySelector(`input[name="otp${index + 2}"]`) as HTMLInputElement;
      if (nextField) {
        nextField.focus();
      }
    }
  };

  const handleOtpBlur = (fieldName: string, handleBlur: any) => {
    // Only trigger validation if the field is empty
    const e: any = {
      target: {
        name: fieldName,
      },
    };
    handleBlur(e);
  };

  const shouldShowError = (fieldName: string, touched: any, errors: any, values: any) => {
    // Only show error if field is touched, has error, and is empty
    return touched[fieldName] && errors[fieldName] && !values[fieldName];
  };

  const getHelperText = (fieldName: string, touched: any, errors: any, values: any) => {
    // Only show helper text if there's an error and field is empty
    return shouldShowError(fieldName, touched, errors, values) ? errors[fieldName] : "";
  };

  const formatAddress = (addr?: string) => {
    if (!addr) return "";
    const trimmed = addr.trim();
    if (trimmed.length <= 10) return trimmed;
    return `${trimmed.slice(0, 10)}...`;
  };

  const copyAddressToClipboard = async (addr?: string) => {
    if (!addr) return;
    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(addr);
      } else {
        const input = document.createElement("textarea");
        input.value = addr;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: "Wallet address copied",
          severity: "success",
        },
      });
    } catch (e) {
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: "Failed to copy",
          severity: "error",
        },
      });
    }
  };

  const cryptoWithAddress = cryptoData.filter((x) => !!x.wallet_address);

  return (
    <>
      <Head>
        <title>BozzWallet</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <PopupModal
        open={open}
        showClose
        handleClose={() => setOpen(false)}
        headerText={"Add Wallet Address"}
      >
        <Box sx={{ minWidth: "450px" }}>
        {popupLoading ? ( 
          <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "200px",
          }}
        >
          <LoadingIcon size={50} />
        </Box>
      ) : (
          <FormManager
            initialValues={fundInitial}
            yupSchema={fundSchema}
            onSubmit={handleSubmit}
          >
            {({
              errors,
              handleBlur,
              handleChange,
              submitDisable,
              touched,
              values,
            }) => (
              <>
                <TextBox
                  name="wallet_address"
                  placeholder="Enter wallet address"
                  label="Wallet Address"
                  value={values.wallet_address}
                  type="text"
                  fullWidth
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={touched.wallet_address && errors.wallet_address}
                  helperText={
                    touched.wallet_address && errors.wallet_address && errors.wallet_address
                  }
                />
                <Box sx={{ width: "100%", mt: 3 }}>
                  <Dropdown
                    name="currency"
                    placeholder="Enter currency"
                    label="Currency"
                    value={values.currency}
                    type="text"
                    fullWidth
                    menuItems={cryptoData.map((x) => ({
                      value: x.wallet_type,
                      label: x.wallet_type,
                    }))}
                    getValue={(value: any) => {
                      const e: any = {
                        target: {
                          name: "currency",
                          value,
                        },
                      };
                      handleChange(e);
                    }}
                    onBlur={handleBlur}
                    error={touched.currency && errors.currency}
                    helperText={
                      touched.currency && errors.currency && errors.currency
                    }
                  />
                </Box>
                <Box sx={{ mt: 5, mb: 3, display: "flex" }}>
                  <Button
                    variant="rounded"
                    disabled={walletState.loading ?? submitDisable}
                    type="submit"
                  >
                    Add
                  </Button>
                </Box>
              </>
            )}
          </FormManager>
          )}
        </Box>
      </PopupModal>
      
      {/* Loader Modal before OTP */}
      <PopupModal
        open={showOtpLoader}
        showClose={false}
        handleClose={() => {}}
        headerText={"Processing..."}
      >
        <Box sx={{ minWidth: "350px", maxWidth: "400px" }}>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              height: "200px",
              textAlign: "center",
            }}
          >
            <LoadingIcon size={60} />
            <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
              {loadingMessage}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Please wait while we process your request...
            </Typography>
          </Box>
        </Box>
      </PopupModal>
      
      <PopupModal
        open={otpModalOpen}
        showClose
        handleClose={() => setOtpModalOpen(false)}
        headerText={"Enter OTP"}
      >
        <Box sx={{ minWidth: "350px", maxWidth: "400px" }}>
          <Typography variant="body1" sx={{ mb: 3, textAlign: 'center' }}>
            OTP has been sent to your email.
          </Typography>
          
          {otpLoading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "200px",
              }}
            >
              <LoadingIcon size={50} />
            </Box>
          ) : (
            <FormManager
              initialValues={otpInitial}
              yupSchema={otpSchema}
              onSubmit={handleOtpSubmit}
            >
              {({
                errors,
                handleBlur,
                handleChange,
                submitDisable,
                touched,
                values,
              }) => (
                <>
                  <Grid container spacing={1}>
                    {Object.keys(values).map((key, index) => (
                      <Grid item xs={2} key={key}>
                        <TextField
                          name={key}
                          // label={`OTP ${index + 1}`}
                          type="text"
                          fullWidth
                          value={values[key]}
                          onChange={(e) => handleOtpChange(index, e.target.value, handleChange, values)}
                          onBlur={() => handleOtpBlur(key, handleBlur)}
                          error={shouldShowError(key, touched, errors, values)}
                          helperText={getHelperText(key, touched, errors, values)}
                          inputProps={{
                            maxLength: 1,
                            style: { textAlign: 'center', fontSize: '20px' },
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              '&.Mui-focused fieldset': {
                                borderColor: 'primary.main',
                              },
                              '& fieldset': {
                                borderColor: values[key] ? 'success.main' : 'grey.300',
                                borderWidth: values[key] ? 2 : 1,
                              },
                              '&:hover fieldset': {
                                borderColor: values[key] ? 'success.main' : 'primary.main',
                              },
                            },
                            '& .MuiInputBase-input': {
                              fontWeight: values[key] ? 600 : 400,
                              color: values[key] ? 'success.main' : 'text.primary',
                            },
                          }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                  
                  {/* Show success message when all fields are filled */}
                  {/* {Object.values(values).every(val => val) && (
                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                      <Typography variant="body2" color="success.main" sx={{ fontWeight: 500 }}>
                        ✓ All OTP digits entered
                      </Typography>
                    </Box>
                  )} */}
                  
                  <Box sx={{ mt: 5, mb: 3, display: "flex" }}>
                    <Button
                      variant="rounded"
                      disabled={otpLoading || !Object.values(values).every(val => val)}
                      type="submit"
                      fullWidth
                    >
                      Verify OTP
                    </Button>
                  </Box>
                </>
              )}
            </FormManager>
          )}
        </Box>
      </PopupModal>

      <PopupModal
        open={deleteModalOpen}
        showClose
        handleClose={() => setDeleteModalOpen(false)}
        headerText={"Remove Wallet Address"}
      >
        <Box sx={{ minWidth: "350px", maxWidth: "400px" }}>
          <Typography variant="body1" sx={{ mb: 3, textAlign: "center" }}>
            Are you sure you want to remove the address for {deleteTarget?.wallet_type}?
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Button
                variant="rounded"
                color="inherit"
                fullWidth
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleteLoading}
              >
                Cancel
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button
                variant="rounded"
                color="error"
                fullWidth
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Removing..." : "Delete"}
              </Button>
            </Grid>
          </Grid>
        </Box>
      </PopupModal>
      <Box sx={{ m: 2, mb: 5 }}>
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
          <>
            <Box
              sx={{
                mt: 2,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "end",
              }}
            >
              <Box>
                <Button
                  variant="rounded"
                  color="primary"
                  onClick={() => {
                    setOpen(true);
                  }}
                >
                  Add Wallet Address
                </Button>
              </Box>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                flexWrap: "wrap",
              }}
            >
              {cryptoWithAddress.length === 0 ? (
                <NoData customText="No data found" />
              ) : (
                cryptoWithAddress.map((x) => (
                  <Box
                    key={x.id}
                    sx={{
                      border: "1px solid",
                      width: "250px",
                      height: "100%",
                      borderRadius: "10px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      p: 3,
                    }}
                  >
                    <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                    <Typography sx={{ fontSize: "24px", fontWeight: 700 }}>
                      {x.wallet_type}
                    </Typography>
                    <Box>
                      <Tooltip title="Copy to clipboard">
                        <IconButton size="small" onClick={() => copyAddressToClipboard(x.wallet_address)}>
                          <ContentCopy fontSize="inherit" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove address">
                        <IconButton size="small" color="error" onClick={() => handleDeleteClick(x)}>
                          <DeleteOutline fontSize="inherit" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                      </Box>
                    
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "end", gap: 1 }}>
                      <Typography
                        sx={{
                          fontSize: 20,
                          fontWeight: 500,
                          color: "text.secondary",
                          wordBreak: "break-all",
                          flex: 1,
                          textAlign: "right",
                        }}
                        title={x.wallet_address}
                      >
                        {formatAddress(x.wallet_address)}
                      </Typography>
                    </Box>
                    <Typography
                      sx={{
                        fontSize: 12,
                        fontWeight: 700,
                        textAlign: "right",
                        color: theme.palette.error.main,
                      }}
                    >
                      ({getCurrencySymbol("USD", x.amount_in_usd)})
                    </Typography>
                  </Box>
                ))
              )}
            </Box>
          </>
        )}
      </Box>
    </>
  );
};

export default WalletAddress;
