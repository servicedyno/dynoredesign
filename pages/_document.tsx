import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
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
