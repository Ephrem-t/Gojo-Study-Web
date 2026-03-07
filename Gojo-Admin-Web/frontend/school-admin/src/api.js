import axios from "axios";
import { BACKEND_BASE } from "./config.js";

const API_BASE = `${BACKEND_BASE}/api`;

export const registerAdmin = async (formData) => {
  const res = await axios.post(`${API_BASE}/register`, formData);
  return res.data;
};

export const loginAdmin = async (payload) => {
  const res = await axios.post(`${API_BASE}/login`, payload);
  return res.data;
};

export const getAdminProfile = async (identity) => {
  const res = await axios.get(`${API_BASE}/admin/${identity}`);
  return res.data;
};

export const getAllPosts = async () => {
  const res = await axios.get(`${API_BASE}/get_posts`);
  return res.data;
};

export const createPost = async (formData) => {
  const res = await axios.post(`${API_BASE}/create_post`, formData);
  return res.data;
};

export const deletePost = async (postId, adminId) => {
  const res = await axios.delete(`${API_BASE}/delete_post/${postId}`, {
    params: { adminId },
  });
  return res.data;
};
