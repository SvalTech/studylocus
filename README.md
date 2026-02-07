# StudyLocus 

![Status](https://img.shields.io/badge/status-live-success)

**The ultimate, distraction-free dashboard for JEE, NEET, and competitive exam preparation.**

StudyLocus is a feature-rich, customizable web application designed to help students track their syllabus, manage tasks, log study hours, and maintain focus. Built with a "student-first" philosophy, it combines productivity tools with powerful analytics and gamification.

🔗 **Live At:** [sval.tech/studylocus](https://sval.tech/studylocus/)

---

## ✨ Key Features

### 🧠 **Productivity & Focus**
* **Pomodoro Timer:** Built-in focus timer with customizable work/break intervals and audio alerts.
* **Study Logger:** Track time spent on specific subjects (Physics, Chemistry, Maths, etc.) with manual entry support.
* **Ambient Soundscapes:** Integrated white, pink, and brown noise generators with rain and thunder overlays to drown out distractions.
* **Super Focus Mode (`F`):** A fullscreen, immersive interface with a giant clock or timer to eliminate all UI clutter.
* **Zen Mode (`Z`):** Collapses the UI to show only the active cards.

### 📊 **Analytics & Tracking**
* **Journey Graph:** A GitHub-style contribution graph visualizes your study consistency from day 1 to exam day.
* **Marks Tracker:** Plot your mock test scores on a line graph. Track subject-wise performance (PCM/PCB) and set target scores.
* **Study Analytics:** Bar charts visualizing your study hours over the last 7 or 30 days.
* **Live Countdown:** Precision countdown to your specific exam date (JEE Mains, Advanced, NEET, or Custom).

### 🎨 **Customization & UI**
* **Modular Grid:** Drag, drop, and resize cards to create your perfect layout.
* **Cloud Sync (Firebase):** Sign in with Google to sync your layout, tasks, and logs across devices.
* **Theming:** 10+ High-quality themes including **Cyberpunk**, **Dracula**, **Nordic**, **Rose Gold**, and the meme-worthy **Alakh Pandey** theme.
* **Riced Linux Mode:** A toggle for Unix enthusiasts that moves controls to a top bar, mimicking a riced window manager.

### 🛠 **Widgets (Cards)**
* **Daily Agenda:** Date-specific task planning with progress bars.
* **To-Do List:** Nested subtasks, priority tagging (Low/Med/High), and status toggling.
* **YouTube Embed:** Watch lectures or lo-fi streams
* **Sticky Notes:** Quick scratchpad for formulas or reminders.

---

## 🛠️ Tech Stack

* **Frontend:** HTML5, Vanilla JavaScript (ES6+), Tailwind CSS (via CDN).
* **Backend / Auth:** Firebase (Authentication & Firestore) for real-time data syncing.
* **Libraries:**
    * `Chart.js` - Data visualization (Marks/Analytics).
    * `Tone.js` - Audio synthesis for ambient sounds and ticks.
    * `SortableJS` - Drag-and-drop grid functionality.
    * `Driver.js` - Onboarding tutorial.

---

## ⌨️ Keyboard Shortcuts

Power users can navigate StudyLocus without touching the mouse:

| Key | Action |
| :--- | :--- |
| **`Space`** | Toggle the active timer (Pomodoro or Logger) |
| **`F`** | Toggle **Super Focus Mode** (Fullscreen) |
| **`Z`** | Toggle **Zen Mode** |
| **`N`** | Open "Add New Card" modal |
| **`C`** | Open Customization/Settings menu |
| **`?`** | Show Keyboard Shortcuts help |
| **`Esc`** | Close modals or exit Focus Mode |

---

<footer class="fixed bottom-2 right-4 text-xs text-gray-500 flex gap-4">
    <a href="https://sval.tech/studylocus/termsandconditions.html"  target="_blank" class="hover:text-blue-400 transition-colors">Terms & Conditions</a>
    <a href="https://sval.tech/studylocus/privacypolicy.html"  target="_blank"  class="hover:text-blue-400 transition-colors">Privacy Policy</a>
</footer>

