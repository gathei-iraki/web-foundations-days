const loadUsersButton = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const status = document.querySelector("#status");
const usersList = document.querySelector("#users-list");

const USERS_URL = "https://jsonplaceholder.typicode.com/users";
let users = [];

function renderUsers(list) {
  usersList.replaceChildren();

  list.forEach((user) => {
    const listItem = document.createElement("li");
    const name = document.createElement("h2");
    const email = document.createElement("p");
    const city = document.createElement("p");
    const company = document.createElement("p");

    name.textContent = user.name;
    email.textContent = `Email: ${user.email}`;
    city.textContent = `City: ${user.address.city}`;
    company.textContent = `Company: ${user.company.name}`;

    listItem.append(name, email, city, company);
    usersList.append(listItem);
  });
}

async function loadUsers() {
  loadUsersButton.disabled = true;
  status.textContent = "Loading users...";
  usersList.replaceChildren();

  try {
    const response = await fetch(USERS_URL);

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    users = await response.json();
    filterInput.value = "";
    renderUsers(users);
    status.textContent = `Successfully loaded ${users.length} users.`;
  } catch (error) {
    users = [];
    status.textContent = `Unable to load users. ${error.message}`;
  } finally {
    loadUsersButton.disabled = false;
  }
}

loadUsersButton.addEventListener("click", loadUsers);

filterInput.addEventListener("input", () => {
  const searchText = filterInput.value.trim().toLowerCase();
  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(searchText)
  );

  renderUsers(filteredUsers);

  status.textContent = filteredUsers.length === 0
    ? "No users match your filter."
    : `Showing ${filteredUsers.length} ${filteredUsers.length === 1 ? "user" : "users"}.`;
});

