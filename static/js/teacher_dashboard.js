document.addEventListener('DOMContentLoaded', async function() {
    const teacherId = localStorage.getItem('teacherId');

    if (!teacherId) {
        window.location.href = '/';
        return;
    }

    const coursesTbody = document.querySelector('#coursesTable tbody');
    const studentsContainer = document.getElementById('studentsContainer');

    // ---------- Load Teacher Courses ----------
    try {
        const res = await fetch(`/api/teacher/${teacherId}/courses`);
        const data = await res.json();

        if (data.courses && data.courses.length > 0) {
            data.courses.forEach(course => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${course.subject || '-'}</td>
                    <td>${course.grade || '-'}</td>
                    <td>${course.section || '-'}</td>
                `;
                coursesTbody.appendChild(tr);
            });
        } else {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="3">No courses assigned yet.</td>`;
            coursesTbody.appendChild(tr);
        }
    } catch (err) {
        console.error('Error fetching courses:', err);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="3">Failed to load courses.</td>`;
        coursesTbody.appendChild(tr);
    }

    // ---------- Load Students ----------
    try {
        const res = await fetch(`/api/teacher/${teacherId}/students`);
        const data = await res.json();

        studentsContainer.innerHTML = '';

        if (data.courses.length === 0) {
            studentsContainer.innerHTML = '<p>No students found.</p>';
        } else {
            data.courses.forEach(course => {
                const sectionDiv = document.createElement('div');
                sectionDiv.innerHTML = `
                    <h3>Grade: ${course.grade} | Section: ${course.section}</h3>
                    <table border="1">
                        <thead>
                            <tr><th>Name</th><th>Username</th></tr>
                        </thead>
                        <tbody>
                            ${course.students.map(s => `<tr><td>${s.name}</td><td>${s.username}</td></tr>`).join('')}
                        </tbody>
                    </table>
                    <br>
                `;
                studentsContainer.appendChild(sectionDiv);
            });
        }
    } catch (err) {
        console.error('Error fetching students:', err);
        studentsContainer.innerHTML = '<p>Failed to load students.</p>';
    }

    // ---------- Logout ----------
    document.getElementById('logoutBtn').addEventListener('click', function() {
        localStorage.removeItem('teacherId');
        window.location.href = '/';
    });
});
