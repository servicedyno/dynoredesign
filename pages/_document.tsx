import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Favicon */}
        <link rel="icon" type="image/png" href="/dynopay-favicon.png" />
        <link rel="apple-touch-icon" href="/dynopay-favicon.png" />
        {/* Google Identity Services for client-side OAuth (bypasses NextAuth /api/auth/* K8s conflict) */}
        <script src="https://accounts.google.com/gsi/client" async defer></script>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
