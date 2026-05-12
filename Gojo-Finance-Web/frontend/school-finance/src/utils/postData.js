import axios from "axios";
import { BACKEND_BASE } from "../config";
import { clearCachedValue, getOrLoad } from "./requestCache";

const POST_TTL_MS = 2 * 60 * 1000;

function getSchoolFeedKey(schoolCode) {
  return `finance:posts:school:${schoolCode || "__root__"}`;
}

function getMyPostsKey(adminId, schoolCode) {
  return `finance:posts:mine:${schoolCode || "__root__"}:${adminId || "__none__"}`;
}

function normalizePostRecord(post) {
  const postId = String(post?.postId || post?.id || "");
  const rawTime = post?.time || post?.createdAt || post?.timestamp || 0;
  const timeValue = Number.isFinite(Number(rawTime)) ? Number(rawTime) : Date.parse(rawTime) || 0;

  return {
    ...post,
    postId,
    message: post?.message || post?.postText || "",
    adminName: post?.adminName || post?.financeName || "Admin",
    adminProfile: post?.adminProfile || post?.financeProfile || "/default-profile.png",
    sortTime: timeValue,
  };
}

function normalizeListPayload(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : Object.entries(payload || {}).map(([postId, post]) => ({ postId, ...post }));

  return rows
    .map(normalizePostRecord)
    .sort((left, right) => Number(right.sortTime || 0) - Number(left.sortTime || 0));
}

export async function loadScopedPosts({ schoolCode, force = false } = {}) {
  return getOrLoad(
    getSchoolFeedKey(schoolCode),
    async () => {
      const response = await axios.get(`${BACKEND_BASE}/api/get_posts`, {
        params: schoolCode ? { schoolCode } : undefined,
      });

      return normalizeListPayload(response.data);
    },
    { ttlMs: POST_TTL_MS, persist: true, force }
  );
}

export async function loadMyPosts({ adminId, schoolCode, force = false } = {}) {
  if (!adminId) return [];

  return getOrLoad(
    getMyPostsKey(adminId, schoolCode),
    async () => {
      const response = await axios.get(`${BACKEND_BASE}/api/get_my_posts/${adminId}`, {
        params: schoolCode ? { schoolCode } : undefined,
      });

      return normalizeListPayload(response.data);
    },
    { ttlMs: POST_TTL_MS, persist: true, force }
  );
}

export function invalidateScopedPosts(schoolCode) {
  clearCachedValue(getSchoolFeedKey(schoolCode));
}

export function invalidateMyPosts(adminId, schoolCode) {
  clearCachedValue(getMyPostsKey(adminId, schoolCode));
}