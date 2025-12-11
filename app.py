import json
from flask import Flask, render_template, request, jsonify
import firebase_admin
from firebase_admin import credentials, db
from flask_cors import CORS
from flask import Flask
from flask_cors import CORS

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# ✅ Fix CORS: allow all origins, methods, headers
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# Initialize Firebase Admin
cred = credentials.Certificate('ethiostore-17d9f-firebase-adminsdk-5e87k-ff766d2648.json')
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://ethiostore-17d9f-default-rtdb.firebaseio.com/'
})


# ===================== HOME PAGE =====================
@app.route('/')
def home():
    return render_template('teacher_login.html')


# ===================== STUDENT REGISTRATION =====================
@app.route('/register/student', methods=['POST'])
def register_student():
    data = request.json

    users_ref = db.reference('Users')
    students_ref = db.reference('Students')

    # Check if username exists
    all_users = users_ref.get() or {}
    for user in all_users.values():
        if user.get('username') == data['username']:
            return jsonify({'success': False, 'message': 'Username already exists!'})

    # Create user
    new_user_ref = users_ref.push()
    new_user_ref.set({
        'userId': new_user_ref.key,
        'username': data['username'],
        'name': data['name'],
        'password': data['password'],
        'role': 'student',
        'isActive': True
    })

    # Create student entry
    new_student_ref = students_ref.push()
    new_student_ref.set({
        'userId': new_user_ref.key,
        'academicYear': '2024_2025',
        'grade': data['grade'],
        'section': data['section'],
        'status': 'active'
    })

    return jsonify({'success': True, 'message': 'Student registered successfully!'})









# ===================== TEACHER REGISTRATION =====================
@app.route('/register/teacher', methods=['POST'])
def register_teacher():
    data = request.json

    users_ref = db.reference('Users')
    teachers_ref = db.reference('Teachers')
    courses_ref = db.reference('Courses')
    assignments_ref = db.reference('TeacherAssignments')

    # Check if username exists
    all_users = users_ref.get() or {}
    for user in all_users.values():
        if user.get('username') == data['username']:
            return jsonify({'success': False, 'message': 'Username already exists!'})

    # Check for duplicate courses in the same submission
    seen_courses = set()
    for course in data.get('courses', []):
        key = f"{course['subject'].lower()}_{course['grade']}{course['section'].upper()}"
        if key in seen_courses:
            return jsonify({'success': False, 'message': f'Duplicate course in submission: {course["subject"]} grade {course["grade"]} section {course["section"]}'})
        seen_courses.add(key)

    # Check if course already has a teacher in database
    all_assignments = assignments_ref.get() or {}
    for course in data.get('courses', []):
        grade = course['grade']
        section = course['section']
        subject = course['subject']
        course_id = f"course_{subject.lower()}_{grade}{section.upper()}"

        # If course exists and already assigned
        for assignment in all_assignments.values():
            if assignment.get('courseId') == course_id:
                return jsonify({'success': False, 'message': f'{subject} grade {grade} section {section} already has a teacher!'})

    # Create user
    new_user_ref = users_ref.push()
    new_user_ref.set({
        'userId': new_user_ref.key,
        'username': data['username'],
        'name': data['name'],
        'password': data['password'],
        'role': 'teacher',
        'isActive': True
    })

    # Create teacher entry
    new_teacher_ref = teachers_ref.push()
    new_teacher_ref.set({'userId': new_user_ref.key, 'status': 'active'
                         
                         
                         })

    # Process all courses
    for course in data.get('courses', []):
        grade = course['grade']
        section = course['section']
        subject = course['subject']
        course_id = f"course_{subject.lower()}_{grade}{section.upper()}"

        # Create course if not exists
        if not courses_ref.child(course_id).get():
            courses_ref.child(course_id).set({
                'name': subject,
                'subject': subject,
                'grade': grade,
                'section': section
            })

        # Assign teacher
        new_assignment_ref = assignments_ref.push()
        new_assignment_ref.set({
            'teacherId': new_teacher_ref.key,
            'courseId': course_id
        })

    return jsonify({'success': True, 'message': 'Teacher registered successfully!'})



# ===================== PARENT REGISTRATION =====================
@app.route('/register/parent', methods=['POST'])
def register_parent():
    data = request.json

    users_ref = db.reference('Users')
    parents_ref = db.reference('Parents')

    # Check if username exists
    all_users = users_ref.get() or {}
    for user in all_users.values():
        if user.get('username') == data['username']:
            return jsonify({'success': False, 'message': 'Username already exists!'})

    # Create user
    new_user_ref = users_ref.push()
    new_user_ref.set({
        'userId': new_user_ref.key,
        'username': data['username'],
        'name': data['name'],
        'password': data['password'],
        'role': 'parent',
        'isActive': True
    })

    # Ensure children list is a list
    children_ids = data['children'] if isinstance(data['children'], list) else [x.strip() for x in data['children'].split(',')]

    # Create parent entry
    new_parent_ref = parents_ref.push()
    new_parent_ref.set({
        'userId': new_user_ref.key,
        'children': {child: True for child in children_ids}
    })

    return jsonify({'success': True, 'message': 'Parent registered successfully!'})




# ===================== TEACHER DASHBOARD PAGE =====================
@app.route('/teacher/dashboard')
def teacher_dashboard():
    return render_template('teacher_dashboard.html')










# ===================== FETCH TAKEN SUBJECTS =====================
@app.route('/teachers/subjects/<grade>/<section>', methods=['GET'])
def get_taken_subjects(grade, section):
    assignments_ref = db.reference('TeacherAssignments')
    courses_ref = db.reference('Courses')

    all_assignments = assignments_ref.get() or {}
    taken_subjects = []

    for assign in all_assignments.values():
        course_id = assign.get('courseId')
        course = courses_ref.child(course_id).get()
        if course and str(course.get('grade')) == grade and course.get('section') == section:
            taken_subjects.append(course.get('subject'))

    return jsonify({'takenSubjects': taken_subjects})


# ===================== TEACHER LOGIN =====================


@app.route("/api/teacher_login", methods=["POST", "OPTIONS"])
def teacher_login():
    if request.method == "OPTIONS":
        # Preflight request for CORS
        return '', 200

    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"success": False, "message": "Username and password required"}), 400

    try:
        users_ref = db.reference("Users")
        all_users = users_ref.get() or {}

        # Find user with role 'teacher' and matching username
        teacher_user = None
        for user_id, user in all_users.items():
            if user.get("username") == username and user.get("role") == "teacher":
                teacher_user = {"userId": user_id, **user}
                break

        if not teacher_user:
            return jsonify({"success": False, "message": "Teacher not found"}), 404

        # Check password
        if teacher_user.get("password") != password:
            return jsonify({"success": False, "message": "Invalid password"}), 401

        # Optional: fetch teacher profile image from Teachers node
        teachers_ref = db.reference("Teachers")
        teacher_profile = teachers_ref.child(teacher_user["userId"]).get() or {}
        profile_image = teacher_profile.get("profileImage", "/default-profile.png")

        # Return teacher info
        return jsonify({
            "success": True,
            "teacher": {
                "teacherId": teacher_user["userId"],
                "name": teacher_user.get("name"),
                "username": teacher_user.get("username"),
                "profileImage": profile_image
            }
        })

    except Exception as e:
        print("Login error:", e)
        return jsonify({"success": False, "message": "Server error"}), 500


@app.route('/api/teacher/<teacher_id>/courses', methods=['GET'])
def get_teacher_courses(teacher_id):
    assignments_ref = db.reference('TeacherAssignments')
    courses_ref = db.reference('Courses')

    all_assignments = assignments_ref.get() or {}
    courses_list = []

    for assign in all_assignments.values():
        if assign.get('teacherId') == teacher_id:
            course_id = assign.get('courseId')
            course_data = courses_ref.child(course_id).get()
            if course_data:
                courses_list.append({
                    'subject': course_data.get('subject'),
                    'grade': course_data.get('grade'),
                    'section': course_data.get('section')
                })

    return jsonify({'courses': courses_list})





@app.route('/api/teacher/<teacher_id>/students', methods=['GET'])
def get_teacher_students(teacher_id):
    assignments_ref = db.reference('TeacherAssignments')
    courses_ref = db.reference('Courses')
    students_ref = db.reference('Students')
    users_ref = db.reference('Users')
    marks_ref = db.reference('ClassMarks')

    all_assignments = assignments_ref.get() or {}
    course_students = []

    for assign in all_assignments.values():
        if assign.get('teacherId') != teacher_id:
            continue

        course_id = assign.get('courseId')
        course_data = courses_ref.child(course_id).get()
        if not course_data:
            continue

        grade = course_data.get('grade')
        section = course_data.get('section')
        subject = course_data.get('subject')

        # Fetch all students in this grade + section
        all_students = students_ref.get() or {}
        students_list = []
        for student_id, student in all_students.items():
            if student.get('grade') == grade and student.get('section') == section:
                user_data = users_ref.child(student.get('userId')).get()
                if not user_data:
                    continue

                # Fetch marks from ClassMarks node
                student_marks = marks_ref.child(student_id).child(course_id).get() or {}
                
                students_list.append({
                    'name': user_data.get('name'),
                    'username': user_data.get('username'),
                    'marks': student_marks
                })

        # Avoid duplicate grade-section
        exists = next((c for c in course_students if c['grade'] == grade and c['section'] == section and c['subject'] == subject), None)
        if not exists:
            course_students.append({
                'subject': subject,
                'grade': grade,
                'section': section,
                'students': students_list
            })

    return jsonify({'courses': course_students})


# ===================== GET STUDENTS OF A COURSE =====================
# ===================== GET STUDENTS OF A COURSE =====================
@app.route('/api/course/<course_id>/students', methods=['GET'])
def get_course_students(course_id):
    courses_ref = db.reference('Courses')
    students_ref = db.reference('Students')
    users_ref = db.reference('Users')
    marks_ref = db.reference('ClassMarks')  # New marks node

    course = courses_ref.child(course_id).get()
    if not course:
        return jsonify({'students': [], 'course': None})

    grade = course.get('grade')
    section = course.get('section')

    all_students = students_ref.get() or {}
    course_students = []

    for student_id, student in all_students.items():
        if student.get('grade') == grade and student.get('section') == section:
            user_data = users_ref.child(student.get('userId')).get()
            if user_data:
                # Fetch marks from ClassMarks node
                student_marks = marks_ref.child(course_id).child(student_id).get() or {}
                course_students.append({
                    'studentId': student_id,  # include studentId
                    'name': user_data.get('name'),
                    'username': user_data.get('username'),
                    'marks': {
                        'mark20': student_marks.get('mark20', 0),
                        'mark30': student_marks.get('mark30', 0),
                        'mark50': student_marks.get('mark50', 0),
                        'mark100': student_marks.get('mark100', 0)
                    }
                })

    return jsonify({
        'students': course_students,
        'course': {
            'subject': course.get('subject'),
            'grade': grade,
            'section': section
        }
    })


# ===================== UPDATE STUDENT MARKS =====================
@app.route('/api/course/<course_id>/update-marks', methods=['POST'])
def update_course_marks(course_id):
    data = request.json
    updates = data.get('updates', [])

    marks_ref = db.reference('ClassMarks')  # Use the new node

    for update in updates:
        student_id = update.get('studentId')  # ✅ use studentId from JS
        marks = update.get('marks', {})

        # Save marks for this student under the course
        marks_ref.child(course_id).child(student_id).set({
            'mark20': marks.get('mark20', 0),
            'mark30': marks.get('mark30', 0),
            'mark50': marks.get('mark50', 0)
            
        })

    return jsonify({'success': True, 'message': 'Marks updated successfully!'})





@app.route("/api/get_posts", methods=["GET"])
def get_posts():
    # Replace with actual logic to fetch posts
    posts = [
        {
            "postId": "1",
            "teacherId": "t001",
            "adminName": "Admin",
            "adminProfile": "/default-profile.png",
            "message": "Hello world",
            "timestamp": "2025-12-10T11:00:00",
            "likeCount": 0,
            "likes": {}
        }
    ]
    return jsonify(posts)





# ===================== RUN APP =====================
if __name__ == '__main__':
    app.run(debug=True)
