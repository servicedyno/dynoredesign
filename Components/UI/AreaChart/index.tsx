import CalendarTodayIcon from "@/assets/Icons/calendar-icon.svg";
import { RoundedStackIcon } from "@/utils/customIcons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import useIsMobile from "@/hooks/useIsMobile";
import { theme } from "@/styles/theme";
import {
  ActiveTooltipState,
  ChartData,
  CustomTooltipProps,
} from "@/utils/types/dashboard";
import { Box, Typography } from "@mui/material";
import Image from "next/image";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const formatK = (v: number) => `$${Math.round(v / 1000)}k`;

const TOOLTIP_GAP = 12;
const VIEWPORT_PADDING = 8;

const CustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
  coordinate,
  containerRef,
}) => {
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    placement: "top" as "top" | "bottom",
    visible: false,
  });

  const updatePosition = useCallback(() => {
    if (!active || !coordinate || !containerRef.current || !tooltipRef.current)
      return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const tooltipWidth = tooltipRef.current.offsetWidth;
    const tooltipHeight = tooltipRef.current.offsetHeight;

    const anchorX = containerRect.left + coordinate.x;
    const anchorY = containerRect.top + coordinate.y;

    let left = anchorX - tooltipWidth / 2;
    left = Math.max(
      VIEWPORT_PADDING,
      Math.min(left, window.innerWidth - tooltipWidth - VIEWPORT_PADDING),
    );

    let placement: "top" | "bottom" = "bottom";
    let top = anchorY + TOOLTIP_GAP;

    if (top + tooltipHeight > window.innerHeight - VIEWPORT_PADDING) {
      placement = "top";
      top = anchorY - tooltipHeight - TOOLTIP_GAP;
    }

    if (top < VIEWPORT_PADDING) {
      top = VIEWPORT_PADDING;
    }

    setPosition({
      left,
      top,
      placement,
      visible: true,
    });
  }, [active, coordinate, containerRef]);

  useEffect(() => {
    updatePosition();
  }, [updatePosition]);

  useEffect(() => {
    if (!active) return;

    const onViewportChange = () => updatePosition();
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);

    return () => {
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [active, updatePosition]);

  if (!active || !payload?.length || !coordinate) return null;
  if (typeof window === "undefined") return null;

  const value = payload[0].value ?? 0;

  return createPortal(
    <Box
      ref={tooltipRef}
      role="tooltip"
      aria-hidden={!active}
      style={{
        position: "fixed",
        left: position.left,
        top: position.top,
        background: "#fff",
        padding: "10px 14px",
        borderRadius: "12px",
        boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
        fontSize: 12,
        pointerEvents: "none",
        whiteSpace: "nowrap",
        textAlign: "left",
        zIndex: 2000,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        opacity: position.visible ? 1 : 0,
        transform: position.visible ? "translateY(0)" : "translateY(4px)",
        transition: "opacity 180ms ease, transform 180ms ease",
        willChange: "top, left, transform, opacity",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <Image
          src={CalendarTodayIcon}
          alt="calendar-icon"
          width={14}
          height={14}
        />
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 500,
            color: "#676768",
            fontFamily: "UrbanistMedium",
            lineHeight: "100%",
            letterSpacing: 0,
          }}
        >
          {label}
        </Typography>
      </Box>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: "#1E40FF",
          fontWeight: 600,
        }}
      >
        <RoundedStackIcon fill={theme.palette.primary.main} size={12} />
        <Typography
          sx={{
            fontSize: "12px",
            fontFamily: "UrbanistMedium",
            color: theme.palette.primary.main,
            lineHeight: "100%",
            letterSpacing: 0,
          }}
        >
          Volume: {typeof value === "number" ? value.toLocaleString() : value}
        </Typography>
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          top: position.placement === "bottom" ? -6 : "auto",
          bottom: position.placement === "top" ? -6 : "auto",
          borderBottom:
            position.placement === "bottom" ? "6px solid white" : "none",
          borderTop: position.placement === "top" ? "6px solid white" : "none",
        }}
      />
    </Box>,
    document.body,
  );
};

const Chart = ({ data }: { data: ChartData[] }) => {
  const isAllZero = data.every((item) => item.value === 0);
  const isMobile = useIsMobile("md");
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltipState | null>(
    null,
  );
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const gradientId = "areaGradient";
  const gradientStartColor = "#D1E0FF";
  const gradientEndColor = "#E5EDFF";
  const finalGradientStartColor =
    gradientStartColor || theme.palette.primary.main;
  const finalGradientEndColor = gradientEndColor || theme.palette.primary.main;
  const gradientStartOpacity = 1;
  const gradientEndOpacity = 0;
  const xGridPointsRef = useRef<number[]>([]);
  const [, forceRender] = useState(0);
  const [containerSize, setContainerSize] = useState({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    xGridPointsRef.current = [];
    forceRender((n) => n + 1);
  }, [data, containerSize.width]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
    });

    observer.observe(chartContainerRef.current);

    return () => observer.disconnect();
  }, []);

  const hasRealValues = data.some(
    (d) => typeof d.value === "number" && d.value > 0,
  );

  const yDomain = hasRealValues ? ["auto", "auto"] : [0, 16000];
  const yTicks = hasRealValues ? undefined : [0, 4000, 8000, 12000, 16000];

  const MAX_LABELS = 15;

  const getLabelStep = (length: number) => {
    if (length <= MAX_LABELS) return 1;
    return Math.ceil(length / MAX_LABELS);
  };

  const shouldShowLabel = (index: number, length: number) => {
    const step = getLabelStep(length);

    return index % step === 0;
  };

  useEffect(() => {
    const closeTooltip = () => setActiveTooltip(null);

    window.addEventListener("touchstart", closeTooltip, { passive: true });
    window.addEventListener("mousedown", closeTooltip);
    window.addEventListener("pointerdown", closeTooltip);
    window.addEventListener("wheel", closeTooltip, { passive: true });
    window.addEventListener("scroll", closeTooltip, true);
    window.addEventListener("keydown", closeTooltip);
    window.addEventListener("blur", closeTooltip);
    document.addEventListener("visibilitychange", closeTooltip);

    return () => {
      window.removeEventListener("touchstart", closeTooltip);
      window.removeEventListener("mousedown", closeTooltip);
      window.removeEventListener("pointerdown", closeTooltip);
      window.removeEventListener("wheel", closeTooltip);
      window.removeEventListener("scroll", closeTooltip, true);
      window.removeEventListener("keydown", closeTooltip);
      window.removeEventListener("blur", closeTooltip);
      document.removeEventListener("visibilitychange", closeTooltip);
    };
  }, []);

  return (
    <Box
      onScroll={() => setActiveTooltip(null)}
      sx={{
        width: "100%",
        overflowX: "auto",
        overflowY: "hidden",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",

        "&::-webkit-scrollbar": {
          height: "none",
        },
        "&::-webkit-scrollbar-thumb": {
          background: "#E5E7EB",
          borderRadius: 8,
        },
        "&:focus": {
          outline: "none",
          border: "none",
        },
        "&:focus-visible": {
          outline: "none",
          border: "none",
        },
        "& *": {
          outline: "none !important",
          userSelect: "auto",
          WebkitUserDrag: "auto",
          "&:focus": {
            outline: "none !important",
            border: "none !important",
          },
          "&:focus-visible": {
            outline: "none !important",
            border: "none !important",
          },
        },
        "&::-webkit-scrollbar-track": {
          display: "none",
        },
      }}
    >
      <Box
        ref={chartContainerRef}
        sx={{
          height: isMobile ? 260 : 320,
          minHeight: isMobile ? 260 : 320,
          width: {
            xs:
              data.length < 8 ? "500px" : data.length < 31 ? "800px" : "1000px",
            sm: data.length < 31 ? "800px" : "1000px",
            md: "100%",
          },
          minWidth: 0,
        }}
      >
        {containerSize.width > 0 && containerSize.height > 0 && (
          <ResponsiveContainer
            width="100%"
            height={isMobile ? 260 : 320}
            style={{ outline: "none" }}
          >
            <AreaChart
              data={data}
              margin={{
                top: 10,
                right: 20,
                left: isMobile ? -25 : -20,
                bottom: 0,
              }}
              accessibilityLayer
              style={{ outline: "none" }}
              onMouseMove={() => null}
              onMouseLeave={() => setActiveTooltip(null)}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={finalGradientStartColor}
                    stopOpacity={gradientStartOpacity}
                  />
                  <stop
                    offset="100%"
                    stopColor={finalGradientEndColor}
                    stopOpacity={gradientEndOpacity}
                  />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="date"
                interval={0}
                minTickGap={0}
                tickLine={false}
                onChange={() => {
                  forceRender((n) => n + 1);
                }}
                tick={({ x, y, payload, index }) => {
                  if (!shouldShowLabel(index, data.length)) return null;

                  const xPos = Number(x);

                  if (!xGridPointsRef.current.includes(xPos)) {
                    xGridPointsRef.current.push(xPos);
                  }

                  return (
                    <g>
                      <line
                        x1={x}
                        y1={Number(y) - 8}
                        x2={x}
                        y2={Number(y)}
                        stroke="#676768"
                        strokeWidth={1}
                      />
                      <text
                        x={x}
                        y={Number(y) + 15}
                        textAnchor="middle"
                        fill="#676768"
                        fontSize={isMobile ? 10 : 12}
                        fontFamily="UrbanistMedium"
                      >
                        {payload.value}
                      </text>
                    </g>
                  );
                }}
              />

              <YAxis
                tickFormatter={formatK}
                domain={yDomain}
                ticks={yTicks}
                tick={{
                  fill: "#676768",
                  fontSize: isMobile ? 10 : 12,
                  fontFamily: "UrbanistMedium",
                  letterSpacing: 0,
                }}
                tickMargin={5}
                style={{ color: "#676768" }}
              />

              {!isAllZero ? (
                <>
                  <Tooltip
                    content={<CustomTooltip containerRef={chartContainerRef} />}
                    cursor={false}
                    isAnimationActive={false}
                    wrapperStyle={{ pointerEvents: "none" }}
                    allowEscapeViewBox={{ x: true, y: true }}
                    active={Boolean(activeTooltip)}
                    position={activeTooltip?.coordinate}
                  />

                  <CartesianGrid
                    stroke="#E5E7EB"
                    horizontal
                    vertical
                    verticalPoints={xGridPointsRef.current}
                    strokeDasharray="4 4"
                  />

                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#1E40FF"
                    strokeWidth={3}
                    fill={`url(#${gradientId})`}
                    activeDot={false}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      const isActive = activeTooltip?.label === payload.date;

                      const showTooltip = (e?: any) => {
                        e?.stopPropagation();
                        setActiveTooltip({
                          payload: [{ ...payload, value: payload.value }],
                          coordinate: { x: cx, y: cy },
                          label: payload.date,
                        });
                      };

                      return (
                        <g
                          onMouseEnter={showTooltip}
                          onMouseLeave={() => setActiveTooltip(null)}
                          onClick={showTooltip}
                          style={{ cursor: "pointer", outline: "none" }}
                        >
                          <circle cx={cx} cy={cy} r={6} fill="transparent" />

                          {data.length <= 30 && (
                            <>
                              <circle
                                cx={cx}
                                cy={cy}
                                r={7}
                                fill="#1E40FF"
                                filter={`blur(12px)`}
                                opacity={0.6}
                              />
                              <circle
                                cx={cx}
                                cy={cy}
                                fill="#1E40FF"
                                r={6}
                                strokeWidth={2}
                              />
                            </>
                          )}

                          {isActive && data.length > 30 && (
                            <>
                              <circle
                                cx={cx}
                                cy={cy}
                                r={7}
                                fill="#1E40FF"
                                filter={`blur(12px)`}
                                opacity={0.6}
                              />
                              <circle
                                cx={cx}
                                cy={cy}
                                fill="#1E40FF"
                                r={6}
                                strokeWidth={2}
                              />
                            </>
                          )}
                        </g>
                      );
                    }}
                  />
                </>
              ) : (
                <>
                  <CartesianGrid stroke="#E5E7EB" strokeDasharray="4 4" />

                  <Area dataKey="value" activeDot={false} />

                  <text
                    x="50%"
                    y="40%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#9CA3AF"
                    fontSize="16px"
                    fontWeight={500}
                    fontFamily="UrbanistMedium"
                    letterSpacing={0}
                  >
                    There is no data to show
                  </text>
                </>
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Box>
    </Box>
  );
};

export default Chart;
