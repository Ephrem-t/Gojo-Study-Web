from flask import Flask, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db, storage
import os
from werkzeug.utils import secure_filename
import uuid
from datetime import datetime
import sys

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173"], supports_credentials=True)

# ---------------- FIREBASE ---------------- #
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

# ---------------- REFERENCES ---------------- #
school_admin_ref = db.reference("School_Admins")
users_ref = db.reference("Users")
posts_ref = db.reference("Posts")
chats_ref = db.reference("Chats")  # Chats node for messages

# ---------------- FILE UPLOAD ---------------- #
def upload_file_to_firebase(file, folder=""):
    try:
        filename = secure_filename(file.filename)
        unique_name = f"{folder}/{uuid.uuid4().hex}_{filename}"
        blob = bucket.blob(unique_name)
        blob.upload_from_file(file, content_type=file.content_type)
        blob.make_public()
        return blob.public_url
    except Exception as e:
        print("Upload Error:", e)
        return ""

# ---------------- REGISTER ADMIN ---------------- #
@app.route("/api/register", methods=["POST"])
def register_admin():
    try:
        data = request.form
        username = data.get("username")
        name = data.get("name")
        password = data.get("password")
        profile = request.files.get("profile")

        # Check if username exists
        all_users = users_ref.get() or {}
        for u in all_users.values():
            if u.get("username") == username:
                return jsonify({"success": False, "message": "Username already taken!"})

        profile_url = upload_file_to_firebase(profile, folder="profiles") if profile else ""

        # Create new user
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

        # Create admin record
        new_admin = school_admin_ref.push()
        new_admin.set({
            "adminId": new_admin.key,
            "userId": new_user.key,
            "username": username,
            "password": password,
            "name": name,
        })

        return jsonify({"success": True, "message": "Registration successful!"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# ---------------- LOGIN ADMIN ---------------- #
@app.route("/api/login", methods=["POST"])
def login_admin():
    try:
        data = request.get_json(force=True)
        username = data.get("username")
        password = data.get("password")

        users = users_ref.get() or {}
        matched_user = None
        for user in users.values():
            if user.get("username") == username and user.get("password") == password:
                matched_user = user
                break

        if not matched_user:
            return jsonify({"success": False, "message": "Invalid username or password"})

        admins = school_admin_ref.get() or {}
        for admin in admins.values():
            if admin.get("userId") == matched_user.get("userId"):
                return jsonify({
                    "success": True,
                    "message": "Login success",
                    "adminId": admin.get("adminId"),
                    "userId": matched_user.get("userId"),
                    "name": matched_user.get("name"),
                    "username": matched_user.get("username"),
                    "profileImage": matched_user.get("profileImage", "")
                })

        return jsonify({"success": False, "message": "Not registered as admin"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# ---------------- CREATE POST ---------------- #
@app.route("/api/create_post", methods=["POST"])
def create_post():
    try:
        data = request.form
        text = data.get("message", "")
        adminId = data.get("adminId")
        media_file = request.files.get("post_media")

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

# ---------------- GET ALL POSTS ---------------- #
@app.route("/api/get_posts", methods=["GET"])
def get_posts():
    all_posts = posts_ref.get() or {}
    post_list = []

    for key, post in all_posts.items():
        user_data = users_ref.child(post.get("adminId")).get() or {}
        post_list.append({
            "postId": key,
            "message": post.get("message"),
            "postUrl": post.get("postUrl"),
            "adminId": post.get("adminId"),
            "adminName": post.get("adminName") or user_data.get("name", "Admin"),
            "adminProfile": post.get("adminProfile") or user_data.get("profileImage", "/default-profile.png"),
            "time": post.get("time"),
            "likes": post.get("likes", {}),
            "likeCount": post.get("likeCount", 0)
        })

    post_list.reverse()
    return jsonify(post_list)

# ---------------- ADMIN PROFILE ---------------- #
@app.route("/api/admin/<adminId>", methods=["GET"])
def fetch_admin_profile(adminId):
    admin_data = school_admin_ref.child(adminId).get()
    if not admin_data:
        return jsonify({"success": False, "message": "Admin not found"}), 404
    user_data = users_ref.child(admin_data["userId"]).get() or {}
    profile = {
        "adminId": adminId,
        "name": user_data.get("name"),
        "username": user_data.get("username"),
        "profileImage": user_data.get("profileImage", "/default-profile.png")
    }
    return jsonify({"success": True, "admin": profile})

# ---------------- GET MY POSTS ---------------- #
@app.route("/api/get_my_posts/<adminId>", methods=["GET"])
def get_my_posts(adminId):
    all_posts = posts_ref.get() or {}
    my_posts = []

    for key, post in all_posts.items():
        post_admin_id = post.get("adminId") or post.get("userId")
        if post_admin_id == adminId:
            my_posts.append({
                "postId": key,
                "message": post.get("message"),
                "postUrl": post.get("postUrl"),
                "time": post.get("time") or post.get("updatedAt"),
                "edited": post.get("edited", False)
            })

    my_posts.reverse()
    return jsonify(my_posts)

# ---------------- EDIT POST ---------------- #
@app.route("/api/edit_post/<postId>", methods=["POST"])
def edit_post(postId):
    data = request.get_json(force=True)
    adminId = data.get("adminId")
    new_text = data.get("postText", "")

    post_ref = posts_ref.child(postId)
    post_data = post_ref.get()
    if not post_data:
        return jsonify({"success": False, "message": "Post not found"}), 404
    if post_data["adminId"] != adminId:
        return jsonify({"success": False, "message": "Unauthorized"}), 403

    post_ref.update({
        "message": new_text,
        "updatedAt": datetime.now().strftime("%I:%M %p, %b %d %Y"),
        "edited": True
    })
    return jsonify({"success": True, "message": "Post updated"})

# ---------------- DELETE POST ---------------- #
@app.route("/api/delete_post/<postId>", methods=["DELETE"])
def delete_post(postId):
    data = request.get_json(force=True)
    adminId = data.get("adminId")
    post_ref = posts_ref.child(postId)
    post_data = post_ref.get()
    if not post_data:
        return jsonify({"success": False, "message": "Post not found"}), 404
    if post_data["adminId"] != adminId:
        return jsonify({"success": False, "message": "Unauthorized"}), 403
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

# ---------------- CHAT ENDPOINTS ---------------- #

# Send a message
@app.route("/api/send_message", methods=["POST"])
def send_message():
    try:
        data = request.get_json(force=True)
        senderId = data.get("senderId")
        receiverId = data.get("receiverId")
        message = data.get("message")

        if not senderId or not receiverId or not message:
            return jsonify({"success": False, "message": "Invalid data"}), 400

        msg_ref = chats_ref.push()
        msg_ref.set({
            "messageId": msg_ref.key,
            "senderId": senderId,
            "receiverId": receiverId,
            "message": message,
            "time": datetime.now().isoformat(),
            "read": False
        })
        return jsonify({"success": True, "message": "Message sent"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

# Get chat between two users
@app.route("/api/chat/<adminId>/<userId>", methods=["GET"])
def get_chat(adminId, userId):
    all_msgs = chats_ref.get() or {}
    chat = [msg for key, msg in all_msgs.items()
            if (msg.get("senderId") in [adminId, userId]) and
               (msg.get("receiverId") in [adminId, userId])]
    chat_sorted = sorted(chat, key=lambda x: x['time'])
    return jsonify(chat_sorted)

# Mark messages as read
@app.route("/api/mark_messages_read", methods=["POST"])
def mark_messages_read():
    data = request.get_json(force=True)
    adminId = data.get("adminId")
    senderId = data.get("senderId")
    all_msgs = chats_ref.get() or {}

    for key, msg in all_msgs.items():
        if msg.get("receiverId") == adminId and msg.get("senderId") == senderId:
            chats_ref.child(key).update({"read": True})

    return jsonify({"success": True})

# Get unread messages for admin
@app.route("/api/unread_messages/<adminId>", methods=["GET"])
def get_unread_messages(adminId):
    all_msgs = chats_ref.get() or {}
    unread_msgs = [msg for key, msg in all_msgs.items()
                   if msg.get("receiverId") == adminId and not msg.get("read", False)]
    return jsonify({"count": len(unread_msgs), "messages": unread_msgs})

# ---------------- RUN ---------------- #
if __name__ == "__main__":
    app.run(debug=True)
