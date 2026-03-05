import EditIcon from "@/assets/Icons/edit-icon.svg";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import { Box, Divider, Typography, useTheme } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CompanyItem,
  ItemLeft,
  ItemRight,
  SelectorTrigger,
  TriggerText,
} from "./styled";

import { useCompanyDialog } from "@/Components/UI/CompanyDialog/context";
import { useCompanySettingsDialog } from "@/Components/UI/CompanySettingsDialog/context";
import useIsMobile from "@/hooks/useIsMobile";
import { rootReducer } from "@/utils/types";
import { Add } from "@mui/icons-material";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import CustomButton from "../Buttons";
import { HeaderDivider } from "../LanguageSwitcher/styled";

export default function CompanySelector() {
  const { t } = useTranslation("dashboardLayout");
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const { openAddCompany } = useCompanyDialog();
  const { openCompanySettings } = useCompanySettingsDialog();
  const companyState = useSelector(
    (state: rootReducer) => state.companyReducer,
  );

  const wrapperRef = useRef<HTMLDivElement>(null);
  const MIN_WIDTH = 390;
  const MAX_WIDTH = 500;
  const BASE_COUNT = 15;
  const STEP = 10;

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [count, setCount] = useState(BASE_COUNT);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const clampedWidth = Math.min(Math.max(windowWidth, MIN_WIDTH), MAX_WIDTH);

    const extra = Math.floor((clampedWidth - MIN_WIDTH) / STEP);
    setCount(BASE_COUNT + extra);
  }, [windowWidth]);

  const companies = useMemo(
    () => companyState.companyList ?? [],
    [companyState.companyList],
  );
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    if (active == null && companies.length > 0)
      setActive(companies[0].company_id);
  }, [active, companies]);

  const selected = companies.find((c) => c.company_id === active);

  const handleOpen = (e: any) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        handleClose();
      }
    };

    if (anchorEl) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [anchorEl]);

  function truncateByWords(text: string, maxLength: number) {
    if (text.length <= maxLength) return text;

    const trimmed = text.slice(0, maxLength);
    const words = `${trimmed}...`;
    return words;
  }

  return (
    <Box
      ref={wrapperRef}
      sx={{
        position: "relative",
        width: isMobile ? "fit-content" : "clamp(265px, 18vw, 300px)",
        mt: Boolean(anchorEl) && isMobile ? "-16px !important" : "0px",
        ml: Boolean(anchorEl) && isMobile ? "-6px !important" : "0px",
      }}
    >
      {/* Trigger */}
      <SelectorTrigger onClick={handleOpen}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <BusinessCenterIcon
            sx={{
              color: theme.palette.primary.main,
              fontSize: isMobile ? "16.5px" : "19px",
              mt: "-3px",
            }}
          />
          <TriggerText sx={{ color: theme.palette.primary.main }}>
            {windowWidth < 600
              ? truncateByWords(selected?.company_name ?? "-", count)
              : (selected?.company_name ?? "-")}
          </TriggerText>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <HeaderDivider />
          {!anchorEl ? (
            <ExpandMoreIcon
              fontSize="small"
              sx={{ color: theme.palette.text.secondary }}
            />
          ) : (
            <ExpandLess
              fontSize="small"
              sx={{ color: theme.palette.text.secondary }}
            />
          )}
        </Box>
      </SelectorTrigger>

      {/* Dropdown */}
      {Boolean(anchorEl) && (
        <Box
          sx={{
            position: "absolute",
            top: "0",
            width: isMobile ? "224px" : "300px",
            border: "1px solid rgba(233, 236, 242, 1)",
            borderRadius: "6px",
            backgroundColor: "#fff",
            padding: anchorEl ? "9px 8px" : "11px 8px",
            zIndex: 100,
            boxShadow: "0px 8px 24px rgba(0,0,0,0.08)",
          }}
        >
          {/* Header */}
          <Box
            onClick={handleClose}
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0px 6px",
              cursor: "pointer",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <BusinessCenterIcon
                sx={{
                  color: theme.palette.primary.main,
                  fontSize: isMobile ? "16.5px" : "20px",
                }}
              />
              <TriggerText sx={{ color: theme.palette.primary.main }}>
                {selected?.company_name ?? "-"}
              </TriggerText>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <HeaderDivider />
              <ExpandLess
                fontSize="small"
                sx={{ color: theme.palette.text.secondary }}
              />
            </Box>
          </Box>

          {/* Content */}
          <Box
            sx={{
              mt: "13px",
              display: "flex",
              flexDirection: "column",
              gap: isMobile ? "0px" : "6px",
            }}
          >
            <Typography
              sx={{
                display: isMobile ? "none" : "block",
                padding: "0px 6px",
                fontSize: "15px",
                color: theme.palette.text.secondary,
                fontWeight: 500,
                fontFamily: "UrbanistMedium",
              }}
            >
              {t("companySelectorTitle")}:
            </Typography>

            {companies.map((c) => (
              <CompanyItem
                key={c.company_id}
                active={active === c.company_id}
                onClick={() => {
                  setActive(c.company_id);
                  handleClose();
                }}
              >
                <ItemLeft>
                  <Box
                    sx={{ display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <BusinessCenterIcon
                      sx={{ fontSize: isMobile ? "16.5px" : "20px" }}
                    />
                    <TriggerText>
                      {isMobile
                        ? truncateByWords(c?.company_name ?? "-", 18)
                        : (c?.company_name ?? "-")}
                    </TriggerText>
                  </Box>
                  <Typography
                    sx={{
                      fontSize: isMobile ? "10px" : "13px",
                      fontFamily: "UrbanistMedium",
                      fontWeight: 500,
                    }}
                  >
                    {c.email}
                  </Typography>
                </ItemLeft>

                <ItemRight
                  active={active === c.company_id}
                  onClick={(e: any) => {
                    e.stopPropagation();
                    handleClose();
                    openCompanySettings(c);
                  }}
                >
                  <Image
                    src={EditIcon}
                    width={isMobile ? 12 : 16}
                    height={isMobile ? 13 : 17}
                    alt="edit"
                    draggable={false}
                  />
                </ItemRight>
              </CompanyItem>
            ))}

            <Divider sx={{ my: "6px", borderColor: "#D9D9D9" }} />

            <CustomButton
              label={t("addCompany")}
              variant="secondary"
              size="medium"
              endIcon={<Add sx={{ fontSize: isMobile ? "16px" : "18px" }} />}
              fullWidth
              sx={{ mt: 1, py: "8px !important" }}
              onClick={() => {
                handleClose();
                openAddCompany();
              }}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}
