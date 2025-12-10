// Simple front-end state for current user
let currentUser = null;

// Elements
const loginScreen = document.getElementById("login-screen");
const menuScreen = document.getElementById("menu-screen");
const bookScreen = document.getElementById("book-screen");

const nameInput = document.getElementById("name");
const surnameInput = document.getElementById("surname");
const groupSelect = document.getElementById("group");

const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const backToMenuBtn = document.getElementById("back-to-menu-btn");

const welcomeText = document.getElementById("welcome-text");

function showScreen(screen) {
    loginScreen.classList.add("hidden");
    menuScreen.classList.add("hidden");
    bookScreen.classList.add("hidden");

    screen.classList.remove("hidden");
}

loginBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    const surname = surnameInput.value.trim();
    const group = groupSelect.value;

    if (!name || !surname || !group) {
        alert("Please enter your name, surname and group.");
        return;
    }

    currentUser = { name, surname, group };

    welcomeText.textContent = `Welcome, ${name} ${surname} – ${group}`;
    showScreen(menuScreen);
});

logoutBtn.addEventListener("click", () => {
    currentUser = null;
    nameInput.value = "";
    surnameInput.value = "";
    groupSelect.selectedIndex = 0;
    showScreen(loginScreen);
});

backToMenuBtn.addEventListener("click", () => {
    showScreen(menuScreen);
});

// Book cards
document.querySelectorAll(".book-card.active").forEach((card) => {
    card.addEventListener("click", () => {
        const bookId = card.getAttribute("data-book-id");
        openBook(bookId);
    });
});

function openBook(bookId) {
    if (!currentUser) {
        showScreen(loginScreen);
        return;
    }

    if (bookId === "cause-effect") {
        // later we can switch book title & content dynamically
        showScreen(bookScreen);
    } else {
        alert("This book is not ready yet.");
    }
}

/**
 * Helper to send results to Telegram via Vercel API (future feature).
 * You can call this later from your exercises.
 */
async function sendResultToTelegram(payload) {
    try {
        const res = await fetch("/api/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            console.error("Failed to send result:", await res.text());
        }
    } catch (err) {
        console.error("Error sending result:", err);
    }
}
