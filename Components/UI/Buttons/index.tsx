import useIsMobile from "@/hooks/useIsMobile";
import { theme } from "@/styles/theme";
import { Box, Button as MuiButton, Typography } from "@mui/material";
import { SxProps, Theme } from "@mui/system";
import Image, { StaticImageData } from "next/image";
import React from "react";

export interface CustomButtonProps {
  label: string;
  variant?: "primary" | "secondary" | "outlined" | "danger";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  fullWidth?: boolean;
  startIcon?: React.ReactNode | StaticImageData;
  endIcon?: React.ReactNode | StaticImageData;
  iconSize?: number;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  sx?: SxProps<Theme>;
  labelSx?: SxProps<Theme>;
  hideLabelWhenLoading?: boolean;
  showSuccessAnimation?: boolean;
  showErrorAnimation?: boolean;
  hideLabel?: boolean;
}

const CustomButton: React.FC<CustomButtonProps> = ({
  label,
  variant = "primary",
  size = "medium",
  disabled = false,
  fullWidth = false,
  startIcon,
  endIcon,
  iconSize,
  onClick,
  type = "button",
  sx,
  labelSx,
  hideLabelWhenLoading = false,
  showSuccessAnimation = false,
  showErrorAnimation = false,
  hideLabel = false,
}) => {
  const isMobile = useIsMobile("sm");
  const sizeConfig = {
    small: {
      padding: "8px 16px",
      fontSize: "13px",
      height: "32px",
      gap: "6px",
    },
    medium: {
      padding: "15px 24px",
      fontSize: "15px",
      height: "40px",
      gap: "8px",
    },
    large: {
      padding: "16px 32px",
      fontSize: "16px",
      height: "48px",
      gap: "10px",
    },
  };

  const config = sizeConfig[size];

  const variantConfig = {
    primary: {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.common.white,
      fontFamily: "UrbanistBold",
      borderRadius: "6px",
    },
    secondary: {
      backgroundColor: theme.palette.common.white,
      color: theme.palette.primary.main,
      border: `1px solid ${theme.palette.primary.main}`,
      fontWeight: 500,
    },
    outlined: {
      backgroundColor: theme.palette.common.white,
      color: theme.palette.text.primary,
      border: `1px solid ${theme.palette.border.main}`,
      fontWeight: 400,
      fontFamily: "UrbanistRegular",
      fontSize: "15px",
      "&:hover": {
        backgroundColor: theme.palette.common.white,
        color: theme.palette.text.primary,
      },
      "&:disabled": {
        backgroundColor: theme.palette.common.white,
        color: theme.palette.text.primary,
      },
    },
    danger: {
      backgroundColor: theme.palette.error.main,
      color: theme.palette.common.white,
      border: `1px solid ${theme.palette.error.main}`,
      fontFamily: "UrbanistBold",
      "&:hover": {
        backgroundColor: theme.palette.error.main,
        color: theme.palette.common.white,
      },
      "&:disabled": {
        backgroundColor: theme.palette.error.main,
        color: theme.palette.common.white,
      },
    },
  };

  const variantStyle = variantConfig[variant];

  const renderIcon = (
    icon: React.ReactNode | StaticImageData | undefined,
    iconSize: number,
  ): React.ReactNode => {
    if (!icon) return null;

    if (typeof icon === "object" && "src" in icon) {
      return (
        <Image
          src={icon}
          alt="icon"
          width={iconSize}
          height={iconSize}
          style={{ display: "flex", objectFit: "contain" }}
          draggable={false}
        />
      );
    }

    return icon as React.ReactNode;
  };

  const finalIconSize = iconSize ?? 10;

  const shouldHideLabel = hideLabelWhenLoading && disabled;
  const animationClass = showSuccessAnimation
    ? "success-pulse"
    : showErrorAnimation
      ? "error-shake"
      : "";

  return (
    <MuiButton
      type={type}
      disabled={disabled}
      fullWidth={fullWidth}
      onClick={onClick}
      className={animationClass}
      sx={{
        padding: config.padding,
        fontSize: config.fontSize,
        height: config.height,
        borderRadius: "6px",
        lineHeight: "1",
        textTransform: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.3s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: config.gap,
        ...variantStyle,
        ...(variant === "primary" &&
          !disabled && {
            "&:hover": {
              backgroundColor: "#0004FF99",
              color: "#FFFFFF",
            },
          }),
        ...(disabled && {
          backgroundColor: variant === "primary" ? "#B0BEC5" : "#FFFFFF",
          color:
            variant === "primary" ? "#FFFFFF !important" : "#676768 !important",
          border: `1px solid ${variant === "primary" ? "#B0BEC5" : "#676768"}`,
          cursor: "not-allowed",
          lineHeight: "1",
        }),
        ...(showSuccessAnimation && {
          animation: "successPulse 0.6s ease-in-out",
          "@keyframes successPulse": {
            "0%, 100%": {
              backgroundColor: variant === "primary" ? "#0004FF" : "#FFFFFF",
            },
            "50%": {
              transform: "scale(0.98)",
            },
          },
        }),
        ...(showErrorAnimation && {
          animation: "errorShake 0.5s ease-in-out",
          "@keyframes errorShake": {
            "0%, 100%": {
              transform: "translateX(0)",
            },
            "10%, 30%, 50%, 70%, 90%": {
              transform: "translateX(-5px)",
            },
            "20%, 40%, 60%, 80%": {
              transform: "translateX(5px)",
            },
          },
        }),
        ...sx,
      }}
    >
      {startIcon && (
        <Box
          component="span"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize:
              size === "small" ? "16px" : size === "medium" ? "18px" : "20px",
          }}
        >
          {renderIcon(startIcon, finalIconSize)}
        </Box>
      )}

      {!shouldHideLabel && !hideLabel && (
        <Typography
          className="custom-button-label"
          sx={{
            fontSize: isMobile ? "13px" : "15px",
            fontFamily: "UrbanistMedium",
            fontWeight: 500,
            lineHeight: "1.2",
            letterSpacing: 0,
            whiteSpace: "nowrap",
            ...labelSx,
          }}
        >
          {label}
        </Typography>
      )}

      {endIcon && (
        <Box
          component="span"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize:
              size === "small" ? "10px" : size === "medium" ? "10px" : "20px",
          }}
        >
          {renderIcon(endIcon, finalIconSize)}
        </Box>
      )}
    </MuiButton>
  );
};

export default CustomButton;
