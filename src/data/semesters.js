// المواد الدراسية لكل سمستر.
// لإضافة مادة: أضف سطراً جديداً بالشكل  ["اسم المادة", "أيقونة", "اسم المجلد في Supabase"]
// السطر الثالث (اسم المجلد) هو اسم مجلد المادة داخل bucket الخاص بالتخزين.
// السمستر الذي يُفتح أولاً في الصفحة الرئيسية
export const DEFAULT_SEMESTER = "semester3";

// كل سمستر يظهر تلقائياً كزر في الصفحة الرئيسية (الترتيب من الأحدث للأقدم).
// tab = اسم الزر القصير + أيقونته.
export const SEMESTERS = {
 "semester4": {
  name: { ar: "السمستر الرابع", en: "Semester 4" },
  tab: { ar: "📙 السمستر الرابع", en: "📙 Semester 4" },
  subjects: [
   // أضف موادك هنا، سطر لكل مادة بالشكل:
   // ["اسم المادة","أيقونة","اسم المجلد في Supabase"],
  ]
 },
 "semester3": {
  name: { ar: "السمستر الثالث (2026-2027)", en: "Semester 3 (2026-2027)" },
  tab: { ar: "📗 السمستر الثالث", en: "📗 Semester 3" },
  subjects: [
   ["Business Communication","📱","BusinessCommunication"],
   ["Programming Methods II","💻","ProgrammingMethods2"],
   ["Accounting II","📊","Accounting2"],
   ["Internet Programming","🌐","InternetProgramming"],
   ["Principles of Finance","💰","PrinciplesOfFinance"],
   ["Probability & Statistics","📈","ProbabilityAndStatistics"],
   ["English Language III","🌎","English3"]
  ]
 },
 "semester2": {
  name: { ar: "السمستر الثاني", en: "Semester 2" },
  tab: { ar: "📘 السمستر الثاني", en: "📘 Semester 2" },
  subjects: [
   ["Accounting I","📊","Accounting"],
   ["Arabic Language II","📖","Arabic"],
   ["Calculus","📐","Calculus"],
   ["Computer Applications for Business","💻","ComputerApplications"],
   ["English Language II","🌎","English"],
   ["Fundamentals of Information Systems","🖥️","Fundamental of information systems"],
   ["Islamic Studies II","📚","IslamicStudies"],
   ["Managing People","👥","ManagingPeople"],
   ["Programming Methods I","💻","Programming"],
   ["Sudanese Studies","🇸🇩","SudaneseStudies"]
  ]
 }
};

// [المفتاح/المجلد, الأيقونة, الاسم بالإنجليزية, الاسم بالعربية]
export const MATERIALS = [
 ["Lectures","📚","Course Lectures","المحاضرات"],
 ["Exams","📝","Practice Exams","الامتحانات"],
 ["Questions","❓","Review Questions (MCQ)","أسئلة الاختيار المتعدد"]
];
