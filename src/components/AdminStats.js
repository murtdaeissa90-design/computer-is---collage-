"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "./AppProvider";
import { supabase } from "@/lib/supabase";
import "./AdminStats.css";

const PERIODS = [
  [7, "7 days", "7 أيام"],
  [30, "30 days", "30 يوماً"],
  [0, "All time", "الكل"],
];

const n = (v) => Number(v) || 0;

/** نسبة التغير عن الفترة السابقة: null = لا مقارنة، "new" = لا شيء قبلها */
function delta(cur, prev, hasPrev) {
  if (!hasPrev) return null;
  if (!prev) return cur > 0 ? "new" : null;
  return Math.round(((cur - prev) / prev) * 100);
}

function Delta({ d, L }) {
  if (d === null || d === undefined) return null;
  if (d === "new") return <span className="sx-delta up">{L("New", "جديد")}</span>;
  if (d === 0) return <span className="sx-delta">0%</span>;
  return <span className={"sx-delta " + (d > 0 ? "up" : "down")}>{d > 0 ? "▲" : "▼"} {Math.abs(d)}%</span>;
}

function Kpi({ icon, label, value, sub, d, L }) {
  return (
    <div className="sx-kpi">
      <div className="sx-kpi-top"><span className="sx-ico" aria-hidden="true">{icon}</span><span>{label}</span></div>
      <div className="sx-kpi-val mono">{value}</div>
      <div className="sx-kpi-sub">{sub}<Delta d={d} L={L} /></div>
    </div>
  );
}

/** رسم يومي: أعمدة مكدّسة (دخول المواد + تنزيل الملفات). اتجاه الوقت ثابت يسار→يمين. */
function Trend({ daily, lang, L }) {
  const [sel, setSel] = useState(null);
  const W = 640, H = 200, PL = 36, PB = 26, PT = 10;
  const max = Math.max(4, ...daily.map((d) => n(d.views) + n(d.downloads)));
  const top = Math.ceil(max / 4) * 4;
  const bw = (W - PL) / daily.length;
  const fmt = (s, opts) => new Date(s + "T00:00:00").toLocaleDateString(lang === "ar" ? "ar" : "en", opts);
  const idx = sel === null ? daily.length - 1 : sel;
  const cur = daily[idx];
  const y = (v) => PT + (H - PT - PB) * (1 - v / top);
  const every = Math.ceil(daily.length / 6);

  return (
    <div className="sx-card">
      <div className="sx-card-h">
        <h3 className="st-title">{L("Daily activity", "النشاط اليومي")}</h3>
        <div className="sx-legend"><i className="v" />{L("Visits", "دخول")}<i className="d" />{L("Downloads", "تنزيل")}</div>
      </div>
      {cur && (
        <div className="sx-sel" aria-live="polite">
          <b>{fmt(cur.day, { weekday: "long", day: "numeric", month: "long" })}</b>
          <span className="mono">👁 {n(cur.views)} · ⬇ {n(cur.downloads)} · 👥 {n(cur.students)}</span>
        </div>
      )}
      <div className="sx-chart" dir="ltr">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={L("Daily activity chart", "رسم النشاط اليومي")}>
          {[0, 1, 2, 3, 4].map((i) => {
            const v = (top / 4) * i;
            return (
              <g key={i}>
                <line x1={PL} x2={W} y1={y(v)} y2={y(v)} className="sx-grid" />
                <text x={PL - 6} y={y(v) + 4} textAnchor="end" className="sx-axis">{v}</text>
              </g>
            );
          })}
          {daily.map((d, i) => {
            const v = n(d.views), dl = n(d.downloads);
            const x = PL + i * bw + bw * 0.14, w = bw * 0.72;
            return (
              <g key={d.day} onMouseEnter={() => setSel(i)} onClick={() => setSel(i)} className={"sx-col" + (i === idx ? " on" : "")}>
                <rect x={PL + i * bw} y={PT} width={bw} height={H - PT - PB} fill="transparent" />
                {v > 0 && <rect x={x} y={y(v)} width={w} height={y(0) - y(v)} rx="2" className="sx-bar-v" />}
                {dl > 0 && <rect x={x} y={y(v + dl)} width={w} height={y(v) - y(v + dl)} rx="2" className="sx-bar-d" />}
                {i % every === 0 && (
                  <text x={PL + i * bw + bw / 2} y={H - 7} textAnchor="middle" className="sx-axis">
                    {fmt(d.day, { day: "numeric", month: "short" })}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function Hours({ hours, L }) {
  const max = Math.max(1, ...hours.map((h) => n(h.events)));
  const peak = hours.reduce((a, h) => (n(h.events) > n(a.events) ? h : a), hours[0] || { hour: 0, events: 0 });
  const label = (h) => `${String(h).padStart(2, "0")}:00`;
  return (
    <div className="sx-card">
      <div className="sx-card-h">
        <h3 className="st-title">{L("Peak hours", "ساعات الذروة")}</h3>
        {n(peak.events) > 0 && <span className="sx-peak">{L("Busiest", "الأكثر ازدحاماً")}: <b className="mono">{label(peak.hour)}</b></span>}
      </div>
      <div className="sx-hours" dir="ltr">
        {hours.map((h) => (
          <div key={h.hour} className="sx-hcol" title={`${label(h.hour)} — ${n(h.events)}`}>
            <i style={{ height: Math.max(n(h.events) ? 8 : 3, (n(h.events) / max) * 100) + "%" }} className={n(h.events) === max && max > 0 ? "peak" : ""} />
            {h.hour % 6 === 0 && <span>{h.hour}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function csv(rows) {
  const esc = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  return "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
}

/** إحصاءات الأدمن v2: ملخص مع مقارنة بالفترة السابقة، رسم يومي، ساعات الذروة، المواد، الملفات */
export default function AdminStats() {
  const { L, lang } = useApp();
  const [days, setDays] = useState(30);
  const [withAdmins, setWithAdmins] = useState(false);
  const [state, setState] = useState({ status: "loading" }); // loading | ok | legacy | error
  const tz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }, []);

  useEffect(() => {
    let alive = true;
    setState((s) => (s.status === "ok" ? { ...s, busy: true } : { status: "loading" }));
    const a = { p_days: days, p_tz: tz, p_include_admins: withAdmins };
    (async () => {
      const [ov, dl, sb, fl, hr] = await Promise.all([
        supabase.rpc("stats2_overview", a),
        supabase.rpc("stats2_daily", a),
        supabase.rpc("stats2_subjects", a),
        supabase.rpc("stats2_files", { ...a, p_limit: 10 }),
        supabase.rpc("stats2_hours", a),
      ]);
      if (!alive) return;
      if (!ov.error && !dl.error && !sb.error) {
        setState({
          status: "ok",
          overview: (ov.data && ov.data[0]) || null,
          daily: dl.data || [],
          subjects: sb.data || [],
          files: fl.error ? [] : fl.data || [],
          hours: hr.error ? [] : hr.data || [],
        });
        return;
      }
      // v2 غير مثبّتة بعد: نرجع للإحصاءات الأساسية (stats.sql)
      const [s, f] = await Promise.all([
        supabase.rpc("stats_by_subject", { p_days: days }),
        supabase.rpc("stats_top_files", { p_days: days, p_limit: 10 }),
      ]);
      if (!alive) return;
      if (s.error) setState({ status: "error" });
      else
        setState({
          status: "legacy",
          subjects: s.data || [],
          files: (f.error ? [] : f.data || []).map((x) => ({ ...x, students: null })),
        });
    })();
    return () => {
      alive = false;
    };
  }, [days, withAdmins, tz]);

  const { status } = state;
  const subjects = state.subjects || [];
  const files = state.files || [];
  const ov = state.overview;
  const hasPrev = days > 0;
  const maxSub = Math.max(1, ...subjects.map((r) => n(r.views) + n(r.downloads)));

  const exportCsv = () => {
    const rows = [["subject", "views", "downloads", "students"], ...subjects.map((r) => [r.subject, r.views, r.downloads, r.visitors])];
    if (files.length) rows.push([], ["file", "subject", "material", "downloads"], ...files.map((f) => [f.file_name, f.subject, f.material, f.downloads]));
    const url = URL.createObjectURL(new Blob([csv(rows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `students-is-stats-${days || "all"}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      <h2 className="ad-section">{L("📊 Usage statistics", "📊 إحصاءات الاستخدام")}</h2>

      <div className="sx-bar">
        <div className="st-periods">
          {PERIODS.map(([d, en, ar]) => (
            <button key={d} type="button" className={"st-chip" + (days === d ? " active" : "")} onClick={() => setDays(d)}>
              {L(en, ar)}
            </button>
          ))}
        </div>
        <div className="sx-tools">
          {status === "ok" && (
            <label className="sx-toggle">
              <input type="checkbox" checked={withAdmins} onChange={(e) => setWithAdmins(e.target.checked)} />
              <span>{L("Include admin activity", "تضمين نشاط الأدمن")}</span>
            </label>
          )}
          {(status === "ok" || status === "legacy") && subjects.length > 0 && (
            <button type="button" className="st-chip" onClick={exportCsv}>{L("⬇ CSV", "⬇ CSV")}</button>
          )}
        </div>
      </div>

      {status === "loading" && <div className="empty">{L("Loading...", "جارٍ التحميل...")}</div>}
      {status === "error" && (
        <div className="empty">{L("Could not load statistics. Run supabase/stats.sql and make sure your account is an admin.", "تعذر تحميل الإحصاءات. شغّل ملف supabase/stats.sql وتأكد أن حسابك أدمن.")}</div>
      )}
      {status === "legacy" && (
        <div className="sx-upgrade">
          {L("Showing basic statistics. Run supabase/stats_v2.sql in the SQL Editor to unlock the summary, daily chart, peak hours and more accurate numbers.", "تُعرض الإحصاءات الأساسية. شغّل ملف supabase/stats_v2.sql من SQL Editor لتفعيل الملخص والرسم اليومي وساعات الذروة وأرقام أدق.")}
        </div>
      )}

      {status === "ok" && (
        <div className={state.busy ? "sx-busy" : ""}>
          <div className="sx-kpis">
            <Kpi icon="👁" L={L} label={L("Subject visits", "دخول المواد")} value={n(ov?.views)} d={delta(n(ov?.views), n(ov?.prev_views), hasPrev)}
              sub={hasPrev ? L("vs previous period", "مقارنة بالفترة السابقة") : L("all time", "كل الوقت")} />
            <Kpi icon="⬇" L={L} label={L("Files opened", "ملفات فُتحت")} value={n(ov?.downloads)} d={delta(n(ov?.downloads), n(ov?.prev_downloads), hasPrev)}
              sub={hasPrev ? L("vs previous period", "مقارنة بالفترة السابقة") : L("all time", "كل الوقت")} />
            <Kpi icon="👥" L={L} label={L("Active students", "طلاب نشطون")} value={n(ov?.active_students)} d={delta(n(ov?.active_students), n(ov?.prev_active), hasPrev)}
              sub={L(`of ${n(ov?.total_students)} registered`, `من ${n(ov?.total_students)} مسجّل`)} />
            <Kpi icon="📈" L={L} label={L("Engagement", "نسبة التفاعل")}
              value={n(ov?.total_students) ? Math.round((n(ov?.active_students) / n(ov?.total_students)) * 100) + "%" : "–"}
              sub={L("active ÷ registered", "النشطون ÷ المسجلون")} />
          </div>

          {state.daily.length > 0 && <Trend daily={state.daily} lang={lang} L={L} />}
          {state.hours.length > 0 && <Hours hours={state.hours} L={L} />}
        </div>
      )}

      {(status === "ok" || status === "legacy") && subjects.length === 0 && (
        <div className="empty">{L("No activity recorded for this period.", "لا يوجد نشاط مسجّل في هذه الفترة.")}</div>
      )}

      {subjects.length > 0 && (
        <div className="st-list">
          <h3 className="st-title">{L("Most active subjects", "أكثر المواد نشاطاً")}</h3>
          {subjects.slice(0, 10).map((r, i) => {
            const v = n(r.views), d = n(r.downloads);
            return (
              <div className="st-row" key={r.subject}>
                <div className="st-head">
                  <b><span className="mono">{i + 1}.</span> {r.subject}</b>
                  <span className="st-nums mono">👁 {v} · ⬇ {d} · 👥 {n(r.visitors)}</span>
                </div>
                <div className="st-bar sx-stack">
                  <i className="v" style={{ width: (v / maxSub) * 100 + "%" }} />
                  <i className="d" style={{ width: (d / maxSub) * 100 + "%" }} />
                </div>
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
              <em>{f.subject} · {f.material}{f.students ? ` · 👥 ${f.students}` : ""}</em>
              <b className="mono">⬇ {f.downloads}</b>
            </div>
          ))}
        </div>
      )}

      {status === "ok" && !withAdmins && (
        <p className="ad-note">{L("Admin activity is excluded so your own testing doesn't skew the numbers. Days follow your local time.", "نشاط الأدمن مستثنى حتى لا تؤثر تجاربك على الأرقام. الأيام بحسب توقيتك المحلي.")}</p>
      )}
    </>
  );
}
