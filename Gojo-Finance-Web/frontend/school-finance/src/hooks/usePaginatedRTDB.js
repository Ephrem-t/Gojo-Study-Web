import { useEffect, useState } from "react";
import axios from "axios";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { BACKEND_BASE } from "../config";

const PAGE_SIZE = 20;

function getStoredAuth() {
  if (typeof window === "undefined") {
    return {};
  }

  const parse = (raw) => {
    try {
      return JSON.parse(raw || "") || {};
    } catch {
      return {};
    }
  };

  const finance = parse(window.localStorage.getItem("finance"));
  const admin = parse(window.localStorage.getItem("admin"));

  return finance.schoolCode ? finance : admin;
}

function toStudentContact(studentId, studentNode) {
  const basicInfo = studentNode?.basicStudentInformation || {};

  return {
    key: studentId,
    id: studentId,
    studentId,
    userId: studentNode?.userId || studentNode?.use || studentNode?.user || "",
    name: studentNode?.name || basicInfo?.name || studentNode?.username || `Student ${studentId}`,
    username: studentNode?.username || "",
    email: studentNode?.email || basicInfo?.email || "",
    phone: studentNode?.phone || basicInfo?.phone || "",
    profileImage:
      studentNode?.profileImage ||
      basicInfo?.studentPhoto ||
      basicInfo?.profileImage ||
      "/default-profile.png",
    grade: studentNode?.grade || basicInfo?.grade || "",
    section: studentNode?.section || basicInfo?.section || "",
    parentLinks: studentNode?.parents || {},
    rawOrderValue: studentNode?.name || studentNode?.userId || "",
  };
}

function buildUserLookupByUserId(usersNode) {
  const lookup = {};

  Object.values(usersNode || {}).forEach((user) => {
    const userId = String(user?.userId || "").trim();
    if (userId) {
      lookup[userId] = user;
    }
  });

  return lookup;
}

function toParentContact(parentId, parentNode, parentUsersById, studentsNode) {
  const userId = parentNode?.userId || "";
  const user = parentUsersById?.[userId] || {};
  const childLinks = Object.values(parentNode?.children || {});
  const firstChild = childLinks[0] || null;
  const childStudentId = String(firstChild?.studentId || "");
  const childStudent = studentsNode?.[childStudentId] || null;
  const childBasicInfo = childStudent?.basicStudentInformation || {};

  return {
    key: parentId,
    id: parentId,
    parentId,
    userId,
    name: user?.name || user?.username || parentNode?.name || parentId || "Parent",
    username: user?.username || parentNode?.username || "",
    email: user?.email || parentNode?.email || "",
    phone: user?.phone || user?.phoneNumber || parentNode?.phone || "",
    profileImage: user?.profileImage || parentNode?.profileImage || "/default-profile.png",
    childName: childStudent?.name || childBasicInfo?.name || childStudent?.username || "N/A",
    childRelationship: firstChild?.relationship || "N/A",
    children: parentNode?.children || {},
    rawOrderValue: parentNode?.userId || "",
  };
}

async function loadSupportNode(queryClient, schoolCode, nodeName) {
  const cacheKey = ["finance-node", schoolCode, nodeName];
  const cached = queryClient.getQueryData(cacheKey);

  if (cached) {
    return cached;
  }

  const response = await axios.get(`${BACKEND_BASE}/api/nodes/${nodeName}`, {
    params: { schoolCode },
  });

  const nextValue = response.data || {};
  queryClient.setQueryData(cacheKey, nextValue);
  return nextValue;
}

export default function usePaginatedRTDB(nodePath, orderByField) {
  const [pageIndex, setPageIndex] = useState(0);
  const [cursors, setCursors] = useState([]);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: [nodePath, pageIndex],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const schoolCode = getStoredAuth()?.schoolCode || "";
      let prevCursorKey = null;

      if (!schoolCode) {
        return { items: [], hasNext: false, lastKey: null };
      }

      const params = {
        schoolCode,
        orderBy: orderByField,
        limit: PAGE_SIZE + 1,
      };

      if (pageIndex > 0) {
        const prevPage = queryClient.getQueryData([nodePath, pageIndex - 1]);

        if (!prevPage?.items?.length) {
          return { items: [], hasNext: false, lastKey: null };
        }

        const prevLastItem = prevPage.items[prevPage.items.length - 1];
        const prevLastValue = prevLastItem?.[orderByField];
        prevCursorKey = cursors[pageIndex - 1] || prevLastItem?.key || null;

        if (prevLastValue === undefined || prevCursorKey === null) {
          return { items: [], hasNext: false, lastKey: null };
        }

        params.startAtValue = String(prevLastValue);
        params.startAtKey = prevCursorKey;
      }

      const response = await axios.get(`${BACKEND_BASE}/api/nodes/${nodePath}/paged`, {
        params,
      });

      const rawItems = response.data?.items || [];

      if (!rawItems.length) {
        return { items: [], hasNext: false, lastKey: null };
      }

      let rows;

      if (nodePath === "Parents") {
        const [usersNode, studentsNode] = await Promise.all([
          loadSupportNode(queryClient, schoolCode, "Users"),
          loadSupportNode(queryClient, schoolCode, "Students"),
        ]);

        const parentUsersById = buildUserLookupByUserId(usersNode || {});

        rows = rawItems.map((item) => toParentContact(item.key, item || {}, parentUsersById, studentsNode || {}));
      } else {
        rows = rawItems.map((item) => toStudentContact(item.key, item || {}));
      }

      const dedupedRows =
        pageIndex > 0 && prevCursorKey
          ? rows.filter((item) => item.key !== prevCursorKey)
          : rows;

      const hasNext = Boolean(response.data?.hasMore) || dedupedRows.length > PAGE_SIZE;
      const items = hasNext ? dedupedRows.slice(0, PAGE_SIZE) : dedupedRows;
      const lastKey = items.length ? items[items.length - 1].key : null;

      return { items, hasNext, lastKey };
    },
  });

  useEffect(() => {
    if (!data?.lastKey) {
      return;
    }

    setCursors((prev) => {
      if (prev[pageIndex] === data.lastKey) {
        return prev;
      }

      const next = [...prev];
      next[pageIndex] = data.lastKey;
      return next;
    });
  }, [data?.lastKey, pageIndex]);

  const hasPrev = pageIndex > 0;
  const hasNext = Boolean(data?.hasNext);

  const goNext = () => {
    if (!hasNext) {
      return;
    }
    setPageIndex((prev) => prev + 1);
  };

  const goPrev = () => {
    if (!hasPrev) {
      return;
    }
    setPageIndex((prev) => Math.max(prev - 1, 0));
  };

  return {
    items: data?.items || [],
    isLoading,
    isError,
    pageIndex,
    goNext,
    goPrev,
    hasNext,
    hasPrev,
  };
}
