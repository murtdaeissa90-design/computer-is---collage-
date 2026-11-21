"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "./AppProvider";
import { askAssistant } from "@/lib/api";
import { localAnswer } from "@/lib/localAssistant";
import RichText from "./RichText";

const MAX_LEN = 500;
// "local" = مساعد مبسّط داخل المتصفح (مجاني). "ai" = مساعد Claude عبر Edge Function (يحتاج مفتاح مدفوع).
const MODE = process.env.NEXT_PUBLIC_ASSISTANT_MODE === "ai" ? "ai" : "local";

/** شات المساعد الذكي (زر عائم أسفل الصفحة) */
export default function ChatWidget() {
  const { L, lang } = useApp();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]); // [{role, content, error?}]
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef(null);

  useEffect(() => {
    if (open) bottom.current?.scrollIntoView({ block: "end" });
  }, [msgs, busy, open]);

  const errText = (code) => {
    switch (code) {
      case "daily_limit":
        return L("You've reached today's message limit. Try again tomorrow.", "وصلت للحد اليومي من الرسائل. جرّب غداً.");
      case "ai_busy":
        return L("The assistant is busy right now. Try again in a minute.", "المساعد مشغول حالياً. حاول بعد دقيقة.");
      case "ai_not_configured":
      case "server_not_ready":
        return L("The assistant isn't set up yet. Please tell the admins.", "المساعد غير مفعّل بعد. أبلغ الأدمن.");
      case "unauthorized":
        return L("Please sign in again.", "سجّل الدخول من جديد.");
      default:
        return L("Something went wrong. Please try again.", "حدث خطأ، حاول مرة أخرى.");
    }
  };

  const send = async (raw) => {
    const content = String(raw || "").trim().slice(0, MAX_LEN);
    if (!content || busy) return;
    const history = [...msgs.filter((m) => !m.error), { role: "user", content }];
    setMsgs([...msgs, { role: "user", content }]);
    setText("");
    setBusy(true);
    try {
      const reply =
        MODE === "ai"
          ? await askAssistant(history.map(({ role, content }) => ({ role, content })), lang)
          : await localAnswer(content, lang);
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: errText(e.code), error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    send(text);
  };

  // أسئلة مقترحة (كلها يفهمها المساعد المحلي)
  const suggestions = [
    L("How do I upload a file?", "كيف أرفع ملفاً؟"),
    L("Calculus lectures", "محاضرات Calculus"),
    L("Accounting II exams", "امتحانات Accounting II"),
    L("How do I know my file was approved?", "كيف أعرف أن ملفي تمت الموافقة عليه؟"),
    L("Where do I see my notifications?", "أين أرى إشعاراتي؟"),
    L("I forgot my password", "نسيت كلمة المرور"),
    L("How do I create an account?", "كيف أنشئ حساباً جديداً؟"),
    L("How do I turn on dark mode?", "كيف أفعّل الوضع الليلي؟"),
    L("Where are my tasks?", "أين مهامي؟"),
    L("How do favorites work?", "كيف أضيف مادة إلى المفضلة؟"),
    L("Where is the exam countdown?", "أين العد التنازلي للامتحان؟"),
    L("How do I search for a file?", "كيف أبحث عن ملف؟"),
    L("How do I change the language?", "كيف أغيّر لغة المنصة؟"),
    L("How do I contact the developers?", "كيف أتواصل مع المطورين؟"),
    L("What does the platform do?", "ما هي المنصة وماذا تقدّم؟"),
    L("Who are you?", "من أنت؟"),
    L("What should I study tonight?", "أذاكر شنو الليلة؟"),
    L("I'm stuck", "علقت في حاجة"),
    L("What is software development?", "ما هو مجال تطوير البرمجيات؟"),
    L("Web vs software: what's the difference?", "ما الفرق بين الويب والسوفتوير؟"),
    L("Is programming hard?", "هل البرمجة صعبة؟"),
    L("Which laptop do I need?", "ما مواصفات اللابتوب المناسب؟"),
    L("How do I start learning?", "من وين أبدأ؟"),
    L("Which programming language first?", "ما أفضل لغة برمجة أبدأ بها؟"),
    L("What is programming?", "ما هي البرمجة؟"),
    L("How do I learn programming?", "كيف أتعلم البرمجة؟"),
    L("C++ or Python?", "C++ ولا بايثون؟"),
    L("What is a variable?", "ما هو المتغير؟"),
    L("What are data types?", "ما هي أنواع البيانات؟"),
    L("How do if / else conditions work?", "كيف تعمل الجمل الشرطية؟"),
    L("How do loops work?", "كيف تعمل الحلقات؟"),
    L("What is a function?", "ما هي الدالة؟"),
    L("What is an array?", "ما هي المصفوفة؟"),
    L("What is a pointer?", "ما هو المؤشر؟"),
    L("What is OOP?", "ما هو OOP؟"),
    L("How do cin and cout work?", "كيف أستخدم cin و cout؟"),
    L("There's an error in my code", "في خطأ في الكود حقي"),
    L("Front-end vs back-end", "ما الفرق بين الفرونت إند والباك إند؟"),
    L("What are HTML, CSS and JavaScript?", "ما هي HTML وCSS وJavaScript؟"),
    L("What is a database?", "ما هي قاعدة البيانات؟"),
    L("What is Git and GitHub?", "ما هو Git وGitHub؟"),
    L("What is an algorithm?", "ما هي الخوارزمية؟"),
    L("Which code editor or compiler should I use?", "وين أكتب الكود؟"),
    L("Where can I practice coding?", "وين أتمرن على البرمجة؟"),
    L("Can I use AI for coding?", "هل أستخدم الذكاء الاصطناعي في البرمجة؟"),
  ];

  return (
    <>
      <button type="button" className="chat-fab" onClick={() => setOpen((o) => !o)}
        aria-label={L("Open assistant", "فتح المساعد")} aria-expanded={open}>
        {open ? "✕" : "🤖"}
      </button>

      {open && (
        <section className="chat-panel" aria-label={L("Students IS Assistant", "مساعد Students IS")}>
          <div className="chat-head">
            <b>🤖 {L("Students IS Assistant", "مساعد Students IS")}</b>
            <small>{L("Ask anything about the platform", "اسألني عن أي شيء في المنصة")}</small>
          </div>

          <div className="chat-body">
            {msgs.length === 0 && (
              <div className="chat-hello">
                <p>{L("Hi! 👋 I can help you find lectures and exams or explain how the platform works.", "أهلاً! 👋 أساعدك في إيجاد المحاضرات والامتحانات وشرح طريقة عمل المنصة.")}</p>
                <div className="chat-chips">
                  {suggestions.map((s) => (
                    <button type="button" key={s} onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={"chat-msg " + m.role + (m.error ? " err" : "")}>
                {m.role === "assistant" ? <RichText text={m.content} /> : m.content}
              </div>
            ))}
            {busy && <div className="chat-msg assistant typing" aria-live="polite">{L("Thinking…", "يفكّر…")}</div>}
            <div ref={bottom} />
          </div>

          <form className="chat-form" onSubmit={onSubmit}>
            <input value={text} maxLength={MAX_LEN} onChange={(e) => setText(e.target.value)}
              placeholder={L("Type your question…", "اكتب سؤالك…")} aria-label={L("Message", "الرسالة")} />
            <button type="submit" disabled={busy || !text.trim()}>{L("Send", "إرسال")}</button>
          </form>
        </section>
      )}
    </>
  );
}
