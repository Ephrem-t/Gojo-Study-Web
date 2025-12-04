from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db, storage
import os
from werkzeug.utils import secure_filename
import uuid
from datetime import datetime
import sys

app = Flask(__name__)
CORS(app)

# ---------------- FIREBASE ---------------- #
firebase_json = "ethiostore-17d9f-firebase-adminsdk-5e87k-8a0ddc11b3.json"
if not os.path.exists(firebase_json):
    print("Firebase JSON missing")
    sys.exit()

cred = credentials.Certificate(firebase_json)
firebase_admin.initialize_app(cred, {
    "databaseURL": "https://ethiostore-17d9f-default-rtdb.firebaseio.com/",
    "storageBucket": "ethiostore-17d9f.appspot.com"
})
bucket = storage.bucket()

# ---------------- REFERENCES ---------------- #
school_admin_ref = db.reference("School_Admins")
users_ref = db.reference("Users")
posts_ref = db.reference("Posts")

# ---------------- FILE UPLOAD ---------------- #
def upload_file_to_firebase(file, folder=""):
    try:
        filename = secure_filename(file.filename)
        unique_name = f"{folder}/{uuid.uuid4().hex}_{filename}"
        blob = bucket.blob(unique_name)
        blob.upload_from_file(file, content_type=file.content_type)
        blob.make_public()
        return blob.public_url
    except:
        return ""

# ---------------- ROUTES ---------------- #
@app.route("/")
def root():
    return render_template("school_admin_register.html")

@app.route("/login")
def login():
    return render_template("school_admin_login.html")

@app.route("/dashboard")
def dashboard():
    return render_template("school_admin_dashboard.html")

# ---------------- REGISTER ADMIN ---------------- #
@app.route("/api/register", methods=["POST"])
def register_admin():
    data = request.form
    username = data.get("username")
    name = data.get("name")
    password = data.get("password")
    profile = request.files.get("profile")

    all_users = users_ref.get() or {}
    for u in all_users.values():
        if u.get("username") == username:
            return jsonify({"success": False, "message": "Username already taken!"})

    profile_url = ""
    if profile:
        profile_url = upload_file_to_firebase(profile, "profiles")

    new_user = users_ref.push()
    new_user.set({
        "userId": new_user.key,
        "name": name,
        "username": username,
        "password": password,
        "profileImage": profile_url,
        "role": "school_admin",
        "isActive": True
    })

    new_admin = school_admin_ref.push()
    new_admin.set({
        "adminId": new_admin.key,
        "userId": new_user.key,
        "username": username,
        "password": password,
        "name": name,
    })

    return jsonify({"success": True, "message": "Registration successful!"})

# ---------------- LOGIN ADMIN ---------------- #
@app.route("/api/login", methods=["POST"])
def login_admin():
    data = request.get_json(force=True)
    username = data.get("username")
    password = data.get("password")

    users = users_ref.get() or {}
    matched_user = None
    for user_id, user in users.items():
        if user.get("username") == username and user.get("password") == password:
            matched_user = user
            break

    if not matched_user:
        return jsonify({"success": False, "message": "Invalid username or password"})

    admins = school_admin_ref.get() or {}
    for admin_id, admin in admins.items():
        if admin.get("userId") == matched_user.get("userId"):
            return jsonify({
                "success": True,
                "message": "Login success",
                "adminId": admin_id
            })

    return jsonify({"success": False, "message": "Not registered as admin"})

# ---------------- CREATE POST ---------------- #
@app.route("/api/create_post", methods=["POST"])
def create_post():
    try:
        # Get data from form
        text = request.form.get("text", "")
        adminId = request.form.get("adminId")
        media_file = request.files.get("post_media")  # <-- Make sure JS uses this name

        if not adminId:
            return jsonify({"success": False, "message": "Admin not logged in"})

        post_url = ""
        if media_file:
            post_url = upload_file_to_firebase(media_file, folder="posts")

        post_ref = posts_ref.push()
        time_now = datetime.now().strftime("%I:%M %p, %b %d %Y")
        post_ref.set({
            "postId": post_ref.key,
            "message": text,
            "postUrl": post_url,
            "adminId": adminId,
            "time": time_now,
            "likeCount": 0,
            "likes": {}
        })

        return jsonify({"success": True, "message": "Post created successfully"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

@app.route("/api/get_admin_name")
def get_admin_name():
    adminId = request.args.get("adminId")
    if not adminId:
        return jsonify({"success": False})
    admin = school_admin_ref.child(adminId).get()
    if not admin:
        return jsonify({"success": False})
    return jsonify({"success": True, "name": admin.get("name", "Admin")})


# GET posts by admin (for profile page)
@app.route("/api/posts", methods=["GET"])
def get_posts():
    all_posts = posts_ref.get() or {}
    posts_list = []

    for post_id, post in all_posts.items():
        adminId = post.get("adminId")
        admin_data = school_admin_ref.child(adminId).get()
        user_data = users_ref.child(admin_data.get("userId")).get() if admin_data else {}

        posts_list.append({
            **post,
            "postId": post_id,
            "adminName": user_data.get("name", "Admin"),
            "adminProfile": user_data.get("profileImage", "")
        })

    posts_list.sort(key=lambda x: x.get("time", ""), reverse=True)
    return jsonify(posts_list)



@app.route("/api/admin_posts")
def admin_posts():
    adminId = request.args.get("adminId")
    all_posts = posts_ref.get() or {}
    posts_list = []

    for post in all_posts.values():
        if post["adminId"] == adminId:
            posts_list.append(post)

    posts_list.sort(key=lambda x: x.get("time", ""), reverse=True)
    return jsonify(posts_list)



# ---------------- ADMIN PROFILE PAGE ---------------- #
@app.route("/profile/<adminId>")
def admin_profile(adminId):
    admin_data = school_admin_ref.child(adminId).get()
    if not admin_data:
        return "Admin not found", 404

    userId = admin_data.get("userId")
    user_info = users_ref.child(userId).get() or {}
    fullName = user_info.get("name", "Admin")
    profileUrl = user_info.get("profileImage", "")

    # Get admin posts
    all_posts = posts_ref.get() or {}
    admin_posts = [
        {**p, "postId": key}
        for key, p in all_posts.items()
        if p.get("adminId") == adminId
    ]
    admin_posts.sort(key=lambda x: x.get("time",""), reverse=True)

    return render_template("school_admin_profile.html",
                           adminId=adminId,
                           fullName=fullName,
                           profileUrl=profileUrl,
                           posts=admin_posts)


@app.route('/profile/<adminId>')
def profile(adminId):
    # Get admin info
    admin_data = school_admin_ref.child(adminId).get()
    if not admin_data:
        return "Admin not found", 404

    user_data = users_ref.child(admin_data["userId"]).get()
    if not user_data:
        return "User not found", 404

    # Get all posts of this admin
    all_posts = posts_ref.get() or {}
    admin_posts = []
    for key, post in all_posts.items():
        if post.get("adminId") == adminId:
            post["postId"] = key
            post["adminName"] = admin_data.get("name")  # show admin name without storing in DB
            admin_posts.append(post)

    # Render profile template
    return render_template(
        "school_admin_profile.html",
        adminId=adminId,
        fullName=user_data.get("name"),
        profileUrl=user_data.get("profileImage"),
        posts=admin_posts
    )
@app.route('/edit_post/<postId>', methods=['POST'])
def edit_post(postId):
    data = request.get_json()
    adminId = data.get("adminId")
    new_text = data.get("postText", "")

    post_ref = posts_ref.child(postId)
    post_data = post_ref.get()

    if not post_data:
        return jsonify({"error": "Post not found"}), 404

    if post_data["adminId"] != adminId:
        return jsonify({"error": "Unauthorized"}), 403

    post_ref.update({
        "message": new_text,
        "updatedAt": datetime.now().strftime("%I:%M %p, %b %d %Y"),
        "edited": True
    })

    return jsonify({"success": True, "message": "Post updated"})



@app.route('/delete_post/<postId>', methods=['DELETE'])
def delete_post(postId):
    data = request.get_json()
    adminId = data.get("adminId")

    post_ref = posts_ref.child(postId)
    post_data = post_ref.get()

    if not post_data:
        return jsonify({"error": "Post not found"}), 404

    if post_data["adminId"] != adminId:
        return jsonify({"error": "Unauthorized"}), 403

    post_ref.delete()
    return jsonify({"success": True, "message": "Post deleted"})

# ---------------- LIKE POST ---------------- #
@app.route("/api/like_post", methods=["POST"])
def like_post():
    try:
        data = request.get_json(force=True)
        postId = data.get("postId")
        adminId = data.get("adminId")

        if not postId or not adminId:
            return jsonify({"success": False, "message": "Invalid data"})

        post_ref = posts_ref.child(postId)
        likes_ref = post_ref.child("likes")
        current_like = likes_ref.child(adminId).get()

        if current_like:
            likes_ref.child(adminId).delete()
        else:
            likes_ref.child(adminId).set(True)

        likes = likes_ref.get() or {}
        post_ref.update({"likeCount": len(likes)})

        return jsonify({"success": True, "likeCount": len(likes), "liked": not current_like})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

# ---------------- MAIN ---------------- #
if __name__ == "__main__":
    app.run(debug=True)
