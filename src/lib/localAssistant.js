// مساعد المنصة المبسّط: يعمل بالكامل داخل المتصفح، بلا API وبلا تكلفة.
// يفهم الأسئلة الشائعة (FAQ) ويبحث عن المواد والملفات باستخدام نفس البحث الذكي.
// لتبديله لاحقاً بمساعد Claude: ضع NEXT_PUBLIC_ASSISTANT_MODE=ai (انظر docs/API.md).
import { ALL_SUBJECTS } from "@/lib/subjects";
import { loadFiles } from "@/lib/files";
import { QUESTIONS_DATA } from "@/data/questions";
import { tokens, scoreText } from "@/lib/search";

// ---------------------------------------------------------------------
// الأسئلة الشائعة: keys = كلمات تدل على الموضوع، والترتيب مهم (الأول أولى عند التعادل)
// لإضافة سؤال جديد: أضف عنصراً بنفس الشكل.
// ---------------------------------------------------------------------
const FAQ = [
  // ---------------- المنصة ----------------
  {
    keys: ["رفع", "ارفع", "ارفع ملف", "upload", "submit"],
    ar: "لرفع ملف:\n- افتح المادة ثم القسم المناسب (المحاضرات أو الامتحانات).\n- اضغط زر «رفع» واختر الملف من جهازك (PDF أو Word أو PowerPoint أو صورة، حتى 25 ميجابايت).\n- يظهر الملف للطلاب **بعد موافقة الأدمن**، وسيصلك إشعار 🔔 عند الموافقة.",
    en: "To upload a file:\n- Open the subject, then the right section (Lectures or Exams).\n- Press **Upload** and choose the file (PDF, Word, PowerPoint or an image, up to 25 MB).\n- It becomes visible to everyone **after admin approval**, and you'll get a 🔔 notification.",
  },
  {
    keys: ["موافقه", "وافق", "approved", "approval", "pending", "بانتظار", "ملفي", "my file"],
    ar: "الملفات التي ترفعها يراجعها الأدمن أولاً. عند الموافقة يظهر الملف لكل الطلاب ويصلك إشعار في الجرس 🔔 أعلى الصفحة. إن لم يصلك شيء فالملف ما زال قيد المراجعة.",
    en: "Uploaded files are reviewed by an admin first. Once approved, the file is visible to everyone and you get a notification in the 🔔 bell at the top. No notification yet means it's still under review.",
  },
  {
    keys: ["اشعار", "اشعارات", "الاشعارات", "notification", "notifications", "جرس", "bell"],
    ar: "الجرس 🔔 في الشريط العلوي يعرض إشعاراتك، مثل الموافقة على ملف رفعته. الرقم الأحمر هو عدد الإشعارات الجديدة.",
    en: "The 🔔 bell in the top bar shows your notifications, like when a file you uploaded is approved. The red number is how many are new.",
  },
  {
    keys: ["كلمه المرور", "كلمة السر", "كلمه السر", "password", "نسيت", "forgot", "reset"],
    ar: "من صفحة الدخول اضغط «نسيت كلمة المرور؟» وأدخل بريدك، فيصلك رابط لإنشاء كلمة جديدة.",
    en: "On the login page press “Forgot password?” and enter your email. You'll get a link to set a new password.",
  },
  {
    keys: ["انشاء حساب", "حساب جديد", "اسجل", "account", "signup", "sign up", "register", "create account"],
    ar: "من صفحة الدخول اضغط «إنشاء حساب» وأدخل اسمك الكامل وبريدك وكلمة مرور. بعدها يمكنك فتح المنصة ورفع الملفات.",
    en: "On the login page press “Create account” and enter your full name, email and a password. Then you can open the platform and upload files.",
  },
  {
    keys: ["ليلي", "dark", "dark mode", "night", "الوضع الليلي"],
    ar: "الوضع الليلي 🌙 زر في الشريط العلوي، يبدّل بين الفاتح والداكن.",
    en: "Dark mode 🌙 is a button in the top bar that switches between light and dark.",
  },
  {
    keys: ["مهام", "مهامي", "tasks", "todo", "to-do"],
    ar: "صفحة [مهامي](/tasks/) قائمة مهام للمذاكرة تُحفظ في متصفحك أنت فقط.",
    en: "The [Tasks](/tasks/) page is a personal study to-do list saved only in your browser.",
  },
  {
    keys: ["مفضله", "المفضله", "نجمه", "favorite", "favourite", "star"],
    ar: "النجمة ⭐ على بطاقة المادة تضيفها للمفضلة لتجدها أسرع. وتُحفظ في متصفحك.",
    en: "The ⭐ star on a subject card adds it to your favorites so you find it faster. It's saved in your browser.",
  },
  {
    keys: ["العد التنازلي", "countdown", "موعد الامتحان", "تاريخ الامتحان", "exam date"],
    ar: "في صفحة كل مادة يمكنك تحديد موعد امتحانك فيظهر عدّاد تنازلي. يُحفظ الموعد في متصفحك.",
    en: "On each subject page you can set your exam date and see a countdown. The date is saved in your browser.",
  },
  {
    keys: ["بحث", "ابحث", "search", "find"],
    ar: "مربع البحث أعلى كل صفحة يجد المواد والمحاضرات والشيتات والامتحانات، حتى لو أخطأت في الإملاء، بالعربي أو الإنجليزي.",
    en: "The search box at the top of every page finds subjects, lectures, sheets and exams even with spelling mistakes, in Arabic or English.",
  },
  {
    keys: ["شكرا", "مشكور", "تسلم", "ما في مشكله", "تمام", "thanks", "thank you", "thx", "bye", "مع السلامه"],
    ar: "العفو 🌟 أي وقت تحتاج حاجة أنا هنا. بالتوفيق في مذاكرتك!",
    en: "You're welcome 🌟 I'm here whenever you need me. Good luck with your studies!",
  },
  {
    keys: ["تواصل", "مطور", "المطورين", "contact", "developer", "developers", "عندي مشكله", "عندي مشكله في المنصه", "مشكله في المنصه", "المنصه فيها مشكله", "report bug", "bug"],
    ar: "المنصة من تطوير مرتضى عيسى وعبدالله إسماعيل. للمشاكل والاقتراحات: Murtdaeissa90@gmail.com",
    en: "The platform is built by Murtda Eissa and Abdullah Ismail. For problems or suggestions: Murtdaeissa90@gmail.com",
  },

  // ---------------- أسئلة عامة للمبتدئين ----------------
  {
    keys: ["المجال ده", "ما هو المجال", "شنو المجال", "المجال شنو", "تطوير البرمجيات", "software development", "what is this field"],
    ar: "ده مجال Software Development، بنتعلم فيهو كيف نصمم ونبني البرامج والمواقع والتطبيقات البتسهل حياة الناس.",
    en: "This is the Software Development field. We learn how to design and build programs, websites and apps that make people's lives easier.",
  },
  {
    keys: ["web software", "ويب software", "ويب سوفتوير", "الويب والسوفتوير", "الفرق web", "الفرق ويب", "difference web software"],
    ar: "الـ Software هو الشجرة الكبيرة، والـ Web فرع منها. الـ Web متخصص في المواقع والمنصات زي المنصة دي، والـ Software بيشمل كمان تطبيقات الموبايل والكمبيوتر والذكاء الاصطناعي.",
    en: "Software is the big tree and Web is one of its branches. Web focuses on websites and platforms like this one, while Software also covers mobile, desktop and AI.",
  },
  {
    keys: ["البرمجه صعبه", "هل البرمجه صعبه", "is programming hard", "is programming difficult", "programming hard"],
    ar: "ما صعبة، بس دايرة صبر ومواصلة. أول أسبوعين حتحس إنك دايش، بعدها حتلقى نفسك بديت تفهم وتستمتع.",
    en: "It's not hard, it just needs patience and consistency. The first two weeks you'll feel lost, then you'll start to understand and enjoy it.",
  },
  {
    keys: ["لابتوب", "لاب توب", "laptop", "مواصفات", "specs"],
    ar: "ما محتاج جهاز قوي في أول سنة. أي لابتوب بيشغّل المتصفح وبرنامج كتابة الكود (زي VS Code أو Code::Blocks) بيكفيك. ما تخلي الجهاز يعطلك.",
    en: "You don't need a powerful machine in your first year. Any laptop that runs a browser and a code editor (like VS Code or Code::Blocks) is enough. Don't let the device hold you back.",
  },
  {
    keys: ["اقرا من وين", "ابدا كيف", "من وين ابدا", "اذاكر من وين", "where to start", "how to start", "start learning"],
    ar: "ابدأ من الصفحة [الرئيسية](/): اختار السمستر بتاعك، افتح المادة، وراجع **المحاضرات** بالترتيب. بعد كل محاضرة حل **أسئلة المراجعة** عشان تتأكد إنك فاهم. امشي خطوة خطوة، وركّز على الفهم ما الحفظ.",
    en: "Start from the [home page](/): pick your semester, open a subject and go through the **Lectures** in order. After each lecture, solve the **Review questions** to check your understanding. Go step by step and focus on understanding, not memorizing.",
  },
  {
    keys: ["المنصه بتعمل", "المنصه شنو", "ما هي المنصه", "what is this platform", "what does the platform do"],
    ar: "بتجمع ليك المواد والمحاضرات والامتحانات وأسئلة المراجعة في مكان واحد، وبتساعدك ترتب قرايتك من أول سنة لحدي ما تتخرج.",
    en: "It gathers your subjects, lectures, exams and review questions in one place, and helps you organize your study from the first year until you graduate.",
  },
  {
    keys: ["ai assistant", "المساعد ده", "المساعد بيعمل", "مساعدك الشخصي", "انت منو", "انت شنو", "who are you", "what can you do"],
    ar: "أنا مساعدك في المنصة 🤖 اسألني عن المنصة (الرفع، الإشعارات، كلمة المرور)، أو اطلب ملفات مادة مثل «محاضرات Calculus»، أو اسألني أسئلة برمجة بسيطة مثل «يعني شنو متغير؟». جرّب: أقرا شنو الليلة؟",
    en: "I'm your platform assistant 🤖 Ask me about the platform (uploads, notifications, password), ask for a subject's files like “Calculus lectures”, or ask simple programming questions like “What is a variable?”. Try: “What should I study tonight?”",
  },
  {
    keys: ["اقرا شنو", "اذاكر شنو", "اقرا شنو الليله", "what should i study", "study tonight"],
    ar: "ابدأ بالمادة البتمتحنها قريب: حدد موعد امتحانك في صفحة المادة فيطلع ليك عدّاد تنازلي. بعدين افتح المحاضرات وراجعها، وحل أسئلة المراجعة عشان تتأكد إنك فاهم.",
    en: "Start with the subject whose exam is closest: set your exam date on the subject page to get a countdown. Then open the lectures, review them, and solve the review questions to check your understanding.",
  },
  {
    keys: ["وقفت في حاجه", "وقفت", "علقت", "stuck", "i am stuck", "i'm stuck"],
    ar: "عادي جداً 💪 اكتب لي سؤالك هنا بالتحديد (مثلاً: «يعني شنو pointer؟» أو «الكود فيهو error»). ولو محتاج شرح أعمق اسأل زملاءك أو السناير. ما تخجل، كلنا كنا برالمة ودايشين زيك.",
    en: "That's totally normal 💪 Type your exact question here (e.g. “What is a pointer?” or “My code has an error”). For deeper help, ask your classmates or seniors. Don't be shy, we were all confused beginners once.",
  },

  // ---------------- أسئلة البرمجة ----------------
  {
    keys: ["ما هي لغه البرمجه", "شنو لغه البرمجه", "لغه البرمجه", "لغات البرمجه", "اول لغه", "افضل لغه", "احسن لغه", "ابدا بلغه", "اتعلم لغه", "which language", "best programming language", "first language", "programming language"],
    ar: "في القسم بنبدأ بـ **C++** (مادة Programming Methods)، وهي ممتازة تفهمك الأساسيات بعمق. بعدها **HTML/CSS/JavaScript** لمادة Internet Programming. ما في «أفضل لغة» مطلقاً: الأهم تفهم المفاهيم (متغيرات، شروط، حلقات، دوال)، وبعدها أي لغة جديدة بتكون سهلة.",
    en: "In our department we start with **C++** (Programming Methods), which teaches the fundamentals deeply, then **HTML/CSS/JavaScript** for Internet Programming. There's no absolute “best language”: master the concepts (variables, conditions, loops, functions) and any new language becomes easy.",
  },
  {
    keys: ["ما هي البرمجه", "شنو البرمجه", "شنو هي البرمجه", "يعني شنو برمجه", "معني البرمجه", "تعريف البرمجه", "what is programming", "what is coding"],
    ar: "البرمجة هي كتابة **تعليمات** للكمبيوتر بلغة يفهمها (زي C++ أو Python) عشان ينفّذ مهمة: يحسب، يعرض صفحة، يحفظ بيانات... البرنامج = خطوات مرتبة (خوارزمية) مكتوبة بلغة برمجة.",
    en: "Programming means writing **instructions** for the computer in a language it understands (like C++ or Python) so it performs a task: calculate, show a page, store data... A program = ordered steps (an algorithm) written in a programming language.",
  },
  {
    keys: ["كيف اتعلم البرمجه", "اتعلم البرمجه", "تعلم البرمجه", "ابدا البرمجه", "learn programming", "learn to code", "how to learn coding"],
    ar: "خطة بسيطة:\n- افهم الأساسيات بالترتيب: المتغيرات ← الشروط ← الحلقات ← الدوال ← المصفوفات.\n- اكتب الكود بيدك، ما تكتفي بالقراية. كل محاضرة طبّقها في برنامج صغير.\n- حل تمارين يومياً ولو 30 دقيقة.\n- لما يطلع ليك error اقرأ الرسالة كويس، هي بتوريك وين المشكلة.",
    en: "A simple plan:\n- Learn the basics in order: variables → conditions → loops → functions → arrays.\n- Type the code yourself; don't just read. Turn each lecture into a small program.\n- Practise daily, even 30 minutes.\n- When you get an error, read the message carefully; it tells you where the problem is.",
  },
  {
    keys: ["بايثون", "python", "c++ or python", "سي بلس بلس ولا بايثون", "cpp"],
    ar: "**C++** أسرع وتعلّمك تفاصيل الذاكرة والأنواع، وهي لغة المقرر عندنا. **Python** أبسط في الكتابة ومنتشرة في الذكاء الاصطناعي وتحليل البيانات. نصيحتي: ركّز على C++ الآن عشان المواد، وتقدر تتعلم Python لاحقاً بسهولة.",
    en: "**C++** is faster and teaches you memory and types; it's our course language. **Python** is simpler to write and popular in AI and data analysis. Advice: focus on C++ now for your courses; Python will be easy to pick up later.",
  },
  {
    keys: ["متغير", "المتغير", "المتغيرات", "variable", "variables"],
    ar: "المتغير (Variable) صندوق في الذاكرة له **اسم** و**نوع** و**قيمة**. مثال في C++:\nint age = 20;\nهنا age اسم المتغير، int نوعه (عدد صحيح)، و20 قيمته. تقدر تغيّر القيمة لاحقاً: age = 21;",
    en: "A variable is a box in memory with a **name**, a **type** and a **value**. Example in C++:\nint age = 20;\nage is the name, int is the type (integer) and 20 is the value. You can change it later: age = 21;",
  },
  {
    keys: ["انواع البيانات", "نوع البيانات", "data type", "data types"],
    ar: "أشهر أنواع البيانات في C++:\n- int: أعداد صحيحة مثل 5\n- double / float: أعداد عشرية مثل 3.14\n- char: حرف واحد مثل 'A'\n- bool: true أو false\n- string: نص مثل \"Ahmed\" (يحتاج #include <string>)",
    en: "Common C++ data types:\n- int: whole numbers like 5\n- double / float: decimals like 3.14\n- char: a single character like 'A'\n- bool: true or false\n- string: text like \"Ahmed\" (needs #include <string>)",
  },
  {
    keys: ["الجمل الشرطيه", "جمله شرطيه", "الشرط", "if else", "if statement", "switch", "condition", "conditions"],
    ar: "الجملة الشرطية تخلي البرنامج يقرر:\nif (mark >= 50) cout << \"Pass\"; else cout << \"Fail\";\nولو عندك حالات كثيرة لقيمة واحدة (1، 2، 3...) استخدم **switch** بدل if متكررة.",
    en: "A conditional lets the program decide:\nif (mark >= 50) cout << \"Pass\"; else cout << \"Fail\";\nFor many cases of a single value (1, 2, 3...), use **switch** instead of repeated ifs.",
  },
  {
    keys: ["حلقه", "الحلقات", "حلقات التكرار", "التكرار", "loop", "loops", "for loop", "while", "for و while", "do while"],
    ar: "الحلقة (Loop) تكرر كود عدة مرات:\n- **for**: لما تعرف عدد المرات. for (int i = 1; i <= 5; i++) cout << i;\n- **while**: تتكرر طالما الشرط صحيح، وقد لا تُنفَّذ أبداً.\n- **do-while**: تُنفَّذ **مرة واحدة على الأقل** ثم تفحص الشرط.\nانتبه تغيّر المتغير داخل الحلقة، وإلا تصير حلقة لا نهائية.",
    en: "A loop repeats code:\n- **for**: when you know how many times. for (int i = 1; i <= 5; i++) cout << i;\n- **while**: repeats while the condition is true; may run zero times.\n- **do-while**: runs **at least once**, then checks the condition.\nRemember to update the variable inside the loop, or you'll get an infinite loop.",
  },
  {
    keys: ["داله", "الدوال", "دوال", "فنكشن", "function", "functions"],
    ar: "الدالة (Function) كود له اسم تكتبه مرة وتستدعيه كثير:\nint sum(int a, int b) { return a + b; }\nثم: cout << sum(3, 4); // 7\n- **void**: دالة لا ترجع قيمة.\n- التمرير بالمرجع **&** يخلي الدالة تعدّل المتغير الأصلي.",
    en: "A function is named code you write once and call many times:\nint sum(int a, int b) { return a + b; }\nThen: cout << sum(3, 4); // 7\n- **void**: a function that returns nothing.\n- Passing by reference with **&** lets the function modify the original variable.",
  },
  {
    keys: ["مصفوفه", "المصفوفات", "مصفوفات", "array", "arrays"],
    ar: "المصفوفة (Array) مجموعة عناصر من **نفس النوع** تحت اسم واحد:\nint marks[3] = {70, 85, 90};\nالعنصر الأول marks[0] والأخير marks[2] (الترقيم يبدأ من **0**). للمرور عليها استخدم for.",
    en: "An array is a group of elements of the **same type** under one name:\nint marks[3] = {70, 85, 90};\nThe first element is marks[0] and the last is marks[2] (indexing starts at **0**). Use a for loop to go through it.",
  },
  {
    keys: ["مؤشر", "المؤشرات", "مؤشرات", "بوينتر", "pointer", "pointers"],
    ar: "المؤشر (Pointer) متغير يخزّن **عنوان** متغير آخر في الذاكرة:\nint x = 10;\nint* p = &x;   // p يحمل عنوان x\ncout << *p;     // 10 (القيمة الموجودة في العنوان)\n& تعطيك العنوان، و* تعطيك القيمة التي يشير إليها المؤشر.",
    en: "A pointer is a variable that stores the **address** of another variable:\nint x = 10;\nint* p = &x;   // p holds x's address\ncout << *p;     // 10 (the value at that address)\n& gives the address and * gives the value it points to.",
  },
  {
    keys: ["oop", "كائنيه التوجه", "البرمجه الشيئيه", "البرمجه الكائنيه", "class", "object", "كلاس", "اوبجكت", "inheritance", "الوراثه", "التغليف", "encapsulation", "polymorphism"],
    ar: "البرمجة كائنية التوجه (OOP):\n- **Class**: قالب (مثل «طالب») فيه بيانات ودوال.\n- **Object**: نسخة حقيقية من الكلاس (طالب اسمه أحمد).\n- **Encapsulation**: إخفاء البيانات (private) والوصول عبر getters/setters.\n- **Inheritance**: كلاس جديد يرث من كلاس موجود.\n- **Polymorphism**: نفس اسم الدالة بسلوك مختلف حسب الكائن.",
    en: "Object-Oriented Programming (OOP):\n- **Class**: a template (like “Student”) with data and functions.\n- **Object**: a real instance of the class (a student named Ahmed).\n- **Encapsulation**: hide data (private) and access it via getters/setters.\n- **Inheritance**: a new class inherits from an existing one.\n- **Polymorphism**: the same function name behaves differently depending on the object.",
  },
  {
    keys: ["cin", "cout", "ادخال واخراج", "الادخال والاخراج", "input output", "iostream"],
    ar: "في C++ الإدخال والإخراج من مكتبة <iostream>:\n#include <iostream>\nusing namespace std;\nint main() { int n; cin >> n; cout << \"You entered \" << n << endl; }\n**cin >>** للإدخال، و**cout <<** للإخراج.",
    en: "In C++, input/output comes from <iostream>:\n#include <iostream>\nusing namespace std;\nint main() { int n; cin >> n; cout << \"You entered \" << n << endl; }\n**cin >>** reads input and **cout <<** prints output.",
  },
  {
    keys: ["مشكله في الكود", "مشكله في البرنامج", "خطا في الكود", "الكود فيهو خطا", "الكود ما شغال", "الكود ما بيشتغل", "اخطاء البرمجه", "error", "errors", "compile error", "syntax error", "debug", "debugging"],
    ar: "خطوات حل الأخطاء:\n- اقرأ رسالة الخطأ وشوف **رقم السطر**.\n- أشهر الأخطاء: نسيان **;** في آخر السطر، قوس { } ناقص، كتابة اسم متغير بشكل مختلف (C++ تفرّق بين الحروف الكبيرة والصغيرة)، أو نسيان #include.\n- لو البرنامج شغال لكن النتيجة غلط: اطبع قيم المتغيرات بـ cout عشان تعرف وين المشكلة.",
    en: "Debugging steps:\n- Read the error message and check the **line number**.\n- Common mistakes: a missing **;**, an unmatched { }, a misspelled variable (C++ is case-sensitive), or a missing #include.\n- If it runs but the result is wrong: print variable values with cout to see where it goes wrong.",
  },
  {
    keys: ["فرونت اند", "فرونت", "باك اند", "فل ستاك", "frontend", "front end", "backend", "back end", "full stack"],
    ar: "- **Front-end**: الجزء الذي يراه المستخدم في المتصفح (HTML و CSS و JavaScript، ومكتبات مثل React).\n- **Back-end**: السيرفر وقاعدة البيانات والحسابات والصلاحيات (مثل Node.js أو PHP أو Supabase).\n- **Full-stack**: مطوّر يعمل في الاثنين. المنصة دي نفسها: الواجهة Next.js والخلفية Supabase.",
    en: "- **Front-end**: what users see in the browser (HTML, CSS, JavaScript and libraries like React).\n- **Back-end**: the server, database, accounts and permissions (e.g. Node.js, PHP or Supabase).\n- **Full-stack**: a developer who does both. This very platform uses Next.js for the front-end and Supabase for the back-end.",
  },
  {
    keys: ["html", "css", "javascript", "جافاسكربت", "جافا سكريبت", "js"],
    ar: "لغات الويب الثلاث:\n- **HTML**: هيكل الصفحة ومحتواها (عناوين، فقرات، صور).\n- **CSS**: التنسيق والشكل (ألوان، خطوط، ترتيب).\n- **JavaScript**: التفاعل والمنطق (أزرار، جلب بيانات).\nتشبيه بسيط: HTML الهيكل العظمي، CSS الملابس، JavaScript العضلات.",
    en: "The three web languages:\n- **HTML**: page structure and content (headings, paragraphs, images).\n- **CSS**: styling and layout (colors, fonts, positioning).\n- **JavaScript**: interaction and logic (buttons, fetching data).\nSimple analogy: HTML is the skeleton, CSS the clothes, JavaScript the muscles.",
  },
  {
    keys: ["قاعده بيانات", "قواعد البيانات", "داتابيس", "database", "databases", "sql"],
    ar: "قاعدة البيانات مكان منظم لحفظ البيانات في **جداول** (صفوف وأعمدة)، مثل جدول للطلاب وجدول للمواد. **SQL** هي اللغة التي نستعلم بها:\nSELECT name FROM students WHERE semester = 3;\nميزتها على الملفات العادية: تقليل التكرار والحفاظ على سلامة البيانات.",
    en: "A database stores data in organized **tables** (rows and columns), like a students table and a subjects table. **SQL** is the language to query it:\nSELECT name FROM students WHERE semester = 3;\nCompared to plain files, it reduces redundancy and keeps data consistent.",
  },
  {
    keys: ["git", "github", "جيت هب", "قيت هب", "جيت"],
    ar: "**Git** يحفظ تاريخ تعديلات الكود (كل commit نقطة رجوع). **GitHub** موقع ترفع فيه مشاريعك وتتعاون مع غيرك، وهو كمان «معرض أعمالك» قدام الشركات. ابدأ بالأوامر: git add ثم git commit ثم git push.",
    en: "**Git** tracks the history of your code (each commit is a restore point). **GitHub** is a site to host your projects and collaborate, and it's also your portfolio for employers. Start with: git add, git commit, git push.",
  },
  {
    keys: ["خوارزميه", "الخوارزميات", "خوارزميات", "algorithm", "algorithms", "flowchart", "فلوشارت", "مخطط انسيابي"],
    ar: "الخوارزمية (Algorithm) خطوات مرتبة وواضحة لحل مشكلة، قبل كتابة الكود. مثال لإيجاد الأكبر بين رقمين: 1) اقرأ a و b. 2) إذا a > b اطبع a. 3) وإلا اطبع b. الـ **Flowchart** رسم لهذه الخطوات بالأشكال والأسهم.",
    en: "An algorithm is a clear, ordered set of steps to solve a problem, before writing code. Example, the larger of two numbers: 1) read a and b; 2) if a > b print a; 3) otherwise print b. A **flowchart** draws these steps with shapes and arrows.",
  },
  {
    keys: ["برنامج اكتب فيه الكود", "اكتب الكود وين", "محرر اكواد", "vs code", "code blocks", "dev c++", "compiler", "كومبايلر", "اي دي اي"],
    ar: "لكتابة وتشغيل C++ تحتاج محرر + Compiler: **Code::Blocks** أو **Dev-C++** سهلة للمبتدئين، و**VS Code** ممتاز للويب ولكل اللغات. وبدون تثبيت أي شيء تقدر تجرّب على مواقع مثل onlinegdb.com.",
    en: "To write and run C++ you need an editor + compiler: **Code::Blocks** or **Dev-C++** are easy for beginners, and **VS Code** is great for web and all languages. Without installing anything you can try sites like onlinegdb.com.",
  },
  {
    keys: ["اتمرن وين", "مواقع للتمرين", "مواقع تمارين", "تمارين برمجه", "مصادر", "كورسات", "practice coding", "coding practice", "resources", "courses"],
    ar: "للتمرين: ابدأ بحل **أسئلة المراجعة** في المنصة، ثم مواقع مثل HackerRank وCodeforces (مسائل)، وW3Schools (شرح الويب بالأمثلة). أهم شيء: مشروع صغير خاص بيك (آلة حاسبة، نظام درجات طلاب).",
    en: "To practise: start with the platform's **review questions**, then sites like HackerRank and Codeforces (problems) and W3Schools (web tutorials with examples). Most important: build a small project of your own (a calculator, a student-grades system).",
  },
  {
    keys: ["chatgpt", "شات جي بي تي", "الذكاء الاصطناعي في البرمجه", "استخدم الذكاء الاصطناعي", "ai for coding"],
    ar: "الذكاء الاصطناعي مفيد كـ **مدرّس**: اطلب منه يشرح خطأ أو مفهوم. لكن ما تخليه يكتب الواجب بدلك، لأنك في الامتحان حتكتب براك. القاعدة: افهم كل سطر قبل ما تستخدمه.",
    en: "AI is useful as a **tutor**: ask it to explain an error or a concept. But don't let it do your assignments, because you'll write the code yourself in the exam. Rule: understand every line before you use it.",
  },

  // ---------------- اللغة والتحية (بعد أسئلة البرمجة حتى لا تتعارض «لغة البرمجة» مع «لغة الموقع») ----------------
  {
    keys: ["تغيير اللغه", "غير اللغه", "لغه الموقع", "لغه المنصه", "بالانجليزي", "change language", "switch language", "site language", "language button"],
    ar: "زر تغيير اللغة (عربي / English) في الشريط العلوي. اللغة تُحفظ في متصفحك.",
    en: "The language button (عربي / English) is in the top bar. Your choice is saved in your browser.",
  },
  {
    keys: ["مرحبا", "اهلا", "هلا", "السلام", "سلام", "hello", "hi", "hey", "صباح", "مساء"],
    ar: "أهلاً بك! 👋 اسألني مثلاً: «كيف أرفع ملفاً؟» أو «محاضرات Calculus» أو «يعني شنو متغير؟».",
    en: "Hi there! 👋 Try asking: “How do I upload a file?”, “Calculus lectures” or “What is a variable?”.",
  },
];

const MATERIAL_KEYS = {
  Lectures: ["محاضره", "محاضرات", "شيت", "شيتات", "ملزمه", "lecture", "lectures", "sheet", "sheets", "notes"],
  Exams: ["امتحان", "امتحانات", "اختبار", "exam", "exams", "past", "midterm", "final"],
  Questions: ["اسئله", "سؤال", "mcq", "questions", "اختبرني", "quiz", "مراجعه", "practice"],
};

const SUGGEST = {
  ar: "لم أفهم سؤالك تماماً 🤔 جرّب أن تسأل مثلاً:\n- كيف أرفع ملفاً؟\n- محاضرات Calculus\n- امتحانات Accounting II\n- يعني شنو pointer؟\n- كيف أتعلم البرمجة؟",
  en: "I didn't quite get that 🤔 Try asking, for example:\n- How do I upload a file?\n- Calculus lectures\n- Accounting II exams\n- What is a pointer?\n- How do I learn programming?",
};

// ---------------------------------------------------------------------
// أدوات المطابقة
// ---------------------------------------------------------------------
// تطابق عبارة مفتاحية داخل سؤال الطالب. نقبل الأخطاء الإملائية البسيطة فقط في الكلمات الطويلة.
function phraseScore(phrase, qText) {
  const pt = tokens(phrase);
  if (!pt.length) return 0;
  const s = scoreText(pt, qText);
  if (s >= 70) return s;
  if (s >= 50 && pt.every((t) => t.length >= 5)) return s;
  return 0;
}

function bestFaq(qText) {
  let best = null;
  let bestScore = 0;
  for (const item of FAQ) {
    for (const key of item.keys) {
      // عند التعادل تفوز العبارة الأطول (الأكثر تحديداً)
      const base = phraseScore(key, qText);
      const s = base ? base + (tokens(key).length - 1) * 0.5 : 0;
      if (s > bestScore) {
        bestScore = s;
        best = item;
      }
    }
  }
  return best;
}

function detectMaterial(qText) {
  let best = null;
  let bestScore = 0;
  for (const [material, words] of Object.entries(MATERIAL_KEYS)) {
    for (const w of words) {
      const s = phraseScore(w, qText);
      if (s > bestScore) {
        bestScore = s;
        best = material;
      }
    }
  }
  return best;
}

// أفضل مادة: نحسب كم كلمة من اسم المادة (أو اسمها العربي البديل) ظهرت في السؤال
function detectSubjects(qText) {
  const scored = [];
  for (const s of ALL_SUBJECTS) {
    let best = 0;
    for (const name of [s.name, ...s.aliases]) {
      const nt = tokens(name);
      const hits = nt.filter((t) => scoreText([t], qText) >= 50);
      const wordHit = hits.some((t) => !/^\d+$/.test(t));
      if (!wordHit) continue;
      const frac = hits.length / nt.length;
      if (frac > best) best = frac;
    }
    if (best >= 0.5) scored.push({ s, score: best });
  }
  scored.sort((a, b) => b.score - a.score);
  if (!scored.length) return [];
  return scored.filter((x) => x.score === scored[0].score).map((x) => x.s);
}

// الروابط داخل ماركداون: نشفّر الأقواس حتى لا تكسر الرابط
const safeUrl = (u) => String(u).replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/\s/g, "%20");
const pageLink = (s, material) => `/subject/${s.slug}/${material}/`;

// صيغة العدد بالعربي: 1 سؤال، 2 سؤالان، 3-10 أسئلة، 11+ سؤالاً
function arCount(n, one, two, few, many) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

async function subjectAnswer(subject, material, lang) {
  const ar = lang === "ar";
  if (!material) {
    return ar
      ? `مادة **${subject.name}** ${subject.icon || ""}\n- [المحاضرات](${pageLink(subject, "Lectures")})\n- [الامتحانات](${pageLink(subject, "Exams")})\n- [أسئلة المراجعة](${pageLink(subject, "Questions")})`
      : `**${subject.name}** ${subject.icon || ""}\n- [Lectures](${pageLink(subject, "Lectures")})\n- [Exams](${pageLink(subject, "Exams")})\n- [Review questions](${pageLink(subject, "Questions")})`;
  }
  if (material === "Questions") {
    const n = (QUESTIONS_DATA[subject.name] || []).length;
    return n
      ? ar
        ? `لمادة **${subject.name}** ${arCount(n, "سؤال اختيار من متعدد واحد", "سؤالان اختيار من متعدد", "أسئلة اختيار من متعدد", "سؤالاً اختيار من متعدد")} مع تصحيح فوري: [افتح الأسئلة](${pageLink(subject, "Questions")})`
        : `**${subject.name}** has ${n} multiple-choice questions with instant feedback: [open the questions](${pageLink(subject, "Questions")})`
      : ar
        ? `لا توجد أسئلة اختيار لمادة **${subject.name}** حالياً.`
        : `There are no multiple-choice questions for **${subject.name}** yet.`;
  }
  const label = material === "Lectures" ? (ar ? "المحاضرات" : "lectures") : ar ? "الامتحانات" : "exams";
  let files = [];
  try {
    files = await loadFiles(subject.name, material);
  } catch {
    /* نكمل بصفحة المادة */
  }
  const page = `[${ar ? "صفحة" : "Open"} ${label}](${pageLink(subject, material)})`;
  if (!files.length) {
    return ar
      ? `لا توجد ${label} مضافة لمادة **${subject.name}** حتى الآن. ${page}\nيمكنك رفع ملف بنفسك وسيظهر بعد موافقة الأدمن.`
      : `No ${label} have been added for **${subject.name}** yet. ${page}\nYou can upload one yourself; it shows up after admin approval.`;
  }
  const list = files.slice(0, 8).map((f) => `- [${f.name}](${safeUrl(f.url)})`).join("\n");
  const more = files.length > 8 ? (ar ? `\nوهناك ${arCount(files.length - 8, "ملف آخر", "ملفان آخران", "ملفات أخرى", "ملفاً آخر")}.` : `\n${files.length - 8} more files.`) : "";
  return (ar ? `${label} **${subject.name}**:\n` : `**${subject.name}** ${label}:\n`) + list + more + "\n" + page;
}

/** الدالة الرئيسية: تأخذ سؤال الطالب وترجع نص الرد */
export async function localAnswer(question, lang) {
  const ar = lang === "ar";
  const qText = String(question || "").slice(0, 300);
  const material = detectMaterial(qText);
  const subjects = detectSubjects(qText);
  const faq = bestFaq(qText);

  // مادة محددة + (قسم مطلوب أو لا يوجد سؤال شائع) ← جواب المادة
  if (subjects.length === 1 && (material || !faq)) {
    return subjectAnswer(subjects[0], material, lang);
  }
  // أكثر من مادة محتملة (مثل Accounting I و II) ← نسأل الطالب
  if (subjects.length > 1 && subjects.length <= 4 && (material || !faq)) {
    const opts = subjects.map((s) => `- ${s.name}`).join("\n");
    return ar ? `أي مادة تقصد؟\n${opts}\nاكتب الاسم كاملاً.` : `Which subject do you mean?\n${opts}\nPlease type the full name.`;
  }
  if (faq) return ar ? faq.ar : faq.en;
  // طلب قسم (محاضرات/امتحانات/أسئلة) بدون تحديد المادة ← نسأل عن المادة
  if (material) {
    const ex = { Lectures: ["محاضرات Calculus", "Calculus lectures"], Exams: ["امتحانات Accounting II", "Accounting II exams"], Questions: ["أسئلة Programming Methods I", "Programming Methods I questions"] }[material];
    return ar ? `لأي مادة؟ اكتب اسم المادة مع طلبك، مثلاً: «${ex[0]}».` : `For which subject? Include the subject name, e.g. “${ex[1]}”.`;
  }
  return ar ? SUGGEST.ar : SUGGEST.en;
}
