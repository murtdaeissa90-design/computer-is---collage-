"use client";

import { useEffect, useState } from "react";
import { useApp } from "./AppProvider";
import { supabase } from "@/lib/supabase";

const PERIODS = [
  [7, "7 days", "7 أيام"],
  [30, "30 days", "30 يوماً"],
  [0, "All time", "الكل"],
];

/** إحصاءات الأدمن: أكثر المواد دخولاً وأكثر الملفات فتحاً */
export default function AdminStats() {
  const { L } = useApp();
  const [days, setDays] = useState(30);
  const [subjects, setSubjects] = useState(null); // null = تحميل
  const [files, setFiles] = useState([]);

  useEffect(() => {
    let alive = true;
    setSubjects(null);
    Promise.all([
      supabase.rpc("stats_by_subject", { p_days: days }),
      supabase.rpc("stats_top_files", { p_days: days, p_limit: 10 }),
    ]).then(([s, f]) => {
      if (!alive) return;
      setSubjects(s.error ? "error" : s.data || []);
      setFiles(f.error ? [] : f.data || []);
    });
    return () => {
      alive = false;
    };
  }, [days]);

  const rows = Array.isArray(subjects) ? subjects : [];
  const max = Math.max(1, ...rows.map((r) => Number(r.views) + Number(r.downloads)));

  return (
    <>
      <h2 className="ad-section">{L("📊 Usage statistics", "📊 إحصاءات الاستخدام")}</h2>
      <div className="st-periods">
        {PERIODS.map(([d, en, ar]) => (
          <button key={d} type="button" className={"st-chip" + (days === d ? " active" : "")} onClick={() => setDays(d)}>
            {L(en, ar)}
          </button>
        ))}
      </div>

      {subjects === null && <div className="empty">{L("Loading...", "جارٍ التحميل...")}</div>}
      {subjects === "error" && (
        <div className="empty">{L("Could not load statistics. Run supabase/stats.sql and make sure your account is an admin.", "تعذر تحميل الإحصاءات. شغّل ملف supabase/stats.sql وتأكد أن حسابك أدمن.")}</div>
      )}
      {Array.isArray(subjects) && rows.length === 0 && (
        <div className="empty">{L("No activity recorded yet.", "لا يوجد نشاط مسجّل بعد.")}</div>
      )}

      {rows.length > 0 && (
        <div className="st-list">
          <h3 className="st-title">{L("Most active subjects", "أكثر المواد نشاطاً")}</h3>
          {rows.slice(0, 10).map((r, i) => {
            const total = Number(r.views) + Number(r.downloads);
            return (
              <div className="st-row" key={r.subject}>
                <div className="st-head">
                  <b><span className="mono">{i + 1}.</span> {r.subject}</b>
                  <span className="st-nums mono">
                    👁 {r.views} · ⬇ {r.downloads} · 👥 {r.visitors}
                  </span>
                </div>
                <div className="st-bar"><i style={{ width: Math.max(4, (total / max) * 100) + "%" }} /></div>
              </div>
            );
          })}
          <p className="ad-note">
            {L("👁 subject visits · ⬇ files opened/downloaded · 👥 distinct students", "👁 دخول المادة · ⬇ فتح/تنزيل ملف · 👥 عدد الطلاب المختلفين")}
          </p>
        </div>
      )}

      {files.length > 0 && (
        <div className="st-list">
          <h3 className="st-title">{L("Most downloaded files", "أكثر الملفات تنزيلاً")}</h3>
          {files.map((f, i) => (
            <div className="st-file" key={f.file_name + f.subject + i}>
              <span><span className="mono">{i + 1}.</span> 📄 {f.file_name}</span>
              <em>{f.subject} · {f.material}</em>
              <b className="mono">⬇ {f.downloads}</b>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
