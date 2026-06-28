import InfoIcon from "@/assets/Icons/info-icon.svg";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import PasswordValidation from "@/Components/UI/AuthLayout/PasswordValidation";
import CustomButton from "@/Components/UI/Buttons";
import OtpDialog from "@/Components/UI/OtpDialog";
import PanelCard from "@/Components/UI/PanelCard";
import useIsMobile from "@/hooks/useIsMobile";
import { UserAction } from "@/Redux/Actions";
import { USER_PROFILE_FETCH } from "@/Redux/Actions/UserAction";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { rootReducer } from "@/utils/types";
import { Lock } from "@mui/icons-material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { Box, IconButton, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import * as yup from "yup";
import FormManager from "../Common/FormManager";
import { InfoIconBox, InfoText, InfoWrapper } from "./styled";
import axiosBaseApi from "@/axiosConfig";

const passwordRegex =
  /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()\-=__+{}\[\]:;<>,.?/~]).{8,20}$/;

const UpdatePassword = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { t } = useTranslation("profile");
  const isMobile = useIsMobile("md");

  const profile = useSelector((state: rootReducer) => state.userReducer.profile);
  const hasPassword = profile?.has_password ?? true; // default true for safety

  // OTP flow state
  const [otpStep, setOtpStep] = useState<"idle" | "requesting" | "otp_sent" | "verified">("idle");
  const [otpSentVia, setOtpSentVia] = useState("");
  const [otpMaskedContact, setOtpMaskedContact] = useState("");
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifiedOtp, setVerifiedOtp] = useState("");

  // Password form state
  const [formKey, setFormKey] = useState(0);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPasswordValidation, setShowPasswordValidation] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const newPasswordFieldRef = useRef<HTMLDivElement | null>(null);

  // Old password state (only for users who have a password)
  const [showOldPassword, setShowOldPassword] = useState(false);

  // OTP countdown
  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCountdown]);

  // Request OTP for password change
  const handleRequestOtp = async () => {
    setOtpStep("requesting");
    try {
      const res = await axiosBaseApi.post("user/profile/request-password-otp");
      const { data } = res.data || {};
      setOtpSentVia(data?.sent_via || "email");
      setOtpMaskedContact(data?.masked_contact || "");
      setOtpDialogOpen(true);
      setOtpCountdown(30);
      setOtpStep("otp_sent");
      dispatch({ type: TOAST_SHOW, payload: { message: `Verification code sent to your ${data?.sent_via || "email"}` } });
    } catch (e: any) {
      const msg = e.response?.data?.message || "Failed to send verification code";
      dispatch({ type: TOAST_SHOW, payload: { message: msg, severity: "error" } });
      setOtpStep("idle");
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    try {
      const res = await axiosBaseApi.post("user/profile/request-password-otp");
      const { data } = res.data || {};
      setOtpCountdown(30);
      dispatch({ type: TOAST_SHOW, payload: { message: `New verification code sent to your ${data?.sent_via || "email"}` } });
    } catch (e: any) {
      const msg = e.response?.data?.message || "Failed to resend code";
      dispatch({ type: TOAST_SHOW, payload: { message: msg, severity: "error" } });
    }
  };

  // Verify OTP (just store it, password is set in the form submit)
  const handleVerifyOtp = async (otp: string) => {
    if (!otp || otp.length !== 6) {
      setOtpError("Please enter a valid 6-digit code");
      return;
    }
    setOtpError("");
    // Store the OTP to send with the password
    setVerifiedOtp(otp);
    setOtpDialogOpen(false);
    setOtpStep("verified");
    dispatch({ type: TOAST_SHOW, payload: { message: "Identity verified! Now enter your new password." } });
  };

  // Submit new password with OTP
  const handleOtpPasswordSubmit = async (values: any) => {
    const { newPassword } = values;
    setSavingPassword(true);
    try {
      const res = await axiosBaseApi.post("user/profile/set-password", {
        otp: verifiedOtp,
        newPassword,
      });
      dispatch({ type: TOAST_SHOW, payload: { message: res.data?.message || "Password set successfully!" } });
      dispatch(UserAction(USER_PROFILE_FETCH));
      // Reset state
      setOtpStep("idle");
      setVerifiedOtp("");
      setFormKey((prev) => prev + 1);
    } catch (e: any) {
      const msg = e.response?.data?.message || "Failed to set password";
      dispatch({ type: TOAST_SHOW, payload: { message: msg, severity: "error" } });
      // If OTP expired, reset to idle
      if (msg.toLowerCase().includes("otp") || msg.toLowerCase().includes("expired")) {
        setOtpStep("idle");
        setVerifiedOtp("");
      }
    } finally {
      setSavingPassword(false);
    }
  };

  // Submit password change with old password (legacy flow)
  const handleOldPasswordSubmit = async (values: any) => {
    const { oldPassword, newPassword } = values;
    setSavingPassword(true);
    try {
      await axiosBaseApi.put("user/changePassword", { oldPassword, newPassword });
      dispatch({ type: TOAST_SHOW, payload: { message: "Password updated successfully!" } });
      setFormKey((prev) => prev + 1);
    } catch (e: any) {
      const msg = e.response?.data?.message || "Failed to update password";
      dispatch({ type: TOAST_SHOW, payload: { message: msg, severity: "error" } });
    } finally {
      setSavingPassword(false);
    }
  };

  const newPasswordSchema = yup.object().shape({
    newPassword: yup.string()
      .required(t("newPasswordRequired") || "New password is required")
      .test("password-validation", t("passwordComplexity") || "Password must be 8-20 characters with uppercase, lowercase, number, and special character", (value) => {
        if (!value || value.trim() === "") return true;
        return passwordRegex.test(value);
      }),
    confirmPassword: yup.string()
      .required(t("confirmPasswordRequired") || "Please confirm your new password")
      .test("password-match", t("passwordMismatch") || "Passwords do not match", function (value) {
        if (!value || value.trim() === "") return true;
        return value === this.parent.newPassword;
      }),
  });

  const oldPasswordSchema = yup.object().shape({
    oldPassword: yup.string().required(t("oldPasswordRequired") || "Current password is required"),
    newPassword: yup.string()
      .required(t("newPasswordRequired") || "New password is required")
      .test("password-validation", t("passwordComplexity") || "Password must be 8-20 characters with uppercase, lowercase, number, and special character", (value) => {
        if (!value || value.trim() === "") return true;
        return passwordRegex.test(value);
      }),
    confirmPassword: yup.string()
      .required(t("confirmPasswordRequired") || "Please confirm your new password")
      .test("password-match", t("passwordMismatch") || "Passwords do not match", function (value) {
        if (!value || value.trim() === "") return true;
        return value === this.parent.newPassword;
      }),
  });

  // Determine which mode we're in
  const useOtpFlow = !hasPassword || otpStep !== "idle";
  const title = hasPassword ? t("updatePassword") : "Set Password";
  const subtitle = hasPassword
    ? "Verify your identity via OTP to update your password"
    : "You signed up without a password. Set one now for added security.";

  const renderPasswordFields = (
    values: any,
    errors: any,
    touched: any,
    handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    handleBlur: (e: React.FocusEvent<HTMLInputElement>) => void,
  ) => (
    <>
      <Box ref={newPasswordFieldRef} sx={{ position: "relative", width: "100%" }}>
        <InputField
          data-testid="new-password-input"
          inputHeight={isMobile ? "32px" : "38px"}
          label={t("newPassword")}
          type={showNewPassword ? "text" : "password"}
          name="newPassword"
          value={values.newPassword || ""}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            handleChange(e);
            const val = e.target.value.replace(/\s/g, "");
            if (!val) setShowPasswordValidation(false);
            else if (passwordRegex.test(val)) setShowPasswordValidation(false);
            else setShowPasswordValidation(true);
          }}
          onFocus={() => {
            if (values.newPassword && !passwordRegex.test(values.newPassword)) setShowPasswordValidation(true);
          }}
          onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
            handleBlur(e);
            setTimeout(() => setShowPasswordValidation(false), 200);
          }}
          placeholder={t("newPasswordPlaceholder")}
          error={(touched.newPassword && !!errors.newPassword) || showPasswordValidation}
          helperText={touched.newPassword && errors.newPassword ? errors.newPassword : ""}
          sx={{ gap: isMobile ? "6px" : "8px" }}
          sideButton={true}
          sideButtonType="primary"
          iconBoxSize={isMobile ? "32px" : "38px"}
          sideButtonIcon={showNewPassword ? <VisibilityOffIcon sx={{ color: "#676768", height: "18px", width: "16px" }} /> : <VisibilityIcon sx={{ color: "#676768", height: "18px", width: "16px" }} />}
          sideButtonIconWidth={isMobile ? "14px" : "19px"}
          sideButtonIconHeight={isMobile ? "14px" : "19px"}
          onSideButtonClick={() => setShowNewPassword(!showNewPassword)}
          showPasswordToggle={true}
        />
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", position: "absolute", ...(isMobile && { left: "50%", transform: "translateX(-50%)", width: "100%" }), zIndex: 5 }}>
          <PasswordValidation
            password={values.newPassword || ""}
            anchorEl={newPasswordFieldRef.current}
            open={showPasswordValidation}
            onClose={() => setShowPasswordValidation(false)}
            showOnMobile={showPasswordValidation}
          />
        </Box>
      </Box>

      <Box sx={{ width: "100%" }}>
        <InputField
          data-testid="confirm-password-input"
          inputHeight={isMobile ? "32px" : "38px"}
          label={t("confirmPassword")}
          type={showConfirmPassword ? "text" : "password"}
          name="confirmPassword"
          value={values.confirmPassword || ""}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={t("confirmPasswordPlaceholder")}
          error={touched.confirmPassword && !!errors.confirmPassword}
          helperText={touched.confirmPassword && errors.confirmPassword ? errors.confirmPassword : ""}
          sx={{ gap: isMobile ? "6px" : "8px" }}
          sideButton={true}
          sideButtonType="primary"
          iconBoxSize={isMobile ? "32px" : "38px"}
          sideButtonIcon={showConfirmPassword ? <VisibilityOffIcon sx={{ color: "#676768", height: "18px", width: "16px" }} /> : <VisibilityIcon sx={{ color: "#676768", height: "18px", width: "16px" }} />}
          sideButtonIconWidth={isMobile ? "14px" : "19px"}
          sideButtonIconHeight={isMobile ? "14px" : "19px"}
          onSideButtonClick={() => setShowConfirmPassword(!showConfirmPassword)}
          showPasswordToggle={true}
        />
      </Box>
    </>
  );

  return (
    <PanelCard
      bodyPadding={isMobile ? `${theme.spacing(2, 2, 2, 2)}` : `${theme.spacing(2, 2.5, 2.5, 2.5)}`}
      title={title}
      showHeaderBorder={false}
      headerAction={
        <IconButton>
          <Lock color="action" style={{ height: "16px", width: "16px" }} />
        </IconButton>
      }
    >
      {/* Info banner */}
      <Box sx={{ mb: isMobile ? "12px" : "14px" }}>
        <InfoWrapper>
          <InfoIconBox>
            <Image src={InfoIcon.src} alt="info-icon" width={16} height={16} draggable={false} />
          </InfoIconBox>
          <InfoText data-testid="password-info-text">{subtitle}</InfoText>
        </InfoWrapper>
      </Box>

      {/* OTP Flow: Set or Update password via OTP */}
      {useOtpFlow ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: isMobile ? "12px" : "14px" }}>
          {otpStep === "idle" && (
            <Box sx={{ display: "flex", justifyContent: { xs: "stretch", sm: "flex-start" } }}>
              <CustomButton
                data-testid="request-password-otp-btn"
                label={hasPassword ? "Verify Identity to Update Password" : "Verify Identity to Set Password"}
                variant="primary"
                size={isMobile ? "small" : "medium"}
                onClick={handleRequestOtp}
                sx={{ width: { xs: "100%", sm: "auto" } }}
              />
            </Box>
          )}

          {otpStep === "otp_sent" && (
            <Typography
              data-testid="otp-sent-notice"
              sx={{ fontSize: "13px", color: theme.palette.text.secondary, fontFamily: "UrbanistMedium" }}
            >
              A verification code has been sent to {otpMaskedContact}. Please check your {otpSentVia} and enter the code.
            </Typography>
          )}

          {otpStep === "verified" && (
            <FormManager
              key={formKey}
              initialValues={{ newPassword: "", confirmPassword: "" }}
              yupSchema={newPasswordSchema}
              onSubmit={handleOtpPasswordSubmit}
            >
              {({ errors, handleBlur, handleChange, submitDisable, touched, values }) => (
                <Box sx={{ display: "flex", flexDirection: "column", gap: isMobile ? "12px" : "14px" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "6px", p: "8px 12px", borderRadius: "8px", backgroundColor: theme.palette.mode === "dark" ? "rgba(34, 197, 94, 0.1)" : "rgba(34, 197, 94, 0.08)", border: "1px solid", borderColor: theme.palette.mode === "dark" ? "rgba(34, 197, 94, 0.3)" : "rgba(34, 197, 94, 0.2)" }}>
                    <Typography sx={{ fontSize: "13px", color: theme.palette.mode === "dark" ? "#4ade80" : "#16a34a", fontFamily: "UrbanistMedium" }}>
                      Identity verified. Enter your new password below.
                    </Typography>
                  </Box>
                  {renderPasswordFields(values, errors, touched, handleChange, handleBlur)}
                  <Box sx={{ display: "flex", justifyContent: { xs: "stretch", sm: "flex-end" } }}>
                    <CustomButton
                      data-testid="set-password-submit-btn"
                      label={hasPassword ? t("update") : "Set Password"}
                      variant="primary"
                      size={isMobile ? "small" : "medium"}
                      disabled={submitDisable || !values.newPassword?.trim() || !values.confirmPassword?.trim() || savingPassword}
                      type="submit"
                      sx={{ width: { xs: "100%", sm: "auto" } }}
                    />
                  </Box>
                </Box>
              )}
            </FormManager>
          )}
        </Box>
      ) : (
        /* Legacy flow: User has password and wants to use old password method */
        <FormManager
          key={formKey}
          initialValues={{ oldPassword: "", newPassword: "", confirmPassword: "" }}
          yupSchema={oldPasswordSchema}
          onSubmit={handleOldPasswordSubmit}
        >
          {({ errors, handleBlur, handleChange, submitDisable, touched, values }) => (
            <Box sx={{ display: "flex", flexDirection: "column", gap: isMobile ? "12px" : "14px" }}>
              <InputField
                data-testid="old-password-input"
                inputHeight={isMobile ? "32px" : "38px"}
                label={t("oldPassword")}
                type={showOldPassword ? "text" : "password"}
                name="oldPassword"
                value={values.oldPassword || ""}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder={t("oldPasswordPlaceholder")}
                error={touched.oldPassword && !!errors.oldPassword}
                helperText={touched.oldPassword && errors.oldPassword ? errors.oldPassword : ""}
                sx={{ gap: isMobile ? "6px" : "8px" }}
                sideButton={true}
                sideButtonType="primary"
                iconBoxSize={isMobile ? "32px" : "38px"}
                sideButtonIcon={showOldPassword ? <VisibilityOffIcon sx={{ color: "#676768", height: "18px", width: "16px" }} /> : <VisibilityIcon sx={{ color: "#676768", height: "18px", width: "16px" }} />}
                sideButtonIconWidth={isMobile ? "14px" : "19px"}
                sideButtonIconHeight={isMobile ? "14px" : "19px"}
                onSideButtonClick={() => setShowOldPassword(!showOldPassword)}
                showPasswordToggle={true}
              />
              {renderPasswordFields(values, errors, touched, handleChange, handleBlur)}

              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <Typography
                  data-testid="use-otp-instead-link"
                  onClick={() => { setOtpStep("idle"); handleRequestOtp(); }}
                  sx={{ fontSize: "13px", color: theme.palette.primary.main, fontFamily: "UrbanistMedium", cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                >
                  Use OTP instead
                </Typography>
                <CustomButton
                  data-testid="update-password-submit-btn"
                  label={t("update")}
                  variant="primary"
                  size={isMobile ? "small" : "medium"}
                  disabled={submitDisable || !values.newPassword?.trim() || !values.confirmPassword?.trim() || savingPassword}
                  type="submit"
                  sx={{ width: { xs: "100%", sm: "auto" } }}
                />
              </Box>
            </Box>
          )}
        </FormManager>
      )}

      {/* OTP Verification Dialog */}
      <OtpDialog
        open={otpDialogOpen}
        onClose={() => setOtpDialogOpen(false)}
        title="Verify Your Identity"
        subtitle={`Enter the verification code sent to your ${otpSentVia}`}
        contactInfo={otpMaskedContact}
        contactType={otpSentVia === "phone" ? "phone" : "email"}
        resendCodeLabel="Resend Code"
        resendCodeCountdownLabel={(s) => `Code in ${s}s`}
        primaryButtonLabel="Verify"
        onResendCode={handleResendOtp}
        onVerify={handleVerifyOtp}
        onClearError={() => setOtpError("")}
        countdown={otpCountdown}
        loading={otpLoading}
        preventClose={otpCountdown > 0}
        error={otpError || undefined}
      />
    </PanelCard>
  );
};

export default UpdatePassword;
