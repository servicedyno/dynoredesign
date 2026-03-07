import LoadingIcon from "@/assets/Icons/LoadingIcon";
import Logo from "@/assets/Images/auth/dynopay-logo.png";
import WhiteLogo from "@/assets/Images/auth/dynopay-white-logo.png";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import PasswordValidation from "@/Components/UI/AuthLayout/PasswordValidation";
import TitleDescription from "@/Components/UI/AuthLayout/TitleDescription";
import CustomButton from "@/Components/UI/Buttons";
import LanguageSwitcher from "@/Components/UI/LanguageSwitcher";
import OtpDialog from "@/Components/UI/OtpDialog";
import { AuthContainer, CardWrapper } from "@/Containers/Login/styled";
import useIsMobile from "@/hooks/useIsMobile";
import {
  USER_API_ERROR,
  USER_VERIFY_EMAIL,
  USER_REGISTER,
  USER_RESEND_VERIFICATION,
  UserAction,
} from "@/Redux/Actions/UserAction";
import { theme } from "@/styles/theme";
import { rootReducer } from "@/utils/types";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { Box, Typography, ToggleButton, ToggleButtonGroup, useTheme } from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import Image from "next/image";
import router from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import * as yup from "yup";
import axiosBaseApi from "@/axiosConfig";

type RegisterErrorKey =
  | ""
  | "firstNameRequired"
  | "lastNameRequired"
  | "emailRequired"
  | "emailInvalid"
  | "passwordRequired"
  | "passwordInvalid"
  | "passwordAndConfirmPasswordShouldBeSame";

const Register = () => {
  const isMobile = useIsMobile();
  const { t } = useTranslation("auth");
  const dispatch = useDispatch();
  const muiTheme = useTheme();
  const userState = useSelector((state: rootReducer) => state.userReducer);

  const [firstName, setFirstName] = useState("");
  const [firstNameError, setFirstNameError] = useState<RegisterErrorKey>("");

  const [lastName, setLastName] = useState("");
  const [lastNameError, setLastNameError] = useState<RegisterErrorKey>("");

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<RegisterErrorKey>("");

  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<RegisterErrorKey>("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordValidation, setShowPasswordValidation] = useState(false);
  const passwordFieldRef = useRef<HTMLDivElement | null>(null);

  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] =
    useState<RegisterErrorKey>("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Email verification state
  const [pendingVerification, setPendingVerification] = useState(false);
  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [otpError, setOtpError] = useState("");
  const [otpSubmitted, setOtpSubmitted] = useState(false);
  const prevLoading = useRef(false);

  const passwordRegex =
    /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()\-=__+{}\[\]:;<>,.?/~]).{8,20}$/;

  // Registration method toggle
  const [registerMethod, setRegisterMethod] = useState<"email" | "phone">("email");

  // Phone registration state
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [phoneName, setPhoneName] = useState("");
  const [phoneNameError, setPhoneNameError] = useState("");
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpDialog, setPhoneOtpDialog] = useState(false);
  const [phoneOtpCountdown, setPhoneOtpCountdown] = useState(0);
  const [phoneOtpError, setPhoneOtpError] = useState("");
  const [phonePassword, setPhonePassword] = useState("");
  const [phonePasswordError, setPhonePasswordError] = useState("");
  const [showPhonePassword, setShowPhonePassword] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);

  // Phone OTP countdown timer
  useEffect(() => {
    if (phoneOtpCountdown <= 0) return;
    const timer = setInterval(() => {
      setPhoneOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [phoneOtpCountdown]);

  const handlePhoneRegisterStep1 = async () => {
    if (!phoneName.trim()) { setPhoneNameError("Name is required"); return; }
    if (!phone.trim() || phone.length < 8) { setPhoneError("Valid phone number is required (include country code, e.g. +1...)"); return; }
    if (!phonePassword || !passwordRegex.test(phonePassword)) { setPhonePasswordError("Password must be 8-20 chars with uppercase, lowercase, number, special char"); return; }
    setPhoneNameError("");
    setPhoneError("");
    setPhonePasswordError("");
    setPhoneLoading(true);
    try {
      await axiosBaseApi.post("/user/registerPhone", {
        name: phoneName.trim(),
        mobile: phone.trim(),
        password: phonePassword,
      });
      setPhoneOtpSent(true);
      setPhoneOtpDialog(true);
      setPhoneOtpCountdown(60);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to send OTP. Please check your phone number.";
      setPhoneError(msg);
    } finally {
      setPhoneLoading(false);
    }
  };

  const handlePhoneOtpVerify = async (otp: string) => {
    setPhoneOtpError("");
    setPhoneLoading(true);
    try {
      const res = await axiosBaseApi.post("/user/registerPhone/verify", {
        mobile: phone.trim(),
        otp: otp.trim(),
      });
      // If successful, user is created — redirect to login
      if (res.data?.data?.token) {
        // Auto-login
        localStorage.setItem("token", res.data.data.token);
        if (res.data.data.refreshToken) {
          localStorage.setItem("refreshToken", res.data.data.refreshToken);
        }
        router.push("/dashboard");
      } else {
        router.push("/auth/login");
      }
    } catch (err: any) {
      setPhoneOtpError(err?.response?.data?.message || "Invalid OTP. Please try again.");
    } finally {
      setPhoneLoading(false);
    }
  };

  const handlePhoneResend = async () => {
    setPhoneOtpError("");
    try {
      await axiosBaseApi.post("/user/registerPhone", {
        name: phoneName.trim(),
        mobile: phone.trim(),
        password: phonePassword,
      });
      setPhoneOtpCountdown(60);
    } catch (err: any) {
      setPhoneOtpError("Failed to resend OTP");
    }
  };

  const registerSchema = yup.object().shape({
    firstName: yup.string().required("firstNameRequired"),
    lastName: yup.string().required("lastNameRequired"),
    email: yup.string().email("emailInvalid").required("emailRequired"),
    password: yup
      .string()
      .required("passwordRequired")
      .matches(passwordRegex, "passwordInvalid"),
    confirmPassword: yup.string().oneOf([yup.ref("password")]),
  });

  // Redirect to dashboard only AFTER email verification (not on registration)
  useEffect(() => {
    if (userState.name && !pendingVerification) {
      router.push("/dashboard");
    }
  }, [userState, pendingVerification]);

  // Reset pendingVerification on registration error
  useEffect(() => {
    if (
      pendingVerification &&
      !showOtpDialog &&
      userState.error &&
      userState.error.actionType === USER_REGISTER
    ) {
      setPendingVerification(false);
    }
  }, [userState.error, pendingVerification, showOtpDialog]);

  // When registration succeeds, show OTP dialog
  // NOTE: Backend registerUser already sends the verification OTP email,
  // so we only open the dialog — no need to call resend-verification here
  useEffect(() => {
    if (userState.name && pendingVerification && !showOtpDialog) {
      setShowOtpDialog(true);
      setOtpCountdown(30);
    }
  }, [userState.name, pendingVerification, showOtpDialog]);

  // Detect OTP verification result (loading transitions from true → false after submit)
  useEffect(() => {
    if (prevLoading.current && !userState.loading && otpSubmitted) {
      if (!userState.error || (userState.error && userState.error.actionType !== USER_VERIFY_EMAIL)) {
        // Check if email_verified was set
        if (userState.email_verified) {
          // OTP verified — allow redirect
          setShowOtpDialog(false);
          setPendingVerification(false);
          setOtpSubmitted(false);
        }
      }
      if (userState.error && userState.error.actionType === USER_VERIFY_EMAIL) {
        setOtpError(userState.error.message || t("enterOTPError"));
        setOtpSubmitted(false);
      }
    }
    prevLoading.current = userState.loading;
  }, [userState.loading, userState.error, userState.email_verified, otpSubmitted, t]);

  // OTP countdown timer
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setInterval(() => {
      setOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCountdown]);

  const handleOtpVerify = useCallback(
    (otp: string) => {
      setOtpError("");
      setOtpSubmitted(true);
      dispatch(UserAction(USER_VERIFY_EMAIL, { otp: otp.trim() }));
    },
    [dispatch],
  );

  const handleResendOtp = useCallback(() => {
    setOtpError("");
    dispatch(UserAction(USER_RESEND_VERIFICATION, { email }));
    setOtpCountdown(30);
  }, [dispatch, email]);

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

  const validateField = async (
    field: "firstName" | "lastName" | "email" | "password",
    nextValues?: {
      firstName?: string;
      lastName?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    },
  ) => {
    try {
      await registerSchema.validateAt(field, {
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
        ...(nextValues || {}),
      });
      if (field === "firstName") setFirstNameError("");
      if (field === "lastName") setLastNameError("");
      if (field === "email") setEmailError("");
      if (field === "password") {
        setPasswordError("");
        setShowPasswordValidation(false);
      }
    } catch (e: any) {
      const key = (e?.message || "") as RegisterErrorKey;
      if (field === "firstName") setFirstNameError(key);
      if (field === "lastName") setLastNameError(key);
      if (field === "email") setEmailError(key);
      if (field === "password") {
        if (key === "passwordInvalid") {
          setPasswordError("");
          setShowPasswordValidation(true);
        } else {
          setPasswordError(key);
        }
      }
    }
  };

  const handlePasswordChange = (value: string) => {
    const valueWithoutSpaces = value.replace(/\s/g, "");
    const finalValue = valueWithoutSpaces;

    setPassword(finalValue);

    if (!finalValue) {
      setShowPasswordValidation(false);
      if (passwordError) validateField("password", { password: finalValue });
    } else if (passwordRegex.test(finalValue)) {
      setPasswordError("");
      setShowPasswordValidation(false);
    } else {
      setPasswordError("");
      setShowPasswordValidation(true);
    }

    if (confirmPassword) {
      if (finalValue && confirmPassword && confirmPassword !== finalValue) {
        setConfirmPasswordError("passwordAndConfirmPasswordShouldBeSame");
      } else {
        setConfirmPasswordError("");
      }
    }
  };

  const handlePasswordBlur = () => {
    setTimeout(() => {
      setShowPasswordValidation(false);
    }, 200);
  };

  const handleSignUp = async () => {
    try {
      await registerSchema.validate(
        { firstName, lastName, email, password, confirmPassword },
        { abortEarly: false },
      );

      setFirstNameError("");
      setLastNameError("");
      setEmailError("");
      setPasswordError("");
      setConfirmPasswordError("");

      const payload = {
        name: `${firstName} ${lastName}`.trim(),
        email,
        password,
      };

      setPendingVerification(true);
      dispatch(UserAction(USER_REGISTER, payload));
    } catch (err: any) {
      if (err.inner && Array.isArray(err.inner)) {
        const fieldErrors: Record<string, RegisterErrorKey> = {};
        err.inner.forEach((e: any) => {
          if (e.path && !fieldErrors[e.path]) {
            fieldErrors[e.path] = e.message as RegisterErrorKey;
          }
        });

        setFirstNameError(fieldErrors.firstName || "");
        setLastNameError(fieldErrors.lastName || "");
        setEmailError(fieldErrors.email || "");
        if (fieldErrors.password === "passwordInvalid") {
          setPasswordError("");
          setShowPasswordValidation(true);
        } else {
          setPasswordError(fieldErrors.password || "");
        }

        if (confirmPassword && password && confirmPassword !== password) {
          setConfirmPasswordError("passwordAndConfirmPasswordShouldBeSame");
        } else {
          setConfirmPasswordError("");
        }
      }
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
          src={muiTheme.palette.mode === "dark" ? WhiteLogo : Logo}
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

      {/* Register Card */}
      <CardWrapper sx={{ padding: "30px" }}>
        <TitleDescription
          title={t("register")}
          description={t("registerDescription")}
          align="left"
          titleVariant="h2"
          descriptionVariant="p"
        />

        {/* Registration Method Toggle */}
        <Box sx={{ mt: 2, mb: 1, display: "flex", justifyContent: "center" }}>
          <ToggleButtonGroup
            value={registerMethod}
            exclusive
            onChange={(_, val) => { if (val) setRegisterMethod(val); }}
            size="small"
            sx={{
              "& .MuiToggleButton-root": {
                textTransform: "none",
                fontFamily: "UrbanistMedium",
                fontSize: "13px",
                px: 3,
                py: 0.8,
                borderColor: theme.palette.divider,
                "&.Mui-selected": {
                  bgcolor: theme.palette.primary.main,
                  color: "#fff",
                  "&:hover": { bgcolor: theme.palette.primary.dark },
                },
              },
            }}
          >
            <ToggleButton value="email">
              <EmailIcon sx={{ fontSize: 16, mr: 0.5 }} /> Email
            </ToggleButton>
            <ToggleButton value="phone">
              <PhoneIcon sx={{ fontSize: 16, mr: 0.5 }} /> Phone
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {registerMethod === "phone" ? (
          /* Phone Registration Form */
          <Box
            sx={{
              marginTop: isMobile ? "12px" : "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <InputField
              label="Full Name"
              type="text"
              placeholder="Enter your full name"
              value={phoneName}
              onChange={(e) => { setPhoneName(e.target.value); setPhoneNameError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handlePhoneRegisterStep1(); }}
              error={!!phoneNameError}
              helperText={phoneNameError}
            />
            <InputField
              label="Phone Number"
              type="tel"
              placeholder="+1 234 567 8900"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setPhoneError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handlePhoneRegisterStep1(); }}
              error={!!phoneError}
              helperText={phoneError}
            />
            <InputField
              type={showPhonePassword ? "text" : "password"}
              value={phonePassword}
              autoComplete="off"
              label="Password"
              onChange={(e) => { setPhonePassword(e.target.value.replace(/\s/g, "")); setPhonePasswordError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handlePhoneRegisterStep1(); }}
              placeholder="Create a password"
              error={!!phonePasswordError}
              helperText={phonePasswordError}
              sideButton={true}
              sideButtonType="primary"
              sideButtonIcon={showPhonePassword ? <VisibilityOffIcon sx={{ color: "text.secondary", height: "18px", width: "16px" }} /> : <VisibilityIcon sx={{ color: "text.secondary", height: "18px", width: "16px" }} />}
              sideButtonIconWidth={isMobile ? "14px" : "18px"}
              sideButtonIconHeight={isMobile ? "14px" : "18px"}
              onSideButtonClick={() => setShowPhonePassword(!showPhonePassword)}
              showPasswordToggle={true}
            />

            <Box sx={{ mt: 1 }}>
              <CustomButton
                label="Send Verification Code"
                variant="primary"
                size={isMobile ? "small" : "medium"}
                fullWidth
                disabled={phoneLoading}
                onClick={handlePhoneRegisterStep1}
                hideLabelWhenLoading={true}
                endIcon={phoneLoading ? <LoadingIcon size={20} /> : undefined}
              />
            </Box>

            {/* Phone OTP Dialog */}
            <OtpDialog
              open={phoneOtpDialog}
              onClose={() => setPhoneOtpDialog(false)}
              preventClose={false}
              title="Phone Verification"
              subtitle="Enter the verification code sent to your phone"
              contactInfo={phone}
              contactType="phone"
              otpLength={6}
              onVerify={handlePhoneOtpVerify}
              onResendCode={handlePhoneResend}
              onClearError={() => setPhoneOtpError("")}
              countdown={phoneOtpCountdown}
              loading={phoneLoading}
              error={phoneOtpError}
            />
          </Box>
        ) : (
        /* Email Registration Form (existing) */
        <Box
          sx={{
            marginTop: isMobile ? "16px" : "24px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              gap: isMobile ? "12px" : "14px",
            }}
          >
            {/* First Name */}
            <InputField
              label={t("firstName")}
              type="text"
              placeholder={t("firstNamePlaceholder")}
              value={firstName}
              onChange={(e) => {
                const rawValue = e.target.value.replace(/\s/g, "");
                const capitalized =
                  rawValue.length > 0
                    ? rawValue.charAt(0).toUpperCase() + rawValue.slice(1)
                    : rawValue;
                setFirstName(capitalized);
                if (firstNameError)
                  validateField("firstName", { firstName: capitalized });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !userState.loading) {
                  e.preventDefault();
                  handleSignUp();
                }
              }}
              error={!!firstNameError}
              helperText={firstNameError ? t(firstNameError) : ""}
            />

            {/* Last Name */}
            <InputField
              label={t("lastName")}
              type="text"
              placeholder={t("lastNamePlaceholder")}
              value={lastName}
              onChange={(e) => {
                const rawValue = e.target.value.replace(/\s/g, "");
                const capitalized =
                  rawValue.length > 0
                    ? rawValue.charAt(0).toUpperCase() + rawValue.slice(1)
                    : rawValue;
                setLastName(capitalized);
                if (lastNameError)
                  validateField("lastName", { lastName: capitalized });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !userState.loading) {
                  e.preventDefault();
                  handleSignUp();
                }
              }}
              error={!!lastNameError}
              helperText={lastNameError ? t(lastNameError) : ""}
            />
          </Box>

          {/* Email */}
          <InputField
            label={t("email")}
            type="email"
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => {
              const valueWithoutSpaces = e.target.value.replace(/\s/g, "");
              setEmail(valueWithoutSpaces);
              if (emailError)
                validateField("email", { email: valueWithoutSpaces });
            }}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Spacebar") {
                e.preventDefault();
              }
              // Submit on Enter
              if (e.key === "Enter" && !userState.loading) {
                e.preventDefault();
                handleSignUp();
              }
            }}
            error={!!emailError}
            helperText={emailError ? t(emailError) : ""}
          />

          {/* Password */}
          <Box
            ref={passwordFieldRef}
            sx={{ position: "relative", width: "100%" }}
          >
            <InputField
              type={showPassword ? "text" : "password"}
              value={password}
              autoComplete="off"
              label={t("password")}
              onChange={(e) => {
                handlePasswordChange(e.target.value);
              }}
              onFocus={() => {
                if (password && !passwordRegex.test(password)) {
                  setShowPasswordValidation(true);
                }
              }}
              onBlur={() => {
                handlePasswordBlur();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !userState.loading) {
                  e.preventDefault();
                  handleSignUp();
                }
              }}
              placeholder={t("passwordPlaceHolder")}
              error={!!passwordError || showPasswordValidation}
              helperText={passwordError ? t(passwordError) : ""}
              sideButton={true}
              sideButtonType="primary"
              sideButtonIcon={
                showPassword ? (
                  <VisibilityOffIcon
                    tabIndex={-1}
                    aria-hidden={true}
                    sx={{
                      color: "text.secondary",
                      height: "18px",
                      width: "16px",
                    }}
                  />
                ) : (
                  <VisibilityIcon
                    tabIndex={-1}
                    aria-hidden={true}
                    sx={{
                      color: "text.secondary",
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
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                position: "absolute",
                ...(isMobile &&
                  theme.breakpoints.down("lg") && {
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "100%",
                  }),
                zIndex: 5,
              }}
            >
              <PasswordValidation
                password={password}
                anchorEl={passwordFieldRef.current}
                open={showPasswordValidation}
                onClose={() => setShowPasswordValidation(false)}
                showOnMobile={showPasswordValidation}
              />
            </Box>
          </Box>

          {/* Confirm Password */}
          <InputField
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            autoComplete="off"
            label={t("confirmPassword")}
            onChange={(e) => {
              const value = e.target.value.replace(/\s/g, "");
              setConfirmPassword(value);
              if (!password || !value) {
                setConfirmPasswordError("");
              } else if (value !== password) {
                setConfirmPasswordError(
                  "passwordAndConfirmPasswordShouldBeSame",
                );
              } else {
                setConfirmPasswordError("");
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !userState.loading) {
                e.preventDefault();
                handleSignUp();
              }
            }}
            placeholder={t("confirmPasswordPlaceHolder")}
            error={
              confirmPasswordError === "passwordAndConfirmPasswordShouldBeSame"
            }
            helperText={confirmPasswordError ? t(confirmPasswordError) : ""}
            sideButton={true}
            sideButtonType="primary"
            sideButtonIcon={
              showConfirmPassword ? (
                <VisibilityOffIcon
                  tabIndex={-1}
                  aria-hidden={true}
                  sx={{
                    color: "#676768",
                    height: "18px",
                    width: "16px",
                  }}
                />
              ) : (
                <VisibilityIcon
                  tabIndex={-1}
                  aria-hidden={true}
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
              setShowConfirmPassword(!showConfirmPassword);
            }}
            showPasswordToggle={true}
          />

          {/* Sign Up Button */}
          <Box sx={{ marginTop: isMobile ? "16px" : "24px" }}>
            <CustomButton
              label={t("signUpButton")}
              variant="primary"
              size={isMobile ? "small" : "medium"}
              fullWidth
              disabled={userState.loading}
              onClick={handleSignUp}
              hideLabelWhenLoading={true}
              endIcon={userState.loading ? <LoadingIcon size={20} /> : undefined}
            />
          </Box>
        </Box>
        )}

        {/* Don't have acc */}
        <Box
          sx={{
            display: "flex",
            gap: "7px",
            marginTop: "16px",
            textAlign: "center",
          }}
        >
          <Typography
            width="100%"
            sx={{
              fontSize: "13px",
              color: theme.palette.text.secondary,
              fontFamily: "UrbanistMedium",
            }}
            fontWeight={500}
          >
            {t("alreadyHaveAccountLink")}
            <Typography
              component="span"
              sx={{
                fontSize: "13px",
                color: theme.palette.primary.main,
                fontWeight: 500,
                textAlign: "start",
                cursor: "pointer",
                paddingLeft: "7px",
                textDecoration: "underline",
                textUnderlineOffset: "2px",
                fontFamily: "UrbanistMedium",
              }}
              onClick={() => {
                router.push("/auth/login");
              }}
            >
              {t("login")}
            </Typography>
          </Typography>
        </Box>
      </CardWrapper>

      {/* Email Verification OTP Dialog */}
      <OtpDialog
        open={showOtpDialog}
        onClose={() => {}}
        preventClose={true}
        title={t("emailVerification")}
        subtitle={t("emailVerificationSubtitle")}
        contactInfo={email}
        contactType="email"
        otpLength={6}
        onVerify={handleOtpVerify}
        onResendCode={handleResendOtp}
        onClearError={() => setOtpError("")}
        countdown={otpCountdown}
        loading={userState.loading && otpSubmitted}
        error={otpError}
      />
    </AuthContainer>
  );
};

export default Register;
