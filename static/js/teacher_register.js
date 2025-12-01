document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('teacherForm');

    // Handle form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const name = document.getElementById('name').value;
        const password = document.getElementById('password').value;

        // Collect all courses
        const courseRows = document.querySelectorAll('.course-row');
        const courses = Array.from(courseRows).map(row => ({
            grade: row.querySelector('.grade').value,
            section: row.querySelector('.section').value,
            subject: row.querySelector('.subject').value
        }));

        const data = { username, name, password, courses };

        try {
            const res = await fetch('/register/teacher', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await res.json();
            alert(result.message);

            if (result.success) {
                form.reset();
                // Keep one default row after reset
                const container = document.getElementById('coursesContainer');
                container.innerHTML = container.firstElementChild.outerHTML;
            }
        } catch (err) {
            console.error('Error registering teacher:', err);
        }
    });
});
