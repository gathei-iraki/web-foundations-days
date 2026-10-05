let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

function searchNotes(word) {
  const searchWord = word.toLowerCase();

  return notes.filter((note) =>
    note.text.toLowerCase().includes(searchWord)
  );
}

function longestNote() {
  if (notes.length === 0) {
    return null;
  }

  let longest = notes[0];

  for (const note of notes) {
    if (note.text.length > longest.text.length) {
      longest = note;
    }
  }

  return longest;
}

function countByCategory() {
  const counts = { personal: 0, work: 0, study: 0 };

  for (const note of notes) {
    counts[note.category] += 1;
  }

  return counts;
}

function getSummary() {
  const counts = countByCategory();
  const noteWord = notes.length === 1 ? "note" : "notes";

  return `${notes.length} ${noteWord}: ${counts.personal} personal, ${counts.work} work, ${counts.study} study.`;
}

function isDuplicate(text) {
  const normalizedText = text.trim().toLowerCase();

  return notes.some(
    (note) => note.text.trim().toLowerCase() === normalizedText
  );
}

function addNote(text, category) {
  const validCategories = ["personal", "work", "study"];
  const trimmedText = text.trim();

  if (trimmedText.length < 1 || trimmedText.length > 200) {
    console.log("Note not added: text must be between 1 and 200 characters.");
    return false;
  }

  if (isDuplicate(trimmedText)) {
    console.log("Note not added: that note already exists.");
    return false;
  }

  if (!validCategories.includes(category)) {
    console.log("Note not added: invalid category.");
    return false;
  }

  const nextId = Math.max(0, ...notes.map((note) => note.id)) + 1;
  notes.push({ id: nextId, text: trimmedText, category });
  return true;
}

// searchNotes tests
console.log(searchNotes("DAY")); // Expected: [{ id: 2, text: "Finish the Day 3 assignment", category: "study" }]
console.log(searchNotes("holiday")); // Expected: []

// longestNote tests
console.log(longestNote()); // Expected: { id: 3, text: "Email the project report to Grace", category: "work" }
const savedNotesForLongestTest = notes;
notes = [];
console.log(longestNote()); // Expected: null
notes = savedNotesForLongestTest;

// countByCategory tests
console.log(countByCategory()); // Expected: { personal: 2, work: 1, study: 2 }
const savedNotesForCountTest = notes;
notes = [];
console.log(countByCategory()); // Expected: { personal: 0, work: 0, study: 0 }
notes = savedNotesForCountTest;

// getSummary tests
console.log(getSummary()); // Expected: "5 notes: 2 personal, 1 work, 2 study."
const savedNotesForSummaryTest = notes;
notes = [{ id: 1, text: "Buy milk and bread", category: "personal" }];
console.log(getSummary()); // Expected: "1 note: 1 personal, 0 work, 0 study."
notes = savedNotesForSummaryTest;

// isDuplicate tests
console.log(isDuplicate("  BUY MILK AND BREAD  ")); // Expected: true
console.log(isDuplicate("Plan a holiday")); // Expected: false

// addNote tests
console.log(addNote("Plan tomorrow's tasks", "personal")); // Expected: true
console.log(addNote("  plan TOMORROW'S tasks  ", "personal")); // Expected: logs duplicate reason, then false
console.log(addNote("", "study")); // Expected: logs invalid-length reason, then false
console.log(addNote("Prepare slides", "hobby")); // Expected: logs invalid-category reason, then false
