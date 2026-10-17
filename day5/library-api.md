# Library Books API

The Library Books API manages the books in a library's collection. All request and response bodies use JSON.

## List all books

- **Method:** `GET`
- **Path:** `/books`
- **Description:** Returns a list of every book in the library.
- **Success status:** `200 OK`

## Get one book

- **Method:** `GET`
- **Path:** `/books/{bookId}`
- **Description:** Returns the book with the specified ID.
- **Success status:** `200 OK`

## Create a book

- **Method:** `POST`
- **Path:** `/books`
- **Description:** Adds a new book to the library.
- **Example request body:**

  ```json
  {
    "title": "Things Fall Apart",
    "author": "Chinua Achebe",
    "isbn": "9780385474542",
    "publishedYear": 1958
  }
  ```

- **Success status:** `201 Created`

## Update a book

- **Method:** `PUT`
- **Path:** `/books/{bookId}`
- **Description:** Replaces the details of the book with the specified ID.
- **Example request body:**

  ```json
  {
    "title": "Things Fall Apart",
    "author": "Chinua Achebe",
    "isbn": "9780385474542",
    "publishedYear": 1958
  }
  ```

- **Success status:** `200 OK`

## Delete a book

- **Method:** `DELETE`
- **Path:** `/books/{bookId}`
- **Description:** Removes the book with the specified ID from the library.
- **Success status:** `204 No Content`

## List books by an author

- **Method:** `GET`
- **Path:** `/books?author={authorName}`
- **Description:** Returns books whose author matches the `author` query parameter.
- **Success status:** `200 OK`

## Error responses

- **`400 Bad Request`:** The request data is invalid, such as when a create-book request is missing the required `title` field.
- **`404 Not Found`:** No book exists with the requested ID, such as when a client requests `GET /books/9999`.
