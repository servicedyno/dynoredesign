import "@/styles/globals.css";
import "nprogress/nprogress.css";
import "../i18n";

import type { NextPage } from "next";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import Head from "next/head";
import React, { ReactNode, useEffect, useMemo, useState } from "react";
import NProgress from "nprogress";
import dynamic from "next/dynamic";

import type { SxProps, Theme } from "@mui/material";
import { ThemeProvider as MuiThemeProvider, CssBaseline } from "@mui/material";
import { SessionProvider } from "next-auth/react";
import { Provider } from "react-redux";

import LanguageBootstrap from "@/helpers/LanguageBootstrap";
import store from "@/store";
import { ThemeProvider as AppThemeProvider, useThemeMode } from "@/contexts/ThemeContext";

import { homeTheme, homeThemeDark } from "@/styles/homeTheme";
import { theme, themeDark } from "@/styles/theme";
import { lightTheme, darkTheme } from "@/styles/theme";

// ─── Dynamic imports: each layout only loads when its route is hit ───
const HomeLayout = dynamic(() => import("@/Containers/Home"), {
  loading: () => null,
});
const ClientLayout = dynamic(() => import("@/Containers/Client"), {
  loading: () => null,
});
const AdminLayout = dynamic(() => import("@/Containers/Admin"), {
  loading: () => null,
});
const LoginLayout = dynamic(() => import("@/Containers/Login"), {
  loading: () => null,
});
const PaymentLayout = dynamic(() => import("@/Containers/Payment"), {
  loading: () => null,
});

// -----------------------------
// Types
// -----------------------------

export type LayoutSetterProps = {
  setPageName?: (value: string) => void;
  setPageDescription?: (value: string) => void;
  setPageAction?: (value: ReactNode | null) => void;
  setPageWarning?: (value: ReactNode | null) => void;
  setPageHeaderSx?: (value: SxProps<Theme> | null) => void;
};

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
  layout?: "home" | "client" | "login" | "payment" | "pay" | "admin" | "none";
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

// -----------------------------
// Inner App (has access to theme context)
// -----------------------------

function AppInner({ Component, pageProps }: AppPropsWithLayout) {
  const router = useRouter();
  const pathname = router.pathname;
  const { isDark } = useThemeMode();

  // NProgress for route transitions
  useEffect(() => {
    NProgress.configure({ showSpinner: false, speed: 300, minimum: 0.2 });
    const handleStart = () => NProgress.start();
    const handleDone = () => NProgress.done();
    router.events.on("routeChangeStart", handleStart);
    router.events.on("routeChangeComplete", handleDone);
    router.events.on("routeChangeError", handleDone);
    return () => {
      router.events.off("routeChangeStart", handleStart);
      router.events.off("routeChangeComplete", handleDone);
      router.events.off("routeChangeError", handleDone);
    };
  }, [router]);

  const [pageName, setPageName] = useState<string>("");
  const [pageDescription, setPageDescription] = useState<string>("");
  const [pageAction, setPageAction] = useState<ReactNode | null>(null);
  const [pageWarning, setPageWarning] = useState<ReactNode | null>(null);
  const [pageHeaderSx, setPageHeaderSx] = useState<SxProps<Theme> | null>(null);

  // -----------------------------
  // Layout Resolver
  // -----------------------------

  const resolvedLayout = useMemo(() => {
    if (Component.layout) return Component.layout;

    const homePaths = new Set([
      "/",
      "/terms-conditions",
      "/privacy-policy",
      "/aml-policy",
      "/system-status",
      "/documentation",
      "/fees",
    ]);

    if (homePaths.has(pathname)) return "home";

    if (
      pathname.startsWith("/auth") ||
      pathname === "/reset-password" ||
      pathname === "/admin/login"
    ) {
      return "login";
    }

    if (pathname.startsWith("/payment")) {
      return "payment";
    }

    if (pathname.startsWith("/pay/") || pathname === "/pay") {
      return "pay";
    }

    if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
      return "admin";
    }

    return "client";
  }, [Component.layout, pathname]);

  // -----------------------------
  // Page Titles & Meta
  // -----------------------------

  const { pageTitle, pageDescription: metaDescription } = useMemo(() => {
    const BRAND = "DynoPay";

    const titles: Record<string, { title: string; desc: string }> = {
      // ─── Public / Landing ───
      "/":                    { title: `${BRAND} — Accept Crypto, Settle in Stablecoins`,       desc: "Accept BTC, ETH, and other crypto — automatically convert volatile payments into USDT or USDC with DynoPay." },
      "/fees":                { title: `Transparent Fees | ${BRAND}`,                            desc: "See exactly what you pay — no hidden charges. DynoPay's crypto payment processing fees explained." },
      "/documentation":       { title: `API Documentation | ${BRAND}`,                          desc: "Integrate crypto payments into your application with the DynoPay API." },
      "/system-status":       { title: `System Status | ${BRAND}`,                              desc: "Real-time operational status of DynoPay services and APIs." },
      "/terms-conditions":    { title: `Terms & Conditions | ${BRAND}`,                         desc: "Terms and conditions for using the DynoPay crypto payment platform." },
      "/privacy-policy":      { title: `Privacy Policy | ${BRAND}`,                             desc: "How DynoPay collects, uses, and protects your personal data." },
      "/aml-policy":          { title: `AML Policy | ${BRAND}`,                                 desc: "DynoPay's Anti-Money Laundering compliance policy." },

      // ─── Auth ───
      "/auth/login":          { title: `Log In | ${BRAND}`,                                     desc: "Sign in to your DynoPay merchant account." },
      "/auth/register":       { title: `Create Account | ${BRAND}`,                             desc: "Register a new DynoPay merchant account and start accepting crypto." },
      "/auth/validateSocialLogin": { title: `Verifying Login | ${BRAND}`,                       desc: "Completing your social login…" },
      "/reset-password":      { title: `Reset Password | ${BRAND}`,                             desc: "Reset your DynoPay account password." },

      // ─── Dashboard / App ───
      "/dashboard":           { title: `Dashboard | ${BRAND}`,                                  desc: "Overview of your crypto payment activity." },
      "/transactions":        { title: `Transactions | ${BRAND}`,                               desc: "View and manage all your crypto transactions." },
      "/pay-links":           { title: `Payment Links | ${BRAND}`,                              desc: "Create and manage crypto payment links." },
      "/pay-links/[slug]":    { title: `Edit Payment Link | ${BRAND}`,                          desc: "Edit your payment link details." },
      "/create-pay-link":     { title: `Create Payment Link | ${BRAND}`,                        desc: "Create a new crypto payment link." },
      "/wallet":              { title: `Wallets | ${BRAND}`,                                    desc: "Manage your cryptocurrency wallets." },
      "/customers":           { title: `Customers | ${BRAND}`,                                  desc: "View and manage your customer records." },
      "/developer-keys":      { title: `API Keys | ${BRAND}`,                                   desc: "Manage your DynoPay API keys and integrations." },
      "/invoices":            { title: `Invoices & Tax | ${BRAND}`,                             desc: "Tax-compliant invoices and export reports." },
      "/company":             { title: `Company | ${BRAND}`,                                    desc: "Manage your company profile and settings." },
      "/profile":             { title: `Profile | ${BRAND}`,                                    desc: "Manage your account profile." },
      "/notifications":       { title: `Notifications | ${BRAND}`,                              desc: "Your latest alerts and notifications." },
      "/referrals":           { title: `Referrals | ${BRAND}`,                                  desc: "Invite others and earn rewards with DynoPay." },
      "/settings":            { title: `Settings | ${BRAND}`,                                   desc: "Configure your DynoPay account preferences." },
      "/help-support":        { title: `Help & Support | ${BRAND}`,                             desc: "Get help with DynoPay features and troubleshooting." },
      "/help-support/[slug]": { title: `Help Article | ${BRAND}`,                               desc: "DynoPay help center article." },

      // ─── Checkout / Pay ───
      "/pay":                 { title: `Pay | ${BRAND}`,                                        desc: "Complete your crypto payment." },
      "/pay/demo":            { title: `Checkout Demo | ${BRAND}`,                              desc: "Demo of the DynoPay checkout experience." },
      "/pay/aml-policy":      { title: `AML Policy — Checkout | ${BRAND}`,                      desc: "Anti-Money Laundering policy for DynoPay payments." },
      "/pay/terms-of-service":{ title: `Terms of Service — Checkout | ${BRAND}`,                desc: "Terms of service for DynoPay checkout." },
      "/pay/payment-states-demo": { title: `Payment States Demo | ${BRAND}`,                    desc: "Demo of DynoPay payment state transitions." },
      "/pay/success-demo":    { title: `Success Demo | ${BRAND}`,                               desc: "Demo of DynoPay payment success flow." },
      "/payment":             { title: `Payment | ${BRAND}`,                                    desc: "Processing your crypto payment." },
      "/payment/success":     { title: `Payment Successful | ${BRAND}`,                         desc: "Your crypto payment was processed successfully." },
      "/payment/failed":      { title: `Payment Failed | ${BRAND}`,                             desc: "Your crypto payment could not be processed." },
      "/payment/verify":      { title: `Verifying Payment | ${BRAND}`,                          desc: "Verifying your crypto payment on the blockchain." },

      // ─── Admin ───
      "/admin":               { title: `Admin Dashboard | ${BRAND}`,                            desc: "DynoPay administration panel." },
      "/admin/login":         { title: `Admin Login | ${BRAND}`,                                desc: "Sign in to the DynoPay admin panel." },
      "/admin/fee":           { title: `Fee Management | ${BRAND} Admin`,                       desc: "Manage platform fee tiers and settings." },
      "/admin/wallet":        { title: `Wallet Management | ${BRAND} Admin`,                    desc: "Admin wallet configuration." },
      "/admin/withdraw":      { title: `Withdrawals | ${BRAND} Admin`,                          desc: "Manage withdrawal requests." },
      "/admin/transferSpeed": { title: `Transfer Speed | ${BRAND} Admin`,                       desc: "Configure blockchain transfer speed settings." },
      "/admin/profile":       { title: `Admin Profile | ${BRAND}`,                              desc: "Manage your admin profile." },
    };

    const match = titles[pathname];
    return {
      pageTitle: match?.title ?? `${BRAND} — Crypto Payment Gateway`,
      pageDescription: match?.desc ?? "DynoPay — Accept crypto payments and settle in stablecoins. The simplest way to integrate cryptocurrency payments.",
    };
  }, [pathname]);

  const pageSetterProps: LayoutSetterProps = {
    setPageName,
    setPageDescription,
    setPageAction,
    setPageWarning,
    setPageHeaderSx,
  };

  // Pick the right MUI theme based on layout + dark mode
  const activeTheme = useMemo(() => {
    switch (resolvedLayout) {
      case "home":
        return isDark ? homeThemeDark : homeTheme;
      case "pay":
        return isDark ? darkTheme : lightTheme;
      default:
        return isDark ? themeDark : theme;
    }
  }, [resolvedLayout, isDark]);

  const renderWithLayout = () => {
    switch (resolvedLayout) {
      case "home":
        return (
          <HomeLayout>
            <Component {...pageProps} />
          </HomeLayout>
        );

      case "login":
        return (
          <LoginLayout pageName={pageName} pageDescription={pageDescription}>
            <Component {...pageProps} {...pageSetterProps} />
          </LoginLayout>
        );

      case "payment":
        return (
          <PaymentLayout pageName={pageName} pageDescription={pageDescription}>
            <Component {...pageProps} {...pageSetterProps} />
          </PaymentLayout>
        );

      case "pay":
        return (
          <PaymentLayout pageName={pageName} pageDescription={pageDescription}>
            <Component {...pageProps} {...pageSetterProps} />
          </PaymentLayout>
        );

      case "admin":
        return (
          <AdminLayout pageName={pageName} pageDescription={pageDescription}>
            <Component {...pageProps} {...pageSetterProps} />
          </AdminLayout>
        );

      case "none":
        return <Component {...pageProps} {...pageSetterProps} />;

      default:
        return (
          <ClientLayout
            pageName={pageName}
            pageDescription={pageDescription}
            pageAction={pageAction}
            pageWarning={pageWarning}
            pageHeaderSx={pageHeaderSx || undefined}
          >
            <Component {...pageProps} {...pageSetterProps} />
          </ClientLayout>
        );
    }
  };

  return (
    <MuiThemeProvider theme={activeTheme}>
      <CssBaseline />
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={metaDescription} />
      </Head>
      {renderWithLayout()}
    </MuiThemeProvider>
  );
}

// -----------------------------
// App Component
// -----------------------------

export default function App(props: AppPropsWithLayout) {
  return (
    <Provider store={store}>
      <LanguageBootstrap />
      <SessionProvider session={props.pageProps.session} refetchInterval={0} refetchOnWindowFocus={false}>
        <AppThemeProvider>
          <AppInner {...props} />
        </AppThemeProvider>
      </SessionProvider>
    </Provider>
  );
}
