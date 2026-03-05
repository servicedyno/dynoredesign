import useIsMobile from "@/hooks/useIsMobile";
import { Box, Typography, CircularProgress } from "@mui/material";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { homeTheme } from "@/styles/homeTheme";
import {
  SuccessChip,
  TypographyDescription,
  TypographyTime,
  TypographyTitle,
} from "@/Components/UI/HomeCard/styled";
import successIcon from "@/assets/Icons/home/success.svg";
import serviceIcon from "@/assets/Icons/home/service.svg";
import Image from "next/image";
import Bars from "@/Components/UI/APIStatus/Bars";
import axiosBaseApi from "@/axiosConfig";

const ApiStatus = () => {
  const isMobile = useIsMobile();
  const { t } = useTranslation("apiStatus");

  const [services, setServices] = useState([
    { nameKey: "service1Name", uptime: "99.99%", statusKey: "operational" },
    { nameKey: "service2Name", uptime: "99.98%", statusKey: "operational" },
    { nameKey: "service3Name", uptime: "99.97%", statusKey: "operational" },
    { nameKey: "service4Name", uptime: "99.95%", statusKey: "operational" },
    { nameKey: "service5Name", uptime: "99.99%", statusKey: "operational" },
  ]);
  const [incidents, setIncidents] = useState([
    {
      nameKey: "incident1Name",
      timeKey: "incident1Time",
      descriptionKey: "incident1Description",
    },
    {
      nameKey: "incident2Name",
      timeKey: "incident2Time",
      descriptionKey: "incident2Description",
    },
  ]);
  const [allOperational, setAllOperational] = useState(true);
  const [useLiveData, setUseLiveData] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const [servicesRes, incidentsRes] = await Promise.all([
          axiosBaseApi.get("/status/services").catch(() => null),
          axiosBaseApi.get("/status/incidents").catch(() => null),
        ]);

        if (servicesRes?.data?.data?.services) {
          const svc = servicesRes.data.data.services;
          setServices(svc.map((s: any) => ({
            nameKey: s.name,
            uptime: s.uptime,
            statusKey: s.status,
            _live: true,
          })));
          setAllOperational(svc.every((s: any) => s.status === "operational"));
          setUseLiveData(true);
        }

        if (incidentsRes?.data?.data?.incidents) {
          setIncidents(incidentsRes.data.data.incidents.map((inc: any) => ({
            nameKey: inc.title,
            timeKey: inc.formatted_date,
            descriptionKey: inc.description,
            status: inc.status,
            _live: true,
          })));
        }
      } catch (err) {
        console.error("Failed to fetch status:", err);
      }
    };

    fetchStatus();
  }, []);

  return (
    <Box
      sx={{
        width: isMobile ? "100%" : 768,
        maxWidth: "100%",
        minWidth: 320,
        px: "24px",
        mx: "auto",
        pt: isMobile ? "113px" : "128px",
        mb: isMobile ? 6 : "93px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: isMobile ? "23px" : "48px",
      }}
    >
      {/* STATUS */}
      <Box
        height={134}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <SuccessChip>
          <Image src={successIcon} alt="success" width={24} height={24} />
          <Typography
            sx={{
              fontWeight: 600,
              color: homeTheme.palette.success.main,
              fontFamily: "OutfitSemiBold",
              lineHeight: "24px",
              letterSpacing: 0,
            }}
          >
            {allOperational ? t("allSystemsOperational") : "Some Systems Degraded"}
          </Typography>
        </SuccessChip>

        <Typography
          sx={{
            mt: "16px",
            fontWeight: 700,
            fontSize: "30px",
            lineHeight: "36px",
            fontFamily: "OutfitBold",
            color: "#131520",
            letterSpacing: 0,
          }}
        >
          {t("dynoPayStatus")}
        </Typography>

        <Typography
          sx={{
            mt: "8px",
            fontSize: "16px",
            lineHeight: "24px",
            letterSpacing: 0,
            fontFamily: "OutfitRegular",
            color: "#676B7E",
          }}
        >
          {t("statusSubtitle")}
        </Typography>
      </Box>

      {/* SERVICES */}
      <Box
        width="100%"
        height={isMobile ? 455 : 343}
        sx={{
          border: "1px solid #E7E8EF",
          borderRadius: "16px",
          overflow: "hidden",
        }}
      >
        <Box
          height={57}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            pl: "24px",
          }}
        >
          <Image src={serviceIcon} alt="service" width={20} height={20} />
          <TypographyTitle>{t("services")}</TypographyTitle>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column" }}>
          {services.map((service, index) => (
            <Box
              key={index}
              height={isMobile ? 79 : 57}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                px: "24px",
                borderTop: "1px solid #E7E8EF",
              }}
            >
              <Box
                width={isMobile ? 120 : "auto"}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <Image
                  src={successIcon}
                  alt={(service as any)._live ? service.nameKey : t(service.nameKey)}
                  width={isMobile ? 19.02 : 20}
                  height={20}
                />
                <Typography
                  sx={{
                    fontFamily: "OutfitRegular",
                    lineHeight: "24px",
                    letterSpacing: 0,
                    color: "#131520",
                  }}
                >
                  {(service as any)._live ? service.nameKey : t(service.nameKey)}
                </Typography>
              </Box>

              <Box
                width={isMobile ? 141 : 182}
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  ml: "auto",
                }}
              >
                <TypographyDescription>
                  {service.uptime} {t("uptime")}
                </TypographyDescription>

                <Typography
                  sx={{
                    fontSize: "14px",
                    lineHeight: "20px",
                    letterSpacing: 0,
                    fontFamily: "OutfitRegular",
                    color: homeTheme.palette.success.main,
                  }}
                >
                  {(service as any)._live ? service.statusKey : t(service.statusKey)}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      <Box
        height={146}
        width={"100%"}
        sx={{ border: "1px solid #E7E8EF", borderRadius: "16px", p: isMobile ? "25px" : "24px" }}
      >
        <TypographyTitle>{t("ninetyDayUptime")}</TypographyTitle>
        <Bars />
        <Box
          sx={{ mt: "8px", display: "flex", justifyContent: "space-between" }}
        >
          <TypographyTime>{t("ninetyDaysAgo")}</TypographyTime>
          <TypographyTime>{t("today")}</TypographyTime>
        </Box>
      </Box>

      <Box
        height={328}
        width={"100%"}
        sx={{ display: "flex", flexDirection: "column", gap: "16px" }}
      >
        <TypographyTitle>{t("recentIncidents")}</TypographyTitle>
        {incidents.map((incident, index) => (
          <Box
            key={index}
            height={isMobile ? 156 : 136}
            sx={{
              border: "1px solid #E7E8EF",
              borderRadius: "16px",
              p: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography
                sx={{
                  fontFamily: "OutfitMedium",
                  fontWeight: 500,
                  lineHeight: "24px",
                  letterSpacing: 0,
                  color: "#131520",
                }}
              >
                {(incident as any)._live ? incident.nameKey : t(incident.nameKey)}
              </Typography>
              <TypographyTime>{(incident as any)._live ? incident.timeKey : t(incident.timeKey)}</TypographyTime>
            </Box>
            <TypographyDescription>
              {(incident as any)._live ? incident.descriptionKey : t(incident.descriptionKey)}
            </TypographyDescription>
            <Box
              height={26}
              width={64}
              sx={{
                px: "8px",
                pt: "6px",
                pb: "4px",
                backgroundColor: "#22C55E1A",
                borderRadius: "4px",
              }}
            >
              <Typography
                sx={{
                  fontSize: "12px",
                  fontFamily: "OutfitRegular",
                  fontWeight: 400,
                  lineHeight: "16px",
                  letterSpacing: 0,
                  color: homeTheme.palette.success.main,
                }}
              >
                {t("resolved")}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default ApiStatus;
