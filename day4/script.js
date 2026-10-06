const noteText = document.querySelector("#note-text");
const charCount = document.querySelector("#char-count");
const wordCount = document.querySelector("#word-count");
const clearButton = document.querySelector("#clear-btn");
const themeButton = document.querySelector("#theme-toggle");

const DRAFT_KEY = "noteDraft";
const THEME_KEY = "noteTheme";

function updateCounts() {
  const characterTotal = noteText.value.length;
  const trimmedText = noteText.value.trim();
  const wordTotal = trimmedText ? trimmedText.split(/\s+/).length : 0;

  charCount.textContent = `${characterTotal} / 200 characters`;
  wordCount.textContent = `${wordTotal} ${wordTotal === 1 ? "word" : "words"}`;

  charCount.classList.toggle("warning", characterTotal > 180);
  charCount.classList.toggle("over", characterTotal > 200);
}

function clearNote() {
  noteText.value = "";
  localStorage.removeItem(DRAFT_KEY);
  updateCounts();
}

function updateThemeButton() {
  themeButton.textContent = document.body.classList.contains("dark")
    ? "Light mode"
    : "Dark mode";
}

noteText.addEventListener("input", () => {
  updateCounts();
  localStorage.setItem(DRAFT_KEY, noteText.value);
});

noteText.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearNote();
  }
});

clearButton.addEventListener("click", clearNote);

themeButton.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const theme = document.body.classList.contains("dark") ? "dark" : "light";

  localStorage.setItem(THEME_KEY, theme);
  updateThemeButton();
});

noteText.value = localStorage.getItem(DRAFT_KEY) ?? "";

if (localStorage.getItem(THEME_KEY) === "dark") {
  document.body.classList.add("dark");
}

updateThemeButton();
updateCounts();
