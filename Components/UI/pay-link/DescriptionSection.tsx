import InputField from "@/Components/UI/AuthLayout/InputFields";
import NoteIcon from "@/assets/Icons/note-icon.svg";
import { DescriptionSectionProps } from "@/utils/types/create-pay-link";
import Image from "next/image";
import React from "react";
import { PaymentSettingsLabel } from "../../Page/CreatePaymentLink/styled";

const DescriptionSection: React.FC<DescriptionSectionProps> = ({
  isMobile,
  tPaymentLink,
  paymentSettings,
  paymentSettingsTouched,
  paymentSettingsErrors,
  handlePaymentSettingsChange,
  handlePaymentSettingsBlur,
}) => (
  <InputField
    label={
      <PaymentSettingsLabel>
        <Image src={NoteIcon} alt="note" draggable={false} />
        <span>{tPaymentLink("description")}</span>
      </PaymentSettingsLabel>
    }
    value={paymentSettings.description}
    onChange={(e) => handlePaymentSettingsChange("description", e.target.value)}
    onBlur={() => handlePaymentSettingsBlur("description")}
    error={
      paymentSettingsTouched.description &&
      Boolean(paymentSettingsErrors.description)
    }
    helperText={
      paymentSettingsTouched.description && paymentSettingsErrors.description
        ? paymentSettingsErrors.description
        : undefined
    }
    maxLength={500}
    sx={{ width: "100%" }}
    multiline={true}
    minRows={isMobile ? 4 : 9}
  />
);

export default DescriptionSection;
