// src/api.js
import axios from "axios";

const API_BASE = "http://127.0.0.1:5000/api";

// ---- Admin APIs ----
export const registerAdmin = async (data) => {
  try {
    const res = await axios.post(`${API_BASE}/register`, data);
    return res.data;
  } catch (err) {
    console.error(err);
    return { success: false, message: "Registration failed" };
  }
};

export const loginAdmin = async (data) => {
  try {
    const res = await axios.post(`${API_BASE}/login`, data);
    return res.data;
  } catch (err) {
    console.error(err);
    return { success: false, message: "Login failed" };
  }
};

export const getAdminProfile = async (adminId) => {
  try {
    const res = await axios.get(`${API_BASE}/profile/${adminId}`);
    return res.data;
  } catch (err) {
    console.error(err);
    return {};
  }
};

// ---- Posts APIs ----
export const getPosts = async () => {
  try {
    const res = await axios.get(`${API_BASE}/posts`);
    return res.data;
  } catch (err) {
    console.error(err);
    return [];
  }
};
import axios from "axios";

const API_BASE = "http://127.0.0.1:5000/api";

// ---------------- AUTH ----------------
export const getAdmin = async (id) => {
  const res = await axios.get(`${API_BASE}/admin/${id}`);
  return res.data;
};

// ---------------- POSTS ----------------
export const getPosts = async () => {
  const res = await axios.get(`${API_BASE}/posts`);
  return res.data;
};

export const createPost = async (postData) => {
  const res = await axios.post(`${API_BASE}/posts`, postData);
  return res.data;
};

export const deletePost = async (postId) => {
  const res = await axios.delete(`${API_BASE}/posts/${postId}`);
  return res.data;
};
