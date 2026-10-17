# School Database Design

## Entities and tables

- **Students:** Stores one row for each student. `student_id` is the primary key, and each student's name and unique email address are required.
- **Courses:** Stores one row for each course. `course_id` is the primary key, while the course name and unique course code identify the subject.
- **Enrolments:** Records the fact that a student is enrolled on a course and stores that student's grade. Its foreign keys link each enrolment to one student and one course. The unique constraint on `(student_id, course_id)` prevents a student from enrolling on the same course more than once.

## Relationships

One student can have many enrolments, so the relationship from `students` to `enrolments` is one-to-many. One course can also have many enrolments, making the relationship from `courses` to `enrolments` one-to-many. Students and courses therefore have a many-to-many relationship: a student can take many courses, and a course can contain many students. The `enrolments` join table is needed to represent each student-course pairing and to store information about that relationship, such as the grade.

## Index

I would add an index on `enrolments.course_id`. It makes queries that find all students on a course, as well as queries that count enrolments per course, faster because the database can locate matching enrolment rows without scanning the entire table. The schema creates this index as `idx_enrolments_course_id`.

## SQL or NoSQL

I would choose SQL for this system. Students, courses, and enrolments have a clear, structured relationship, and foreign keys help keep those relationships valid. SQL also supports the joins, grouping, uniqueness rules, and reliable updates this system needs. A NoSQL database could store the data, but it would make enforcing enrolment constraints and querying relationships more complicated without providing a clear advantage for this use case.
