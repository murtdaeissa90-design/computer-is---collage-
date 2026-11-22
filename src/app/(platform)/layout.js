import Shell from "@/components/Shell";
import Script from "next/script";

export default function PlatformLayout({ children }) {
  return (
    <>
      <Script src="https://www.googletagmanager.com/gtag/js?id=G-QPFKF4H8Z8" strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-QPFKF4H8Z8');
        `}
      </Script>
      <Shell>{children}</Shell>
    </>
  );
}