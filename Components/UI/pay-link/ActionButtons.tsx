import CustomButton from "@/Components/UI/Buttons";
import { theme } from "@/styles/theme";
import { ActionButtonsProps } from "@/utils/types/create-pay-link";
import { useRouter } from "next/router";
import React from "react";

const ActionButtons: React.FC<ActionButtonsProps> = ({
  hasPaymentLinkData,
  disabled,
  tPaymentLink,
  handleCreatePaymentLink,
  paymentSettingsErrors,
  paymentSettings,
}) => {
  const router = useRouter();

  return (
    <>
      {hasPaymentLinkData && (
        <CustomButton
          label={disabled ? tPaymentLink("back") : tPaymentLink("cancel")}
          variant={disabled ? "primary" : "outlined"}
          size="medium"
          fullWidth={true}
          onClick={() => router.back()}
          sx={{
            [theme.breakpoints.down("md")]: {
              height: "32px",
              fontSize: "13px",
            },
          }}
        />
      )}
      {!disabled && (
        <CustomButton
          label={tPaymentLink(hasPaymentLinkData ? "saveChanges" : "continue")}
          variant="primary"
          size="medium"
          fullWidth={true}
          onClick={handleCreatePaymentLink}
          disabled={
            Boolean(paymentSettingsErrors.value) ||
            Boolean(paymentSettingsErrors.currency) ||
            Boolean(paymentSettingsErrors.description) ||
            !paymentSettings.value ||
            paymentSettings.value.trim() === "" ||
            !paymentSettings.currency
          }
          sx={{
            [theme.breakpoints.down("md")]: {
              height: "32px",
              fontSize: "13px",
            },
          }}
        />
      )}
    </>
  );
};

export default ActionButtons;
