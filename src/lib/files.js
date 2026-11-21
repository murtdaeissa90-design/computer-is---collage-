import { supabase, BUCKET, PENDING_BUCKET } from "@/lib/supabase";
import { STATIC } from "@/data/files";
import { ALL_SUBJECTS, folderOf } from "@/lib/subjects";

const cache = new Map();

// حدود الرفع (نفس الحدود مفروضة على السيرفر في bucket pending-uploads)
export const MAX_UPLOAD_MB = 25;
export const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

/** رابط آمن فقط: https أو مسار داخلي. أي شيء آخر (مثل javascript:) يُرفض */
export function safeHref(url) {
  const u = String(url || "").trim();
  if (/^https:\/\//i.test(u)) return u;
  if (u.startsWith("/") && !u.startsWith("//")) return u;
  return null;
}

/**
 * رابط ملف معتمد من جدول submissions.
 * v1.2: path = مسار داخل bucket العام (approved/...). الصفوف القديمة تحمل رابطاً كاملاً.
 */
export function submissionUrl(path) {
  const p = String(path || "");
  if (/^https?:/i.test(p)) return safeHref(p);
  if (!p || p.includes("..") || p.includes(":")) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;
}

async function listFiles(path) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(path, { limit: 200, sortBy: { column: "name", order: "asc" } });
  if (error) throw error;
  return (data || [])
    .filter((f) => f.id && f.name !== ".emptyFolderPlaceholder")
    .map((f) => ({
      name: f.name.replace(/\.[^.]+$/, ""),
      url: supabase.storage.from(BUCKET).getPublicUrl(path + "/" + f.name).data.publicUrl,
    }));
}

/** ملفات مادة/قسم: الروابط الثابتة + ملفات التخزين + الملفات المعتمدة من الطلاب */
export async function loadFiles(subjectName, material) {
  const key = subjectName + "|" + material;
  if (cache.has(key)) return cache.get(key);

  const fixed = (STATIC[subjectName] && STATIC[subjectName][material]) || [];
  let listed = [];
  let approved = [];

  try {
    const folder = folderOf(subjectName);
    listed = await listFiles(folder + "/" + material);
    if (material === "Lectures") listed = listed.concat(await listFiles(folder));
  } catch (e) {
    console.error(e);
    if (!fixed.length) throw e;
  }
  try {
    const { data, error } = await supabase
      .from("submissions")
      .select("name,path")
      .eq("subject", subjectName)
      .eq("material", material)
      .eq("approved", true);
    if (!error)
      approved = (data || [])
        .map((r) => ({ name: r.name, url: submissionUrl(r.path) }))
        .filter((f) => f.url);
  } catch (e) {
    console.error("Could not load approved submissions:", e);
  }

  const seen = new Set();
  const out = [];
  fixed.concat(listed, approved).forEach((f) => {
    if (!seen.has(f.url)) {
      seen.add(f.url);
      out.push(f);
    }
  });
  cache.set(key, out);
  return out;
}

/** رفع ملف من طالب إلى bucket الخاص (يظهر للجميع بعد موافقة الأدمن فقط) */
export async function uploadSubmission(subject, material, file) {
  if (!file) throw new Error("no file");
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) throw new Error("too large");
  if (file.type && !ALLOWED_TYPES.includes(file.type)) throw new Error("mime not supported");

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error("unauthorized");

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").replace(/\.{2,}/g, ".").slice(-120);
  const path = uid + "/" + Date.now() + "_" + safeName;
  const { error: upErr } = await supabase.storage.from(PENDING_BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (upErr) throw new Error("storage: " + (upErr.message || upErr));

  const { error: insErr } = await supabase.from("submissions").insert([
    {
      subject,
      material,
      name: file.name.replace(/\.[^.]+$/, "").slice(0, 120) || "file",
      path,
      user_id: uid,
      approved: false,
    },
  ]);
  if (insErr) {
    // لا نترك ملفاً يتيماً في التخزين إن فشل تسجيله
    await supabase.storage.from(PENDING_BUCKET).remove([path]).catch(() => {});
    throw new Error("database: " + (insErr.message || insErr));
  }
}

/**
 * فهرس البحث للملفات (محاضرات وامتحانات كل المواد).
 * يبدأ بالروابط الثابتة فوراً، ثم يكمّل من التخزين بالتوازي المحدود.
 */
let indexPromise = null;
export function buildFileIndex() {
  if (indexPromise) return indexPromise;
  indexPromise = (async () => {
    const jobs = [];
    for (const s of ALL_SUBJECTS) {
      for (const material of ["Lectures", "Exams"]) jobs.push({ s, material });
    }
    const out = [];
    let i = 0;
    async function worker() {
      while (i < jobs.length) {
        const { s, material } = jobs[i++];
        try {
          const files = await loadFiles(s.name, material);
          files.forEach((f) =>
            out.push({ type: "file", name: f.name, url: f.url, subject: s.name, slug: s.slug, icon: s.icon, material })
          );
        } catch {
          /* تجاهل مادة تعذّر تحميلها */
        }
      }
    }
    await Promise.all([worker(), worker(), worker(), worker(), worker()]);
    return out;
  })();
  return indexPromise;
}
