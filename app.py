import json
import os
import sys
from datetime import datetime
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db, storage
from flask import Flask, request, jsonify

# ---------------- FLASK APP ----------------
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# ---------------- FIREBASE ----------------
firebase_json = "ethiostore-17d9f-firebase-adminsdk-5e87k-ff766d2648.json"
if not os.path.exists(firebase_json):
    print("Firebase JSON missing")
    sys.exit()

cred = credentials.Certificate(firebase_json)
firebase_admin.initialize_app(cred, {
    "databaseURL": "https://ethiostore-17d9f-default-rtdb.firebaseio.com/",
    "storageBucket": "ethiostore-17d9f.appspot.com"
})
bucket = storage.bucket()


# ===================== HOME PAGE =====================
@app.route('/')
def home():
    return render_template('parent_register.html')


# ===================== STUDENT REGISTRATION =====================
@app.route('/register/student', methods=['POST'])
def register_student():
    data = request.form
    profile_file = request.files.get('profile')

    username = data.get('username')
    name = data.get('name')
    password = data.get('password')
    grade = data.get('grade')
    section = data.get('section')

    if not all([username, name, password, grade, section]):
        return jsonify({'success': False, 'message': 'All fields are required'}), 400

    users_ref = db.reference('Users')
    students_ref = db.reference('Students')

   
   

    # Check if username exists
    all_users = users_ref.get() or {}
    for user in all_users.values():
        if user.get('username') == username:
            return jsonify({'success': False, 'message': 'Username already exists!'})






    # Upload profile image
    profile_url = "/default-profile.png"
    if profile_file:
        filename = f"students/{username}_{profile_file.filename}"
        blob = bucket.blob(filename)
        blob.upload_from_file(profile_file, content_type=profile_file.content_type)
        blob.make_public()
        profile_url = blob.public_url

    # Create user
    new_user_ref = users_ref.push()
    new_user_ref.set({
        'userId': new_user_ref.key,
        'username': username,
        'name': name,
        'password': password,  # ⚠ hash later
        'profileImage': profile_url,
        'role': 'student',
        'isActive': True
    })

    # Create student entry
    new_student_ref = students_ref.push()
    new_student_ref.set({
        'userId': new_user_ref.key,
        'academicYear': '2024_2025',
        'grade': grade,
        'section': section,
        'status': 'active'
    })


   

    return jsonify({'success': True, 'message': 'Student registered successfully!'})

# ===================== TEACHER REGISTRATION =====================
@app.route('/register/teacher', methods=['POST'])
def register_teacher():
    name = request.form.get('name')
    username = request.form.get('username')
    password = request.form.get('password')
    courses = json.loads(request.form.get('courses', '[]'))
    profile_file = request.files.get('profile')

    users_ref = db.reference('Users')
    teachers_ref = db.reference('Teachers')
    courses_ref = db.reference('Courses')
    assignments_ref = db.reference('TeacherAssignments')

    # ===================== USERNAME CHECK =====================
    all_users = users_ref.get() or {}
    for user in all_users.values():
        if user.get('username') == username:
            return jsonify({
                'success': False,
                'message': 'Username already exists!'
            })

    # ===================== SUBJECT CONFLICT CHECK =====================
    existing_assignments = assignments_ref.get() or {}

    for course in courses:
        grade = course['grade']
        section = course['section']
        subject = course['subject']

        course_id = f"course_{subject.lower()}_{grade}{section.upper()}"

        for assignment in existing_assignments.values():
            if assignment.get('courseId') == course_id:
                return jsonify({
                    'success': False,
                    'message': f'{subject} already assigned in Grade {grade}{section}'
                })

    # ===================== PROFILE UPLOAD =====================
    profile_url = "/default-profile.png"
    if profile_file:
        filename = f"teachers/{username}_{profile_file.filename}"
        blob = bucket.blob(filename)
        blob.upload_from_file(profile_file, content_type=profile_file.content_type)
        blob.make_public()
        profile_url = blob.public_url

    # ===================== CREATE USER =====================
    new_user_ref = users_ref.push()
    user_data = {
        'userId': new_user_ref.key,
        'username': username,
        'name': name,
        'password': password,
        'role': 'teacher',
        'isActive': True,
        'profileImage': profile_url
    }
    new_user_ref.set(user_data)

    # ===================== CREATE TEACHER =====================
    new_teacher_ref = teachers_ref.push()
    new_teacher_ref.set({
        'userId': new_user_ref.key,
        'status': 'active',
        'profileImage': profile_url
    })

    # ===================== ASSIGN COURSES =====================
    for course in courses:
        grade = course['grade']
        section = course['section']
        subject = course['subject']

        course_id = f"course_{subject.lower()}_{grade}{section.upper()}"

        if not courses_ref.child(course_id).get():
            courses_ref.child(course_id).set({
                'name': subject,
                'subject': subject,
                'grade': grade,
                'section': section
            })

        assignments_ref.push().set({
            'teacherId': new_teacher_ref.key,
            'courseId': course_id
        })

    return jsonify({
        'success': True,
        'message': 'Teacher registered successfully!',
        'teacherKey': new_teacher_ref.key,
        'profileImage': profile_url
    })



# ===================== TEACHER LOGIN =====================
@app.route("/api/teacher_login", methods=["POST"])
def teacher_login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"success": False, "message": "Username and password required"}), 400

    users_ref = db.reference("Users")
    teachers_ref = db.reference("Teachers")

    all_users = users_ref.get() or {}
    all_teachers = teachers_ref.get() or {}

    teacher_user = None
    teacher_key = None
    for key, user in all_users.items():
        if user.get("username") == username and user.get("role") == "teacher":
            teacher_user = user
            # Match with Teachers node
            for tkey, tdata in all_teachers.items():
                if tdata.get("userId") == key:
                    teacher_key = tkey
                    break
            break

    if not teacher_user or not teacher_key:
        return jsonify({"success": False, "message": "Teacher not found"}), 404

    if teacher_user.get("password") != password:
        return jsonify({"success": False, "message": "Invalid password"}), 401

    profile_image = all_teachers.get(teacher_key, {}).get("profileImage", "/default-profile.png")

    return jsonify({
        "success": True,
        "teacher": {
            "teacherKey": teacher_key,
            "userId": teacher_user["userId"],
            "name": teacher_user.get("name"),
            "username": teacher_user.get("username"),
            "profileImage": profile_image
        }
    })


# ===================== GET TEACHER COURSES =====================
@app.route('/api/teacher/<teacher_key>/courses', methods=['GET'])
def get_teacher_courses(teacher_key):
    assignments_ref = db.reference('TeacherAssignments')
    courses_ref = db.reference('Courses')

    all_assignments = assignments_ref.get() or {}
    courses_list = []

    for assign in all_assignments.values():
        if assign.get('teacherId') == teacher_key:
            course_id = assign.get('courseId')
            course_data = courses_ref.child(course_id).get()
            if course_data:
                courses_list.append({
                    'courseId': course_id,
                    'subject': course_data.get('subject'),
                    'grade': course_data.get('grade'),
                    'section': course_data.get('section')
                })

    return jsonify({'courses': courses_list})


# ===================== GET TEACHER STUDENTS =====================
@app.route("/api/teacher/<user_id>/students", methods=["GET"])
def get_teacher_students(user_id):
    teachers_ref = db.reference("Teachers")
    assignments_ref = db.reference("TeacherAssignments")
    courses_ref = db.reference("Courses")
    students_ref = db.reference("Students")
    users_ref = db.reference("Users")
    marks_ref = db.reference("ClassMarks")

    # 1️⃣ Get the teacher key from Teachers node using user_id
    teacher_key = None
    all_teachers = teachers_ref.get() or {}
    for key, teacher in all_teachers.items():
        if teacher.get("userId") == user_id:
            teacher_key = key
            break

    if not teacher_key:
        return jsonify({"courses": [], "message": "Teacher not found"})

    # 2️⃣ Get all assignments for this teacher
    all_assignments = assignments_ref.get() or {}
    course_students = []

    for assign in all_assignments.values():
        if assign.get("teacherId") != teacher_key:
            continue

        course_id = assign.get("courseId")
        course_data = courses_ref.child(course_id).get()
        if not course_data:
            continue

        grade = course_data.get("grade")
        section = course_data.get("section")
        subject = course_data.get("subject")

        # 3️⃣ Fetch students in this grade + section
        students_list = []
        all_students = students_ref.get() or {}
        for student_id, student in all_students.items():
            if student.get("grade") == grade and student.get("section") == section:
                user_data = users_ref.child(student.get("userId")).get()
                if not user_data:
                    continue

                # Get marks for this course
                student_marks = marks_ref.child(course_id).child(student_id).get() or {}

                students_list.append({
                    "studentId": student_id,
                    "name": user_data.get("name"),
                    "username": user_data.get("username"),
                    "marks": {
                        "mark20": student_marks.get("mark20", 0),
                        "mark30": student_marks.get("mark30", 0),
                        "mark50": student_marks.get("mark50", 0)
                    }
                })

        course_students.append({
            "subject": subject,
            "grade": grade,
            "section": section,
            "students": students_list
        })

    return jsonify({"courses": course_students})


# ===================== GET STUDENTS OF A COURSE =====================
@app.route('/api/course/<course_id>/students', methods=['GET'])
def get_course_students(course_id):
    courses_ref = db.reference('Courses')
    students_ref = db.reference('Students')
    users_ref = db.reference('Users')
    marks_ref = db.reference('ClassMarks')

    course = courses_ref.child(course_id).get()
    if not course:
        return jsonify({'students': [], 'course': None})

    grade = course.get('grade')
    section = course.get('section')

    all_students = students_ref.get() or {}
    all_users = users_ref.get() or {}
    course_students = []

    for student_id, student in all_students.items():
        if student.get('grade') == grade and student.get('section') == section:
            user_data = all_users.get(student.get('userId'))
            if user_data:
                student_marks = marks_ref.child(course_id).child(student_id).get() or {}
                course_students.append({
                    'studentId': student_id,
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
    marks_ref = db.reference('ClassMarks')

    for update in updates:
        student_id = update.get('studentId')
        marks = update.get('marks', {})
        marks_ref.child(course_id).child(student_id).set({
            'mark20': marks.get('mark20', 0),
            'mark30': marks.get('mark30', 0),
            'mark50': marks.get('mark50', 0)
        })

    return jsonify({'success': True, 'message': 'Marks updated successfully!'})


# ===================== GET POSTS =====================
@app.route("/api/get_posts", methods=["GET"])
def get_posts():
    posts_ref = db.reference("Posts")
    admins_ref = db.reference("School_Admins")

    all_posts = posts_ref.get() or {}
    result = []

    for post_id, post in all_posts.items():
        admin_id = post.get("adminId")
        admin = admins_ref.child(admin_id).get() or {}
        result.append({
            "postId": post_id,
            "adminId": admin_id,
            "adminName": admin.get("name", "Admin"),
            "adminProfile": admin.get("profileImage", "/default-profile.png"),
            "message": post.get("message", ""),
            "postUrl": post.get("postUrl"),
            "timestamp": post.get("time", ""),
            "likeCount": post.get("likeCount", 0),
            "likes": post.get("likes", {})
        })

    result.sort(key=lambda x: x["timestamp"], reverse=True)
    return jsonify(result)


# ===================== PARENT REGISTRATION =====================
@app.route('/register/parent', methods=['POST'])
def register_parent():
    name = request.form.get('name')
    username = request.form.get('username')
    phone = request.form.get('phone')
    password = request.form.get('password')
    profile_file = request.files.get('profile')

    # 🔴 Get multiple children
    student_ids = request.form.getlist('studentId')
    relationships = request.form.getlist('relationship')

    # 🔴 Validation
    if not all([name, username, phone, password]) or not student_ids or not relationships:
        return jsonify({
            "success": False,
            "message": "All fields except profile photo are required"
        }), 400

    if len(student_ids) != len(relationships):
        return jsonify({
            "success": False,
            "message": "Each student must have a relationship defined"
        }), 400

    users_ref = db.reference('Users')
    parents_ref = db.reference('Parents')
    students_ref = db.reference('Students')

    # 🔴 Check username uniqueness
    all_users = users_ref.get() or {}
    for user in all_users.values():
        if user.get("username") == username:
            return jsonify({
                "success": False,
                "message": "Username already exists"
            })

    # 🖼 Upload profile image (optional)
    profile_url = "/default-profile.png"
    if profile_file:
        filename = f"parents/{username}_{profile_file.filename}"
        blob = bucket.blob(filename)
        blob.upload_from_file(profile_file, content_type=profile_file.content_type)
        blob.make_public()
        profile_url = blob.public_url

    # 👤 Create Parent User
    new_user_ref = users_ref.push()
    parent_user_id = new_user_ref.key
    new_user_ref.set({
        "userId": parent_user_id,
        "username": username,
        "phone": phone,
        "name": name,
        "password": password,  # ⚠ hash later
        "role": "parent",
        "profileImage": profile_url,
        "isActive": True
    })

    # 👨‍👩‍👧 Create Parent node for each child
    for sid, rel in zip(student_ids, relationships):
        student_data = students_ref.child(sid).get()
        if not student_data:
            continue  # skip invalid studentId

        student_user_id = student_data.get('userId')
        parents_ref.child(parent_user_id).push({
            "userId": student_user_id,  # Student's Users.userId
            "studentId": sid,           # Student's Students key
            "relationship": rel
        })

    return jsonify({
        "success": True,
        "message": "Parent registered successfully",
        "parentUserId": parent_user_id
    })



# like teacher

@app.route("/api/like_post", methods=["POST"])
def like_post():
    data = request.json
    postId = data.get("postId")
    teacherId = data.get("teacherId")

    posts_ref = db.reference("Posts")
    post = posts_ref.child(postId).get()

    if not post:
        return jsonify({"error": "Post not found"}), 404

    likes = post.get("likes", {})

    if teacherId in likes:
        # Teacher already liked → unlike
        likes.pop(teacherId)
    else:
        # Add like
        likes[teacherId] = True

    posts_ref.child(postId).update({
        "likes": likes,
        "likeCount": len(likes)
    })

    return jsonify({"success": True, "likeCount": len(likes), "liked": teacherId in likes})






# ===================== RUN APP =====================
if __name__ == '__main__':
    app.run(debug=True)
