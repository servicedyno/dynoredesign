import RoundedStackIcon from "@/assets/Icons/roundedStck-icon.svg";
import TransactionIcon from "@/assets/Icons/transaction.svg";
import ArrowUpSuccessIcon from "@/assets/Icons/up-success.svg";
import WalletIcon from "@/assets/Icons/wallet-grey.svg";
import Chart from "@/Components/UI/AreaChart";
import CustomButton from "@/Components/UI/Buttons";
import {
  CryptocurrencyIcon,
  IconChip,
} from "@/Components/UI/CryptocurrencySelector/styled";
import PanelCard from "@/Components/UI/PanelCard";
import TimePeriodSelector from "@/Components/UI/TimePeriodSelector";
import { formatNumberWithComma, getCurrencySymbol } from "@/helpers";
import useIsMobile from "@/hooks/useIsMobile";
import { useWalletData } from "@/hooks/useWalletData";
import { useDashboardData } from "@/hooks/useDashboardData";
import {
  DateRange,
  TimePeriod,
  TransactionData,
} from "@/utils/types/dashboard";
import { Add, ArrowOutward, Remove } from "@mui/icons-material";
import { Box, IconButton, Skeleton, Typography, useTheme } from "@mui/material";
import {
  eachDayOfInterval,
  endOfDay,
  isAfter,
  isValid,
  startOfDay,
} from "date-fns";
import Image from "next/image";
import { useRouter } from "next/router";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PercentageChip } from "./styled";

const formatDate = (date: Date): string => {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}`;
};

type SelectedPeriod = TimePeriod | DateRange;

const isDateRange = (value: SelectedPeriod): value is DateRange => {
  return typeof value !== "string";
};

const normalizeDateRange = (range: DateRange): DateRange => {
  const normalizedStart =
    range.startDate && isValid(range.startDate)
      ? startOfDay(range.startDate)
      : null;
  const normalizedEnd =
    range.endDate && isValid(range.endDate) ? endOfDay(range.endDate) : null;

  if (
    normalizedStart &&
    normalizedEnd &&
    isAfter(normalizedStart, normalizedEnd)
  ) {
    return { startDate: normalizedStart, endDate: null };
  }

  return { startDate: normalizedStart, endDate: normalizedEnd };
};

const generateDateRange = (period: SelectedPeriod): Date[] => {
  const today = startOfDay(new Date());

  if (isDateRange(period)) {
    const normalized = normalizeDateRange(period);
    if (!normalized.startDate) {
      return [];
    }
    const intervalEnd = normalized.endDate
      ? startOfDay(normalized.endDate)
      : normalized.startDate;
    if (isAfter(normalized.startDate, intervalEnd)) {
      return [];
    }
    return eachDayOfInterval({
      start: normalized.startDate,
      end: intervalEnd,
    }).map((d) => startOfDay(d));
  }

  let days = 7;
  if (period === "30days") days = 30;
  else if (period === "90days") days = 90;
  else if (period === "custom") days = 7;

  const dates: Date[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(startOfDay(date));
  }
  return dates;
};

const processTransactionData = (
  rawData: TransactionData[],
  period: SelectedPeriod,
): TransactionData[] => {
  const dateRange = generateDateRange(period);
  const safeDateRange =
    dateRange.length > 0 ? dateRange : generateDateRange("7days");
  const dateMap = new Map<string, number>();

  rawData.forEach((item) => {
    dateMap.set(item.date, item.value);
  });

  const result = safeDateRange.map((date) => {
    const dateStr = formatDate(date);
    return {
      date: dateStr,
      value: dateMap.get(dateStr) ?? 0,
    };
  });

  return result;
};

const TransactionVolumeChart = ({
  selectedPeriod,
  apiChartData,
}: {
  selectedPeriod: SelectedPeriod;
  apiChartData: Array<{ date: string; value: number }>;
}) => {
  const isMobile = useIsMobile("md");

  const rawTransactionData = useMemo(
    () =>
      apiChartData.length > 0
        ? apiChartData
        : [
            { date: "Feb 5", value: 8000 },
            { date: "Feb 6", value: 12000 },
            { date: "Feb 7", value: 10000 },
            { date: "Feb 8", value: 15600 },
            { date: "Feb 9", value: 11000 },
            { date: "Feb 10", value: 13500 },
            { date: "Feb 11", value: 15000 },
          ],
    [apiChartData],
  );

  const transactionData = useMemo(
    () => processTransactionData(rawTransactionData, selectedPeriod),
    [rawTransactionData, selectedPeriod],
  );

  return (
    <Box
      sx={{
        width: "100%",
        mt: isMobile ? "14px" : "12px",
        overflow: "visible",
      }}
    >
      <Chart data={transactionData} />
    </Box>
  );
};

const ActiveWalletsCard = memo(
  ({
    title,
    icon,
    isMobile,
  }: {
    title: string;
    icon: any;
    isMobile: boolean;
  }) => {
    const theme = useTheme();
    return (
      <IconChip
        sx={{
          padding: "6px 8px !important",
          minWidth: "fit-content",
          height: "30px",
          alignItems: "center",
          flexShrink: 0,
          "& img": {
            userSelect: "none",
            WebkitUserDrag: "none",
            pointerEvents: "none",
            WebkitTouchCallout: "none",
          },
        }}
      >
        <CryptocurrencyIcon
          src={icon}
          alt={title}
          width={18}
          height={18}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          style={{ userSelect: "none", pointerEvents: "none" }}
        />
        <span
          style={{
            fontSize: isMobile ? "11px" : "13px",
            fontWeight: 500,
            color: theme.palette.text.secondary,
            flexShrink: 0,
          }}
        >
          {title}
        </span>
      </IconChip>
    );
  },
);

ActiveWalletsCard.displayName = "ActiveWalletsCard";

const DashboardLeftSection = () => {
  const theme = useTheme();
  const namespaces = ["dashboardLayout", "common"];
  const isMobile = useIsMobile("md");
  const router = useRouter();
  const [showAllWallets, setShowAllWallets] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const statCardsContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const statCardsDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const statCardsStartXRef = useRef(0);
  const statCardsScrollLeftRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isStatCardsDragging, setIsStatCardsDragging] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("7days");
  const [customDateRange, setCustomDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
  });

  const { t } = useTranslation(namespaces);
  const tDashboard = useCallback(
    (key: string) => t(key, { ns: "dashboardLayout" }),
    [t],
  );

  const { activeWalletsData } = useWalletData();
  const { stats, chartData, loading, fetchChartData } = useDashboardData();

  // Fetch chart data when period changes
  useEffect(() => {
    if (selectedPeriod === "custom") {
      if (customDateRange.startDate && customDateRange.endDate) {
        fetchChartData(
          "custom",
          customDateRange.startDate.toISOString(),
          customDateRange.endDate.toISOString()
        );
      }
    } else {
      const periodMap: Record<string, string> = {
        "7days": "7d",
        "30days": "30d",
        "90days": "90d",
      };
      fetchChartData(periodMap[selectedPeriod] || "7d");
    }
  }, [selectedPeriod, customDateRange, fetchChartData]);

  const totalTransactions = stats.totalTransactions || 0;
  const totalVolume = stats.totalVolume || 0;
  const transactionChange = stats.transactionChange || 0;
  const volumeChange = stats.volumeChange || 0;

  const maxWalletsToShow = isMobile ? 2 : 3;
  const walletsToDisplay = showAllWallets
    ? activeWalletsData
    : activeWalletsData.slice(0, maxWalletsToShow);
  const hasMoreWallets = activeWalletsData.length > maxWalletsToShow;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isStatCardsDragging) return;
      if (!showAllWallets || !scrollContainerRef.current) return;
      if ((e.target as HTMLElement).closest("button")) return;
      e.preventDefault();
      e.stopPropagation();
      isDraggingRef.current = true;
      setIsDragging(true);
      startXRef.current = e.pageX - scrollContainerRef.current.offsetLeft;
      scrollLeftRef.current = scrollContainerRef.current.scrollLeft;
    },
    [showAllWallets, isStatCardsDragging],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (
        !isDraggingRef.current ||
        !scrollContainerRef.current ||
        !showAllWallets
      )
        return;
      e.preventDefault();
      e.stopPropagation();
      const x = e.pageX - scrollContainerRef.current.offsetLeft;
      const walk = (x - startXRef.current) * 2;
      scrollContainerRef.current.scrollLeft = scrollLeftRef.current - walk;
    },
    [showAllWallets],
  );

  const handleMouseUp = useCallback((e?: React.MouseEvent<HTMLDivElement>) => {
    if (e) {
      e.stopPropagation();
    }
    isDraggingRef.current = false;
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(
    (e?: React.MouseEvent<HTMLDivElement>) => {
      if (e) {
        e.stopPropagation();
      }
      isDraggingRef.current = false;
      setIsDragging(false);
    },
    [],
  );

  const handleStatCardsMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!statCardsContainerRef.current) return;
      if (
        (e.target as HTMLElement).closest("button") ||
        (e.target as HTMLElement).closest("a")
      )
        return;
      if (
        scrollContainerRef.current &&
        scrollContainerRef.current.contains(e.target as Node)
      )
        return;
      e.preventDefault();
      statCardsDraggingRef.current = true;
      setIsStatCardsDragging(true);
      statCardsStartXRef.current =
        e.pageX - statCardsContainerRef.current.offsetLeft;
      statCardsScrollLeftRef.current = statCardsContainerRef.current.scrollLeft;
    },
    [],
  );

  const handleStatCardsMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!statCardsDraggingRef.current || !statCardsContainerRef.current)
        return;
      if (isDraggingRef.current) return;
      if (
        scrollContainerRef.current &&
        scrollContainerRef.current.contains(e.target as Node)
      )
        return;
      e.preventDefault();
      const x = e.pageX - statCardsContainerRef.current.offsetLeft;
      const walk = (x - statCardsStartXRef.current) * 2;
      statCardsContainerRef.current.scrollLeft =
        statCardsScrollLeftRef.current - walk;
    },
    [],
  );

  const handleStatCardsMouseUp = useCallback(() => {
    statCardsDraggingRef.current = false;
    setIsStatCardsDragging(false);
  }, []);

  const handleStatCardsMouseLeave = useCallback(() => {
    statCardsDraggingRef.current = false;
    setIsStatCardsDragging(false);
  }, []);

  return (
    <Box>
      {/* Stat Cards */}
      <Box
        ref={statCardsContainerRef}
        onMouseDown={handleStatCardsMouseDown}
        onMouseMove={handleStatCardsMouseMove}
        onMouseUp={handleStatCardsMouseUp}
        onMouseLeave={handleStatCardsMouseLeave}
        sx={{
          mb: 2.5,
          px: { xs: "16px", md: "0px" },
          display: "flex",
          gap: isMobile ? "8px" : "20px",
          overflowX: "auto",
          overflowY: "hidden",
          cursor: isStatCardsDragging ? "grabbing" : "grab",
          userSelect: "none",
          WebkitUserSelect: "none",
          MozUserSelect: "none",
          msUserSelect: "none",
          willChange: isStatCardsDragging ? "scroll-position" : "auto",
          "& img": {
            userSelect: "none",
            WebkitUserDrag: "none",
            pointerEvents: "none",
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            KhtmlUserSelect: "none",
            MozUserSelect: "none",
            msUserSelect: "none",
            backfaceVisibility: "hidden",
            transform: "translateZ(0)",
          },
          "& *": {
            userSelect: "none",
            WebkitUserDrag: "none",
          },
          "& button": {
            pointerEvents: "auto",
          },
          "&::-webkit-scrollbar": {
            height: "0px",
          },
          "&::-webkit-scrollbar-track": {
            background: "transparent",
          },
          "&::-webkit-scrollbar-thumb": {
            background: "transparent",
          },
        }}
      >
        {/* Total Transactions */}
        <PanelCard
          title={tDashboard("totalTransactions")}
          showHeaderBorder={false}
          headerPadding={
            isMobile
              ? theme.spacing(2, 2, 0, 2)
              : theme.spacing(2.5, 2.5, 0, 2.5)
          }
          bodyPadding={
            isMobile
              ? theme.spacing(1.5, 2, 2, 2)
              : theme.spacing(2, 2, 2.5, 2.5)
          }
          sx={{
            width: { xs: "200px", sm: "240px", md: "289px", xl: "315px" },
            height: { xs: "128px", sm: "140px", md: "176px" },
            flexShrink: 0,
          }}
          headerAction={
            <IconButton
              sx={{
                padding: "8px",
                width: isMobile ? "32px" : "40px",
                height: isMobile ? "32px" : "40px",
                "&:hover": { backgroundColor: "transparent" },
              }}
            >
              <Image
                src={TransactionIcon}
                alt="Transaction Icon"
                width={17}
                height={14}
                style={{
                  width: "clamp(14px, 2vw, 17px)",
                  height: "auto",
                }}
                draggable={false}
              />
            </IconButton>
          }
        >
          <Typography
            sx={{
              fontSize: isMobile ? "20px" : "40px",
              color: theme.palette.text.primary,
              fontFamily: "UrbanistMedium",
              lineHeight: "100%",
              fontWeight: 500,
              letterSpacing: 0,
            }}
          >
            {loading ? <Skeleton width={60} /> : totalTransactions}
          </Typography>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mt: { xs: "18px", sm: 3, md: 2.5 },
            }}
          >
            <PercentageChip
              sx={{ padding: isMobile ? "7px 3px" : "5px 7px", lineHeight: 0 }}
            >
              <Image
                src={ArrowUpSuccessIcon}
                alt="Arrow Up Success Icon"
                width={11}
                height={11}
                style={{
                  width: "clamp(8px, 2vw, 11px)",
                  height: "auto",
                }}
              />
              <Typography
                component="span"
                sx={{
                  fontSize: isMobile ? "10px" : "13px",
                  color: theme.palette.border.success,
                  fontFamily: "UrbanistMedium",
                  lineHeight: 0,
                  padding: isMobile ? "0px 2px" : "8px 0px",
                  fontWeight: 500,
                  letterSpacing: 0,
                }}
              >
                {transactionChange}%
              </Typography>
            </PercentageChip>
            <Typography
              sx={{
                fontSize: isMobile ? "10px" : "13px",
                color: theme.palette.text.secondary,
                fontFamily: "UrbanistMedium",
                lineHeight: "100%",
                fontWeight: 500,
                letterSpacing: 0,
              }}
            >
              {t("comparedToLastMonth")}
            </Typography>
          </Box>
        </PanelCard>

        {/* Total Volume */}
        <PanelCard
          title={t("totalVolume")}
          showHeaderBorder={false}
          headerPadding={
            isMobile
              ? theme.spacing(2, 2, 0, 2)
              : theme.spacing(2.5, 2.5, 0, 2.5)
          }
          bodyPadding={
            isMobile ? theme.spacing(1.5, 2, 2, 2) : theme.spacing(2, 2, 2.5, 2)
          }
          sx={{
            width: { xs: "200px", sm: "240px", md: "289px", xl: "315px" },
            height: { xs: "128px", sm: "140px", md: "176px" },
            flexShrink: 0,
          }}
          headerAction={
            <IconButton
              sx={{
                padding: "8px",
                width: isMobile ? "32px" : "40px",
                height: isMobile ? "32px" : "40px",
                "&:hover": { backgroundColor: "transparent" },
              }}
            >
              <Image
                src={RoundedStackIcon}
                alt="Rounded Stack Icon"
                style={{
                  width: "clamp(14px, 2vw, 17px)",
                  height: "auto",
                }}
                draggable={false}
              />
            </IconButton>
          }
        >
          <Typography
            sx={{
              fontSize: isMobile ? "20px" : "40px",
              color: theme.palette.text.primary,
              fontFamily: "UrbanistMedium",
              lineHeight: "100%",
              fontWeight: 500,
              letterSpacing: 0,
            }}
          >
            {loading ? <Skeleton width={120} /> : getCurrencySymbol("USD", formatNumberWithComma(totalVolume))}
          </Typography>

          <Box
            sx={{
              display: "flex",
              justifyContent: "start",
              alignItems: "center",
              gap: 1,
              mt: { xs: "18px", sm: 3, md: 2.5 },
            }}
          >
            <PercentageChip
              sx={{ padding: isMobile ? "7px 3px" : "5px 7px", lineHeight: 0 }}
            >
              <Image
                src={ArrowUpSuccessIcon}
                alt="Arrow Up Success Icon"
                width={11}
                height={11}
                style={{
                  width: "clamp(8px, 2vw, 11px)",
                  height: "auto",
                }}
              />
              <Typography
                component="span"
                sx={{
                  fontSize: isMobile ? "10px" : "13px",
                  color: theme.palette.border.success,
                  fontFamily: "UrbanistMedium",
                  lineHeight: 0,
                  padding: isMobile ? "0px 2px" : "8px 0px",
                  fontWeight: 500,
                  letterSpacing: 0,
                }}
              >
                {volumeChange}%
              </Typography>
            </PercentageChip>
            <Typography
              sx={{
                fontSize: isMobile ? "10px" : "13px",
                color: theme.palette.text.secondary,
                fontFamily: "UrbanistMedium",
                lineHeight: "100%",
                fontWeight: 500,
                letterSpacing: 0,
                paddingRight: "0px !important",
              }}
            >
              {t("comparedToLastMonth")}
            </Typography>
          </Box>
        </PanelCard>

        {/* Active Wallets */}
        <PanelCard
          title={tDashboard("activeWallets")}
          showHeaderBorder={false}
          headerPadding={
            isMobile
              ? theme.spacing(2, 2, 0, 2)
              : theme.spacing(2.5, 2.5, 0, 2.5)
          }
          bodyPadding={
            isMobile
              ? theme.spacing(1.5, 2, 2, 2)
              : theme.spacing(2, 2, 2.5, 2.5)
          }
          sx={{
            width: { xs: "200px", sm: "240px", md: "289px", xl: "315px" },
            height: { xs: "128px", sm: "140px", md: "176px" },
            flexShrink: 0,
          }}
          headerAction={
            <IconButton
              sx={{
                padding: "8px",
                width: isMobile ? "32px" : "40px",
                height: isMobile ? "32px" : "40px",
                "&:hover": { backgroundColor: "transparent" },
              }}
            >
              <Image
                src={WalletIcon}
                alt="Wallet Icon"
                style={{
                  width: "clamp(12px, 2vw, 17px)",
                  height: "auto",
                }}
                draggable={false}
              />
            </IconButton>
          }
        >
          <Typography
            sx={{
              fontSize: isMobile ? "20px" : "40px",
              color: theme.palette.text.primary,
              fontFamily: "UrbanistMedium",
              lineHeight: "100%",
              fontWeight: 500,
              letterSpacing: 0,
            }}
          >
            {activeWalletsData.length}
          </Typography>

          <Box
            ref={scrollContainerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            sx={{
              display: "flex",
              justifyContent: "start",
              alignItems: "center",
              gap: isMobile ? "6px" : "8px",
              mt: { xs: "18px", sm: 3, md: 2.5 },
              overflowX: "auto",
              overflowY: "hidden",
              flexWrap: "nowrap",
              cursor: showAllWallets
                ? isDragging
                  ? "grabbing"
                  : "grab"
                : "default",
              userSelect: "none",
              WebkitUserSelect: "none",
              MozUserSelect: "none",
              msUserSelect: "none",
              willChange: isDragging ? "scroll-position" : "auto",
              "& img": {
                userSelect: "none",
                WebkitUserDrag: "none",
                pointerEvents: "none",
                WebkitTouchCallout: "none",
                WebkitUserSelect: "none",
                KhtmlUserSelect: "none",
                MozUserSelect: "none",
                msUserSelect: "none",
                backfaceVisibility: "hidden",
                transform: "translateZ(0)",
              },
              "& *": {
                userSelect: "none",
                WebkitUserDrag: "none",
              },
              "& button": {
                pointerEvents: "auto",
              },
              "&::-webkit-scrollbar": {
                height: "0px",
              },
              "&::-webkit-scrollbar-track": {
                background: "transparent",
              },
              "&::-webkit-scrollbar-thumb": {
                background: "transparent",
              },
            }}
          >
            {walletsToDisplay.map((wallet) => (
              <ActiveWalletsCard
                key={wallet.code}
                title={wallet.code}
                icon={wallet.icon}
                isMobile={isMobile}
              />
            ))}
            {hasMoreWallets && !showAllWallets && (
              <IconButton
                onClick={() => setShowAllWallets(true)}
                sx={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "999px",
                  background: theme.palette.secondary.light,
                  border: `1px solid ${theme.palette.border.main}`,
                  padding: 0,
                  minWidth: "30px",
                  flexShrink: 0,
                  "&:hover": {
                    background: theme.palette.secondary.dark,
                  },
                }}
              >
                <Add
                  sx={{
                    fontSize: "20px",
                    color: theme.palette.text.secondary,
                  }}
                />
              </IconButton>
            )}
            {showAllWallets && (
              <IconButton
                onClick={() => setShowAllWallets(false)}
                sx={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "999px",
                  background: theme.palette.secondary.light,
                  border: `1px solid ${theme.palette.border.main}`,
                  padding: 0,
                  minWidth: "30px",
                  flexShrink: 0,
                  "&:hover": {
                    background: theme.palette.secondary.dark,
                  },
                }}
              >
                <Remove
                  sx={{
                    fontSize: "20px",
                    color: theme.palette.text.secondary,
                  }}
                />
              </IconButton>
            )}
          </Box>
        </PanelCard>
      </Box>

      {/* Transaction Volume Graph */}
      <Box sx={{ px: { xs: "16px", md: "0px" } }}>
        <PanelCard
          showHeaderBorder={false}
          headerPadding={theme.spacing(2.5)}
          bodyPadding={
            isMobile ? theme.spacing(2, 0, 2, 2) : theme.spacing(2.5, 2, 2.5, 2)
          }
          headerActionLayout="inline"
          sx={{ mb: 2.5, boxShadow: "none !important", overflow: "visible" }}
        >
          <Box
            sx={{
              width: "100%",
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              justifyContent: { xs: "flex-start", sm: "space-between" },
              alignItems: { xs: "flex-start", md: "center" },
              gap: { xs: "12px", md: 0 },
            }}
          >
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: "6.41px" }}
            >
              <Typography
                sx={{
                  fontSize: isMobile ? "15px" : "20px",
                  color: theme.palette.text.primary,
                  fontFamily: "UrbanistMedium",
                  lineHeight: 1.2,
                }}
              >
                {tDashboard("transactionVolume")}
              </Typography>
              <Typography
                sx={{
                  fontSize: "13px",
                  color: theme.palette.text.secondary,
                  fontFamily: "UrbanistMedium",
                  lineHeight: 1.2,
                }}
              >
                {tDashboard("dailyTransactionActivity")}
              </Typography>
            </Box>
            <Box
              sx={{
                display: "flex",
                gap: selectedPeriod === "custom" ? "6px" : "12px",
                alignItems: "center",
                width: { xs: "100%", sm: "auto" },
                p: { xs: "0px 16px 0px 0px", md: "0px" },
              }}
            >
              <TimePeriodSelector
                value={selectedPeriod}
                onChange={(period) => setSelectedPeriod(period)}
                dateRange={customDateRange}
                onDateRangeChange={setCustomDateRange}
                sx={{ flexShrink: 0 }}
              />
              <Box>
                <CustomButton
                  label={t("viewTransactions")}
                  variant="secondary"
                  size={isMobile ? "small" : "medium"}
                  endIcon={
                    <ArrowOutward sx={{ fontSize: isMobile ? 14 : 16 }} />
                  }
                  sx={{ flexShrink: 0, padding: "8px 12px !important" }}
                  onClick={() => router.push("/transactions")}
                />
              </Box>
            </Box>
          </Box>
          <TransactionVolumeChart
            selectedPeriod={
              selectedPeriod === "custom" ? customDateRange : selectedPeriod
            }
            apiChartData={chartData}
          />
        </PanelCard>
      </Box>
    </Box>
  );
};

export default DashboardLeftSection;
