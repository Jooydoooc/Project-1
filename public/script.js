// =========================
// GLOBAL VARIABLES
// =========================
let currentUser = null;
let currentBook = null;
let currentUnit = null;
let foundWords = new Set();

let isReadingAloud = false;
let isSkimming = false;
let speechSynthesisAPI = window.speechSynthesis;
let currentUtterance = null;
let skimmingInterval = null;
let readingSpeed = 1.0;

// =========================
// INIT ON PAGE LOAD
// =========================
document.addEventListener("DOMContentLoaded", () => {
    const page = window.location.pathname;

    const savedUser = localStorage.getItem("readingUser");
    if (savedUser) currentUser = JSON.parse(savedUser);

    if (!currentUser && page !== "/" && page !== "/index.html") {
        window.location.href = "/";
        return;
    }

    if (page === "/" || page === "/index.html") initLoginPage();
    if (page === "/books" || page === "/books.html") initBooksPage();
    if (page === "/unit" || page === "/unit.html") initUnitPage();
});

// =========================
// LOGIN PAGE
// =========================
function initLoginPage() {
    const form = document.getElementById("loginForm");

    form.addEventListener("submit", e => {
        e.preventDefault();

        const name = document.getElementById("name").value.trim();
        const surname = document.getElementById("surname").value.trim();
        const group = document.getElementById("group").value.trim();

        if (!name || !surname || !group) {
            alert("Please complete all fields.");
            return;
        }

        currentUser = {
            id: Date.now().toString(),
            name,
            surname,
            group
        };

        localStorage.setItem("readingUser", JSON.stringify(currentUser));

        const btn = document.querySelector(".btn-login");
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Entering...`;
        btn.disabled = true;

        setTimeout(() => {
            window.location.href = "/books";
        }, 800);
    });
}

// =========================
// BOOKS PAGE
// =========================
function initBooksPage() {
    displayUserInfo();
    loadBooks();
}

function displayUserInfo() {
    const el = document.getElementById("userInfo");
    if (!el || !currentUser) return;

    el.innerHTML = `
        <div class="user-details">
            <div class="user-name">${currentUser.name} ${currentUser.surname}</div>
            <div class="user-group">${currentUser.group}</div>
        </div>
    `;
}

async function loadBooks() {
    const booksGrid = document.getElementById("booksGrid");

    try {
        const res = await fetch("/books.json");
        if (!res.ok) throw new Error("JSON missing");

        const data = await res.json();
        booksGrid.innerHTML = "";

        data.books.forEach(book => {
            const card = document.createElement("div");
            card.className = `book-card ${book.status}`;

            if (book.status === "available") {
                card.onclick = () => {
                    localStorage.setItem("currentBook", JSON.stringify(book));
                    window.location.href = `/unit?book=${book.id}&unit=1.1`;
                };
            }

            card.innerHTML = `
                <div class="book-cover">
                    <i class="fas fa-book-open"></i>
                </div>
                <div class="book-info">
                    <h3>${book.title}</h3>
                    <p>${book.description}</p>
                    <div class="book-status ${book.status}">
                        ${book.status === "available" ? "Available Now" : "Coming Soon"}
                    </div>
                </div>
            `;

            booksGrid.appendChild(card);
        });

    } catch (err) {
        console.error("BOOKS JSON LOAD ERROR:", err);
        booksGrid.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load books. Please refresh the page.</p>
            </div>
        `;
    }
}

// =========================
// UNIT PAGE
// =========================
function initUnitPage() {
    displayUserInfo();
    loadUnitData();
    initReadingControls();
}

async function loadUnitData() {
    try {
        const res = await fetch("/books.json");
        if (!res.ok) throw new Error("Missing books.json");

        const data = await res.json();
        const params = new URLSearchParams(window.location.search);

        const bookId = Number(params.get("book")) || 1;
        const unitId = params.get("unit") || "1.1";

        currentBook = data.books.find(b => b.id === bookId);
        currentUnit = currentBook.units.find(u => u.id === unitId);

        updateUnitHeader();
        updateTextContent();
        updateVocabularySection();
        updateGrammarSection();
        updateExercisesSection();

        highlightVocabularyWords();

    } catch (error) {
        console.error(error);
        document.getElementById("unitHeader").innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load the unit. Please refresh.</p>
            </div>`;
    }
}

function updateUnitHeader() {
    const el = document.getElementById("unitHeader");
    el.innerHTML = `
        <h1>${currentBook.title}</h1>
        <h2>Unit ${currentUnit.id}: ${currentUnit.title}</h2>
        <p>Read the text and complete the tasks below</p>
    `;
}

function updateTextContent() {
    const text = currentUnit.text.split("\n\n");
    document.getElementById("textContent").innerHTML =
        text.map(p => `<p>${p}</p>`).join("");
}

// =========================
// VOCABULARY HIGHLIGHT
// =========================
function highlightVocabularyWords() {
    const textEl = document.getElementById("textContent");
    let html = textEl.innerHTML;

    currentUnit.vocabulary.forEach(v => {
        const word = v.word.toLowerCase();
        const regex = new RegExp(`\\b${word}\\b`, "gi");
        html = html.replace(regex, `<span class="vocab-word" data-word="${word}">$&</span>`);
    });

    textEl.innerHTML = html;

    document.querySelectorAll(".vocab-word").forEach(span => {
        span.onclick = () => {
            showVocabPopup(span.dataset.word);
            foundWords.add(span.dataset.word);
            updateVocabularySection();
        };
    });
}

function updateVocabularySection() {
    const container = document.getElementById("vocabularySection");

    container.innerHTML = `
        <div class="section-header">
            <h3><i class="fas fa-book"></i> Vocabulary Builder</h3>
        </div>
        <div class="vocabulary-grid">
            ${currentUnit.vocabulary.map(v => `
                <div class="vocab-card ${foundWords.has(v.word) ? "found" : ""}" data-word="${v.word}">
                    <div class="word">${v.word}</div>
                    <div class="translation">${v.translation}</div>
                </div>
            `).join("")}
        </div>
    `;

    document.querySelectorAll(".vocab-card").forEach(card => {
        card.onclick = () => {
            showVocabPopup(card.dataset.word);
            foundWords.add(card.dataset.word);
            updateVocabularySection();
        };
    });
}

// =========================
// VOCAB POPUP
// =========================
function showVocabPopup(word) {
    const vocab = currentUnit.vocabulary.find(v => v.word.toLowerCase() === word.toLowerCase());
    const popup = document.getElementById("vocabPopup");
    const body = document.getElementById("popupBody");

    body.innerHTML = `
        <h2>${vocab.word}</h2>
        <p><strong>Meaning:</strong> ${vocab.translation}</p>
        <p><strong>Definition:</strong> ${vocab.definition}</p>
        <p><strong>Example:</strong> "${vocab.example}"</p>
    `;

    popup.style.display = "flex";
}

function closeVocabPopup() {
    document.getElementById("vocabPopup").style.display = "none";
}

// =========================
// GRAMMAR
// =========================
function updateGrammarSection() {
    const g = currentUnit.grammar;
    document.getElementById("grammarSection").innerHTML = `
        <div class="section-header">
            <h3><i class="fas fa-pen-alt"></i> Grammar Focus</h3>
        </div>
        <h4>${g.theme}</h4>
        <p>${g.description}</p>
        <ul>
            ${g.examples.map(ex => `<li>${ex}</li>`).join("")}
        </ul>
    `;
}

// =========================
// EXERCISES
// =========================
function updateExercisesSection() {
    const container = document.getElementById("exercisesSection");

    container.innerHTML = `
        <div class="section-header">
            <h3><i class="fas fa-clipboard-check"></i> Exercises</h3>
        </div>
        <div class="exercises-grid">
            ${currentUnit.exercises.map((ex, i) => `
                <div class="exercise-card" data-ex="${i}">
                    <h4>${ex.question}</h4>
                    ${ex.options.map((opt, idx) => `
                        <div class="option" data-index="${idx}">
                            <span class="option-letter">${String.fromCharCode(65 + idx)}</span>
                            <span>${opt}</span>
                        </div>
                    `).join("")}
                    <button class="check-btn" onclick="checkAnswer(${i})">Check</button>
                </div>
            `).join("")}
        </div>
    `;

    document.querySelectorAll(".option").forEach(opt => {
        opt.onclick = () => {
            const card = opt.closest(".exercise-card");
            card.querySelectorAll(".option").forEach(o => o.classList.remove("selected"));
            opt.classList.add("selected");
        };
    });
}

function checkAnswer(i) {
    const exercise = currentUnit.exercises[i];
    const card = document.querySelector(`.exercise-card[data-ex="${i}"]`);
    const selected = card.querySelector(".option.selected");

    if (!selected) return alert("Select an answer first!");

    const idx = Number(selected.dataset.index);

    if (idx === exercise.correct) {
        selected.classList.add("correct");
    } else {
        selected.classList.add("incorrect");
        card.querySelectorAll(".option")[exercise.correct].classList.add("correct");
    }

    card.querySelectorAll(".option").forEach(o => o.style.pointerEvents = "none");
    card.querySelector(".check-btn").disabled = true;
}

// =========================
// READING CONTROLS (SKIMMING & READ ALOUD)
// =========================
function initReadingControls() {
    document.getElementById("readAloudBtn").onclick = toggleReadAloud;
    document.getElementById("skimmingBtn").onclick = toggleSkimming;
}

// READ ALOUD
function toggleReadAloud() {
    const btn = document.getElementById("readAloudBtn");

    if (isReadingAloud) {
        speechSynthesisAPI.cancel();
        isReadingAloud = false;
        btn.innerHTML = `<i class="fas fa-volume-up"></i> Read Aloud`;
        return;
    }

    const text = document.getElementById("textContent").innerText;
    if (!text.trim()) return;

    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.rate = readingSpeed;

    currentUtterance.onstart = () => {
        isReadingAloud = true;
        btn.innerHTML = `<i class="fas fa-stop"></i> Stop`;
    };

    currentUtterance.onend = () => {
        isReadingAloud = false;
        btn.innerHTML = `<i class="fas fa-volume-up"></i> Read Aloud`;
    };

    speechSynthesisAPI.speak(currentUtterance);
}

// SKIMMING
function toggleSkimming() {
    const btn = document.getElementById("skimmingBtn");

    if (isSkimming) {
        clearInterval(skimmingInterval);
        isSkimming = false;
        btn.innerHTML = `<i class="fas fa-running"></i> Skimming`;
        updateTextContent();
        highlightVocabularyWords();
        return;
    }

    const text = currentUnit.text;
    let pos = 0;

    isSkimming = true;
    btn.innerHTML = `<i class="fas fa-stop"></i> Stop`;

    skimmingInterval = setInterval(() => {
        if (pos >= text.length) {
            toggleSkimming();
            return;
        }

        const visible = text.substring(0, pos);
        const hidden = text.substring(pos);

        document.getElementById("textContent").innerHTML = `
            <span>${visible}</span><span style="color:transparent">${hidden}</span>
        `;

        pos++;
    }, 50);
}

// Close popup on click outside
document.addEventListener("click", e => {
    const popup = document.getElementById("vocabPopup");
    if (e.target === popup) popup.style.display = "none";
});
