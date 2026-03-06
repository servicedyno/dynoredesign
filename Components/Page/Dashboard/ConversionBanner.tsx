import React, { useEffect, useState, useCallback } from "react";
import { Box, Typography, Switch, useTheme } from "@mui/material";
import { useSelector } from "react-redux";
import Image from "next/image";

import axiosBaseApi from "@/axiosConfig";
import { useCompanySettingsDialog } from "@/Components/UI/CompanySettingsDialog/context";
import useIsMobile from "@/hooks/useIsMobile";
import { rootReducer, ICompany } from "@/utils/types";

import SwapIcon from "@/assets/Icons/swap-round-icon.svg";

const STABLECOIN_LABELS: Record<string, string> = {
  usdt_trc20: "USDT (TRC-20)",
  usdt_erc20: "USDT (ERC-20)",
  usdc_erc20: "USDC (ERC-20)",
};

const ConversionBanner = () => {
  const muiTheme = useTheme();
  const isMobile = useIsMobile("md");
  const { openCompanySettings } = useCompanySettingsDialog();

  const companyState = useSelector(
    (state: rootReducer) => state.companyReducer
  );
  const company: ICompany | null = companyState.companyList?.[0] ?? null;

  const [enabled, setEnabled] = useState(false);
  const [stablecoin, setStablecoin] = useState("usdt_trc20");
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!company?.company_id) {
      setLoading(false);
      return;
    }
    try {
      const res = await axiosBaseApi.get(
        `/company/auto-convert/${company.company_id}`
      );
      const data = res?.data?.data;
      if (data) {
        setEnabled(
          data.auto_convert_enabled === true ||
            data.auto_convert_volatile_crypto === "yes"
        );
        setStablecoin(
          data.target_stablecoin ?? data.convert_to_stablecoin ?? "usdt_trc20"
        );
      }
    } catch {
      // Silently fail — will show default OFF state
    } finally {
      setLoading(false);
    }
  }, [company?.company_id]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleToggle = async () => {
    if (!company?.company_id || toggling) return;
    setToggling(true);
    const newEnabled = !enabled;
    setEnabled(newEnabled); // Optimistic update

    try {
      await axiosBaseApi.put(
        `/company/auto-convert/${company.company_id}`,
        {
          auto_convert_enabled: newEnabled,
          target_stablecoin: stablecoin,
        }
      );
    } catch {
      setEnabled(!newEnabled); // Revert on error
    } finally {
      setToggling(false);
    }
  };

  if (loading || !company) return null;

  return (
    <Box
      sx={{
        mb: 2.5,
        px: { xs: "16px", md: "0px" },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: isMobile ? 1 : 2,
          px: isMobile ? 2 : 2.5,
          py: isMobile ? 1.25 : 1.5,
          borderRadius: "14px",
          border: "1px solid",
          borderColor: enabled ? "#22C55E33" : muiTheme.palette.divider,
          backgroundColor: enabled ? "#22C55E08" : muiTheme.palette.background.paper,
          transition: "all 0.25s ease",
        }}
      >
        {/* Left: Icon + text */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: isMobile ? 1 : 1.5,
            minWidth: 0,
            flex: 1,
          }}
        >
          <Box
            sx={{
              width: isMobile ? 32 : 36,
              height: isMobile ? 32 : 36,
              borderRadius: "10px",
              backgroundColor: enabled ? "#22C55E1A" : "#F3F4F6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "background-color 0.25s ease",
            }}
          >
            <Image
              src={SwapIcon}
              alt="Auto-convert"
              width={16}
              height={16}
              style={{
                filter: enabled
                  ? "brightness(0) saturate(100%) invert(56%) sepia(74%) saturate(513%) hue-rotate(93deg) brightness(98%) contrast(88%)"
                  : "brightness(0) saturate(100%) invert(45%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(93%) contrast(90%)",
                transition: "filter 0.25s ease",
              }}
              draggable={false}
            />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: isMobile ? 13 : 14,
                fontWeight: 500,
                fontFamily: "UrbanistMedium",
                color: muiTheme.palette.text.primary,
                lineHeight: 1.3,
                letterSpacing: 0,
              }}
            >
              Auto-Convert to Stablecoins
            </Typography>
            <Typography
              sx={{
                fontSize: isMobile ? 11 : 12,
                fontFamily: "UrbanistMedium",
                color: muiTheme.palette.text.secondary,
                lineHeight: 1.3,
                letterSpacing: 0,
                mt: 0.25,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {enabled
                ? `Settling in ${STABLECOIN_LABELS[stablecoin] || stablecoin}`
                : "Protect revenue from crypto volatility"}
            </Typography>
          </Box>
        </Box>

        {/* Right: Toggle + Configure link */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: isMobile ? 0.5 : 1.5,
            flexShrink: 0,
          }}
        >
          <Switch
            checked={enabled}
            onChange={handleToggle}
            disabled={toggling}
            size="small"
            sx={{
              "& .MuiSwitch-switchBase.Mui-checked": {
                color: "#22C55E",
              },
              "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                backgroundColor: "#22C55E",
              },
            }}
          />
          <Typography
            onClick={() => {
              if (company) openCompanySettings(company);
            }}
            sx={{
              fontSize: isMobile ? 12 : 13,
              fontFamily: "UrbanistMedium",
              color: muiTheme.palette.primary.main,
              cursor: "pointer",
              whiteSpace: "nowrap",
              "&:hover": {
                textDecoration: "underline",
              },
            }}
          >
            Configure
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default ConversionBanner;
