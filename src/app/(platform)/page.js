"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { SEMESTERS, DEFAULT_SEMESTER } from "@/data/semesters";
import { ALL_SUBJECTS } from "@/lib/subjects";

const FAV_KEY = "fav_subjects";

function loadFavs() {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY)) || [];
  } catch {
    return [];
  }
}

export default function HomePage() {
  const { L, lang } = useApp();
  const [semKey, setSemKey] = useState(DEFAULT_SEMESTER);
  const [favs, setFavs] = useState([]);

  useEffect(() => setFavs(loadFavs()), []);

  const toggleFav = (name) => {
    const list = loadFavs();
    const i = list.indexOf(name);
    if (i === -1) list.push(name);
    else list.splice(i, 1);
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(list));
    } catch {}
    setFavs(list);
  };

  const sem = SEMESTERS[semKey];
  const subjects = ALL_SUBJECTS.filter((s) => s.semester === semKey).sort(
    (a, b) => favs.includes(b.name) - favs.includes(a.name)
  );

  return (
    <div className="container">
      <div className="semester-tabs">
        {Object.entries(SEMESTERS).map(([key, sm]) => (
          <button key={key} type="button" className={"sem-btn" + (semKey === key ? " active" : "")}
            onClick={() => setSemKey(key)}>
            {lang === "ar" ? sm.tab.ar : sm.tab.en}
          </button>
        ))}
      </div>

      <div className="title">
        <h2>📚 {lang === "ar" ? sem.name.ar : sem.name.en}</h2>
      </div>
      <div className="counter">
        <span className="mono">{subjects.length}</span> {L("Academic Subjects", "مواد دراسية")}
      </div>

      {subjects.length === 0 && (
        <div className="empty">🚧 {L("Subjects for this semester will be added soon.", "سيتم إضافة مواد هذا السمستر قريباً.")}</div>
      )}

      <div className="subjects">
        {subjects.map((s) => {
          const fav = favs.includes(s.name);
          return (
            <Link key={s.slug} href={`/subject/${s.slug}/`} className="subject">
              <span
                className={"fav-star" + (fav ? " active" : "")}
                role="button"
                aria-label={L("Favorite", "تفضيل")}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleFav(s.name);
                }}
              >
                {fav ? "⭐" : "☆"}
              </span>
              <div className="icon">{s.icon}</div>
              <h3>{s.name}</h3>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
