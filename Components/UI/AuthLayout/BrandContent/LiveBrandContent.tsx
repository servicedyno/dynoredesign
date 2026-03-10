import { Box, Typography, useTheme, useMediaQuery } from "@mui/material";
import Image from "next/image";
import Logo from "@/assets/Images/auth/dynopay-white-logo.png";
import { useEffect, useState, useCallback } from "react";

/* ─── carousel slide data ─── */

interface FeatureSlide {
  tagline: string;
  title: string;
  description: string;
  icon: string;
  gradient: string;
}

const SLIDES: FeatureSlide[] = [
  {
    tagline: "Join Dynopay and get",
    title: "Payment Links",
    description: "Create shareable payment links in seconds. Accept crypto from anyone, anywhere.",
    icon: "🔗",
    gradient: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)",
  },
  {
    tagline: "Join Dynopay and get",
    title: "Multi-Currency Support",
    description: "Accept BTC, ETH, USDT, SOL, XRP, and more — all in one platform.",
    icon: "💱",
    gradient: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)",
  },
  {
    tagline: "Join Dynopay and get",
    title: "Instant Settlement",
    description: "Receive payments in real-time with instant forwarding to your wallet.",
    icon: "⚡",
    gradient: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)",
  },
  {
    tagline: "Join Dynopay and get",
    title: "Dashboard Analytics",
    description: "Track transactions, revenue, and performance with a powerful dashboard.",
    icon: "📊",
    gradient: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)",
  },
  {
    tagline: "Join Dynopay and get",
    title: "Low Fees",
    description: "Competitive 1.5% transaction fee with no hidden charges or monthly costs.",
    icon: "💰",
    gradient: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)",
  },
  {
    tagline: "Join Dynopay and get",
    title: "Checkout Pages",
    description: "Beautiful, branded checkout pages for your customers — no code needed.",
    icon: "🛒",
    gradient: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)",
  },
];

const INTERVAL = 4500;

/* ─── feature mockup card (inside carousel) ─── */

const FeatureMockup = ({ slide }: { slide: FeatureSlide }) => (
  <Box
    sx={{
      width: "82%",
      maxWidth: "380px",
      mx: "auto",
      mt: "auto",
      background: "rgba(255,255,255,0.08)",
      backdropFilter: "blur(12px)",
      borderRadius: "16px 16px 0 0",
      border: "1px solid rgba(255,255,255,0.12)",
      borderBottom: "none",
      p: "28px 24px 0",
      position: "relative",
      overflow: "hidden",
    }}
  >
    {/* Mock header bar */}
    <Box sx={{ display: "flex", alignItems: "center", gap: "8px", mb: "20px" }}>
      <Box sx={{ display: "flex", gap: "5px" }}>
        {["#ff5f57", "#ffbd2e", "#28c840"].map((c) => (
          <Box
            key={c}
            sx={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: c,
              opacity: 0.8,
            }}
          />
        ))}
      </Box>
      <Box
        sx={{
          flex: 1,
          height: "24px",
          borderRadius: "6px",
          background: "rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography
          sx={{
            fontSize: "10px",
            fontFamily: "monospace",
            color: "rgba(255,255,255,0.35)",
            letterSpacing: "0.5px",
          }}
        >
          dynopay.com
        </Typography>
      </Box>
    </Box>

    {/* Mock content rows */}
    <Box sx={{ display: "flex", flexDirection: "column", gap: "12px", pb: "28px" }}>
      {/* Row 1 - "stats" */}
      <Box sx={{ display: "flex", gap: "10px" }}>
        {[1, 2, 3].map((i) => (
          <Box
            key={i}
            sx={{
              flex: 1,
              height: "48px",
              borderRadius: "8px",
              background: `rgba(255,255,255,${0.04 + i * 0.02})`,
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          />
        ))}
      </Box>
      {/* Row 2 - "chart" */}
      <Box
        sx={{
          height: "80px",
          borderRadius: "8px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "flex-end",
          p: "8px 12px",
          gap: "6px",
        }}
      >
        {[35, 50, 30, 65, 45, 70, 55, 80, 60, 75, 90, 68].map((h, i) => (
          <Box
            key={i}
            sx={{
              flex: 1,
              height: `${h}%`,
              borderRadius: "3px 3px 0 0",
              background: `rgba(124,92,231,${0.3 + (h / 100) * 0.5})`,
            }}
          />
        ))}
      </Box>
      {/* Row 3 - "list items" */}
      {[1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            height: "36px",
            borderRadius: "8px",
            background: `rgba(255,255,255,${0.03 + i * 0.01})`,
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        />
      ))}
    </Box>
  </Box>
);

/* ─── dot indicators ─── */

const DotIndicators = ({
  total,
  current,
  onDotClick,
}: {
  total: number;
  current: number;
  onDotClick: (i: number) => void;
}) => (
  <Box sx={{ display: "flex", gap: "8px", justifyContent: "center", mt: "20px" }}>
    {Array.from({ length: total }).map((_, i) => (
      <Box
        key={i}
        onClick={() => onDotClick(i)}
        sx={{
          width: i === current ? "24px" : "8px",
          height: "8px",
          borderRadius: "4px",
          background: i === current ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)",
          cursor: "pointer",
          transition: "all 0.3s ease",
          "&:hover": {
            background: i === current ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.5)",
          },
        }}
      />
    ))}
  </Box>
);

/* ─── main component ─── */

interface LiveBrandContentProps {
  headline?: string;
  subtitle?: string;
}

const LiveBrandContent = ({}: LiveBrandContentProps) => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goToSlide = useCallback(
    (index: number) => {
      if (isTransitioning) return;
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrent(index);
        setIsTransitioning(false);
      }, 300);
    },
    [isTransitioning],
  );

  // Auto-rotate
  useEffect(() => {
    const timer = setInterval(() => {
      goToSlide((current + 1) % SLIDES.length);
    }, INTERVAL);
    return () => clearInterval(timer);
  }, [current, goToSlide]);

  // Only render on desktop (lg+). On smaller screens, BrandPanel is hidden via styled.tsx.
  if (!isDesktop) return null;

  const slide = SLIDES[current];

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background: "#6C5CE7",
      }}
    >
      {/* Top text area */}
      <Box
        sx={{
          flex: "0 0 auto",
          textAlign: "center",
          pt: "48px",
          px: "40px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <Typography
          sx={{
            fontSize: "18px",
            fontWeight: 600,
            fontFamily: "UrbanistBold, sans-serif",
            color: "rgba(255,255,255,0.75)",
            mb: "4px",
            opacity: isTransitioning ? 0 : 1,
            transform: isTransitioning ? "translateY(-8px)" : "translateY(0)",
            transition: "all 0.3s ease",
          }}
        >
          {slide.tagline}
        </Typography>
        <Typography
          sx={{
            fontSize: "28px",
            fontWeight: 700,
            fontFamily: "UrbanistBold, sans-serif",
            color: "#fff",
            mb: "8px",
            opacity: isTransitioning ? 0 : 1,
            transform: isTransitioning ? "translateY(-8px)" : "translateY(0)",
            transition: "all 0.3s ease 0.05s",
          }}
        >
          {slide.title}
        </Typography>
        <Typography
          sx={{
            fontSize: "14px",
            fontWeight: 400,
            fontFamily: "UrbanistMedium, sans-serif",
            color: "rgba(255,255,255,0.65)",
            lineHeight: 1.5,
            maxWidth: "340px",
            mx: "auto",
            opacity: isTransitioning ? 0 : 1,
            transform: isTransitioning ? "translateY(-8px)" : "translateY(0)",
            transition: "all 0.3s ease 0.1s",
          }}
        >
          {slide.description}
        </Typography>
      </Box>

      {/* Feature mockup (grows to fill remaining space) */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          pt: "24px",
          position: "relative",
          zIndex: 2,
          opacity: isTransitioning ? 0 : 1,
          transform: isTransitioning ? "translateY(12px)" : "translateY(0)",
          transition: "all 0.3s ease 0.05s",
        }}
      >
        <FeatureMockup slide={slide} />
      </Box>

      {/* Dot indicators at the bottom */}
      <Box
        sx={{
          position: "absolute",
          bottom: "16px",
          left: 0,
          right: 0,
          zIndex: 3,
        }}
      >
        <DotIndicators total={SLIDES.length} current={current} onDotClick={goToSlide} />
      </Box>
    </Box>
  );
};

export default LiveBrandContent;
