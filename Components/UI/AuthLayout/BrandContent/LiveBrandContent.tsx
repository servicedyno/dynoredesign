import { Box, Typography, useTheme, useMediaQuery } from "@mui/material";
import { useEffect, useState, useCallback, ReactNode } from "react";

/* ─────────────────────────────────────────────────────
   CAROUSEL SLIDE DATA
   ───────────────────────────────────────────────────── */

interface FeatureSlide {
  tagline: string;
  title: string;
  description: string;
  mockup: () => ReactNode;
}

const INTERVAL = 5000;

/* ─────────────────────────────────────────────────────
   SHARED MOCKUP PIECES
   ───────────────────────────────────────────────────── */

const MockBrowserChrome = ({ children }: { children: ReactNode }) => (
  <Box
    sx={{
      width: "100%",
      background: "rgba(255,255,255,0.07)",
      backdropFilter: "blur(8px)",
      borderRadius: "14px 14px 0 0",
      border: "1px solid rgba(255,255,255,0.10)",
      borderBottom: "none",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}
  >
    {/* Chrome bar */}
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: "7px",
        px: "14px",
        py: "10px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <Box sx={{ display: "flex", gap: "5px" }}>
        {["#ff5f57", "#ffbd2e", "#28c840"].map((c) => (
          <Box key={c} sx={{ width: "9px", height: "9px", borderRadius: "50%", background: c, opacity: 0.85 }} />
        ))}
      </Box>
      <Box
        sx={{
          flex: 1,
          height: "22px",
          borderRadius: "5px",
          background: "rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography sx={{ fontSize: "9px", fontFamily: "monospace", color: "rgba(255,255,255,0.32)", letterSpacing: "0.4px" }}>
          dynopay.com
        </Typography>
      </Box>
    </Box>

    {/* Content */}
    <Box sx={{ p: "16px 14px 0" }}>{children}</Box>
  </Box>
);

/* helper: stat card */
const StatCard = ({ label, value, accent }: { label: string; value: string; accent: string }) => (
  <Box
    sx={{
      flex: 1,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "8px",
      p: "10px 10px 8px",
      minWidth: 0,
    }}
  >
    <Typography sx={{ fontSize: "8px", color: "rgba(255,255,255,0.4)", fontFamily: "UrbanistMedium, sans-serif", mb: "3px", letterSpacing: "0.3px" }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: "14px", fontWeight: 700, color: accent, fontFamily: "UrbanistBold, sans-serif", lineHeight: 1 }}>
      {value}
    </Typography>
  </Box>
);

/* helper: list row */
const ListRow = ({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub?: string; color: string }) => (
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
      py: "7px",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
      "&:last-child": { borderBottom: "none" },
    }}
  >
    <Box sx={{ width: "26px", height: "26px", borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", flexShrink: 0 }}>
      {icon}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.82)", fontFamily: "UrbanistBold, sans-serif" }}>{label}</Typography>
      {sub && <Typography sx={{ fontSize: "8px", color: "rgba(255,255,255,0.35)", fontFamily: "UrbanistMedium, sans-serif" }}>{sub}</Typography>}
    </Box>
    <Typography sx={{ fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.72)", fontFamily: "UrbanistBold, sans-serif", flexShrink: 0 }}>{value}</Typography>
  </Box>
);

/* ─────────────────────────────────────────────────────
   PER-SLIDE MOCKUPS
   ───────────────────────────────────────────────────── */

/* 1 — Payment Links */
const PaymentLinksMockup = () => (
  <MockBrowserChrome>
    <Box sx={{ display: "flex", gap: "10px", mb: "12px" }}>
      <StatCard label="ACTIVE LINKS" value="24" accent="#a78bfa" />
      <StatCard label="RECEIVED" value="$12.4K" accent="#34d399" />
      <StatCard label="TODAY" value="$840" accent="#60a5fa" />
    </Box>
    {/* Payment link card */}
    <Box sx={{ background: "rgba(124,92,231,0.12)", border: "1px solid rgba(124,92,231,0.25)", borderRadius: "10px", p: "12px", mb: "10px" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: "6px" }}>
        <Typography sx={{ fontSize: "10px", fontWeight: 700, color: "#a78bfa", fontFamily: "UrbanistBold, sans-serif" }}>Payment #2847</Typography>
        <Box sx={{ px: "6px", py: "2px", borderRadius: "4px", background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)" }}>
          <Typography sx={{ fontSize: "7px", fontWeight: 600, color: "#34d399", fontFamily: "UrbanistBold, sans-serif" }}>ACTIVE</Typography>
        </Box>
      </Box>
      <Typography sx={{ fontSize: "16px", fontWeight: 700, color: "#fff", fontFamily: "UrbanistBold, sans-serif", mb: "4px" }}>0.05 ETH</Typography>
      <Typography sx={{ fontSize: "8px", color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>pay.dynopay.com/lnk_28f7a...</Typography>
    </Box>
    {/* Recent activity */}
    <ListRow icon="🔗" label="Invoice #2846" value="$250.00" sub="2 hours ago" color="rgba(167,139,250,0.15)" />
    <ListRow icon="✓" label="Invoice #2845" value="$1,200.00" sub="Yesterday" color="rgba(52,211,153,0.15)" />
    <Box sx={{ height: "8px" }} />
  </MockBrowserChrome>
);

/* 2 — Multi-Currency */
const MultiCurrencyMockup = () => (
  <MockBrowserChrome>
    <Box sx={{ display: "flex", gap: "10px", mb: "12px" }}>
      <StatCard label="TOTAL BALANCE" value="$47.2K" accent="#f9fafb" />
      <StatCard label="CURRENCIES" value="6" accent="#a78bfa" />
    </Box>
    <ListRow icon="₿" label="Bitcoin" value="0.812 BTC" sub="$38,420.50" color="rgba(247,147,26,0.18)" />
    <ListRow icon="Ξ" label="Ethereum" value="2.45 ETH" sub="$5,103.20" color="rgba(98,126,234,0.18)" />
    <ListRow icon="◎" label="Solana" value="42.8 SOL" sub="$2,140.00" color="rgba(20,241,149,0.12)" />
    <ListRow icon="₮" label="Tether" value="1,540 USDT" sub="$1,540.00" color="rgba(38,161,123,0.18)" />
    <Box sx={{ height: "8px" }} />
  </MockBrowserChrome>
);

/* 3 — Instant Settlement */
const InstantSettlementMockup = () => (
  <MockBrowserChrome>
    <Box sx={{ display: "flex", gap: "10px", mb: "12px" }}>
      <StatCard label="AVG. SPEED" value="< 30s" accent="#34d399" />
      <StatCard label="SETTLED TODAY" value="$6.8K" accent="#60a5fa" />
      <StatCard label="SUCCESS" value="99.9%" accent="#a78bfa" />
    </Box>
    {/* Transaction timeline */}
    {[
      { time: "12:04:32", label: "Payment received", amount: "+0.025 ETH", status: "Confirmed", statusColor: "#34d399" },
      { time: "12:04:18", label: "Forwarded to wallet", amount: "0.025 ETH", status: "Settled", statusColor: "#60a5fa" },
      { time: "11:58:45", label: "Payment received", amount: "+120 USDT", status: "Confirmed", statusColor: "#34d399" },
      { time: "11:58:12", label: "Forwarded to wallet", amount: "120 USDT", status: "Settled", statusColor: "#60a5fa" },
    ].map((tx, i) => (
      <Box key={i} sx={{ display: "flex", alignItems: "center", gap: "8px", py: "6px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <Typography sx={{ fontSize: "8px", color: "rgba(255,255,255,0.3)", fontFamily: "monospace", width: "48px", flexShrink: 0 }}>{tx.time}</Typography>
        <Box sx={{ width: "6px", height: "6px", borderRadius: "50%", background: tx.statusColor, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "9px", fontWeight: 600, color: "rgba(255,255,255,0.75)", fontFamily: "UrbanistBold, sans-serif" }}>{tx.label}</Typography>
        </Box>
        <Typography sx={{ fontSize: "9px", fontWeight: 600, color: "rgba(255,255,255,0.6)", fontFamily: "UrbanistBold, sans-serif", flexShrink: 0 }}>{tx.amount}</Typography>
      </Box>
    ))}
    <Box sx={{ height: "8px" }} />
  </MockBrowserChrome>
);

/* 4 — Dashboard Analytics */
const DashboardMockup = () => (
  <MockBrowserChrome>
    <Box sx={{ display: "flex", gap: "10px", mb: "12px" }}>
      <StatCard label="REVENUE" value="$124K" accent="#34d399" />
      <StatCard label="TXNS" value="1,847" accent="#a78bfa" />
      <StatCard label="GROWTH" value="+18%" accent="#60a5fa" />
    </Box>
    {/* Chart */}
    <Box
      sx={{
        height: "90px",
        borderRadius: "8px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "flex-end",
        p: "8px 6px 6px",
        gap: "4px",
        mb: "10px",
        position: "relative",
      }}
    >
      {/* Y-axis labels */}
      <Box sx={{ position: "absolute", top: "6px", left: "6px", display: "flex", flexDirection: "column", justifyContent: "space-between", height: "calc(100% - 16px)" }}>
        {["$20K", "$15K", "$10K", "$5K"].map((l) => (
          <Typography key={l} sx={{ fontSize: "6px", color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>{l}</Typography>
        ))}
      </Box>
      {/* Bars */}
      <Box sx={{ flex: 1, display: "flex", alignItems: "flex-end", gap: "3px", pl: "22px" }}>
        {[40, 55, 35, 70, 50, 80, 65, 90, 72, 85, 60, 95].map((h, i) => (
          <Box
            key={i}
            sx={{
              flex: 1,
              height: `${h}%`,
              borderRadius: "2px 2px 0 0",
              background: i === 11 ? "#6C5CE7" : `rgba(108,92,231,${0.2 + (h / 100) * 0.35})`,
            }}
          />
        ))}
      </Box>
    </Box>
    <Box sx={{ display: "flex", justifyContent: "space-between", px: "4px" }}>
      {["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((m) => (
        <Typography key={m} sx={{ fontSize: "7px", color: "rgba(255,255,255,0.25)", fontFamily: "UrbanistMedium, sans-serif" }}>{m}</Typography>
      ))}
    </Box>
    <Box sx={{ height: "8px" }} />
  </MockBrowserChrome>
);

/* 5 — Low Fees */
const LowFeesMockup = () => (
  <MockBrowserChrome>
    <Box sx={{ display: "flex", gap: "10px", mb: "12px" }}>
      <StatCard label="YOUR FEE" value="1.5%" accent="#34d399" />
      <StatCard label="SAVED" value="$2.1K" accent="#a78bfa" />
      <StatCard label="VS STRIPE" value="-50%" accent="#60a5fa" />
    </Box>
    {/* Comparison */}
    {[
      { name: "Dynopay", pct: 1.5, width: "15%", color: "#6C5CE7", highlight: true },
      { name: "Stripe", pct: 2.9, width: "29%", color: "rgba(255,255,255,0.15)", highlight: false },
      { name: "PayPal", pct: 3.5, width: "35%", color: "rgba(255,255,255,0.10)", highlight: false },
      { name: "Coinbase Commerce", pct: 2.0, width: "20%", color: "rgba(255,255,255,0.12)", highlight: false },
    ].map((item) => (
      <Box key={item.name} sx={{ mb: "8px" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: "3px" }}>
          <Typography sx={{ fontSize: "9px", fontWeight: item.highlight ? 700 : 500, color: item.highlight ? "#fff" : "rgba(255,255,255,0.5)", fontFamily: "UrbanistBold, sans-serif" }}>
            {item.name}
          </Typography>
          <Typography sx={{ fontSize: "9px", fontWeight: 600, color: item.highlight ? "#34d399" : "rgba(255,255,255,0.4)", fontFamily: "UrbanistBold, sans-serif" }}>
            {item.pct}%
          </Typography>
        </Box>
        <Box sx={{ height: "6px", borderRadius: "3px", background: "rgba(255,255,255,0.04)" }}>
          <Box sx={{ height: "100%", borderRadius: "3px", width: item.width, background: item.color }} />
        </Box>
      </Box>
    ))}
    <Box sx={{ height: "8px" }} />
  </MockBrowserChrome>
);

/* 6 — Checkout Pages */
const CheckoutMockup = () => (
  <MockBrowserChrome>
    {/* Checkout form */}
    <Box sx={{ textAlign: "center", mb: "10px" }}>
      <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#fff", fontFamily: "UrbanistBold, sans-serif" }}>Pay Invoice #4821</Typography>
      <Typography sx={{ fontSize: "20px", fontWeight: 700, color: "#a78bfa", fontFamily: "UrbanistBold, sans-serif", my: "4px" }}>$250.00</Typography>
      <Typography sx={{ fontSize: "8px", color: "rgba(255,255,255,0.4)", fontFamily: "UrbanistMedium, sans-serif" }}>to Acme Corp</Typography>
    </Box>
    {/* Currency selection */}
    <Box sx={{ display: "flex", gap: "6px", mb: "10px" }}>
      {[
        { s: "₿", l: "BTC", active: true },
        { s: "Ξ", l: "ETH", active: false },
        { s: "₮", l: "USDT", active: false },
        { s: "◎", l: "SOL", active: false },
      ].map((c) => (
        <Box
          key={c.l}
          sx={{
            flex: 1,
            py: "7px",
            borderRadius: "8px",
            textAlign: "center",
            background: c.active ? "rgba(108,92,231,0.2)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${c.active ? "rgba(108,92,231,0.4)" : "rgba(255,255,255,0.06)"}`,
            cursor: "pointer",
          }}
        >
          <Typography sx={{ fontSize: "12px", lineHeight: 1 }}>{c.s}</Typography>
          <Typography sx={{ fontSize: "7px", fontWeight: 600, color: c.active ? "#a78bfa" : "rgba(255,255,255,0.4)", fontFamily: "UrbanistBold, sans-serif", mt: "2px" }}>
            {c.l}
          </Typography>
        </Box>
      ))}
    </Box>
    {/* Amount display */}
    <Box sx={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", p: "10px", mb: "10px", textAlign: "center" }}>
      <Typography sx={{ fontSize: "8px", color: "rgba(255,255,255,0.35)", fontFamily: "UrbanistMedium, sans-serif", mb: "2px" }}>You will pay</Typography>
      <Typography sx={{ fontSize: "14px", fontWeight: 700, color: "#fff", fontFamily: "UrbanistBold, sans-serif" }}>0.00289 BTC</Typography>
      <Typography sx={{ fontSize: "7px", color: "rgba(255,255,255,0.3)", fontFamily: "monospace", mt: "2px" }}>≈ $250.00 USD</Typography>
    </Box>
    {/* CTA */}
    <Box sx={{ background: "#6C5CE7", borderRadius: "8px", py: "9px", textAlign: "center", mb: "12px" }}>
      <Typography sx={{ fontSize: "10px", fontWeight: 700, color: "#fff", fontFamily: "UrbanistBold, sans-serif" }}>Pay Now</Typography>
    </Box>
  </MockBrowserChrome>
);

/* ─────────────────────────────────────────────────────
   SLIDES
   ───────────────────────────────────────────────────── */

const SLIDES: FeatureSlide[] = [
  {
    tagline: "Join Dynopay and get",
    title: "Payment Links",
    description: "Create shareable payment links in seconds. Accept crypto from anyone, anywhere.",
    mockup: PaymentLinksMockup,
  },
  {
    tagline: "Join Dynopay and get",
    title: "Multi-Currency Support",
    description: "Accept BTC, ETH, USDT, SOL, XRP, and more — all in one platform.",
    mockup: MultiCurrencyMockup,
  },
  {
    tagline: "Join Dynopay and get",
    title: "Instant Settlement",
    description: "Receive payments in real-time with instant forwarding to your wallet.",
    mockup: InstantSettlementMockup,
  },
  {
    tagline: "Join Dynopay and get",
    title: "Dashboard Analytics",
    description: "Track transactions, revenue, and performance with a powerful dashboard.",
    mockup: DashboardMockup,
  },
  {
    tagline: "Join Dynopay and get",
    title: "Low Fees",
    description: "Competitive 1.5% transaction fee with no hidden charges or monthly costs.",
    mockup: LowFeesMockup,
  },
  {
    tagline: "Join Dynopay and get",
    title: "Checkout Pages",
    description: "Beautiful, branded checkout pages for your customers — no code needed.",
    mockup: CheckoutMockup,
  },
];

/* ─────────────────────────────────────────────────────
   DOT INDICATORS
   ───────────────────────────────────────────────────── */

const DotIndicators = ({ total, current, onDotClick }: { total: number; current: number; onDotClick: (i: number) => void }) => (
  <Box sx={{ display: "flex", gap: "8px", justifyContent: "center" }}>
    {Array.from({ length: total }).map((_, i) => (
      <Box
        key={i}
        onClick={() => onDotClick(i)}
        sx={{
          width: i === current ? "22px" : "7px",
          height: "7px",
          borderRadius: "4px",
          background: i === current ? "#fff" : "rgba(255,255,255,0.30)",
          cursor: "pointer",
          transition: "all 0.35s ease",
          "&:hover": { background: i === current ? "#fff" : "rgba(255,255,255,0.5)" },
        }}
      />
    ))}
  </Box>
);

/* ─────────────────────────────────────────────────────
   MAIN COMPONENT
   ───────────────────────────────────────────────────── */

const LiveBrandContent = () => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const [current, setCurrent] = useState(0);
  const [fade, setFade] = useState(true);

  const goTo = useCallback(
    (idx: number) => {
      setFade(false);
      setTimeout(() => {
        setCurrent(idx);
        setFade(true);
      }, 280);
    },
    [],
  );

  useEffect(() => {
    const t = setInterval(() => {
      goTo((current + 1) % SLIDES.length);
    }, INTERVAL);
    return () => clearInterval(t);
  }, [current, goTo]);

  if (!isDesktop) return null;

  const slide = SLIDES[current];
  const Mockup = slide.mockup;

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
      {/* ── Text ── */}
      <Box
        sx={{
          flex: "0 0 auto",
          textAlign: "center",
          pt: "44px",
          px: "36px",
          zIndex: 2,
          opacity: fade ? 1 : 0,
          transform: fade ? "translateY(0)" : "translateY(-6px)",
          transition: "opacity 0.28s ease, transform 0.28s ease",
        }}
      >
        <Typography
          sx={{
            fontSize: "16px",
            fontWeight: 600,
            fontFamily: "UrbanistBold, sans-serif",
            color: "rgba(255,255,255,0.72)",
            mb: "2px",
          }}
        >
          {slide.tagline}
        </Typography>
        <Typography
          sx={{
            fontSize: "26px",
            fontWeight: 700,
            fontFamily: "UrbanistBold, sans-serif",
            color: "#fff",
            mb: "6px",
          }}
        >
          {slide.title}
        </Typography>
        <Typography
          sx={{
            fontSize: "13px",
            fontWeight: 400,
            fontFamily: "UrbanistMedium, sans-serif",
            color: "rgba(255,255,255,0.60)",
            lineHeight: 1.45,
            maxWidth: "320px",
            mx: "auto",
          }}
        >
          {slide.description}
        </Typography>
      </Box>

      {/* ── Mockup ── */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          px: "28px",
          pt: "20px",
          zIndex: 2,
          opacity: fade ? 1 : 0,
          transform: fade ? "translateY(0)" : "translateY(10px)",
          transition: "opacity 0.28s ease 0.04s, transform 0.28s ease 0.04s",
        }}
      >
        <Mockup />
      </Box>

      {/* ── Dots ── */}
      <Box sx={{ flex: "0 0 auto", py: "14px", zIndex: 3 }}>
        <DotIndicators total={SLIDES.length} current={current} onDotClick={goTo} />
      </Box>
    </Box>
  );
};

export default LiveBrandContent;
