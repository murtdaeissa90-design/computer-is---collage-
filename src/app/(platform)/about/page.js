"use client";

import { useApp } from "@/components/AppProvider";

export default function AboutPage() {
  const { L } = useApp();
  return (
    <div className="container">
      <div className="about">
        <h2>{L("ℹ️ About the Platform", "ℹ️ حول المنصة")}</h2>
        <br />
        <p>
          {L(
            "An educational platform for organizing university courses, sheets, lectures, exams and PDF files.",
            "منصة تعليمية لتنظيم المواد الجامعية والشيتات والمحاضرات والامتحانات وملفات PDF."
          )}
        </p>
        <br />
        <p>
          🎓 {L("Al-Bayan University", "جامعة البيان")}
          <br />
          💻 {L("College of Computer Science & IT", "كلية علوم الحاسوب وتقانة المعلومات")}
          <br />
          🖥️ {L("Information Systems Department", "قسم نظم المعلومات")}
        </p>
      </div>
    </div>
  );
}
