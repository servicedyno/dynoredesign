import useIsMobile from "@/hooks/useIsMobile";
import CheckIcon from "@mui/icons-material/Check";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Box,
  ListItemButton,
  ListItemText,
  Typography,
  useTheme,
} from "@mui/material";
import React, { useEffect, useRef, useState } from "react";
import {
  CryptocurrencyDividerLine,
  CryptocurrencyIcon,
  CryptocurrencyText,
  CryptocurrencyTrigger,
  IconChip,
} from "./styled";

import { useWalletData } from "@/hooks/useWalletData";
import { CryptocurrencySelectorProps } from "@/utils/types/wallet";

// export const cryptocurrencies: Cryptocurrency[] = [
//   { code: "BTC", name: "Bitcoin", icon: BitcoinIcon },
//   { code: "ETH", name: "Ethereum", icon: EthereumIcon },
//   { code: "LTC", name: "Litecoin", icon: LitecoinIcon },
//   { code: "BNB", name: "BNB", icon: BNBIcon },
//   { code: "DOGE", name: "Dogecoin", icon: DogecoinIcon },
//   { code: "BCH", name: "Bitcoin Cash", icon: BitcoinCashIcon },
//   { code: "TRX", name: "Tron", icon: TronIcon },
//   { code: "USDT", name: "USDT", icon: USDTIcon },
// ];

const CryptocurrencySelector: React.FC<CryptocurrencySelectorProps> = ({
  label,
  value = "",
  onChange,
  error = false,
  helperText,
  fullWidth = true,
  required = false,
  sx,
  closeDropdownTrigger,
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile("sm");
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const { cryptocurrencies } = useWalletData();

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (cryptoCode: string) => {
    onChange?.(cryptoCode);
    handleClose();
  };

  const selectedCrypto = cryptocurrencies.find((c) => c.code === value) || {
    value: "",
    name: "",
    icon: null,
    code: "",
  };
  const isOpen = Boolean(anchorEl);

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

  useEffect(() => {
    if (closeDropdownTrigger) {
      setAnchorEl(null);
    }
  }, [closeDropdownTrigger]);

  return (
    <Box
      sx={{
        width: fullWidth ? "100%" : "auto",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        ...sx,
      }}
    >
      {label && (
        <Typography
          sx={{
            fontWeight: 500,
            fontSize: isMobile ? "13px" : "15px",
            color: theme.palette.text.primary,
            fontFamily: "UrbanistMedium",
            lineHeight: "1.2",
            letterSpacing: "0",
          }}
        >
          {label}
          {required && <span style={{ marginLeft: 4 }}>*</span>}
        </Typography>
      )}

      {/* Wrapper */}
      <Box
        sx={{
          position: "relative",
          width: fullWidth ? "100%" : isMobile ? "154px" : "300px",
        }}
      >
        {/* ===== Trigger ===== */}
        <CryptocurrencyTrigger onClick={handleOpen}>
          {value === "" ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <CryptocurrencyText
                style={{ color: theme.palette.text.disabled }}
              >
                Bitcoin (BTC)
              </CryptocurrencyText>
            </Box>
          ) : (
            <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <IconChip
                sx={{
                  minWidth: "fit-content",
                  height: isMobile ? "25px" : "30px",
                }}
              >
                <CryptocurrencyIcon
                  src={selectedCrypto.icon}
                  alt={selectedCrypto.name}
                  width={isMobile ? 14 : 20}
                  height={isMobile ? 14 : 20}
                />
                <span>{selectedCrypto.code}</span>
              </IconChip>
              <CryptocurrencyText>{selectedCrypto.name}</CryptocurrencyText>
            </Box>
          )}

          <Box sx={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <CryptocurrencyDividerLine />
            {!isOpen ? (
              <ExpandMoreIcon
                sx={{
                  fontSize: isMobile ? "16px" : "22px",
                  color: theme.palette.text.secondary,
                }}
              />
            ) : (
              <ExpandLessIcon
                sx={{
                  fontSize: isMobile ? "16px" : "22px",
                  color: theme.palette.text.secondary,
                }}
              />
            )}
          </Box>
        </CryptocurrencyTrigger>

        {/* ===== Dropdown ===== */}
        {isOpen && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              width: "100%",
              border: `1px solid ${borderColor}`,
              borderRadius: "6px",
              backgroundColor: "#fff",
              padding: "10px 14px",
              zIndex: 100,
              boxShadow: "0px 8px 24px rgba(0,0,0,0.08)",
            }}
          >
            {/* ===== Header (duplicate trigger) ===== */}
            <Box
              onClick={handleClose}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <CryptocurrencyText>
                  {value === ""
                    ? "Bitcoin (BTC)"
                    : `${selectedCrypto.name} (${value})`}
                </CryptocurrencyText>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <CryptocurrencyDividerLine />
                <ExpandLessIcon
                  sx={{
                    fontSize: isMobile ? "16px" : "22px",
                    color: theme.palette.text.secondary,
                  }}
                />
              </Box>
            </Box>

            {/* ===== Content ===== */}
            <Box
              sx={{
                mt: isMobile ? "10px" : "12px",
                display: "flex",
                flexDirection: "column",
                gap: isMobile ? "4px" : "6px",
                maxHeight: isMobile ? "111px" : "128px",
                overflow: "auto",
              }}
            >
              {cryptocurrencies.map((crypto) => (
                <ListItemButton
                  key={crypto.code}
                  onClick={() => {
                    handleSelect(crypto.code);
                    handleClose();
                  }}
                  sx={{
                    borderRadius: "50px",
                    p: isMobile ? "6px 14px 6px 5px" : "3px 12px 3px 3px",
                    gap: isMobile ? 1 : 1.5,
                    minHeight: isMobile ? "35px" : "40px",
                    fontFamily: "UrbanistMedium",
                    lineHeight: "1.2",
                    letterSpacing: "0",
                    background:
                      crypto.code === value
                        ? theme.palette.primary.light
                        : "transparent",
                    "&:hover": {
                      background: theme.palette.primary.light,
                    },
                  }}
                >
                  <IconChip sx={{ minWidth: "fit-content" }}>
                    <CryptocurrencyIcon
                      src={crypto.icon}
                      alt={crypto.name}
                      width={isMobile ? 14 : 20}
                      height={isMobile ? 14 : 20}
                    />
                    <span>{crypto.code}</span>
                  </IconChip>

                  <ListItemText
                    primary={crypto.name}
                    primaryTypographyProps={{
                      sx: {
                        fontWeight: 500,
                        fontSize: isMobile ? "10px" : "15px",
                        fontFamily: "UrbanistMedium",
                        lineHeight: "1.2",
                        letterSpacing: "0",
                      },
                    }}
                  />

                  {crypto.code === value && (
                    <CheckIcon
                      sx={{ fontSize: isMobile ? 15 : 18, ml: "auto" }}
                    />
                  )}
                </ListItemButton>
              ))}
            </Box>
          </Box>
        )}
      </Box>

      {helperText && (
        <Typography
          sx={{
            fontSize: isMobile ? "10px" : "13px",
            color: error
              ? theme.palette.error.main
              : theme.palette.text.secondary,
          }}
        >
          {helperText}
        </Typography>
      )}
    </Box>
  );
};

export default CryptocurrencySelector;
