// استدعاء Supabase Edge Functions من المتصفح.
// supabase.functions.invoke يرسل توكن الدخول تلقائياً، والدالة على السيرفر هي من تتحقق منه.
import { supabase } from "@/lib/supabase";

/** يستخرج رمز الخطأ (مثل "daily_limit") من رد الدالة إن وُجد */
async function errorCode(error) {
  try {
    const body = await error.context.json();
    return body?.error || "unknown";
  } catch {
    return "network";
  }
}

async function call(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const err = new Error(name + " failed");
    err.code = await errorCode(error);
    throw err;
  }
  return data;
}

/** (أدمن) موافقة على ملف + إرسال إشعار للطالب. يرجع { ok, notified, emailed } */
export const approveSubmission = (id) => call("approve-submission", { submission_id: id });

/** اسأل المساعد الذكي. messages = [{role:"user"|"assistant", content:"..."}]. يرجع نص الرد */
export async function askAssistant(messages, lang) {
  const data = await call("student-assistant", { messages, lang });
  return data.reply;
}
