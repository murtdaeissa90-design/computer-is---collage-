// تسجيل النشاط للإحصاءات (دخول مادة / فتح ملف). يعمل بصمت: أي فشل لا يؤثر على الطالب.
import { supabase } from "@/lib/supabase";

async function send(row) {
  try {
    await supabase.from("activity_log").insert([row]);
  } catch {
    /* الإحصاءات اختيارية */
  }
}

/** دخول صفحة مادة (مرة واحدة لكل مادة في الجلسة حتى لا تتضخم الأرقام بالتحديث) */
export function trackView(subject) {
  try {
    const k = "tv_" + subject;
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, "1");
  } catch {}
  send({ kind: "view", subject });
}

/** فتح/تنزيل ملف */
export function trackDownload(subject, material, fileName) {
  send({ kind: "download", subject, material, file_name: String(fileName || "").slice(0, 200) });
}
