import "@/styles/globals.css";
import "nprogress/nprogress.css";
import "../i18n";

import type { NextPage } from "next";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
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
