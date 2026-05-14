import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import "../styles/global.css";
import { storage } from "../firebase.js";
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { AiFillPicture, AiFillVideoCamera } from "react-icons/ai";
import { FaBell, FaFacebookMessenger, FaHeart, FaRegHeart } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { BACKEND_BASE } from "../config.js";
import useTopbarNotifications from "../hooks/useTopbarNotifications";
import { formatFileSize, optimizePostMedia } from "../utils/postMedia";
import { invalidateScopedPosts, loadScopedPosts } from "../utils/postData";

function Dashboard() {
  const API_BASE = `${BACKEND_BASE}/api`;
  const DB_URL = "https://gojo-education-default-rtdb.firebaseio.com";
  // ---------------- STATE ----------------
  const _storedFinance = (() => {
    try {
      return JSON.parse(localStorage.getItem("finance") || localStorage.getItem("admin")) || {};
    } catch (e) {
      return {};
    }
  })();

  const [finance, setFinance] = useState({
    financeId: _storedFinance.financeId || _storedFinance.adminId || "",
    userId: _storedFinance.userId || "",
    schoolCode: _storedFinance.schoolCode || "",
    name: _storedFinance.name || _storedFinance.username || "Finance",
    username: _storedFinance.username || "",
    profileImage: _storedFinance.profileImage || "/default-profile.png",
    isActive: _storedFinance.isActive || false,
  });

  const schoolCode = finance.schoolCode || _storedFinance.schoolCode || "";
  const DB_ROOT = schoolCode ? `${DB_URL}/Platform1/Schools/${schoolCode}` : DB_URL;

  // Compatibility alias: older code refers to `admin` — map `finance` fields to `admin`
  const admin = {
    adminId: finance.financeId || finance.adminId || "",
    userId: finance.userId || "",
    name: finance.name || finance.username || "Finance",
    profileImage: finance.profileImage || "/default-profile.png",
    isActive: finance.isActive || false,
  };

  const [posts, setPosts] = useState([]);
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState(null);
  const [postMediaMeta, setPostMediaMeta] = useState(null);
  const [isOptimizingMedia, setIsOptimizingMedia] = useState(false);
  const fileInputRef = useRef(null);
  // All unread messages from any sender type
  // Correct order
  const location = useLocation();
  const scrollToPostId = location.state?.scrollToPostId;
  const postIdToScroll = location.state?.postId;
  const postId = location.state?.postId;
  const [loadingAdmin, setLoadingAdmin] = useState(true);

  const financeUserId = finance.userId;
  const [showPostDropdown, setShowPostDropdown] = useState(false);
  const {
    unreadSenders,
    setUnreadSenders,
    unreadPosts: unreadPostList,
    setUnreadPosts: setUnreadPostList,
    messageCount,
    totalNotifications,
    markMessagesAsSeen,
    markPostAsSeen,
  } = useTopbarNotifications({
    dbRoot: DB_ROOT,
    currentUserId: admin.userId,
  });

  const navigate = useNavigate();
  const summaryCards = [
    {
      label: "Unread alerts",
      value: totalNotifications,
      note: `${unreadPostList.length || 0} posts and ${messageCount || 0} messages`,
    },
    {
      label: "Published posts",
      value: posts.length,
      note: "Visible in the school finance feed",
    },
    {
      label: "School code",
      value: schoolCode || "Not set",
      note: "Current finance workspace scope",
    },
  ];

  const recentFeedPreview = posts.slice(0, 3);

  useEffect(() => {
    if (postId) {
      const element = document.getElementById(`post-${postId}`);
      if (element) element.scrollIntoView({ behavior: "smooth" });
    }
  }, [postId]);

  // ---------------- HELPER: LOAD ADMIN FROM LOCALSTORAGE ----------------
  const loadFinanceFromStorage = async () => {
    const stored = localStorage.getItem("finance") || localStorage.getItem("admin");

    if (!stored) {
      setLoadingAdmin(false);
      return;
    }

    try {
      const financeData = JSON.parse(stored) || {};

      const financeKey = financeData.financeId || financeData.adminId || financeData.id || financeData.uid || "";
      const possibleUserId = financeData.userId || financeData.user_id || financeData.uid || financeData.user || "";

      // If financeKey exists try Finance -> School_Admins
      if (financeKey) {
        let res = null;
        try {
          res = (await axios.get(`${DB_ROOT}/Finance/${financeKey}.json`)) || null;
        } catch (err) {
          res = null;
        }

        if (!res || !res.data) {
          try {
            res = (await axios.get(`${DB_ROOT}/School_Admins/${financeKey}.json`)) || null;
          } catch (err) {
            res = null;
          }
        }

        if (res && res.data) {
          const node = res.data;
          const userId = node.userId || node.user_id || possibleUserId || "";
          if (userId) {
            try {
              const userRes = await axios.get(`${DB_ROOT}/Users/${userId}.json`);
              setFinance({
                financeId: financeKey,
                userId,
                schoolCode: financeData.schoolCode || "",
                name: userRes.data?.name || node.name || financeData.name || "Finance",
                username: userRes.data?.username || financeData.username || "",
                profileImage: userRes.data?.profileImage || node.profileImage || financeData.profileImage || "/default-profile.png",
                isActive: node.isActive || financeData.isActive || false,
              });
            } catch (err) {
              setFinance({
                financeId: financeKey,
                userId,
                schoolCode: financeData.schoolCode || "",
                name: node.name || financeData.name || "Finance",
                username: node.username || financeData.username || "",
                profileImage: node.profileImage || financeData.profileImage || "/default-profile.png",
                isActive: node.isActive || financeData.isActive || false,
              });
            }
            setLoadingAdmin(false);
            return;
          }

          // node exists but no linked userId: use node fields
          setFinance({
            financeId: financeKey,
            userId: "",
            schoolCode: financeData.schoolCode || "",
            name: node.name || financeData.name || "Finance",
            username: node.username || financeData.username || "",
            profileImage: node.profileImage || financeData.profileImage || "/default-profile.png",
            isActive: node.isActive || financeData.isActive || false,
          });
          setLoadingAdmin(false);
          return;
        }
      }

      // If we don't have financeKey but have a userId, try Users
      if (possibleUserId) {
        try {
          const userRes = await axios.get(`${DB_ROOT}/Users/${possibleUserId}.json`);
          setFinance({
            financeId: financeData.financeId || financeData.adminId || "",
            userId: possibleUserId,
            schoolCode: financeData.schoolCode || "",
            name: userRes.data?.name || financeData.name || "Finance",
            username: userRes.data?.username || financeData.username || "",
            profileImage: userRes.data?.profileImage || financeData.profileImage || "/default-profile.png",
            isActive: financeData.isActive || false,
          });
          setLoadingAdmin(false);
          return;
        } catch (err) {
          // ignore and fallback
        }
      }

      // Fallback: use stored fields without clearing storage (prevents redirect on reload)
      setFinance({
        financeId: financeData.financeId || financeData.adminId || "",
        userId: financeData.userId || "",
        schoolCode: financeData.schoolCode || "",
        name: financeData.name || financeData.username || "Finance",
        username: financeData.username || "",
        profileImage: financeData.profileImage || "/default-profile.png",
        isActive: financeData.isActive || false,
      });
    } catch (e) {
      // parsing failed: clear corrupted storage
      try {
        localStorage.removeItem("finance");
        localStorage.removeItem("admin");
      } catch (err) {}
    }

    setLoadingAdmin(false);
  };

  const handleOpenChat = (user, userType) => {
    navigate("/all-chat", {
      state: {
        userType,           // "teacher" or "student"
        studentId: user?.id, // for student chat
        teacher: user,       // for teacher chat
      },
    });
  };

  // ---------------- FETCH POSTS ----------------
  const fetchPosts = async ({ force = false } = {}) => {
    try {
      const nextPosts = await loadScopedPosts({ schoolCode, force });
      setPosts(
        nextPosts.map((post) => ({
          ...post,
          adminProfile:
            post.adminProfile ||
            post.adminProfileImage ||
            post.profileImage ||
            "/default-profile.png",
        }))
      );
    } catch (err) {
      console.error("Error fetching posts:", err);
    }
  };

  // ---------------- OPEN POST FROM NOTIFICATION ----------------
  const openPostFromNotif = async (post) => {
    setShowPostDropdown(false);

    try {
      await markPostAsSeen(post.postId);

      // Update post as seen in main feed
      setPosts(prev =>
        prev.map(p =>
          p.postId === post.postId
            ? {
                ...p,
                seenBy: {
                  ...(p.seenBy || {}),
                  [admin.userId]: true
                }
              }
            : p
        )
      );

      // Scroll + highlight
      setTimeout(() => {
        const el = document.getElementById(`post-${post.postId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.style.backgroundColor = "#fff9c4";
          setTimeout(() => (el.style.backgroundColor = ""), 1500);
        }
      }, 200);

    } catch (err) {
      console.error("Error opening post notification:", err);
    }
  };

  useEffect(() => {
    if (postIdToScroll) {
      const element = document.getElementById(`post-${postIdToScroll}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
        element.style.backgroundColor = "#ffffe0"; // optional highlight
        setTimeout(() => (element.style.backgroundColor = ""), 2000);
      }
    }
  }, [postIdToScroll]);

  // ---------------- CLOSE DROPDOWN ON OUTSIDE CLICK ----------------
  useEffect(() => {
    const close = (e) => {
      if (
        !e.target.closest(".icon-circle") &&
        !e.target.closest(".notification-dropdown")
      ) {
        setShowPostDropdown(false);
      }
    };

    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  // ---------------- EFFECT ON MOUNT ----------------
  useEffect(() => {
    loadFinanceFromStorage();
    fetchPosts({ force: false });
  }, []);

  // Add this effect to monitor admin state changes
  useEffect(() => {
    if (loadingAdmin) return;

    if (!admin.userId && !admin.adminId) {
      console.log("No admin found, redirecting to login");
      navigate("/login", { replace: true });
    }
  }, [loadingAdmin, admin.userId, admin.adminId]);

  const handlePostMediaSelection = async (event) => {
    const file = event.target.files && event.target.files[0];

    if (!file) {
      setPostMedia(null);
      setPostMediaMeta(null);
      return;
    }

    setIsOptimizingMedia(true);

    try {
      const optimizedResult = await optimizePostMedia(file);
      setPostMedia(optimizedResult.file);
      setPostMediaMeta({
        originalSize: optimizedResult.originalSize,
        finalSize: optimizedResult.finalSize,
        wasCompressed: optimizedResult.wasCompressed,
        wasConvertedToJpeg: optimizedResult.wasConvertedToJpeg,
      });
    } catch (error) {
      console.error("Failed to optimize media:", error);
      setPostMedia(file);
      setPostMediaMeta({
        originalSize: Number(file.size || 0),
        finalSize: Number(file.size || 0),
        wasCompressed: false,
        wasConvertedToJpeg: false,
      });
    } finally {
      setIsOptimizingMedia(false);
    }
  };

  const handleOpenPostMediaPicker = () => {
    if (isOptimizingMedia) return;
    fileInputRef.current?.click();
  };

  const canSubmitPost = Boolean(postText.trim() || postMedia) && !isOptimizingMedia;

  const handlePost = async () => {
    if (!canSubmitPost) return;

    if (!admin.adminId || !admin.userId) {
      alert("Session expired");
      return;
    }

    // If a media file is selected, upload it to Firebase Storage and get a download URL
    let postUrl = "";
    try {
      if (postMedia) {
        const path = `posts/${Date.now()}_${postMedia.name.replace(/[^a-zA-Z0-9.\-_/]/g, "_")}`;
        const storageRef = sRef(storage, path);
        // upload as blob/file
        await uploadBytes(storageRef, postMedia);
        postUrl = await getDownloadURL(storageRef);
      }
    } catch (err) {
      console.error("Failed to upload media to Firebase Storage:", err);
      // proceed without media URL
    }

    const formData = new FormData();
    formData.append("message", postText);
    formData.append("postUrl", postUrl);

    // keep old admin fields for compatibility
    formData.append("adminId", admin.adminId); // ownership
    formData.append("userId", admin.userId);   // display & likes
    formData.append("adminName", admin.name);
    formData.append("adminProfile", admin.profileImage);

    // new finance fields (for Finance schema)
    formData.append("financeId", admin.adminId || "");
    formData.append("financeName", admin.name || "");
    formData.append("financeProfile", admin.profileImage || "");
    formData.append("schoolCode", schoolCode || "");

    await axios.post(`${API_BASE}/create_post`, formData);

    setPostText("");
    setPostMedia(null);
    setPostMediaMeta(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    invalidateScopedPosts(schoolCode);
    fetchPosts({ force: true });
  };

  // ---------------- HANDLE LIKE ----------------
  const handleLike = async (postId) => {
    try {
      const likerId = admin.userId || admin.adminId;
      if (!likerId) {
        return;
      }

      // ✅ Use full backend URL
      const res = await axios.post(`${API_BASE}/like_post`, {
        postId,
        adminId: likerId,
        schoolCode,
      });

      if (res.data.success) {
        const liked = res.data.liked; // boolean returned by backend
        const likeCount = res.data.likeCount; // number returned by backend

        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.postId !== postId
              ? post
              : (() => {
                  const nextLikes = { ...(post.likes || {}) };
                  if (liked) {
                    nextLikes[likerId] = true;
                  } else {
                    delete nextLikes[likerId];
                  }

                  return {
                    ...post,
                    likeCount,
                    likes: nextLikes,
                  };
                })()
          )
        );
      }
    } catch (err) {
      console.error("Error liking post:", err);
    }
  };

  // ---------------- HANDLE DELETE ----------------
  const handleDelete = async (postId) => {
    try {
      await axios.delete(`${API_BASE}/delete_post/${postId}`, {
       data: { adminId: admin.adminId },
      });
      invalidateScopedPosts(schoolCode);
      fetchPosts({ force: true });
    } catch (err) {
      console.error("Error deleting post:", err);
    }
  };

  // ---------------- HANDLE EDIT ----------------
  const handleEdit = async (postId, currentText) => {
    const newText = prompt("Edit your post:", currentText);
    if (!newText) return;
    try {
      await axios.post(`${API_BASE}/edit_post/${postId}`, {
       adminId: admin.adminId,
        postText: newText,
      });
      invalidateScopedPosts(schoolCode);
      fetchPosts({ force: true });
    } catch (err) {
      console.error("Error editing post:", err);
    }
  };

  const totalPostsToday = posts.filter((post) => {
    const timestamp = post.time ? new Date(post.time) : null;
    if (!timestamp || Number.isNaN(timestamp.getTime())) return false;

    const now = new Date();
    return (
      timestamp.getDate() === now.getDate() &&
      timestamp.getMonth() === now.getMonth() &&
      timestamp.getFullYear() === now.getFullYear()
    );
  }).length;

  const recentContacts = Object.entries(unreadSenders || {})
    .map(([userId, sender]) => ({
      userId,
      name: sender?.name || "User",
      profileImage: sender?.profileImage || "/default-profile.png",
      unreadCount: Number(sender?.count || 0),
      type: sender?.type || "user",
    }))
    .slice(0, 4);

  const softPanelStyle = {
    background: "#F8FAFC",
    border: "1px solid rgba(15, 23, 42, 0.06)",
    borderRadius: 10,
  };
  const rightRailCardStyle = {
    background: "var(--surface-panel)",
    borderRadius: 12,
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08), 0 8px 20px rgba(15, 23, 42, 0.04)",
    border: "1px solid rgba(15, 23, 42, 0.08)",
  };
  const widgetCardStyle = {
    ...rightRailCardStyle,
    padding: "12px",
  };
  const smallStatStyle = {
    padding: "10px 12px",
    borderRadius: 10,
    background: "#F8FAFC",
    border: "1px solid rgba(15, 23, 42, 0.06)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    minWidth: 84,
  };
  const FEED_SECTION_STYLE = {
    width: "100%",
    maxWidth: 680,
  };
  const shellCardStyle = {
    background: "var(--surface-panel)",
    border: "1px solid var(--border-soft)",
    boxShadow: "var(--shadow-soft)",
  };

  // ---------------- RENDER ----------------
  return (
    <div
      className="dashboard-page"
      style={{
        background: "#FFFFFF",
        minHeight: "100vh",
        height: "auto",
        overflowX: "hidden",
        overflowY: "auto",
        color: "#0f172a",
        "--surface-panel": "#FFFFFF",
        "--surface-accent": "#F1F8FF",
        "--surface-muted": "#F7FBFF",
        "--surface-strong": "#DCEBFF",
        "--page-bg": "#FFFFFF",
        "--border-soft": "#D7E7FB",
        "--border-strong": "#B5D2F8",
        "--text-primary": "#0f172a",
        "--text-secondary": "#334155",
        "--text-muted": "#64748b",
        "--accent": "#007AFB",
        "--accent-soft": "#E7F2FF",
        "--accent-strong": "#005FCC",
        "--success": "#00B6A9",
        "--success-soft": "#E9FBF9",
        "--success-border": "#AAEDE7",
        "--warning": "#DC2626",
        "--warning-soft": "#FEE2E2",
        "--warning-border": "#FCA5A5",
        "--danger": "#b91c1c",
        "--danger-border": "#fca5a5",
        "--sidebar-width": "clamp(230px, 16vw, 290px)",
        "--surface-overlay": "#F1F8FF",
        "--input-bg": "#FFFFFF",
        "--input-border": "#B5D2F8",
        "--shadow-soft": "0 10px 24px rgba(0, 122, 251, 0.10)",
        "--shadow-panel": "0 14px 30px rgba(0, 122, 251, 0.14)",
        "--shadow-glow": "0 0 0 2px rgba(0, 122, 251, 0.18)",
        "--topbar-height": "0px",
      }}
    >
      <div className="google-dashboard" style={{ display: "flex", gap: 14, padding: "18px 14px", minHeight: "100vh", background: "var(--page-bg)", width: "100%", boxSizing: "border-box", alignItems: "flex-start", marginTop: 0 }}>
        <div
          className="teacher-sidebar-spacer"
          style={{
            width: "var(--sidebar-width)",
            minWidth: "var(--sidebar-width)",
            flex: "0 0 var(--sidebar-width)",
            pointerEvents: "none",
          }}
        />

        <div
          className="main-content google-main"
          style={{
            flex: "1 1 0",
            minWidth: 0,
            maxWidth: "none",
            margin: 0,
            boxSizing: "border-box",
            alignSelf: "flex-start",
            minHeight: "calc(100vh - 24px)",
            overflowY: "visible",
            overflowX: "hidden",
            position: "relative",
            scrollbarWidth: "thin",
            scrollbarColor: "transparent transparent",
            padding: "0 12px 0 2px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div style={{ width: "100%", maxWidth: FEED_SECTION_STYLE.maxWidth }}>
            <div className="section-header-card" style={{ ...FEED_SECTION_STYLE, margin: "0 auto 14px" }}>
              <div className="section-header-card__title" style={{ fontSize: 17 }}>School Updates Feed</div>
              <div className="section-header-card__subtitle">Post announcements, payment reminders, and notices.</div>
            </div>

            <div className="post-box" style={{ ...FEED_SECTION_STYLE, margin: "0 auto 14px" }}>
              <div
                className="fb-post-top"
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid var(--border-soft)",
                  boxShadow: "var(--shadow-soft)",
                  padding: 16,
                }}
              >
                <img
                  src={admin.profileImage || "/default-profile.png"}
                  alt="me"
                  style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "2px solid #e6eefc" }}
                />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                    <textarea
                    placeholder="What's on your mind?"
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    style={{
                      minHeight: 86,
                      resize: "vertical",
                      border: "1px solid var(--border-soft)",
                      background: "var(--surface-muted)",
                      borderRadius: 18,
                      padding: "14px 16px",
                      fontSize: 13,
                      lineHeight: 1.4,
                      outline: "none",
                    }}
                  />
                  <div className="fb-post-bottom" style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8, borderTop: "1px solid #edf0f2" }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handlePostMediaSelection}
                      accept="image/*,video/*"
                      style={{ display: "none" }}
                    />
                    <div style={{ flex: 1, minWidth: 220, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", borderRadius: 12, background: "linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)", border: "1px dashed #bfd3f6", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: "1 1 180px" }}>
                        <div style={{ width: 38, height: 38, borderRadius: 12, background: "#e7f2ff", border: "1px solid #bfd3f6", color: "#1877f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {postMedia && String(postMedia.type || "").startsWith("video/") ? <AiFillVideoCamera /> : <AiFillPicture />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{postMedia ? "Media ready" : "Choose a photo or video"}</div>
                          <div style={{ marginTop: 2, fontSize: 11, color: "#64748b" }}>{isOptimizingMedia ? "Optimizing image..." : "Images are compressed automatically when possible."}</div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleOpenPostMediaPicker}
                        disabled={isOptimizingMedia}
                        style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 34, padding: "0 12px", borderRadius: 999, border: "none", background: isOptimizingMedia ? "#cfe0fb" : "#1877f2", color: "#fff", fontSize: 12, fontWeight: 700, cursor: isOptimizingMedia ? "progress" : "pointer" }}
                      >
                        <AiFillPicture />
                        <span>{isOptimizingMedia ? "Optimizing..." : postMedia ? "Change file" : "Choose file"}</span>
                      </button>
                    </div>

                    {postMedia && (
                      <div style={{
                        width: "100%",
                        minWidth: 120,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 10px",
                        background: "#f5f6f7",
                        borderRadius: 8,
                        border: "1px solid #d9dde3",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        boxSizing: "border-box"
                      }}>
                        {String(postMedia.type || "").startsWith("video/") ? (
                          <AiFillVideoCamera style={{ color: "#dc2626", fontSize: 18, flexShrink: 0 }} />
                        ) : (
                          <AiFillPicture style={{ color: "#16a34a", fontSize: 18, flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: "#111", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {postMedia.name}
                          </div>
                          <div style={{ marginTop: 2, fontSize: 11, color: "#64748b" }}>
                            {postMediaMeta?.wasCompressed
                              ? `Optimized from ${formatFileSize(postMediaMeta.originalSize)} to ${formatFileSize(postMediaMeta.finalSize)}${postMediaMeta.wasConvertedToJpeg ? " as JPEG" : ""}`
                              : `Ready to attach${postMediaMeta?.wasConvertedToJpeg ? " as JPEG" : ""}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPostMedia(null);
                            setPostMediaMeta(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#6b7280",
                            cursor: "pointer",
                            fontSize: 16,
                            lineHeight: 1
                          }}
                          aria-label="Remove selected media"
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    <div style={{ marginLeft: "auto" }}>
                      <button
                        className="telegram-send-icon"
                        onClick={handlePost}
                        disabled={!canSubmitPost}
                        style={{
                          border: "none",
                          background: canSubmitPost ? "#1877f2" : "#cbd5e1",
                          borderRadius: 6,
                          height: 30,
                          minWidth: 64,
                          padding: "0 12px",
                          color: canSubmitPost ? "#fff" : "#64748b",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: canSubmitPost ? "pointer" : "not-allowed",
                        }}
                      >
                        {isOptimizingMedia ? "Optimizing..." : "Post"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="posts-container" style={{ ...FEED_SECTION_STYLE, display: "flex", flexDirection: "column", gap: 12 }}>
              {posts.length === 0 ? (
                <div style={{ ...shellCardStyle, borderRadius: 10, padding: "16px", fontSize: 14, color: "var(--text-muted)", textAlign: "center" }}>
                  No posts available right now.
                </div>
              ) : (
                posts.map((post) => (
                <div className="facebook-post-card" id={`post-${post.postId}`} key={post.postId} style={{ ...shellCardStyle, borderRadius: 10, overflow: "hidden" }}>
                  <div className="facebook-post-card__header" style={{ padding: "12px 14px 10px" }}>
                    <div className="facebook-post-card__header-main">
                      <div className="facebook-post-card__avatar">
                      <img
                        src={post.adminProfile || "/default-profile.png"}
                        alt="profile"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      </div>
                      <div className="facebook-post-card__identity">
                        <div className="facebook-post-card__identity-row">
                          <h4>{post.adminName || finance.name || "Finance"}</h4>
                          <span className="facebook-post-card__page-badge">School Page</span>
                        </div>
                        <div className="facebook-post-card__meta">
                          <span>{post.time || "Just now"}</span>
                          <span>•</span>
                          <span>Public</span>
                        </div>
                      </div>
                    </div>
                    <div className="facebook-post-card__type-chip">Announcement</div>
                  </div>

                  <div className="facebook-post-card__body" style={{ padding: "0 14px 12px" }}>
                    <div className="facebook-post-card__message">{post.message}</div>
                  </div>

                  {post.postUrl && (
                    <div className="facebook-post-card__media-shell">
                      <img
                        className="facebook-post-card__media"
                        src={post.postUrl}
                        alt="post media"
                      />
                    </div>
                  )}

                  <div className="facebook-post-card__stats" style={{ padding: "10px 14px 8px" }}>
                    <div className="facebook-post-card__stats-left">
                      <span className="facebook-post-card__reaction-bubble">
                        <FaHeart style={{ width: 10, height: 10 }} />
                      </span>
                      <span>{post.likeCount || 0} likes</span>
                    </div>
                    <div className="facebook-post-card__stats-right">
                      <span>Visible to finance staff</span>
                    </div>
                  </div>

                  <div className="facebook-post-card__actions" style={{ padding: "4px 10px 10px" }}>
                      <button
                        onClick={() => handleLike(post.postId)}
                        className={`facebook-post-card__action-button${post.likes && post.likes[admin.userId] ? " is-active" : ""}`}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {post.likes && post.likes[admin.userId] ? (
                            <FaHeart style={{ fontSize: 12 }} />
                          ) : (
                            <FaRegHeart style={{ fontSize: 12 }} />
                          )}
                          {post.likes && post.likes[admin.userId] ? "Liked" : "Like"}
                        </span>
                      </button>
                  </div>
                </div>
              ))
              )}
            </div>
          </div>

        </div>

        <div
          className="right-widgets-spacer"
          style={{
            width: "clamp(300px, 21vw, 360px)",
            minWidth: 300,
            maxWidth: 360,
            flex: "0 0 clamp(300px, 21vw, 360px)",
            marginLeft: 10,
            pointerEvents: "none",
          }}
        />

        <div
          className="dashboard-widgets"
          style={{ width: "clamp(300px, 21vw, 360px)", minWidth: 300, maxWidth: 360, flex: "0 0 clamp(300px, 21vw, 360px)", display: "flex", flexDirection: "column", gap: 12, alignSelf: "flex-start", height: "calc(100vh - 88px)", maxHeight: "calc(100vh - 88px)", overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", position: "fixed", top: 18, right: 14, scrollbarWidth: "thin", scrollbarColor: "transparent transparent", paddingRight: 2, paddingLeft: 14, paddingBottom: 14, marginLeft: 10, marginRight: 0, borderLeft: "none", zIndex: 20 }}
        >
          <div style={widgetCardStyle}>
            <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Quick Statistics</h4>
            <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center", justifyContent: "center", flexWrap: "nowrap" }}>
              {summaryCards.map((item) => (
                <div key={item.label} style={smallStatStyle}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>{item.label}</div>
                  <div style={{ marginTop: 3, fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={widgetCardStyle}>
            <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Today&apos;s Activity</h4>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", ...softPanelStyle, padding: "7px 8px", fontSize: 10 }}>
                <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>New Posts</span>
                <strong style={{ color: "var(--text-primary)" }}>{totalPostsToday}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", ...softPanelStyle, padding: "7px 8px", fontSize: 10 }}>
                <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Messages</span>
                <strong style={{ color: "var(--text-primary)" }}>{messageCount}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", ...softPanelStyle, padding: "7px 8px", fontSize: 10 }}>
                <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Notifications</span>
                <strong style={{ color: "var(--text-primary)" }}>{totalNotifications}</strong>
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>Recent Contacts</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {recentContacts.length === 0 ? (
                  <div style={{ fontSize: 10, color: "var(--text-muted)", ...softPanelStyle, padding: "7px 8px" }}>
                    No recent chats yet
                  </div>
                ) : (
                  recentContacts.map((contact) => (
                    <button
                      key={contact.userId}
                      type="button"
                      onClick={async () => {
                        await markMessagesAsSeen(contact.userId);
                        setUnreadSenders((prev) => {
                          const next = { ...prev };
                          delete next[contact.userId];
                          return next;
                        });
                        navigate("/all-chat", {
                          state: {
                            user: {
                              userId: contact.userId,
                              name: contact.name,
                              profileImage: contact.profileImage,
                              type: contact.type,
                            },
                          },
                        });
                      }}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 9px", borderRadius: 10, border: "1px solid rgba(15, 23, 42, 0.06)", background: "#F8FAFC", cursor: "pointer", textAlign: "left" }}
                    >
                      <img src={contact.profileImage} alt={contact.name} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover" }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{contact.name}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{contact.unreadCount} unread</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div style={widgetCardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>Notification Center</h4>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(15, 23, 42, 0.08)", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC", color: "var(--text-secondary)" }}>
                  <FaBell style={{ width: 12, height: 12 }} />
                </span>
                <span style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(15, 23, 42, 0.08)", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC", color: "var(--text-secondary)" }}>
                  <FaFacebookMessenger style={{ width: 12, height: 12 }} />
                </span>
              </div>
            </div>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {unreadPostList.length === 0 ? (
                <div style={{ padding: "8px 9px", borderRadius: 10, border: "1px solid rgba(15, 23, 42, 0.06)", background: "#F8FAFC", fontSize: 10, color: "var(--text-muted)" }}>
                  No unread post notifications.
                </div>
              ) : (
                unreadPostList.slice(0, 4).map((post) => (
                  <button
                    key={post.postId}
                    type="button"
                    onClick={() => openPostFromNotif(post)}
                    style={{ textAlign: "left", padding: "10px", borderRadius: 10, border: "1px solid rgba(15, 23, 42, 0.06)", background: "#F8FAFC", cursor: "pointer" }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-primary)" }}>{post.adminName || "Finance"}</div>
                    <div style={{ marginTop: 4, fontSize: 10, color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {String(post.message || "").slice(0, 84)}
                      {String(post.message || "").length > 84 ? "..." : ""}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div style={widgetCardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>Recent Feed</h4>
              <button
                type="button"
                onClick={() => navigate("/my-posts")}
                style={{ height: 32, padding: "0 12px", borderRadius: 999, border: "1px solid rgba(15, 23, 42, 0.08)", background: "var(--surface-panel)", color: "var(--text-primary)", fontSize: 10, fontWeight: 800, cursor: "pointer" }}
              >
                Open posts
              </button>
            </div>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {recentFeedPreview.length === 0 ? (
                <div style={{ padding: "8px 9px", borderRadius: 10, border: "1px solid rgba(15, 23, 42, 0.06)", background: "#F8FAFC", fontSize: 10, color: "var(--text-muted)" }}>
                  No recent posts yet.
                </div>
              ) : (
                recentFeedPreview.map((post) => (
                  <button
                    key={post.postId}
                    type="button"
                    onClick={() => openPostFromNotif(post)}
                    style={{ textAlign: "left", padding: "10px", borderRadius: 10, border: "1px solid rgba(15, 23, 42, 0.06)", background: "#F8FAFC", cursor: "pointer" }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-primary)" }}>{post.adminName || "Finance"}</div>
                    <div style={{ marginTop: 4, fontSize: 10, color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {String(post.message || "").slice(0, 84)}
                      {String(post.message || "").length > 84 ? "..." : ""}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <style>{`
          .section-header-card {
            padding: 14px 16px;
            border-radius: 12px;
            background: var(--surface-panel);
            border: 1px solid var(--border-soft);
            box-shadow: var(--shadow-soft);
          }
          .section-header-card__title {
            font-weight: 800;
            color: var(--text-primary);
            letter-spacing: -0.01em;
          }
          .section-header-card__subtitle {
            margin-top: 4px;
            font-size: 12px;
            color: var(--text-muted);
            line-height: 1.5;
          }
          .posts-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            margin-left: 0;
          }
          .post-box {
            width: 100%;
            margin-left: auto;
            margin-right: auto;
            margin-top: 12px;
          }
          .facebook-post-card {
            width: 100%;
            max-width: 680px;
            margin: 0 auto;
            position: relative;
            isolation: isolate;
          }
          .facebook-post-card:hover {
            transform: translateY(-2px);
          }
          .facebook-post-card__header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
          }
          .facebook-post-card__header-main {
            min-width: 0;
            flex: 1;
            display: flex;
            align-items: flex-start;
            gap: 12px;
          }
          .facebook-post-card__avatar {
            width: 42px;
            height: 42px;
            border-radius: 50%;
            overflow: hidden;
            flex-shrink: 0;
            border: 1px solid rgba(15, 23, 42, 0.08);
            box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
            background: #fff;
          }
          .facebook-post-card__identity {
            min-width: 0;
            flex: 1;
          }
          .facebook-post-card__identity-row {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
          }
          .facebook-post-card__identity-row h4 {
            margin: 0;
            font-size: 14px;
            line-height: 1.25;
            font-weight: 800;
            color: var(--text-primary);
          }
          .facebook-post-card__page-badge {
            display: inline-flex;
            align-items: center;
            padding: 3px 8px;
            border-radius: 999px;
            background: #e7f3ff;
            color: #0866ff;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.02em;
          }
          .facebook-post-card__meta {
            margin-top: 4px;
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
            font-size: 11px;
            font-weight: 600;
            color: #65676b;
          }
          .facebook-post-card__type-chip {
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            padding: 5px 9px;
            border-radius: 999px;
            background: linear-gradient(135deg, #f0f6ff 0%, #e7f3ff 100%);
            border: 1px solid #bfdcff;
            color: #0866ff;
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }
          .facebook-post-card__body {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .facebook-post-card__message {
            color: var(--text-primary);
            font-size: 14px;
            line-height: 1.45;
            word-break: break-word;
            white-space: pre-wrap;
          }
          .facebook-post-card__media-shell {
            background: #eff2f5;
            border-top: 1px solid rgba(15, 23, 42, 0.08);
            border-bottom: 1px solid rgba(15, 23, 42, 0.08);
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .facebook-post-card__media {
            width: 100%;
            height: auto;
            max-height: min(68vh, 540px);
            object-fit: contain;
            display: block;
            background: #eff2f5;
          }
          .facebook-post-card__stats {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            border-bottom: 1px solid rgba(15, 23, 42, 0.08);
          }
          .facebook-post-card__stats-left,
          .facebook-post-card__stats-right {
            min-width: 0;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 11px;
            font-weight: 600;
            color: #65676b;
          }
          .facebook-post-card__stats-right {
            justify-content: flex-end;
            text-align: right;
          }
          .facebook-post-card__reaction-bubble {
            width: 22px;
            height: 22px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            background: #0866ff;
            color: #fff;
            box-shadow: 0 6px 16px rgba(8, 102, 255, 0.22);
          }
          .facebook-post-card__actions {
            display: flex;
          }
          .facebook-post-card__action-button {
            width: 100%;
            min-height: 36px;
            border: none;
            border-radius: 8px;
            background: transparent;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            cursor: pointer;
            color: #65676b;
            font-size: 13px;
            font-weight: 800;
            transition: background 160ms ease, color 160ms ease, transform 160ms ease;
          }
          .facebook-post-card__action-button:hover {
            background: #f2f4f7;
          }
          .facebook-post-card__action-button.is-active {
            background: #e7f3ff;
            color: #0866ff;
          }
          .facebook-post-card__action-button:active {
            transform: translateY(1px);
          }
          @media (max-width: 1100px) {
            .right-widgets-spacer,
            .dashboard-widgets {
              display: none !important;
            }
          }
          @media (max-width: 720px) {
            .facebook-post-card__header {
              flex-wrap: wrap;
            }
            .facebook-post-card__type-chip {
              order: 3;
            }
            .facebook-post-card__stats {
              flex-direction: column;
              align-items: flex-start;
            }
            .facebook-post-card__stats-right {
              justify-content: flex-start;
              text-align: left;
            }
          }
          @media (max-width: 600px) {
            .teacher-sidebar-spacer {
              display: none !important;
            }
            .posts-container,
            .post-box {
              width: 100vw !important;
              max-width: 100vw !important;
              margin: 0 !important;
              padding: 0 !important;
              border-radius: 0 !important;
              box-shadow: none !important;
            }
            .posts-container {
              align-items: stretch;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

export default Dashboard;