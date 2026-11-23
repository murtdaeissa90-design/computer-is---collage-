"use client";

import { useEffect } from "react";

// تسجيل service worker (في النسخة المنشورة فقط، وليس أثناء التطوير)
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const reg = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => console.warn("SW:", e));
    if (document.readyState === "complete") reg();
    else window.addEventListener("load", reg, { once: true });
  }, []);
  return null;
}
