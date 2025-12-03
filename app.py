import json
from flask import Flask, render_template, request, jsonify
import firebase_admin
from firebase_admin import credentials, db

app = Flask(__name__)

# Initialize Firebase Admin
cred = credentials.Certificate('ethiostore-17d9f-firebase-adminsdk-5e87k-aca424fa71.json')
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

@app.route('/login/teacher', methods=['POST'])
def login_teacher():
    data = request.json
    users_ref = db.reference('Users')
    teachers_ref = db.reference('Teachers')

    all_users = users_ref.get() or {}
    all_teachers = teachers_ref.get() or {}

    for uid, user in all_users.items():
        if user.get('username') == data['username'] and user.get('role') == 'teacher':
            if user.get('password') == data['password']:
                # Find the corresponding teacher key
                teacher_key = None
                for tkey, tdata in all_teachers.items():
                    if tdata.get('userId') == uid:
                        teacher_key = tkey
                        break

                if teacher_key:
                    return jsonify({'success': True, 'teacherId': teacher_key})
                else:
                    return jsonify({'success': False, 'message': 'Teacher record not found'})
            else:
                return jsonify({'success': False, 'message': 'Incorrect password'})

    return jsonify({'success': False, 'message': 'Username not found'})




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

    all_assignments = assignments_ref.get() or {}
    course_students = []

    # Find all courses for this teacher
    for assign in all_assignments.values():
        if assign.get('teacherId') == teacher_id:
            course_id = assign.get('courseId')
            course_data = courses_ref.child(course_id).get()
            if not course_data:
                continue
            grade = course_data.get('grade')
            section = course_data.get('section')

            # Fetch all students in this grade + section
            all_students = students_ref.get() or {}
            students_list = []
            for student in all_students.values():
                if student.get('grade') == grade and student.get('section') == section:
                    user_data = users_ref.child(student.get('userId')).get()
                    if user_data:
                        students_list.append({
                            'name': user_data.get('name'),
                            'username': user_data.get('username')
                        })

            # Avoid duplicate grade-section
            exists = next((c for c in course_students if c['grade'] == grade and c['section'] == section), None)
            if not exists:
                course_students.append({
                    'grade': grade,
                    'section': section,
                    'students': students_list
                })

    return jsonify({'courses': course_students})









# ===================== RUN APP =====================
if __name__ == '__main__':
    app.run(debug=True)
