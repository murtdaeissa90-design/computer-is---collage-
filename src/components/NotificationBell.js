"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "./AppProvider";
import { useAuth } from "./AuthProvider";
import { supabase } from "@/lib/supabase";

/** جرس الإشعارات 🔔: يقرأ جدول notifications (الطالب يرى إشعاراته فقط بفضل RLS) */
export default function NotificationBell() {
  const { L, lang } = useApp();
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const uid = user?.id;

  const load = useCallback(async () => {
    if (!uid) return;
    const { data, error } = await supabase
      .from("notifications")
      .select("id,title_ar,title_en,body_ar,body_en,link,read,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error) setItems(data || []);
    // إن لم يُشغَّل notifications.sql بعد يظهر خطأ هنا فنتجاهله بصمت
  }, [uid]);

  useEffect(() => {
    load();
    if (!uid) return;
    // تحديث دوري + إشعار لحظي (Realtime) إن كان مفعّلاً
    const timer = setInterval(load, 60000);
    const channel = supabase
      .channel("notif-" + uid)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: "user_id=eq." + uid }, load)
      .subscribe();
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [uid, load]);

  // إغلاق عند الضغط خارج القائمة
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (box.current && !box.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const unread = items.filter((n) => !n.read).length;

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread) {
      setItems((list) => list.map((n) => ({ ...n, read: true })));
      await supabase.from("notifications").update({ read: true }).eq("read", false);
    }
  };

  const go = (n) => {
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const when = (iso) =>
    new Date(iso).toLocaleDateString(lang === "ar" ? "ar" : "en", { day: "numeric", month: "short" });

  return (
    <span className="nb-wrap" ref={box}>
      <button type="button" onClick={toggle} aria-label={L("Notifications", "الإشعارات")} aria-expanded={open}>
        🔔{unread > 0 && <span className="nb-badge mono">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="nb-panel" role="dialog" aria-label={L("Notifications", "الإشعارات")}>
          <div className="nb-head">{L("Notifications", "الإشعارات")}</div>
          {items.length === 0 && <div className="nb-empty">{L("No notifications yet.", "لا توجد إشعارات بعد.")}</div>}
          {items.map((n) => (
            <button type="button" key={n.id} className={"nb-item" + (n.read ? "" : " new")} onClick={() => go(n)}>
              <b>{lang === "ar" ? n.title_ar : n.title_en}</b>
              <span>{lang === "ar" ? n.body_ar : n.body_en}</span>
              <small className="mono">{when(n.created_at)}</small>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
