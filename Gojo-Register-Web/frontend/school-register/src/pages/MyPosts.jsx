import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { AiFillPicture, AiFillVideoCamera } from "react-icons/ai";
import {
  FaHome,
  FaFileAlt,
  FaChalkboardTeacher,
  FaCog,
  FaSignOutAlt,
  FaBell,
  FaFacebookMessenger,
  FaCalendarAlt,
  FaChartLine,
  FaChevronDown,
  FaVideo,
  FaPhotoVideo,
  FaPlayCircle,
} from "react-icons/fa";
import "../styles/global.css";
import { BACKEND_BASE } from "../config.js";
import useTopbarNotifications from "../hooks/useTopbarNotifications";

function MyPosts() {
  const API_BASE = `${BACKEND_BASE}/api`;
  const [posts, setPosts] = useState([]);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editedContent, setEditedContent] = useState("");
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState(null);
  const [targetRole, setTargetRole] = useState("all");
  const [targetOptions, setTargetOptions] = useState(["all"]);
  const fileInputRef = useRef(null);
  const [teachers, setTeachers] = useState([]);
  const [unreadTeachers, setUnreadTeachers] = useState({});
  const [popupMessages, setPopupMessages] = useState([]);
  const [recentContacts, setRecentContacts] = useState([]);
  const [showMessageDropdown, setShowMessageDropdown] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherChatOpen, setTeacherChatOpen] = useState(false);
  const [showPostDropdown, setShowPostDropdown] = useState(false);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [dashboardMenuOpen, setDashboardMenuOpen] = useState(true);
  const [studentMenuOpen, setStudentMenuOpen] = useState(false);

  // loading states for edit/delete
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();
  const FEED_MAX_WIDTH = "min(700px, 100%)";

  // Read admin from localStorage
  // Read finance/admin from localStorage (compat)
  const _storedFinance = (() => {
    try {
      return JSON.parse(localStorage.getItem("registrar") || localStorage.getItem("admin")) || {};
    } catch (e) {
      return {};
    }
  })();

  const [finance, setFinance] = useState({
    financeId: _storedFinance.financeId || _storedFinance.adminId || "",
    userId: _storedFinance.userId || "",
    schoolCode: _storedFinance.schoolCode || "",
    name: _storedFinance.name || _storedFinance.username || "Register Office",
    username: _storedFinance.username || "",
    profileImage: _storedFinance.profileImage || "/default-profile.png",
    token: _storedFinance.token || _storedFinance.accessToken || _storedFinance.idToken || _storedFinance.apiKey || null,
  });

  // Compatibility alias: older code expects `admin` object
  const admin = {
    adminId: finance.financeId || finance.adminId || "",
    userId: finance.userId || "",
    name: finance.name || finance.username || "Register Office",
    profileImage: finance.profileImage || "/default-profile.png",
    token: finance.token || null,
  };

  // include username (from Users node) for sidebar display
  admin.username = finance.username || "";

  // Prefer the finance/adminId (financeId) when available; fallback to userId
  const adminId = admin?.adminId || admin?.userId || null;
  const token = admin?.token || null;

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      axios.defaults.headers.common["x-access-token"] = token;
    } else {
      delete axios.defaults.headers.common["Authorization"];
      delete axios.defaults.headers.common["x-access-token"];
    }
  }, [token]);

  const RTDB_BASE_RAW = "https://bale-house-rental-default-rtdb.firebaseio.com";
  const schoolCode = finance.schoolCode || _storedFinance.schoolCode || "";
  const DB_ROOT = schoolCode
    ? `${RTDB_BASE_RAW}/Platform1/Schools/${schoolCode}`
    : RTDB_BASE_RAW;
  const RTDB_BASE = DB_ROOT;
  const DB_URL = DB_ROOT;

  const [loadingFinance, setLoadingFinance] = useState(true);

  const loadFinanceFromStorage = async () => {
    const stored = localStorage.getItem("registrar") || localStorage.getItem("admin");

    if (!stored) {
      setLoadingFinance(false);
      return;
    }

    try {
      const financeData = JSON.parse(stored) || {};

      const financeKey = financeData.financeId || financeData.adminId || financeData.id || financeData.uid || "";
      const possibleUserId = financeData.userId || financeData.user_id || financeData.uid || financeData.user || "";

      if (financeKey) {
        let res = null;
        try {
          res = (await axios.get(`${DB_URL}/Finance/${financeKey}.json`)) || null;
        } catch (err) {
          res = null;
        }

        if (!res || !res.data) {
          try {
            res = (await axios.get(`${DB_URL}/Academics/${financeKey}.json`)) || null;
          } catch (err) {
            res = null;
          }
        }

        if (res && res.data) {
          const node = res.data;
          const userId = node.userId || node.user_id || possibleUserId || "";

          if (userId) {
            try {
              const userRes = await axios.get(`${DB_URL}/Users/${userId}.json`);
              const nextFinance = {
                financeId: financeKey,
                userId,
                schoolCode: financeData.schoolCode || "",
                name: userRes.data?.name || node.name || financeData.name || "Register Office",
                username: userRes.data?.username || financeData.username || "",
                profileImage: userRes.data?.profileImage || node.profileImage || financeData.profileImage || "/default-profile.png",
                token: financeData.token || financeData.accessToken || financeData.idToken || financeData.apiKey || null,
              };
              setFinance(nextFinance);
              localStorage.setItem("finance", JSON.stringify({ ...financeData, ...nextFinance }));
              localStorage.setItem("admin", JSON.stringify({ ...financeData, ...nextFinance, adminId: nextFinance.financeId }));
              setLoadingFinance(false);
              return;
            } catch (err) {
              const nextFinance = {
                financeId: financeKey,
                userId,
                schoolCode: financeData.schoolCode || "",
                name: node.name || financeData.name || "Register Office",
                username: node.username || financeData.username || "",
                profileImage: node.profileImage || financeData.profileImage || "/default-profile.png",
                token: financeData.token || financeData.accessToken || financeData.idToken || financeData.apiKey || null,
              };
              setFinance(nextFinance);
              localStorage.setItem("finance", JSON.stringify({ ...financeData, ...nextFinance }));
              localStorage.setItem("admin", JSON.stringify({ ...financeData, ...nextFinance, adminId: nextFinance.financeId }));
              setLoadingFinance(false);
              return;
            }
          }
        }
      }

      if (possibleUserId) {
        try {
          const userRes = await axios.get(`${DB_URL}/Users/${possibleUserId}.json`);
          const nextFinance = {
            financeId: financeData.financeId || financeData.adminId || "",
            userId: possibleUserId,
            schoolCode: financeData.schoolCode || "",
            name: userRes.data?.name || financeData.name || "Register Office",
            username: userRes.data?.username || financeData.username || "",
            profileImage: userRes.data?.profileImage || financeData.profileImage || "/default-profile.png",
            token: financeData.token || financeData.accessToken || financeData.idToken || financeData.apiKey || null,
          };
          setFinance(nextFinance);
          localStorage.setItem("finance", JSON.stringify({ ...financeData, ...nextFinance }));
          localStorage.setItem("admin", JSON.stringify({ ...financeData, ...nextFinance, adminId: nextFinance.financeId }));
          setLoadingFinance(false);
          return;
        } catch (err) {
          // ignore and fallback to stored data
        }
      }

      const fallbackFinance = {
        financeId: financeData.financeId || financeData.adminId || "",
        userId: financeData.userId || "",
        schoolCode: financeData.schoolCode || "",
        name: financeData.name || financeData.username || "Register Office",
        username: financeData.username || "",
        profileImage: financeData.profileImage || "/default-profile.png",
        token: financeData.token || financeData.accessToken || financeData.idToken || financeData.apiKey || null,
      };
      setFinance(fallbackFinance);
      localStorage.setItem("finance", JSON.stringify({ ...financeData, ...fallbackFinance }));
      localStorage.setItem("admin", JSON.stringify({ ...financeData, ...fallbackFinance, adminId: fallbackFinance.financeId }));
    } catch (e) {
      try {
        localStorage.removeItem("registrar");
        localStorage.removeItem("admin");
      } catch (err) {}
    }

    setLoadingFinance(false);
  };

  const {
    unreadSenders,
    setUnreadSenders,
    unreadPosts: postNotifications,
    setUnreadPosts: setPostNotifications,
    messageCount,
    totalNotifications,
    markMessagesAsSeen,
    markPostAsSeen,
  } = useTopbarNotifications({
    dbRoot: RTDB_BASE,
    currentUserId: admin.userId,
  });

  const handleNotificationClick = async (notification) => {
    try {
      await markPostAsSeen(notification.postId);
    } catch (err) {
      console.warn("Failed to delete notification:", err);
    }

    setPostNotifications((prev) =>
      prev.filter((n) => n.notificationId !== notification.notificationId)
    );

    setShowPostDropdown(false);

    navigate("/dashboard", {
      state: { postId: notification.postId },
    });
  };

  const fetchMyPosts = async () => {
    if (!adminId) return;
    try {
      const res = await axios.get(`${API_BASE}/get_my_posts/${adminId}`, {
        params: { schoolCode },
      });
      const postsArray = Array.isArray(res.data)
        ? res.data
        : Object.entries(res.data || {}).map(([key, post]) => ({
            postId: key,
            ...post,
          }));

      const mappedPosts = postsArray
        .map((p) => {
          const parsedTime = p.time ? new Date(p.time) : new Date();
          const postId = p.postId || p.id || "";
          return {
            postId: postId || String(p?.postId || p?.id || ""),
            message: p.message || p.postText || "",
            postUrl: p.postUrl || p.mediaUrl || p.postUrl || null,
            time: parsedTime.toLocaleString(),
            parsedTime,
            edited: p.edited || false,
            likeCount: Number(p.likeCount) || 0,
            likes: p.likes || {},
            adminId: p.adminId || adminId,
          };
        })
        .sort((a, b) => b.parsedTime - a.parsedTime);

      setPosts(mappedPosts);
    } catch (err) {
      console.error("Error fetching posts:", err.response?.data || err);
    }
  };

  useEffect(() => {
    if (loadingFinance) return;
    if (!adminId) return;

    fetchMyPosts();
    const interval = setInterval(fetchMyPosts, 10000);
    return () => clearInterval(interval);
  }, [adminId, loadingFinance]);

  // load finance info on mount (so adminId is populated from RTDB when needed)
  useEffect(() => {
    loadFinanceFromStorage();
  }, []);

  const handlePost = async () => {
    if (!postText && !postMedia) return false;
    try {
      const formData = new FormData();
      // Use backend-compatible field names: `message`, `postUrl` (if uploading client-side), and include finance fields
      formData.append("adminId", adminId);
      formData.append("message", postText);
      if (postMedia) formData.append("postMedia", postMedia);

      // Include finance fields for new schema compatibility
      formData.append("financeId", finance.financeId || admin.adminId || "");
      formData.append("financeName", finance.name || admin.name || "");
      formData.append("financeProfile", finance.profileImage || admin.profileImage || "");
      // also include admin display fields for older backend compatibility
      formData.append("adminName", admin.name || "");
      formData.append("adminProfile", admin.profileImage || "");
      // include userId if available
      formData.append("userId", finance.userId || admin.userId || "");
      formData.append("schoolCode", schoolCode || "");
      formData.append("targetRole", targetRole || "all");

      await axios.post(`${API_BASE}/create_post`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setPostText("");
      setPostMedia(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchMyPosts();
      return true;
    } catch (err) {
      console.error("Error creating post:", err.response?.data || err);
      alert("Create post failed: " + (err.response?.data?.message || err.message || "See console"));
      return false;
    }
  };

  const handleSubmitCreatePost = async () => {
    if (!postText && !postMedia) return;
    const success = await handlePost();
    if (success) setShowCreatePostModal(false);
  };

  const handleEdit = (postId, currentContent) => {
    setEditingPostId(postId);
    setEditedContent(currentContent || "");
  };

  const saveEdit = async (postId) => {
    if (!postId) return;
    if (!adminId) return;
    const trimmed = (editedContent || "").trim();
    if (trimmed.length === 0) {
      alert("Post content cannot be empty.");
      return;
    }
    setSavingId(postId);

    // Try Firebase first
    try {
      const payload = {
        message: trimmed,
        edited: true,
        editedAt: new Date().toISOString(),
        lastEditedBy: adminId,
      };
      const firebaseUrl = `${RTDB_BASE}/Posts/${encodeURIComponent(postId)}.json`;
      await axios.patch(firebaseUrl, payload);
      setPosts((prev) =>
        prev.map((post) =>
          post.postId === postId ? { ...post, message: trimmed, edited: true } : post
        )
      );
      setEditingPostId(null);
      setEditedContent("");
      setSavingId(null);
      return;
    } catch (err) {
      // fallback to backend
    }

    try {
      const url = `${API_BASE}/edit_post/${postId}`;
      const payload = { adminId, postText: trimmed, message: trimmed };
      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
        headers["x-access-token"] = token;
      }
      const res = await axios.post(url, payload, { headers });
      if (res.data && res.data.success === false) {
        throw new Error(res.data.message || "Edit failed on backend");
      }
      setPosts((prev) =>
        prev.map((post) =>
          post.postId === postId ? { ...post, message: trimmed, edited: true } : post
        )
      );
      setEditingPostId(null);
      setEditedContent("");
    } catch (err) {
      console.error("[EDIT] Final error:", err.response?.status, err.response?.data || err.message || err);
      alert("Edit failed: " + (err.response?.data?.message || err.message || "See console"));
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (postId) => {
    if (!postId) return;
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    if (!adminId) return;
    setDeletingId(postId);

    try {
      const firebaseUrl = `${RTDB_BASE}/Posts/${encodeURIComponent(postId)}.json`;
      await axios.delete(firebaseUrl);
      setPosts((prev) => prev.filter((p) => p.postId !== postId));
      setDeletingId(null);
      return;
    } catch (err) {
      // fallback below
    }

    try {
      const url = `${API_BASE}/delete_post/${postId}`;
      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
        headers["x-access-token"] = token;
      }

      try {
        const rPost = await axios.post(url, { adminId }, { headers });
        if (rPost.data && rPost.data.success === false) throw new Error(rPost.data.message || "delete returned success:false");
        setPosts((prev) => prev.filter((p) => p.postId !== postId));
        setDeletingId(null);
        return;
      } catch (postErr) {
        // try delete with body
      }

      try {
        const rDelBody = await axios.delete(url, { data: { adminId }, headers });
        if (rDelBody.data && rDelBody.data.success === false) throw new Error(rDelBody.data.message || "delete returned success:false");
        setPosts((prev) => prev.filter((p) => p.postId !== postId));
        setDeletingId(null);
        return;
      } catch (delBodyErr) {
        // try delete with params
      }

      const rDelParam = await axios.delete(url, { params: { adminId }, headers });
      if (rDelParam.data && rDelParam.data.success === false) throw new Error(rDelParam.data.message || "delete returned success:false");
      setPosts((prev) => prev.filter((p) => p.postId !== postId));
    } catch (err) {
      console.error("[DELETE] Final error:", err.response?.status, err.response?.data || err.message || err);
      alert("Delete failed: " + (err.response?.data?.message || err.message || "See console"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleLike = async (postId) => {
    try {
      const res = await axios.post(`${API_BASE}/like_post`, {
        adminId,
        postId,
      });
      if (res.data.success) {
        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.postId === postId
              ? {
                  ...post,
                  likeCount: res.data.likeCount,
                  likes: {
                    ...post.likes,
                    [adminId]: res.data.liked ? true : undefined,
                  },
                }
              : post
          )
        );
      }
    } catch (err) {
      console.error("Error liking post:", err.response?.data || err);
    }
  };

  useEffect(() => {
    const closeDropdown = (e) => {
      if (!e.target.closest(".icon-circle") && !e.target.closest(".messenger-dropdown")) {
        setShowMessageDropdown(false);
      }
    };
    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

  useEffect(() => {
    const fetchTeachersAndRecent = async () => {
      const financeUserId = finance.userId;
      if (!financeUserId) {
        setRecentContacts([]);
        return;
      }

      try {
        const [teachersRes, studentsRes, parentsRes, usersRes, chatsRes] = await Promise.all([
          axios.get(`${DB_URL}/Teachers.json`).catch(() => ({ data: {} })),
          axios.get(`${DB_URL}/Students.json`).catch(() => ({ data: {} })),
          axios.get(`${DB_URL}/Parents.json`).catch(() => ({ data: {} })),
          axios.get(`${DB_URL}/Users.json`).catch(() => ({ data: {} })),
          axios.get(`${DB_URL}/Chats.json`).catch(() => ({ data: {} })),
        ]);

        const teachersData = teachersRes.data || {};
        const studentsData = studentsRes.data || {};
        const parentsData = parentsRes.data || {};
        const usersData = usersRes.data || {};
        const chatsData = chatsRes.data || {};
        const userRecords = Object.values(usersData || {});

        const findUserNode = (identifier) => {
          const id = String(identifier || "");
          if (!id) return null;
          if (usersData[id]) return usersData[id];
          return (
            userRecords.find(
              (u) =>
                String(u?.userId || "") === id ||
                String(u?.username || "") === id ||
                String(u?.employeeId || "") === id ||
                String(u?.teacherId || "") === id ||
                String(u?.studentId || "") === id ||
                String(u?.parentId || "") === id
            ) || null
          );
        };

        const resolveContactMeta = (identifier) => {
          const id = String(identifier || "");
          if (!id) return { name: "Unknown", profileImage: "/default-profile.png", type: "user", userId: "" };

          const userNode = findUserNode(id);
          if (userNode) {
            return {
              name: userNode.name || userNode.username || "Unknown",
              profileImage: userNode.profileImage || "/default-profile.png",
              type: userNode.role || userNode.userType || "user",
              userId: userNode.userId || id,
            };
          }

          const teacherNode =
            teachersData[id] ||
            Object.values(teachersData || {}).find(
              (t) => String(t?.userId || "") === id || String(t?.teacherId || "") === id
            );
          if (teacherNode) {
            const teacherUser = findUserNode(teacherNode?.userId) || {};
            return {
              name: teacherUser.name || teacherNode.name || teacherNode.teacherId || "Teacher",
              profileImage: teacherUser.profileImage || teacherNode.profileImage || "/default-profile.png",
              type: "teacher",
              userId: teacherNode.userId || id,
            };
          }

          const studentNode =
            studentsData[id] ||
            Object.values(studentsData || {}).find(
              (s) => String(s?.userId || "") === id || String(s?.studentId || "") === id
            );
          if (studentNode) {
            const studentUser = findUserNode(studentNode?.userId) || {};
            return {
              name: studentUser.name || studentNode.name || studentNode.studentId || "Student",
              profileImage: studentUser.profileImage || studentNode.profileImage || "/default-profile.png",
              type: "student",
              userId: studentNode.userId || id,
            };
          }

          const parentNode =
            parentsData[id] ||
            Object.values(parentsData || {}).find(
              (p) => String(p?.userId || "") === id || String(p?.parentId || "") === id
            );
          if (parentNode) {
            const parentUser = findUserNode(parentNode?.userId) || {};
            return {
              name: parentUser.name || parentNode.name || parentNode.parentId || "Parent",
              profileImage: parentUser.profileImage || parentNode.profileImage || "/default-profile.png",
              type: "parent",
              userId: parentNode.userId || id,
            };
          }

          return {
            name: "Unknown",
            profileImage: "/default-profile.png",
            type: "user",
            userId: id,
          };
        };

        const roleSet = new Set(
          Object.values(usersData || {})
            .map((u) => String(u?.role || u?.userType || "").trim().toLowerCase())
            .filter(Boolean)
        );
        const orderedRoles = ["student", "parent", "teacher", "registerer", "finance", "admin"].filter((r) => roleSet.has(r));
        const extraRoles = Array.from(roleSet).filter((r) => !orderedRoles.includes(r)).sort();
        const nextRoles = ["all", ...orderedRoles, ...extraRoles];
        setTargetOptions(nextRoles);
        setTargetRole((prev) => (nextRoles.includes(prev) ? prev : "all"));

        // Debug: expose counts and sample keys
        try {
          console.log("MyPosts RecentContacts debug:", {
            financeUserId,
            schoolCode,
            teachersCount: Object.keys(teachersData || {}).length,
            usersCount: Object.keys(usersData || {}).length,
            chatsCount: Object.keys(chatsData || {}).length,
            chatSample: Object.keys(chatsData || {}).slice(0, 10),
          });
        } catch (e) {}

        const getMessageTime = (message) => {
          const raw =
            message?.timeStamp ||
            message?.timestamp ||
            message?.time ||
            message?.createdAt ||
            message?.sentAt ||
            0;
          if (typeof raw === "number") return raw < 1e12 ? raw * 1000 : raw;
          const parsed = new Date(raw).getTime();
          return Number.isFinite(parsed) ? parsed : 0;
        };

        const myIds = new Set(
          [financeUserId, admin.userId, admin.adminId, finance.financeId]
            .map((v) => String(v || ""))
            .filter(Boolean)
        );

        const recentByUser = {};
        for (const [, chatNode] of Object.entries(chatsData || {})) {
          const msgs = Object.values(chatNode?.messages || {});
          if (!msgs.length) continue;

          for (const m of msgs) {
            const senderId = String(m?.senderId || "");
            const receiverId = String(m?.receiverId || "");
            if (!senderId || !receiverId) continue;

            const isMineSender = myIds.has(senderId);
            const isMineReceiver = myIds.has(receiverId);
            if (!isMineSender && !isMineReceiver) continue;

            const rawPartnerId = isMineSender ? receiverId : senderId;
            if (!rawPartnerId || myIds.has(rawPartnerId)) continue;

            const contactMeta = resolveContactMeta(rawPartnerId);
            const stableContactId = String(contactMeta.userId || rawPartnerId);
            if (!stableContactId || myIds.has(stableContactId)) continue;

            const messageTime = getMessageTime(m);
            if (!messageTime) continue;

            const current = recentByUser[stableContactId];
            if (!current || messageTime > current.lastTime) {
              recentByUser[stableContactId] = {
                userId: stableContactId,
                name: contactMeta.name,
                profileImage: contactMeta.profileImage,
                lastMessage: m?.message || m?.text || m?.content || "",
                lastTime: messageTime,
                type: contactMeta.type,
              };
            }
          }
        }

        const topRecent = Object.values(recentByUser)
          .sort((a, b) => b.lastTime - a.lastTime)
          .slice(0, 5);

        setRecentContacts(topRecent);
      } catch (err) {
        console.error("Error fetching recent contacts in MyPosts:", err);
      }
    };

    fetchTeachersAndRecent();
  }, [finance.userId, schoolCode]);

  useEffect(() => {
    const closeDropdown = (e) => {
      if (!e.target.closest(".icon-circle") && !e.target.closest(".notification-dropdown")) {
        setShowPostDropdown(false);
      }
    };
    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

  useEffect(() => {
    if (!showCreatePostModal) return;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setShowCreatePostModal(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showCreatePostModal]);

  return (
    <div className="dashboard-page" style={{ background: "#f5f8ff", minHeight: "100vh" }}>
      <nav className="top-navbar" style={{ borderBottom: "1px solid #e5e7eb", background: "#ffffff" }}>
        <h2 style={{ color: "#0f172a", fontWeight: 800, letterSpacing: "0.2px" }}>Gojo Register Portal</h2>

        <div className="nav-right">
          <div
            className="icon-circle"
            style={{ position: "relative", cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              setShowPostDropdown((prev) => !prev);
            }}
          >
            <FaBell />
            {totalNotifications > 0 && (
              <span className="badge">{totalNotifications}</span>
            )}
            {showPostDropdown && (
              <div className="notification-dropdown" onClick={(e) => e.stopPropagation()} style={{
                  position: "absolute",
                  top: "45px",
                  right: "0",
                  width: "360px",
                  maxHeight: "420px",
                  overflowY: "auto",
                  background: "#fff",
                  borderRadius: 10,
                  boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
                  zIndex: 1000,
                  padding: 6,
                }}>
                {totalNotifications === 0 ? (
                  <p className="muted">No new notifications</p>
                ) : (
                  <div>
                    {/* Posts section */}
                    {postNotifications.length > 0 && (
                      <div>
                        <div className="notification-section-title">Posts</div>
                        {postNotifications.map((n) => (
                          <div
                            key={n.notificationId}
                            className="notification-row"
                            onClick={async () => {
                              try {
                                await axios.post(`${API_BASE}/mark_post_notification_read`, {
                                  notificationId: n.notificationId,
                                });
                              } catch (err) {
                                console.warn("Failed to mark notification:", err);
                              }

                              setPostNotifications((prev) => prev.filter((notif) => notif.notificationId !== n.notificationId));
                              setShowPostDropdown(false);
                              navigate("/dashboard", {
                                state: {
                                  postId: n.postId,
                                  posterName: n.adminName,
                                  posterProfile: n.adminProfile,
                                },
                              });
                            }}
                            style={{
                              padding: 10,
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              cursor: "pointer",
                              borderBottom: "1px solid #f0f0f0",
                              transition: "background 120ms ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f8fa")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                          >
                            <img src={n.adminProfile || "/default-profile.png"} alt={n.adminName} style={{ width: 46, height: 46, borderRadius: 8, objectFit: "cover" }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ display: "block", marginBottom: 4 }}>{n.adminName}</strong>
                              <p style={{ margin: 0, fontSize: 13, color: "#555", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>{n.message}</p>
                            </div>
                            <div style={{ fontSize: 12, color: "#888", marginLeft: 8 }}>{new Date(n.time || n.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Messages section */}
                    {messageCount > 0 && (
                      <div>
                        <div className="notification-section-title" style={{ padding: '8px 10px', color: '#333', fontWeight: 700, background: '#fafafa', borderRadius: 6, margin: '8px 6px' }}>Messages</div>
                        {Object.entries(unreadSenders || {}).map(([userId, sender]) => (
                              <div
                                key={userId}
                                className="notification-row"
                                onClick={async () => {
                                  await markMessagesAsSeen(userId);
                                  setUnreadSenders((prev) => {
                                    const copy = { ...prev };
                                    delete copy[userId];
                                    return copy;
                                  });
                                  setShowPostDropdown(false);
                                  navigate("/all-chat", { state: { user: { userId, name: sender.name, profileImage: sender.profileImage, type: sender.type } } });
                                }}
                                style={{
                                  padding: 10,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 12,
                                  cursor: "pointer",
                                  borderBottom: "1px solid #f0f0f0",
                                  transition: "background 120ms ease",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f8fa")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                              >
                                <img src={sender.profileImage || "/default-profile.png"} alt={sender.name} style={{ width: 46, height: 46, borderRadius: 8, objectFit: "cover" }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <strong style={{ display: "block", marginBottom: 4 }}>{sender.name}</strong>
                                  <p style={{ margin: 0, fontSize: 13, color: "#555", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>{sender.count} new message{sender.count > 1 && "s"}</p>
                                </div>
                              </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="icon-circle" style={{ position: "relative", cursor: "pointer" }} onClick={() => navigate("/all-chat") }>
            <FaFacebookMessenger />
            {messageCount > 0 && <span className="badge">{messageCount}</span>}
          </div>

          <Link className="icon-circle" to="/settings"><FaCog /></Link>

          <img src={admin.profileImage || "/default-profile.png"} alt="admin" className="profile-img" />
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: "flex", gap: 16, padding: "18px 16px", minHeight: "100vh", background: "#f5f8ff", width: "100%", boxSizing: "border-box" }}>
        {/* ---------------- SIDEBAR ---------------- */}
        <div className="google-sidebar" style={{ width: 'clamp(220px, 15vw, 280px)', minWidth: 220, padding: 12, borderRadius: 16, background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 10px 24px rgba(15,23,42,0.06)', height: 'calc(100vh - 24px)', overflowY: 'auto', alignSelf: 'flex-start', position: 'sticky', top: 24, scrollbarWidth: 'thin', scrollbarColor: 'transparent transparent', opacity: showCreatePostModal ? 0.45 : 1, filter: showCreatePostModal ? 'blur(1px)' : 'none', pointerEvents: showCreatePostModal ? 'none' : 'auto', transition: 'opacity 180ms ease, filter 180ms ease' }}>
          <div className="sidebar-profile" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingBottom: 6 }}>
            <div className="sidebar-img-circle" style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', border: '2px solid #e6eefc' }}>
              <img src={admin?.profileImage || "/default-profile.png"} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{admin?.name || "Admin Name"}</h3>
            {(admin?.username || admin?.userId || admin?.adminId) ? (
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{admin?.username || admin?.userId || admin?.adminId}</p>
            ) : null}
          </div>

          <div className="sidebar-menu" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            <button
              type="button"
              className="sidebar-btn"
              onClick={() => setDashboardMenuOpen((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '10px 12px',
                fontSize: 13,
                fontWeight: 700,
                background: 'linear-gradient(135deg, #eff6ff, #eef2ff)',
                color: '#1e3a8a',
                borderRadius: 12,
                border: '1px solid #c7d2fe',
                cursor: 'pointer'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FaHome style={{ width: 18, height: 18 }} /> Dashboard
              </span>
              <FaChevronDown style={{ transform: dashboardMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s ease' }} />
            </button>

            {dashboardMenuOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 10, paddingLeft: 10, borderLeft: '2px solid #dbeafe' }}>
                <Link className="sidebar-btn" to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', fontSize: 12, color: '#334155', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <FaHome style={{ width: 16, height: 16 }} /> Home
                </Link>
                <Link className="sidebar-btn" to="/my-posts" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', fontSize: 12, fontWeight: 700, backgroundColor: '#1d4ed8', color: '#fff', borderRadius: 10, boxShadow: '0 8px 18px rgba(29,78,216,0.25)' }}>
                  <FaFileAlt style={{ width: 16, height: 16 }} /> My Posts
                </Link>
                <Link className="sidebar-btn" to="/overview" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', fontSize: 12, color: '#334155', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <FaChartLine style={{ width: 16, height: 16 }} /> Overview
                </Link>
                <Link className="sidebar-btn" to="/academic-years" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', fontSize: 12, color: '#334155', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <FaFileAlt style={{ width: 16, height: 16 }} /> Academic Year
                </Link>
                <Link className="sidebar-btn" to="/grede-management" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", fontSize: 12, color: "#334155", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}><FaFileAlt style={{ width: 16, height: 16 }} /> Grede Management</Link>
              </div>
            )}

            <button
              type="button"
              className="sidebar-btn"
              onClick={() => setStudentMenuOpen((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '10px 12px',
                fontSize: 13,
                fontWeight: 700,
                background: 'linear-gradient(135deg, #eff6ff, #eef2ff)',
                color: '#1e3a8a',
                borderRadius: 12,
                border: '1px solid #c7d2fe',
                cursor: 'pointer'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FaChalkboardTeacher style={{ width: 18, height: 18 }} /> Students
              </span>
              <FaChevronDown style={{ transform: studentMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s ease' }} />
            </button>

            {studentMenuOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 10, paddingLeft: 10, borderLeft: '2px solid #dbeafe' }}>
                <Link className="sidebar-btn" to="/students" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', fontSize: 12, color: '#334155', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <FaChalkboardTeacher style={{ width: 16, height: 16 }} /> Student
                </Link>
                <Link className="sidebar-btn" to="/student-register" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', fontSize: 12, color: '#334155', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <FaFileAlt style={{ width: 16, height: 16 }} /> Register Student
                </Link>
                <Link className="sidebar-btn" to="/parents" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', fontSize: 12, color: '#334155', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <FaFileAlt style={{ width: 16, height: 16 }} /> Student Parent
                </Link>
              </div>
            )}
            <Link className="sidebar-btn" to="/analytics" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}>
              <FaChartLine style={{ width: 18, height: 18 }} /> Analytics
            </Link>

            <button
              className="sidebar-btn logout-btn"
              onClick={() => {
                localStorage.removeItem("admin");
                localStorage.removeItem("registrar");
                window.location.href = "/login";
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13 }}
            >
              <FaSignOutAlt style={{ width: 18, height: 18 }} /> Logout
            </button>
          </div>
        </div>

        {/* ---------------- MAIN CONTENT ---------------- */}
        <div className="main-content google-main" style={{ flex: '1 1 auto', minWidth: 0, maxWidth: 'none', margin: '0', boxSizing: 'border-box', alignSelf: 'flex-start', height: 'calc(100vh - 24px)', overflowY: 'auto', position: 'sticky', top: 24, scrollbarWidth: 'thin', scrollbarColor: 'transparent transparent', padding: '0 2px' }}>
          <div
            style={{
              maxWidth: FEED_MAX_WIDTH,
              margin: "0 auto 14px",
              background: "#ffffff",
              color: "#0f172a",
              borderRadius: 16,
              padding: "14px 16px",
              border: "1px solid #dbe4ff",
              boxShadow: "0 12px 26px rgba(15,23,42,0.08)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #1d4ed8, #3b82f6, #38bdf8)" }} />
            <div style={{ fontSize: 17, fontWeight: 800 }}>My Posts</div>
            <div style={{ marginTop: 5, fontSize: 12, color: "#475569" }}>Manage, edit, and review your announcements.</div>
          </div>

          {/* Post input box */}
          <div className="post-box" style={{ maxWidth: FEED_MAX_WIDTH, margin: "0 auto 14px", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.08)", border: "1px solid #dddfe2", background: "#fff", padding: "10px 12px" }}>
            <div
              className="fb-post-top"
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                background: "#fff",
                border: "none",
                boxShadow: "none",
                padding: 0,
              }}
            >
              <img
                src={admin.profileImage || "/default-profile.png"}
                alt="me"
                style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "1px solid #d8dadf", flexShrink: 0 }}
              />
              <button
                type="button"
                onClick={() => setShowCreatePostModal(true)}
                style={{
                  flex: 1,
                  height: 42,
                  border: "1px solid #d8dadf",
                  background: "#f0f2f5",
                  borderRadius: 999,
                  padding: "0 16px",
                  fontSize: 14,
                  textAlign: "left",
                  color: "#65676b",
                  cursor: "pointer",
                }}
              >
                What's on your mind?
              </button>
              <button
                type="button"
                onClick={() => setShowCreatePostModal(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 34,
                  height: 34,
                  border: "none",
                  borderRadius: 8,
                  background: "transparent",
                  color: "#f02849",
                  fontSize: 18,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
                title="Live video"
              >
                <AiFillVideoCamera className="fb-icon" />
              </button>
              <button
                type="button"
                onClick={() => setShowCreatePostModal(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 34,
                  height: 34,
                  border: "none",
                  borderRadius: 8,
                  background: "transparent",
                  color: "#45bd62",
                  fontSize: 18,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
                title="Photo"
              >
                <AiFillPicture className="fb-icon" />
              </button>
              {/* Reel button removed */}
            </div>
          </div>

          {showCreatePostModal && (
            <div
              onClick={() => setShowCreatePostModal(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(15, 23, 42, 0.45)",
                zIndex: 1200,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 12,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "min(620px, 100%)",
                  maxHeight: "90vh",
                  overflowY: "auto",
                  background: "#fff",
                  borderRadius: 16,
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 20px 40px rgba(15,23,42,0.2)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid #edf0f2" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>Create post</div>
                  <button
                    type="button"
                    onClick={() => setShowCreatePostModal(false)}
                    style={{ border: "none", background: "#f1f5f9", width: 30, height: 30, borderRadius: "50%", fontSize: 18, color: "#475569", cursor: "pointer", lineHeight: 1 }}
                    aria-label="Close create post modal"
                    title="Close"
                  >
                    ×
                  </button>
                </div>

                <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <img
                      src={admin.profileImage || "/default-profile.png"}
                      alt="me"
                      style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "2px solid #e6eefc" }}
                    />
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{admin.name || "Register Office"}</div>
                  </div>

                  <textarea
                    placeholder="What's on your mind?"
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    style={{
                      minHeight: 110,
                      resize: "vertical",
                      border: "1px solid #dbe3ef",
                      background: "#f8fafc",
                      borderRadius: 12,
                      padding: "10px 12px",
                      fontSize: 13,
                      lineHeight: 1.4,
                      outline: "none",
                      color: "#0f172a",
                    }}
                  />

                  <div className="fb-post-bottom" style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8, borderTop: "1px solid #edf0f2", flexWrap: "wrap" }}>
                    <label className="fb-upload" title="Upload media" style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid #d9dde3", cursor: "pointer", fontWeight: 700, fontSize: 12, color: "#1e293b" }}>
                      <AiFillPicture className="fb-icon" />
                      <span>Photo/Video</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files && e.target.files[0];
                          setPostMedia(file || null);
                        }}
                        accept="image/*,video/*"
                      />
                    </label>

                    <select
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      style={{ height: 32, borderRadius: 8, border: "1px solid #d9dde3", background: "#f8fafc", fontSize: 12, color: "#1e293b", padding: "0 10px", minWidth: 130 }}
                      title="Post target role"
                    >
                      {targetOptions.map((role) => {
                        const label = role === "all" ? "All Users" : `${role.charAt(0).toUpperCase()}${role.slice(1)}s`;
                        return (
                          <option key={role} value={role}>
                            {label}
                          </option>
                        );
                      })}
                    </select>

                    {postMedia && (
                      <div style={{
                        width: "40%",
                        minWidth: 120,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 10px",
                        background: "#f8fafc",
                        borderRadius: 8,
                        border: "1px solid #d9dde3",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        boxSizing: "border-box",
                      }}>
                        <span style={{ fontSize: 12, color: "#111", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {postMedia.name}
                        </span>
                        <button
                          onClick={() => {
                            setPostMedia(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#6b7280",
                            cursor: "pointer",
                            fontSize: 16,
                            lineHeight: 1,
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
                        type="button"
                        onClick={handleSubmitCreatePost}
                        style={{
                          border: "none",
                          background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                          borderRadius: 8,
                          height: 32,
                          minWidth: 70,
                          padding: "0 14px",
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Post
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Posts container */}
          {posts.length === 0 ? (
            <div style={{ maxWidth: FEED_MAX_WIDTH, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, boxShadow: '0 10px 20px rgba(15,23,42,0.06)', padding: 18, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
              You have no posts yet.
            </div>
          ) : (
            <div className="posts-container" style={{ maxWidth: FEED_MAX_WIDTH, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
              {posts.map((post) => (
                <div
                  className="post-card"
                  id={`post-${post.postId}`}
                  key={post.postId}
                  style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, boxShadow: "0 10px 20px rgba(15,23,42,0.06)", overflow: "hidden" }}
                >
                  <div className="post-header" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px 6px" }}>
                    <div className="img-circle" style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", border: "2px solid #e6eefc", flexShrink: 0 }}>
                      <img
                        src={post.adminProfile || admin.profileImage || "/default-profile.png"}
                        alt="profile"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    <div className="post-info" style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <h4 style={{ margin: 0, fontSize: 13, color: "#0f172a", fontWeight: 800 }}>{post.adminName || admin.name || "Admin"}</h4>
                      <span style={{ fontSize: 10, color: "#64748b", fontWeight: 500 }}>{post.time}{post.edited ? " · Edited" : ""} · {post.targetRole ? `Target: ${post.targetRole}` : "Public"}</span>
                    </div>
                  </div>

                  {editingPostId === post.postId ? (
                    <div style={{ padding: "0 10px 8px" }}>
                      <textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        style={{ width: "100%", minHeight: 72, resize: "vertical", border: "1px solid #d9dde3", borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                      />
                      <div style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button
                          onClick={() => setEditingPostId(null)}
                          style={{ border: "1px solid #d9dde3", background: "#fff", borderRadius: 6, height: 30, padding: "0 12px", color: "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveEdit(post.postId)}
                          disabled={savingId === post.postId}
                          style={{ border: "none", background: "#1877f2", borderRadius: 6, height: 30, padding: "0 12px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                        >
                          {savingId === post.postId ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p style={{ margin: 0, padding: "0 12px 10px", color: "#1e293b", fontSize: 13, lineHeight: 1.5 }}>{post.message}</p>
                      {post.postUrl && (
                        <div style={{ background: "#0f172a", borderTop: "1px solid #edf0f2", borderBottom: "1px solid #edf0f2" }}>
                          <img
                            src={post.postUrl}
                            alt="post media"
                            style={{ width: "100%", maxHeight: 420, objectFit: "contain", display: "block", margin: "0 auto" }}
                          />
                        </div>
                      )}

                      <div style={{ padding: "6px 10px 8px", display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid #edf0f2", background: '#fcfdff' }}>
                        <button
                          onClick={() => handleEdit(post.postId, post.message)}
                          style={{ border: "1px solid #d9dde3", background: "#fff", borderRadius: 8, height: 30, padding: "0 12px", color: "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(post.postId)}
                          disabled={deletingId === post.postId}
                          style={{ border: "none", background: "#ef4444", borderRadius: 8, height: 30, padding: "0 12px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                        >
                          {deletingId === post.postId ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT WIDGETS COLUMN */}
        <div className="dashboard-widgets" style={{ width: 'clamp(300px, 22vw, 380px)', minWidth: 300, maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 16, alignSelf: 'flex-start', height: 'calc(100vh - 24px)', overflowY: 'auto', position: 'sticky', top: 24, scrollbarWidth: 'thin', scrollbarColor: 'transparent transparent', paddingRight: 2, marginLeft: 'auto', marginRight: 0, opacity: showCreatePostModal ? 0.45 : 1, filter: showCreatePostModal ? 'blur(1px)' : 'none', pointerEvents: showCreatePostModal ? 'none' : 'auto', transition: 'opacity 180ms ease, filter 180ms ease' }}>
          <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 10px 24px rgba(15,23,42,0.08)', padding: '14px', border: '1px solid #e5e7eb' }}>
            <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#0f172a' }}>Quick Statistics</h4>
            <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center', justifyContent: 'center', flexWrap: 'nowrap' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ padding: '6px 10px', borderRadius: 12, background: '#fff', border: '1px solid #e6eefc', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>My Posts</div>
                  <div style={{ marginTop: 4, fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{posts.length}</div>
                </div>
                <div style={{ padding: '6px 10px', borderRadius: 12, background: '#fff', border: '1px solid #e6eefc', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Unread</div>
                  <div style={{ marginTop: 4, fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{messageCount}</div>
                </div>
                <div style={{ padding: '6px 10px', borderRadius: 12, background: '#fff', border: '1px solid #e6eefc', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Notifications</div>
                  <div style={{ marginTop: 4, fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{totalNotifications}</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 10px 24px rgba(15,23,42,0.08)', padding: '12px', border: '1px solid #e5e7eb' }}>
              <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: '#0f172a' }}>Today's Activity</h4>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 9px', fontSize: 11 }}>
                  <span style={{ color: '#334155', fontWeight: 600 }}>New Posts</span>
                  <strong style={{ color: '#0f172a' }}>{posts.filter(p => new Date(p.parsedTime || p.time).toDateString() === new Date().toDateString()).length}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 9px', fontSize: 11 }}>
                  <span style={{ color: '#334155', fontWeight: 600 }}>Messages</span>
                  <strong style={{ color: '#0f172a' }}>{messageCount}</strong>
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 7 }}>Recent Contacts</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {recentContacts.length === 0 ? (
                    <div style={{ fontSize: 11, color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '7px 9px' }}>
                      No recent chats yet
                    </div>
                  ) : (
                    recentContacts.map((contact) => (
                      <button
                        key={contact.userId}
                        type="button"
                        onClick={() => navigate('/all-chat', {
                          state: {
                            user: {
                              userId: contact.userId,
                              name: contact.name,
                              profileImage: contact.profileImage,
                              type: contact.type || 'user',
                            },
                          },
                        })}
                        style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', textAlign: 'left', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '6px 7px', cursor: 'pointer' }}
                      >
                        <img
                          src={contact.profileImage || '/default-profile.png'}
                          alt={contact.name}
                          style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {contact.name}
                          </div>
                          <div style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {contact.lastMessage || 'Open chat'}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 10px 24px rgba(15,23,42,0.08)', padding: '12px', border: '1px solid #e5e7eb' }}>
              <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: '#0f172a' }}>Upcoming Deadlines</h4>
              <ul style={{ margin: '10px 0 0 0', padding: 0, listStyle: 'none', fontSize: 11, color: '#334155', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <li style={{ padding: '8px 9px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc' }}>Fee Payment: Mar 10</li>
                <li style={{ padding: '8px 9px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc' }}>Report Submission: Mar 15</li>
                <li style={{ padding: '8px 9px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc' }}>Parent Meeting: Mar 20</li>
              </ul>
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 10px 24px rgba(15,23,42,0.08)', padding: '14px', border: '1px solid #e5e7eb' }}>
            <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#0f172a' }}>Sponsored Links</h4>
            <ul style={{ margin: '10px 0 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13 }}>
              <li style={{ color: '#1e3a8a', fontWeight: 600 }}>Gojo Study App</li>
              <li style={{ color: '#1e3a8a', fontWeight: 600 }}>Finance Portal</li>
              <li style={{ color: '#1e3a8a', fontWeight: 600 }}>HR Management</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MyPosts;