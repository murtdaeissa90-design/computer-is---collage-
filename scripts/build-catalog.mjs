// يولّد supabase/functions/_shared/catalog.json من ملفات src/data/
// الدالة الذكية (student-assistant) تقرأ هذا الملف لتعرف المواد والملفات الثابتة والأسئلة.
//
// شغّله كلما عدّلت src/data/*.js ثم أعد نشر الدالة:
//   node scripts/build-catalog.mjs
//   supabase functions deploy student-assistant
import { writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const load = (p) => import(pathToFileURL(resolve(root, p)).href);

const { SEMESTERS } = await load("src/data/semesters.js");
const { STATIC } = await load("src/data/files.js");
const { QUESTIONS_DATA } = await load("src/data/questions.js");
const { SUBJECT_ALIASES } = await load("src/data/aliases.js");

const slugify = (name) =>
  String(name).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const subjects = Object.entries(SEMESTERS).flatMap(([semKey, sem]) =>
  sem.subjects.map(([name, icon, folder]) => ({
    name,
    folder,
    slug: slugify(name),
    semester: sem.name.en,
    semester_ar: sem.name.ar,
    aliases: SUBJECT_ALIASES[name] || [],
  }))
);

const catalog = { generated_at: new Date().toISOString(), subjects, files: STATIC, questions: QUESTIONS_DATA };

const out = resolve(root, "supabase/functions/_shared/catalog.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(catalog));
console.log(`✔ ${subjects.length} subjects → ${out}`);
