import CloseIcon from "@/assets/Icons/close-icon.svg";
import EnvelopeIcon from "@/assets/Icons/envelope-icon.svg";
import ArrowUpwardIcon from "@/assets/Icons/up-arrow-icon.png";
import FormManager from "@/Components/Page/Common/FormManager";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import CustomButton from "@/Components/UI/Buttons";
import PanelCard from "@/Components/UI/PanelCard";
import PopupModal from "@/Components/UI/PopupModal";
import useIsMobile from "@/hooks/useIsMobile";
import { Info } from "@mui/icons-material";
import { Box, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import * as yup from "yup";
import { DialogCloseButton } from "./styled";

export interface OtpDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  contactInfo?: string;
  contactType?: "email" | "phone";
  otpLength?: number;
  resendCodeLabel?: string;
  resendCodeCountdownLabel?: (seconds: number) => string;
  primaryButtonLabel?: string;
  onResendCode?: () => void;
  onVerify?: (otp: string) => void;
  onClearError?: () => void;
  countdown?: number;
  loading?: boolean;
  error?: string;
  preventClose?: boolean;
}

type OtpFieldName = `otp${number}`;

type OtpFormValues = Partial<Record<OtpFieldName, string>>;

const generateOtpInitial = (length: number): OtpFormValues => {
  const initial: OtpFormValues = {};
  for (let i = 1; i <= length; i++) {
    const fieldName = `otp${i}` as OtpFieldName;
    initial[fieldName] = "";
  }
  return initial;
};

const OtpDialog: React.FC<OtpDialogProps> = ({
  open,
  onClose,
  title,
  subtitle,
  contactInfo = "",
  contactType = "email",
  otpLength = 6,
  resendCodeLabel,
  resendCodeCountdownLabel,
  primaryButtonLabel,
  onResendCode,
  onVerify,
  onClearError,
  countdown = 0,
  loading = false,
  error,
  preventClose = false,
}) => {
  const { t } = useTranslation("auth");
  const theme = useTheme();
  const isMobile = useIsMobile("sm");
  const otpInitial = React.useMemo(
    () => generateOtpInitial(otpLength),
    [otpLength],
  );
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const previousOtpRef = useRef<string>("");
  const formValuesRef = useRef<OtpFormValues | null>(null);
  const isSubmittingRef = useRef<boolean>(false);

  const dialogTitle = title || t("emailVerification");
  const dialogSubtitle = subtitle;
  const dialogResendCodeLabel = resendCodeLabel || t("resendCode");
  const dialogResendCodeCountdownLabel =
    resendCodeCountdownLabel ||
    ((seconds: number) => `${t("codeIn")} ${seconds}s`);
  const dialogPrimaryButtonLabel = primaryButtonLabel || t("checkAndAdd");

  const inputSize = isMobile ? "32px" : "40px";

  const otpSchema = React.useMemo(() => {
    const shape: Record<OtpFieldName, yup.StringSchema<string>> = {} as Record<
      OtpFieldName,
      yup.StringSchema<string>
    >;
    for (let i = 1; i <= otpLength; i++) {
      const fieldName = `otp${i}` as OtpFieldName;
      shape[fieldName] = yup
        .string()
        .required(t("required"))
        .matches(/^[0-9]$/, t("mustBeNumeric") || "Must be a single digit");
    }
    return yup.object().shape(shape);
  }, [otpLength, t]);

  useEffect(() => {
    if (!open) {
      inputRefs.current = [];
      previousOtpRef.current = "";
      isSubmittingRef.current = false;
      return;
    }

    previousOtpRef.current = "";
    isSubmittingRef.current = false;

    const focusFirst = () => {
      const firstInput = inputRefs.current[0];
      if (firstInput) {
        firstInput.focus();
      }
    };

    if (typeof window !== "undefined") {
      const animationFrameId = window.requestAnimationFrame(focusFirst);
      return () => {
        window.cancelAnimationFrame(animationFrameId);
      };
    }

    focusFirst();
  }, [open, otpInitial]);

  useEffect(() => {
    if (error) {
      previousOtpRef.current = "";
      isSubmittingRef.current = false;
    }
  }, [error]);

  const buildOtpFromValues = React.useCallback(
    (values: OtpFormValues): string => {
      const digits: string[] = [];
      for (let i = 1; i <= otpLength; i++) {
        const fieldName = `otp${i}` as OtpFieldName;
        const value = (values[fieldName] ?? "").trim();
        digits.push(value);
      }
      return digits.join("");
    },
    [otpLength],
  );

  const isOtpComplete = React.useCallback(
    (values: OtpFormValues): boolean => {
      for (let i = 1; i <= otpLength; i++) {
        const fieldName = `otp${i}` as OtpFieldName;
        const value = (values[fieldName] ?? "").trim();
        if (!/^\d$/.test(value)) {
          return false;
        }
      }
      return true;
    },
    [otpLength],
  );

  const validateOtp = React.useCallback(
    (values: OtpFormValues): { isValid: boolean; otp: string } => {
      const otp = buildOtpFromValues(values);

      if (otp.length !== otpLength) {
        return { isValid: false, otp };
      }

      if (!/^\d+$/.test(otp)) {
        return { isValid: false, otp };
      }

      if (!isOtpComplete(values)) {
        return { isValid: false, otp };
      }

      return { isValid: true, otp };
    },
    [buildOtpFromValues, isOtpComplete, otpLength],
  );

  const submitOtp = React.useCallback(
    (otp: string) => {
      const trimmedOtp = otp.trim();
      if (!trimmedOtp) {
        return;
      }
      if (isSubmittingRef.current) {
        return;
      }
      if (trimmedOtp === previousOtpRef.current) {
        return;
      }
      if (onVerify) {
        isSubmittingRef.current = true;
        previousOtpRef.current = trimmedOtp;
        onVerify(trimmedOtp);
      }
    },
    [onVerify],
  );

  const attemptAutoSubmit = React.useCallback(
    (values: OtpFormValues, submitDisable: boolean, loadingFlag: boolean) => {
      if (submitDisable || loadingFlag) {
        return;
      }
      const { isValid, otp } = validateOtp(values);
      if (!isValid) {
        previousOtpRef.current = "";
        isSubmittingRef.current = false;
        return;
      }
      submitOtp(otp);
    },
    [submitOtp, validateOtp],
  );

  const handleOtpChange = React.useCallback(
    (
      index: number,
      value: string,
      handleChange: (event: React.ChangeEvent<HTMLInputElement>) => void,
      values: OtpFormValues,
      submitDisable: boolean,
      loadingFlag: boolean,
    ) => {
      const numericValue = value.replace(/\D/g, "");

      const fieldName = `otp${index + 1}` as OtpFieldName;

      if (numericValue.length === 0 && value === "") {
        const clearEvent = {
          target: {
            name: fieldName,
            value: "",
          },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        handleChange(clearEvent);
        if (error && onClearError) {
          onClearError();
        }
        previousOtpRef.current = "";
        isSubmittingRef.current = false;
        return;
      }

      if (numericValue.length === 0) {
        return;
      }

      const singleDigit = numericValue.slice(-1);

      const updatedValues: OtpFormValues = {
        ...values,
        [fieldName]: singleDigit,
      };

      const changeEvent = {
        target: {
          name: fieldName,
          value: singleDigit,
        },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleChange(changeEvent);

      if (error && onClearError) {
        onClearError();
      }

      if (numericValue.length > 1) {
        const remainingDigits = numericValue.slice(1);
        remainingDigits.split("").forEach((digit, idx) => {
          const nextIndex = index + idx + 1;
          if (nextIndex < otpLength) {
            const nextFieldName = `otp${nextIndex + 1}` as OtpFieldName;
            updatedValues[nextFieldName] = digit;
            const nextEvent = {
              target: {
                name: nextFieldName,
                value: digit,
              },
            } as unknown as React.ChangeEvent<HTMLInputElement>;
            handleChange(nextEvent);
          }
        });

        const lastFilledIndex = Math.min(
          index + numericValue.length - 1,
          otpLength - 1,
        );
        const nextField = inputRefs.current[lastFilledIndex];
        if (nextField) {
          const focusIndex = lastFilledIndex;
          if (typeof window !== "undefined") {
            window.requestAnimationFrame(() => {
              nextField.focus();
            });
          } else {
            nextField.focus();
          }
        }
      } else if (singleDigit && index < otpLength - 1) {
        const nextField = inputRefs.current[index + 1];
        if (nextField) {
          const focusIndex = index + 1;
          if (typeof window !== "undefined") {
            window.requestAnimationFrame(() => {
              nextField.focus();
            });
          } else {
            nextField.focus();
          }
        }
      }

      if (isOtpComplete(updatedValues)) {
        attemptAutoSubmit(updatedValues, submitDisable, loadingFlag);
      } else {
        previousOtpRef.current = "";
        isSubmittingRef.current = false;
      }
    },
    [attemptAutoSubmit, error, isOtpComplete, onClearError, otpLength],
  );

  const handleOtpBlur = (
    fieldName: OtpFieldName,
    handleBlur: (event: React.FocusEvent<HTMLInputElement>) => void,
  ) => {
    const blurEvent = {
      target: {
        name: fieldName,
      },
    } as unknown as React.FocusEvent<HTMLInputElement>;
    handleBlur(blurEvent);
  };

  const handleKeyDown = React.useCallback(
    (
      index: number,
      e: React.KeyboardEvent<HTMLInputElement>,
      values: OtpFormValues,
      handleChange: (event: React.ChangeEvent<HTMLInputElement>) => void,
      submitDisable: boolean,
      loadingFlag: boolean,
    ) => {
      const fieldName = `otp${index + 1}` as OtpFieldName;
      const currentValue = values[fieldName];

      if (e.key === "ArrowLeft" && index > 0) {
        e.preventDefault();
        const prevField = inputRefs.current[index - 1];
        if (prevField) {
          prevField.focus();
        }
        return;
      }

      if (e.key === "ArrowRight" && index < otpLength - 1) {
        e.preventDefault();
        const nextField = inputRefs.current[index + 1];
        if (nextField) {
          nextField.focus();
        }
        return;
      }

      if (e.key === "Backspace") {
        if (!currentValue && index > 0) {
          e.preventDefault();
          const prevField = inputRefs.current[index - 1];
          const prevFieldName = `otp${index}` as OtpFieldName;
          const clearEvent = {
            target: {
              name: prevFieldName,
              value: "",
            },
          } as unknown as React.ChangeEvent<HTMLInputElement>;
          handleChange(clearEvent);
          if (prevField) {
            prevField.focus();
          }
        } else if (currentValue) {
          const clearEvent = {
            target: {
              name: fieldName,
              value: "",
            },
          } as unknown as React.ChangeEvent<HTMLInputElement>;
          handleChange(clearEvent);
        }
        return;
      }

      if (e.key === "Delete") {
        e.preventDefault();
        const clearEvent = {
          target: {
            name: fieldName,
            value: "",
          },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        handleChange(clearEvent);
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        attemptAutoSubmit(values, submitDisable, loadingFlag);
        return;
      }

      if (
        !/^[0-9]$/.test(e.key) &&
        ![
          "Backspace",
          "Delete",
          "ArrowLeft",
          "ArrowRight",
          "Tab",
          "Enter",
          "Control",
          "v",
          "V",
        ].includes(e.key)
      ) {
        e.preventDefault();
      }
    },
    [attemptAutoSubmit, otpLength],
  );

  const handlePaste = React.useCallback(
    (
      e: React.ClipboardEvent<HTMLInputElement | HTMLDivElement>,
      handleFieldsChange: (updates: Partial<OtpFormValues>) => void,
      values: OtpFormValues,
      startIndex: number,
      submitDisable: boolean,
      loadingFlag: boolean,
    ) => {
      const pastedData = e.clipboardData.getData("text");
      const numericValue = pastedData.replace(/\D/g, "");
      if (numericValue.length === 0) {
        return;
      }

      if (error && onClearError) {
        onClearError();
      }

      const currentValues = formValuesRef.current || values;
      let fillIndex = startIndex;
      const startField = currentValues[`otp${fillIndex + 1}` as OtpFieldName];
      if (startField && String(startField).trim().length > 0) {
        for (let i = startIndex; i < otpLength; i++) {
          const fieldName = `otp${i + 1}` as OtpFieldName;
          if (
            !currentValues[fieldName] ||
            String(currentValues[fieldName]).trim().length === 0
          ) {
            fillIndex = i;
            break;
          }
        }
      }

      const digits = numericValue.split("").filter((d) => /^\d$/.test(d));
      if (digits.length === 0) {
        return;
      }

      const updatedValues: OtpFormValues = { ...currentValues };
      let lastIndex = fillIndex - 1;
      digits.forEach((digit) => {
        if (fillIndex < otpLength) {
          const fieldName = `otp${fillIndex + 1}` as OtpFieldName;
          updatedValues[fieldName] = digit;
          lastIndex = fillIndex;
          fillIndex += 1;
        }
      });

      const partial: Partial<OtpFormValues> = {};
      for (let i = startIndex; i <= lastIndex; i++) {
        partial[`otp${i + 1}` as OtpFieldName] =
          updatedValues[`otp${i + 1}` as OtpFieldName];
      }
      handleFieldsChange(partial);
      formValuesRef.current = updatedValues;

      const allFilled = isOtpComplete(updatedValues);

      let nextFocusIndex = lastIndex;
      if (!allFilled) {
        for (let i = lastIndex + 1; i < otpLength; i++) {
          const fieldName = `otp${i + 1}` as OtpFieldName;
          if (
            !updatedValues[fieldName] ||
            String(updatedValues[fieldName]).trim().length === 0
          ) {
            nextFocusIndex = i;
            break;
          }
        }
      } else {
        nextFocusIndex = otpLength - 1;
      }

      const nextField = inputRefs.current[nextFocusIndex];
      if (nextField) {
        const focusIndex = nextFocusIndex;
        if (typeof window !== "undefined") {
          window.requestAnimationFrame(() => {
            nextField.focus();
            nextField.select();
          });
        } else {
          nextField.focus();
          nextField.select();
        }
      }

      if (allFilled) {
        attemptAutoSubmit(updatedValues, submitDisable, loadingFlag);
      } else {
        previousOtpRef.current = "";
        isSubmittingRef.current = false;
      }
    },
    [attemptAutoSubmit, error, isOtpComplete, onClearError, otpLength],
  );

  const handleSubmit = (values: OtpFormValues) => {
    attemptAutoSubmit(values, false, loading);
  };

  const handleClose = () => {
    if (!preventClose) {
      onClose();
    }
  };

  return (
    <PopupModal
      open={open}
      handleClose={handleClose}
      showHeader={false}
      transparent
      role="dialog"
      aria-modal="true"
      disableEscapeKeyDown={preventClose}
      onClose={(reason) => {
        if (preventClose) {
          return;
        }
        if (reason === "backdropClick" || reason === "escapeKeyDown") {
          onClose();
        }
      }}
      sx={{
        "& .MuiDialog-paper": {
          borderRadius: "14px",
          maxWidth: isMobile ? "358px" : "495px",
          width: "100%",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          margin: 0,
          position: "fixed",
        },
      }}
    >
      <PanelCard
        title={dialogTitle}
        headerIcon={
          contactType === "email" ? (
            <Image
              src={EnvelopeIcon}
              alt="email icon"
              width={isMobile ? 18 : 24}
              height={isMobile ? 11 : 24}
              draggable={false}
            />
          ) : undefined
        }
        headerAction={
          <DialogCloseButton
            onClick={handleClose}
            sx={{
              position: "absolute",
              right: isMobile ? "-16px" : "-30px",
              top: isMobile ? "-16px" : "-30px",
              cursor: preventClose ? "not-allowed" : "pointer",
              opacity: preventClose ? 0.5 : 1,
            }}
          >
            <Image
              src={CloseIcon.src}
              alt="close icon"
              width={isMobile ? 10 : 16}
              height={isMobile ? 10 : 16}
              draggable={false}
            />
          </DialogCloseButton>
        }
        showHeaderBorder={false}
        bodyPadding="0"
        headerPadding="0 !important"
        sx={{
          backgroundColor: "#FFFFFF",
          borderRadius: "14px",
          padding: "30px",
          boxShadow: "none",
          outline: "none",
          [theme.breakpoints.down("sm")]: {
            padding: "16px",
          },
        }}
        bodySx={{
          padding: "0",
        }}
      >
        {/* Subtitle */}
        <Typography
          sx={{
            fontSize: isMobile ? "13px" : "15px",
            color: theme.palette.text.secondary,
            fontFamily: "UrbanistMedium",
            marginBottom: isMobile ? "14px" : "16px",
            marginTop: isMobile ? "10px" : "12px",
            lineHeight: "1.2",
            letterSpacing: 0,
          }}
        >
          {dialogSubtitle}
        </Typography>

        {/* Info Message Box */}
        {contactInfo && (
          <Box
            sx={{
              backgroundColor: theme.palette.secondary.main,
              borderRadius: "6px",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              border: `1px solid ${theme.palette.border.main}`,
              marginBottom: "14px",
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            <Info
              sx={{
                color: theme.palette.primary.main,
                fontSize: "18px",
                width: "16px",
                height: "16px",
              }}
            />
            <Typography
              sx={{
                fontSize: "15px",
                color: theme.palette.primary.main,
                fontFamily: "UrbanistMedium",
                lineHeight: "1",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
                minWidth: 0,
                [theme.breakpoints.down("sm")]: {
                  fontSize: "13px",
                },
              }}
            >
              {t("codeSentTo")}{" "}
              <span style={{ fontWeight: 600, fontFamily: "UrbanistBold" }}>
                {contactInfo}
              </span>
            </Typography>
          </Box>
        )}

        {/* OTP Input Fields */}
        <FormManager
          initialValues={otpInitial}
          yupSchema={otpSchema}
          onSubmit={handleSubmit}
        >
          {({
            handleBlur,
            handleChange,
            submitDisable,
            values,
            handleFieldsChange,
          }) => {
            formValuesRef.current = values;

            const areAllFieldsFilled = isOtpComplete(values);
            const { isValid } = validateOtp(values);

            return (
              <>
                <Box sx={{ marginBottom: isMobile ? "14px" : "16px" }}>
                  <Typography
                    sx={{
                      fontSize: isMobile ? "13px" : "15px",
                      fontWeight: 500,
                      lineHeight: "1.2",
                      letterSpacing: 0,
                      color: theme.palette.text.primary,
                      fontFamily: "UrbanistMedium",
                      marginBottom: "6px",
                    }}
                  >
                    {t("verificationCode")} *
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      gap: isMobile ? "4px" : "6px",
                      justifyContent: "flex-start",
                    }}
                  >
                    {Array.from({ length: otpLength }).map((_, index) => {
                      const fieldName = `otp${index + 1}` as OtpFieldName;
                      const valueForField = values[fieldName] ?? "";
                      const hasValue =
                        typeof valueForField === "string" &&
                        valueForField.length > 0;
                      const hasError = !!error;

                      return (
                        <Box
                          key={fieldName}
                          sx={{
                            width: inputSize,
                            minWidth: inputSize,
                            maxWidth: inputSize,
                            userSelect: "none",
                            WebkitUserSelect: "none",
                            MozUserSelect: "none",
                            msUserSelect: "none",
                          }}
                        >
                          <InputField
                            value={values[fieldName] || ""}
                            name={fieldName}
                            type="text"
                            ariaLabel={`OTP digit ${index + 1} of ${otpLength}`}
                            ariaInvalid={Boolean(error)}
                            onChange={(e) => {
                              const inputValue = e.target.value;

                              handleOtpChange(
                                index,
                                inputValue,
                                handleChange,
                                values,
                                submitDisable,
                                loading,
                              );
                            }}
                            onBlur={() => {
                              handleOtpBlur(fieldName, handleBlur);
                            }}
                            onKeyDown={(e) =>
                              handleKeyDown(
                                index,
                                e,
                                values,
                                handleChange,
                                submitDisable,
                                loading,
                              )
                            }
                            onPaste={(e) => {
                              handlePaste(
                                e,
                                handleFieldsChange,
                                values,
                                index,
                                submitDisable,
                                loading,
                              );
                            }}
                            autoComplete="off"
                            error={hasError}
                            success={Boolean(hasValue && !hasError)}
                            fullWidth
                            maxLength={1}
                            inputMode="numeric"
                            inputHeight={inputSize}
                            inputRef={(el: HTMLInputElement | null) => {
                              inputRefs.current[index] = el;
                            }}
                            sx={{
                              "& .MuiOutlinedInput-root": {
                                borderRadius: "6px !important",
                                backgroundColor: "#fff !important",
                                "& fieldset": {
                                  borderColor:
                                    theme.palette.border.main + " !important",
                                  borderWidth: "1px",
                                },
                                "&:hover fieldset": {
                                  borderColor:
                                    theme.palette.primary.main + " !important",
                                },
                                "&.Mui-focused fieldset": {
                                  borderColor:
                                    theme.palette.primary.main + " !important",
                                  borderWidth: "1px",
                                },
                              },
                              "& .MuiInputBase-input": {
                                textAlign: "center",
                                fontSize: isMobile ? "18px" : "20px",
                                fontWeight: 600,
                                fontFamily: "UrbanistBold",
                                padding: "0 !important",
                                letterSpacing: "0.5px",
                                color: "#242428",
                                height: "100%",
                                lineHeight: inputSize,
                              },
                            }}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                  {error && (
                    <Typography
                      sx={{
                        fontSize: "12px",
                        color: "#d32f2f",
                        marginTop: "8px",
                        fontFamily: "UrbanistMedium",
                      }}
                    >
                      {error}
                    </Typography>
                  )}
                </Box>

                {/* Action Buttons */}
                <Box
                  sx={{
                    display: "flex",
                    gap: "12px",
                    justifyContent: "space-between",
                  }}
                >
                  {/* Resend Code Button */}
                  <CustomButton
                    variant="secondary"
                    size={isMobile ? "small" : "medium"}
                    label={
                      countdown > 0
                        ? dialogResendCodeCountdownLabel(countdown)
                        : dialogResendCodeLabel
                    }
                    onClick={() => {
                      if (onResendCode) {
                        onResendCode();
                      }
                    }}
                    disabled={countdown > 0 || loading}
                    endIcon={
                      countdown > 0 || loading ? undefined : ArrowUpwardIcon
                    }
                    type="button"
                    sx={{
                      fontWeight: 500,
                      padding: "11px 20px",
                      flex: 1,
                      fontSize: isMobile ? "13px" : "15px",
                      [theme.breakpoints.down("sm")]: {
                        fontSize: "13px",
                        padding: "10px 16px",
                      },
                    }}
                  />

                  {/* Primary Action Button */}
                  <CustomButton
                    variant="primary"
                    size={isMobile ? "small" : "medium"}
                    label={dialogPrimaryButtonLabel}
                    type="submit"
                    disabled={
                      submitDisable ||
                      loading ||
                      !areAllFieldsFilled ||
                      !isValid
                    }
                    sx={{
                      fontWeight: 700,
                      padding: "15px 24px",
                      flex: 1,
                      fontSize: isMobile ? "13px" : "15px",
                      [theme.breakpoints.down("sm")]: {
                        fontSize: "13px",
                        padding: "12px 20px",
                      },
                    }}
                  />
                </Box>
              </>
            );
          }}
        </FormManager>
      </PanelCard>
    </PopupModal>
  );
};

export default OtpDialog;
