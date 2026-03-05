import ClientIcon from "@/assets/Icons/Client-icon.svg";
import CurrencyIcon from "@/assets/Icons/Crypto-select.svg";
import HourglassIcon from "@/assets/Icons/hourglass-icon.svg";
import PaymentIcon from "@/assets/Icons/payment-icon.svg";
import RoundedStackIcon from "@/assets/Icons/roundedStck-icon.svg";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import CustomRadio from "@/Components/UI/RadioGroup";
import { theme } from "@/styles/theme";
import { PaymentSettingsBasicProps } from "@/utils/types/create-pay-link";
import { Box, FormControl, FormControlLabel, RadioGroup } from "@mui/material";
import Image from "next/image";
import React, { useState } from "react";
import { PaymentSettingsLabel } from "../../Page/CreatePaymentLink/styled";
import CurrencySelector from "../CurrencySelector";
import ExpirationDateTime from "../TimePicker/ExpirationDateTime";
import ExpireSelector from "./ExpireSelector";

const PaymentSettingsBasic: React.FC<PaymentSettingsBasicProps> = ({
  isMobile,
  tPaymentLink,
  paymentSettings,
  paymentSettingsTouched,
  paymentSettingsErrors,
  blockchainFees,
  handlePaymentSettingsChange,
  handlePaymentSettingsBlur,
  handleCurrencySelect,
  handleExpireSelect,
  handleBlockchainFeesChange,
}) => {
  const [expirationDate, setExpirationDate] = useState<Date>(
    new Date(Date.now()),
  );

  return (
    <>
      <Box
        sx={{
          width: isMobile ? "100%" : "48%",
          display: "flex",
          flexDirection: "column",
          gap: { xs: 1.5, md: 2 },
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? "12px" : "16px",
          }}
        >
          <InputField
            label={
              <PaymentSettingsLabel>
                <Image
                  src={RoundedStackIcon}
                  alt="value"
                  draggable={false}
                  style={{
                    filter: `brightness(0) saturate(100%) invert(15%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(95%) contrast(100%)`,
                  }}
                />
                <span>{tPaymentLink("value")}</span>
              </PaymentSettingsLabel>
            }
            value={paymentSettings.value}
            onChange={(e) =>
              handlePaymentSettingsChange("value", e.target.value)
            }
            onBlur={() => handlePaymentSettingsBlur("value")}
            type="number"
            inputMode="decimal"
            placeholder="10"
            error={
              paymentSettingsTouched.value &&
              Boolean(paymentSettingsErrors.value)
            }
            helperText={
              paymentSettingsTouched.value && paymentSettingsErrors.value
                ? paymentSettingsErrors.value
                : undefined
            }
            sx={{
              width: "100%",
            }}
          />

          <Box
            sx={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <PaymentSettingsLabel>
              <Image src={CurrencyIcon} alt="currency" draggable={false} />
              <span>{tPaymentLink("currency")}</span>
            </PaymentSettingsLabel>

            <CurrencySelector
              fullWidth
              name="base_currency"
              value={paymentSettings.currency || "USD"}
              onChange={(value) => handleCurrencySelect(value)}
              required
              error={
                paymentSettingsTouched.currency &&
                Boolean(paymentSettingsErrors.currency)
              }
              helperText={
                paymentSettingsTouched.currency &&
                paymentSettingsErrors.currency
                  ? paymentSettingsErrors.currency
                  : undefined
              }
            />
          </Box>
        </Box>

        <InputField
          label={
            <PaymentSettingsLabel>
              <Image
                src={ClientIcon}
                alt="clientName"
                draggable={false}
                style={{
                  filter: `brightness(0) saturate(100%) invert(15%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(95%) contrast(100%)`,
                }}
              />
              <span>{tPaymentLink("clientName")}</span>
            </PaymentSettingsLabel>
          }
          value={paymentSettings.clientName}
          onChange={(e) =>
            handlePaymentSettingsChange("clientName", e.target.value)
          }
          type="text"
          inputMode="text"
          sx={{
            width: "100%",
          }}
        />

        <Box
          sx={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <PaymentSettingsLabel>
            <Image src={HourglassIcon} alt="expire" draggable={false} />
            <span>{tPaymentLink("expire")}</span>
          </PaymentSettingsLabel>

          <ExpireSelector
            tPaymentLink={tPaymentLink}
            value={paymentSettings.expire}
            onChange={(val) => handleExpireSelect(val)}
            required
          />
        </Box>

        {paymentSettings.expire === "yes" && (
          <ExpirationDateTime
            value={expirationDate}
            onChange={(date) => setExpirationDate(date)}
          />
        )}

        <Box>
          <PaymentSettingsLabel>
            <Image src={PaymentIcon} alt="blockchain fees" draggable={false} />
            <span>{tPaymentLink("blockchainFeesPaidBy")}</span>
          </PaymentSettingsLabel>
          <Box sx={{ marginTop: { xs: "8px", md: "8px" } }}>
            <FormControl component="fieldset">
              <RadioGroup
                value={blockchainFees}
                onChange={(e) => handleBlockchainFeesChange(e.target.value)}
                sx={{
                  "& .MuiFormControlLabel-label": {
                    fontSize: { xs: "13px", md: "15px" },
                    fontFamily: "UrbanistRegular",
                    color: theme.palette.text.primary,
                    paddingLeft: "8px",
                    lineHeight: 1.2,
                  },
                  gap: { xs: "6px", md: "6px" },
                }}
              >
                <FormControlLabel
                  value="customer"
                  control={<CustomRadio />}
                  label={tPaymentLink("customerFeesAdded")}
                  sx={{ margin: "0px" }}
                />
                <FormControlLabel
                  value="company"
                  control={<CustomRadio />}
                  label={tPaymentLink("companyPaysFees")}
                  sx={{ margin: "0px" }}
                />
              </RadioGroup>
            </FormControl>
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default PaymentSettingsBasic;
