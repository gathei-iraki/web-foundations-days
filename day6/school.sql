-- School database schema

CREATE TABLE students (
  student_id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE courses (
  course_id INTEGER PRIMARY KEY,
  course_name VARCHAR(150) NOT NULL,
  course_code VARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE enrolments (
  enrolment_id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  grade VARCHAR(2),
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (course_id) REFERENCES courses(course_id),
  UNIQUE (student_id, course_id)
);

-- This index speeds up searches for all students enrolled on a course.
CREATE INDEX idx_enrolments_course_id ON enrolments(course_id);

-- Sample students
INSERT INTO students (student_id, name, email) VALUES
  (1, 'Amina Hassan', 'amina.hassan@example.com'),
  (2, 'Brian Otieno', 'brian.otieno@example.com'),
  (3, 'Chao Kamau', 'chao.kamau@example.com'),
  (4, 'Diana Wanjiku', 'diana.wanjiku@example.com');

-- Sample courses
INSERT INTO courses (course_id, course_name, course_code) VALUES
  (1, 'Web Development', 'WEB101'),
  (2, 'Database Design', 'DBS201'),
  (3, 'Computer Networks', 'NET150');

-- Sample enrolments
INSERT INTO enrolments (enrolment_id, student_id, course_id, grade) VALUES
  (1, 1, 1, 'A'),
  (2, 1, 2, 'B+'),
  (3, 2, 1, 'B'),
  (4, 2, 3, 'A-'),
  (5, 3, 2, 'A');

-- 1. Find all courses for one student by name.
SELECT c.course_id, c.course_name, c.course_code, e.grade
FROM students AS s
JOIN enrolments AS e ON e.student_id = s.student_id
JOIN courses AS c ON c.course_id = e.course_id
WHERE s.name = 'Amina Hassan';

-- 2. Find all students enrolled on one course.
SELECT s.student_id, s.name, s.email, e.grade
FROM courses AS c
JOIN enrolments AS e ON e.course_id = c.course_id
JOIN students AS s ON s.student_id = e.student_id
WHERE c.course_code = 'WEB101';

-- 3. Count the students enrolled in each course.
SELECT c.course_id, c.course_name, COUNT(e.student_id) AS student_count
FROM courses AS c
LEFT JOIN enrolments AS e ON e.course_id = c.course_id
GROUP BY c.course_id, c.course_name;

-- 4. Find students who have no enrolments.
SELECT s.student_id, s.name, s.email
FROM students AS s
LEFT JOIN enrolments AS e ON e.student_id = s.student_id
WHERE e.enrolment_id IS NULL;

-- 5. Update one enrolment's grade.
UPDATE enrolments
SET grade = 'A-'
WHERE student_id = 1 AND course_id = 2;
