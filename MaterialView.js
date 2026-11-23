"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useApp } from "./AppProvider";
import { findSubject } from "@/lib/subjects";
import { loadFiles, uploadSubmission, safeHref, MAX_UPLOAD_MB } from "@/lib/files";
import { QUESTIONS_DATA } from "@/data/questions";
import { norm, fuzzySearch } from "@/lib/search";
import { debugDetail } from "@/lib/debug";
import { trackDownload } from "@/lib/track";

// خلط عشوائي (Fisher–Yates)
function shuffled(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function Mcq({ subject }) {
  const { L, lang } = useApp();
  const list = QUESTIONS_DATA[subject.name] || [];
  const [picked, setPicked] = useState({}); // {questionIndex: optionIndex الأصلي}
  // ترتيب الخيارات يُخلط بعد التحميل في المتصفح (وليس أثناء البناء) حتى لا تكون الإجابة الصحيحة دائماً في نفس المكان
  const [orders, setOrders] = useState(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    setOrders(list.map((item) => shuffled((item.options.en || item.options.ar).length)));
  }, [list, round]);

  if (!list.length) return <div className="empty">📂 {L("No questions available.", "لا توجد أسئلة متاحة حالياً.")}</div>;

  const letters = lang === "ar" ? ["أ", "ب", "ج", "د", "هـ", "و"] : ["A", "B", "C", "D", "E", "F"];
  const answered = Object.keys(picked).length;
  const score = Object.entries(picked).filter(([qi, oi]) => list[qi].correct === oi).length;
  const pct = answered ? Math.round((score / answered) * 100) : 0;
  const progress = Math.round((answered / list.length) * 100);
  const restart = () => {
    setPicked({});
    setRound((r) => r + 1);
  };
  const verdict =
    answered === list.length
      ? score === list.length
        ? L("Excellent! 🌟", "ممتاز! 🌟")
        : score >= list.length / 2
          ? L("Good job 👍", "أحسنت 👍")
          : L("Review the lectures and try again 💪", "راجع المحاضرات وحاول مرة أخرى 💪")
      : null;

  return (
    <div className="qz">
      <div className="qz-top" aria-live="polite">
        <div className="qz-ring" style={{ "--p": pct + "%" }}>
          <b className="mono">{score}/{answered}</b>
        </div>
        <div className="qz-bar">
          <div className="qz-bar-t">
            <span>{L(`${answered} of ${list.length} answered`, `أُجيب على ${answered} من ${list.length}`)}</span>
            <span>{L("Score", "النتيجة")} <b className="mono">{score}</b></span>
          </div>
          <div className="qz-track"><div className="qz-fill" style={{ width: progress + "%" }} /></div>
          {verdict && <div className="qz-verdict">{verdict}</div>}
        </div>
        {answered > 0 && (
          <button type="button" className="qz-retry" onClick={restart}>{L("🔄 Retry", "🔄 إعادة")}</button>
        )}
      </div>

      <div className="qz-list">
        {list.map((item, qi) => {
          const opts = item.options[lang] || item.options.en || item.options.ar;
          const order = (orders && orders[qi]) || opts.map((_, i) => i);
          const chosen = picked[qi];
          const done = chosen !== undefined;
          return (
            <section className="qz-q" key={round + "-" + qi}>
              <div className="qz-qh">
                <span className="qz-num mono">{qi + 1}</span>
                <h3>{item.q[lang] || item.q.en || item.q.ar}</h3>
              </div>
              {order.map((oi, pos) => {
                let cls = "qz-o";
                let mark = letters[pos] || pos + 1;
                let tag = null;
                if (done) {
                  if (oi === item.correct) {
                    cls += " ok";
                    mark = "✓";
                    tag = chosen === oi ? L("Correct", "صحيح") : L("Answer", "الإجابة");
                  } else if (oi === chosen) {
                    cls += " no";
                    mark = "✕";
                    tag = L("Yours", "إجابتك");
                  } else cls += " dim";
                }
                return (
                  <button key={oi} type="button" className={cls} disabled={done || !orders}
                    onClick={() => setPicked((p) => ({ ...p, [qi]: oi }))}>
                    <span className="qz-l">{mark}</span>
                    <span className="qz-t">{opts[oi]}</span>
                    {tag && <span className="qz-tag">{tag}</span>}
                  </button>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Files({ subject, material }) {
  const { L } = useApp();
  const [files, setFiles] = useState(null); // null = loading, "error"
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState(null); // {text, err}
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => {
    let alive = true;
    setFiles(null);
    loadFiles(subject.name, material)
      .then((d) => alive && setFiles(d))
      .catch((e) => {
        console.error(e);
        if (alive) setFiles("error");
      });
    return () => {
      alive = false;
    };
  }, [subject.name, material]);

  // فتح الصفحة من نتيجة البحث التلقائي: ?q=اسم الملف
  useEffect(() => {
    try {
      const v = new URLSearchParams(window.location.search).get("q");
      if (v) setQ(v);
    } catch {}
  }, []);

  const flash = (text, err) => {
    setMsg({ text, err });
    setTimeout(() => setMsg(null), 6000);
  };

  const onUpload = async () => {
    const file = fileInput.current?.files?.[0];
    if (!file || busy) return;
    setBusy(true);
    flash(L("Uploading...", "جارٍ الرفع..."), false);
    try {
      await uploadSubmission(subject.name, material, file);
      flash(L("Uploaded. It will appear after admin approval ✅", "تم الرفع، سيظهر بعد موافقة الأدمن ✅"), false);
      fileInput.current.value = "";
    } catch (e) {
      console.error(e);
      const m = String(e?.message || "").toLowerCase();
      let text = L("Could not upload the file. Try again.", "تعذر رفع الملف. حاول مجدداً.");
      if (m.includes("maximum allowed size") || m.includes("too large") || m.includes("payload"))
        text = L(`The file is too large (max ${MAX_UPLOAD_MB} MB).`, `حجم الملف كبير جداً (الحد ${MAX_UPLOAD_MB} ميجابايت).`);
      else if (m.includes("mime") || m.includes("not supported"))
        text = L("This file type is not allowed. Use PDF, Word, PowerPoint or an image.", "نوع الملف غير مسموح. استخدم PDF أو Word أو PowerPoint أو صورة.");
      else if (m.includes("row-level security") || m.includes("unauthorized") || m.includes("jwt"))
        text = L("Your session expired. Sign in again and retry.", "انتهت جلستك. سجّل الدخول مجدداً وحاول.");
      else if (m.includes("failed to fetch") || m.includes("network"))
        text = L("No connection. Check your internet and try again.", "لا يوجد اتصال. تحقق من الإنترنت وحاول مجدداً.");
      flash(text + debugDetail(e), true);
    } finally {
      setBusy(false);
    }
  };

  let shown = Array.isArray(files) ? files : [];
  if (q.trim()) {
    const direct = shown.filter((f) => norm(f.name).includes(norm(q)));
    shown = direct.length ? direct : fuzzySearch(shown, q, (f) => [f.name], 50);
  }

  return (
    <>
      <div className="upload-card">
        <h3>{L("📤 Upload a File (reviewed before publishing)", "📤 رفع ملف (يُنشر بعد المراجعة)")}</h3>
        <input type="file" ref={fileInput} accept="application/pdf,.doc,.docx,.ppt,.pptx,image/*" />
        <button type="button" onClick={onUpload} disabled={busy}>{L("Upload", "رفع")}</button>
        {msg && <div className={"msg show" + (msg.err ? " err" : "")}>{msg.text}</div>}
      </div>

      <input type="text" className="file-search" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder={L("🔎 Search files in this section...", "🔎 ابحث في هذا القسم...")} />

      <div className="file-list">
        {files === null && <div className="empty">{L("Loading...", "جارٍ التحميل...")}</div>}
        {files === "error" && <div className="empty">{L("Could not load files.", "تعذر تحميل الملفات.")}</div>}
        {Array.isArray(files) && files.length === 0 && (
          <div className="empty">📂 {L("No files available yet.", "لا توجد ملفات بعد.")}</div>
        )}
        {Array.isArray(files) && files.length > 0 && shown.length === 0 && (
          <div className="empty">{L("No files match your search.", "لا توجد ملفات مطابقة للبحث.")}</div>
        )}
        {shown.map((f) => (
          <div className="file" key={f.url}>
            <span>📄 {f.name}</span>
            <button type="button" onClick={() => {
                const href = safeHref(f.url);
                if (!href) return;
                trackDownload(subject.name, material, f.name);
                window.open(href, "_blank", "noopener");
              }}>
              {L("Open", "فتح")}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

export default function MaterialView({ slug, material }) {
  const { L } = useApp();
  const subject = findSubject(slug);

  if (!subject) {
    return (
      <div className="container">
        <p className="empty">{L("Subject not found.", "المادة غير موجودة.")}</p>
        <Link href="/" className="back">{L("← Back", "→ رجوع")}</Link>
      </div>
    );
  }

  const title =
    material === "Questions" ? L("Review Questions (MCQ)", "أسئلة الاختيار المتعدد") : material;

  return (
    <div className="container">
      <Link href={`/subject/${subject.slug}/`} className="back">{L("← Back", "→ رجوع")}</Link>
      <div className="subject-title">
        <h2>{subject.name} - {title}</h2>
      </div>
      {material === "Questions" ? <Mcq subject={subject} /> : <Files subject={subject} material={material} />}
    </div>
  );
}
