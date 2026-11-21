// approve-submission: الأدمن يوافق على ملف طالب.
// 1) يتحقق أن المستدعي أدمن (من التوكن + جدول profiles)
// 2) ينقل الملف من bucket الخاص pending-uploads إلى Twix/approved/ العام
// 3) يعلّم الصف approved = true
// 4) يُدرج إشعاراً للطالب 🔔، ويرسل بريداً إن كان RESEND_API_KEY مضبوطاً
import {
  adminClient, BUCKET, getUser, isAdmin, json, PENDING_BUCKET, preflight, readJson,
} from "../_shared/common.ts";

const slugify = (name: string) =>
  String(name).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const db = adminClient();
  const user = await getUser(req, db);
  if (!user) return json(req, { error: "unauthorized" }, 401);
  if (!(await isAdmin(db, user.id))) return json(req, { error: "forbidden" }, 403);

  const body = await readJson(req);
  if (!body) return json(req, { error: "bad_json" }, 400);
  const id = body.submission_id;
  if (id === undefined || id === null || id === "") return json(req, { error: "submission_id_required" }, 400);

  const { data: row, error } = await db.from("submissions").select("*").eq("id", id).maybeSingle();
  if (error) return json(req, { error: "db_error" }, 500);
  if (!row) return json(req, { error: "not_found" }, 404);

  // نقل الملف (فقط لصفوف v1.2 التي تحمل مساراً داخل pending-uploads)
  let path: string = row.path;
  const isStoragePath = !/^[a-z][a-z0-9+.-]*:/i.test(path) && !path.includes("..");
  if (!row.approved && isStoragePath && !path.startsWith("approved/")) {
    const dl = await db.storage.from(PENDING_BUCKET).download(path);
    if (dl.error || !dl.data) return json(req, { error: "file_missing" }, 404);
    const newPath = "approved/" + path;
    const up = await db.storage.from(BUCKET).upload(newPath, dl.data, {
      upsert: true,
      contentType: dl.data.type || undefined,
    });
    if (up.error) return json(req, { error: "storage_error" }, 500);
    await db.storage.from(PENDING_BUCKET).remove([path]);
    path = newPath;
  }

  const { error: updErr } = await db.from("submissions").update({ approved: true, path }).eq("id", id);
  if (updErr) return json(req, { error: "db_error" }, 500);

  let notified = false;
  let emailed = false;
  if (row.user_id) {
    const link = `/subject/${slugify(row.subject)}/${row.material}/`;
    const { error: nErr } = await db.from("notifications").insert({
      user_id: row.user_id,
      kind: "file_approved",
      title_ar: "تمت الموافقة على ملفك ✅",
      title_en: "Your file was approved ✅",
      body_ar: `«${row.name}» أصبح متاحاً للطلاب في ${row.subject}.`,
      body_en: `“${row.name}” is now available to students in ${row.subject}.`,
      link,
    });
    notified = !nErr;

    const key = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("MAIL_FROM");
    if (key && from) {
      const { data: prof } = await db.from("profiles").select("email,full_name").eq("id", row.user_id).maybeSingle();
      if (prof?.email) {
        const site = (Deno.env.get("ALLOWED_ORIGIN") || "").split(",")[0].trim();
        const url = site && site !== "*" ? site + link : "";
        const name = escapeHtml(String(row.name));
        const subj = escapeHtml(String(row.subject));
        try {
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from,
              to: [prof.email],
              subject: "تمت الموافقة على ملفك — Students IS",
              html: `<div dir="rtl" style="font-family:sans-serif">
                <p>مرحباً ${escapeHtml(prof.full_name || "")}،</p>
                <p>تمت الموافقة على ملفك <b>${name}</b> في مادة <b>${subj}</b>، وأصبح متاحاً لكل الطلاب.</p>
                ${url ? `<p><a href="${url}">افتح الملف في المنصة</a></p>` : ""}
                <p>شكراً لمساهمتك 🌟</p></div>`,
            }),
          });
          emailed = r.ok;
        } catch {
          emailed = false;
        }
      }
    }
  }

  return json(req, { ok: true, notified, emailed });
});
