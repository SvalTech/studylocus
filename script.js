console.log("Kyu nahi ho rahi padhai?")
/**

 * Creates a debounced version of a function that delays invoking the function

 * until after 'delay' milliseconds have passed since the last time it was invoked.

 */
function debounce(func, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

// --- Firebase Configuration ---
// (Note: Your provided config is here)
const firebaseConfig = {
    apiKey: "AIzaSyAO9ya8gHtVbMfxcnAAJrz6FdYWvIRqgBY",
    authDomain: "studydashboard-2a3eb.firebaseapp.com",
    projectId: "studydashboard-2a3eb",
    storageBucket: "studydashboard-2a3eb.firebasestorage.app",
    messagingSenderId: "79210973277",
    appId: "1:79210973277:web:cc0a5fa86729fd6d3f65b4",
    measurementId: "G-TE7Z0SR8L1",
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
// --- Global State ---
let currentUser = null;
let syncTimeout = null;
let unsubscribeFirestore = null;
// --- DOM Ready Event Listener ---
document.addEventListener("DOMContentLoaded", () => {
    /**

    * Maps internal state keys to their corresponding localStorage keys.

    */
    const LOCAL_STORAGE_KEYS = {
        tests: "jeePartTests_v2",
        layout: "jeeDashboardLayout_v3",
        customCards: "jeeCustomCards_v3",
        settings: "jeeDashboardSettings_v3",
        mobileAlertDismissed: "jeeMobileAlertDismissed_v1",
        cardProps: "jeeCardProps_v2",
        pomodoroState: "jeePomodoroState_v1",
        timeLoggerState: "jeeTimeLoggerState_v1",
        studyLogs: "jeeStudyLogs_v1",
    };
    /**

    * Default target exam dates.

    */
    const EXAM_DATES = {
        JEE: {
            2026: new Date("2026-01-21T00:00:00"),
            2027: new Date("2027-01-21T00:00:00"),
            2028: new Date("2028-01-21T00:00:00")
        },
        NEET: {
            2026: new Date("2026-05-03T00:00:00"),
            2027: new Date("2027-05-02T00:00:00"),
            2028: new Date("2028-05-02T00:00:00")
        },
    };
    const EXAM_DEFAULTS = {
        JEE: {
            January: {
                2026: "2026-01-21",
                2027: "2027-01-21",
                2028: "2028-01-21"
            },
            April: {
                2026: "2026-04-05",
                2027: "2027-04-05",
                2028: "2028-04-05"
            }
        },
        NEET: {
            2026: "2026-05-03",
            2027: "2027-05-02",
            2028: "2028-05-07"
        }
    };
    // Load initial state from localStorage
    const parsedSettings = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.settings));
    /**

    * Main application state object.

    * Manages all dashboard data and provides methods to save it.

    */
    const appState = {
        tests: JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.tests)) || {},
        customCards: JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.customCards)) || [{
            id: "default-todo",
            type: "todo",
            title: "My Tasks",
            content: [],
        }, {
            id: "default-line-graph",
            type: "line-graph",
            title: "Mock Test Progress",
            content: [{
                name: "Test 1",
                marks: 120,
                subjects: {
                    chemistry: 40,
                    physics: 60,
                    maths: 20
                },
                maxMarks: 300
            }, {
                name: "Test 2",
                marks: 145,
                subjects: {
                    chemistry: 50,
                    physics: 70,
                    maths: 25
                },
                maxMarks: 300
            }, {
                name: "Test 3",
                marks: 160,
                subjects: {
                    chemistry: 50,
                    physics: 80,
                    maths: 30
                },
                maxMarks: 300
            },],
        }, {
            id: "default-note",
            type: "note",
            title: "Welcome!",
            content: "Welcome to your new dashboard! You can drag, resize, and delete these cards. Add your own from the top right customise button. Best of luck in your journey! You can delete this card now.",
        }, {
            id: "default-study-logger",
            type: "time-logger",
            title: "Study Log",
            content: []
        },],
        layout: JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.layout)) || ["countdown", "graph", "default-todo", "default-study-logger", "default-note", "default-line-graph", "tests", "quote", "time",],
        settings: {
            theme: "default",
            font: "'Inter', sans-serif",
            bgUrl: "",
            examType: "JEE",
            examYear: "2026",
            jeeSession: "January",
            jeeShiftDate: "",
            youtubeTintEnabled: true,
            youtubeBlurEnabled: false,
            focusShieldEnabled: false,
            ricedModeEnabled: false,
            tickingSoundEnabled: false,
            userSubjects: [],
            customExamName: "", 
            customExamDate: "",
            ...parsedSettings,
        },
        cardProps: JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.cardProps)) || {
            graph: {
                colspan: 2
            },
            "default-line-graph": {
                colspan: 1
            },
            "default-study-logger": {
                colspan: 1
            },
        },
        pomodoroState: JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.pomodoroState)) || {},
        timeLoggerState: JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.timeLoggerState)) || {},
        studyLogs: JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.studyLogs)) || {},
        chartInstances: {}, // Holds active Chart.js instances
        activeTimer: {
            cardId: null,
            type: null,
            unfocusedTime: 0,
            unfocusedStart: 0
        },
        /**

        * Saves a specific part of the state to localStorage and triggers a cloud sync.

        * @param {string} key The key of the appState property to save (e.g., 'tests', 'layout').

        */
        save(key) {
            localStorage.setItem(LOCAL_STORAGE_KEYS[key], JSON.stringify(this[key]));
            if (currentUser) {
                showSyncStatus("Saving..."); // Show "Saving..." immediately
                debouncedSaveAllToFirestore();
            }
        },
        /**

        * Saves the 'settings' object specifically.

        */
        saveSettings() {
            localStorage.setItem(LOCAL_STORAGE_KEYS.settings, JSON.stringify(this.settings));
            if (currentUser) {
                showSyncStatus("Saving...");
                debouncedSaveAllToFirestore();
            }
        },
    };
    // --- Quotes Data ---
    const generalQuotes = [{
        text: "The secret of getting ahead is getting started.",
        author: "Mark Twain"
    }, {
        text: "It’s not whether you get knocked down, it’s whether you get up.",
        author: "Vince Lombardi"
    }, {
        text: "Success is the sum of small efforts, repeated day in and day out.",
        author: "Robert Collier"
    }, {
        text: "The expert in anything was once a beginner.",
        author: "Helen Hayes"
    }, {
        text: "Believe you can and you're halfway there.",
        author: "Theodore Roosevelt"
    }, {
        text: "The difference between ordinary and extraordinary is that little extra.",
        author: "Jimmy Johnson",
    }, {
        text: "A person who never made a mistake never tried anything new.",
        author: "Albert Einstein"
    }, {
        text: "The harder I work, the luckier I get.",
        author: "Samuel Goldwyn"
    }, {
        text: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
        author: "Winston Churchill",
    }, {
        text: "Strive for progress, not perfection.",
        author: "Unknown"
    }, {
        text: "Genius is one percent inspiration and ninety-nine percent perspiration.",
        author: "Thomas A. Edison",
    }, {
        text: "It does not matter how slowly you go as long as you do not stop.",
        author: "Confucius"
    }, {
        text: "Doubt kills more dreams than failure ever will.",
        author: "Suzy Kassem"
    }, {
        text: "Push yourself, because no one else is going to do it for you.",
        author: "Unknown"
    }, {
        text: "If you want to shine like a sun, first burn like a sun.",
        author: "A. P. J. Abdul Kalam"
    }, {
        text: "The important thing is not to stop questioning. Curiosity has its own reason for existing.",
        author: "Albert Einstein",
    }, {
        text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
        author: "Aristotle",
    }, {
        text: "The chapters you study today will decide the chapters of your life tomorrow.",
        author: "Unknown"
    }, {
        text: "Your toughest competition is the person you were yesterday.",
        author: "Unknown"
    }, {
        text: "Rank is just a number. Knowledge and skill are the real assets.",
        author: "Unknown"
    }, {
        text: "Dream is not that which you see while sleeping it is something that does not let you sleep.",
        author: "A. P. J. Abdul Kalam",
    }, {
        text: "Focus on the process, not the outcome. The right process will lead to the right outcome.",
        author: "Unknown",
    },];
    const alakhPandeyQuotes = [{
        text: "Kyu nahi ho rahi padhai?",
        author: "Alakh Pandey"
    }, {
        text: "System phaad denge!",
        author: "A wise man"
    }, {
        text: "Physics is not a subject, it's an emotion.",
        author: "Alakh Pandey"
    }, {
        text: "Aag laga denge!",
        author: "Revolutionaries"
    }, {
        text: "Mehnat karta hu bhai",
        author: "Basava Reddy"
    },];
    const chaitanyaQuotes = [ // Easter egg quotes
        {
            text: "Chaitanya is a noob 🤓",
            author: "Everyone"
        }, {
            text: "I love Organic Chemistry 🤓",
            author: "Chaitanya (probably)"
        }, {
            text: "Isomerism is my favorite topic 🤓",
            author: "Definitely Chaitanya"
        }, {
            text: "Just like us guys 🤓",
            author: "Chaitanya the moron"
        },
    ];
    /**

    * Object containing references to all key DOM elements.

    */
    const domElements = {
        body: document.body,
        mainTitle: document.getElementById("main-title"),
        mainTitleRiced: document.getElementById("main-title-riced"),
        dashboardGrid: document.getElementById("dashboard-grid"),
        authContainer: document.getElementById("auth-container"),
        authContainerRiced: document.getElementById("auth-container-riced"),
        syncStatusToast: document.getElementById("sync-status-toast"),
        modals: {
            addCard: document.getElementById("add-card-modal"),
            customize: document.getElementById("customize-modal"),
            info: document.getElementById("info-modal"),
            confirm: document.getElementById("confirm-modal"),
        },
        buttons: {
            addCard: document.querySelectorAll(".add-card-btn"),
            cancelAddCard: document.getElementById("cancel-add-card"),
            customize: document.querySelectorAll(".customize-btn"),
            closeCustomize: document.getElementById("close-customize"),
            closeCustomizeIcon: document.getElementById("close-customize-icon-btn"),
            removeBg: document.getElementById("remove-bg-btn"),
            closeAlert: document.getElementById("close-alert-btn"),
            resetDashboard: document.getElementById("reset-dashboard-btn"),
            info: document.querySelectorAll(".info-btn"),
            closeInfo: document.getElementById("close-info-modal"),
            exportData: document.getElementById("export-data-btn"),
            importData: document.getElementById("import-data-btn"),
            confirmOk: document.getElementById("confirm-ok-btn"),
            confirmCancel: document.getElementById("confirm-cancel-btn"),
            zenModeBtn: document.querySelectorAll(".zen-mode-btn"),
            exitZenBtn: document.getElementById("exit-zen-btn"),
            godModeClose: document.getElementById("god-mode-close-btn"),
        },
        forms: {
            newCard: document.getElementById("new-card-form"),
        },
        inputs: {
            cardType: document.getElementById("new-card-type"),
            cardContent: document.getElementById("new-card-content"),
            theme: document.getElementById("theme-select"),
            font: document.getElementById("font-select"),
            bgUrl: document.getElementById("bg-image-url"),
            examType: document.getElementById("exam-type-select"),
            examYear: document.getElementById("exam-year-select"),
            importFile: document.getElementById("import-file-input"),
            youtubeTintToggle: document.getElementById("youtube-tint-toggle"),
            youtubeBlurToggle: document.getElementById("youtube-blur-toggle"),
            focusShieldToggle: document.getElementById("focus-shield-toggle"),
            ricedModeToggle: document.getElementById("riced-mode-toggle"),
            jeeSession: document.getElementById("jee-session-select"), // NEW
            jeeShift: document.getElementById("jee-shift-input"), // NEW
            jeeContainer: document.getElementById("jee-details-container"),
            customContainer: document.getElementById("custom-exam-container"),
            customName: document.getElementById("custom-exam-name"),
            customDate: document.getElementById("custom-exam-date"),
            tickingSoundToggle: document.getElementById("ticking-sound-toggle"),
        },
        mobileAlert: document.getElementById("mobile-alert"),
        confirmTitle: document.getElementById("confirm-title"),
        confirmMessage: document.getElementById("confirm-message"),
        godModePanel: document.getElementById("god-mode-panel"),
        
    };
    // --- App Loading State ---
    // Disable controls until Firebase auth state is resolved
    domElements.buttons.addCard.forEach(btn => btn.disabled = true);
    domElements.dashboardGrid.style.pointerEvents = "none";
    domElements.dashboardGrid.style.opacity = "0.5";
    // --- Picture-in-Picture (PiP) State ---
    let pipWindow = null;
    let pipCardId = null;
    let pipCardType = null;
    // --- Authentication ---
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            loadUserData(user);
            enableAppControls();
        } else {
            currentUser = null;
            updateAuthUI();
            enableAppControls();
        }
    });
    /**

    * Initiates Google Sign-In popup.

    */
    const signInWithGoogle = () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).catch((error) => {
            console.error("Authentication Error:", error);
        });
    };
    /**

    * Signs out the current user.

    */
    const signOutUser = () => {
        if (unsubscribeFirestore) {
        unsubscribeFirestore(); // Stop listening to the database
        unsubscribeFirestore = null;
    }
    
        // Clear local app state to prevent the next user from seeing old data briefly
        // (Optional but recommended)
        domElements.dashboardGrid.innerHTML = "";
        sessionStorage.removeItem("cloud_data_loaded"); // Force cloud reload on next login
        auth.signOut();
    };
    /**

    * Enables dashboard controls after auth state is determined.

    */
    const enableAppControls = () => {
        domElements.buttons.addCard.forEach(btn => btn.disabled = false);
        domElements.dashboardGrid.style.pointerEvents = "auto";
        domElements.dashboardGrid.style.opacity = "1";
    };
    /**
     * Updates the auth container UI based on the current user state.
     */
    const updateAuthUI = () => {
        const containers = [domElements.authContainer, domElements.authContainerRiced];
        
        // Icons
        const logoutIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`;
        const googleIcon = `<svg class="w-4 h-4" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M47.532 24.552c0-1.566-.14-3.084-.404-4.548H24.5v8.58h12.944c-.566 2.76-2.213 5.108-4.72 6.708v5.524h7.112c4.162-3.832 6.596-9.42 6.596-16.264z" fill="#4285F4"/><path d="M24.5 48c6.48 0 11.944-2.14 15.928-5.788l-7.112-5.524c-2.14 1.44-4.884 2.292-7.816 2.292-6.004 0-11.084-4.04-12.9-9.492H4.42v5.7c3.48 6.912 10.32 11.532 18.08 11.532l2 .28z" fill="#34A853"/><path d="M11.6 28.98c-.34-.996-.54-2.052-.54-3.144s.2-2.148.54-3.144V16.992H4.42C2.852 20.04 2 23.436 2 27.024c0 3.588.852 6.984 2.42 10.032l7.18-5.7v-.376z" fill="#FBBC05"/><path d="M24.5 9.8c3.516 0 6.66 1.212 9.128 3.54l6.32-6.32C36.44.88 30.98 0 24.5 0 16.74 0 9.9 4.62 6.42 11.532l7.18 5.7c1.816-5.452 6.896-9.432 12.9-9.432z" fill="#EA4335"/></svg>`;

        containers.forEach(container => {
            if (!container) return;

            if (currentUser) {
                // --- SIGNED IN (Subtle Avatar) ---
                const userMenuHTML = `
                    <div class="relative group" id="user-menu-container">
                        <button id="user-menu-button" title="User Menu" class="flex items-center justify-center rounded-full transition-transform active:scale-95 focus:outline-none">
                            <img src="${currentUser.photoURL}" alt="User" class="w-8 h-8 rounded-full object-cover border border-transparent group-hover:border-[var(--border-color)] opacity-90 group-hover:opacity-100 transition-all" />
                        </button>

                        <div id="user-menu-dropdown" class="absolute right-0 mt-2 w-56 origin-top-right transform transition-all duration-200 scale-95 opacity-0 invisible z-50">
                            <div class="card p-0 overflow-hidden shadow-xl ring-1 ring-black/5 backdrop-blur-xl">
                                
                                <div class="px-4 py-3 border-b border-[var(--border-color)] bg-white/5">
                                    <p class="text-sm font-semibold text-[var(--text-primary)] truncate">${currentUser.displayName}</p>
                                    <p class="text-xs text-[var(--text-secondary)] truncate font-mono opacity-75">${currentUser.email}</p>
                                </div>

                                <div class="p-1">
                                    <button id="sign-out-btn" class="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--text-secondary)] rounded hover:bg-white/10 hover:text-red-400 transition-colors">
                                        ${logoutIcon}
                                        <span>Sign Out</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                container.innerHTML = userMenuHTML;

                // Listeners
                const btn = container.querySelector("#user-menu-button");
                const dropdown = container.querySelector("#user-menu-dropdown");
                const signOutBtn = container.querySelector("#sign-out-btn");

                const toggleMenu = (e) => {
                    e.stopPropagation();
                    const isHidden = dropdown.classList.contains("invisible");
                    
                    if (isHidden) {
                        dropdown.classList.remove("invisible", "opacity-0", "scale-95");
                        dropdown.classList.add("opacity-100", "scale-100");
                        
                        // --- SMART POSITIONING FIX ---
                        const rect = dropdown.getBoundingClientRect();
                        const screenWidth = window.innerWidth;
                        
                        // If the right edge of the menu is past the screen width
                        if (rect.right > screenWidth) {
                            // Shift it left by the difference + 10px padding
                            const overflow = rect.right - screenWidth + 10;
                            dropdown.style.right = `${overflow}px`;
                        } else {
                            dropdown.style.right = "0px"; // Reset if normal
                        }
                        // -----------------------------
                        
                    } else {
                        dropdown.classList.add("invisible", "opacity-0", "scale-95");
                        dropdown.classList.remove("opacity-100", "scale-100");
                        dropdown.style.right = ""; // Reset style on close
                    }
                };

                btn.addEventListener("click", toggleMenu);
                signOutBtn.addEventListener("click", signOutUser);

                document.addEventListener("click", (e) => {
                    if (!container.contains(e.target)) {
                        dropdown.classList.add("invisible", "opacity-0", "scale-95");
                        dropdown.classList.remove("opacity-100", "scale-100");
                    }
                });

            } else {
                // --- SIGNED OUT (Subtle Glass Button) ---
                const signInHTML = `
                    <button id="sign-in-btn" class="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[var(--border-color)] bg-transparent hover:bg-white/5 text-[var(--text-primary)] transition-all text-xs font-medium">
                        ${googleIcon}
                        <span class="opacity-90">Sign In</span>
                    </button>
                `;
                container.innerHTML = signInHTML;
                container.querySelector("#sign-in-btn").addEventListener("click", signInWithGoogle);
            }
        });
    };
    /**

     * Debounced function to save the ENTIRE local app state to Firestore.

     * This bundles all changes (layout, cards, tests) into one write.

     */
    const debouncedSaveAllToFirestore = debounce(() => {
        if (!currentUser) return;
        console.log("Debounced save triggered. Saving all data to cloud...");
        const userDocRef = db.collection("users").doc(currentUser.uid);
        // 1. Get all data from localStorage (which is our up-to-date cache)
        const localData = {};
        for (const key in LOCAL_STORAGE_KEYS) {
            const dataString = localStorage.getItem(LOCAL_STORAGE_KEYS[key]);
            if (dataString) {
                localData[key] = JSON.parse(dataString);
            }
        }
        // 2. Send it all to Firestore in ONE 'set' operation
        userDocRef.set(localData).then(() => {
            // We don't need showSyncStatus("All changes saved") here
            // The onSnapshot listener (Step 1) will handle this automatically!
            console.log("Debounced save successful.");
        }).catch((error) => {
            showSyncStatus("Sync Error");
            console.error("Firestore save error:", error);
        });
    }, 2000); // 2-second debounce is plenty. 5 is too long.


/**
     * Helper function to migrate data from LocalStorage to Firestore
     * for a first-time cloud user.
     */
    const migrateLocalDataToCloud = async (userDocRef) => {
        const migrationData = {};
        
        // Loop through all defined keys and grab data from LocalStorage
        for (const key in LOCAL_STORAGE_KEYS) {
            const storageKey = LOCAL_STORAGE_KEYS[key];
            const item = localStorage.getItem(storageKey);
            if (item) {
                try {
                    migrationData[key] = JSON.parse(item);
                } catch (e) {
                    console.warn(`Failed to parse ${key} during migration.`);
                }
            }
        }

        // Write the gathered data to the new user's Firestore document
        try {
            await userDocRef.set(migrationData);
            console.log("Local data successfully migrated to cloud.");
            showSyncStatus("Data Migrated");
        } catch (error) {
            console.error("Error migrating data to cloud:", error);
            showSyncStatus("Migration Failed");
        }
    };

    // --- Firestore Data Sync ---
    /**


        

* Loads user data from Firestore or migrates local data if new user.

* @param {firebase.User} user The authenticated user object.

*/
    const loadUserData = async (user) => {
        updateAuthUI();
        const userDocRef = db.collection("users").doc(user.uid);
        // 1. Check if the document exists
        const userDoc = await userDocRef.get();
        if (!userDoc.exists) {
            // 2. NEW USER: This part is fine. Migrate local data to the cloud ONCE.
            console.log("New user detected. Migrating local data to cloud...");
            await migrateLocalDataToCloud(userDocRef); // Your existing function is good for this
        }


        if (unsubscribeFirestore) {
            unsubscribeFirestore();
        }
        // 3. (THE BIG CHANGE)
        // Attach a REAL-TIME LISTENER to the user's document.
        // This will replace your 'mergeCloudDataWithLocal' and the awful page reload.
        unsubscribeFirestore = userDocRef.onSnapshot(
            (doc) => {
                console.log("Received cloud data snapshot...");
                const cloudData = doc.data();
                if (cloudData) {
                    let isStateUpdated = false;
                    // 4. Merge cloud data into your local appState
                    // (This is the "merge" without the page reload)
                    for (const key in LOCAL_STORAGE_KEYS) {
                        if (cloudData[key]) {
                            // Check if data is actually different to avoid needless re-renders
                            const localString = JSON.stringify(appState[key]);
                            const cloudString = JSON.stringify(cloudData[key]);
                            if (localString !== cloudString) {
                                appState[key] = cloudData[key];
                                // Also update the localStorage cache for the next offline load
                                localStorage.setItem(LOCAL_STORAGE_KEYS[key], cloudString);
                                isStateUpdated = true;
                            }
                        }
                    }
                    // 5. If anything changed, just re-render the dashboard. NO RELOAD.
                    if (isStateUpdated) {
                        console.log("Cloud data merged. Re-rendering dashboard...");
                        applySettings(); // Apply new settings
                        renderDashboard(); // Re-render cards
                    }
                }
                // 6. (BONUS) Use this to show a 100% accurate sync status!
                // This replaces your manual showSyncStatus("All changes saved")
                const status = doc.metadata.hasPendingWrites ? "Syncing..." : "All changes saved";
                showSyncStatus(status);
            },
            (error) => {
                console.error("Firestore snapshot error: ", error);
                showSyncStatus("Sync Error");
            });
    };
    /**

    * Displays a sync status message (e.g., "Saving...", "All changes saved").

    * @param {string} message The message to display.

    */
    const showSyncStatus = (message) => {
        const toast = domElements.syncStatusToast;
        toast.textContent = message;
        toast.classList.add("show");
        if (message !== "Saving..." && message !== "Syncing...") {
            clearTimeout(syncTimeout);
            syncTimeout = setTimeout(() => {
                toast.classList.remove("show");
            }, 2000);
        }
    };
    /**

    * Triggers a debounced Firestore sync for a given state key.

    * @param {string} key The key of the appState to sync.

    */
    const triggerSync = (key) => {
        if (currentUser) {
            showSyncStatus("Saving...");
            debouncedSaveAllToFirestore();
        }
    };
    // --- Modals & Utility Functions ---
    // --- Modals & Utility Functions (Updated) ---
    let confirmCallback = null;
    let cancelCallback = null; // New: Stores the 'Cancel' action

    /**
     * Displays a confirmation modal with customizable buttons and callbacks.
     */
    function showConfirmModal(message, onConfirm, title = "Are you sure?", onCancel = null, okText = "Confirm", cancelText = "Cancel") {
        domElements.confirmTitle.textContent = title;
        domElements.confirmMessage.textContent = message;
        
        // Update Button Text
        domElements.buttons.confirmOk.textContent = okText;
        domElements.buttons.confirmCancel.textContent = cancelText;

        confirmCallback = onConfirm;
        cancelCallback = onCancel;
        domElements.modals.confirm.classList.remove("hidden");
    }

    // --- Updated Confirm Modal Listeners ---
    // (Replace your old confirmCancel and confirmOk listeners with these)
    
    domElements.buttons.confirmCancel.addEventListener("click", () => {
        if (typeof cancelCallback === "function") {
            cancelCallback(); // Execute specific cancel logic (e.g., "Don't show again")
        }
        domElements.modals.confirm.classList.add("hidden");
        confirmCallback = null;
        cancelCallback = null;
    });

    domElements.buttons.confirmOk.addEventListener("click", () => {
        if (typeof confirmCallback === "function") {
            confirmCallback(); // Execute confirm logic
        }
        domElements.modals.confirm.classList.add("hidden");
        confirmCallback = null;
        cancelCallback = null;
    });
    /**

    * Displays a confirmation modal.

    * @param {string} message The confirmation message.

    * @param {Function} callback The function to execute if the user clicks "OK".

    * @param {string} [title="Are you sure?"] The title for the modal.

    */
    function showConfirmModal(message, callback, title = "Are you sure?") {
        domElements.confirmTitle.textContent = title;
        domElements.confirmMessage.textContent = message;
        confirmCallback = callback;
        domElements.modals.confirm.classList.remove("hidden");
    }
    /**

    * Formats a Date object to an ISO string (YYYY-MM-DD).

    * @param {Date} date The date to format.

    * @returns {string} The formatted date string.

    */
    const formatDateToISO = (date) => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const day = date.getDate().toString().padStart(2, "0");
        return `${year}-${month}-${day}`;
    };


    /**
 * Removes duplicate IDs from layout and ensures data integrity.
 */
function sanitizeDashboardState() {
    // 1. Remove duplicate IDs from the layout array
    if (appState.layout) {
        appState.layout = [...new Set(appState.layout)];
    }

    // 2. Remove duplicate cards (by ID) from customCards
    if (appState.customCards) {
        const uniqueCards = [];
        const seenIds = new Set();
        
        appState.customCards.forEach(card => {
            if (!seenIds.has(card.id)) {
                seenIds.add(card.id);
                uniqueCards.push(card);
            }
        });
        appState.customCards = uniqueCards;
    }

    // 3. Ensure layout only contains IDs that actually exist (or are built-in)
    const validCardIds = new Set(appState.customCards.map(c => c.id));
    const builtInCards = ["countdown", "time", "graph", "tests", "quote"]; 
    
    appState.layout = appState.layout.filter(id => 
        validCardIds.has(id) || builtInCards.includes(id)
    );
    
    // Save the cleaned state back to storage
    appState.save("layout");
    appState.save("customCards");
}

    /**

    * Gets the target exam date based on user settings.

    * @returns {Date} The target exam date.

    */
    /**

     * Gets the target exam date based on user settings.

     * Priority: User's Shift Date > Default Session Date > Default NEET Date

     */
    const getTargetExamDate = () => {
        const { examType, examYear, jeeSession, jeeShiftDate, customExamDate } = appState.settings;
        // 1. If JEE and user entered a specific shift date, use it

        if (examType === "Custom") {
            if (customExamDate) return new Date(customExamDate + "T00:00:00");
            return new Date(); // Fallback to today if no date set
        }

        if (examType === "JEE" && jeeShiftDate) {
            return new Date(jeeShiftDate + "T00:00:00"); // Assume 9 AM start
        }
        // 2. If JEE, use the default date for the selected Session & Year
        if (examType === "JEE") {
            const dateStr = EXAM_DEFAULTS.JEE[jeeSession]?.[examYear] || `${examYear}-01-01`;
            return new Date(dateStr + "T00:00:00");
        }
        // 3. Fallback for NEET
        const neetDateStr = EXAM_DEFAULTS.NEET[examYear] || `${examYear}-05-01`;
        return new Date(neetDateStr + "T00:00:00"); // NEET usually starts at 2 PM
    };
    /**

    * Formats total seconds into a HH:MM:SS string.

    * @param {number} totalSeconds The number of seconds.

    * @returns {string} The formatted time string.

    */
    const formatTimeHHMMSS = (totalSeconds) => {
        const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
        const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
        const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
        return `${hours}:${minutes}:${seconds}`;
    };
    /**

    * Formats total seconds into a readable string (e.g., "1h 30m", "45m", "30s").

    * @param {number} totalSeconds The number of seconds.

    * @returns {string} The readable time string.

    */
    const formatTimeReadable = (totalSeconds) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        let resultString = "";
        if (hours > 0) {
            resultString += `${hours}h `;
        }
        if (minutes > 0 || hours > 0) {
            resultString += `${minutes}m`;
        }
        if (resultString === "") {
            resultString = (totalSeconds % 60) + "s";
        }
        return resultString.trim();
    };
    // --- Picture-in-Picture (PiP) Functions ---
    /**

    * Closes the PiP window if the main document becomes visible.

    */
    function handleVisibilityChangePiP() {
        if (document.visibilityState === "visible" && pipWindow) {
            pipWindow.close();
        }
    }
    /**

    * Updates the timer display inside the PiP window.

    */
    function updatePiPTimerDisplay() {
        if (!pipWindow || !pipCardId) return;
        const mainTimerDisplay = document.querySelector(`[data-card-id="${pipCardId}"] .timer-display`);
        const pipTimerDisplay = pipWindow.document.getElementById("pip-timer");
        if (mainTimerDisplay && pipTimerDisplay) {
            pipTimerDisplay.textContent = mainTimerDisplay.textContent;
        }
    }
    /**

    * Updates the PiP window's control buttons (Start/Pause, Log) state.

    */
    function updatePiPControls() {
        if (!pipWindow || !pipCardId) return;
        const loggerState = appState.timeLoggerState[pipCardId];
        if (!loggerState) return;
        const pipStartPauseBtn = pipWindow.document.getElementById("pip-start-pause-btn");
        const pipLogBtn = pipWindow.document.getElementById("pip-log-btn");
        if (pipStartPauseBtn) {
            pipStartPauseBtn.textContent = loggerState.isRunning ? "Pause" : "Start";
        }
        if (pipLogBtn) {
            pipLogBtn.disabled = loggerState.accumulatedTime < 60; // Disable log if less than 1 min
        }
    }
    // --- Card Rendering ---
    /**

    * An object mapping card types to their rendering logic.

    * Each renderer defines a templateId and a render function.

    */
    const cardRenderers = {
        countdown: {
            templateId: "countdown-template",
            isDefault: true,
            render: (cardElement) => {
                const diff = getTargetExamDate() - new Date();
                cardElement.querySelector('[data-value="days"]').innerText = Math.floor(diff / (1000 * 60 * 60 * 24)).toString().padStart(2, "0");
                cardElement.querySelector('[data-value="hours"]').innerText = Math.floor((diff / (1000 * 60 * 60)) % 24).toString().padStart(2, "0");
                cardElement.querySelector('[data-value="minutes"]').innerText = Math.floor((diff / (1000 * 60)) % 60).toString().padStart(2, "0");
                cardElement.querySelector('[data-value="seconds"]').innerText = Math.floor((diff / 1000) % 60)
                    .toString()
                    .padStart(2, "0");
            },
        },
        time: {
            templateId: "time-template",
            isDefault: true,
            render: (cardElement) => {
                const now = new Date();
                cardElement.querySelector('[data-value="time"]').textContent = now.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: true,
                });
                cardElement.querySelector('[data-value="date"]').textContent = now.toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                });
            },
        },
        graph: {
            templateId: "graph-template",
            isDefault: true,
            render: (cardElement) => {
                const graphContainer = cardElement.querySelector("#contribution-graph");
                graphContainer.innerHTML = ""; // Clear previous render
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const currentYear = new Date().getFullYear();
                let currentDate = new Date(`${currentYear}-01-01T00:00:00`);
                const examDate = getTargetExamDate();
                examDate.setHours(0, 0, 0, 0);
                // Loop from Jan 1st to the exam date
                while (currentDate <= examDate) {
                    const dayCell = document.createElement("div");
                    const tooltip = document.createElement("span");
                    const dateString = formatDateToISO(currentDate);
                    dayCell.className = "day";
                    dayCell.dataset.date = dateString;
                    tooltip.className = "tooltip";
                    let dayClass = "day-future";
                    // --- CHANGED TOOLTIP LOGIC STARTS HERE ---
                    // 1. Basic Date Header
                    let tooltipHTML = `<strong class="text-accent">${currentDate.toDateString()}</strong>`;
                    if (currentDate < today) dayClass = "day-past";
                    if (currentDate.getTime() === today.getTime()) {
                        dayClass = "day-today";
                        tooltipHTML += "<br/><span class='text-xs text-gray-400'>(Today)</span>";
                    }
                    // 2. Handle Tests (Multiple supported via '|' split)
                    if (appState.tests[dateString]) {
                        dayClass = "day-part-test";
                        const rawTests = appState.tests[dateString];
                        // Split by '|' and create a bullet list
                        const testList = rawTests.split('|').map(t => `• ${t.trim()}`).join('<br/>');
                        const daysFromNow = Math.ceil((new Date(dateString) - today) / (1000 * 60 * 60 * 24));
                        const daysLabel = daysFromNow > 0 ? `${daysFromNow} days left` : (daysFromNow < 0 ? "Completed" : "Today");
                        tooltipHTML += `<div class="mt-1 pt-1 border-t border-gray-700">${testList}</div>`;
                        tooltipHTML += `<div class="text-[10px] text-gray-500 mt-1 italic">${daysLabel}</div>`;
                    }
                    if (currentDate.getTime() === examDate.getTime()) {
                        dayClass = "day-exam";
                        tooltipHTML += "<br/>🚨 <strong>EXAM DAY</strong> 🚨";
                    }
                    dayCell.classList.add(dayClass);
                    tooltip.innerHTML = tooltipHTML; // Use innerHTML for formatting
                    // --- CHANGED TOOLTIP LOGIC ENDS HERE ---
                    dayCell.appendChild(tooltip);
                    graphContainer.appendChild(dayCell);
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            },
        },
        tests: {
            templateId: "tests-template",
            isDefault: true,
            render: (cardElement) => {
                const listElement = cardElement.querySelector("#test-list");
                listElement.innerHTML = "";
                const sortedDates = Object.keys(appState.tests).sort();
                if (sortedDates.length !== 0) {
                    sortedDates.forEach((date) => {
                        const listItem = document.createElement("li");
                        listItem.className = "flex justify-between items-center bg-gray-800 p-2 rounded-md";
                        listItem.innerHTML = `<div class="flex flex-col"><span class="font-semibold text-sm">${appState.tests[date]}</span><span class="text-xs text-secondary">${new Date(date + "T00:00:00").toDateString()}</span></div><button data-date="${date}" class="delete-test-btn text-red-500 hover:text-red-400 font-semibold text-xs">Delete</button>`;
                        listElement.appendChild(listItem);
                    });
                } else {
                    listElement.innerHTML = '<li class="text-secondary px-2 text-sm">No tests scheduled.</li>';
                }
            },
        },
        quote: {
            templateId: "quote-template",
            isDefault: true,
            render: (cardElement) => {
                let quotesArray = generalQuotes;
                if (appState.settings.theme === "alakh-pandey") quotesArray = alakhPandeyQuotes;
                if (appState.settings.theme === "chaitanya-noob") quotesArray = chaitanyaQuotes;
                const {
                    text,
                    author
                } = quotesArray[Math.floor(Math.random() * quotesArray.length)];
                cardElement.querySelector("#quote").textContent = `"${text}"`;
                cardElement.querySelector("#author").textContent = `- ${author}`;
            },
        },
        note: {
            templateId: "note-card-template",
            render: (cardElement, cardData) => {
                cardElement.querySelector(".card-content").textContent = cardData.content;
            },
        },
        todo: {
            templateId: "todo-card-template",
            render: (cardElement, cardData) => {
                const listElement = cardElement.querySelector(".todo-list");
                const progressBar = cardElement.querySelector(".progress-bar");
                listElement.innerHTML = "";
                if (Array.isArray(cardData.content)) {
                    const totalTasks = cardData.content.length;
                    const completedTasks = cardData.content.filter((task) => task.completed).length;
                    const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
                    progressBar.style.width = `${progressPercent}%`;
                    if (totalTasks === 0) {
                        listElement.innerHTML = '<li class="text-secondary px-2 text-sm">No tasks yet. Add one below!</li>';
                    } else {
                        cardData.content.forEach((task, index) => {
                            const listItem = document.createElement("li");
                            listItem.className = "flex items-center gap-3 p-2 rounded-md hover:bg-white/5 transition-colors todo-item " + (task.completed ? "completed" : "");
                            listItem.dataset.index = index;
                            listItem.innerHTML = `<input type="checkbox" ${task.completed ? "checked" : ""} class="todo-checkbox"><span class="flex-grow text-sm">${task.text}</span><button class="delete-todo-item" aria-label="Delete task">×</button>`;
                            listElement.appendChild(listItem);
                        });
                    }
                }
            },
        },
        "line-graph": {
            templateId: "line-graph-card-template",
            render: (cardElement, cardData) => {
                const marksListEl = cardElement.querySelector(".marks-list");
                marksListEl.innerHTML = "";
                
                // 1. Calculate Statistics & Render List
                let totalScoreSum = 0;
                let count = 0;
                
                cardData.content.forEach((entry, index) => {
                    const currentTotal = entry.total ?? entry.marks;
                    totalScoreSum += currentTotal;
                    count++;

                    // --- NEW LOGIC: EXTRACT SUBJECT MARKS ---
                    const s = entry.subjects || {};
                    const phy = s.physics || 0;
                    const chem = s.chemistry || 0;
                    const math = s.maths || 0;
                    // ----------------------------------------

                    const listItem = document.createElement("li");
                    // Added 'items-start' to align content to top
                    listItem.className = "flex justify-between items-start text-xs bg-gray-800/50 hover:bg-gray-800 p-1.5 rounded transition-colors mb-1"; 
                    
                    // Modified InnerHTML to include subject row
                    listItem.innerHTML = `
                        <div class="flex-grow flex flex-col">
                            <div class="flex items-center">
                                <span class="font-bold text-white mr-2">${entry.name}</span>
                                <span class="${currentTotal >= (cardData.targetScore || 0) ? 'text-green-400' : 'text-yellow-400'} font-bold">${currentTotal}</span>
                                <span class="text-[10px]">/${entry.maxMarks}</span>
                            </div>
                            
                            <div class="flex gap-2 text-[10px] font-mono mt-0.5 opacity-80">
                                <span class="text-blue-400" title="Physics">P: ${phy}</span>
                                <span class="text-green-400" title="Chemistry">C: ${chem}</span>
                                <span class="text-orange-400" title="Maths">M: ${math}</span>
                            </div>
                        </div>

                        <button data-index="${index}" class="delete-mark-item text-gray-500 hover:text-red-500 px-1 pt-1 transition-colors" aria-label="Delete">×</button>`;
                    
                    marksListEl.appendChild(listItem);
                });

                // 2. Display Mean Score
                const meanScore = count > 0 ? (totalScoreSum / count).toFixed(1) : 0;
                cardElement.querySelector(".mean-score-display").textContent = meanScore;

                // 3. Handle Target Score Input
                const targetInput = cardElement.querySelector(".target-score-input");
                targetInput.value = cardData.targetScore || "";
                
                // Remove old listener and add new one
                const newTargetInput = targetInput.cloneNode(true);
                targetInput.parentNode.replaceChild(newTargetInput, targetInput);
                
                newTargetInput.addEventListener("change", (e) => {
                    const val = parseFloat(e.target.value);
                    cardData.targetScore = isNaN(val) ? 0 : val;
                    appState.save("customCards");
                    cardRenderers["line-graph"].render(cardElement, cardData);
                });

                // 4. Chart Setup (Standard Chart.js logic)
                const ctx = cardElement.querySelector(".marks-chart").getContext("2d");
                
                // Destroy old chart instance if exists
                if (appState.chartInstances[cardData.id]) {
                    appState.chartInstances[cardData.id].destroy();
                }

                // Get styles for chart colors
                const styles = getComputedStyle(document.documentElement);
                const accentColor = styles.getPropertyValue("--accent-color").trim();
                const textColorSecondary = styles.getPropertyValue("--text-secondary").trim();
                const borderColor = styles.getPropertyValue("--border-color").trim();

                const subjectColors = {
                    total: accentColor,
                    physics: "#3b82f6",
                    chemistry: "#10b981",
                    maths: "#f97316",
                };

                // Create Datasets
                const datasets = ["total", "physics", "chemistry", "maths"].map((subject) => ({
                    label: subject.charAt(0).toUpperCase() + subject.slice(1),
                    data: cardData.content.map((entry) => subject === "total" ? (entry.total ?? entry.marks) : (entry.subjects ? entry.subjects[subject] : 0)),
                    borderColor: subjectColors[subject],
                    backgroundColor: `${subjectColors[subject]}20`,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3,
                    borderWidth: 2,
                    hidden: subject !== "total",
                }));

                // Add Target Line
                if (cardData.targetScore && cardData.targetScore > 0) {
                    datasets.push({
                        label: "Target",
                        data: new Array(cardData.content.length).fill(cardData.targetScore),
                        borderColor: "#ef4444",
                        borderDash: [6, 6],
                        pointRadius: 0,
                        borderWidth: 1,
                        fill: false,
                        order: 0
                    });
                }

                // Determine Max Y Axis
                const maxY = cardData.content.length > 0 ? Math.max(...cardData.content.map((entry) => entry.maxMarks || 300)) : 300;

                const chartInstance = new Chart(ctx, {
                    type: "line",
                    data: {
                        labels: cardData.content.map((entry) => entry.name),
                        datasets: datasets,
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            mode: 'index',
                            intersect: false,
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                                titleFont: { size: 11 },
                                bodyFont: { size: 11 },
                                padding: 8,
                                displayColors: true
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: maxY,
                                ticks: { color: textColorSecondary, font: { size: 10 } },
                                grid: { color: borderColor },
                            },
                            x: {
                                ticks: { color: textColorSecondary, font: { size: 10 } },
                                grid: { display: false },
                            },
                        },
                    },
                });

                appState.chartInstances[cardData.id] = chartInstance;

                // 5. Handle Toggles (Same as before)
                const togglesContainer = cardElement.querySelector(".chart-toggles");
                const newTogglesContainer = togglesContainer.cloneNode(true);
                togglesContainer.parentNode.replaceChild(newTogglesContainer, togglesContainer);

                newTogglesContainer.addEventListener("click", (event) => {
                    if (event.target.tagName === "BUTTON") {
                        const subject = event.target.dataset.subject;
                        const datasetIndex = chartInstance.data.datasets.findIndex((d) => d.label.toLowerCase() === subject);
                        
                        if (datasetIndex > -1) {
                            const meta = chartInstance.getDatasetMeta(datasetIndex);
                            meta.hidden = meta.hidden === null ? !chartInstance.data.datasets[datasetIndex].hidden : null;
                            chartInstance.update();

                            // Update buttons visually
                            newTogglesContainer.querySelectorAll("button").forEach((btn) => {
                                const btnSubject = btn.dataset.subject;
                                const dsIndex = chartInstance.data.datasets.findIndex((d) => d.label.toLowerCase() === btnSubject);
                                const isHidden = chartInstance.getDatasetMeta(dsIndex).hidden;
                                
                                if (isHidden || (isHidden === null && chartInstance.data.datasets[dsIndex].hidden)) {
                                    btn.style.backgroundColor = "transparent";
                                    btn.style.borderColor = "#4b5563";
                                    btn.style.color = "var(--text-secondary)";
                                } else {
                                    btn.style.backgroundColor = subjectColors[btnSubject] || accentColor;
                                    btn.style.borderColor = subjectColors[btnSubject] || accentColor;
                                    btn.style.color = "white";
                                }
                            });
                        }
                    }
                });

                // Init buttons state
                newTogglesContainer.querySelectorAll("button").forEach((btn) => {
                    const btnSubject = btn.dataset.subject;
                    if (btnSubject !== 'total') {
                        btn.style.backgroundColor = "transparent";
                        btn.style.borderColor = "#4b5563";
                        btn.style.color = "var(--text-secondary)";
                    }
                });
            },
        },
        pomodoro: {
            templateId: "pomodoro-card-template",
            render: (cardElement, cardData) => {
                const state = appState.pomodoroState[cardData.id] || {
                    mode: "pomodoro",
                    time: 25 * 60, // 25 minutes
                    isRunning: false,
                    intervalId: null,
                    durations: {
                        pomodoro: 25,
                        shortBreak: 5,
                        longBreak: 15
                    },
                };
                appState.pomodoroState[cardData.id] = state;
                const minutes = Math.floor(state.time / 60).toString().padStart(2, "0");
                const seconds = (state.time % 60).toString().padStart(2, "0");
                cardElement.querySelector(".timer-display").textContent = `${minutes}:${seconds}`;
                cardElement.querySelectorAll(".pomodoro-btn").forEach((btn) => {
                    btn.classList.toggle("active", btn.dataset.mode === state.mode);
                });
                cardElement.querySelector(".start-pause-btn").textContent = state.isRunning ? "PAUSE" : "START";
                // Set duration input values
                cardElement.querySelector('[data-mode="pomodoro"].pomodoro-duration-input').value = state.durations.pomodoro;
                cardElement.querySelector('[data-mode="shortBreak"].pomodoro-duration-input').value = state.durations.shortBreak;
                cardElement.querySelector('[data-mode="longBreak"].pomodoro-duration-input').value = state.durations.longBreak;
            },
        },
        youtube: {
            templateId: "youtube-card-template",
            render: (cardElement, cardData) => {
                const iframe = cardElement.querySelector(".youtube-iframe");
                const url = cardData.content;
                let videoId = "";
                if (url) {
                    try {
                        const parsedUrl = new URL(url);
                        if (parsedUrl.hostname.includes("youtu.be")) {
                            videoId = parsedUrl.pathname.slice(1);
                        } else {
                            videoId = parsedUrl.searchParams.get("v");
                        }
                    } catch (e) {
                        console.error("Invalid YouTube URL");
                    }
                }
                iframe.src = videoId ? `https://www.youtube.com/embed/${videoId}` : "";
                // Apply tint/blur settings
                const container = cardElement.querySelector(".youtube-container");
                container.classList.toggle("tint-disabled", !appState.settings.youtubeTintEnabled);
                container.classList.toggle("blurred", appState.settings.youtubeBlurEnabled);
            },
        },
        analytics: {
            templateId: "analytics-card-template",
            render: (cardElement, cardData) => {
                // 1. Helper: Get Data
                const getChartData = (days) => {
                    const labels = [];
                    const dataPoints = [];
                    let totalSecondsRange = 0;
                    for (let i = days - 1; i >= 0; i--) {
                        const d = new Date();
                        d.setDate(d.getDate() - i);
                        const year = d.getFullYear();
                        const month = (d.getMonth() + 1).toString().padStart(2, "0");
                        const day = d.getDate().toString().padStart(2, "0");
                        const isoDate = `${year}-${month}-${day}`;
                        const label = days === 7 ? d.toLocaleDateString('en-US', {
                            weekday: 'short'
                        }) : d.toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'short'
                        });
                        labels.push(label);
                        let dailySeconds = 0;
                        if (appState.studyLogs[isoDate]) {
                            Object.values(appState.studyLogs[isoDate]).forEach(sec => dailySeconds += sec);
                        }
                        dataPoints.push(dailySeconds / 3600);
                        totalSecondsRange += dailySeconds;
                    }
                    return {
                        labels,
                        dataPoints,
                        totalSecondsRange
                    };
                };
                // 2. Setup
                const ctx = cardElement.querySelector(".analytics-chart").getContext("2d");
                const rangeBtns = cardElement.querySelectorAll(".range-btn");
                // Styles
                const styles = getComputedStyle(document.documentElement);
                const accentColor = styles.getPropertyValue("--accent-color").trim() || '#3b82f6';
                const textColor = styles.getPropertyValue("--text-secondary").trim() || '#8b949e';
                const gridColor = styles.getPropertyValue("--border-color").trim() || '#30363d';
                // 3. Render Function
                const renderChart = (range) => {
                    const {
                        labels,
                        dataPoints,
                        totalSecondsRange
                    } = getChartData(range);
                    // Summary Text
                    const totalH = Math.floor(totalSecondsRange / 3600);
                    const totalM = Math.floor((totalSecondsRange % 3600) / 60);
                    const displayTotal = totalH > 0 ? `${totalH}h ${totalM}m` : `${totalM}m`;
                    const avgHours = (totalSecondsRange / 3600 / range).toFixed(2);
                    const summaryEl = cardElement.querySelector(".statistics-summary");
                    if (summaryEl) {
                        summaryEl.innerHTML = `

                                    <span class="mr-4">Total: <strong style="color:${accentColor}">${displayTotal}</strong></span>

                                    <span>Average: <strong>${avgHours}h/day</strong></span>

                                `;
                    }
                    // Chart
                    if (appState.chartInstances[cardData.id]) {
                        appState.chartInstances[cardData.id].destroy();
                    }
                    appState.chartInstances[cardData.id] = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: labels,
                            datasets: [{
                                label: 'Hours',
                                data: dataPoints,
                                backgroundColor: accentColor,
                                hoverBackgroundColor: accentColor,
                                borderRadius: 4,
                                barPercentage: 0.6
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            animation: {
                                duration: 0
                            },
                            plugins: {
                                legend: {
                                    display: false
                                },
                                tooltip: {
                                    callbacks: {
                                        label: (context) => {
                                            const val = context.raw;
                                            if (val > 0 && val < 1) return ` ${Math.round(val * 60)} mins`;
                                            return ` ${val.toFixed(2)} hrs`;
                                        }
                                    }
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    grid: {
                                        color: gridColor,
                                        drawBorder: false
                                    },
                                    border: {
                                        display: false
                                    },
                                    ticks: {
                                        color: textColor,
                                        callback: (val) => (val % 1 === 0 ? val : val.toFixed(1)) + 'h'
                                    }
                                },
                                x: {
                                    grid: {
                                        display: false,
                                        drawBorder: false
                                    },
                                    ticks: {
                                        color: textColor
                                    }
                                }
                            }
                        }
                    });
                    // Update Button Styles - THIS NOW WORKS CORRECTLY
                    rangeBtns.forEach(btn => {
                        if (parseInt(btn.dataset.range) === range) {
                            btn.style.backgroundColor = accentColor;
                            btn.style.borderColor = accentColor;
                            btn.style.color = "#fff";
                        } else {
                            btn.style.backgroundColor = "transparent";
                            btn.style.borderColor = gridColor;
                            btn.style.color = textColor;
                        }
                    });
                };
                // 4. Initialize
                renderChart(7);
                // 5. Simplified Event Listeners (Fixed)
                rangeBtns.forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const range = parseInt(e.target.dataset.range);
                        renderChart(range);
                    });
                });
            }
        },
        "time-logger": {
            templateId: "time-logger-card-template",
            render: (cardElement, cardData) => {
                const state = appState.timeLoggerState[cardData.id] || {
                    isRunning: false,
                    accumulatedTime: 0,
                    currentSubject: "Physics",
                    intervalId: null,
                };
                appState.timeLoggerState[cardData.id] = state;
                cardElement.querySelector(".timer-display").textContent = formatTimeHHMMSS(state.accumulatedTime);
                cardElement.querySelector(".start-pause-btn").textContent = state.isRunning ? "PAUSE" : "START";
                // Update subject dropdown
                const labelFor = `subject-select-${cardData.id}`;
                const selectEl = cardElement.querySelector(".subject-select");
                const labelEl = selectEl.previousElementSibling; // Find the label relative to the select box
                // Check if we found the label and it is a LABEL tag
                if (labelEl && labelEl.tagName === 'LABEL') {
                    labelEl.setAttribute("for", labelFor);
                }
                selectEl.id = labelFor;
                const allSubjects = [...new Set(["Physics", "Chemistry", "Maths", "Biology", "Zoology", "Botany", ...(appState.settings.userSubjects || []),]),];
                selectEl.innerHTML = allSubjects.map((subject) => `<option>${subject}</option>`).join("") + '<option value="add_new">Add New Subject...</option>';
                selectEl.value = state.currentSubject;
                const manualSelect = cardElement.querySelector(".manual-subject-select");
                if (manualSelect) {
                    manualSelect.innerHTML = allSubjects.map((subject) => `<option>${subject}</option>`).join("");
                    // Set default to current timer subject just for convenience
                    manualSelect.value = state.currentSubject;
                }
                // Render today's study log
                const logListEl = cardElement.querySelector(".study-log-list");
                const totalTimeEl = cardElement.querySelector(".total-study-time");
                logListEl.innerHTML = "";
                const todayStr = formatDateToISO(new Date());
                const todayLogs = appState.studyLogs[todayStr] || {};
                const totalToday = Object.values(todayLogs).reduce((sum, time) => sum + time, 0);
                if (totalTimeEl) {
                    totalTimeEl.textContent = `Total: ${formatTimeReadable(totalToday)}`;
                }
                if (Object.keys(todayLogs).length === 0) {
                    logListEl.innerHTML = '<li class="text-secondary px-2 text-sm">No sessions logged today.</li>';
                } else {
                    Object.entries(todayLogs).forEach(([subject, time]) => {
                        const listItem = document.createElement("li");
                        listItem.className = "flex justify-between items-center";
                        listItem.innerHTML = `<span>${subject}</span><div class="flex items-center gap-2"><span class="font-semibold">${formatTimeReadable(time)}</span><button data-subject="${subject}" class="delete-log-item text-red-500 hover:text-red-400 font-semibold px-2 py-1 text-xs leading-none rounded-sm" aria-label="Delete ${subject} log">×</button></div>`;
                        logListEl.appendChild(listItem);
                    });
                }
            },
        },
    };
    /**

    * Re-renders the entire dashboard grid based on the current `appState`.

    */
    function renderDashboard() {

        // Destroy all existing chart instances to prevent memory leaks
        Object.values(appState.chartInstances).forEach((chart) => chart.destroy());
        appState.chartInstances = {};
        domElements.dashboardGrid.innerHTML = ""; // Clear the grid
        // Filter layout to remove IDs of deleted custom cards
        let layoutChanged = false;
        const customCardIds = appState.customCards.map((card) => card.id);
        if (!Array.isArray(appState.layout)) {
            // Fallback for corrupted layout
            appState.layout = ["countdown", "graph", "default-todo", "default-study-logger", "default-note", "default-line-graph", "tests", "quote", "time",];
            layoutChanged = true;
        }
        // 1. Filter layout to remove IDs of deleted custom cards
        const originalLength = appState.layout.length;
        appState.layout = appState.layout.filter(
            (cardId) => cardRenderers[cardId]?.isDefault || customCardIds.includes(cardId));
        if (appState.layout.length !== originalLength) {
            layoutChanged = true;
        }
        // // 2. Add any new custom cards to the layout if they're not already there
        // appState.customCards.forEach((card) => {
        //     if (!appState.layout.includes(card.id)) {
        //         appState.layout.push(card.id);
        //         layoutChanged = true;
        //     }
        // });
        // // 3. Only save if the layout actually changed
        // if (layoutChanged) {
        //     appState.save("layout");
        // }
        // Add any new custom cards to the layout if they're not already there
        appState.customCards.forEach((card) => {
            if (!appState.layout.includes(card.id)) {
                appState.layout.push(card.id);
            }
        });
        sanitizeDashboardState();
        appState.save("layout");
        // Create and append card elements
        appState.layout.forEach((cardId) => {
            const cardData = appState.customCards.find((card) => card.id === cardId);
            const cardType = cardData ? cardData.type : cardId;
            const renderer = cardRenderers[cardType];
            if (renderer) {
                const templateClone = document.getElementById(renderer.templateId).content.cloneNode(true);
                const cardElement = templateClone.querySelector(".card");
                cardElement.dataset.cardId = cardId;
                // Apply card properties (e.g., colspan)
                const cardProps = appState.cardProps[cardId] || {
                    colspan: cardType === "graph" || cardType === "line-graph" || cardType === "youtube" || cardType === "time-logger" ? 2 : 1,
                };
                appState.cardProps[cardId] = cardProps;
                if (cardProps.colspan === 2) {
                    cardElement.classList.add("md:col-span-2");
                }
                // Set title for custom cards
                if (cardData) {
                    cardElement.querySelector(".card-title").textContent = cardData.title;
                } else if (appState.settings.theme === 'chaitanya-noob') {
                    // Easter egg
                    const titleEl = cardElement.querySelector('h2');
                    if (titleEl) titleEl.textContent += " 🤓";
                }
                domElements.dashboardGrid.appendChild(templateClone);
            }
        });
        // Call the render function for each card
        domElements.dashboardGrid.querySelectorAll(".card").forEach((cardElement, index) => {
            const cardId = cardElement.dataset.cardId;
            const cardData = appState.customCards.find((card) => card.id === cardId);
            const cardType = cardData ? cardData.type : cardId;
            const renderer = cardRenderers[cardType];
            if (renderer && renderer.render) {
                renderer.render(cardElement, cardData);
            }
        });
    }

    
    // --- Settings Application ---
    /**

    * Updates styles for all YouTube cards based on settings.

    */
    function updateYouTubeCardStyles() {
        const tintEnabled = appState.settings.youtubeTintEnabled;
        const blurEnabled = appState.settings.youtubeBlurEnabled;
        if (domElements.inputs.youtubeTintToggle) {
            domElements.inputs.youtubeTintToggle.checked = tintEnabled;
        }
        if (domElements.inputs.youtubeBlurToggle) {
            domElements.inputs.youtubeBlurToggle.checked = blurEnabled;
        }
        document.querySelectorAll('[data-card-type="youtube"] .youtube-container').forEach((container) => {
            container.classList.toggle("tint-disabled", !tintEnabled);
            container.classList.toggle("blurred", blurEnabled);
        });
    }
    /**

    * Applies all settings from `appState.settings` to the DOM.

    */
    function applySettings() {
        // Apply theme
        document.documentElement.dataset.theme = appState.settings.theme;
        // Apply sub-theme for riced-linux variants
        const subTheme = ["cyberpunk", "god-mode"].includes(appState.settings.theme) ? appState.settings.theme : "";
        document.documentElement.dataset.subTheme = subTheme;
        // Apply riced mode
        document.documentElement.dataset.ricedMode = appState.settings.ricedModeEnabled ? "true" : "false";
        // Apply font
        domElements.body.style.fontFamily = appState.settings.font;
        // Apply background
        if (appState.settings.theme === "alakh-pandey") {
            domElements.body.style.backgroundImage = "url(https://i.imgflip.com/8otyfs.jpg)";
        } else if (appState.settings.theme === "chaitanya-noob") {
            domElements.body.style.backgroundImage = "url(https://i.ibb.co/pv4BYhMs/Whats-App-Image-2025-08-06-at-16-12-41-4f47e159.jpg)";
        } else if (appState.settings.theme === "god-mode") {
            domElements.body.style.backgroundImage = "url('https://i.pinimg.com/originals/c5/9a/d2/c59ad2bd4ad2fbacd04017debc679ddb.gif')";
        } else {
            domElements.body.style.backgroundImage = appState.settings.bgUrl ? `url(${appState.settings.bgUrl})` : "none";
        }
        const currentSession = appState.settings.jeeSession || "January";
        const currentYear = appState.settings.examYear || "2026";

        if (domElements.inputs.jeeSession && domElements.inputs.jeeSession.options.length === 0) {
            ["January", "April"].forEach(session => {
                const opt = document.createElement("option");
                opt.value = session;
                opt.textContent = session;
                domElements.inputs.jeeSession.appendChild(opt);
            });
        }

        domElements.inputs.jeeSession.value = currentSession;
        // Check if user has a custom date, otherwise grab the default from your EXAM_DEFAULTS object
        const defaultDateStr = EXAM_DEFAULTS.JEE[currentSession]?.[currentYear] || "";
        // Set the input value to the custom date OR the default date
        domElements.inputs.customName.value = appState.settings.customExamName || "";
        domElements.inputs.customDate.value = appState.settings.customExamDate || "";
        domElements.inputs.jeeShift.value = appState.settings.jeeShiftDate || defaultDateStr;
        // Toggle visibility of JEE options
        if (appState.settings.examType === "JEE") {
            domElements.inputs.jeeContainer.classList.remove("hidden");
            domElements.inputs.customContainer.classList.add("hidden");
        } else if (appState.settings.examType === "Custom") {
            domElements.inputs.jeeContainer.classList.add("hidden");
            domElements.inputs.customContainer.classList.remove("hidden");
        } else {
            domElements.inputs.jeeContainer.classList.add("hidden");
            domElements.inputs.customContainer.classList.add("hidden");
        }
        // Update main title
        const { examType, examYear, customExamName } = appState.settings;

        let titleText;
        if (examType === "Custom") {
            titleText = customExamName ? customExamName : "My Exam";
        } else {
            titleText = `${examType} ${examYear}`;
        }

        domElements.mainTitle.textContent = titleText;
        domElements.mainTitleRiced.textContent = titleText;
        // Update customize modal inputs
        domElements.inputs.tickingSoundToggle.checked = appState.settings.tickingSoundEnabled;
        domElements.inputs.theme.value = appState.settings.theme;
        domElements.inputs.font.value = appState.settings.font;
        domElements.inputs.bgUrl.value = appState.settings.bgUrl;
        domElements.inputs.examType.value = appState.settings.examType;
        domElements.inputs.examYear.value = appState.settings.examYear;
        domElements.inputs.focusShieldToggle.checked = appState.settings.focusShieldEnabled;
        domElements.inputs.ricedModeToggle.checked = appState.settings.ricedModeEnabled;
        updateYouTubeCardStyles();
    }
    // --- Dashboard Grid Event Listeners (Delegation) ---
    // Click handler
    domElements.dashboardGrid.addEventListener("click", (event) => {
        const cardElement = event.target.closest(".card");
        if (!cardElement) return;
        const cardId = cardElement.dataset.cardId;
        // --- Card-Specific Actions ---
        // Refresh quote
        if (cardId === "quote" && cardRenderers.quote.render) {
            cardRenderers.quote.render(cardElement);
        }
        // Delete test
        if (event.target.closest(".delete-test-btn")) {
            const date = event.target.closest(".delete-test-btn").dataset.date;
            delete appState.tests[date];
            appState.save("tests");
            renderDashboard(); // Re-render to update graph and test list
        }
        // Add/Remove test from graph
        if (event.target.classList.contains("day")) {
            const dateString = event.target.dataset.date;
            if (appState.tests[dateString]) {
                // Delete existing test
                delete appState.tests[dateString];
                appState.save("tests");
                renderDashboard();
            } else {
                // Focus add test form
                const addTestForm = domElements.dashboardGrid.querySelector("#add-test-form");
                if (addTestForm) {
                    addTestForm.date.value = dateString;
                    addTestForm.name.focus();
                }
            }
        }
        const cardData = appState.customCards.find((card) => card.id === cardId);
        // Toggle colspan
        if (event.target.closest(".toggle-colspan-btn")) {
            const cardProps = appState.cardProps[cardId] || {
                colspan: 1
            };
            cardProps.colspan = cardProps.colspan === 2 ? 1 : 2;
            appState.cardProps[cardId] = cardProps;
            appState.save("cardProps");
            renderDashboard();
        }
        // Delete custom card
        if (event.target.closest(".delete-card-btn") && cardData) {
            appState.customCards = appState.customCards.filter((card) => card.id !== cardId);
            delete appState.cardProps[cardId];
            delete appState.pomodoroState[cardId];
            delete appState.timeLoggerState[cardId];
            appState.save("customCards");
            appState.save("cardProps");
            appState.save("pomodoroState");
            appState.save("timeLoggerState");
            renderDashboard();
        }
        // Delete study log item
        if (event.target.classList.contains("delete-log-item")) {
            const cardElement = event.target.closest(".card");
            const cardId = cardElement.dataset.cardId;
            const subject = event.target.dataset.subject;
            const todayStr = formatDateToISO(new Date());
            if (appState.studyLogs[todayStr] && appState.studyLogs[todayStr][subject] !== undefined) {
                delete appState.studyLogs[todayStr][subject];
                // Clean up empty date objects
                if (Object.keys(appState.studyLogs[todayStr]).length === 0) {
                    delete appState.studyLogs[todayStr];
                }
                appState.save("studyLogs");
                // Re-render this card
                const cardData = appState.customCards.find((c) => c.id === cardId);
                cardRenderers["time-logger"].render(cardElement, cardData);
            }
        }
        // Open PiP window
        if (event.target.closest(".pip-btn")) {
            const cardData = appState.customCards.find((c) => c.id === cardId);
            if (cardData && cardData.type === 'time-logger') {
                openPiP(cardId, cardData.type);
            }
        }
        // To-Do card actions
        if (cardData && cardData.type === "todo") {
            const todoItem = event.target.closest(".todo-item");
            if (todoItem) {
                const index = parseInt(todoItem.dataset.index);
                if (event.target.closest(".delete-todo-item")) {
                    cardData.content.splice(index, 1);
                } else if (event.target.classList.contains("todo-checkbox")) {
                    cardData.content[index].completed = !cardData.content[index].completed;
                }
                appState.save("customCards");
                cardRenderers.todo.render(cardElement, cardData); // Re-render this card
            }
        }
        // Line-Graph card actions
        if (cardData && cardData.type === "line-graph" && event.target.closest(".delete-mark-item")) {
            const index = parseInt(event.target.closest(".delete-mark-item").dataset.index);
            cardData.content.splice(index, 1);
            appState.save("customCards");
            cardRenderers["line-graph"].render(cardElement, cardData); // Re-render this card
        }
        if (event.target.closest(".toggle-manual-form")) {
            const form = event.target.closest(".card").querySelector(".manual-log-form");
            form.classList.toggle("hidden");
            const btnSpan = event.target.closest(".toggle-manual-form").querySelector("span");
            // Update button text based on visibility
            if (form.classList.contains("hidden")) {
                btnSpan.textContent = "+ Add Manual Entry";
            } else {
                btnSpan.textContent = "- Close";
            }
        }
        // Pomodoro card actions
        if (cardData && cardData.type === "pomodoro") {
            if (event.target.classList.contains("pomodoro-btn")) {
                pomodoroTimer.setMode(cardId, event.target.dataset.mode);
            } else if (event.target.classList.contains("start-pause-btn")) {
                pomodoroTimer.toggle(cardId);
            } else if (event.target.classList.contains("reset-btn")) {
                pomodoroTimer.reset(cardId);
            }
        }
        // Time-Logger card actions
        if (cardData && cardData.type === "time-logger") {
            if (event.target.classList.contains("start-pause-btn")) {
                window.timeLogger.toggle(cardId);
            } else if (event.target.classList.contains("log-btn")) {
                window.timeLogger.log(cardId);
            } else if (event.target.classList.contains("reset-btn")) {
                window.timeLogger.reset(cardId);
            }
        }
    });
    // Change handler
    domElements.dashboardGrid.addEventListener("change", (event) => {
        // Pomodoro duration change
        if (event.target.classList.contains("pomodoro-duration-input")) {
            const cardId = event.target.closest(".card").dataset.cardId;
            const mode = event.target.dataset.mode;
            let duration = parseInt(event.target.value);
            if (duration < 1) {
                duration = 1;
                event.target.value = 1;
            }
            if (cardId && mode && !isNaN(duration)) {
                pomodoroTimer.setDuration(cardId, mode, duration);
            }
        }
        // Time-Logger subject change
        if (event.target.classList.contains("subject-select")) {
            const cardId = event.target.closest(".card").dataset.cardId;
            window.timeLogger.changeSubject(cardId, event.target.value);
        }
    });
    // Submit handler
    domElements.dashboardGrid.addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.target;
        const cardElement = form.closest(".card");
        const cardId = cardElement.dataset.cardId;
        // Add Test form
        if (form.id === "add-test-form") {
            const {
                date: dateInput,
                name: nameInput
            } = form.elements;
            if (dateInput.value && nameInput.value.trim()) {
                const dateKey = dateInput.value;
                const newTestName = nameInput.value.trim();
                // CHECK: Does a test already exist for this date?
                if (appState.tests[dateKey]) {
                    // Append the new test with a special separator ( | )
                    appState.tests[dateKey] = appState.tests[dateKey] + " | " + newTestName;
                } else {
                    // Create new entry
                    appState.tests[dateKey] = newTestName;
                }
                appState.save("tests");
                renderDashboard();
                form.reset();
            }
        }
        // Add To-Do form
        else if (form.classList.contains("add-todo-form")) {
            const cardData = appState.customCards.find((card) => card.id === cardId);
            const inputEl = form.querySelector("input");
            const taskText = inputEl.value.trim();
            // Easter egg check
            if (taskText.toLowerCase() === "coco") {
                if (!godModeBackup) { // Store backup only once
                    godModeBackup = {
                        theme: appState.settings.theme,
                        customCards: JSON.parse(JSON.stringify(appState.customCards)),
                        tests: JSON.parse(JSON.stringify(appState.tests)),
                        layout: [...appState.layout]
                    };
                }
                domElements.godModePanel.classList.remove("hidden");
                new Tone.Synth().toDestination().triggerAttackRelease("C4", "0.5");
                inputEl.value = "";
                return;
            }
            if (taskText.toLowerCase() === "doingocmakesmeexcited") {
                appState.settings.theme = "chaitanya-noob";
                appState.saveSettings();
                applySettings();
                renderDashboard();
                inputEl.value = "";
                return;
            }
            if (cardData && taskText) {
                if (!Array.isArray(cardData.content)) cardData.content = [];
                cardData.content.push({
                    text: taskText,
                    completed: false
                });
                appState.save("customCards");
                cardRenderers.todo.render(cardElement, cardData);
                inputEl.value = "";
            }
        } else if (form.classList.contains("manual-log-form")) {
            const subject = form.querySelector(".manual-subject-select").value;
            const minutesInput = form.querySelector('input[name="minutes"]');
            const minutes = parseInt(minutesInput.value);
            if (subject && minutes > 0) {
                const todayStr = formatDateToISO(new Date());
                // Initialize today's log if not exists
                if (!appState.studyLogs[todayStr]) {
                    appState.studyLogs[todayStr] = {};
                }
                // Calculate seconds
                const secondsToAdd = minutes * 60;
                // Add to logs
                appState.studyLogs[todayStr][subject] = (appState.studyLogs[todayStr][subject] || 0) + secondsToAdd;
                // Save and Render
                appState.save("studyLogs");
                renderDashboard();
                // Clear input but keep form open for rapid entry
                minutesInput.value = "";
                // Optional: Show a quick toast or console log
                console.log(`Added ${minutes} mins to ${subject}`);
            }
        }
        // Add Marks form
        else if (form.classList.contains("add-marks-form")) {
            const cardData = appState.customCards.find((card) => card.id === cardId);
            const {
                name: nameInput,
                phy: phyInput,
                chem: chemInput,
                math: mathInput,
                maxMarks: maxMarksInput
            } = form.elements;
            if (cardData && nameInput.value.trim() && phyInput.value && chemInput.value && mathInput.value && maxMarksInput.value) {
                if (!Array.isArray(cardData.content)) cardData.content = [];
                const phyMarks = parseFloat(phyInput.value);
                const chemMarks = parseFloat(chemInput.value);
                const mathMarks = parseFloat(mathInput.value);
                const totalMarks = phyMarks + chemMarks + mathMarks;
                cardData.content.push({
                    name: nameInput.value.trim(),
                    maxMarks: parseFloat(maxMarksInput.value),
                    total: totalMarks,
                    subjects: {
                        physics: phyMarks,
                        chemistry: chemMarks,
                        maths: mathMarks
                    },
                });
                appState.save("customCards");
                cardRenderers["line-graph"].render(cardElement, cardData);
                form.reset();
            }
        }
        // Update YouTube URL form
        else if (form.classList.contains("update-youtube-form")) {
            const cardData = appState.customCards.find((card) => card.id === cardId);
            const inputEl = form.querySelector("input");
            if (cardData && inputEl.value.trim()) {
                cardData.content = inputEl.value.trim();
                appState.save("customCards");
                cardRenderers.youtube.render(cardElement, cardData);
            }
        }
    });
    // --- PiP Window Opener ---
    /**

    * Opens the Document Picture-in-Picture window.

    * @param {string} cardId The ID of the card to show in PiP.

    * @param {string} cardType The type of the card.

    */
    async function openPiP(cardId, cardType) {
        if ("documentPictureInPicture" in window) {
            // Close any existing PiP window
            if (pipWindow) {
                pipWindow.close();
            }
            try {
                const options = {
                    width: 320,
                    height: 155
                };
                const newPipWindow = await documentPictureInPicture.requestWindow(options);
                pipWindow = newPipWindow;
                pipCardId = cardId;
                pipCardType = cardType;
                // 1. Copy all stylesheets
                [...document.styleSheets].forEach((styleSheet) => {
                    if (styleSheet.href) {
                        // It's a linked stylesheet (e.g., Google Fonts, Tailwind CDN)
                        const link = document.createElement("link");
                        link.rel = "stylesheet";
                        link.href = styleSheet.href;
                        pipWindow.document.head.appendChild(link);
                    } else if (styleSheet.ownerNode) {
                        // It's an inline <style> tag, clone it
                        const style = styleSheet.ownerNode.cloneNode(true);
                        pipWindow.document.head.appendChild(style);
                    }
                });
                // 2. Add PiP-specific styles
                const pipStyle = document.createElement("style");
                pipStyle.textContent = `

                            body {

                                background-color: #000000;

                                color: var(--text-primary);

                                font-family: var(--font-family);

                                display: flex;

                                flex-direction: column;

                                align-items: center;

                                justify-content: center;

                                text-align: center;

                                padding: 1rem;

                                margin: 0;

                                box-sizing: border-box;

                                overflow: hidden;

                            }

                            h2 {

                                font-size: 0.9rem;

                                margin: 0 0 0.5rem 0;

                                color: var(--text-secondary);

                                font-weight: 600;

                            }

                            #pip-timer {

                                

                                font-size: clamp(1.5rem, 25vh, 7.5rem);

                                font-weight: 700;

                                line-height: 1; /* Helps with vertical alignment */

                                letter-spacing: 0.05em;

                                font-family: 'Fira Code', monospace;

                            }

                            #pip-controls {

                                display: flex;

                                gap: 0.75rem;

                                margin-top: 1rem;

                            }

                            #pip-controls button {

                                padding: 0.5rem 1.25rem;

                                font-size: 0.9rem;

                                font-weight: 600;

                                border: none;

                                border-radius: 8px;

                                cursor: pointer;

                                transition: transform 0.1s ease, filter 0.1s ease;

                            }

                            #pip-controls button:hover {

                                transform: translateY(-2px);

                                filter: brightness(1.1);

                            }

                            #pip-start-pause-btn {

                                background-color: var(--accent-color);

                                color: white; /* Default to white for most themes */

                            }

                            #pip-log-btn {

                                background-color: #16a34a; /* A nice, consistent green */

                                color: white;

                            }

                            #pip-log-btn:disabled {

                                background-color: #4b5563; /* Gray out when disabled */

                                cursor: not-allowed;

                                transform: none;

                                filter: none;

                            }

                            #pip-reset-btn {

                                background-color: transparent;

                                color: var(--text-secondary);

                            }

                            /* Fix for themes where button text should be dark */

                            [data-theme="light"] #pip-start-pause-btn,

                            [data-theme="alakh-pandey"] #pip-start-pause-btn {

                                color: var(--bg-color);

                            }

                        `;
                pipWindow.document.head.appendChild(pipStyle);
                // 3. Set theme
                const currentTheme = document.documentElement.dataset.theme;
                if (currentTheme && currentTheme !== "default") {
                    pipWindow.document.documentElement.dataset.theme = currentTheme;
                }
                // 4. Create PiP body content
                const titleEl = document.createElement("h2");
                titleEl.textContent = document.querySelector(`[data-card-id="${cardId}"] .card-title`).textContent;
                const timerEl = document.createElement("div");
                timerEl.id = "pip-timer";
                const controlsEl = document.createElement("div");
                controlsEl.id = "pip-controls";
                const startPauseBtn = document.createElement("button");
                startPauseBtn.id = "pip-start-pause-btn";
                startPauseBtn.addEventListener("click", () => window.timeLogger.toggle(pipCardId));
                const logBtn = document.createElement("button");
                logBtn.id = "pip-log-btn";
                logBtn.textContent = "Log";
                logBtn.addEventListener("click", () => window.timeLogger.log(pipCardId));
                const resetBtn = document.createElement("button");
                resetBtn.id = "pip-reset-btn";
                resetBtn.textContent = "Reset";
                resetBtn.addEventListener("click", () => window.timeLogger.reset(pipCardId));
                controlsEl.append(startPauseBtn, logBtn, resetBtn);
                pipWindow.document.body.append(titleEl, timerEl, controlsEl);
                // 5. Add event listeners
                document.addEventListener("visibilitychange", handleVisibilityChangePiP);
                pipWindow.addEventListener("pagehide", () => {
                    pipWindow = null;
                    pipCardId = null;
                    pipCardType = null;
                    document.removeEventListener("visibilitychange", handleVisibilityChangePiP);
                });
                // 6. Initial update
                updatePiPTimerDisplay();
                updatePiPControls();
            } catch (error) {
                console.error("PiP Error:", error);
                pipWindow = null;
            }
        } else {
            alert("Your browser does not support the Document Picture-in-Picture API required for this feature. Please try a recent version of Chrome or Edge on a desktop computer.");
        }
    }
    // --- Add Card Modal ---
    domElements.buttons.addCard.forEach(btn => btn.addEventListener("click", () => domElements.modals.addCard.classList.remove("hidden")));
    domElements.buttons.cancelAddCard.addEventListener("click", () => domElements.modals.addCard.classList.add("hidden"));
    domElements.inputs.cardType.addEventListener("change", (event) => {
        const isNote = event.target.value === "note";
        const isYouTube = event.target.value === "youtube";
        domElements.inputs.cardContent.style.display = isNote || isYouTube ? "block" : "none";
        domElements.inputs.cardContent.placeholder = isYouTube ? "Paste YouTube video URL..." : "Card Content (for notes)";
    });
    domElements.forms.newCard.addEventListener("submit", (event) => {
        event.preventDefault();
        const cardType = domElements.inputs.cardType.value;
        const cardTitle = domElements.forms.newCard.querySelector('input[type="text"]').value.trim();
        if (!cardTitle) return;
        const newCard = {
            id: `custom-${Date.now()}`,
            type: cardType,
            title: cardTitle,
            content: cardType === "note" || cardType === "youtube" ? domElements.inputs.cardContent.value.trim() : [],
        };
        appState.customCards.push(newCard);
        const newCardProps = {
            // Add 'analytics' to this check
            colspan: cardType === "line-graph" || cardType === "youtube" || cardType === "time-logger" || cardType === "analytics" ? 2 : 1,
        };
        if (cardType === "line-graph") {
            newCardProps.maxMarks = 300; // Default max marks
        }
        appState.cardProps[newCard.id] = newCardProps;
        appState.save("customCards");
        appState.save("cardProps");
        renderDashboard();
        domElements.modals.addCard.classList.add("hidden");
        domElements.forms.newCard.reset();
        domElements.inputs.cardContent.style.display = "block"; // Reset to default
    });
    // --- Customize Modal ---
    const closeCustomizeModal = () => domElements.modals.customize.classList.add("hidden");
    domElements.buttons.customize.forEach(btn => btn.addEventListener("click", () => domElements.modals.customize.classList.remove("hidden")));
    domElements.buttons.closeCustomize.addEventListener("click", closeCustomizeModal);
    domElements.buttons.closeCustomizeIcon.addEventListener("click", closeCustomizeModal);
    domElements.modals.customize.addEventListener("click", (event) => {
        if (event.target === domElements.modals.customize) {
            closeCustomizeModal();
        }
    });
    // --- WALLPAPER PRESETS LOGIC ---
    const presetGrid = document.getElementById('preset-wallpaper-grid');
    const wallpapers = [{
        name: "Deep Space",
        type: "img",
        thumb: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=200&q=60",
        url: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1920&q=80"
    }, {
        name: "Midnight City",
        type: "img",
        thumb: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=200&q=60",
        url: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1920&q=80"
    }, {
        name: "Dark Library",
        type: "img",
        thumb: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=200&q=60",
        url: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1920&q=80"
    }, {
        name: "Zen Forest",
        type: "img",
        thumb: "https://images.pexels.com/photos/167699/pexels-photo-167699.jpeg?auto=compress&cs=tinysrgb&w=200",
        url: "https://images.pexels.com/photos/167699/pexels-photo-167699.jpeg?auto=compress&cs=tinysrgb&w=1920"
    }, {
        name: "Study Desk",
        type: "img",
        thumb: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=200&q=60",
        url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1920&q=80"
    }, {
        name: "Stormy Sea",
        type: "img",
        thumb: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=200&q=60",
        url: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=1920&q=80"
    }, {
        name: "Minimal Dark",
        type: "img",
        thumb: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=200&q=60",
        url: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=1920&q=80"
    }, {
        name: "Cozy Rain",
        type: "img",
        thumb: "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=200&q=60",
        url: "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=1920&q=80"
    }];
    if (presetGrid) {
        wallpapers.forEach(wp => {
            const btn = document.createElement('button');
            // Styling the button
            btn.className = "relative group w-full h-16 rounded-md overflow-hidden border border-gray-700 hover:border-white transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500";
            btn.type = "button"; // Prevent form submission
            // Button Inner HTML
            btn.innerHTML = `

                <img src="${wp.thumb}" alt="${wp.name}" class="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity">

                <span class="absolute bottom-0 left-0 right-0 bg-black/60 text-[9px] text-white text-center py-0.5 truncate">${wp.name}</span>

                ${wp.type === 'gif' ? '<span class="absolute top-1 right-1 bg-indigo-600/80 text-[8px] text-white px-1 rounded">GIF</span>' : ''}

            `;
            // Click Handler
            btn.addEventListener('click', () => {
                // 1. Update the input field visually
                domElements.inputs.bgUrl.value = wp.url;
                // 2. Update the App State
                appState.settings.bgUrl = wp.url;
                // 3. Save and Apply (Reuse your existing function!)
                saveAndApplySettings();
            });
            presetGrid.appendChild(btn);
        });
    }
    // --- Settings Event Listeners ---
    const saveAndApplySettings = () => {
        appState.saveSettings();
        applySettings();
        renderDashboard(); // Re-render for exam date changes, etc.
    };
    domElements.inputs.examType.addEventListener("change", () => {
        appState.settings.examType = domElements.inputs.examType.value;
        saveAndApplySettings();
    });
    domElements.inputs.examYear.addEventListener("change", () => {
        appState.settings.examYear = domElements.inputs.examYear.value;
        // --- FIX: Clear the specific date so the new year's default takes over ---
        appState.settings.jeeShiftDate = "";
        domElements.inputs.jeeShift.value = "";
        // ------------------------------------------------------------------------
        saveAndApplySettings();
    });
    domElements.inputs.theme.addEventListener("change", () => {
        appState.settings.theme = domElements.inputs.theme.value;
        appState.saveSettings();
        applySettings();
        renderDashboard(); // Re-render for quotes
    });
    domElements.inputs.font.addEventListener("change", () => {
        appState.settings.font = domElements.inputs.font.value;
        appState.saveSettings();
        applySettings();
    });
    domElements.inputs.bgUrl.addEventListener("input", () => {
        appState.settings.bgUrl = domElements.inputs.bgUrl.value;
        appState.saveSettings();
        applySettings();
    });
    domElements.buttons.removeBg.addEventListener("click", () => {
        appState.settings.bgUrl = "";
        appState.saveSettings();
        applySettings();
    });
    domElements.inputs.youtubeTintToggle.addEventListener("change", () => {
        appState.settings.youtubeTintEnabled = domElements.inputs.youtubeTintToggle.checked;
        appState.saveSettings();
        updateYouTubeCardStyles();
    });
    domElements.inputs.youtubeBlurToggle.addEventListener("change", () => {
        appState.settings.youtubeBlurEnabled = domElements.inputs.youtubeBlurToggle.checked;
        appState.saveSettings();
        updateYouTubeCardStyles();
    });
    // --- Focus Shield ---
    domElements.inputs.focusShieldToggle.addEventListener("change", () => {
        const isEnabled = domElements.inputs.focusShieldToggle.checked;
        appState.settings.focusShieldEnabled = isEnabled;
        appState.saveSettings();
        // If shield is disabled while a timer is active, stop the timer
        if (!isEnabled && appState.activeTimer.cardId) {
            const {
                cardId,
                type
            } = appState.activeTimer;
            if (type === "pomodoro") pomodoroTimer.stop(cardId);
            if (type === "time-logger") window.timeLogger.pause(cardId);
        }
    });

    domElements.inputs.tickingSoundToggle.addEventListener("change", () => {
        appState.settings.tickingSoundEnabled = domElements.inputs.tickingSoundToggle.checked;
        appState.saveSettings();
    });

    // --- Riced Mode ---
    domElements.inputs.ricedModeToggle.addEventListener("change", () => {
        appState.settings.ricedModeEnabled = domElements.inputs.ricedModeToggle.checked;
        appState.saveSettings();
        applySettings();
    });
    // --- Data Management (Reset, Export, Import) ---
    domElements.buttons.resetDashboard.addEventListener("click", () => {
        showConfirmModal("This will delete all custom cards and reset the layout to the default.", async () => { // <--- Made function async
            // 1. Clear Local Storage
            Object.keys(LOCAL_STORAGE_KEYS).forEach((key) => {
                // We keep settings (theme, etc.) but nuke data
                if (key !== "settings" && key !== "mobileAlertDismissed") {
                    localStorage.removeItem(LOCAL_STORAGE_KEYS[key]);
                }
            });
            // 2. Clear Cloud Data (If logged in)
            if (currentUser) {
                showSyncStatus("Resetting Cloud Data...");
                try {
                    // Delete the user's document from Firestore
                    await db.collection("users").doc(currentUser.uid).delete();
                    console.log("Cloud data deleted.");
                } catch (error) {
                    console.error("Error resetting cloud data:", error);
                    alert("Failed to reset cloud data. Check console.");
                    return; // Stop reload if cloud delete fails
                }
            }
            // 3. Reload to re-initialize defaults
            // When page loads, it sees no LocalStorage and no Cloud Data, 
            // so it starts fresh with the default hardcoded state.
            location.reload();
        }, "Reset Dashboard?");
    });
    domElements.buttons.exportData.addEventListener("click", () => {
        const backupData = {};
        for (const key in LOCAL_STORAGE_KEYS) {
            const dataString = localStorage.getItem(LOCAL_STORAGE_KEYS[key]);
            if (dataString !== null) {
                backupData[key] = JSON.parse(dataString);
            }
        }
        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], {
            type: "application/json"
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const dateStr = new Date().toISOString().slice(0, 10);
        a.download = `studylocus-backup-${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
    domElements.buttons.importData.addEventListener("click", () => {
        domElements.inputs.importFile.click();
    });
    domElements.inputs.importFile.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);

                // Validation
                if (!importedData.layout || !importedData.customCards) {
                    alert("Invalid backup file.");
                    return;
                }

                showConfirmModal("This will overwrite your dashboard.", () => {
                    // 1. Update State & LocalStorage
                    for (const key in LOCAL_STORAGE_KEYS) {
                        if (importedData[key]) {
                            appState[key] = importedData[key];
                            localStorage.setItem(LOCAL_STORAGE_KEYS[key], JSON.stringify(importedData[key]));
                        }
                    }

                    // 2. Sanitize
                    sanitizeDashboardState();

                    // 3. Force Cloud Save (User is logged in, so update cloud to match import)
                    if (currentUser) {
                        debouncedSaveAllToFirestore();
                    }

                    // 4. Update UI (NO RELOAD)
                    applySettings();
                    renderDashboard();
                    showSyncStatus("Import Successful");
                }, "Import Data?");
            } catch (error) {
                console.error(error);
                alert("Error reading file.");
            } finally {
                domElements.inputs.importFile.value = "";
            }
        };
        reader.readAsText(file);
    });
    // --- Mobile Alert ---
    // if (window.innerWidth < 768 && localStorage.getItem(LOCAL_STORAGE_KEYS.mobileAlertDismissed) !== "true") {
    //     domElements.mobileAlert.classList.remove("hidden");
    // }
    // domElements.buttons.closeAlert.addEventListener("click", () => {
    //     domElements.mobileAlert.classList.add("hidden");
    //     localStorage.setItem(LOCAL_STORAGE_KEYS.mobileAlertDismissed, "true");
    // });
    // --- Info Modal ---
    domElements.buttons.info.forEach(btn => btn.addEventListener("click", () => domElements.modals.info.classList.remove("hidden")));
    domElements.buttons.closeInfo.addEventListener("click", () => domElements.modals.info.classList.add("hidden"));
    // --- Zen Mode ---
    domElements.buttons.zenModeBtn.forEach(btn => btn.addEventListener("click", () => {
        domElements.body.classList.add("zen-mode");
        domElements.buttons.exitZenBtn.classList.remove("hidden");
    }));
    domElements.buttons.exitZenBtn.addEventListener("click", () => {
        domElements.body.classList.remove("zen-mode");
        domElements.buttons.exitZenBtn.classList.add("hidden");
    });
    // --- Confirm Modal Buttons ---
    domElements.buttons.confirmCancel.addEventListener("click", () => {
        domElements.modals.confirm.classList.add("hidden");
        confirmCallback = null;
    });
    domElements.buttons.confirmOk.addEventListener("click", () => {
        if (typeof confirmCallback === "function") {
            confirmCallback();
        }
        domElements.modals.confirm.classList.add("hidden");
        confirmCallback = null;
    });
    // --- Timer Modules ---
    /**

    * Pomodoro Timer logic.

    */
    const pomodoroTimer = {
        tick(cardId) {
            const state = appState.pomodoroState[cardId];
            if (state.time > 0) {
                state.time--;
                this.updateDisplay(cardId);
            } else {
                this.stop(cardId);
                new Tone.Synth().toDestination().triggerAttackRelease("C5", "0.5"); // Play sound
            }
        },
        updateDisplay(cardId) {
            const cardElement = domElements.dashboardGrid.querySelector(`[data-card-id="${cardId}"]`);
            if (cardElement) {
                cardRenderers.pomodoro.render(cardElement, {
                    id: cardId
                });
            }
            // Update page title
            const state = appState.pomodoroState[cardId];
            if (state.isRunning) {
                const minutes = Math.floor(state.time / 60).toString().padStart(2, "0");
                const seconds = (state.time % 60).toString().padStart(2, "0");
                document.title = `${minutes}:${seconds} - Time to focus!`;
            } else {
                const {
                    examType,
                    examYear
                } = appState.settings;
                document.title = `${examType} ${examYear} | StudyLocus`;
            }
        },
        start(cardId, isInternal = false) {
            const state = appState.pomodoroState[cardId];
            if (!state.isRunning) {
                state.isRunning = true;
                if (!isInternal) {
                    // This is a manual start, not a focus shield restart
                    if (appState.activeTimer.cardId !== cardId || appState.activeTimer.type !== "pomodoro") {
                        appState.activeTimer.unfocusedTime = 0;
                        const cardElement = domElements.dashboardGrid.querySelector(`[data-card-id="${cardId}"]`);
                        if (cardElement) {
                            const focusStatusEl = cardElement.querySelector(".focus-status");
                            if (focusStatusEl) focusStatusEl.textContent = "";
                        }
                    }
                    appState.activeTimer.cardId = cardId;
                    appState.activeTimer.type = "pomodoro";
                    if (appState.settings.focusShieldEnabled) enterFocusShield();
                }
                state.intervalId = setInterval(() => this.tick(cardId), 1000);
                this.updateDisplay(cardId);
                appState.save("pomodoroState");
            }
        },
        _internalPause(cardId) {
            const state = appState.pomodoroState[cardId];
            clearInterval(state.intervalId);
            state.isRunning = false;
            this.updateDisplay(cardId);
        },
        stop(cardId) {
            const state = appState.pomodoroState[cardId];
            clearInterval(state.intervalId);
            if (appState.activeTimer.cardId === cardId) {
                appState.activeTimer.cardId = null;
                appState.activeTimer.type = null;
                if (appState.settings.focusShieldEnabled) exitFocusShield();
            }
            state.isRunning = false;
            this.updateDisplay(cardId);
            appState.save("pomodoroState");
        },
        toggle(cardId) {
            if (appState.pomodoroState[cardId].isRunning) {
                this.stop(cardId);
            } else {
                this.start(cardId);
            }
        },
        reset(cardId) {
            const state = appState.pomodoroState[cardId];
            this.stop(cardId);
            state.time = state.durations[state.mode] * 60;
            this.updateDisplay(cardId);
            appState.save("pomodoroState");
        },
        setMode(cardId, mode) {
            appState.pomodoroState[cardId].mode = mode;
            this.reset(cardId);
        },
        setDuration(cardId, mode, duration) {
            const state = appState.pomodoroState[cardId];
            state.durations[mode] = duration;
            if (state.mode === mode) {
                this.reset(cardId);
            }
            appState.save("pomodoroState");
        },
    };
    /**

    * Time Logger (Stopwatch) logic.

    */
    window.timeLogger = {
        tick(cardId) {
            const state = appState.timeLoggerState[cardId];
            if (state && state.isRunning && state.startTime) {
                const elapsedMs = Date.now() - state.startTime;
                const newTotalSeconds = state.accumulatedTime + Math.round(elapsedMs / 1000);
                const cardElement = domElements.dashboardGrid.querySelector(`[data-card-id="${cardId}"]`);
                if (cardElement) {
                    cardElement.querySelector(".timer-display").textContent = formatTimeHHMMSS(newTotalSeconds);
                    updatePiPTimerDisplay(); // Update PiP window if open
                }
            }
        },
        start(cardId) {
            const state = appState.timeLoggerState[cardId];
            if (!state || state.isRunning) return;
            state.isRunning = true;
            state.startTime = Date.now();
            appState.activeTimer.cardId = cardId;
            appState.activeTimer.type = "time-logger";
            if (appState.settings.focusShieldEnabled) enterFocusShield();
            state.intervalId = setInterval(() => this.tick(cardId), 1000);
            const cardElement = domElements.dashboardGrid.querySelector(`[data-card-id="${cardId}"]`);
            if (cardElement) {
                cardElement.querySelector(".start-pause-btn").textContent = "PAUSE";
            }
            appState.save("timeLoggerState");
            updatePiPControls();
        },
        pause(cardId, shouldRender = true) {
            const state = appState.timeLoggerState[cardId];
            if (!state || !state.isRunning) return;
            clearInterval(state.intervalId);
            const elapsedMs = Date.now() - state.startTime;
            state.accumulatedTime += Math.round(elapsedMs / 1000);
            state.isRunning = false;
            state.startTime = null;
            state.intervalId = null;
            if (appState.activeTimer.cardId === cardId) {
                appState.activeTimer.cardId = null;
                appState.activeTimer.type = null;
                if (appState.settings.focusShieldEnabled) exitFocusShield();
            }
            appState.save("timeLoggerState");
            if (shouldRender) {
                const cardElement = domElements.dashboardGrid.querySelector(`[data-card-id="${cardId}"]`);
                if (cardElement) {
                    cardRenderers["time-logger"].render(cardElement, {
                        id: cardId
                    });
                }
            }
            updatePiPControls();
            updatePiPTimerDisplay();
        },
        toggle(cardId) {
            if (appState.timeLoggerState[cardId].isRunning) {
                this.pause(cardId);
            } else {
                this.start(cardId);
            }
        },
        log(cardId) {
            this.pause(cardId, false); // Pause without re-rendering
            const state = appState.timeLoggerState[cardId];
            if (state.accumulatedTime < 60) { // Minimum 1 minute log
                const cardElement = domElements.dashboardGrid.querySelector(`[data-card-id="${cardId}"]`);
                if (cardElement) {
                    const logMessageEl = cardElement.querySelector(".log-message");
                    if (logMessageEl) {
                        logMessageEl.textContent = "Minimum log time is 1 minute.";
                        setTimeout(() => {
                            if (logMessageEl) logMessageEl.textContent = "";
                        }, 3000);
                    }
                }
                this.start(cardId); // Restart timer
                return;
            }
            const todayStr = formatDateToISO(new Date());
            if (!appState.studyLogs[todayStr]) {
                appState.studyLogs[todayStr] = {};
            }
            const subject = state.currentSubject;
            appState.studyLogs[todayStr][subject] = (appState.studyLogs[todayStr][subject] || 0) + state.accumulatedTime;
            appState.save("studyLogs");
            // Reset timer
            state.accumulatedTime = 0;
            appState.save("timeLoggerState");
            renderDashboard(); // Re-render all to update graph and logger card
            updatePiPTimerDisplay();
            updatePiPControls();
        },
        reset(cardId) {
            this.pause(cardId, false);
            appState.timeLoggerState[cardId].accumulatedTime = 0;
            appState.save("timeLoggerState");
            renderDashboard();
            updatePiPTimerDisplay();
            updatePiPControls();
        },
        changeSubject(cardId, newSubject) {
            const state = appState.timeLoggerState[cardId];
            const cardElement = domElements.dashboardGrid.querySelector(`[data-card-id="${cardId}"]`);
            if (newSubject === "add_new") {
                const newSubjectName = prompt("Enter new subject name:");
                if (newSubjectName && newSubjectName.trim()) {
                    if (!appState.settings.userSubjects) appState.settings.userSubjects = [];
                    appState.settings.userSubjects.push(newSubjectName.trim());
                    appState.saveSettings();
                    state.currentSubject = newSubjectName.trim();
                    renderDashboard(); // Re-render to update all subject lists
                } else {
                    // Reset dropdown if cancelled
                    if (cardElement) {
                        cardElement.querySelector(".subject-select").value = state.currentSubject;
                    }
                }
            } else if (state) {
                state.currentSubject = newSubject;
                appState.save("timeLoggerState");
            }
        },
    };
    domElements.inputs.examType.addEventListener("change", () => {
        appState.settings.examType = domElements.inputs.examType.value;
        // Show/Hide container immediately
        if (appState.settings.examType === "JEE") {
            domElements.inputs.jeeContainer.classList.remove("hidden");
        } else {
            domElements.inputs.jeeContainer.classList.add("hidden");
        }
        saveAndApplySettings();
    });
    // Save Session (Jan/April)
    domElements.inputs.jeeSession.addEventListener("change", () => {
        appState.settings.jeeSession = domElements.inputs.jeeSession.value;
        appState.settings.jeeShiftDate = "";
        domElements.inputs.jeeShift.value = "";
        saveAndApplySettings();
        // Update Main Title dynamically
        const {
            examType,
            examYear,
            jeeSession
        } = appState.settings;
        const titleText = examType === "JEE" ? `JEE ${examYear}` : `${examType} ${examYear}`;
        domElements.mainTitle.textContent = titleText;
    });
    // Save Specific Shift Date
    domElements.inputs.jeeShift.addEventListener("change", () => {
        appState.settings.jeeShiftDate = domElements.inputs.jeeShift.value;
        saveAndApplySettings();
    });
    // --- God Mode (Easter Egg) ---
    let godModeBackup = null; // To store state before god mode
    domElements.body.addEventListener("click", (event) => {
        if (event.target.closest("#god-mode-panel")) {
            const targetId = event.target.id;
            if (targetId === "god-mode-close-btn") {
                domElements.godModePanel.classList.add("hidden");
                // Restore backup
                if (godModeBackup) {
                    appState.settings.theme = godModeBackup.theme;
                    appState.customCards = godModeBackup.customCards;
                    appState.tests = godModeBackup.tests;
                    appState.layout = godModeBackup.layout;
                    godModeBackup = null;
                    applySettings();
                    renderDashboard();
                }
            }
            if (targetId === "god-mode-theme-btn") {
                const themeSelect = domElements.inputs.theme;
                if (!themeSelect.querySelector('[value="god-mode"]')) {
                    const optionEl = document.createElement("option");
                    optionEl.value = "god-mode";
                    optionEl.textContent = "--- GOD MODE ---";
                    themeSelect.appendChild(optionEl);
                }
                appState.settings.theme = "god-mode";
                applySettings();
                renderDashboard();
            }
            if (targetId === "god-mode-complete-tasks-btn") {
                appState.customCards.forEach(card => {
                    if (card.type === 'todo' && Array.isArray(card.content)) {
                        card.content.forEach(task => task.completed = true);
                    }
                });
                renderDashboard();
            }
            if (targetId === "god-mode-perfect-score-btn") {
                const lineGraphCard = appState.customCards.find(c => c.type === 'line-graph');
                if (lineGraphCard && Array.isArray(lineGraphCard.content)) {
                    const maxMarks = appState.settings.examType === 'NEET' ? 720 : 300;
                    lineGraphCard.content.push({
                        name: "God Tier",
                        marks: maxMarks,
                        maxMarks: maxMarks
                    });
                    renderDashboard();
                }
            }
            if (targetId === "god-mode-timewarp-btn") {
                const newTests = {};
                Object.keys(appState.tests).forEach(dateStr => {
                    const oldDate = new Date(dateStr + "T00:00:00");
                    oldDate.setDate(oldDate.getDate() + 7); // Move 7 days
                    const newDateStr = formatDateToISO(oldDate);
                    newTests[newDateStr] = appState.tests[dateStr];
                });
                appState.tests = newTests;
                renderDashboard();
            }
            if (targetId === "god-mode-scramble-btn") {
                let layout = appState.layout;
                for (let i = layout.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [layout[i], layout[j]] = [layout[j], layout[i]];
                }
                renderDashboard();
            }
            if (targetId === "god-mode-nuke-btn") {
                domElements.dashboardGrid.querySelectorAll(".card").forEach((card, index) => {
                    card.style.animation = `fall-apart 1s ease-in-out ${index * 0.05}s forwards`;
                });
                setTimeout(() => {
                    showConfirmModal("Dashboard nuked. Restore?", () => {
                        domElements.dashboardGrid.innerHTML = "";
                        renderDashboard();
                    }, "KABOOM!");
                }, 1500);
            }
        }
    });
    // --- Focus Shield ---
    function enterFocusShield() {
        try {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen();
            }
        } catch (err) {
            console.warn("Fullscreen request failed.", err);
        }
        document.addEventListener("visibilitychange", handleFocusShieldVisibilityChange);
        document.addEventListener("fullscreenchange", handleFullscreenChange);
    }

    function exitFocusShield() {
        try {
            if (document.fullscreenElement && document.exitFullscreen) {
                document.exitFullscreen();
            }
        } catch (err) {
            console.warn("Exit fullscreen request failed.", err);
        }
        document.removeEventListener("visibilitychange", handleFocusShieldVisibilityChange);
        document.removeEventListener("fullscreenchange", handleFullscreenChange);
        // Clear any "unfocused" messages
        const {
            cardId,
            type
        } = appState.activeTimer;
        const cardElement = domElements.dashboardGrid.querySelector(`[data-card-id="${cardId}"]`);
        if (cardElement) {
            const focusStatusEl = cardElement.querySelector(".focus-status");
            if (focusStatusEl) focusStatusEl.textContent = "";
        }
    }

    function handleFullscreenChange() {
        // If user exits fullscreen manually, stop the active timer
        if (!document.fullscreenElement && appState.activeTimer.cardId) {
            const {
                cardId,
                type
            } = appState.activeTimer;
            if (type === "pomodoro") pomodoroTimer.stop(cardId);
            if (type === "time-logger") window.timeLogger.pause(cardId);
        }
    }

    function handleFocusShieldVisibilityChange() {
        const {
            cardId,
            type
        } = appState.activeTimer;
        if (!cardId || type !== 'time-logger') return; // Only apply logic to time-logger
        const timerModule = window.timeLogger;
        const state = appState.timeLoggerState[cardId];
        if (!state) return;
        if (document.visibilityState === "hidden") {
            if (state.isRunning) {
                timerModule.pause(cardId, false); // Internal pause
            }
        } else if (document.visibilityState === "visible") {
            if (state.isRunning) { // This means it was running *before* it was hidden
                // Manually add elapsed time since last *real* start
                const elapsedSeconds = (Date.now() - state.startTime) / 1000;
                state.accumulatedTime += Math.round(elapsedSeconds);
                timerModule.start(cardId); // Restart
            }
        }
    }


    // Custom Exam Name Change
    domElements.inputs.customName.addEventListener("input", () => {
        appState.settings.customExamName = domElements.inputs.customName.value;
        saveAndApplySettings();
    });

    // Custom Exam Date Change
    domElements.inputs.customDate.addEventListener("change", () => {
        appState.settings.customExamDate = domElements.inputs.customDate.value;
        saveAndApplySettings();
    });

    // Update the Exam Type Listener to handle the UI toggle immediately
    domElements.inputs.examType.addEventListener("change", () => {
        appState.settings.examType = domElements.inputs.examType.value;
        
        // Immediate UI Toggle
        domElements.inputs.jeeContainer.classList.toggle("hidden", appState.settings.examType !== "JEE");
        domElements.inputs.customContainer.classList.toggle("hidden", appState.settings.examType !== "Custom");
        
        saveAndApplySettings();
    });

    // --- App Initialization ---
    domElements.mainTitle.addEventListener("click", (event) => {
        if (event.detail === 3) {
            // Triple click
            clearTimeout(null);
            domElements.inputs.theme.querySelector('[value="alakh-pandey"]').classList.remove("hidden");
            appState.settings.theme = "alakh-pandey";
            appState.saveSettings();
            applySettings();
            renderDashboard();
        }
    });
    // --- FIX: Add a flag to resume audio context only once ---
    let audioContextResumed = false;
    // Global click listener to close user menu
    document.addEventListener("click", () => {
        // --- FIX FOR AUDIO CONTEXT ---
        // Resume the Tone.js AudioContext on the first user click
        if (!audioContextResumed && typeof Tone !== 'undefined' && Tone.context.state === "suspended") {
            Tone.start();
            audioContextResumed = true;
            console.log("AudioContext resumed by user gesture.");
        }
        // --- END FIX ---
        const userMenuDropdown = document.getElementById("user-menu-dropdown");
        if (userMenuDropdown && !userMenuDropdown.classList.contains("hidden")) {
            userMenuDropdown.classList.add("hidden");
        }
    });
    // Initial setup
    updateAuthUI();
    applySettings();
    renderDashboard();
    // Initialize Sortable (drag-and-drop)
    new Sortable(domElements.dashboardGrid, {
        animation: 150,
        handle: ".drag-handle",
        ghostClass: "sortable-ghost",
        chosenClass: "sortable-chosen",
        onEnd: () => {
            appState.layout = [...domElements.dashboardGrid.children].map((card) => card.dataset.cardId);
            appState.save("layout");
        },
    });
    // 1. Setup the High-End Mechanical Sounds
    const clockHigh = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.005, sustain: 0 }
    }).toDestination();

    const clockLow = new Tone.NoiseSynth({
        noise: { type: "pink" },
        envelope: { attack: 0.001, decay: 0.015, sustain: 0 }
    }).toDestination();

    // Filter to make it sound "inside a watch" rather than "static noise"
    const watchFilter = new Tone.Filter(4000, "highpass").toDestination();
    clockHigh.connect(watchFilter);
    clockLow.connect(watchFilter);

    let doomTickCounter = 0;
    let isTock = false; // Toggle for tick-tock logic

    setInterval(() => {
        // Standard countdown render
        const countdownCard = domElements.dashboardGrid.querySelector('[data-card-id="countdown"]');
        if (countdownCard && cardRenderers.countdown.render) {
            cardRenderers.countdown.render(countdownCard);
        }

        if (appState.settings.tickingSoundEnabled) {
            doomTickCounter++;
            
            // --- THE 60-SECOND CHECKPOINT ---
            if (doomTickCounter >= 60) { 
                if (isTock) {
                    clockLow.triggerAttackRelease("32n", undefined, 0.1); // Subtle Tock
                } else {
                    clockHigh.triggerAttackRelease("32n", undefined, 0.15); // Crisp Tick
                }
                
                // Visual "Pulse" on the Countdown Card
                if (countdownCard) {
                    countdownCard.style.transform = "scale(1.04)";
                    countdownCard.style.transition = "transform 0.1s ease-out";
                    setTimeout(() => {
                        countdownCard.style.transform = "scale(1)";
                    }, 100);
                }

                isTock = !isTock; // Switch for next minute
                doomTickCounter = 0; 
            }
        } else {
            doomTickCounter = 0; 
        }

        // Standard time render
        const timeCard = domElements.dashboardGrid.querySelector('[data-card-id="time"]');
        if (timeCard && cardRenderers.time.render) {
            cardRenderers.time.render(timeCard);
        }
    }, 1000);
    // Save final study log time on page unload
    window.addEventListener("beforeunload", () => {
        if (appState.activeTimer.cardId && appState.activeTimer.type === "time-logger") {
            console.log("Unload event: Forcing final save for active study logger.");
            window.timeLogger.pause(appState.activeTimer.cardId, false); // Pause without rendering
        }
    });
    // --- Info Modal Tab-switching ---
    const infoModal = document.getElementById("info-modal");
    const tabButtons = infoModal.querySelectorAll(".tab-btn");
    const tabContents = infoModal.querySelectorAll(".tab-content");
    infoModal.addEventListener("click", (event) => {
        const tabButton = event.target.closest(".tab-btn");
        if (!tabButton) return;
        const tabId = tabButton.dataset.tab;
        tabButtons.forEach(btn => {
            btn.classList.toggle("active", btn.dataset.tab === tabId);
        });
        tabContents.forEach(content => {
            content.classList.toggle("hidden", content.id !== `tab-${tabId}`);
        });
    });
    const focusOverlay = document.getElementById('super-focus-overlay');
    const viewTabs = document.querySelectorAll('.focus-tab-btn');
    const views = document.querySelectorAll('.focus-view');
    // Buttons
    const fullscreenToggleBtn = document.getElementById('toggle-focus-fullscreen');
    // Display Elements
    const clockDisplay = document.getElementById('focus-clock-display');
    const dateDisplay = document.getElementById('focus-date-display');
    const quoteDisplay = document.getElementById('focus-quote-display');
    // Timer Elements
    const bigTimerDisplay = document.getElementById('focus-big-timer');
    const bigTimerToggle = document.getElementById('focus-timer-toggle');
    const bigTimerReset = document.getElementById('focus-timer-reset');
    const dashTimerDisplay = document.getElementById('dashboard-timer-display');
    const dashTimerToggle = document.getElementById('dash-timer-toggle');
    const dashTimerReset = document.getElementById('dash-timer-reset');
    const timerModeBtns = document.querySelectorAll('.timer-mode-btn');
    // Tasks
    const dashTaskList = document.getElementById('focus-dashboard-tasks');
    const dashAddTaskInput = document.getElementById('focus-dash-add-task');
    let currentTimerMode = 'pomodoro';
    let focusInterval = null;
    let quoteTimer = 0;
    // 1. Open Focus Mode
    const openFocusMode = () => {
        // Sync Background
        if (domElements.body.style.backgroundImage) {
            focusOverlay.style.backgroundImage = domElements.body.style.backgroundImage;
        }
        focusOverlay.classList.remove('hidden');
        switchFocusView('clock');
        updateQuote(true);
        startFocusLoop();
        renderFocusTasks();
        // NOTE: Removed automatic requestFullscreen() here
    };
    // 2. Exit Focus Mode
    document.getElementById('exit-super-focus').addEventListener('click', () => {
        focusOverlay.classList.add('hidden');
        if (focusInterval) clearInterval(focusInterval);
        // Exit fullscreen if active
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(e => console.log(e));
        }
        renderDashboard();
    });
    // 3. Toggle Fullscreen (Optional)
    fullscreenToggleBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(e => console.log(e));
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(e => console.log(e));
            }
        }
    });
    // 4. Helper: Auto-Add Missing Cards
    function ensureRequiredCards() {
        let added = false;
        // Check Pomodoro
        if (!appState.customCards.some(c => c.type === 'pomodoro')) {
            const newCard = {
                id: `custom-${Date.now()}-pom`,
                type: 'pomodoro',
                title: 'Pomodoro',
                content: []
            };
            appState.customCards.push(newCard);
            appState.layout.push(newCard.id);
            // Init default state
            appState.pomodoroState[newCard.id] = {
                mode: "pomodoro",
                time: 25 * 60,
                isRunning: false,
                durations: {
                    pomodoro: 25,
                    shortBreak: 5,
                    longBreak: 15
                }
            };
            added = true;
        }
        // Check Time Logger
        if (!appState.customCards.some(c => c.type === 'time-logger')) {
            const newCard = {
                id: `custom-${Date.now()}-log`,
                type: 'time-logger',
                title: 'Study Logger',
                content: []
            };
            appState.customCards.push(newCard);
            appState.layout.push(newCard.id);
            // Init default state
            appState.timeLoggerState[newCard.id] = {
                isRunning: false,
                accumulatedTime: 0,
                currentSubject: "Physics"
            };
            added = true;
        }
        if (added) {
            appState.save("customCards");
            appState.save("layout");
            appState.save("pomodoroState");
            appState.save("timeLoggerState");
            renderDashboard(); // Update background DOM
            console.log("Auto-added missing timer cards for Focus Mode.");
        }
    }
    // 5. Tab Switching
    viewTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetView = tab.dataset.view;
            if (targetView === 'timer' || targetView === 'dashboard') {
                ensureRequiredCards(); // <--- Auto-add magic happens here
                // Auto-correct mode if we just added a card
                if (targetView === 'timer') {
                    const hasPomodoro = appState.customCards.some(c => c.type === 'pomodoro');
                    const hasLogger = appState.customCards.some(c => c.type === 'time-logger');
                    if (!hasPomodoro && currentTimerMode === 'pomodoro') setTimerMode('logger');
                    if (!hasLogger && currentTimerMode === 'logger') setTimerMode('pomodoro');
                }
            }
            switchFocusView(targetView);
        });
    });

    function switchFocusView(viewName) {
        viewTabs.forEach(t => t.classList.toggle('active', t.dataset.view === viewName));
        views.forEach(v => v.classList.add('hidden'));
        document.getElementById(`focus-view-${viewName}`).classList.remove('hidden');
    }
    // 6. Timer Logic & Display
    timerModeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            ensureRequiredCards(); // Ensure card exists before switching mode
            setTimerMode(mode);
        });
    });

    function setTimerMode(mode) {
        currentTimerMode = mode;
        timerModeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
        updateFocusTimerDisplay();
    }

    function updateFocusTimerDisplay() {
        let timeStr = "00:00";
        let isRunning = false;
        let cardId = null;
        if (currentTimerMode === 'pomodoro') {
            const card = appState.customCards.find(c => c.type === 'pomodoro');
            if (card) {
                cardId = card.id;
                const state = appState.pomodoroState[cardId];
                if (state) {
                    const m = Math.floor(state.time / 60).toString().padStart(2, '0');
                    const s = (state.time % 60).toString().padStart(2, '0');
                    timeStr = `${m}:${s}`;
                    isRunning = state.isRunning;
                }
            }
        } else {
            const card = appState.customCards.find(c => c.type === 'time-logger');
            if (card) {
                cardId = card.id;
                const state = appState.timeLoggerState[cardId];
                if (state) {
                    let totalSecs = state.accumulatedTime;
                    if (state.isRunning && state.startTime) {
                        const elapsed = Math.round((Date.now() - state.startTime) / 1000);
                        totalSecs += elapsed;
                    }
                    timeStr = formatTimeHHMMSS(totalSecs);
                    isRunning = state.isRunning;
                }
            }
        }
        // Apply to DOM
        if (bigTimerDisplay) bigTimerDisplay.textContent = timeStr;
        if (dashTimerDisplay) dashTimerDisplay.textContent = timeStr;
        const btnText = isRunning ? "PAUSE" : "START";
        const btnColor = isRunning ? "#2C2D33" : "grey";
        [bigTimerToggle, dashTimerToggle].forEach(btn => {
            if (btn) {
                btn.textContent = btnText;
                btn.style.backgroundColor = btnColor;
                btn.onclick = () => toggleTimerGlobal(cardId, currentTimerMode);
            }
        });
        [bigTimerReset, dashTimerReset].forEach(btn => {
            if (btn) btn.onclick = () => resetTimerGlobal(cardId, currentTimerMode);
        });
    }

    function toggleTimerGlobal(cardId, mode) {
        if (!cardId) return;
        if (mode === 'pomodoro') pomodoroTimer.toggle(cardId);
        else window.timeLogger.toggle(cardId);
        setTimeout(updateFocusTimerDisplay, 50);
    }

    function resetTimerGlobal(cardId, mode) {
        if (!cardId) return;
        if (mode === 'pomodoro') pomodoroTimer.reset(cardId);
        else window.timeLogger.reset(cardId);
        setTimeout(updateFocusTimerDisplay, 50);
    }
    // 7. Quote Oscillation
    function updateQuote(immediate = false) {
        if (!quoteDisplay) return;
        const quotes = appState.settings.theme === "alakh-pandey" ? alakhPandeyQuotes : generalQuotes;
        const rQuote = quotes[Math.floor(Math.random() * quotes.length)];
        if (immediate) {
            quoteDisplay.textContent = `"${rQuote.text}"`;
            quoteDisplay.style.opacity = 1;
        } else {
            quoteDisplay.style.opacity = 0;
            setTimeout(() => {
                quoteDisplay.textContent = `"${rQuote.text}"`;
                quoteDisplay.style.opacity = 1;
            }, 800);
        }
    }
    // 8. Main Loop 
    function startFocusLoop() {
        if (focusInterval) clearInterval(focusInterval);
        quoteTimer = 0;
        focusInterval = setInterval(() => {
            const now = new Date();
            if (clockDisplay) clockDisplay.textContent = now.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            if (dateDisplay) dateDisplay.textContent = now.toLocaleDateString([], {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
            });
            if (!focusOverlay.classList.contains('hidden')) {
                updateFocusTimerDisplay();
            }
            quoteTimer++;
            if (quoteTimer >= 10) {
                updateQuote();
                quoteTimer = 0;
            }
        }, 1000);
        updateFocusTimerDisplay();
    }
    // 9. Tasks (Auto-Create Todo Card if missing)
    function renderFocusTasks() {
        if (!dashTaskList) return;
        dashTaskList.innerHTML = '';
        let todoCard = appState.customCards.find(c => c.type === 'todo');
        // Auto-create Todo card if missing
        if (!todoCard) {
            todoCard = {
                id: `custom-${Date.now()}-todo`,
                type: 'todo',
                title: 'Tasks',
                content: []
            };
            appState.customCards.push(todoCard);
            appState.layout.push(todoCard.id);
            appState.save("customCards");
            appState.save("layout");
            renderDashboard();
        }
        if (todoCard && todoCard.content) {
            todoCard.content.forEach(task => {
                if (!task.completed) {
                    const li = document.createElement('li');
                    li.className = "flex items-center gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 cursor-pointer group transition-all";
                    li.innerHTML = `

                    <div class="w-4 h-4 rounded-full border border-white/40 group-hover:border-green-400 group-hover:bg-green-400/20 transition-colors"></div>

                    <span class="text-sm text-white/80 group-hover:text-white transition-colors">${task.text}</span>

                `;
                    li.addEventListener('click', () => {
                        task.completed = true;
                        appState.save("customCards");
                        li.style.opacity = '0';
                        setTimeout(renderFocusTasks, 200);
                    });
                    dashTaskList.appendChild(li);
                }
            });
        }
    }
    if (dashAddTaskInput) {
        dashAddTaskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                let todoCard = appState.customCards.find(c => c.type === 'todo');
                if (!todoCard) {
                    todoCard = {
                        id: `custom-${Date.now()}`,
                        type: 'todo',
                        title: 'Tasks',
                        content: []
                    };
                    appState.customCards.push(todoCard);
                }
                todoCard.content.push({
                    text: e.target.value.trim(),
                    completed: false
                });
                appState.save("customCards");
                renderFocusTasks();
                e.target.value = '';
            }
        });
    }
    // --- TRIGGER BUTTON ---
    const controlsContainer = document.querySelector('.default-header .flex.items-center.space-x-2');
    const oldBtn = document.getElementById('open-focus-mode-btn');
    if (oldBtn) oldBtn.remove();
    if (controlsContainer) {
        const focusBtn = document.createElement('button');
        focusBtn.id = 'open-focus-mode-btn';
        focusBtn.className = "bg-gray-700/50 hover:bg-gray-600/60 text-white font-bold p-2 rounded-full transition-colors text-sm";
        focusBtn.title = "Super Focus Mode";
        focusBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>`;
        focusBtn.addEventListener('click', openFocusMode);
        const zenBtn = document.getElementById('zen-mode-btn');
        controlsContainer.insertBefore(focusBtn, zenBtn);
    }

    // --- KEYBOARD SHORTCUTS LOGIC ---

    const shortcutsModal = document.getElementById("shortcuts-modal");
    const closeShortcutsBtn = document.getElementById("close-shortcuts-modal");

    if (closeShortcutsBtn) {
        closeShortcutsBtn.addEventListener("click", () => {
            shortcutsModal.classList.add("hidden");
        });
    }

    document.addEventListener("keydown", (e) => {
        // 1. IGNORE if user is typing in an input, textarea, or select
        const tagName = document.activeElement.tagName;
        const isTyping = (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || document.activeElement.isContentEditable);

        // Exception: Allow ESC to blur focus from an input
        if (e.key === "Escape") {
            if (isTyping) {
                document.activeElement.blur();
                return;
            }
            // Close all modals
            Object.values(domElements.modals).forEach(modal => modal.classList.add("hidden"));
            if (shortcutsModal) shortcutsModal.classList.add("hidden");
            if (document.getElementById('mobile-alert')) document.getElementById('mobile-alert').classList.add("hidden");
            return;
        }

        // If typing, stop here. Do not trigger other shortcuts.
        if (isTyping) return;

        // 2. SHORTCUT MAPPINGS
        const key = e.key.toLowerCase();

        switch (key) {
            case " ": // Spacebar -> Toggle Active Timer
                e.preventDefault(); // Prevent scrolling
                // Priority: Active Timer -> First Pomodoro -> First Logger
                let targetId = appState.activeTimer.cardId;
                let targetType = appState.activeTimer.type;

                if (!targetId) {
                    const pomCard = appState.customCards.find(c => c.type === "pomodoro");
                    if (pomCard) {
                        targetId = pomCard.id;
                        targetType = "pomodoro";
                    }
                }

                if (targetId && targetType) {
                    if (targetType === "pomodoro") pomodoroTimer.toggle(targetId);
                    if (targetType === "time-logger") window.timeLogger.toggle(targetId);
                }
                break;

            case "z": // Z -> Toggle Zen Mode
                domElements.body.classList.toggle("zen-mode");
                const isZen = domElements.body.classList.contains("zen-mode");
                domElements.buttons.exitZenBtn.classList.toggle("hidden", !isZen);
                break;

            case "n": // N -> New Card Modal
                e.preventDefault();
                domElements.modals.addCard.classList.remove("hidden");
                // Auto-focus the input
                setTimeout(() => domElements.forms.newCard.querySelector("input").focus(), 100);
                break;

            case "c": // C -> Customize Menu
                domElements.modals.customize.classList.toggle("hidden");
                break;
            
            case "f": // F -> Super Focus Mode
                // Check if the focus mode function exists (from your existing code)
                if (typeof openFocusMode === 'function') {
                    openFocusMode();
                }
                break;

            case "?": // ? (Shift + /) -> Show Shortcuts Help
            case "/":
                if (shortcutsModal) shortcutsModal.classList.remove("hidden");
                break;
        }
    });

// --- Updated Tutorial Logic ---
    const startTutorial = () => {
        // Check if Driver.js is loaded
        if (!window.driver?.js?.driver) {
            console.warn("Driver.js not loaded");
            return;
        }

        // --- STEP 1: UI CLEANUP ---
        // Close the Info Modal immediately
        const infoModal = document.getElementById("info-modal");
        if (infoModal) infoModal.classList.add("hidden");
        
        // Close Customise Modal if open
        const customizeModal = document.getElementById("customize-modal");
        if (customizeModal) customizeModal.classList.add("hidden");

        // --- STEP 2: START DRIVER AFTER DELAY ---
        // We wait 300ms to let the modal vanish visually before the tutorial highlights elements
        setTimeout(() => {
            const driver = window.driver.js.driver;

            // Determine active layout (for the button highlighting fix)
            const isRicedMode = appState.settings.ricedModeEnabled; 
            const headerScope = isRicedMode ? '.top-bar' : '.default-header';

            const rawSteps = [
                {
                    element: isRicedMode ? '#main-title-riced' : '#main-title',
                    popover: {
                        title: 'Welcome to StudyLocus',
                        description: 'Your personal JEE/NEET command center. Drag cards to reorder them.',
                        side: 'bottom',
                        align: 'start'
                    }
                },
                {
                    element: '#dashboard-grid',
                    popover: {
                        title: 'Your Workspace',
                        description: 'This is where your study tools live.',
                        side: 'top'
                    }
                },
                {
                    element: `${headerScope} .add-card-btn`,
                    popover: {
                        title: 'Add Widgets',
                        description: 'Click here to add To-Do lists, Timers, Graphs, or YouTube videos.',
                        side: 'bottom'
                    }
                },
                {
                    element: `${headerScope} .customize-btn`,
                    popover: {
                        title: 'Customise',
                        description: 'Change themes, fonts, wallpapers, and set your Exam Goal here. (IMPORTANT)',
                        side: 'bottom'
                    }
                },
                {
                    element: `${headerScope} .zen-mode-btn`,
                    popover: {
                        title: 'Zen Mode',
                        description: 'Hide everything except your dashboard for deep focus.',
                        side: 'bottom'
                    }
                },
                {
                    element: '.fab-container',
                    popover: {
                        title: 'Quick Tools',
                        description: 'Fast access to Syllabus Tracker and Zenith.',
                        side: 'left'
                    }
                },
                {
                    // Selects the correct container based on the current mode
                    element: isRicedMode ? '#auth-container-riced' : '#auth-container',
                    popover: {
                        title: 'Cloud Sync & Backup',
                        description: 'Sign in with Google to save your dashboard, tasks, and settings to the cloud. Never lose your progress and access your study space from any device! NOT COMPULSORY :)',
                        side: 'left',
                        align: 'center'
                    }
                },
                {
                    element: isRicedMode ? '#main-title-riced' : '#main-title',
                    popover: {
                        title: 'Well, good luck with your preparation!',
                        description: "If you like the project, share it with others and follow me on github pls 🙂",
                        side: 'bottom',
                        align: 'center'
                    }
                },
            ];

            // Filter for visible elements only
            const validSteps = rawSteps.filter(step => {
                const el = document.querySelector(step.element);
                return el && (el.offsetWidth > 0 || el.offsetHeight > 0);
            });

            const driverObj = driver({
                showProgress: true,
                animate: true,
                allowClose: true,
                overlayClickNext: false,
                popoverClass: 'driverjs-theme',
                steps: validSteps,
                onDestroyStarted: () => {
                    localStorage.setItem("tutorialSeen_v2", "true");
                    driverObj.destroy();
                }
            });

            driverObj.drive();
        }, 300); // 300ms delay for smooth transition
    };

    const hasSeenTutorial = localStorage.getItem("tutorialSeen_v2");
    window.startTutorial = startTutorial;

    if (!hasSeenTutorial) {
        console.log("User has not seen tutorial. Prompting...");
        
        setTimeout(() => {
            showConfirmModal(
                "Would you like a quick tour of the dashboard features?", // Message
                () => {
                    // User clicked "Start Tour"
                    startTutorial(); 
                },
                "Welcome to StudyLocus!", // Title
                () => {
                    // User clicked "Skip"
                    // Mark as seen so we don't ask again
                    localStorage.setItem("tutorialSeen_v2", "true");
                },
                "Start Tour", // Confirm Button Text
                "Skip"        // Cancel Button Text
            );
        }, 1500); 
    }
});