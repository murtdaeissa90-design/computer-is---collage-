"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link"; 
import { useApp } from "./AppProvider";
import { useAuth } from "./AuthProvider";
import { supabase, BUCKET, PENDING_BUCKET, SUPABASE_URL } from "@/lib/supabase";
import { safeHref } from "@/lib/files";
import { fuzzySearch } from "@/lib/search"; 
import { approveSubmission } from "@/lib/api";
import AdminStats from "./AdminStats";

/** رابط التخزين العام -> مسار الملف داخل الـ bucket */
function storagePathFromUrl(url) {
  const marker = "/storage/v1/object/public/" + BUCKET + "/";
  const s = String(url || "");
  if (!s.startsWith(SUPABASE_URL)) return null;
  const i = s.indexOf(marker);
  if (i === -1) return null;
  try {
    return decodeURIComponent(s.slice(i + marker.length).split("?")[0]);
  } catch {
    return null;
  }
}

/**
 * أين يوجد ملف هذا الصف؟
 * - v1.2: path مسار داخل التخزين (pending-uploads قبل الموافقة، Twix بعدها)
 * - الصفوف القديمة: path رابط كامل. إن لم يكن من تخزين مشروعنا نعلّمه "خارجي" ولا نفتحه تلقائياً.
 */
function locate(row) {
  const p = String(row.path || "");
  if (/^[a-z][a-z0-9+.-]*:/i.test(p)) {
    const inner = storagePathFromUrl(p);
    if (inner) return { bucket: BUCKET, path: inner };
    return { external: true, url: safeHref(p), raw: p };
  }
  if (!p || p.includes("..")) return { external: true, url: null, raw: p };
  return { bucket: row.approved ? BUCKET : PENDING_BUCKET, path: p };
}

async function openRow(row) {
  const loc = locate(row);
  if (loc.external) {
    if (!loc.url) return alert("⚠️ Unsafe link blocked / رابط غير آمن تم حظره:\n" + loc.raw);
    if (!confirm("⚠️ External link (not from the platform storage). Open anyway?\nرابط خارجي ليس من تخزين المنصة. فتحه؟\n\n" + loc.url)) return;
    return window.open(loc.url, "_blank", "noopener");
  }
  if (loc.bucket === PENDING_BUCKET) {
    const { data, error } = await supabase.storage.from(PENDING_BUCKET).createSignedUrl(loc.path, 600);
    if (error || !data?.signedUrl) return alert("Could not open the file / تعذر فتح الملف");
    return window.open(data.signedUrl, "_blank", "noopener");
  }
  window.open(supabase.storage.from(BUCKET).getPublicUrl(loc.path).data.publicUrl, "_blank", "noopener");
}

/** الطريق الاحتياطي للموافقة (إن لم تكن دالة approve-submission منشورة): نقل الملف من الانتظار إلى Twix/approved */
async function approveDirect(row) {
  const loc = locate(row);
  let newPath = row.path;
  if (!loc.external && loc.bucket === PENDING_BUCKET) {
    const dl = await supabase.storage.from(PENDING_BUCKET).download(loc.path);
    if (dl.error) throw dl.error;
    newPath = "approved/" + loc.path;
    const up = await supabase.storage.from(BUCKET).upload(newPath, dl.data, { upsert: true, contentType: dl.data.type || undefined });
    if (up.error) throw up.error;
  }
  const { error } = await supabase.from("submissions").update({ approved: true, path: newPath }).eq("id", row.id);
  if (error) throw error;
  if (newPath !== row.path) await supabase.storage.from(PENDING_BUCKET).remove([loc.path]).catch(() => {});
}

export default function AdminDashboard() {
  const { L, lang, toggleLang } = useApp();
  const { displayName, user, signOut } = useAuth();

  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState(null);
  const [approved, setApproved] = useState(null);
  const [students, setStudents] = useState(null);
  const [studentQ, setStudentQ] = useState("");
  const [flashMsg, setFlashMsg] = useState("");

  const flash = (text) => {
    setFlashMsg(text);
    setTimeout(() => setFlashMsg(""), 8000);
  };

  const loadAll = useCallback(async () => {
    const [p, a, ps, as] = await Promise.all([
      supabase.from("submissions").select("*").eq("approved", false).order("created_at", { ascending: false }),
      supabase.from("submissions").select("*").eq("approved", true).order("created_at", { ascending: false }).limit(200),
      supabase.from("submissions").select("id", { count: "exact", head: true }).eq("approved", false),
      supabase.from("submissions").select("id", { count: "exact", head: true }).eq("approved", true),
    ]);
    setPending(p.error ? "error" : p.data || []);
    setApproved(a.error ? "error" : a.data || []);
    setStats(ps.error || as.error ? null : { pending: ps.count ?? 0, approved: as.count ?? 0 });
  }, []);

  const loadStudents = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,full_name,email,role,created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    setStudents(error ? "error" : data || []);
  }, []);

  useEffect(() => {
    loadAll();
    loadStudents();
  }, [loadAll, loadStudents]);

  // الموافقة تمر عبر Edge Function (approve-submission): تعتمد الملف وترسل إشعاراً للطالب.
  // إن لم تكن الدالة منشورة بعد، نرجع للموافقة المباشرة (بدون إشعار) كي لا يتعطل العمل.
  const approve = async (row) => {
    try {
      const res = await approveSubmission(row.id);
      if (res?.notified) flash(L("Approved ✅ and the student was notified.", "تمت الموافقة ✅ وتم إشعار الطالب."));
      else flash(L("Approved ✅ (no student account linked, so no notification).", "تمت الموافقة ✅ (الملف غير مرتبط بحساب طالب فلم يُرسل إشعار)."));
    } catch (e) {
      console.error(e);
      if (e.code === "forbidden" || e.code === "unauthorized") {
        alert(L("You don't have permission.", "لا تملك الصلاحية."));
        return;
      }
      try {
        await approveDirect(row);
      } catch (err) {
        console.error(err);
        alert(L("Could not approve the file.", "تعذرت الموافقة."));
        return;
      }
      flash(L("Approved, but the notification function is unavailable (is it deployed?).", "تمت الموافقة، لكن دالة الإشعارات غير متاحة (هل نُشرت؟)."));
    }
    loadAll();
  };

  const remove = async (row) => {
    if (!confirm(L("Delete this file permanently?", "حذف هذا الملف نهائياً؟"))) return;
    let note = "";
    const loc = locate(row);
    if (!loc.external) {
      const { data, error } = await supabase.storage.from(loc.bucket).remove([loc.path]);
      if (error) {
        console.error(error);
        note = L("Could not delete the file from storage. Check the storage delete policy.", "تعذر حذف الملف من التخزين، تحقق من صلاحية الحذف على Storage.");
      } else if (!data || !data.length) {
        note = L("File not found in storage (already deleted, or no delete permission).", "لم يُعثر على الملف في التخزين (ربما حُذف مسبقاً أو لا توجد صلاحية حذف).");
      }
    }
    const { error: dbErr } = await supabase.from("submissions").delete().eq("id", row.id);
    if (dbErr) {
      console.error(dbErr);
      alert(L("Could not delete.", "تعذر الحذف."));
      return;
    }
    if (note) flash(L("Record deleted. ", "تم حذف السجل من المنصة. ") + note);
    loadAll();
  };

  // البحث التلقائي عن الطلاب: يتحمل الأخطاء الإملائية، ويظهر للأدمن فقط
  const shownStudents = useMemo(() => {
    if (!Array.isArray(students)) return [];
    if (!studentQ.trim()) return students.slice(0, 50);
    return fuzzySearch(students, studentQ, (s) => [s.full_name, s.email], 50);
  }, [students, studentQ]);

  const empty = (t) => <div className="empty">{t}</div>;

  return (
    <div className="ad-page">
      <header className="ad-header">
        <h1>{L("🔐 Platform control panel", "🔐 لوحة تحكم المنصة")}</h1>
      </header>

      <div className="container ad-container">
        <div className="ad-top">
          <span>👋 {displayName || user?.email}</span>
          <div className="ad-top-actions">
            <Link href="/" className="ad-btn ghost">{L("Platform", "المنصة")}</Link>
            <button type="button" className="ad-btn ghost" onClick={toggleLang}>{lang === "ar" ? "English" : "عربي"}</button>
            <button type="button" className="ad-btn" onClick={signOut}>{L("Sign out", "تسجيل خروج")}</button>
          </div>
        </div>

        {flashMsg && <div className="msg show">{flashMsg}</div>}

        <div className="ad-stats">
          <div className="ad-stat pending">
            <div className="num mono">{stats ? stats.pending : "–"}</div>
            <div>{L("⏳ Pending review", "⏳ بانتظار المراجعة")}</div>
          </div>
          <div className="ad-stat approved">
            <div className="num mono">{stats ? stats.approved : "–"}</div>
            <div>{L("✅ Approved", "✅ موافق عليها")}</div>
          </div>
          <div className="ad-stat students">
            <div className="num mono">{Array.isArray(students) ? students.length : "–"}</div>
            <div>{L("🎓 Students", "🎓 الطلاب")}</div>
          </div>
        </div>

        <AdminStats />

        <h2 className="ad-section">{L("⏳ Pending review", "⏳ بانتظار المراجعة")}</h2>
        {pending === null && empty(L("Loading...", "جارٍ التحميل..."))}
        {pending === "error" && empty(L("Could not load files. Make sure the submissions table exists and your account is an admin.", "تعذر تحميل الملفات. تأكد أن جدول submissions موجود وأن حسابك أدمن."))}
        {Array.isArray(pending) && pending.length === 0 && empty(L("📭 No files waiting for review.", "📭 لا توجد ملفات بانتظار المراجعة."))}
        {Array.isArray(pending) && pending.map((row) => (
          <div className="ad-card" key={row.id}>
            <div className="ad-meta">{row.subject} ← {row.material}</div>
            <div className="ad-name">📄 {row.name}</div>
            <button type="button" className="ad-link" onClick={() => openRow(row)}>
              {locate(row).external ? L("⚠️ External link", "⚠️ رابط خارجي") : L("Preview file", "معاينة الملف")}
            </button>
            <div className="ad-actions">
              <button type="button" className="approve" onClick={() => approve(row)}>{L("✅ Approve", "✅ موافقة")}</button>
              <button type="button" className="reject" onClick={() => remove(row)}>{L("❌ Reject", "❌ رفض")}</button>
            </div>
          </div>
        ))}

        <h2 className="ad-section">{L("✅ Approved files", "✅ الملفات المعتمدة")}</h2>
        {approved === null && empty(L("Loading...", "جارٍ التحميل..."))}
        {approved === "error" && empty(L("Could not load approved files.", "تعذر تحميل الملفات المعتمدة."))}
        {Array.isArray(approved) && approved.length === 0 && empty(L("No approved files yet.", "لا توجد ملفات معتمدة بعد."))}
        {Array.isArray(approved) && approved.map((row) => (
          <div className="ad-card" key={row.id}>
            <div className="ad-meta">{row.subject} ← {row.material}</div>
            <div className="ad-name">📄 {row.name}</div>
            <button type="button" className="ad-link" onClick={() => openRow(row)}>
              {locate(row).external ? L("⚠️ External link", "⚠️ رابط خارجي") : L("Preview file", "معاينة الملف")}
            </button>
            <div className="ad-actions">
              <button type="button" className="reject" onClick={() => remove(row)}>{L("🗑️ Delete permanently", "🗑️ حذف نهائي")}</button>
            </div>
          </div>
        ))}

        <h2 className="ad-section">{L("🎓 Students", "🎓 الطلاب")}</h2>
        <input
          type="search"
          className="file-search"
          value={studentQ}
          onChange={(e) => setStudentQ(e.target.value)}
          placeholder={L("🔎 Search a student by name or email...", "🔎 ابحث عن طالب بالاسم أو البريد...")}
        />
        {students === null && empty(L("Loading...", "جارٍ التحميل..."))}
        {students === "error" && empty(L("Could not load students. Run supabase/schema.sql and make sure your account is an admin.", "تعذر تحميل الطلاب. شغّل ملف supabase/schema.sql وتأكد أن حسابك أدمن."))}
        {Array.isArray(students) && shownStudents.length === 0 && empty(L("No students match.", "لا يوجد طلاب مطابقون."))}
        <div className="ad-students">
          {shownStudents.map((s) => (
            <div className="ad-student" key={s.id}>
              <b>{s.full_name || L("(no name)", "(بدون اسم)")}</b>
              <span dir="ltr">{s.email}</span>
              {s.role === "admin" && <em>{L("Admin", "أدمن")}</em>}
            </div>
          ))}
        </div>
        {Array.isArray(students) && !studentQ.trim() && students.length > 50 && (
          <p className="ad-note">{L("Showing the latest 50. Type to search all students.", "يعرض آخر 50 طالباً. اكتب للبحث في الجميع.")}</p>
        )}
      </div>
    </div>
  );
}
