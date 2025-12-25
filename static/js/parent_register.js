document.getElementById("parentForm").addEventListener("submit", function (e) {
    e.preventDefault();

    const formData = new FormData();
    formData.append("name", document.getElementById("name").value);
    formData.append("phone", document.getElementById("phone").value);
    formData.append("username", document.getElementById("username").value);
    formData.append("password", document.getElementById("password").value);

    // Multiple student IDs and relationships
    const studentIds = document.querySelectorAll(".studentId");
    const relationships = document.querySelectorAll(".relationship");

    studentIds.forEach(input => formData.append("studentId", input.value));
    relationships.forEach(input => formData.append("relationship", input.value));

    // Profile image (optional)
    const profile = document.getElementById("profile").files[0];
    if (profile) formData.append("profile", profile);

    fetch("/register/parent", { method: "POST", body: formData })
        .then(res => res.json())
        .then(res => {
            alert(res.message);
            if (res.success) document.getElementById("parentForm").reset();
        })
        .catch(err => console.error(err));
});

// Add dynamic student input
document.getElementById("addStudent").addEventListener("click", function () {
    const container = document.getElementById("childrenContainer");

    const row = document.createElement("div");
    row.className = "child-row";

    const sidLabel = document.createElement("label");
    sidLabel.innerText = "Student ID";
    const sidInput = document.createElement("input");
    sidInput.type = "text";
    sidInput.name = "studentId";
    sidInput.className = "studentId";
    sidInput.required = true;

    const relLabel = document.createElement("label");
    relLabel.innerText = "Relationship";
    const relSelect = document.createElement("select");
    relSelect.name = "relationship";
    relSelect.className = "relationship";
    relSelect.required = true;
    relSelect.innerHTML = `
        <option value="">Select</option>
        <option value="Father">Father</option>
        <option value="Mother">Mother</option>
        <option value="Guardian">Guardian</option>
        <option value="Other">Other</option>
    `;

    row.appendChild(sidLabel);
    row.appendChild(sidInput);
    row.appendChild(relLabel);
    row.appendChild(relSelect);

    container.appendChild(row);
});
