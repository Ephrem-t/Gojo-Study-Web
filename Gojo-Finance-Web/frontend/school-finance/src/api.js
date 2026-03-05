// src/api.js
import axios from "axios";
import { BACKEND_BASE } from "./config";

const API_BASE = `${BACKEND_BASE}/api`;

// ---- Auth / Admin (kept names for compatibility) ----
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

// ---------------- Generic resources (posts) ----------------
export const getPosts = async () => {
  try {
    const res = await axios.get(`${API_BASE}/posts`);
    return res.data;
  } catch (err) {
    console.error(err);
    return [];
  }
};

export const createPost = async (postData) => {
  const res = await axios.post(`${API_BASE}/posts`, postData);
  return res.data;
};

export const deletePost = async (postId) => {
  const res = await axios.delete(`${API_BASE}/posts/${postId}`);
  return res.data;
};

export const getAdmin = async (id) => {
  const res = await axios.get(`${API_BASE}/admin/${id}`);
  return res.data;
};
