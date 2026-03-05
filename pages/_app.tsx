import "@/styles/globals.css";
import "../i18n";

import type { NextPage } from "next";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { ReactNode, useMemo, useState } from "react";

import type { SxProps, Theme } from "@mui/material";
import { ThemeProvider } from "@mui/material";
import { SessionProvider } from "next-auth/react";
import { Provider } from "react-redux";

import LanguageBootstrap from "@/helpers/LanguageBootstrap";
import store from "@/store";

import {
  AdminLayout,
  ClientLayout,
  LoginLayout,
  PaymentLayout,
} from "@/Containers";
import HomeLayout from "@/Containers/Home";

import { homeTheme } from "@/styles/homeTheme";
import { theme } from "@/styles/theme";

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
  layout?: "home" | "client" | "login" | "payment" | "admin" | "none";
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

// -----------------------------
// App Component
// -----------------------------

export default function App({ Component, pageProps }: AppPropsWithLayout) {
  const router = useRouter();
  const pathname = router.pathname;

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
      "/api-status",
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

  const renderWithLayout = () => {
    switch (resolvedLayout) {
      case "home":
        return (
          <ThemeProvider theme={homeTheme}>
            <HomeLayout>
              <Component {...pageProps} />
            </HomeLayout>
          </ThemeProvider>
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
    <Provider store={store}>
      <LanguageBootstrap />
      <SessionProvider session={pageProps.session}>
        <ThemeProvider theme={theme}>{renderWithLayout()}</ThemeProvider>
      </SessionProvider>
    </Provider>
  );
}
