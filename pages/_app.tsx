import "@/styles/globals.css";
import "../i18n";

import type { NextPage } from "next";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import React, { ReactNode, useMemo, useState } from "react";

import type { SxProps, Theme } from "@mui/material";
import { ThemeProvider as MuiThemeProvider } from "@mui/material";
import { SessionProvider } from "next-auth/react";
import { Provider } from "react-redux";

import LanguageBootstrap from "@/helpers/LanguageBootstrap";
import store from "@/store";
import { ThemeProvider as AppThemeProvider, useThemeMode } from "@/contexts/ThemeContext";

import {
  AdminLayout,
  ClientLayout,
  LoginLayout,
  PaymentLayout,
} from "@/Containers";
import HomeLayout from "@/Containers/Home";

import { homeTheme, homeThemeDark } from "@/styles/homeTheme";
import { theme, themeDark } from "@/styles/theme";
import { lightTheme, darkTheme } from "@/styles/theme";

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
      <SessionProvider session={props.pageProps.session}>
        <AppThemeProvider>
          <AppInner {...props} />
        </AppThemeProvider>
      </SessionProvider>
    </Provider>
  );
}
