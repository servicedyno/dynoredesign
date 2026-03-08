import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  Typography,
  Popover,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useTheme,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import useIsMobile from "@/hooks/useIsMobile";
import {
  CurrencyTrigger,
  CurrencyFlag,
  CurrencyText,
  CurrencyDropdown,
} from "./styled";

// Import available flags
import unitedStatesFlag from "@/assets/Images/Icons/flags/united-states-flag.png";
import euroFlag from "@/assets/Images/Icons/flags/euro-flag.png";
import nigerianFlag from "@/assets/Images/Icons/flags/nigerian-flag.png";

// Currency data - all supported base currencies (matching backend SUPPORTED_BASE_CURRENCIES)
const currencies = [
  { code: "USD", label: "USD", flag: unitedStatesFlag, emoji: null },
  { code: "EUR", label: "EUR", flag: euroFlag, emoji: null },
  { code: "GBP", label: "GBP", flag: null, emoji: "🇬🇧" },
  { code: "AUD", label: "AUD", flag: null, emoji: "🇦🇺" },
  { code: "CAD", label: "CAD", flag: null, emoji: "🇨🇦" },
  { code: "INR", label: "INR", flag: null, emoji: "🇮🇳" },
  { code: "NGN", label: "NGN", flag: nigerianFlag, emoji: null },
  { code: "VND", label: "VND", flag: null, emoji: "🇻🇳" },
  { code: "PKR", label: "PKR", flag: null, emoji: "🇵🇰" },
  { code: "BRL", label: "BRL", flag: null, emoji: "🇧🇷" },
  { code: "ARS", label: "ARS", flag: null, emoji: "🇦🇷" },
  { code: "PHP", label: "PHP", flag: null, emoji: "🇵🇭" },
  { code: "SGD", label: "SGD", flag: null, emoji: "🇸🇬" },
  { code: "AED", label: "AED", flag: null, emoji: "🇦🇪" },
];

export interface CurrencySelectorProps {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  required?: boolean;
  name?: string;
}

const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  label,
  value = "USD",
  onChange,
  error = false,
  helperText,
  fullWidth = true,
  required = false,
  name,
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile("sm");
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (currencyCode: string) => {
    onChange?.(currencyCode);
    handleClose();
  };

  const selectedCurrency =
    currencies.find((c) => c.code === value) || currencies[0];
  const isOpen = Boolean(anchorEl);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        anchorEl &&
        !(anchorEl as HTMLElement).contains(event.target as Node)
      ) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, anchorEl]);

  const borderColor = error
    ? theme.palette.error.main
    : theme.palette.border.main;
  const focusBorderColor = error
    ? theme.palette.error.main
    : theme.palette.border.focus;

  return (
    <Box
      sx={{
        width: fullWidth ? "100%" : "auto",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      {label && (
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            fontFamily: "UrbanistMedium",
            fontSize: isMobile ? "13px" : "15px",
            textAlign: "start",
            color: "#242428",
            lineHeight: "1.2",
          }}
        >
          {label + " *"}
        </Typography>
      )}

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          width: fullWidth ? "100%" : "auto",
        }}
      >
        <CurrencyTrigger
          ref={triggerRef}
          onClick={handleOpen}
          error={error}
          fullWidth={fullWidth}
          isOpen={isOpen}
          isMobile={isMobile}
          sx={{
            borderColor: borderColor,
            borderRadius: "6px",
            "&:hover": {
              borderColor: focusBorderColor,
            },
            "&:focus": {
              borderColor: focusBorderColor,
            },
            "&:focus-visible": {
              borderColor: focusBorderColor,
            },
            "&:active": {
              borderColor: focusBorderColor,
            },
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: isMobile ? "3px" : "4px",
              flex: 1,
            }}
          >
            {selectedCurrency.flag ? (
              <CurrencyFlag
                src={selectedCurrency.flag.src}
                alt={selectedCurrency.code}
                width={isMobile ? 10 : 16}
                height={isMobile ? 10 : 16}
              />
            ) : (
              <span style={{ fontSize: isMobile ? "12px" : "16px", lineHeight: 1 }}>{selectedCurrency.emoji}</span>
            )}
            <CurrencyText isMobile={isMobile}>
              {selectedCurrency.code}
            </CurrencyText>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            {isOpen ? (
              <ExpandLessIcon
                sx={{
                  color: theme.palette.text.secondary,
                  fontSize: isMobile ? "18px" : "20px",
                }}
              />
            ) : (
              <ExpandMoreIcon
                sx={{
                  color: theme.palette.text.secondary,
                  fontSize: isMobile ? "18px" : "20px",
                }}
              />
            )}
          </Box>
        </CurrencyTrigger>

        <Popover
          anchorEl={anchorEl}
          open={isOpen}
          onClose={handleClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          transformOrigin={{ vertical: "top", horizontal: "left" }}
          PaperProps={{
            sx: {
              mt: "2px",
              borderRadius: "6px",
              overflow: "hidden",
              fontFamily: "UrbanistMedium",
              width: triggerRef.current?.offsetWidth || "auto",
              border: `1px solid ${borderColor}`,
              borderTop: "none",
              maxHeight: "280px",
              backgroundColor: theme.palette.background.paper,
              boxShadow: "0px 4px 16px 0px rgba(47, 47, 101, 0.15)",
            },
          }}
        >
          <CurrencyDropdown>
            {currencies.map((currency) => (
              <ListItemButton
                key={currency.code}
                onClick={() => handleSelect(currency.code)}
                selected={currency.code === value}
                sx={{
                  maxHeight: "32px",
                  borderRadius: "50px",
                  lineHeight: 1.2,
                  p: "8px",
                  gap: isMobile ? "3px" : "4px",
                  background:
                    currency.code === value
                      ? theme.palette.primary.light
                      : "transparent",
                  "&:hover": {
                    background: theme.palette.primary.light,
                  },
                  "&.Mui-selected": {
                    background: theme.palette.primary.light,
                    "&:hover": {
                      background: theme.palette.primary.light,
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: "fit-content" }}>
                  {currency.flag ? (
                    <CurrencyFlag
                      src={currency.flag.src}
                      alt={currency.code}
                      width={16}
                      height={16}
                    />
                  ) : (
                    <span style={{ fontSize: "16px", lineHeight: 1 }}>{currency.emoji}</span>
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={currency.code}
                  primaryTypographyProps={{
                    sx: {
                      fontFamily: "UrbanistMedium",
                      fontWeight: 500,
                      fontSize: isMobile ? "10px" : "13px",
                      color: theme.palette.text.primary,
                      lineHeight: 1.2,
                    },
                  }}
                />
              </ListItemButton>
            ))}
          </CurrencyDropdown>
        </Popover>

        {helperText && (
          <Typography
            sx={{
              margin: "4px 0 0 0",
              fontSize: isMobile ? "10px" : "13px",
              fontWeight: 500,
              color: error
                ? theme.palette.error.main
                : theme.palette.text.secondary,
              lineHeight: 1.2,
              textAlign: "start",
            }}
          >
            {helperText}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default CurrencySelector;
