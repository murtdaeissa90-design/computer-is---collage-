// أدوات مشتركة لكل الـ Edge Functions: CORS، ردود JSON، التحقق من المستخدم والأدمن.
// SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY يضيفهما Supabase تلقائياً — لا تضعهما في الكود.
import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  let allow = "*";
  if (ALLOWED_ORIGIN !== "*") {
    const list = ALLOWED_ORIGIN.split(",").map((s) => s.trim());
    const isLocal = /^http:\/\/localhost(:\d+)?$/.test(origin);
    allow = list.includes(origin) || isLocal ? origin : list[0];
  }
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

/** يرد على طلب OPTIONS (preflight) أو يرفض غير POST. يرجع null إن كان الطلب POST عادياً */
export function preflight(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);
  return null;
}

/** عميل بصلاحيات السيرفر (service_role) — يتجاوز RLS، فاستخدمه بحذر */
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** يتحقق من توكن المستدعي على السيرفر. لا نثق بأي معرّف يرسله المتصفح */
export async function getUser(req: Request, db: SupabaseClient): Promise<User | null> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export async function isAdmin(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await db.from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role === "admin";
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

export const BUCKET = Deno.env.get("STORAGE_BUCKET") || "Twix";
export const PENDING_BUCKET = Deno.env.get("PENDING_BUCKET") || "pending-uploads";
