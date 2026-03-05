import EditIcon from "@/assets/Icons/editicon.png";
import LoadingIcon from "@/assets/Icons/LoadingIcon";
import ArrowUpwardIcon from "@/assets/Icons/up-arrow-icon.png";
import Logo from "@/assets/Images/auth/dynopay-logo.png";
import GoogleIcon from "@/assets/Images/googleIcon.svg";
import axiosBaseApi from "@/axiosConfig";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import TitleDescription from "@/Components/UI/AuthLayout/TitleDescription";
import CustomButton from "@/Components/UI/Buttons";
import ForgotPasswordDialog from "@/Components/UI/ForgotPasswordDialog";
import LanguageSwitcher from "@/Components/UI/LanguageSwitcher";
import OtpDialog from "@/Components/UI/OtpDialog";
import CustomRadio from "@/Components/UI/RadioGroup";
import {
  AuthContainer,
  CardWrapper,
  ImageCenter,
} from "@/Containers/Login/styled";
import useIsMobile from "@/hooks/useIsMobile";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import {
  USER_API_ERROR,
  USER_CONFIRM_CODE,
  USER_EMAIL_CHECK,
  USER_LOGIN,
  USER_SEND_OTP,
  USER_SEND_RESET_LINK,
  UserAction,
} from "@/Redux/Actions/UserAction";
import { rootReducer } from "@/utils/types";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {
  Box,
  Divider,
  FormControlLabel,
  RadioGroup,
  Typography,
  useTheme,
} from "@mui/material";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import * as yup from "yup";

export default function Login() {
  const { t } = useTranslation("auth");
  const theme = useTheme();
  const isMobile = useIsMobile("sm");
  const dispatch = useDispatch();
  const router = useRouter();
  const userState = useSelector((state: rootReducer) => state.userReducer);

  // Email check state
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [showLoginMethods, setShowLoginMethods] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [emailCheckLoading, setEmailCheckLoading] = useState(false);

  // Login method state
  const [loginMethod, setLoginMethod] = useState("email");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Email OTP state
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [emailOtpError, setEmailOtpError] = useState("");
  const [emailOtpTouched, setEmailOtpTouched] = useState(false);
  const [emailOtpCountdown, setEmailOtpCountdown] = useState(0);
  const [emailOtpDialogOpen, setEmailOtpDialogOpen] = useState(false);

  // SMS state
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [mobile, setMobile] = useState("");
  const [mobileError, setMobileError] = useState("");
  const [mobileTouched, setMobileTouched] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpTouched, setOtpTouched] = useState(false);
  const [smsOtpCountdown, setSmsOtpCountdown] = useState(0);
  const [smsOtpDialogOpen, setSmsOtpDialogOpen] = useState(false);

  // Animation states
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [showErrorAnimation, setShowErrorAnimation] = useState(false);
  const [previousLoadingState, setPreviousLoadingState] = useState(false);

  // Forgot password state
  const [forgotPasswordDialogOpen, setForgotPasswordDialogOpen] =
    useState(false);
  const [forgotPasswordEmailError, setForgotPasswordEmailError] = useState("");
  const [forgotPasswordOtpCountdown, setForgotPasswordOtpCountdown] =
    useState(0);
  const [forgotPasswordOtpError, setForgotPasswordOtpError] = useState("");
  const [isPasswordRecoveryMode, setIsPasswordRecoveryMode] = useState(false);

  // Validation schemas - use translation keys instead of translated strings
  const emailSchema = yup.object().shape({
    email: yup.string().email("emailInvalid").required("emailRequired"),
  });

  const passwordSchema = yup.object().shape({
    password: yup.string().required("passwordRequired"),
  });

  // Navigate to home if user is logged in (but not in password recovery mode)
  useEffect(() => {
    if (userState.name && !isPasswordRecoveryMode) {
      setShowSuccessAnimation(true);
      setEmailOtpDialogOpen(false);
      setTimeout(() => {
        router.replace("/dashboard");
      }, 600);
    }
  }, [userState, router, isPasswordRecoveryMode]);

  // Handle successful OTP verification for password recovery
  useEffect(() => {
    if (
      isPasswordRecoveryMode &&
      !userState.loading &&
      previousLoadingState &&
      !userState.error
    ) {
      setForgotPasswordDialogOpen(false);
      setIsPasswordRecoveryMode(false);
    }
  }, [
    userState.loading,
    userState.error,
    isPasswordRecoveryMode,
    previousLoadingState,
  ]);

  // Handle loading state changes for animations and ensure loading stops on error
  useEffect(() => {
    if (previousLoadingState && !userState.loading) {
      if (!userState.name && showLoginMethods) {
        const shouldShowErrorAnimation = !(
          (loginMethod === "email" && emailOtpDialogOpen) ||
          (loginMethod === "sms" && smsOtpDialogOpen)
        );

        if (shouldShowErrorAnimation) {
          setShowErrorAnimation(true);
          setTimeout(() => {
            setShowErrorAnimation(false);
          }, 500);
        }

        if (
          userState.error &&
          userState.error.actionType === USER_CONFIRM_CODE
        ) {
          if (isPasswordRecoveryMode) {
            setForgotPasswordOtpError(
              userState.error.message || "OTP verification failed",
            );
          } else if (loginMethod === "email" && emailOtp) {
            setEmailOtpError(
              userState.error.message || "OTP verification failed",
            );
            setEmailOtpTouched(true);
            if (!emailOtpDialogOpen) {
              setEmailOtpDialogOpen(true);
            }
          } else if (loginMethod === "sms" && otp) {
            setOtpError(userState.error.message || "OTP verification failed");
            setOtpTouched(true);
            if (!smsOtpDialogOpen) {
              setSmsOtpDialogOpen(true);
            }
          }
        } else {
          if (loginMethod === "email" && emailOtp) {
            setEmailOtpTouched(false);
            if (!emailOtpDialogOpen) {
              setEmailOtpDialogOpen(true);
            }
          } else if (loginMethod === "sms" && otp) {
            setOtpTouched(false);
            if (!smsOtpDialogOpen) {
              setSmsOtpDialogOpen(true);
            }
          }
        }
      }
    }
    setPreviousLoadingState(userState.loading);
  }, [
    userState.loading,
    userState.name,
    userState.error,
    previousLoadingState,
    showLoginMethods,
    loginMethod,
    emailOtp,
    otp,
    emailOtpDialogOpen,
    smsOtpDialogOpen,
    isPasswordRecoveryMode,
  ]);

  // Ensure loading stops if there's an error (safety check)
  useEffect(() => {
    if (userState.loading) {
      const timeout = setTimeout(() => {
        if (!userState.name) {
          dispatch({ type: USER_API_ERROR });
        }
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [userState.loading, userState.name, dispatch]);

  // Email OTP countdown timer
  useEffect(() => {
    if (emailOtpCountdown > 0) {
      const timerId = setTimeout(() => {
        setEmailOtpCountdown(emailOtpCountdown - 1);
      }, 1000);
      return () => clearTimeout(timerId);
    }
  }, [emailOtpCountdown]);

  // SMS OTP countdown timer
  useEffect(() => {
    if (smsOtpCountdown > 0) {
      const timerId = setTimeout(() => {
        setSmsOtpCountdown(smsOtpCountdown - 1);
      }, 1000);
      return () => clearTimeout(timerId);
    }
  }, [smsOtpCountdown]);

  // Validate email (only called on button click)
  const validateEmail = async () => {
    if (!emailInput) {
      setEmailError("emailRequired");
      return false;
    }
    try {
      await emailSchema.validate({ email: emailInput });
      setEmailError("");
      return true;
    } catch (err: any) {
      setEmailError(err.message || "emailInvalid");
      return false;
    }
  };

  // Handle email check on continue
  const handleEmailCheck = async () => {
    setEmailTouched(true);
    const isValid = await validateEmail();
    if (!isValid) return;

    setEmailCheckLoading(true);
    try {
      const response = await axiosBaseApi.get(
        "/user/checkEmail?email=" + emailInput,
      );

      if (!response || !response.data) {
        setEmailError("errorCheckingEmail");
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: t("errorCheckingEmail"),
            severity: "error",
          },
        });
        setEmailCheckLoading(false);
        return;
      }

      const data = response.data?.data;

      if (data && typeof data.validEmail === "boolean") {
        if (data.validEmail) {
          setVerifiedEmail(emailInput);
          dispatch({ type: USER_EMAIL_CHECK, payload: data });
          setShowLoginMethods(true);
          setEmailError("");
        } else {
          setEmailError("emailNotFound");
        }
      } else {
        setEmailError("errorCheckingEmail");
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: t("errorCheckingEmail"),
            severity: "error",
          },
        });
      }
    } catch (e: any) {
      setEmailError("errorCheckingEmail");
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: t("errorCheckingEmail"),
          severity: "error",
        },
      });
    } finally {
      setEmailCheckLoading(false);
    }
  };

  // Handle send email OTP
  const handleSendEmailOtp = async () => {
    if (emailOtpCountdown > 0 && !emailOtpDialogOpen) {
      setEmailOtpDialogOpen(true);
      return;
    }

    if (emailOtpCountdown > 0) {
      setEmailOtpDialogOpen(true);
      return;
    }

    try {
      dispatch(
        UserAction(USER_SEND_OTP, {
          email: verifiedEmail,
          mobile: null,
        }),
      );
      setEmailOtpSent(true);
      setEmailOtpCountdown(30);
      setEmailOtpDialogOpen(true);
      setEmailOtpError("");
      setEmailOtpTouched(false);
    } catch (e: any) {
      const message =
        e.response?.data?.message ?? e.message ?? "Failed to send OTP";
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: message,
          severity: "error",
        },
      });
    }
  };

  // Handle OTP verification from dialog
  const handleEmailOtpVerify = (otp: string) => {
    if (userState.loading) {
      return;
    }

    setEmailOtp(otp);
    setEmailOtpError("");
    setEmailOtpTouched(false);

    if (!otp || otp.trim().length !== 6) {
      setEmailOtpError("otpInvalid6Digit");
      setEmailOtpTouched(true);
      return;
    }

    dispatch(
      UserAction(USER_CONFIRM_CODE, {
        email: verifiedEmail,
        otp: otp.trim(),
      }),
    );
  };

  // Validate mobile number
  const validateMobile = () => {
    if (!mobile || mobile.trim() === "") {
      setMobileError("mobileRequired");
      return false;
    }
    const cleanedMobile = mobile.replace(/\D/g, "");
    if (cleanedMobile.length < 10) {
      setMobileError("mobileInvalid");
      return false;
    }
    setMobileError("");
    return true;
  };

  // Handle send SMS OTP
  const handleSendSmsOtp = async () => {
    if (smsOtpCountdown > 0 && !smsOtpDialogOpen) {
      setSmsOtpDialogOpen(true);
      return;
    }

    if (smsOtpCountdown > 0) {
      setSmsOtpDialogOpen(true);
      return;
    }

    if (userState.mobile) {
      try {
        dispatch(
          UserAction(USER_SEND_OTP, {
            email: verifiedEmail,
            mobile: userState.mobile,
          }),
        );
        setIsOtpSent(true);
        setSmsOtpCountdown(30);
        setSmsOtpDialogOpen(true);
        setOtpError("");
        setOtpTouched(false);
        setMobileError("");
        setMobileTouched(false);
        return;
      } catch (e: any) {
        const message =
          e.response?.data?.message ?? e.message ?? "Failed to send OTP";
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: message,
            severity: "error",
          },
        });
        return;
      }
    }

    setMobileTouched(true);
    if (!validateMobile()) {
      return;
    }

    try {
      dispatch(
        UserAction(USER_SEND_OTP, {
          email: verifiedEmail,
          mobile: mobile,
        }),
      );
      setIsOtpSent(true);
      setSmsOtpCountdown(30);
      setSmsOtpDialogOpen(true);
      setOtpError("");
      setOtpTouched(false);
      setMobileError("");
    } catch (e: any) {
      const message =
        e.response?.data?.message ?? e.message ?? "Failed to send OTP";
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: message,
          severity: "error",
        },
      });
    }
  };

  // Handle SMS OTP verification from dialog
  const handleSmsOtpVerify = (otp: string) => {
    if (userState.loading) {
      return;
    }

    setOtp(otp);
    setOtpError("");
    setOtpTouched(false);

    if (!otp || otp.trim().length !== 6) {
      setOtpError("otpInvalid6Digit");
      setOtpTouched(true);
      return;
    }

    const mobileToUse = mobile || userState.mobile;
    if (!mobileToUse) {
      setMobileError("mobileRequired");
      return;
    }

    dispatch(
      UserAction(USER_CONFIRM_CODE, {
        email: verifiedEmail,
        otp: otp.trim(),
        mobile: mobileToUse,
      }),
    );
  };

  // Validate password
  const validatePassword = async () => {
    if (!password) {
      setPasswordError("passwordRequired");
      return false;
    }
    try {
      await passwordSchema.validate({ password });
      setPasswordError("");
      return true;
    } catch (err: any) {
      setPasswordError(err.message || "passwordRequired");
      return false;
    }
  };

  // Handle login submit
  const handleLoginSubmit = async () => {
    if (loginMethod === "password") {
      setPasswordTouched(true);
      const isValid = await validatePassword();
      if (!isValid) {
        return;
      }

      dispatch(UserAction(USER_LOGIN, { email: verifiedEmail, password }));
    } else if (loginMethod === "email") {
      if (!emailOtpSent) {
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: t("pleaseGetVerificationCodeFirst"),
            severity: "error",
          },
        });
        return;
      }

      if (emailOtpDialogOpen) {
        return;
      }

      if (!emailOtp || emailOtp.trim().length !== 6) {
        setEmailOtpTouched(true);
        setEmailOtpError("otpInvalid6Digit");
        setEmailOtpDialogOpen(true);
        return;
      }

      setEmailOtpError("");
      setEmailOtpTouched(false);

      dispatch(
        UserAction(USER_CONFIRM_CODE, {
          email: verifiedEmail,
          otp: emailOtp.trim(),
        }),
      );
    } else if (loginMethod === "sms") {
      if (!isOtpSent) {
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: "Please get the verification code first",
            severity: "error",
          },
        });
        return;
      }

      if (smsOtpDialogOpen) {
        return;
      }

      if (!otp || otp.trim().length !== 6) {
        setOtpTouched(true);
        setOtpError("otpInvalid6Digit");
        setSmsOtpDialogOpen(true);
        return;
      }

      setOtpError("");
      setOtpTouched(false);

      const mobileToUse = mobile || userState.mobile;
      if (!mobileToUse) {
        setMobileError("mobileRequired");
        return;
      }

      dispatch(
        UserAction(USER_CONFIRM_CODE, {
          email: verifiedEmail,
          otp: otp.trim(),
          mobile: mobileToUse,
        }),
      );
    }
  };

  // Reset to email input
  const handleChangeEmail = () => {
    setShowLoginMethods(false);
    setVerifiedEmail("");
    setEmailOtpSent(false);
    setEmailOtp("");
    setPassword("");
    setLoginMethod("email");
    setEmailOtpCountdown(0);
    setPasswordError("");
    setPasswordTouched(false);
    setEmailOtpError("");
    setEmailOtpTouched(false);
    setIsOtpSent(false);
    setMobile("");
    setMobileError("");
    setMobileTouched(false);
    setOtp("");
    setOtpError("");
    setOtpTouched(false);
    setSmsOtpCountdown(0);
    setSmsOtpDialogOpen(false);
  };

  // Handle login method change - clear errors when switching
  const handleLoginMethodChange = (value: string) => {
    setLoginMethod(value);
    setPasswordError("");
    setPasswordTouched(false);
    setEmailOtpError("");
    setEmailOtpTouched(false);
    setOtpError("");
    setOtpTouched(false);
    setMobileError("");
    setMobileTouched(false);
  };

  // Handle Google social login
  const handleGoogleLogin = () => {
    signIn("google", {
      callbackUrl: "/auth/validateSocialLogin",
    });
  };

  // Forgot password countdown timer
  useEffect(() => {
    if (forgotPasswordOtpCountdown > 0) {
      const timerId = setTimeout(() => {
        setForgotPasswordOtpCountdown(forgotPasswordOtpCountdown - 1);
      }, 1000);
      return () => clearTimeout(timerId);
    }
  }, [forgotPasswordOtpCountdown]);

  const handleForgotPasswordEmailSubmit = async (email: string) => {
    setForgotPasswordEmailError("");
    setForgotPasswordDialogOpen(false);

    try {
      const {
        data: { data },
      } = await axiosBaseApi.get("/user/checkEmail?email=" + email);

      if (data.validEmail) {
        dispatch(
          UserAction(USER_SEND_RESET_LINK, {
            email: email,
          }),
        );
        setForgotPasswordEmailError("");
      } else {
        setForgotPasswordEmailError("emailNotFound");
        setIsPasswordRecoveryMode(false);
      }
    } catch (e: any) {
      const message =
        e.response?.data?.message ?? e.message ?? "An error occurred";
      setForgotPasswordEmailError(message);
      setIsPasswordRecoveryMode(false);
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: message,
          severity: "error",
        },
      });
    }
  };

  return (
    <AuthContainer>
      <CardWrapper
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: isMobile ? "10px 18px" : "8px 27px",
          height: isMobile ? "49px" : "56px",
          overflow: "visible",
        }}
      >
        {/* Logo */}
        <Image
          src={Logo}
          alt="logo"
          width={isMobile ? 86 : 114}
          height={isMobile ? 29 : 39}
          draggable={false}
          onClick={() => {
            router.push("/");
          }}
          style={{ cursor: "pointer" }}
        />

        <Box>
          <LanguageSwitcher />
        </Box>
      </CardWrapper>

      {/* Login Card */}
      <CardWrapper sx={{ padding: "30px" }}>
        <TitleDescription
          title={t("login")}
          description={t("loginDescription")}
          align="left"
        />

        {/* Email Input field - shown initially or when changing email */}
        {!showLoginMethods ? (
          <>
            <Box sx={{ marginTop: isMobile ? "18px" : "24px" }}>
              <InputField
                label={t("email")}
                type="email"
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  if (emailError) {
                    setEmailError("");
                    setEmailTouched(false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !emailCheckLoading) {
                    e.preventDefault();
                    handleEmailCheck();
                  }
                }}
                placeholder={t("emailPlaceHolder")}
                error={emailTouched && !!emailError}
                helperText={
                  emailTouched && emailError
                    ? emailError.includes(" ")
                      ? emailError
                      : t(emailError)
                    : ""
                }
              />
            </Box>

            {/* Don't have acc */}
            <Box
              sx={{
                display: "flex",
                gap: "7px",
                marginTop: isMobile ? "16px" : "16px",
              }}
            >
              <Typography
                sx={{
                  fontSize: "13px",
                  color: theme.palette.text.secondary,
                  fontFamily: "UrbanistMedium",
                  lineHeight: "1.2",
                  letterSpacing: 0,
                }}
                fontWeight={500}
              >
                {t("dontHaveAccount")}
              </Typography>
              <Typography
                sx={{
                  fontSize: "13px",
                  color: theme.palette.primary.main,
                  fontWeight: 500,
                  lineHeight: "1.2",
                  letterSpacing: 0,
                  cursor: "pointer",
                  textDecoration: "underline",
                  fontFamily: "UrbanistMedium",
                }}
                onClick={() => {
                  router.push("/auth/register");
                }}
              >
                {t("createNewAccount")}
              </Typography>
            </Box>

            <Box sx={{ marginTop: isMobile ? "20px" : "24px" }}>
              <CustomButton
                label={t("continue")}
                variant="primary"
                size={isMobile ? "small" : "medium"}
                fullWidth
                disabled={emailCheckLoading}
                onClick={handleEmailCheck}
                hideLabelWhenLoading={true}
                showSuccessAnimation={showSuccessAnimation}
                showErrorAnimation={showErrorAnimation}
                sx={{
                  fontWeight: 700,
                }}
                endIcon={
                  emailCheckLoading ? <LoadingIcon size={20} /> : undefined
                }
              />
            </Box>
          </>
        ) : (
          <>
            {/* Show verified email in InputBox with edit button */}
            <Box sx={{ marginTop: isMobile ? "16px" : "24px" }}>
              <InputField
                label={t("email")}
                type="email"
                value={verifiedEmail}
                readOnly={true}
                sideButton={true}
                sideButtonType="primary"
                sideButtonIcon={EditIcon}
                sideButtonIconWidth={isMobile ? "12px" : "14px"}
                sideButtonIconHeight={isMobile ? "12px" : "14px"}
                onSideButtonClick={handleChangeEmail}
              />
            </Box>

            <Box sx={{ marginTop: isMobile ? "12px" : "24px" }}>
              <Typography
                sx={{
                  textAlign: "start",
                  fontSize: isMobile ? "13px" : "15px",
                  fontFamily: "UrbanistMedium",
                  lineHeight: "1.2",
                  letterSpacing: 0,
                  color: "#676768",
                }}
              >
                {t("chooseLoginMethod")}
              </Typography>

              {/* Login Method Selection */}
              <Box sx={{ marginTop: "16px" }}>
                <RadioGroup
                  value={loginMethod}
                  onChange={(e) => handleLoginMethodChange(e.target.value)}
                  sx={{
                    "& .MuiFormControlLabel-label": {
                      fontSize: isMobile ? "13px" : "15px",
                      fontFamily: "UrbanistMedium",
                      color: "#242428",
                      paddingLeft: "8px",
                    },
                  }}
                >
                  {/* SMS Option */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                    }}
                  >
                    <FormControlLabel
                      value="sms"
                      control={<CustomRadio />}
                      label={t("sendVerificationCodeViaSms")}
                      sx={{ margin: "0px", flex: 1, textAlign: "start" }}
                    />

                    {/* Get Code Button - Desktop */}
                    {loginMethod === "sms" && !isMobile && !isOtpSent && (
                      <CustomButton
                        variant="secondary"
                        size="medium"
                        label={t("getCode")}
                        onClick={handleSendSmsOtp}
                        disabled={userState.loading}
                        sx={{
                          fontWeight: 500,
                          padding: "8px 22.5px",
                        }}
                        endIcon={ArrowUpwardIcon}
                      />
                    )}

                    {/* Resend Code Button - Desktop */}
                    {loginMethod === "sms" && !isMobile && isOtpSent && (
                      <CustomButton
                        variant="secondary"
                        disabled={smsOtpCountdown > 0 || userState.loading}
                        size="medium"
                        label={
                          smsOtpCountdown > 0
                            ? `${t("codeIn")} ${smsOtpCountdown}s`
                            : t("resendCode")
                        }
                        onClick={handleSendSmsOtp}
                        endIcon={
                          smsOtpCountdown > 0 || userState.loading
                            ? undefined
                            : ArrowUpwardIcon
                        }
                        sx={{
                          fontWeight: 500,
                          padding: "11px 20px",
                        }}
                      />
                    )}
                  </Box>

                  {/* Show mobile number if available from userState */}
                  {loginMethod === "sms" && userState.mobile && (
                    <Box sx={{ marginLeft: "32px" }}>
                      <Typography
                        sx={{
                          textAlign: "start",
                          fontSize: "12px",
                          color: "#676768",
                          fontFamily: "UrbanistMedium",
                        }}
                      >
                        {t("codeWillBeSentTo")}
                        {userState.mobile.substring(7)}
                      </Typography>
                    </Box>
                  )}

                  {/* Mobile Input Field - Desktop (only show if mobile not in userState) */}
                  {loginMethod === "sms" &&
                    !isMobile &&
                    !isOtpSent &&
                    !userState.mobile && (
                      <Box sx={{ marginTop: "8px" }}>
                        <InputField
                          placeholder={t("enterMobilePlaceholder")}
                          value={mobile}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, "");
                            setMobile(value);
                            if (mobileError) {
                              setMobileError("");
                              setMobileTouched(false);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (
                              e.key === "Enter" &&
                              !userState.loading &&
                              mobile &&
                              mobile.length >= 10
                            ) {
                              e.preventDefault();
                              handleSendSmsOtp();
                            }
                          }}
                          type="text"
                          inputMode="numeric"
                          error={mobileTouched && !!mobileError}
                          helperText={
                            mobileTouched && mobileError
                              ? mobileError.includes(" ")
                                ? mobileError
                                : t(mobileError)
                              : ""
                          }
                        />
                      </Box>
                    )}

                  {/* Mobile Input Field - Mobile (only show if mobile not in userState) */}
                  {loginMethod === "sms" &&
                    isMobile &&
                    !isOtpSent &&
                    !userState.mobile && (
                      <Box sx={{ marginTop: "8px" }}>
                        <InputField
                          placeholder={t("enterMobilePlaceholder")}
                          value={mobile}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, "");
                            setMobile(value);
                            if (mobileError) {
                              setMobileError("");
                              setMobileTouched(false);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (
                              e.key === "Enter" &&
                              !userState.loading &&
                              mobile &&
                              mobile.length >= 10
                            ) {
                              e.preventDefault();
                              handleSendSmsOtp();
                            }
                          }}
                          type="text"
                          inputMode="numeric"
                          error={mobileTouched && !!mobileError}
                          helperText={
                            mobileTouched && mobileError
                              ? mobileError.includes(" ")
                                ? mobileError
                                : t(mobileError)
                              : ""
                          }
                          sideButton={true}
                          sideButtonType="secondary"
                          sideButtonIcon={ArrowUpwardIcon}
                          sideButtonIconWidth={isMobile ? "10px" : "14px"}
                          sideButtonIconHeight={isMobile ? "10px" : "14px"}
                          onSideButtonClick={handleSendSmsOtp}
                        />
                      </Box>
                    )}

                  {/* Get Code Button - Mobile (when mobile is in userState) */}
                  {loginMethod === "sms" &&
                    isMobile &&
                    !isOtpSent &&
                    userState.mobile && (
                      <Box sx={{ marginTop: "8px" }}>
                        <CustomButton
                          variant="secondary"
                          size="small"
                          label={t("getCode")}
                          fullWidth
                          disabled={userState.loading}
                          onClick={handleSendSmsOtp}
                          sx={{
                            fontWeight: 500,
                            padding: "8px 22.5px",
                          }}
                          endIcon={ArrowUpwardIcon}
                        />
                      </Box>
                    )}

                  {/* Resend Code Button - Mobile */}
                  {loginMethod === "sms" && isMobile && isOtpSent && (
                    <Box sx={{ marginTop: "8px" }}>
                      <CustomButton
                        variant="secondary"
                        disabled={smsOtpCountdown > 0 || userState.loading}
                        size="small"
                        label={
                          smsOtpCountdown > 0
                            ? `${t("codeIn")} ${smsOtpCountdown}s`
                            : t("resendCode")
                        }
                        fullWidth
                        onClick={handleSendSmsOtp}
                        endIcon={
                          smsOtpCountdown > 0 || userState.loading
                            ? undefined
                            : ArrowUpwardIcon
                        }
                        sx={{
                          height: "32px",
                          fontSize: "13px",
                          fontWeight: 500,
                          padding: "8px 20px",
                        }}
                      />
                    </Box>
                  )}

                  {/* Email Option */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      marginTop: "16px",
                    }}
                  >
                    <FormControlLabel
                      value="email"
                      control={<CustomRadio />}
                      label={t("sendVerificationCodeViaEmail")}
                      sx={{
                        margin: "0px",
                        color: "#242428",
                        textAlign: "start",
                        flex: 1,
                      }}
                    />
                    {/* Get Code Button */}
                    {loginMethod === "email" && !isMobile && !emailOtpSent && (
                      <CustomButton
                        variant="secondary"
                        size="medium"
                        label={t("getCode")}
                        onClick={handleSendEmailOtp}
                        disabled={userState.loading}
                        sx={{
                          fontWeight: 500,
                          padding: "8px 22.5px",
                        }}
                        endIcon={ArrowUpwardIcon}
                      />
                    )}

                    {/* Resend Code Button */}
                    {loginMethod === "email" && !isMobile && emailOtpSent && (
                      <CustomButton
                        variant="secondary"
                        disabled={
                          (emailOtpDialogOpen && emailOtpCountdown > 0) ||
                          userState.loading
                        }
                        size="medium"
                        label={
                          emailOtpCountdown > 0
                            ? `${t("codeIn")} ${emailOtpCountdown}s`
                            : t("resendCode")
                        }
                        onClick={handleSendEmailOtp}
                        endIcon={
                          emailOtpCountdown > 0 && emailOtpDialogOpen
                            ? undefined
                            : ArrowUpwardIcon
                        }
                        sx={{
                          fontWeight: 500,
                          padding: "11px 20px",
                        }}
                      />
                    )}
                  </Box>

                  {/* Get Code Button - Mobile */}
                  {loginMethod === "email" && isMobile && !emailOtpSent && (
                    <Box sx={{ marginTop: "10px" }}>
                      <CustomButton
                        variant="secondary"
                        size="small"
                        label={t("getCode")}
                        fullWidth
                        disabled={userState.loading}
                        onClick={handleSendEmailOtp}
                        sx={{
                          fontWeight: 500,
                          padding: "8px 22.5px",
                        }}
                        endIcon={ArrowUpwardIcon}
                      />
                    </Box>
                  )}

                  {/* Resend Code Button - Mobile */}
                  {loginMethod === "email" && isMobile && emailOtpSent && (
                    <Box sx={{ marginTop: "16px" }}>
                      <CustomButton
                        variant="secondary"
                        size="small"
                        label={
                          emailOtpCountdown > 0
                            ? `${t("codeIn")} ${emailOtpCountdown}s`
                            : t("resendCode")
                        }
                        fullWidth
                        disabled={emailOtpCountdown > 0}
                        endIcon={
                          emailOtpCountdown > 0 ? undefined : ArrowUpwardIcon
                        }
                        onClick={handleSendEmailOtp}
                        sx={{
                          fontWeight: 500,
                          padding: "8px 20px",
                        }}
                      />
                    </Box>
                  )}

                  {/* Password Option */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      margin: "16px 0 0 0",
                    }}
                  >
                    <FormControlLabel
                      value="password"
                      control={<CustomRadio />}
                      label={t("password")}
                      sx={{ margin: "0px", color: "#242428" }}
                      onClick={() => {
                        setLoginMethod("password");
                        setTimeout(() => {
                          const input = document.getElementById("password");
                          input?.focus();
                        }, 0);
                      }}
                    />
                    {loginMethod === "password" && (
                      <Typography
                        component="span"
                        sx={{
                          fontSize: "13px",
                          color: theme.palette.primary.main,
                          fontWeight: 500,
                          textAlign: "start",
                          cursor: "pointer",
                          textDecoration: "underline",
                          textUnderlineOffset: "2px",
                          fontFamily: "UrbanistMedium",
                        }}
                        onClick={() => {
                          setForgotPasswordDialogOpen(true);
                        }}
                      >
                        {t("forgotYourPassword")}
                      </Typography>
                    )}
                  </Box>
                  {/* Password Input Field */}
                  {loginMethod === "password" && (
                    <Box sx={{ marginTop: "10px" }}>
                      <InputField
                        name="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (passwordError) {
                            setPasswordError("");
                            setPasswordTouched(false);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !userState.loading) {
                            e.preventDefault();
                            handleLoginSubmit();
                          }
                        }}
                        placeholder={t("passwordPlaceHolder")}
                        error={
                          loginMethod === "password" &&
                          passwordTouched &&
                          !!passwordError
                        }
                        helperText={
                          loginMethod === "password" &&
                          passwordTouched &&
                          passwordError
                            ? passwordError.includes(" ")
                              ? passwordError
                              : t(passwordError)
                            : ""
                        }
                        sideButton={true}
                        sideButtonType="primary"
                        sideButtonIcon={
                          showPassword ? (
                            <VisibilityOffIcon
                              sx={{
                                color: "#676768",
                                height: "18px",
                                width: "16px",
                              }}
                            />
                          ) : (
                            <VisibilityIcon
                              sx={{
                                color: "#676768",
                                height: "18px",
                                width: "16px",
                              }}
                            />
                          )
                        }
                        sideButtonIconWidth={isMobile ? "14px" : "18px"}
                        sideButtonIconHeight={isMobile ? "14px" : "18px"}
                        onSideButtonClick={() => {
                          setShowPassword(!showPassword);
                        }}
                        showPasswordToggle={true}
                      />
                    </Box>
                  )}
                </RadioGroup>
              </Box>
            </Box>

            {/* Continue Button - shown when login methods are visible */}
            <Box sx={{ marginTop: "24px" }}>
              <CustomButton
                label={t("continue")}
                variant="primary"
                size={isMobile ? "small" : "medium"}
                fullWidth
                disabled={
                  userState.loading &&
                  !(
                    (loginMethod === "email" && emailOtpDialogOpen) ||
                    (loginMethod === "sms" && smsOtpDialogOpen)
                  )
                }
                onClick={() => {
                  handleLoginSubmit();
                }}
                hideLabelWhenLoading={true}
                showSuccessAnimation={
                  showSuccessAnimation &&
                  !(
                    (loginMethod === "email" && emailOtpDialogOpen) ||
                    (loginMethod === "sms" && smsOtpDialogOpen)
                  )
                }
                showErrorAnimation={
                  showErrorAnimation &&
                  !(
                    (loginMethod === "email" && emailOtpDialogOpen) ||
                    (loginMethod === "sms" && smsOtpDialogOpen)
                  )
                }
                sx={{
                  fontWeight: 700,
                }}
                endIcon={
                  userState.loading &&
                  !(
                    (loginMethod === "email" && emailOtpDialogOpen) ||
                    (loginMethod === "sms" && smsOtpDialogOpen)
                  ) ? (
                    <LoadingIcon size={20} />
                  ) : undefined
                }
              />
            </Box>
          </>
        )}

        {/* Social Login Section - shown only when login methods are visible */}

        <Box sx={{ marginTop: isMobile ? "16px" : "24px" }}>
          <Divider
            sx={{
              borderColor: "red",
              "&::before, &::after": {
                borderColor: "#E9ECF2",
              },
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontFamily: "UrbanistMedium",
                color: "#676768",
                padding: "0 24px",
                fontSize: isMobile ? "10px" : "15px",
                fontWeight: 500,
                lineHeight: "1.2",
                letterSpacing: 0,
              }}
            >
              {t("or")}
            </Typography>
          </Divider>
        </Box>

        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "16px",
            padding: 0,
            marginTop: isMobile ? "16px" : "24px",
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontSize: isMobile ? "13px" : "15px",
              fontFamily: "UrbanistMedium",
              color: "#676768",
              fontWeight: 500,
              lineHeight: "1.2",
              letterSpacing: 0,
            }}
          >
            {t("registerLogin")}
          </Typography>

          <Box
            sx={{
              height: isMobile ? "32px" : "40px",
              width: isMobile ? "32px" : "40px",
              borderRadius: "100%",
              border: "1px solid #E9ECF2",
              backgroundColor: "#F4F6FA",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
              "&:hover": {
                backgroundColor: "#E9ECF2",
                borderColor: "#D0D5DD",
              },
            }}
            onClick={handleGoogleLogin}
          >
            <ImageCenter>
              <Image
                src={GoogleIcon}
                alt="google login"
                width={24}
                height={24}
                draggable={false}
              />
            </ImageCenter>
          </Box>
        </Box>
      </CardWrapper>

      {/* Email OTP Dialog */}
      {loginMethod === "email" && (
        <OtpDialog
          open={emailOtpDialogOpen}
          onClose={() => {
            setEmailOtpDialogOpen(false);
          }}
          title={t("emailVerification")}
          subtitle={t("emailVerificationSubtitle")}
          contactInfo={emailInput}
          contactType="email"
          resendCodeLabel={t("resendCode")}
          resendCodeCountdownLabel={(seconds) => `${t("codeIn")} ${seconds}s`}
          primaryButtonLabel={t("checkAndAdd")}
          onResendCode={handleSendEmailOtp}
          onVerify={handleEmailOtpVerify}
          onClearError={() => {
            setEmailOtpError("");
            setEmailOtpTouched(false);
          }}
          countdown={emailOtpCountdown}
          loading={userState.loading}
          preventClose={emailOtpCountdown > 0}
          error={
            emailOtpTouched && emailOtpError
              ? emailOtpError.includes(" ")
                ? emailOtpError
                : t(emailOtpError)
              : undefined
          }
        />
      )}

      {/* SMS OTP Dialog */}
      {loginMethod === "sms" && (
        <OtpDialog
          open={smsOtpDialogOpen}
          onClose={() => {
            setSmsOtpDialogOpen(false);
          }}
          title={t("smsVerification") || "SMS Verification"}
          subtitle={
            t("smsVerificationSubtitle") ||
            "Enter the verification code sent to your mobile number"
          }
          contactInfo={userState.mobile || mobile}
          contactType="phone"
          resendCodeLabel={t("resendCode")}
          resendCodeCountdownLabel={(seconds) => `${t("codeIn")} ${seconds}s`}
          primaryButtonLabel={t("checkAndAdd")}
          onResendCode={handleSendSmsOtp}
          onVerify={handleSmsOtpVerify}
          onClearError={() => {
            setOtpError("");
            setOtpTouched(false);
          }}
          countdown={smsOtpCountdown}
          loading={userState.loading}
          preventClose={smsOtpCountdown > 0}
          error={
            otpTouched && otpError
              ? otpError.includes(" ")
                ? otpError
                : t(otpError)
              : undefined
          }
        />
      )}

      {/* Forgot Password Dialog */}
      <ForgotPasswordDialog
        open={forgotPasswordDialogOpen}
        onClose={() => {
          setForgotPasswordDialogOpen(false);
          setForgotPasswordEmailError("");
          setForgotPasswordOtpCountdown(0);
          setForgotPasswordOtpError("");
          setIsPasswordRecoveryMode(false);
        }}
        onEmailSubmit={handleForgotPasswordEmailSubmit}
        countdown={forgotPasswordOtpCountdown}
        loading={userState.loading}
        currentEmail={verifiedEmail}
        emailError={
          forgotPasswordEmailError
            ? forgotPasswordEmailError.includes(" ")
              ? forgotPasswordEmailError
              : t(forgotPasswordEmailError)
            : undefined
        }
        otpError={
          forgotPasswordOtpError
            ? forgotPasswordOtpError.includes(" ")
              ? forgotPasswordOtpError
              : t(forgotPasswordOtpError)
            : undefined
        }
      />
    </AuthContainer>
  );
}
