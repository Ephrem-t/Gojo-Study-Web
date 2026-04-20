import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api';
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AiFillPicture, AiFillVideoCamera } from "react-icons/ai";
import { FaBell, FaFacebookMessenger, FaCog, FaUsers, FaBuilding, FaClipboardList, FaChalkboardTeacher, FaChartLine, FaChartPie, FaBirthdayCake, FaCalendarAlt, FaClock, FaArrowUp, FaArrowDown, FaMale, FaFemale, FaThumbsUp, FaTrashAlt, FaPlus } from "react-icons/fa";
import { get, getDatabase, ref, update } from 'firebase/database';
import EthiopicCalendar from 'ethiopic-calendar';
import './Dashboard.css';
import '../styles/global.css';
import DashboardOverview from '../components/DashboardOverview';
import { app } from '../firebase';
import { getEmployeeJob, getEmployeeMeta, getEmployeeName, getEmployeeProfileImage } from '../hrData';
import { createProfilePlaceholder, resolveAvatarImage, resolveProfileImage } from '../utils/profileImage';

const DASHBOARD_RESOURCE_CACHE = new Map();
const DASHBOARD_EMPLOYEES_CACHE_KEY = 'dashboard:employees:v2';
const DASHBOARD_ATTENDANCE_CACHE_KEY = 'dashboard:attendance:90';
const DASHBOARD_POSTS_CACHE_KEY = 'dashboard:posts:25';
const DASHBOARD_CALENDAR_CACHE_KEY = 'dashboard:calendar:upcoming:120';

const DEFAULT_PROFILE_IMAGE = '/default-profile.png';

const ETHIOPIAN_MONTHS = [
  'Meskerem',
  'Tikimt',
  'Hidar',
  'Tahsas',
  'Tir',
  'Yekatit',
  'Megabit',
  'Miyazya',
  'Ginbot',
  'Sene',
  'Hamle',
  'Nehase',
  'Pagume',
];

const DEFAULT_ETHIOPIAN_SPECIAL_DAYS = [
  { month: 1, day: 1, title: 'Enkutatash', notes: 'Ethiopian New Year.' },
  { month: 1, day: 17, title: 'Meskel', notes: 'Finding of the True Cross.' },
  { month: 4, day: 29, title: 'Genna', notes: 'Ethiopian Christmas.' },
  { month: 5, day: 11, title: 'Timkat', notes: 'Epiphany celebration.' },
  { month: 6, day: 23, title: 'Adwa Victory Day', notes: 'National remembrance day.' },
  { month: 8, day: 23, title: 'International Labour Day', notes: 'Public holiday.' },
  { month: 9, day: 1, title: "Patriots' Victory Day", notes: 'Public holiday.' },
  { month: 9, day: 20, title: 'Downfall of the Derg', notes: 'National public holiday.' },
];

const YEAR_SPECIFIC_GOVERNMENT_CLOSURES_GREGORIAN = {
  2017: [
    { date: '2025-03-31', title: 'Eid al-Fitr', notes: 'Government holiday (may vary by moon sighting).' },
    { date: '2025-06-06', title: 'Eid al-Adha', notes: 'Government holiday (may vary by moon sighting).' },
    { date: '2025-09-05', title: 'Mawlid', notes: 'Government holiday (may vary by moon sighting).' },
  ],
  2018: [
    { date: '2026-03-20', title: 'Eid al-Fitr', notes: 'Government holiday (may vary by moon sighting).' },
    { date: '2026-05-27', title: 'Eid al-Adha', notes: 'Government holiday (may vary by moon sighting).' },
    { date: '2026-08-26', title: 'Mawlid', notes: 'Government holiday (may vary by moon sighting).' },
  ],
  2019: [
    { date: '2027-03-10', title: 'Eid al-Fitr', notes: 'Government holiday (may vary by moon sighting).' },
    { date: '2027-05-17', title: 'Eid al-Adha', notes: 'Government holiday (may vary by moon sighting).' },
    { date: '2027-08-15', title: 'Mawlid', notes: 'Government holiday (may vary by moon sighting).' },
  ],
  2020: [
    { date: '2028-02-27', title: 'Eid al-Fitr', notes: 'Government holiday (may vary by moon sighting).' },
    { date: '2028-05-05', title: 'Eid al-Adha', notes: 'Government holiday (may vary by moon sighting).' },
    { date: '2028-08-04', title: 'Mawlid', notes: 'Government holiday (may vary by moon sighting).' },
  ],
  2021: [
    { date: '2029-02-14', title: 'Eid al-Fitr', notes: 'Government holiday (may vary by moon sighting).' },
    { date: '2029-04-24', title: 'Eid al-Adha', notes: 'Government holiday (may vary by moon sighting).' },
    { date: '2029-07-24', title: 'Mawlid', notes: 'Government holiday (may vary by moon sighting).' },
  ],
  2022: [
    { date: '2030-02-03', title: 'Eid al-Fitr', notes: 'Government holiday (may vary by moon sighting).' },
    { date: '2030-04-13', title: 'Eid al-Adha', notes: 'Government holiday (may vary by moon sighting).' },
    { date: '2030-07-13', title: 'Mawlid', notes: 'Government holiday (may vary by moon sighting).' },
  ],
  2023: [
    { date: '2031-01-23', title: 'Eid al-Fitr', notes: 'Government holiday (may vary by moon sighting).' },
    { date: '2031-04-02', title: 'Eid al-Adha', notes: 'Government holiday (may vary by moon sighting).' },
    { date: '2031-07-02', title: 'Mawlid', notes: 'Government holiday (may vary by moon sighting).' },
  ],
  2024: [
    { date: '2032-01-11', title: 'Eid al-Fitr', notes: 'Government holiday (may vary by moon sighting).' },
    { date: '2032-03-21', title: 'Eid al-Adha', notes: 'Government holiday (may vary by moon sighting).' },
    { date: '2032-06-20', title: 'Mawlid', notes: 'Government holiday (may vary by moon sighting).' },
  ],
  2025: [
    { date: '2032-12-31', title: 'Eid al-Fitr', notes: 'Government holiday (may vary by moon sighting).' },
    { date: '2033-03-10', title: 'Eid al-Adha', notes: 'Government holiday (may vary by moon sighting).' },
    { date: '2033-06-09', title: 'Mawlid', notes: 'Government holiday (may vary by moon sighting).' },
  ],
};

const CALENDAR_MANAGER_ROLES = new Set([
  'hr',
  'hr_admin',
  'hr_officer',
  'human_resource',
  'human_resources',
  'admin',
  'admins',
  'school_admin',
  'school_admins',
  'registrar',
  'registerer',
]);

const buildYearSpecificGovernmentClosures = (ethiopianYear) => {
  const gregorianEvents = YEAR_SPECIFIC_GOVERNMENT_CLOSURES_GREGORIAN[ethiopianYear] || [];

  return gregorianEvents
    .map((eventItem) => {
      const [year, month, day] = String(eventItem.date || '').split('-').map(Number);
      if (!year || !month || !day) {
        return null;
      }

      const ethiopianDate = EthiopicCalendar.ge(year, month, day);
      if (ethiopianDate.year !== ethiopianYear) {
        return null;
      }

      return {
        month: ethiopianDate.month,
        day: ethiopianDate.day,
        title: eventItem.title,
        notes: eventItem.notes,
      };
    })
    .filter(Boolean);
};

const getOrthodoxEasterDate = (gregorianYear) => {
  const a = gregorianYear % 4;
  const b = gregorianYear % 7;
  const c = gregorianYear % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const julianMonth = Math.floor((d + e + 114) / 31);
  const julianDay = ((d + e + 114) % 31) + 1;

  const julianDateAsGregorian = new Date(gregorianYear, julianMonth - 1, julianDay);
  julianDateAsGregorian.setDate(julianDateAsGregorian.getDate() + 13);
  return julianDateAsGregorian;
};

const buildMovableOrthodoxClosures = (ethiopianYear) => {
  const movableEvents = [];
  const seenEventKeys = new Set();

  [ethiopianYear + 7, ethiopianYear + 8].forEach((gregorianYear) => {
    const easterDate = getOrthodoxEasterDate(gregorianYear);
    const goodFridayDate = new Date(easterDate);
    goodFridayDate.setDate(goodFridayDate.getDate() - 2);

    [
      {
        title: 'Siklet',
        notes: 'Good Friday school closure.',
        date: goodFridayDate,
      },
      {
        title: 'Fasika',
        notes: 'Orthodox Easter school closure.',
        date: easterDate,
      },
    ].forEach((eventItem) => {
      const ethDate = EthiopicCalendar.ge(
        eventItem.date.getFullYear(),
        eventItem.date.getMonth() + 1,
        eventItem.date.getDate(),
      );

      if (ethDate.year !== ethiopianYear) {
        return;
      }

      const eventKey = `${ethDate.year}-${ethDate.month}-${ethDate.day}-${eventItem.title}`;
      if (seenEventKeys.has(eventKey)) {
        return;
      }

      seenEventKeys.add(eventKey);
      movableEvents.push({
        month: ethDate.month,
        day: ethDate.day,
        title: eventItem.title,
        notes: eventItem.notes,
      });
    });
  });

  return movableEvents;
};

const buildDefaultCalendarEvents = (ethiopianYear) => [
  ...DEFAULT_ETHIOPIAN_SPECIAL_DAYS,
  ...buildMovableOrthodoxClosures(ethiopianYear),
  ...buildYearSpecificGovernmentClosures(ethiopianYear),
].map((eventItem) => {
  const gregorianDate = EthiopicCalendar.eg(ethiopianYear, eventItem.month, eventItem.day);
  const isoDate = `${gregorianDate.year}-${String(gregorianDate.month).padStart(2, '0')}-${String(gregorianDate.day).padStart(2, '0')}`;

  return {
    id: `default-${ethiopianYear}-${eventItem.month}-${eventItem.day}`,
    title: eventItem.title,
    type: 'no-class',
    category: 'no-class',
    subType: 'general',
    notes: eventItem.notes,
    gregorianDate: isoDate,
    ethiopianDate: {
      year: ethiopianYear,
      month: eventItem.month,
      day: eventItem.day,
    },
    createdAt: '',
    createdBy: 'system-default',
    isDefault: true,
    showInUpcomingDeadlines: false,
    source: 'default-closure',
  };
});

function isLikelyVideoMedia(mediaType, mediaUrl) {
  if (String(mediaType || '').toLowerCase().startsWith('video/')) {
    return true;
  }

  return /\.(mp4|mov|webm|ogg|m4v)(?:$|\?)/i.test(String(mediaUrl || ''));
}

function sortedChatId(id1, id2) {
  return [String(id1 || '').trim(), String(id2 || '').trim()].sort().join('_');
}

function getConversationSortTime(rawValue) {
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue === 'string') {
    const numericValue = Number(rawValue);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }

    const parsedValue = new Date(rawValue).getTime();
    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return 0;
}

function formatFeedTimestamp(rawValue) {
  const timestamp = getConversationSortTime(rawValue);

  if (!timestamp) {
    return 'Just now';
  }

  const diffMs = Date.now() - timestamp;

  if (diffMs < 60 * 1000) {
    return 'Just now';
  }

  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d`;
  }

  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getCachedDashboardResource(cacheKey, loader, ttlMs = 60 * 1000) {
  const now = Date.now();
  const existing = DASHBOARD_RESOURCE_CACHE.get(cacheKey);

  if (existing?.promise) {
    return existing.promise;
  }

  if (existing && Object.prototype.hasOwnProperty.call(existing, 'data') && (now - existing.timestamp) < ttlMs) {
    return Promise.resolve(existing.data);
  }

  const promise = loader()
    .then((data) => {
      DASHBOARD_RESOURCE_CACHE.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    })
    .catch((error) => {
      DASHBOARD_RESOURCE_CACHE.delete(cacheKey);
      throw error;
    });

  DASHBOARD_RESOURCE_CACHE.set(cacheKey, { promise, timestamp: now });
  return promise;
}

function setCachedDashboardResource(cacheKey, data) {
  DASHBOARD_RESOURCE_CACHE.set(cacheKey, { data, timestamp: Date.now() });
}

function normalizeDashboardCollection(items) {
  if (Array.isArray(items)) {
    return items;
  }

  return Object.entries(items || {}).map(([id, payload]) => ({
    ...(payload || {}),
    id,
  }));
}

function StatCard({ title, value, icon, color }) {
  return (
    <div style={{ background: 'var(--surface-panel, #fff)', borderRadius: 16, padding: 16, minWidth: 180, flex: 1, border: '1px solid var(--border-soft, #d7e7fb)', boxShadow: 'var(--shadow-soft, 0 10px 24px rgba(0,122,251,0.1))', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 46, height: 46, background: 'var(--accent-soft, #e7f2ff)', color: color || 'var(--accent-strong, #007afb)', border: '1px solid var(--border-strong, #b5d2f8)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
        <div style={{ marginTop: 3, fontSize: 24, fontWeight: 800, color: 'var(--text-primary, #0f172a)', lineHeight: 1.1 }}>{value}</div>
      </div>
    </div>
  )
}

function getSafeProfileImage(profileImage) {
  return resolveProfileImage(profileImage);
}

function normalizePostLikes(likes) {
  if (Array.isArray(likes)) {
    return likes.reduce((accumulator, value) => {
      const normalizedKey = String(value || '').trim();
      if (normalizedKey) {
        accumulator[normalizedKey] = true;
      }
      return accumulator;
    }, {});
  }

  if (likes && typeof likes === 'object') {
    return Object.entries(likes).reduce((accumulator, [key, value]) => {
      const normalizedKey = String(key || '').trim();
      if (normalizedKey && value) {
        accumulator[normalizedKey] = true;
      }
      return accumulator;
    }, {});
  }

  return {};
}

function isPostLikedByActor(post, actorId) {
  const normalizedActorId = String(actorId || '').trim();
  if (!normalizedActorId) {
    return false;
  }

  return Boolean(normalizePostLikes(post?.likes)[normalizedActorId]);
}

function getResolvedLikeCount(post) {
  const explicitCount = Number(post?.likeCount);
  if (Number.isFinite(explicitCount) && explicitCount >= 0) {
    return explicitCount;
  }

  return Object.keys(normalizePostLikes(post?.likes)).length;
}

function Avatar({ src, alt, name, size = 40, style = {}, imageStyle = {}, textSize = 14 }) {
  const [hasImageError, setHasImageError] = useState(false);
  const displayName = name || alt || 'User';
  const resolvedSrc = hasImageError
    ? createProfilePlaceholder(displayName)
    : resolveAvatarImage(displayName, src);

  useEffect(() => {
    setHasImageError(false);
  }, [src]);

  const baseStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    overflow: 'hidden',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#ffffff',
    border: '1px solid var(--border-soft, #dbe2f2)',
    color: 'var(--accent-strong, #007AFB)',
    fontWeight: 800,
    letterSpacing: '0.04em',
    userSelect: 'none',
    ...style,
  };

  return (
    <div style={baseStyle}>
      <img
        src={resolvedSrc}
        alt={alt || name || 'User avatar'}
        onError={(event) => {
          const fallbackSrc = createProfilePlaceholder(displayName);
          if (event.currentTarget.src !== fallbackSrc) {
            event.currentTarget.src = fallbackSrc;
          }
          setHasImageError(true);
        }}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...imageStyle }}
      />
    </div>
  );
}

function LineChart({ data = [], width = 420, height = 120, color = '#4b6cb7' }) {
  if (!data.length) return null;
  const max = Math.max(...data);
  const points = data.map((d, i) => `${(i * (width / (data.length - 1))).toFixed(2)},${(height - (d / max) * height).toFixed(2)}`).join(' ');
  const pathD = `M ${points.split(' ').map(p => p).join(' L ')}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="url(#grad)" points={`${points} ${width},${height} 0,${height}`} stroke="none" />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (
        <circle key={i} cx={(i * (width / (data.length - 1))).toFixed(2)} cy={(height - (d / max) * height).toFixed(2)} r="3" fill={color} />
      ))}
    </svg>
  )
}

function GrowthTrendChart({ points = [], mode = 'monthly' }) {
  const [hoverIdx, setHoverIdx] = useState(-1);
  const uid = useMemo(() => Math.random().toString(36).slice(2, 9), []);
  if (!points || !points.length) return null;

  const width = 920;
  const height = 320;
  const leftPad = 64;
  const rightPad = 48;
  const topPad = 48;
  const bottomPad = 76;
  const chartWidth = width - leftPad - rightPad;
  const chartHeight = height - topPad - bottomPad;
  const stepX = points.length > 1 ? chartWidth / (points.length) : chartWidth;
  const maxCount = Math.max(1, ...points.map((p) => Math.max(p.totalCount || 0, p.maleCount || 0, p.femaleCount || 0)));

  const yFor = (v) => topPad + (1 - (Math.max(0, v || 0) / maxCount)) * chartHeight;

  const colors = { total: '#10b981', male: '#1d4ed8', female: '#db2777' };

  // bar layout
  const groupWidth = Math.min(64, stepX * 0.9);
  const barWidth = Math.max(10, Math.floor((groupWidth - 8) / 3));
  const gap = 4;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Employee growth (grouped bars)" style={{ overflow: 'visible' }}>
      <defs>
        <filter id={`shadow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0b1220" floodOpacity="0.06" />
        </filter>
      </defs>

      {/* background panel */}
      <rect x={leftPad - 12} y={topPad - 10} width={chartWidth + 24} height={chartHeight + 20} rx={12} fill="#fff" stroke="#eef3ff" />

      {/* y grid */}
      {Array.from({ length: 4 }).map((_, i) => {
        const val = Math.round((maxCount * i) / 3);
        const y = yFor(val);
        return (
          <g key={`tick-${i}`}>
            <line x1={leftPad} x2={width - rightPad} y1={y} y2={y} stroke="#f0f6ff" />
            <text x={leftPad - 12} y={y + 4} fontSize="11" fill="#64748b" textAnchor="end" fontWeight="700">{val}</text>
          </g>
        );
      })}

      {/* bars grouped per period */}
      {points.map((pt, idx) => {
        const xCenter = leftPad + idx * stepX + stepX / 2;
        const startX = xCenter - groupWidth / 2;
        const totalH = Math.max(0, chartHeight - (yFor(pt.totalCount || 0) - topPad));
        const maleH = Math.max(0, chartHeight - (yFor(pt.maleCount || 0) - topPad));
        const femaleH = Math.max(0, chartHeight - (yFor(pt.femaleCount || 0) - topPad));

        const totalX = startX;
        const maleX = startX + (barWidth + gap);
        const femaleX = startX + 2 * (barWidth + gap);

        return (
          <g key={`grp-${idx}`} onMouseEnter={() => setHoverIdx(idx)} onMouseLeave={() => setHoverIdx(-1)}>
            <rect x={totalX} y={topPad + (chartHeight - totalH)} width={barWidth} height={totalH} rx={4} fill={colors.total} opacity={0.96} style={{ filter: `url(#shadow-${uid})` }} />
            <rect x={maleX} y={topPad + (chartHeight - maleH)} width={barWidth} height={maleH} rx={4} fill={colors.male} opacity={0.98} />
            <rect x={femaleX} y={topPad + (chartHeight - femaleH)} width={barWidth} height={femaleH} rx={4} fill={colors.female} opacity={0.98} />

            {(idx % Math.max(1, Math.ceil(points.length / 6)) === 0 || idx === points.length - 1) ? (
              <text x={xCenter} y={height - 18} fontSize="12" textAnchor="middle" fill="#64748b" fontWeight="800">{pt.label}</text>
            ) : null}
          </g>
        );
      })}

      {/* legend */}
      <g>
        <rect x={width - rightPad - 220} y={14} width={208} height={44} rx={12} fill="#fff" stroke="#eef3ff" />
        <g transform={`translate(${width - rightPad - 200}, 34)`}> 
          <g>
            <rect x={0} y={-8} width={14} height={14} rx={3} fill={colors.total} />
            <text x={22} y={4} fontSize="12" fill={colors.total} fontWeight="800">Total</text>
          </g>
          <g transform="translate(86,0)">
            <rect x={0} y={-8} width={14} height={14} rx={3} fill={colors.male} />
            <text x={22} y={4} fontSize="12" fill={colors.male} fontWeight="800">Male</text>
          </g>
          <g transform="translate(150,0)">
            <rect x={0} y={-8} width={14} height={14} rx={3} fill={colors.female} />
            <text x={22} y={4} fontSize="12" fill={colors.female} fontWeight="800">Female</text>
          </g>
        </g>
      </g>

      {/* title */}
      <text x={leftPad} y={28} fontSize="15" fill="#07104a" fontWeight="900">{mode === 'monthly' ? 'Monthly Employee Registrations' : 'Yearly Employee Registrations'}</text>

      {/* hover tooltip */}
      {hoverIdx >= 0 ? (() => {
        const p = points[hoverIdx];
        const cx = leftPad + hoverIdx * stepX + stepX / 2;
        const boxW = 160;
        const tx = Math.min(width - rightPad - boxW - 8, Math.max(leftPad + 8, cx - boxW / 2));
        return (
          <g transform={`translate(${tx}, ${topPad + 8})`}>
            <rect x="0" y="0" width={boxW} height="76" rx="10" fill="#07104a" opacity="0.96" />
            <text x="12" y="18" fontSize="12" fill="#fff" fontWeight="800">{p.label}</text>
            <text x="12" y="36" fontSize="12" fill="#a7f3d0">Total: {p.totalCount || 0}</text>
            <text x="12" y="54" fontSize="12" fill="#bfdbfe">Male: {p.maleCount || 0}</text>
            <text x="92" y="54" fontSize="12" fill="#ffd6ea">Female: {p.femaleCount || 0}</text>
          </g>
        );
      })() : null}
    </svg>
  );
}

function DonutChart({ values = [], colors = [], size = 120 }) {
  const total = values.reduce((s, v) => s + v, 0) || 1;
  let angle = -90;
  const cx = size / 2, cy = size / 2, r = size / 2 - 10;
  const segments = values.map((v) => {
    const a = (v / total) * 360;
    const start = angle;
    const end = angle + a;
    angle = end;
    const large = a > 180 ? 1 : 0;
    const x1 = cx + r * Math.cos((Math.PI * start) / 180);
    const y1 = cy + r * Math.sin((Math.PI * start) / 180);
    const x2 = cx + r * Math.cos((Math.PI * end) / 180);
    const y2 = cy + r * Math.sin((Math.PI * end) / 180);
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return d;
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((d, i) => (
        <path key={i} d={d} fill={colors[i] || ['#4b6cb7', '#e0245e', '#f59e0b'][i % 3]} opacity={0.95} />
      ))}
      <circle cx={cx} cy={cy} r={r - 22} fill="#fff" />
    </svg>
  )
}

function GenderBar({ male = 0, female = 0, width = 220, height = 80 }) {
  const total = Math.max(1, male + female );
  const max = Math.max(male, female, 1);
  const barW = 40;
  const gap = 16;
  const startX = 10;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {[{k:'Male',v:male,color:'#4b6cb7'},{k:'Female',v:female,color:'#e0245e'}].map((b,i)=>{
        const h = Math.round((b.v / max) * (height - 30));
        const x = startX + i * (barW + gap);
        const y = height - h - 18;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx={6} fill={b.color} />
            <text x={x + barW/2} y={height - 4} fontSize={11} textAnchor="middle" fill="#374151">{b.k}</text>
            <text x={x + barW/2} y={y - 4} fontSize={12} textAnchor="middle" fill="#111827" fontWeight={700}>{b.v}</text>
          </g>
        )
      })}
    </svg>
  )
}

function PositionChart({ employees = [], maxBars = 6 }) {
  const counts = employees.reduce((acc, e) => {
    const p = (e.position || e.role || 'Other').trim();
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});
  const list = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0, maxBars);
  const total = employees.length || 1;
  return (
    <div style={{ width: '100%', padding: 8 }}>
      {list.map(([pos, cnt], i) => {
        const pct = Math.round((cnt/total)*100);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 120, fontSize: 13, color: '#374151' }}>{pos}</div>
            <div style={{ flex: 1, background: '#eef2ff', height: 10, borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: '#4b6cb7' }}></div>
            </div>
            <div style={{ width: 46, textAlign: 'right', fontSize: 13, color: '#6b7280' }}>{cnt} ({pct}%)</div>
          </div>
        )
      })}
      {list.length === 0 && <div className="muted">No position data</div>}
    </div>
  )
}

function Sparkline({ data = [], color = '#4b6cb7', width = 100, height = 28 }) {
  if (!data.length) return null;
  const max = Math.max(...data);
  const points = data.map((d, i) => `${(i * (width / (data.length - 1))).toFixed(2)},${(height - (d / max) * height).toFixed(2)}`).join(' ');
  const pathD = `M ${points.split(' ').map(p => p).join(' L ')}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function AttendanceTrendChart({ points = [], width = 700, height = 260, mode = 'bar' }) {
  if (!points || !points.length) return null;

  const [hoveredIndex, setHoveredIndex] = useState(-1);

  const leftPad = 48;
  const rightPad = 36;
  const topPad = 28;
  const bottomPad = 48;
  const chartWidth = width - leftPad - rightPad;
  const chartHeight = height - topPad - bottomPad;
  const maxCount = Math.max(1, ...points.map((p) => Math.max(p.presentCount || 0, p.lateCount || 0, p.absentCount || 0)));
  const stepX = points.length > 1 ? chartWidth / (points.length - 1) : chartWidth;
  const xForIndex = (index) => (points.length === 1 ? leftPad + chartWidth / 2 : leftPad + index * stepX);

  const yForCount = (v) => topPad + (1 - (Math.max(0, v || 0) / maxCount)) * chartHeight;
  const yForRate = (r) => topPad + (1 - (Math.max(0, Math.min(100, r || 0)) / 100)) * chartHeight;

  const groupWidth = Math.min(60, stepX * 0.9);
  const singleBarWidth = Math.max(6, Math.floor((groupWidth - 8) / 3));
  const gapBetweenBars = 4;
  const chartBottom = topPad + chartHeight;

  const countTicks = Array.from({ length: 4 }, (_, i) => Math.round((maxCount * i) / 3));
  const rateTicks = [0, 25, 50, 75, 100];
  const barColors = { present: '#16a34a', late: '#d97706', absent: '#dc2626' };

  const ratePoints = points.map((p, i) => ({ x: xForIndex(i), y: yForRate(p.rate || 0) }));
  const rateLinePath = ratePoints.length ? `M ${ratePoints.map((pt) => `${pt.x},${pt.y}`).join(' L ')}` : '';
  const firstRateX = ratePoints.length ? ratePoints[0].x : leftPad;
  const lastRateX = ratePoints.length ? ratePoints[ratePoints.length - 1].x : leftPad;
  const rateAreaPath = ratePoints.length ? `M ${firstRateX},${chartBottom} L ${ratePoints.map((pt) => `${pt.x},${pt.y}`).join(' L ')} L ${lastRateX},${chartBottom} Z` : '';
  const hoveredPoint = hoveredIndex >= 0 ? points[hoveredIndex] : null;
  const hoveredMeta = hoveredIndex >= 0 ? ratePoints[hoveredIndex] : null;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Attendance trend" style={{ display: 'block', width: '100%', minHeight: height }}>
      <defs>
        <linearGradient id="attendanceAreaGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#bfdbf7" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#bfdbf7" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* background grid */}
      <g>
        <rect x={leftPad} y={topPad} width={chartWidth} height={chartHeight} fill="#fcfdff" stroke="#e2e8f0" rx={8} />
      </g>

      {countTicks.map((tickValue) => {
        const y = yForCount(tickValue);
        return (
          <g key={`count-tick-${tickValue}`}>
            <line x1={leftPad} x2={width - rightPad} y1={y} y2={y} stroke="#eef2ff" strokeDasharray="4 6" />
            <text x={leftPad - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#64748b" fontWeight="700">{tickValue}</text>
          </g>
        );
      })}

      {rateTicks.map((tickValue) => {
        const y = yForRate(tickValue);
        return (
          <g key={`rate-tick-${tickValue}`}> 
            <text x={width - rightPad + 8} y={y + 4} textAnchor="start" fontSize="10" fill="#3157b7" fontWeight="700">{tickValue}%</text>
          </g>
        );
      })}

      {mode === 'bar'
        ? points.map((point, index) => {
            const xCenter = xForIndex(index);
            const leftStart = xCenter - groupWidth / 2;
            const presentValue = Number(point.presentCount) || 0;
            const lateValue = Number(point.lateCount) || 0;
            const absentValue = Number(point.absentCount) || 0;

            const bars = [
              { key: 'present', value: presentValue, x: leftStart },
              { key: 'late', value: lateValue, x: leftStart + singleBarWidth + gapBetweenBars },
              { key: 'absent', value: absentValue, x: leftStart + (singleBarWidth + gapBetweenBars) * 2 },
            ];

            return (
              <g key={`bars-${point.date || index}-${index}`}>
                {bars.map((bar) => {
                  const topY = yForCount(bar.value);
                  const barHeight = Math.max(0, chartBottom - topY);
                  return (
                    <rect key={`${bar.key}-${index}`} x={bar.x} y={topY} width={singleBarWidth} height={barHeight} rx="2" fill={barColors[bar.key]} opacity={hoveredIndex === index ? 1 : 0.92} />
                  );
                })}
              </g>
            );
          })
        : null}

      {mode === 'line' && rateAreaPath ? <path d={rateAreaPath} fill="url(#attendanceAreaGradient)" /> : null}
      {mode === 'line' && rateLinePath ? <path d={rateLinePath} fill="none" stroke="#3157b7" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /> : null}

      {points.map((point, index) => {
        const x = xForIndex(index);
        const y = yForRate(point.rate);
        return (
          <g key={`rate-point-${index}`}>
            {mode === 'line' ? <circle cx={x} cy={y} r={hoveredIndex === index ? '5' : '4'} fill="#fff" stroke="#3157b7" strokeWidth="1.8" /> : null}
            {(index % Math.max(1, Math.ceil(points.length / 6)) === 0 || index === points.length - 1) ? (
              <text x={x} y={chartBottom + 18} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="700">{point.label}</text>
            ) : null}
          </g>
        );
      })}

      {points.map((point, index) => {
        const xCenter = xForIndex(index);
        return (
          <rect
            key={`hover-zone-${point.date || index}`}
            x={xCenter - Math.max(22, stepX / 2)}
            y={topPad}
            width={Math.max(44, stepX)}
            height={chartHeight}
            fill="transparent"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseMove={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(-1)}
          />
        );
      })}

      {hoveredPoint && hoveredMeta ? (
        <g pointerEvents="none">
          <line x1={hoveredMeta.x} x2={hoveredMeta.x} y1={topPad} y2={chartBottom} stroke="#c7d2fe" strokeDasharray="4 5" />
          <rect
            x={Math.max(leftPad, Math.min(width - rightPad - 168, hoveredMeta.x - 84))}
            y={topPad + 8}
            width="168"
            height="74"
            rx="12"
            fill="#ffffff"
            stroke="#dbeafe"
          />
          <text x={Math.max(leftPad + 12, Math.min(width - rightPad - 156, hoveredMeta.x - 72))} y={topPad + 28} fontSize="11" fill="#64748b" fontWeight="800">{hoveredPoint.label}</text>
          <text x={Math.max(leftPad + 12, Math.min(width - rightPad - 156, hoveredMeta.x - 72))} y={topPad + 46} fontSize="12" fill="#0f172a" fontWeight="700">Rate: {hoveredPoint.rate || 0}%</text>
          <text x={Math.max(leftPad + 12, Math.min(width - rightPad - 156, hoveredMeta.x - 72))} y={topPad + 62} fontSize="11" fill="#166534" fontWeight="700">Present: {hoveredPoint.presentCount || 0}</text>
          <text x={Math.max(leftPad + 82, Math.min(width - rightPad - 86, hoveredMeta.x - 2))} y={topPad + 62} fontSize="11" fill="#92400e" fontWeight="700">Late: {hoveredPoint.lateCount || 0}</text>
          <text x={Math.max(leftPad + 12, Math.min(width - rightPad - 156, hoveredMeta.x - 72))} y={topPad + 76} fontSize="11" fill="#991b1b" fontWeight="700">Absent: {hoveredPoint.absentCount || 0}</text>
        </g>
      ) : null}

      <g>
        <text x={leftPad} y={18} fontSize="11" fill="#475569" fontWeight="800">{mode === 'line' ? 'Attendance Rate Trend' : 'Attendance Records (count)'}</text>
        <g transform={`translate(${leftPad + 168}, 11)`}>
          {mode === 'bar' ? (
            <>
              <rect x="0" y="0" width="10" height="10" fill="#16a34a" rx="2" />
              <text x="14" y="9" fontSize="10" fill="#166534" fontWeight="700">Present</text>
              <rect x="74" y="0" width="10" height="10" fill="#d97706" rx="2" />
              <text x="88" y="9" fontSize="10" fill="#92400e" fontWeight="700">Late</text>
              <rect x="130" y="0" width="10" height="10" fill="#dc2626" rx="2" />
              <text x="144" y="9" fontSize="10" fill="#991b1b" fontWeight="700">Absent</text>
            </>
          ) : (
            <>
              <line x1="0" y1="5" x2="26" y2="5" stroke="#3157b7" strokeWidth="2.4" />
              <circle cx="13" cy="5" r="3" fill="#fff" stroke="#3157b7" strokeWidth="1.8" />
              <text x="32" y="9" fontSize="10" fill="#3157b7" fontWeight="700">Rate %</text>
            </>
          )}
        </g>
      </g>
    </svg>
  );
}

function resolveDashboardSelection(action) {
  if (action === 'view-my-posts') {
    return { dashboardView: 'home', postFeedView: 'mine' };
  }

  if (action === 'view-overview') {
    return { dashboardView: 'overview', postFeedView: 'all' };
  }

  return { dashboardView: 'home', postFeedView: 'all' };
}

export default function Dashboard() {
  const [employees, setEmployees] = useState([]);
  const [attendanceByDate, setAttendanceByDate] = useState({});
  const [conversations, setConversations] = useState([]);
  const [posts, setPosts] = useState([]);
  const [upcomingCalendarEvents, setUpcomingCalendarEvents] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [postText, setPostText] = useState('');
  const [postMedia, setPostMedia] = useState(null);
  const [postMediaMeta, setPostMediaMeta] = useState(null);
  const [isOptimizingMedia, setIsOptimizingMedia] = useState(false);
  const [isPostSubmitting, setIsPostSubmitting] = useState(false);
  const [targetRole, setTargetRole] = useState('all');
  const [targetOptions] = useState(['all', 'teacher', 'management', 'finance', 'hr']);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [editingPostId, setEditingPostId] = useState('');
  const [existingPostMediaUrl, setExistingPostMediaUrl] = useState('');
  const [existingPostMediaType, setExistingPostMediaType] = useState('');
  const [showDeletePostModal, setShowDeletePostModal] = useState(false);
  const [pendingDeletePost, setPendingDeletePost] = useState(null);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [pendingLikePostIds, setPendingLikePostIds] = useState({});
  const [expandedPostDescriptions, setExpandedPostDescriptions] = useState({});
  const [admin, setAdmin] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("admin")) || {};
    } catch (e) {
      return {};
    }
  });
  const db = useMemo(() => getDatabase(app), []);
  const navigate = useNavigate();
  const location = useLocation();
  const initialSidebarAction = location.state?.dashboardAction;
  const initialDashboardSelection = resolveDashboardSelection(initialSidebarAction);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(() => {
    const now = new Date();
    const currentEthiopicDate = EthiopicCalendar.ge(
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate(),
    );

    return {
      year: currentEthiopicDate.year,
      month: currentEthiopicDate.month,
    };
  });
  const [dashboardView, setDashboardView] = useState(initialDashboardSelection.dashboardView);
  const [postFeedView, setPostFeedView] = useState(initialDashboardSelection.postFeedView);
  const [attendanceRecordView, setAttendanceRecordView] = useState('daily');
  const [attendanceChartMode, setAttendanceChartMode] = useState('bar');
  const [growthTrendView, setGrowthTrendView] = useState('monthly');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState('present');
  const [showAttendancePeopleList, setShowAttendancePeopleList] = useState(false);
  const [selectedCalendarIsoDate, setSelectedCalendarIsoDate] = useState('');
  const [hoveredCalendarIsoDate, setHoveredCalendarIsoDate] = useState('');
  const [showAllUpcomingDeadlines, setShowAllUpcomingDeadlines] = useState(false);
  const [calendarEventsLoading, setCalendarEventsLoading] = useState(false);
  const [calendarEventForm, setCalendarEventForm] = useState({
    title: '',
    category: 'no-class',
    subType: 'general',
    notes: '',
  });
  const [calendarEventSaving, setCalendarEventSaving] = useState(false);
  const [editingCalendarEventId, setEditingCalendarEventId] = useState('');
  const [calendarActionMessage, setCalendarActionMessage] = useState('');
  const [showCalendarEventModal, setShowCalendarEventModal] = useState(false);
  const [calendarModalContext, setCalendarModalContext] = useState('calendar');
  const fileInputRef = useRef(null);
  const CALENDAR_WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const adminChatUserId = String(admin?.userId || admin?.id || '').trim();
  const activeSchoolCode = String(admin?.activeSchoolCode || admin?.schoolCode || '').trim();
  const schoolPath = (path) => `Platform1/Schools/${activeSchoolCode}/${String(path || '').replace(/^\/+/, '')}`;
  const roleCandidates = [
    admin?.role,
    admin?.userType,
    admin?.accountType,
    admin?.userRole,
    admin?.position,
    admin?.staffType,
  ]
    .map((value) => String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_'))
    .filter(Boolean);
  const canManageCalendar = roleCandidates.some((value) => CALENDAR_MANAGER_ROLES.has(value))
    || Boolean(admin?.userId || admin?.id || admin?.hrId || admin?.adminId);
  const calendarCacheKey = `${DASHBOARD_CALENDAR_CACHE_KEY}:${activeSchoolCode || 'global'}`;

  const CALENDAR_EVENT_META = {
    academic: {
      label: 'Academic',
      color: 'var(--accent)',
      background: 'var(--accent-soft)',
      border: 'rgba(0, 122, 251, 0.18)',
    },
    'no-class': {
      label: 'No class',
      color: 'var(--warning)',
      background: 'var(--warning-soft)',
      border: 'var(--warning-border)',
    },
  };

  const getCalendarEventKey = (category) => {
    if (category === 'academic') return 'academic';
    return 'no-class';
  };

  const getCalendarEventMeta = (category) => {
    if (category === 'academic') return CALENDAR_EVENT_META.academic;
    return CALENDAR_EVENT_META['no-class'];
  };

  const normalizeCalendarEvent = (eventId, eventValue) => {
    const legacyType = eventValue?.type || 'academic';
    const category = eventValue?.category || (legacyType === 'academic' ? 'academic' : 'no-class');

    return {
      id: eventId,
      title: eventValue?.title || getCalendarEventMeta(category).label,
      type: getCalendarEventKey(category),
      category,
      subType: eventValue?.subType || 'general',
      notes: eventValue?.notes || '',
      gregorianDate: eventValue?.gregorianDate || '',
      ethiopianDate: eventValue?.ethiopianDate || null,
      createdAt: eventValue?.createdAt || '',
      createdBy: eventValue?.createdBy || '',
      showInUpcomingDeadlines: Boolean(eventValue?.showInUpcomingDeadlines),
      isDefault: false,
    };
  };

  const sortCalendarEvents = (events) => [...events].sort((leftEvent, rightEvent) => {
    const dateComparison = String(leftEvent.gregorianDate || '').localeCompare(String(rightEvent.gregorianDate || ''));
    if (dateComparison !== 0) return dateComparison;
    return String(leftEvent.createdAt || '').localeCompare(String(rightEvent.createdAt || ''));
  });

  const formatCalendarDeadlineDate = (isoDate) => {
    if (!isoDate) return '';

    const parsedDate = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) return '';

    return parsedDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const resetPostComposerState = () => {
    setEditingPostId('');
    setPostText('');
    setPostMedia(null);
    setPostMediaMeta(null);
    setExistingPostMediaUrl('');
    setExistingPostMediaType('');
    setTargetRole('all');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openCreatePostModal = () => {
    resetPostComposerState();
    setShowCreatePostModal(true);
  };

  const closePostComposerModal = () => {
    if (isPostSubmitting) return;
    setShowCreatePostModal(false);
    resetPostComposerState();
  };

  const handleStartEditPost = (post) => {
    if (!post) return;

    const nextTargetRole = String(post.targetRole || 'all').trim().toLowerCase();
    setEditingPostId(String(post.postId || ''));
    setPostText(String(post.message || ''));
    setPostMedia(null);
    setPostMediaMeta(null);
    setExistingPostMediaUrl(String(post.postUrl || ''));
    setExistingPostMediaType(String(post.mediaType || ''));
    setTargetRole(targetOptions.includes(nextTargetRole) ? nextTargetRole : 'all');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setShowCreatePostModal(true);
  };

  const handleCloseDeletePostModal = () => {
    if (isDeletingPost) return;
    setPendingDeletePost(null);
    setShowDeletePostModal(false);
  };

  const handleRequestDeletePost = (post) => {
    if (!post || !isPostOwnedByCurrentUser(post)) return;
    setPendingDeletePost(post);
    setShowDeletePostModal(true);
  };

  const loadCalendarEvents = async ({ forceRefresh = false } = {}) => {
    if (!activeSchoolCode) {
      setCalendarEvents([]);
      setUpcomingCalendarEvents([]);
      return;
    }

    setCalendarEventsLoading(true);

    const fetchCalendarEvents = async () => {
      const response = await api.get('/api/calendar_events');
      const rawEvents = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.events)
          ? response.data.events
          : [];

      return sortCalendarEvents(
        rawEvents
          .map((eventItem, index) => normalizeCalendarEvent(eventItem?.id || `event-${index}`, eventItem))
          .filter((eventItem) => eventItem.gregorianDate),
      );
    };

    try {
      const normalizedEvents = forceRefresh
        ? await fetchCalendarEvents()
        : await getCachedDashboardResource(calendarCacheKey, fetchCalendarEvents, 5 * 60 * 1000);

      if (forceRefresh) {
        setCachedDashboardResource(calendarCacheKey, normalizedEvents);
      }

      const now = new Date();
      const todayIsoDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const overviewWindowEnd = new Date(now);
      overviewWindowEnd.setDate(overviewWindowEnd.getDate() + 120);
      const overviewWindowEndIsoDate = `${overviewWindowEnd.getFullYear()}-${String(overviewWindowEnd.getMonth() + 1).padStart(2, '0')}-${String(overviewWindowEnd.getDate()).padStart(2, '0')}`;

      setCalendarEvents(normalizedEvents);
      setUpcomingCalendarEvents(
        normalizedEvents.filter((eventItem) => (
          eventItem.showInUpcomingDeadlines
          && String(eventItem.gregorianDate || '') >= todayIsoDate
          && String(eventItem.gregorianDate || '') <= overviewWindowEndIsoDate
        )),
      );
    } catch (error) {
      console.error('Failed to load calendar events:', error);
      setCalendarEvents([]);
      setUpcomingCalendarEvents([]);
    } finally {
      setCalendarEventsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    getCachedDashboardResource(DASHBOARD_EMPLOYEES_CACHE_KEY, async () => {
      const res = await api.get('/employees/summary');
      return normalizeDashboardCollection(res.data || []);
    })
      .then((items) => {
        if (!cancelled) {
          setEmployees(items);
        }
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setEmployees([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    getCachedDashboardResource(DASHBOARD_ATTENDANCE_CACHE_KEY, async () => {
      const response = await api.get('/api/employee_attendance/history', {
        params: { days: 90 },
      });
      const map = response.data?.attendanceByDate;
      return map && typeof map === 'object' ? map : {};
    }, 45 * 1000)
      .then((map) => {
        if (!cancelled) {
          setAttendanceByDate(map);
        }
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setAttendanceByDate({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    getCachedDashboardResource(DASHBOARD_POSTS_CACHE_KEY, async () => {
      const response = await api.get('/api/get_posts', {
        params: { limit: 25 },
      });
      return Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.posts)
          ? response.data.posts
          : [];
    }, 30 * 1000)
      .then((items) => {
        if (!cancelled) {
          setPosts(items);
        }
      })
      .catch((error) => {
        console.error('Failed to load posts:', error);
        if (!cancelled) {
          setPosts([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setShowAllUpcomingDeadlines(false);
    loadCalendarEvents();
  }, [activeSchoolCode]);

  const employeeContactByUserId = useMemo(() => {
    return (employees || []).reduce((accumulator, employee) => {
      const job = getEmployeeJob(employee);
      const meta = getEmployeeMeta(employee);
      const userId = String(employee?.userId || meta?.userId || '').trim();

      if (!userId) {
        return accumulator;
      }

      accumulator[userId] = {
        userId,
        name: getEmployeeName(employee),
        profileImage: getSafeProfileImage(getEmployeeProfileImage(employee)),
        role: job?.employeeCategory || job?.category || job?.position || employee?.role || employee?.position || 'Staff',
        department: job?.department || employee?.department || 'Unassigned',
      };

      return accumulator;
    }, {});
  }, [employees]);

  useEffect(() => {
    let cancelled = false;

    async function loadConversations() {
      if (!adminChatUserId || !activeSchoolCode) {
        setConversations([]);
        return;
      }

      try {
        const chatsSnapshot = await get(ref(db, schoolPath('Chats')));
        const chats = chatsSnapshot.val() || {};

        const nextConversations = Object.entries(chats)
          .map(([chatId, chat]) => {
            const participants = Object.keys(chat?.participants || {}).map((value) => String(value || '').trim());

            if (!participants.includes(adminChatUserId)) {
              return null;
            }

            const otherUserId = participants.find((value) => value && value !== adminChatUserId);
            if (!otherUserId) {
              return null;
            }

            const contactMeta = employeeContactByUserId[otherUserId] || {};
            const lastMessage = chat?.lastMessage || {};
            const lastMessageText = String(lastMessage?.text || '').trim()
              || (String(lastMessage?.type || '').toLowerCase() === 'image' ? 'Image' : 'Open chat');

            return {
              chatId: String(chatId || sortedChatId(adminChatUserId, otherUserId)),
              contact: {
                userId: otherUserId,
                name: contactMeta.name || otherUserId,
                profileImage: getSafeProfileImage(contactMeta.profileImage),
                role: contactMeta.role || 'Staff',
                department: contactMeta.department || 'Unassigned',
              },
              displayName: contactMeta.name || otherUserId,
              profile: getSafeProfileImage(contactMeta.profileImage),
              lastMessageText,
              lastMessageTime: getConversationSortTime(
                lastMessage?.timeStamp || lastMessage?.time || chat?.updatedAt || chat?.createdAt || 0,
              ),
              unreadForMe: Number(chat?.unread?.[adminChatUserId] || 0),
            };
          })
          .filter(Boolean)
          .sort((left, right) => (right?.lastMessageTime || 0) - (left?.lastMessageTime || 0));

        if (!cancelled) {
          setConversations(nextConversations);
        }
      } catch (error) {
        console.error('Error loading dashboard conversations:', error);
        if (!cancelled) {
          setConversations([]);
        }
      }
    }

    loadConversations();

    return () => {
      cancelled = true;
    };
  }, [activeSchoolCode, adminChatUserId, db, employeeContactByUserId]);

  const count = employees.length;
  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean))).length || 3;
  const openPositions = Math.max(2, Math.round((count / 10))) ;

  const attendanceSeries = useMemo(() => {
    const dateEntries = Object.entries(attendanceByDate || {})
      .filter(([dateKey, recordMap]) => typeof dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && recordMap && typeof recordMap === 'object')
      .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate));

    return dateEntries.map(([dateKey, recordMap]) => {
      const records = Object.values(recordMap || {}).filter((entry) => entry && typeof entry === 'object');
      const total = records.length;

      if (total === 0) {
        return { date: dateKey, rate: 0, total: 0, presentCount: 0, lateCount: 0, absentCount: 0 };
      }

      const lateCount = records.filter((entry) => String(entry.status || '').toLowerCase() === 'late').length;
      const presentCount = records.filter((entry) => {
        const status = String(entry.status || '').toLowerCase();
        if (status === 'present') {
          return true;
        }

        if (status === 'late' || status === 'absent') {
          return false;
        }

        return entry.present === true;
      }).length;
      const attendingCount = presentCount + lateCount;
      const absentCount = Math.max(0, total - attendingCount);

      return {
        date: dateKey,
        rate: Math.round((attendingCount / total) * 100),
        total,
        presentCount,
        lateCount,
        absentCount,
      };
    });
  }, [attendanceByDate]);

  const attendanceDisplaySeries = useMemo(() => {
    const source = Array.isArray(attendanceSeries) ? attendanceSeries : [];
    if (!source.length) return [];

    if (attendanceRecordView === 'daily') {
      const today = new Date();
      const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const todayRecord = source.find((item) => item.date === todayIso);

      const latestRecord = todayRecord || source[source.length - 1];

      if (!latestRecord) {
        return [];
      }

      return [{
        ...latestRecord,
        bucketKey: latestRecord.date,
        label: latestRecord.date === todayIso ? 'Today' : latestRecord.date,
      }];
    }

    const buckets = source.reduce((accumulator, item) => {
      const dateValue = new Date(`${item.date}T00:00:00`);
      if (Number.isNaN(dateValue.getTime())) {
        return accumulator;
      }

      let key = item.date;
      let label = item.date.slice(5);

      if (attendanceRecordView === 'weekly') {
        const day = dateValue.getDay();
        const mondayOffset = day === 0 ? -6 : 1 - day;
        const weekStart = new Date(dateValue);
        weekStart.setDate(dateValue.getDate() + mondayOffset);
        const weekYear = weekStart.getFullYear();
        const weekMonth = String(weekStart.getMonth() + 1).padStart(2, '0');
        const weekDay = String(weekStart.getDate()).padStart(2, '0');
        key = `${weekYear}-${weekMonth}-${weekDay}`;
        label = `Wk ${weekMonth}/${weekDay}`;
      }

      if (attendanceRecordView === 'monthly') {
        const monthYear = dateValue.getFullYear();
        const monthNumber = String(dateValue.getMonth() + 1).padStart(2, '0');
        key = `${monthYear}-${monthNumber}`;
        label = `${monthYear}/${monthNumber}`;
      }

      if (!accumulator[key]) {
        accumulator[key] = {
          bucketKey: key,
          label,
          total: 0,
          presentCount: 0,
          lateCount: 0,
          absentCount: 0,
        };
      }

      accumulator[key].total += item.total || 0;
      accumulator[key].presentCount += item.presentCount || 0;
      accumulator[key].lateCount += item.lateCount || 0;
      accumulator[key].absentCount += item.absentCount || 0;

      return accumulator;
    }, {});

    return Object.values(buckets)
      .sort((leftItem, rightItem) => String(leftItem.bucketKey).localeCompare(String(rightItem.bucketKey)))
      .map((bucket) => {
        const attendingCount = (bucket.presentCount || 0) + (bucket.lateCount || 0);
        const total = bucket.total || 0;
        return {
          date: bucket.bucketKey,
          label: bucket.label,
          total,
          presentCount: bucket.presentCount || 0,
          lateCount: bucket.lateCount || 0,
          absentCount: bucket.absentCount || 0,
          rate: total > 0 ? Math.round((attendingCount / total) * 100) : 0,
        };
      });
  }, [attendanceSeries, attendanceRecordView]);

  const fallbackAttendanceRate = employees.length
    ? `${Math.round((employees.filter((employee) => employee.presentToday).length / employees.length) * 100) || 96}%`
    : '—';
  const latestAttendanceRate = attendanceDisplaySeries.length > 0
    ? `${attendanceDisplaySeries[attendanceDisplaySeries.length - 1].rate}%`
    : fallbackAttendanceRate;
  const attendanceRate = latestAttendanceRate;
  const attendanceLineDataRaw = attendanceSeries.length > 0
    ? attendanceSeries.slice(-6).map((item) => item.rate)
    : [];
  const attendanceLineData = attendanceLineDataRaw.length === 1
    ? [attendanceLineDataRaw[0], attendanceLineDataRaw[0]]
    : attendanceLineDataRaw;
  const latestAttendanceSnapshot = attendanceDisplaySeries.length > 0
    ? attendanceDisplaySeries[attendanceDisplaySeries.length - 1]
    : null;
  const attendanceChartPoints = useMemo(() => {
    const map = attendanceByDate || {};
    const todayIso = new Date().toISOString().slice(0, 10);
    const availableDates = Object.keys(map).filter((dateKey) => /^\d{4}-\d{2}-\d{2}$/.test(dateKey)).sort();
    const latestAvailableDate = availableDates[availableDates.length - 1] || todayIso;
    const normalizeRecords = (recordMap) => {
      const records = Object.values(recordMap || {}).filter((r) => r && typeof r === 'object');
      const lateCount = records.filter((entry) => String(entry.status || '').toLowerCase() === 'late').length;
      const presentCount = records.filter((entry) => {
        const status = String(entry.status || '').toLowerCase();
        if (status === 'present') return true;
        if (status === 'late' || status === 'absent') return false;
        return entry.present === true;
      }).length;
      const absentCount = Math.max(0, records.length - (presentCount + lateCount));
      const total = records.length;
      const rate = total > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 0;
      return { total, presentCount, lateCount, absentCount, rate };
    };

    // DAILY: show that day's attendance as a single point (or empty)
    if (attendanceRecordView === 'daily') {
      const targetDate = map[todayIso] ? todayIso : latestAvailableDate;
      const p = normalizeRecords(map[targetDate]);
      return [{ date: targetDate, label: targetDate === todayIso ? 'Today' : targetDate, ...p }];
    }

    // WEEKLY: show each day in the selected/most-recent week as its own point
    if (attendanceRecordView === 'weekly') {
      const refDate = (attendanceDisplaySeries && attendanceDisplaySeries.length > 0 && attendanceDisplaySeries[attendanceDisplaySeries.length - 1].date) || todayIso;
      const d = new Date(`${refDate}T00:00:00`);
      if (Number.isNaN(d.getTime())) return [];
      const day = d.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day; // Monday as first day
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() + mondayOffset);
      const days = Array.from({ length: 7 }, (_, i) => {
        const dt = new Date(weekStart);
        dt.setDate(weekStart.getDate() + i);
        const iso = dt.toISOString().slice(0, 10);
        const meta = normalizeRecords(map[iso]);
        const label = dt.toLocaleDateString('en-US', { weekday: 'short' });
        return { date: iso, label, ...meta };
      });
      return days;
    }

    // MONTHLY: show each week inside the selected/most-recent month as a point (week ranges)
    if (attendanceRecordView === 'monthly') {
      const refDate = (attendanceDisplaySeries && attendanceDisplaySeries.length > 0 && attendanceDisplaySeries[attendanceDisplaySeries.length - 1].date) || todayIso;
      const d = new Date(`${refDate}T00:00:00`);
      if (Number.isNaN(d.getTime())) return [];
      const year = d.getFullYear();
      const month = d.getMonth();
      const firstOfMonth = new Date(year, month, 1);
      const lastOfMonth = new Date(year, month + 1, 0);

      // find the Monday on or before the first of month
      const firstDayWeekday = firstOfMonth.getDay();
      const firstWeekStart = new Date(firstOfMonth);
      firstWeekStart.setDate(firstOfMonth.getDate() - ((firstDayWeekday + 6) % 7));

      const weeks = [];
      let weekStart = new Date(firstWeekStart);
      while (weekStart <= lastOfMonth) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        // clamp to month
        const startClamp = new Date(Math.max(weekStart.getTime(), firstOfMonth.getTime()));
        const endClamp = new Date(Math.min(weekEnd.getTime(), lastOfMonth.getTime()));
        // accumulate days within this week
        let total = 0, presentCount = 0, lateCount = 0, absentCount = 0;
        for (let dt = new Date(startClamp); dt <= endClamp; dt.setDate(dt.getDate() + 1)) {
          const iso = dt.toISOString().slice(0, 10);
          const meta = normalizeRecords(map[iso]);
          total += meta.total; presentCount += meta.presentCount; lateCount += meta.lateCount; absentCount += meta.absentCount;
        }
        const rate = total > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 0;
        const label = `${startClamp.getMonth() + 1}/${startClamp.getDate()}`;
        weeks.push({ date: `${startClamp.toISOString().slice(0,10)}_${endClamp.toISOString().slice(0,10)}`, label, total, presentCount, lateCount, absentCount, rate });
        weekStart.setDate(weekStart.getDate() + 7);
      }
      return weeks;
    }

    return [];
  }, [attendanceByDate, attendanceRecordView, attendanceDisplaySeries]);
  const recentAttendanceRecords = attendanceDisplaySeries.slice(-4).reverse();

  const getAttendanceBucketMeta = (dateString, viewMode) => {
    const dateValue = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(dateValue.getTime())) {
      return { key: dateString, label: dateString };
    }

    if (viewMode === 'weekly') {
      const day = dateValue.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const weekStart = new Date(dateValue);
      weekStart.setDate(dateValue.getDate() + mondayOffset);
      const weekYear = weekStart.getFullYear();
      const weekMonth = String(weekStart.getMonth() + 1).padStart(2, '0');
      const weekDay = String(weekStart.getDate()).padStart(2, '0');
      return {
        key: `${weekYear}-${weekMonth}-${weekDay}`,
        label: `Wk ${weekMonth}/${weekDay}`,
      };
    }

    if (viewMode === 'monthly') {
      const monthYear = dateValue.getFullYear();
      const monthNumber = String(dateValue.getMonth() + 1).padStart(2, '0');
      return {
        key: `${monthYear}-${monthNumber}`,
        label: `${monthYear}/${monthNumber}`,
      };
    }

    return {
      key: dateString,
      label: dateString.slice(5),
    };
  };

  const todayIsoAttendanceDate = new Date().toISOString().slice(0, 10);
  const attendancePeopleDateLabel = attendanceRecordView === 'daily'
    ? `Today (${todayIsoAttendanceDate})`
    : attendanceRecordView === 'weekly'
      ? 'All people in visible weekly records'
      : 'All people in visible monthly records';
  const employeeNameById = useMemo(() => {
    return (employees || []).reduce((accumulator, employee) => {
      const employeeId = employee?.id || employee?.employeeId || employee?.job?.employeeId || employee?.profileData?.job?.employeeId;
      if (!employeeId) return accumulator;

      const personal = employee?.personal || employee?.profileData?.personal || {};
      const fullName = employee?.name
        || employee?.fullName
        || [personal.firstName, personal.middleName, personal.lastName].filter(Boolean).join(' ')
        || 'Employee';
      accumulator[String(employeeId)] = fullName;
      return accumulator;
    }, {});
  }, [employees]);
  const attendancePeopleList = useMemo(() => {
    const visibleBucketKeys = new Set((attendanceDisplaySeries || []).map((entry) => entry?.date).filter(Boolean));
    if (!visibleBucketKeys.size) return [];

    const normalizeStatus = (record) => {
      const rawStatus = String(record?.status || '').toLowerCase();
      if (rawStatus === 'present' || rawStatus === 'late' || rawStatus === 'absent') {
        return rawStatus;
      }
      return record?.present === true ? 'present' : 'absent';
    };

    const rows = [];

    Object.entries(attendanceByDate || {}).forEach(([sourceDate, recordMap]) => {
      if (!recordMap || typeof recordMap !== 'object') return;

      const bucketMeta = getAttendanceBucketMeta(sourceDate, attendanceRecordView);
      if (!visibleBucketKeys.has(bucketMeta.key)) return;

      Object.entries(recordMap).forEach(([employeeId, record]) => {
        rows.push({
          employeeId,
          status: normalizeStatus(record),
          name: employeeNameById[employeeId] || `Employee ${employeeId}`,
          sourceDate,
          bucketLabel: bucketMeta.label,
          bucketKey: bucketMeta.key,
        });
      });
    });

    return rows
      .filter((entry) => entry.status === attendanceStatusFilter)
      .sort((leftEntry, rightEntry) => {
        if (leftEntry.bucketKey !== rightEntry.bucketKey) {
          return String(rightEntry.bucketKey).localeCompare(String(leftEntry.bucketKey));
        }
        if (leftEntry.sourceDate !== rightEntry.sourceDate) {
          return String(rightEntry.sourceDate).localeCompare(String(leftEntry.sourceDate));
        }
        return leftEntry.name.localeCompare(rightEntry.name);
      });
  }, [attendanceByDate, attendanceDisplaySeries, attendanceRecordView, attendanceStatusFilter, employeeNameById]);

  // additional KPIs
  const leavesToday = employees.filter(e => e.presentToday === false).length;
  const avgTenure = employees.length ? (employees.reduce((s,e)=>{ if(e.hireDate){ const yrs = (Date.now() - new Date(e.hireDate).getTime())/(1000*60*60*24*365); return s + yrs } return s },0)/employees.length) : 0;
  const avgTenureFormatted = avgTenure ? `${avgTenure.toFixed(1)} yrs` : '—';
  const turnoverRate =  employees.length ? `${Math.round((employees.filter(e=>e.terminated === true).length / employees.length) * 100)}%` : '—';

  // upcoming birthdays within 30 days
  const upcomingBirthdays = employees.filter(e => e.birthDate).map(e => ({...e, birthDateObj: new Date(e.birthDate)})).filter(e=>{
    const now = new Date();
    const thisYear = new Date(now.getFullYear(), e.birthDateObj.getMonth(), e.birthDateObj.getDate());
    const diff = (thisYear - now)/(1000*60*60*24);
    return diff >=0 && diff <= 30;
  }).slice(0,6);

  // upcoming contract expirations
  const upcomingContracts = employees.filter(e=>e.contractEnd).map(e=>({...e, contractDateObj: new Date(e.contractEnd)})).filter(e=>{
    const now = new Date();
    const diff = (e.contractDateObj - now)/(1000*60*60*24);
    return diff >=0 && diff <= 90;
  }).slice(0,6);

  const parseDateSafe = (value) => {
    if (!value) return null;
    const dateObj = new Date(value);
    if (Number.isNaN(dateObj.getTime())) return null;
    return dateObj;
  };

  const getEmployeeHireDate = (employee) => {
    const raw = employee || {};
    const employment = raw.employment || raw.profileData?.employment || {};
    const job = { ...(raw.job || raw.profileData?.job || {}), ...employment };
    return (
      parseDateSafe(raw.hireDate) ||
      parseDateSafe(job.hireDate) ||
      parseDateSafe(job.startDate) ||
      parseDateSafe(job.employmentStartDate) ||
      parseDateSafe(raw.createdAt)
    );
  };

  const recentHires = employees
    .slice()
    .sort((a, b) => {
      const da = getEmployeeHireDate(a);
      const db = getEmployeeHireDate(b);
      return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
    })
    .slice(0, 5)
    .map((e) => {
      const hireDate = getEmployeeHireDate(e);
      return {
        name: e.name || e.fullName || 'Unnamed',
        role: e.role || e.position || e.job?.position || e.profileData?.job?.position || 'Staff',
        date: hireDate ? hireDate.toLocaleDateString() : '—',
        avatar: e.profileImage || '/default-profile.png',
      };
    });

  const monthlyGrowthSeries = useMemo(() => {
    const monthCount = 12;
    const startMonths = Array.from({ length: monthCount }, (_, index) => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth() - (monthCount - 1 - index), 1);
    });

    function extractGender(e) {
      const raw = e || {};
      const g = (
        raw.gender ||
        raw.personal?.gender ||
        raw.profileData?.personal?.gender ||
        ''
      ).toString().toLowerCase();
      if (g.includes('f')) return 'female';
      if (g.includes('m')) return 'male';
      return;
    }

    return startMonths.map((monthStart) => {
      const year = monthStart.getFullYear();
      const month = monthStart.getMonth();
      let male = 0, female = 0, total = 0;
      employees.forEach(employee => {
        const hireDate = getEmployeeHireDate(employee);
        if (!hireDate) return;
        if (hireDate.getFullYear() === year && hireDate.getMonth() === month) {
          total++;
          const g = extractGender(employee);
          if (g === 'male') male++;
          else if (g === 'female') female++;
        }
      });
      return {
        key: `${year}-${String(month + 1).padStart(2, '0')}`,
        label: monthStart.toLocaleDateString('en-US', { month: 'short' }),
        totalCount: total,
        maleCount: male,
        femaleCount: female,
      };
    });
  }, [employees]);

  const annualGrowthSeries = useMemo(() => {
    const yearCount = 6;
    const startYear = new Date().getFullYear() - (yearCount - 1);

    function extractGender(e) {
      const raw = e || {};
      const g = (
        raw.gender ||
        raw.personal?.gender ||
        raw.profileData?.personal?.gender ||
        ''
      ).toString().toLowerCase();
      if (g.includes('f')) return 'female';
      if (g.includes('m')) return 'male';
      return;
    }

    return Array.from({ length: yearCount }, (_, index) => {
      const year = startYear + index;
      let male = 0, female = 0, total = 0;
      employees.forEach(employee => {
        const hireDate = getEmployeeHireDate(employee);
        if (!hireDate) return;
        if (hireDate.getFullYear() === year) {
          total++;
          const g = extractGender(employee);
          if (g === 'male') male++;
          else if (g === 'female') female++;
        }
      });
      return {
        key: String(year),
        label: String(year),
        totalCount: total,
        maleCount: male,
        femaleCount: female,
      };
    });
  }, [employees]);

  const growthTrendPoints = growthTrendView === 'monthly' ? monthlyGrowthSeries : annualGrowthSeries;
  // convert periodic counts into cumulative (upward) series for monotonic growth lines
  const cumulativeGrowthPoints = useMemo(() => {
    if (!Array.isArray(growthTrendPoints) || growthTrendPoints.length === 0) return [];
    let runTotal = 0, runMale = 0, runFemale = 0;
    return growthTrendPoints.map((p) => {
      runTotal += Number(p.totalCount || 0);
      runMale += Number(p.maleCount || 0);
      runFemale += Number(p.femaleCount || 0);
      return {
        ...p,
        totalCount: runTotal,
        maleCount: runMale,
        femaleCount: runFemale,
      };
    });
  }, [growthTrendPoints]);
  // total across visible growth points (use totalCount field)
  const currentGrowthTotal = growthTrendPoints.reduce((sum, point) => sum + (Number(point.totalCount || 0)), 0);

  // find the period with the highest totalCount (peak year/month)
  const peakGrowthPoint = growthTrendPoints.reduce((best, point) => ((Number(point.totalCount || 0)) > (Number(best.totalCount || 0)) ? point : best), growthTrendPoints[0] || { label: '—', totalCount: 0 });
  const peakYear = peakGrowthPoint ? (peakGrowthPoint.label || peakGrowthPoint.key || '—') : '—';

  // growth trend based on real hire dates from the database (last 6 months)
  const months = 6;
  const monthStarts = Array.from({ length: months }, (_, index) => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1);
  });

  const unknownHireDateCount = employees.filter((employee) => !getEmployeeHireDate(employee)).length;

  const lineData = monthStarts.map((monthStart) => {
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999);
    const hiredUpToMonthEnd = employees.reduce((total, employee) => {
      const hireDate = getEmployeeHireDate(employee);
      if (!hireDate) return total;
      return hireDate <= monthEnd ? total + 1 : total;
    }, 0);
    return unknownHireDateCount + hiredUpToMonthEnd;
  });

  // gender distribution for donut / cards
  function extractGender(e) {
    const raw = e || {};
    const g = (
      raw.gender ||
      raw.personal?.gender ||
      raw.profileData?.personal?.gender ||
      ''
    )
      .toString()
      .toLowerCase();
    if (g.includes('f')) return 'female';
    if (g.includes('m')) return 'male';
    return ;
  }

  const genderCounts = employees.reduce((acc, e) => {
    const g = extractGender(e);
    if (g) {
      acc[g] = (acc[g] || 0) + 1;
    }
    return acc;
  }, {});
  const maleCount = genderCounts.male || 0;
  const femaleCount = genderCounts.female || 0;
  
  const genderValues = [maleCount, femaleCount];

  const notificationCount = upcomingBirthdays.length + upcomingContracts.length;
  const totalUnreadMessages = conversations.reduce((sum, conversation) => sum + Number(conversation?.unreadForMe || 0), 0);
  const messageCount = totalUnreadMessages;
  const totalNotifications = notificationCount + totalUnreadMessages;
  const todayPostCount = posts.filter((post) => {
    if (!post?.time) return false;
    const postDate = new Date(post.time);
    return !Number.isNaN(postDate.getTime()) && postDate.toDateString() === new Date().toDateString();
  }).length;

  const handleCalendarMonthChange = (offset) => {
    setCalendarViewDate((currentDate) => {
      let nextYear = currentDate.year;
      let nextMonth = currentDate.month + offset;

      while (nextMonth < 1) {
        nextMonth += 13;
        nextYear -= 1;
      }

      while (nextMonth > 13) {
        nextMonth -= 13;
        nextYear += 1;
      }

      return {
        year: nextYear,
        month: nextMonth,
      };
    });
  };

  const calendarNow = new Date();
  const currentEthiopicDate = EthiopicCalendar.ge(
    calendarNow.getFullYear(),
    calendarNow.getMonth() + 1,
    calendarNow.getDate(),
  );
  const calendarDaysInMonth = calendarViewDate.month === 13
    ? calendarViewDate.year % 4 === 3
      ? 6
      : 5
    : 30;
  const calendarMonthStartGregorian = EthiopicCalendar.eg(
    calendarViewDate.year,
    calendarViewDate.month,
    1,
  );
  const calendarMonthEndGregorian = EthiopicCalendar.eg(
    calendarViewDate.year,
    calendarViewDate.month,
    calendarDaysInMonth,
  );
  const calendarFirstWeekday = new Date(
    calendarMonthStartGregorian.year,
    calendarMonthStartGregorian.month - 1,
    calendarMonthStartGregorian.day,
  ).getDay();
  const isCurrentCalendarMonth = calendarViewDate.year === currentEthiopicDate.year
    && calendarViewDate.month === currentEthiopicDate.month;
  const calendarHighlightedDay = isCurrentCalendarMonth ? currentEthiopicDate.day : null;
  const calendarMonthLabel = `${ETHIOPIAN_MONTHS[calendarViewDate.month - 1]} ${calendarViewDate.year}`;

  const defaultCalendarEvents = buildDefaultCalendarEvents(calendarViewDate.year);
  const mergedCalendarEvents = sortCalendarEvents([
    ...defaultCalendarEvents,
    ...calendarEvents,
  ]);
  const calendarEventsByDate = mergedCalendarEvents.reduce((eventsMap, eventItem) => {
    const eventDate = String(eventItem.gregorianDate || '');
    if (!eventDate) {
      return eventsMap;
    }

    if (!eventsMap[eventDate]) {
      eventsMap[eventDate] = [];
    }

    eventsMap[eventDate].push(eventItem);
    return eventsMap;
  }, {});

  const calendarDays = Array.from(
    { length: calendarFirstWeekday + calendarDaysInMonth },
    (_, index) => {
      const dayNumber = index - calendarFirstWeekday + 1;
      if (dayNumber < 1 || dayNumber > calendarDaysInMonth) {
        return null;
      }

      const gregorianDate = EthiopicCalendar.eg(
        calendarViewDate.year,
        calendarViewDate.month,
        dayNumber,
      );
      const isoDate = `${gregorianDate.year}-${String(gregorianDate.month).padStart(2, '0')}-${String(gregorianDate.day).padStart(2, '0')}`;

      return {
        ethDay: dayNumber,
        isoDate,
        gregorianDate,
        events: calendarEventsByDate[isoDate] || [],
      };
    },
  );

  const monthlyCalendarEvents = sortCalendarEvents(
    [...calendarDays]
      .filter(Boolean)
      .flatMap((dayItem) => dayItem.events.map((eventItem) => ({ ...eventItem, ethDay: dayItem.ethDay }))),
  );

  const selectedCalendarDay = calendarDays.find((dayItem) => dayItem?.isoDate === selectedCalendarIsoDate) || null;
  const selectedCalendarEvents = selectedCalendarDay?.events || [];

  const deadlineWindowEnd = new Date(calendarNow);
  deadlineWindowEnd.setDate(deadlineWindowEnd.getDate() + 30);
  const deadlineWindowEndIsoDate = `${deadlineWindowEnd.getFullYear()}-${String(deadlineWindowEnd.getMonth() + 1).padStart(2, '0')}-${String(deadlineWindowEnd.getDate()).padStart(2, '0')}`;
  const calendarTodayIsoDate = `${calendarNow.getFullYear()}-${String(calendarNow.getMonth() + 1).padStart(2, '0')}-${String(calendarNow.getDate()).padStart(2, '0')}`;

  const upcomingDeadlineEvents = calendarEvents
    .filter((eventItem) => (
      eventItem.showInUpcomingDeadlines
      && eventItem.category === 'academic'
      && String(eventItem.gregorianDate || '') >= calendarTodayIsoDate
      && String(eventItem.gregorianDate || '') <= deadlineWindowEndIsoDate
    ))
    .sort((leftItem, rightItem) => String(leftItem.gregorianDate || '').localeCompare(String(rightItem.gregorianDate || '')));

  const visibleUpcomingDeadlineEvents = showAllUpcomingDeadlines
    ? upcomingDeadlineEvents
    : upcomingDeadlineEvents.slice(0, 3);

  useEffect(() => {
    const preferredDay = calendarDays.find((dayItem) => dayItem?.ethDay === calendarHighlightedDay)
      || calendarDays.find(Boolean)
      || null;

    if (!preferredDay) {
      setSelectedCalendarIsoDate('');
      return;
    }

    const stillVisible = calendarDays.some((dayItem) => dayItem?.isoDate === selectedCalendarIsoDate);
    if (!stillVisible) {
      setSelectedCalendarIsoDate(preferredDay.isoDate);
    }
  }, [
    calendarViewDate.year,
    calendarViewDate.month,
    calendarHighlightedDay,
    calendarDays.length,
    selectedCalendarIsoDate,
  ]);

  const todayHires = employees.filter((employee) => {
    const hireDate = getEmployeeHireDate(employee);
    if (!hireDate) return false;
    return hireDate.toDateString() === new Date().toDateString();
  }).length;

  const recentConversations = conversations.slice(0, 5);
  const recentContacts = recentConversations
    .map((conversation) => ({
      userId: conversation?.contact?.userId || conversation?.chatId,
      chatId: conversation?.chatId,
      conversation,
      name: conversation?.displayName || conversation?.contact?.name || 'User',
      profileImage: getSafeProfileImage(conversation?.profile || conversation?.contact?.profileImage),
      role: conversation?.contact?.role || 'Staff',
      unreadCount: Number(conversation?.unreadForMe || 0),
      lastMessage: conversation?.lastMessageText || (Number(conversation?.unreadForMe || 0) > 0 ? `${Number(conversation?.unreadForMe || 0)} unread message${Number(conversation?.unreadForMe || 0) === 1 ? '' : 's'}` : 'Open chat'),
    }))
    .slice(0, 4);
  const normalizedEmployees = employees.map((employee) => {
    const employment = employee?.employment || employee?.profileData?.employment || {};
    const job = { ...(employee?.job || employee?.profileData?.job || {}), ...employment };
    const personal = employee?.personal || employee?.profileData?.personal || {};
    return {
      ...employee,
      _job: job,
      _personal: personal,
      _department: job.department || employee.department || 'Unassigned',
      _position: job.position || employee.position || employee.role || 'Staff',
      _status: (job.status || employee.status || '').toString().toLowerCase(),
      _name: employee.name || employee.fullName || [personal.firstName, personal.middleName, personal.lastName].filter(Boolean).join(' ') || 'Employee',
    };
  });

  const activeEmployeesCount = normalizedEmployees.filter((employee) => employee._status === 'active').length;
  const onLeaveEmployeesCount = normalizedEmployees.filter((employee) => employee._status === 'on leave').length;
  const terminatedEmployeesCount = normalizedEmployees.filter((employee) => employee._status === 'terminated').length;

  const departmentCounts = normalizedEmployees.reduce((accumulator, employee) => {
    accumulator[employee._department] = (accumulator[employee._department] || 0) + 1;
    return accumulator;
  }, {});

  const topDepartments = Object.entries(departmentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const departmentCount = Object.keys(departmentCounts).length;
  const positionCount = new Set(normalizedEmployees.map((employee) => employee._position).filter(Boolean)).size;

  const recentTerminations = normalizedEmployees
    .filter((employee) => employee.terminated || employee._status === 'terminated')
    .map((employee) => {
      const terminationDate = employee?.termination?.lastWorkingDate
        || employee?.termination?.terminatedAt
        || employee?.terminatedAt
        || employee?._job?.lastWorkingDate
        || '';

      return {
        name: employee._name,
        position: employee._position,
        department: employee._department,
        reason: employee?.termination?.reason || employee?.termination?.note || 'Termination recorded',
        date: terminationDate,
      };
    })
    .sort((leftItem, rightItem) => {
      const leftTime = leftItem.date ? new Date(leftItem.date).getTime() : 0;
      const rightTime = rightItem.date ? new Date(rightItem.date).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, 4);

  // employment type counts (Full-time, Part-time, Contract, Other)
  const employmentCounts = normalizedEmployees.reduce((acc, e) => {
    const job = e._job || {};
    const raw = (job.employmentType || e.employmentType || job.type || job.contractType || '').toString().toLowerCase();
    let key = 'Other';
    if (raw.includes('full')) key = 'Full-time';
    else if (raw.includes('part')) key = 'Part-time';
    else if (raw.includes('contract') || raw.includes('temp') || raw.includes('short')) key = 'Contract';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const employmentOrder = ['Full-time', 'Part-time', 'Contract', 'Other'];

  const overviewCardStyle = {
    background: 'linear-gradient(180deg, var(--surface-panel, #fff) 0%, var(--surface-muted, #f8faff) 100%)',
    border: '1px solid var(--border-soft, #dbe2f2)',
    borderRadius: 16,
    boxShadow: '0 10px 24px rgba(17,24,39,0.08)',
    padding: 16,
  };

  const widgetCardStyle = {
    background: 'var(--surface-panel, #fff)',
    borderRadius: 16,
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)',
    padding: '11px',
    border: '1px solid var(--border-soft, #dbe2f2)',
  };
  const rightRailCardStyle = {
    background: 'var(--surface-panel, #fff)',
    borderRadius: 16,
    border: '1px solid var(--border-soft, #dbe2f2)',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)',
  };
  const rightRailIconStyle = {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: '#F8FAFC',
    color: 'var(--text-primary, #111827)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(15, 23, 42, 0.08)',
    flexShrink: 0,
  };
  const rightRailIconButtonStyle = {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: '1px solid rgba(15, 23, 42, 0.08)',
    background: '#F8FAFC',
    color: 'var(--text-secondary, #475569)',
    cursor: 'pointer',
    fontSize: 16,
    lineHeight: 1,
  };
  const rightRailPillStyle = {
    padding: '4px 8px',
    borderRadius: 999,
    background: '#F8FAFC',
    border: '1px solid rgba(15, 23, 42, 0.06)',
    fontSize: 9,
    color: 'var(--text-secondary, #475569)',
    fontWeight: 800,
  };
  const softPanelStyle = {
    background: 'var(--surface-muted, #f8faff)',
    border: '1px solid var(--border-soft, #dbe2f2)',
    borderRadius: 10,
  };
  const smallStatStyle = {
    padding: '5px 8px',
    borderRadius: 12,
    background: 'var(--surface-panel, #fff)',
    border: '1px solid var(--border-soft, #dbe2f2)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: 72,
  };
  const FEED_SECTION_STYLE = {
    width: '100%',
    maxWidth: '680px',
    margin: '0 auto',
    boxSizing: 'border-box',
  };
  const shellCardStyle = {
    background: 'var(--surface-panel, #fff)',
    color: 'var(--text-primary, #111827)',
    borderRadius: 16,
    border: '1px solid var(--border-soft, #dbe2f2)',
    boxShadow: 'none',
  };
  const postSurfaceStyle = {
    background: '#ffffff',
    color: 'var(--text-primary, #111827)',
    borderRadius: 10,
    border: '1px solid #dadde1',
    boxShadow: 'none',
  };
  const sectionHeaderCardStyle = {
    ...shellCardStyle,
    padding: '12px 20px 18px',
    background: '#ffffff',
    border: '1px solid #dadde1',
  };
  const metricPillStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    minHeight: 34,
    padding: '0 12px',
    borderRadius: 999,
    background: 'var(--surface-panel, #fff)',
    border: '1px solid var(--border-soft, #dbe2f2)',
    color: 'var(--text-secondary, #334155)',
    fontSize: 12,
    fontWeight: 700,
  };
  const headerActionStyle = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    height: 38,
    padding: '0 14px',
    borderRadius: 999,
    border: '1px solid var(--border-soft, #dbe2f2)',
    background: 'var(--surface-panel, #fff)',
    color: 'var(--text-secondary, #334155)',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'none',
    boxShadow: 'none',
  };
  const formatFileSize = (bytes) => {
    const numericBytes = Number(bytes || 0);
    if (!numericBytes) return '0 KB';
    if (numericBytes >= 1024 * 1024) {
      return `${(numericBytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    return `${Math.max(1, Math.round(numericBytes / 1024))} KB`;
  };
  const compressImageToJpeg = async (file) => {
    if (!file || !String(file.type || '').startsWith('image/') || file.type === 'image/svg+xml') {
      return {
        file,
        originalSize: Number(file?.size || 0),
        finalSize: Number(file?.size || 0),
        wasCompressed: false,
        wasConvertedToJpeg: false,
      };
    }

    const imageUrl = URL.createObjectURL(file);

    try {
      const imageElement = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Unable to process selected image.'));
        image.src = imageUrl;
      });

      const maxDimension = 1600;
      const originalWidth = imageElement.naturalWidth || imageElement.width;
      const originalHeight = imageElement.naturalHeight || imageElement.height;
      const scale = Math.min(1, maxDimension / Math.max(originalWidth, originalHeight));
      let targetWidth = Math.max(1, Math.round(originalWidth * scale));
      let targetHeight = Math.max(1, Math.round(originalHeight * scale));
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { alpha: false });

      if (!context) {
        return {
          file,
          originalSize: Number(file.size || 0),
          finalSize: Number(file.size || 0),
          wasCompressed: false,
          wasConvertedToJpeg: false,
        };
      }

      const renderImage = () => {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, targetWidth, targetHeight);
        context.drawImage(imageElement, 0, 0, targetWidth, targetHeight);
      };

      const canvasToBlob = (quality) => new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
            return;
          }

          reject(new Error('Unable to optimize selected image.'));
        }, 'image/jpeg', quality);
      });

      renderImage();

      const qualitySteps = [0.82, 0.74, 0.66, 0.58, 0.5];
      const maxBytes = 900 * 1024;
      let bestBlob = null;

      for (const quality of qualitySteps) {
        const candidateBlob = await canvasToBlob(quality);
        bestBlob = candidateBlob;
        if (candidateBlob.size <= maxBytes) {
          break;
        }
      }

      if (bestBlob && bestBlob.size > maxBytes) {
        targetWidth = Math.max(960, Math.round(targetWidth * 0.82));
        targetHeight = Math.max(960, Math.round(targetHeight * 0.82 * (originalHeight / Math.max(originalWidth, 1))));
        renderImage();
        bestBlob = await canvasToBlob(0.5);
      }

      if (!bestBlob || bestBlob.size >= file.size) {
        return {
          file,
          originalSize: Number(file.size || 0),
          finalSize: Number(file.size || 0),
          wasCompressed: false,
          wasConvertedToJpeg: false,
        };
      }

      const jpegFile = new File(
        [bestBlob],
        `${file.name.replace(/\.[^.]+$/, '') || 'post-image'}.jpg`,
        { type: 'image/jpeg', lastModified: Date.now() },
      );

      return {
        file: jpegFile,
        originalSize: Number(file.size || 0),
        finalSize: Number(jpegFile.size || 0),
        wasCompressed: jpegFile.size < file.size,
        wasConvertedToJpeg: file.type !== 'image/jpeg',
      };
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  };
  const handlePostMediaSelection = async (event) => {
    const file = event.target.files && event.target.files[0];

    if (!file) {
      setPostMedia(null);
      setPostMediaMeta(null);
      return;
    }

    setIsOptimizingMedia(true);

    try {
      const optimizedResult = await compressImageToJpeg(file);
      setPostMedia(optimizedResult.file);
      setPostMediaMeta({
        originalSize: optimizedResult.originalSize,
        finalSize: optimizedResult.finalSize,
        wasCompressed: optimizedResult.wasCompressed,
        wasConvertedToJpeg: optimizedResult.wasConvertedToJpeg,
      });
    } catch (error) {
      console.error('Failed to optimize media:', error);
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
  const canSubmitPost = Boolean(postText.trim() || postMedia || existingPostMediaUrl) && !isOptimizingMedia;
  const postOwnerId = admin?.adminId || admin?.hrId || admin?.id || admin?.userId || 'hr-admin';
  const currentLikeActorId = admin?.userId || admin?.id || admin?.adminId || admin?.hrId || 'hr-admin';
  const isPostComposerEditing = Boolean(editingPostId);
  const handleSidebarViewSelection = (action) => {
    const nextSelection = resolveDashboardSelection(action);
    setDashboardView(nextSelection.dashboardView);
    setPostFeedView(nextSelection.postFeedView);
  };

  const upsertPostInState = (incomingPost) => {
    if (!incomingPost?.postId) {
      return;
    }

    setPosts((currentPosts) => {
      const alreadyExists = currentPosts.some((post) => post.postId === incomingPost.postId);
      const nextPosts = alreadyExists
        ? currentPosts.map((post) => (post.postId === incomingPost.postId ? { ...post, ...incomingPost } : post))
        : [incomingPost, ...currentPosts].slice(0, 25);

      setCachedDashboardResource(DASHBOARD_POSTS_CACHE_KEY, nextPosts);
      return nextPosts;
    });
  };

  const handleOpenConversation = async (conversation) => {
    if (!conversation?.contact?.userId) {
      navigate('/all-chat');
      return;
    }

    const nextChatId = String(conversation?.chatId || sortedChatId(adminChatUserId, conversation.contact.userId));

    navigate('/all-chat', { state: { contact: conversation.contact, chatId: nextChatId } });

    if (adminChatUserId && nextChatId) {
      try {
        await update(ref(db, schoolPath(`Chats/${nextChatId}/unread`)), { [adminChatUserId]: 0 });
      } catch (error) {
        console.error('Failed to clear dashboard unread count:', error);
      }
    }

    setConversations((currentValue) => currentValue.map((item) => (
      item.chatId === nextChatId
        ? { ...item, unreadForMe: 0 }
        : item
    )));
  };

  useEffect(() => {
    const actionFromNavigation = location.state?.dashboardAction;
    if (!actionFromNavigation) {
      return;
    }

    handleSidebarViewSelection(actionFromNavigation);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    localStorage.setItem('hr_dashboard_sidebar_view_state', JSON.stringify({
      dashboardView,
      postFeedView,
    }));
    window.dispatchEvent(new Event('hr-dashboard-view-updated'));
  }, [dashboardView, postFeedView]);
  const isPostOwnedByCurrentUser = (post) => {
    if (!post) return false;
    const ownerCandidates = [post.adminId, post.userId, post.hrId, post.ownerId].filter(Boolean).map((value) => String(value));
    const actorCandidates = [postOwnerId, currentLikeActorId, admin?.adminId, admin?.hrId, admin?.id, admin?.userId].filter(Boolean).map((value) => String(value));
    return ownerCandidates.some((ownerValue) => actorCandidates.includes(ownerValue));
  };
  const visiblePosts = postFeedView === 'mine' ? posts.filter((post) => isPostOwnedByCurrentUser(post)) : posts;

  const shouldShowPostSeeMore = (message = '') => {
    if (!message) return false;
    return message.length > 180 || message.split(/\r?\n/).length > 3;
  };

  const togglePostDescription = (postId) => {
    setExpandedPostDescriptions((currentValue) => ({
      ...currentValue,
      [postId]: !currentValue[postId],
    }));
  };

  const handlePost = async () => {
    if (!canSubmitPost || isPostSubmitting) return null;

    if (!postOwnerId) {
      alert('Session expired');
      return null;
    }

    setIsPostSubmitting(true);

    try {
      const payload = new FormData();
      payload.append('message', postText);
      payload.append('adminId', postOwnerId);
      payload.append('userId', admin?.userId || admin?.id || postOwnerId);
      payload.append('adminName', admin?.name || 'HR Office');
      payload.append('adminProfile', getSafeProfileImage(admin?.profileImage));
      payload.append('targetRole', targetRole || 'all');

      if (postMedia) {
        payload.append('media', postMedia);
      }

      if (editingPostId) {
        payload.append('removeMedia', !postMedia && !existingPostMediaUrl ? '1' : '0');

        if (existingPostMediaUrl && !postMedia) {
          payload.append('postUrl', existingPostMediaUrl);
          payload.append('mediaType', existingPostMediaType || '');
        }

        const response = await api.patch(`/api/update_post/${editingPostId}`, payload);
        const updatedPost = response?.data?.post;

        if (updatedPost) {
          upsertPostInState(updatedPost);
        }

        return updatedPost;
      }

      const response = await api.post('/api/create_post', payload);
      const createdPost = response?.data?.post;

      if (createdPost) {
        upsertPostInState(createdPost);
      }

      return createdPost;
    } catch (error) {
      console.error('Failed to create post:', error?.response?.data || error);
      throw error;
    } finally {
      setIsPostSubmitting(false);
    }
  };

  const handleSubmitCreatePost = async () => {
    if (!canSubmitPost || isPostSubmitting) return;
    try {
      await handlePost();
      setShowCreatePostModal(false);
      resetPostComposerState();
    } catch (error) {
      console.error('Post save failed:', error?.response?.data || error);
      alert(error?.response?.data?.message || 'Unable to save post. Please try again.');
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      await api.delete(`/api/delete_post/${postId}`, {
        params: {
          adminId: postOwnerId,
          userId: currentLikeActorId,
        },
      });
      setPosts((currentPosts) => {
        const nextPosts = currentPosts.filter((post) => post.postId !== postId);
        setCachedDashboardResource(DASHBOARD_POSTS_CACHE_KEY, nextPosts);
        return nextPosts;
      });

      if (editingPostId === postId) {
        setShowCreatePostModal(false);
        resetPostComposerState();
      }

      return true;
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert('Unable to delete post. Please try again.');
      return false;
    }
  };

  const handleConfirmDeletePost = async () => {
    const postId = String(pendingDeletePost?.postId || '').trim();
    if (!postId || isDeletingPost) {
      return;
    }

    setIsDeletingPost(true);
    try {
      const wasDeleted = await handleDeletePost(postId);
      if (wasDeleted) {
        setPendingDeletePost(null);
        setShowDeletePostModal(false);
      }
    } finally {
      setIsDeletingPost(false);
    }
  };

  const handleCreateCalendarEvent = async () => {
    if (!canManageCalendar) {
      alert('Only HR or admin users can manage school calendar events.');
      return;
    }

    if (!selectedCalendarDay) {
      alert('Select a calendar day first.');
      return;
    }

    if (calendarModalContext === 'deadline' && !calendarEventForm.title.trim()) {
      alert('Enter a deadline title.');
      return;
    }

    setCalendarEventSaving(true);
    try {
      const normalizedCategory = calendarModalContext === 'deadline' ? 'academic' : calendarEventForm.category;
      const selectedEventMeta = getCalendarEventMeta(normalizedCategory);
      const payload = {
        title: calendarEventForm.title.trim() || selectedEventMeta.label,
        type: getCalendarEventKey(normalizedCategory),
        category: normalizedCategory,
        subType: 'general',
        notes: calendarEventForm.notes.trim(),
        showInUpcomingDeadlines: calendarModalContext === 'deadline'
          || Boolean(calendarEvents.find((eventItem) => eventItem.id === editingCalendarEventId)?.showInUpcomingDeadlines),
        gregorianDate: selectedCalendarDay.isoDate,
        ethiopianDate: {
          year: calendarViewDate.year,
          month: calendarViewDate.month,
          day: selectedCalendarDay.ethDay,
        },
        createdBy: currentLikeActorId || postOwnerId,
        userId: currentLikeActorId || postOwnerId,
      };

      if (editingCalendarEventId) {
        await api.patch(`/api/calendar_events/${editingCalendarEventId}`, payload);
        setCalendarActionMessage('Calendar event updated successfully.');
      } else {
        await api.post('/api/calendar_events', payload);
        setCalendarActionMessage('Calendar event saved successfully.');
      }

      setCalendarEventForm({ title: '', category: 'no-class', subType: 'general', notes: '' });
      setEditingCalendarEventId('');
      setShowCalendarEventModal(false);
      setCalendarModalContext('calendar');
      DASHBOARD_RESOURCE_CACHE.delete(calendarCacheKey);
      await loadCalendarEvents({ forceRefresh: true });
    } catch (error) {
      console.error('Failed to save calendar event:', error?.response?.data || error);
      alert(error?.response?.data?.message || 'Failed to save calendar event.');
    } finally {
      setCalendarEventSaving(false);
    }
  };

  const handleEditCalendarEvent = (eventItem) => {
    if (!canManageCalendar || eventItem.isDefault) return;

    setCalendarModalContext(eventItem.showInUpcomingDeadlines ? 'deadline' : 'calendar');
    setShowCalendarEventModal(true);

    const ethiopianDate = eventItem.ethiopianDate || (() => {
      const [year, month, day] = String(eventItem.gregorianDate || '').split('-').map(Number);
      if (!year || !month || !day) {
        return null;
      }

      return EthiopicCalendar.ge(year, month, day);
    })();

    if (ethiopianDate?.year && ethiopianDate?.month) {
      setCalendarViewDate({
        year: ethiopianDate.year,
        month: ethiopianDate.month,
      });
    }

    setSelectedCalendarIsoDate(eventItem.gregorianDate);
    setCalendarEventForm({
      title: eventItem.title || '',
      category: eventItem.category || (eventItem.type === 'academic' ? 'academic' : 'no-class'),
      subType: 'general',
      notes: eventItem.notes || '',
    });
    setEditingCalendarEventId(eventItem.id);
  };

  const handleDeleteCalendarEvent = async (eventItem) => {
    if (!canManageCalendar) {
      alert('Only HR or admin users can manage school calendar events.');
      return;
    }

    if (eventItem.isDefault) {
      alert('Default Ethiopian special days cannot be deleted.');
      return;
    }

    const selectedEventMeta = getCalendarEventMeta(eventItem.category);
    const shouldDelete = window.confirm(`Delete ${selectedEventMeta.label} on ${eventItem.gregorianDate}?`);
    if (!shouldDelete) {
      return;
    }

    setCalendarEventSaving(true);
    try {
      await api.delete(`/api/calendar_events/${eventItem.id}`, {
        data: {
          userId: currentLikeActorId || postOwnerId,
        },
      });

      if (editingCalendarEventId === eventItem.id) {
        setEditingCalendarEventId('');
        setCalendarEventForm({ title: '', category: 'no-class', subType: 'general', notes: '' });
      }

      setCalendarActionMessage('Calendar event deleted successfully.');
      DASHBOARD_RESOURCE_CACHE.delete(calendarCacheKey);
      await loadCalendarEvents({ forceRefresh: true });
    } catch (error) {
      console.error('Failed to delete calendar event:', error?.response?.data || error);
      alert(error?.response?.data?.message || 'Failed to delete calendar event.');
    } finally {
      setCalendarEventSaving(false);
    }
  };

  const handleOpenCalendarEventModal = () => {
    const selectableCalendarDays = calendarDays.filter(Boolean);
    if (!selectedCalendarIsoDate && selectableCalendarDays.length > 0) {
      setSelectedCalendarIsoDate(selectableCalendarDays[0].isoDate);
    }

    setEditingCalendarEventId('');
    setCalendarEventForm({ title: '', category: 'no-class', subType: 'general', notes: '' });
    setCalendarModalContext('calendar');
    setShowCalendarEventModal(true);
  };

  const handleOpenDeadlineModal = () => {
    const selectableCalendarDays = calendarDays.filter(Boolean);
    if (!selectedCalendarIsoDate && selectableCalendarDays.length > 0) {
      setSelectedCalendarIsoDate(selectableCalendarDays[0].isoDate);
    }

    setEditingCalendarEventId('');
    setCalendarEventForm({ title: '', category: 'academic', subType: 'general', notes: '' });
    setCalendarModalContext('deadline');
    setShowCalendarEventModal(true);
  };

  const handleCloseCalendarEventModal = () => {
    setEditingCalendarEventId('');
    setCalendarEventForm({ title: '', category: 'no-class', subType: 'general', notes: '' });
    setCalendarModalContext('calendar');
    setShowCalendarEventModal(false);
  };

  useEffect(() => {
    if (!calendarActionMessage) return undefined;

    const timeoutId = window.setTimeout(() => {
      setCalendarActionMessage('');
    }, 2600);

    return () => window.clearTimeout(timeoutId);
  }, [calendarActionMessage]);

  const handleLikePost = async (postId) => {
    const normalizedPostId = String(postId || '').trim();
    if (!normalizedPostId || !currentLikeActorId || pendingLikePostIds[normalizedPostId]) {
      return;
    }

    const currentPost = posts.find((post) => String(post?.postId || '') === normalizedPostId);
    if (!currentPost) {
      return;
    }

    const previousLikes = normalizePostLikes(currentPost.likes);
    const wasLiked = Boolean(previousLikes[String(currentLikeActorId)]);
    const nextLikes = { ...previousLikes };

    if (wasLiked) {
      delete nextLikes[String(currentLikeActorId)];
    } else {
      nextLikes[String(currentLikeActorId)] = true;
    }

    const optimisticLikeCount = Object.keys(nextLikes).length;

    setPendingLikePostIds((currentValue) => ({
      ...currentValue,
      [normalizedPostId]: true,
    }));

    setPosts((currentPosts) => {
      const nextPosts = currentPosts.map((post) => (
        post.postId === normalizedPostId
          ? {
              ...post,
              likeCount: optimisticLikeCount,
              likes: nextLikes,
            }
          : post
      ));

      setCachedDashboardResource(DASHBOARD_POSTS_CACHE_KEY, nextPosts);
      return nextPosts;
    });

    try {
      const response = await api.post('/api/like_post', {
        postId: normalizedPostId,
        userId: currentLikeActorId,
        adminId: postOwnerId,
      });

      const likeCount = response?.data?.likeCount;
      const likes = normalizePostLikes(response?.data?.likes);

      setPosts((currentPosts) => {
        const nextPosts = currentPosts.map((post) =>
          post.postId === normalizedPostId
            ? {
                ...post,
                likeCount: typeof likeCount === 'number' ? likeCount : Object.keys(likes).length,
                likes,
              }
            : post,
        );
        setCachedDashboardResource(DASHBOARD_POSTS_CACHE_KEY, nextPosts);
        return nextPosts;
      });
    } catch (error) {
      console.error('Failed to like post:', error);
      setPosts((currentPosts) => {
        const nextPosts = currentPosts.map((post) => (
          post.postId === normalizedPostId
            ? {
                ...post,
                likeCount: Math.max(0, Object.keys(previousLikes).length),
                likes: previousLikes,
              }
            : post
        ));

        setCachedDashboardResource(DASHBOARD_POSTS_CACHE_KEY, nextPosts);
        return nextPosts;
      });
      alert('Unable to update like. Please try again.');
    } finally {
      setPendingLikePostIds((currentValue) => {
        const nextValue = { ...currentValue };
        delete nextValue[normalizedPostId];
        return nextValue;
      });
    }
  };

  const handleAttendanceStatusCardClick = (statusValue) => {
    if (showAttendancePeopleList && attendanceStatusFilter === statusValue) {
      setShowAttendancePeopleList(false);
      return;
    }

    setAttendanceStatusFilter(statusValue);
    setShowAttendancePeopleList(true);
  };

  return (
    <div
      className="dashboard-page"
      style={{
        background: '#FFFFFF',
        minHeight: '100vh',
        color: 'var(--text-primary)',
        '--surface-panel': '#FFFFFF',
        '--surface-accent': '#F1F8FF',
        '--surface-muted': '#F7FBFF',
        '--surface-strong': '#DCEBFF',
        '--page-bg': '#FFFFFF',
        '--border-soft': '#D7E7FB',
        '--border-strong': '#B5D2F8',
        '--text-primary': '#0f172a',
        '--text-secondary': '#334155',
        '--text-muted': '#64748b',
        '--accent': '#007AFB',
        '--accent-soft': '#E7F2FF',
        '--accent-strong': '#007AFB',
        '--success': '#00B6A9',
        '--success-soft': '#E9FBF9',
        '--success-border': '#AAEDE7',
        '--warning': '#DC2626',
        '--warning-soft': '#FEE2E2',
        '--warning-border': '#FCA5A5',
        '--danger': '#b91c1c',
        '--danger-border': '#fca5a5',
        '--surface-overlay': '#F1F8FF',
        '--input-bg': '#FFFFFF',
        '--input-border': '#B5D2F8',
        '--shadow-soft': '0 10px 24px rgba(0, 122, 251, 0.10)',
        '--shadow-panel': '0 14px 30px rgba(0, 122, 251, 0.14)',
        '--shadow-glow': '0 0 0 2px rgba(0, 122, 251, 0.18)',
        '--sidebar-width': 'clamp(230px, 16vw, 290px)',
        '--topbar-height': '64px',
      }}
    >
      <nav className="top-navbar" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 'var(--topbar-height)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '0 18px 0 20px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-panel)', zIndex: 60 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Gojo HR</h2>
        </div>

        <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
          <button type="button" title="Notifications" onClick={() => setShowNotificationDropdown((prev) => !prev)} style={headerActionStyle}>
            <FaBell />
            {notificationCount > 0 ? (
              <span style={{ minWidth: 18, height: 18, borderRadius: 999, background: 'var(--warning)', color: '#fff', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
                {notificationCount}
              </span>
            ) : null}
          </button>
          {showNotificationDropdown ? (
            <div style={{ position: 'absolute', top: 48, right: 146, width: 320, maxHeight: 320, overflowY: 'auto', borderRadius: 14, border: '1px solid var(--border-soft)', background: 'var(--surface-panel)', boxShadow: 'none', zIndex: 1200 }}>
              <div style={{ padding: '12px 14px', fontSize: 13, fontWeight: 800, borderBottom: '1px solid var(--border-soft)' }}>Notifications</div>
              {notificationCount === 0 ? (
                <div style={{ padding: 14, fontSize: 12, color: 'var(--text-muted)' }}>No new notifications</div>
              ) : (
                <>
                  {upcomingBirthdays.slice(0, 4).map((item, index) => (
                    <div key={`bday-${index}`} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-soft)', fontSize: 12, color: 'var(--text-secondary)' }}>
                      Birthday reminder: {item.name || item.fullName || 'Employee'}
                    </div>
                  ))}
                  {upcomingContracts.slice(0, 4).map((item, index) => (
                    <div key={`contract-${index}`} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-soft)', fontSize: 12, color: 'var(--text-secondary)' }}>
                      Contract reminder: {item.name || item.fullName || 'Employee'}
                    </div>
                  ))}
                </>
              )}
            </div>
          ) : null}
          <button type="button" title="Messages" onClick={() => navigate('/all-chat')} style={headerActionStyle}>
            <FaFacebookMessenger />
          </button>
          <Link to="/settings" aria-label="Settings" style={headerActionStyle}>
            <FaCog />
          </Link>
          <Avatar src={admin.profileImage} alt="admin" name={admin.name || 'HR Office'} size={40} style={{ border: '1px solid var(--border-soft)' }} textSize={14} />
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: 'flex', gap: 14, padding: 'calc(var(--topbar-height) + 18px) 14px 18px', minHeight: '100vh', background: 'var(--page-bg)', width: '100%', boxSizing: 'border-box', alignItems: 'flex-start' }}>
        <div
          className="teacher-sidebar-spacer"
          style={{
            width: 'var(--sidebar-width)',
            minWidth: 'var(--sidebar-width)',
            flex: '0 0 var(--sidebar-width)',
            pointerEvents: 'none',
          }}
        />

        <main className="main-content google-main" style={{ flex: '1 1 0', minWidth: 0, maxWidth: 'none', margin: 0, boxSizing: 'border-box', alignSelf: 'flex-start', minHeight: 'calc(100vh - 24px)', overflowY: 'visible', overflowX: 'hidden', position: 'relative', top: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'transparent transparent', padding: '0 12px 0 2px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: dashboardView === 'home' ? FEED_SECTION_STYLE.maxWidth : 1180 }}>
            {dashboardView === 'home' ? (
              <div className="section-header-card" style={{ ...sectionHeaderCardStyle, ...FEED_SECTION_STYLE, margin: '0 auto 14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', width: 'fit-content', height: 30, padding: '0 12px', borderRadius: 999, background: 'var(--accent-soft)', border: '1px solid var(--border-strong)', color: 'var(--accent-strong)', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      Gojo HR Workspace
                    </div>
                    <div>
                      <div className="section-header-card__title" style={{ fontSize: 22 }}>HR Updates Feed</div>
                      <div className="section-header-card__subtitle" style={{ marginTop: 6 }}>Share announcements, attendance reminders, and team updates in the same clean shell used across the admin portal.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={metricPillStyle}>Employees <strong style={{ color: 'var(--text-primary)' }}>{count}</strong></div>
                      {/* <div style={metricPillStyle}>Attendance <strong style={{ color: 'var(--accent-strong)' }}>{attendanceRate}</strong></div> */}
                      <div style={metricPillStyle}>Posts today <strong style={{ color: 'var(--text-primary)' }}>{todayPostCount}</strong></div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={metricPillStyle}>Unread <strong style={{ color: 'var(--text-primary)' }}>{messageCount}</strong></div>
                    <div style={metricPillStyle}>Notifications <strong style={{ color: 'var(--text-primary)' }}>{totalNotifications}</strong></div>
                  </div>
                </div>
              </div>
            ) : null}

          {dashboardView === 'home' ? (
            <>
              

                <div className="post-box" style={{ ...FEED_SECTION_STYLE, ...postSurfaceStyle, margin: '0 auto 14px', borderRadius: 10, overflow: 'hidden', padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--surface-panel, #fff)', border: 'none', boxShadow: 'none', padding: 0 }}>
                    <Avatar
                      src={admin.profileImage}
                      alt="me"
                      name={admin.name || 'HR Office'}
                      size={38}
                      style={{ border: '1px solid var(--border-soft, #dbe2f2)' }}
                      textSize={13}
                    />
                    <button
                      type="button"
                      onClick={openCreatePostModal}
                      style={{ flex: 1, height: 42, border: '1px solid #d9e2ef', background: '#f7faff', borderRadius: 999, padding: '0 16px', fontSize: 14, textAlign: 'left', color: 'var(--text-muted, #6b7280)', cursor: 'pointer' }}
                    >
                      What's on your mind?
                    </button>
                    <button
                      type="button"
                      onClick={openCreatePostModal}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: 'none', borderRadius: 8, background: 'transparent', color: 'var(--danger, #dc2626)', fontSize: 18, cursor: 'pointer', flexShrink: 0 }}
                      title="Live video"
                    >
                      <AiFillVideoCamera />
                    </button>
                    <button
                      type="button"
                      onClick={openCreatePostModal}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: 'none', borderRadius: 8, background: 'transparent', color: 'var(--success, #16a34a)', fontSize: 18, cursor: 'pointer', flexShrink: 0 }}
                      title="Photo"
                    >
                      <AiFillPicture />
                    </button>
                  </div>
                </div>

              <div className="posts-container" style={{ ...FEED_SECTION_STYLE, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {visiblePosts.length === 0 ? (
                  <div style={{ background: 'var(--surface-panel, #fff)', border: '1px solid var(--border-soft, #dbe2f2)', borderRadius: 12, padding: '20px 16px', color: 'var(--text-muted, #6b7280)', textAlign: 'center' }}>
                    {postFeedView === 'mine' ? 'You have not created any posts yet.' : 'No posts yet. Create your first HR update.'}
                  </div>
                ) : (
                  visiblePosts.map((post) => {
                    const isOwnedByCurrentUser = isPostOwnedByCurrentUser(post);
                    const isLikedByCurrentUser = isPostLikedByActor(post, currentLikeActorId);
                    const resolvedLikeCount = getResolvedLikeCount(post);
                    const isLikePending = Boolean(pendingLikePostIds[post.postId]);

                    return (
                    <div key={post.postId} className="post-card facebook-post-card" style={{ ...postSurfaceStyle, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: '12px 16px 6px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0, flex: 1 }}>
                          <div style={{ flexShrink: 0 }}>
                            <Avatar src={post.adminProfile} alt="profile" name={post.adminName || 'HR Office'} size={40} textSize={14} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <h4 style={{ margin: 0, fontSize: 15, color: 'var(--text-primary, #111827)', fontWeight: 700, lineHeight: 1.2 }}>{post.adminName || 'HR Office'}</h4>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2, fontSize: 12, color: 'var(--text-muted, #6b7280)', fontWeight: 500 }}>
                              <span>{formatFeedTimestamp(post.time)}</span>
                              <span>·</span>
                              <span>{post.targetRole && post.targetRole !== 'all' ? `Visible to ${post.targetRole}` : 'Visible to everyone'}</span>
                            </div>
                          </div>
                        </div>
                        {isOwnedByCurrentUser ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => handleStartEditPost(post)}
                              style={{ height: 32, padding: '0 12px', borderRadius: 999, border: '1px solid var(--border-soft, #dbe2f2)', background: 'var(--surface-panel, #fff)', color: 'var(--text-secondary, #475569)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRequestDeletePost(post)}
                              style={{ height: 32, padding: '0 12px', borderRadius: 999, border: '1px solid var(--danger-border, #fca5a5)', background: 'var(--surface-panel, #fff)', color: 'var(--danger, #b91c1c)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            >
                              <FaTrashAlt style={{ width: 12, height: 12 }} />
                              <span>Delete</span>
                            </button>
                          </div>
                        ) : null}
                      </div>

                      {post.message ? (() => {
                        const canExpandPost = shouldShowPostSeeMore(post.message);
                        const isPostExpanded = !!expandedPostDescriptions[post.postId];

                        return (
                          <div style={{ padding: '0 16px 10px', color: 'var(--text-primary, #111827)', fontSize: 15, lineHeight: 1.3333, wordBreak: 'break-word' }}>
                            <div
                              style={{
                                whiteSpace: 'pre-wrap',
                                overflow: canExpandPost && !isPostExpanded ? 'hidden' : 'visible',
                                display: canExpandPost && !isPostExpanded ? '-webkit-box' : 'block',
                                WebkitBoxOrient: canExpandPost && !isPostExpanded ? 'vertical' : 'initial',
                                WebkitLineClamp: canExpandPost && !isPostExpanded ? 3 : 'unset',
                              }}
                            >
                              {post.message}
                            </div>
                            {canExpandPost ? (
                              <button
                                type="button"
                                onClick={() => togglePostDescription(post.postId)}
                                style={{ border: 'none', background: 'transparent', padding: 0, marginTop: 6, color: 'var(--text-muted, #6b7280)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                              >
                                {isPostExpanded ? 'See less' : 'See more'}
                              </button>
                            ) : null}
                          </div>
                        );
                      })() : null}

                      {post.postUrl ? (
                        <div style={{ background: '#000', borderTop: '1px solid #dadde1', borderBottom: '1px solid #dadde1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src={post.postUrl} alt="post media" style={{ width: '100%', height: 'auto', maxHeight: 'min(78vh, 720px)', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                        </div>
                      ) : null}

                      <div style={{ padding: '8px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 13, color: 'var(--text-muted, #6b7280)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--accent-strong, #007afb)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <FaThumbsUp style={{ width: 9, height: 9 }} />
                          </span>
                          <span style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{resolvedLikeCount} like{resolvedLikeCount === 1 ? '' : 's'}</span>
                        </div>
                        <div style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                          {post.targetRole && post.targetRole !== 'all' ? `Visible to ${post.targetRole}` : 'Visible to everyone'}
                        </div>
                      </div>
                      <div style={{ margin: '0 16px', borderTop: '1px solid #e4e6eb' }} />
                      <div style={{ padding: '4px 8px 8px' }}>
                        <button
                          type="button"
                          onClick={() => handleLikePost(post.postId)}
                          disabled={isLikePending}
                          style={{ width: '100%', minHeight: 36, border: 'none', borderRadius: 8, background: 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: isLikePending ? 'progress' : 'pointer', color: isLikedByCurrentUser ? 'var(--accent-strong, #007afb)' : 'var(--text-secondary, #4b5563)', fontSize: 14, fontWeight: 700, opacity: isLikePending ? 0.82 : 1, transition: 'opacity 140ms ease, color 140ms ease' }}
                        >
                          <FaThumbsUp style={{ width: 14, height: 14 }} />
                          <span>{isLikedByCurrentUser ? 'Liked' : 'Like'}</span>
                        </button>
                      </div>
                    </div>
                  );
                  })
                )}
              </div>
            </>
          ) : (
            <DashboardOverview
              count={count}
              activeEmployeesCount={activeEmployeesCount}
              onLeaveEmployeesCount={onLeaveEmployeesCount}
              terminatedEmployeesCount={terminatedEmployeesCount}
              attendanceRecordView={attendanceRecordView}
              onChangeAttendanceRecordView={setAttendanceRecordView}
              attendanceChartMode={attendanceChartMode}
              onChangeAttendanceChartMode={setAttendanceChartMode}
              attendanceRate={attendanceRate}
              attendanceChartNode={attendanceChartPoints.length > 0 ? (
                <AttendanceTrendChart points={attendanceChartPoints} mode={attendanceChartMode} height={320} width={820} />
              ) : (
                <div style={{ padding: '56px 16px', textAlign: 'center', fontSize: 13, color: '#64748b', fontWeight: 700 }}>
                  Attendance graph will appear once attendance records are available.
                </div>
              )}
              latestAttendanceSnapshot={latestAttendanceSnapshot}
              onAttendanceStatusCardClick={handleAttendanceStatusCardClick}
              showAttendancePeopleList={showAttendancePeopleList}
              attendanceStatusFilter={attendanceStatusFilter}
              attendancePeopleDateLabel={attendancePeopleDateLabel}
              attendancePeopleList={attendancePeopleList}
              recentAttendanceRecords={recentAttendanceRecords}
              growthTrendView={growthTrendView}
              onChangeGrowthTrendView={setGrowthTrendView}
              currentGrowthTotal={currentGrowthTotal}
              peakGrowthPoint={peakGrowthPoint}
              growthTrendChartNode={<GrowthTrendChart points={growthTrendPoints} mode={growthTrendView} />}
              genderDonutNode={<DonutChart values={genderValues} colors={['#4b6cb7', '#ec4899', '#f59e0b']} size={130} />}
              genderBarNode={<GenderBar male={maleCount} female={femaleCount} width={250} height={86} />}
              maleCount={maleCount}
              femaleCount={femaleCount}
              positionChartNode={<PositionChart employees={normalizedEmployees.map((employee) => ({ position: employee._position, role: employee._position }))} maxBars={7} />}
              normalizedEmployeesLength={normalizedEmployees.length}
              employmentOrder={employmentOrder}
              employmentCounts={employmentCounts}
              topDepartments={topDepartments}
              departmentCount={departmentCount}
              positionCount={positionCount}
              avgTenureFormatted={avgTenureFormatted}
              turnoverRate={turnoverRate}
              leavesToday={leavesToday}
              todayHires={todayHires}
              todayPostCount={todayPostCount}
              notificationCount={notificationCount}
              recentHires={recentHires}
              upcomingCalendarEvents={upcomingCalendarEvents}
              recentTerminations={recentTerminations}
              upcomingBirthdays={upcomingBirthdays}
              upcomingContracts={upcomingContracts}
            />
          )}
          </div>
        </main>

        {dashboardView === 'home' ? (
        <>
        <div className="right-widgets-spacer" style={{ width: 'clamp(300px, 21vw, 360px)', minWidth: 300, maxWidth: 360, flex: '0 0 clamp(300px, 21vw, 360px)', marginLeft: 10, pointerEvents: 'none' }} />
        <div className="dashboard-widgets" onWheel={(event) => event.stopPropagation()} style={{ width: 'clamp(300px, 21vw, 360px)', minWidth: 300, maxWidth: 360, flex: '0 0 clamp(300px, 21vw, 360px)', display: 'flex', flexDirection: 'column', gap: 12, alignSelf: 'flex-start', height: 'calc(100vh - var(--topbar-height) - 36px)', maxHeight: 'calc(100vh - var(--topbar-height) - 36px)', overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', position: 'fixed', top: 'calc(var(--topbar-height) + 18px)', right: 14, scrollbarWidth: 'thin', scrollbarColor: 'transparent transparent', paddingLeft: 12, paddingRight: 2, paddingBottom: 12, marginLeft: 10, marginRight: 0, opacity: 0.98, borderLeft: 'none' }}>
          <div style={widgetCardStyle}>
            <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: 'var(--text-primary, #111827)' }}>Quick Statistics</h4>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <div style={smallStatStyle}>
                <div style={{ fontSize: 10, color: 'var(--text-muted, #6b7280)', fontWeight: 600 }}>Total Posts</div>
                <div style={{ marginTop: 3, fontSize: 13, fontWeight: 800, color: 'var(--text-primary, #111827)' }}>{posts.length}</div>
              </div>
              <div style={smallStatStyle}>
                <div style={{ fontSize: 10, color: 'var(--text-muted, #6b7280)', fontWeight: 600 }}>Unread</div>
                <div style={{ marginTop: 3, fontSize: 13, fontWeight: 800, color: 'var(--text-primary, #111827)' }}>{messageCount}</div>
              </div>
              <div style={smallStatStyle}>
                <div style={{ fontSize: 10, color: 'var(--text-muted, #6b7280)', fontWeight: 600 }}>Notifications</div>
                <div style={{ marginTop: 3, fontSize: 13, fontWeight: 800, color: 'var(--text-primary, #111827)' }}>{totalNotifications}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ ...widgetCardStyle, padding: '10px' }}>
              <h4 style={{ fontSize: 12, fontWeight: 800, margin: 0, color: 'var(--text-primary, #111827)' }}>Today's Activity</h4>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', ...softPanelStyle, padding: '7px 8px', fontSize: 10 }}>
                  <span style={{ color: 'var(--text-secondary, #6b7280)', fontWeight: 600 }}>New Posts</span>
                  <strong style={{ color: 'var(--text-primary, #111827)' }}>{todayPostCount}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', ...softPanelStyle, padding: '7px 8px', fontSize: 10 }}>
                  <span style={{ color: 'var(--text-secondary, #6b7280)', fontWeight: 600 }}>Messages</span>
                  <strong style={{ color: 'var(--text-primary, #111827)' }}>{messageCount}</strong>
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary, #6b7280)', marginBottom: 6 }}>Recent Contacts</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recentContacts.length === 0 ? (
                    <div style={{ fontSize: 10, color: 'var(--text-muted, #6b7280)', ...softPanelStyle, padding: '7px 8px' }}>
                      No recent chats yet
                    </div>
                  ) : (
                    recentContacts.map((contact, index) => (
                      <button
                        key={contact.userId || index}
                        type="button"
                        onClick={() => handleOpenConversation(contact.conversation)}
                        style={{ ...softPanelStyle, display: 'flex', alignItems: 'center', gap: 7, width: '100%', textAlign: 'left', padding: '6px 7px', cursor: 'pointer' }}
                      >
                        <Avatar src={contact.profileImage} alt={contact.name} name={contact.name || 'Employee'} size={24} textSize={10} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary, #111827)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contact.name}</div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted, #6b7280)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contact.lastMessage || contact.role}</div>
                        </div>
                        {contact.unreadCount > 0 ? (
                          <div style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>
                            {contact.unreadCount > 99 ? '99+' : contact.unreadCount}
                          </div>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ ...rightRailCardStyle, overflow: 'hidden', position: 'relative' }}>
              <div style={{ padding: '14px 14px 12px', background: 'var(--surface-panel, #fff)', borderBottom: '1px solid rgba(15, 23, 42, 0.08)', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={rightRailIconStyle}>
                      <FaCalendarAlt style={{ width: 14, height: 14 }} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 900, margin: 0, color: 'var(--text-primary, #111827)', letterSpacing: '-0.02em' }}>School Calendar</h4>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary, #475569)', marginTop: 3, fontWeight: 800 }}>{calendarMonthLabel}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted, #64748b)', marginTop: 2, fontWeight: 500 }}>
                        {`${calendarMonthStartGregorian.day}/${calendarMonthStartGregorian.month}/${calendarMonthStartGregorian.year} - ${calendarMonthEndGregorian.day}/${calendarMonthEndGregorian.month}/${calendarMonthEndGregorian.year}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => handleCalendarMonthChange(-1)}
                      style={{ ...rightRailIconButtonStyle, fontSize: 17 }}
                      aria-label="Previous month"
                      title="Previous month"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCalendarMonthChange(1)}
                      style={{ ...rightRailIconButtonStyle, fontSize: 17 }}
                      aria-label="Next month"
                      title="Next month"
                    >
                      ›
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <div style={{ ...rightRailPillStyle, color: 'var(--text-primary, #111827)' }}>
                      {monthlyCalendarEvents.length} event{monthlyCalendarEvents.length === 1 ? '' : 's'}
                    </div>
                    <div style={{ ...rightRailPillStyle, color: canManageCalendar ? 'var(--text-primary, #111827)' : 'var(--text-secondary, #475569)' }}>
                      {canManageCalendar ? 'Manage access' : 'View only'}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ margin: '12px', background: '#F8FAFC', border: '1px solid rgba(15, 23, 42, 0.06)', borderRadius: 12, padding: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, marginBottom: 6 }}>
                  {CALENDAR_WEEK_DAYS.map((day) => (
                    <div key={day} style={{ textAlign: 'center', fontSize: 9, fontWeight: 800, color: 'var(--text-muted, #64748b)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                      {day}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
                  {calendarDays.map((day, index) => {
                    const isToday = day?.ethDay === calendarHighlightedDay;
                    const dayOfWeek = index % 7;
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    const primaryEvent = day?.events?.[0] || null;
                    const isNoClassDay = primaryEvent?.category === 'no-class';
                    const isAcademicDay = primaryEvent?.category === 'academic';
                    const isSelected = day?.isoDate === selectedCalendarIsoDate;
                    const isHovered = day?.isoDate === hoveredCalendarIsoDate;
                    const dayBackground = day
                      ? isToday
                        ? 'var(--accent-soft, #E7F2FF)'
                        : isSelected
                          ? 'color-mix(in srgb, var(--accent-soft, #E7F2FF) 72%, white 28%)'
                          : isNoClassDay
                            ? 'color-mix(in srgb, var(--warning-soft, #FEE2E2) 58%, white 42%)'
                            : isAcademicDay
                              ? 'color-mix(in srgb, var(--accent-soft, #E7F2FF) 46%, white 54%)'
                              : isWeekend
                                ? 'color-mix(in srgb, var(--surface-muted, #F7FBFF) 82%, white 18%)'
                                : 'var(--surface-panel, #fff)'
                      : 'transparent';

                    return (
                      <button
                        type="button"
                        key={`${day?.ethDay || 'blank'}-${index}`}
                        onClick={() => day && setSelectedCalendarIsoDate(day.isoDate)}
                        onMouseEnter={() => day && setHoveredCalendarIsoDate(day.isoDate)}
                        onMouseLeave={() => setHoveredCalendarIsoDate('')}
                        onFocus={() => day && setHoveredCalendarIsoDate(day.isoDate)}
                        onBlur={() => setHoveredCalendarIsoDate('')}
                        title={day?.events?.length ? day.events.map((eventItem) => eventItem.title).join(', ') : ''}
                        style={{
                          minHeight: 0,
                          aspectRatio: '1 / 1',
                          borderRadius: 10,
                          border: isToday
                            ? '1px solid var(--accent, #007AFB)'
                            : isSelected
                              ? '1px solid var(--accent-strong, #007AFB)'
                              : isHovered
                                ? '1px solid var(--border-strong, #B5D2F8)'
                                : isNoClassDay
                                  ? '1px solid var(--warning-border, #FCA5A5)'
                                  : '1px solid var(--border-soft, #D7E7FB)',
                          background: dayBackground,
                          color: isToday ? 'var(--accent-strong, #007AFB)' : day ? 'var(--text-secondary, #475569)' : 'transparent',
                          fontSize: 10,
                          fontWeight: isToday ? 800 : 700,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 1,
                          padding: '5px 2px',
                          boxShadow: day && isSelected ? '0 8px 18px rgba(0, 122, 251, 0.12)' : 'none',
                          cursor: day ? 'pointer' : 'default',
                          outline: 'none',
                          transform: day && isSelected
                            ? 'translateY(-2px) scale(1.03)'
                            : day && isHovered
                              ? 'translateY(-1px)'
                              : 'translateY(0)',
                          transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease, color 160ms ease',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                        disabled={!day}
                      >
                        {day ? (
                          <>
                            <div style={{ fontSize: 11, fontWeight: 800, color: isToday || isSelected ? 'var(--accent-strong, #007AFB)' : 'var(--text-primary, #111827)', lineHeight: 1 }}>{day.ethDay}</div>
                            <div style={{ fontSize: 8, color: isSelected ? 'var(--accent, #007AFB)' : 'var(--text-muted, #64748b)', lineHeight: 1 }}>{day.gregorianDate.day}/{day.gregorianDate.month}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2, minHeight: 6 }}>
                              {day.events.slice(0, 2).map((eventItem) => (
                                <span
                                  key={eventItem.id}
                                  style={{
                                    width: 5,
                                    height: 5,
                                    borderRadius: '50%',
                                    background: getCalendarEventMeta(eventItem.category).color,
                                  }}
                                />
                              ))}
                            </div>
                          </>
                        ) : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '0 12px 0', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--text-secondary, #475569)', fontWeight: 800, background: '#F8FAFC', border: '1px solid rgba(220, 38, 38, 0.18)', borderRadius: 999, padding: '5px 8px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning, #DC2626)' }} /> No class
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--text-secondary, #475569)', fontWeight: 800, background: '#F8FAFC', border: '1px solid rgba(0, 122, 251, 0.18)', borderRadius: 999, padding: '5px 8px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent, #007AFB)' }} /> Academic
                </div>
                {canManageCalendar ? (
                  <button
                    type="button"
                    onClick={handleOpenCalendarEventModal}
                    style={{ ...rightRailIconButtonStyle, width: 30, height: 30, borderRadius: 999, color: 'var(--text-primary, #111827)' }}
                    aria-label="Add school calendar event"
                    title="Add school calendar event"
                  >
                    <FaPlus style={{ width: 12, height: 12 }} />
                  </button>
                ) : null}
              </div>

              {calendarActionMessage ? (
                <div style={{ margin: '10px 12px 0', borderRadius: 12, border: '1px solid rgba(0, 122, 251, 0.12)', background: '#F8FAFC', color: 'var(--text-primary, #111827)', fontSize: 10, fontWeight: 800, padding: '8px 10px' }}>
                  {calendarActionMessage}
                </div>
              ) : null}

              <div style={{ margin: '12px', background: '#F8FAFC', border: '1px solid rgba(15, 23, 42, 0.06)', borderRadius: 12, padding: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-primary, #111827)' }}>
                      {selectedCalendarDay
                        ? `${ETHIOPIAN_MONTHS[calendarViewDate.month - 1]} ${selectedCalendarDay.ethDay}, ${calendarViewDate.year}`
                        : 'Select a date'}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted, #64748b)', marginTop: 2 }}>
                      {selectedCalendarDay
                        ? `Gregorian ${selectedCalendarDay.gregorianDate.day}/${selectedCalendarDay.gregorianDate.month}/${selectedCalendarDay.gregorianDate.year}`
                        : 'Choose a day to view or add calendar events.'}
                    </div>
                  </div>
                  {calendarEventsLoading ? (
                    <div style={{ fontSize: 9, color: 'var(--text-muted, #64748b)', fontWeight: 700 }}>Loading...</div>
                  ) : null}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {selectedCalendarEvents.length === 0 ? (
                    <div style={{ fontSize: 9, color: 'var(--text-muted, #64748b)', background: 'var(--surface-muted, #F7FBFF)', borderRadius: 10, border: '1px solid var(--border-soft, #D7E7FB)', padding: '7px 9px' }}>
                      No school events on this day.
                    </div>
                  ) : (
                    selectedCalendarEvents.map((eventItem) => {
                      const eventMeta = getCalendarEventMeta(eventItem.category);

                      return (
                        <div
                          key={eventItem.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 7,
                            background: 'var(--surface-panel, #fff)',
                            border: `1px solid ${eventMeta.border}`,
                            borderRadius: 10,
                            padding: '7px 8px',
                          }}
                        >
                          <span style={{ width: 8, height: 8, marginTop: 4, borderRadius: '50%', background: eventMeta.color, flexShrink: 0 }} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-primary, #111827)' }}>{eventItem.title}</div>
                              {eventItem.isDefault ? (
                                <span style={{ padding: '2px 6px', borderRadius: 999, background: 'var(--accent-soft, #E7F2FF)', color: 'var(--accent-strong, #007AFB)', fontSize: 9, fontWeight: 800 }}>Default</span>
                              ) : null}
                            </div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted, #64748b)', marginTop: 2 }}>{eventMeta.label}</div>
                            {eventItem.notes ? (
                              <div style={{ fontSize: 9, color: 'var(--text-secondary, #475569)', marginTop: 3 }}>{eventItem.notes}</div>
                            ) : null}
                          </div>
                          {canManageCalendar && !eventItem.isDefault ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              <button
                                type="button"
                                onClick={() => handleEditCalendarEvent(eventItem)}
                                style={{ height: 26, padding: '0 9px', borderRadius: 8, border: '1px solid var(--border-soft, #D7E7FB)', background: 'var(--surface-panel, #fff)', color: 'var(--text-secondary, #475569)', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCalendarEvent(eventItem)}
                                style={{ height: 26, padding: '0 9px', borderRadius: 8, border: '1px solid var(--danger-border, #fca5a5)', background: 'var(--surface-panel, #fff)', color: 'var(--danger, #b91c1c)', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}
                              >
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div style={{ ...widgetCardStyle, padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: 'var(--text-primary, #111827)' }}>Upcoming Deadlines</h4>
                {canManageCalendar ? (
                  <button
                    type="button"
                    onClick={handleOpenDeadlineModal}
                    style={{ ...rightRailIconButtonStyle, borderRadius: 999, color: 'var(--text-primary, #111827)' }}
                    aria-label="Add upcoming deadline"
                    title="Add upcoming deadline"
                  >
                    <FaPlus style={{ width: 11, height: 11 }} />
                  </button>
                ) : null}
              </div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {calendarEventsLoading ? (
                  <div style={{ padding: '8px 9px', borderRadius: 10, border: '1px solid rgba(15, 23, 42, 0.06)', background: '#F8FAFC', fontSize: 10, color: 'var(--text-muted, #64748b)', fontWeight: 700 }}>
                    Loading deadlines...
                  </div>
                ) : upcomingDeadlineEvents.length === 0 ? (
                  <div style={{ padding: '8px 9px', borderRadius: 10, border: '1px solid rgba(15, 23, 42, 0.06)', background: '#F8FAFC', fontSize: 10, color: 'var(--text-muted, #64748b)' }}>
                    No upcoming deadlines in the next 30 days.
                    {canManageCalendar ? (
                      <button
                        type="button"
                        onClick={handleOpenDeadlineModal}
                        style={{ marginTop: 8, height: 28, padding: '0 10px', borderRadius: 999, border: '1px solid rgba(15, 23, 42, 0.08)', background: 'var(--surface-panel, #fff)', color: 'var(--text-primary, #111827)', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}
                      >
                        Add deadline
                      </button>
                    ) : null}
                  </div>
                ) : (
                  visibleUpcomingDeadlineEvents.map((eventItem) => {
                    const eventMeta = getCalendarEventMeta(eventItem.category);

                    return (
                      <div
                        key={`deadline-${eventItem.id}`}
                        style={{
                          padding: '8px 9px',
                          borderRadius: 10,
                          border: `1px solid ${eventMeta.border}`,
                          background: '#F8FAFC',
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-primary, #111827)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: eventMeta.color, flexShrink: 0 }} />
                            <span>{eventItem.title?.trim() || eventItem.notes?.trim() || 'Academic deadline'}</span>
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted, #64748b)', marginTop: 3 }}>
                            {eventMeta.label}
                          </div>
                        </div>
                        <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-secondary, #475569)', whiteSpace: 'nowrap' }}>
                          {formatCalendarDeadlineDate(eventItem.gregorianDate)}
                        </div>
                      </div>
                    );
                  })
                )}
                {!calendarEventsLoading && upcomingDeadlineEvents.length > 3 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllUpcomingDeadlines((currentValue) => !currentValue)}
                    style={{ alignSelf: 'flex-start', height: 28, padding: '0 10px', borderRadius: 999, border: '1px solid rgba(15, 23, 42, 0.08)', background: 'var(--surface-panel, #fff)', color: 'var(--text-primary, #111827)', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}
                  >
                    {showAllUpcomingDeadlines ? 'See less' : `See more (${upcomingDeadlineEvents.length - 3})`}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div style={{ ...widgetCardStyle, padding: '13px' }}>
            <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: 'var(--text-primary, #111827)' }}>Sponsored Links</h4>
            <ul style={{ margin: '10px 0 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13 }}>
              <li style={{ color: '#1d4ed8', fontWeight: 600 }}>Gojo Study App</li>
              <li style={{ color: '#1d4ed8', fontWeight: 600 }}>Finance Portal</li>
              <li style={{ color: '#1d4ed8', fontWeight: 600 }}>Register Office</li>
            </ul>
          </div>
        </div>
        </>
        ) : null}
      </div>

      {showCreatePostModal ? (
        <>
          <div
            onClick={closePostComposerModal}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.18)', backdropFilter: 'blur(10px)', zIndex: 1200 }}
          />
          <div style={{ position: 'fixed', inset: 0, zIndex: 1201, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, pointerEvents: 'none' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(640px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface-panel, #fff)', borderRadius: 28, border: '1px solid var(--border-soft, #dbe2f2)', boxShadow: 'none', pointerEvents: 'auto', position: 'relative' }}>
              <div style={{ position: 'relative', padding: '22px 24px 18px', borderBottom: '1px solid var(--border-soft, #dbe2f2)', background: 'var(--surface-panel, #fff)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 52 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', width: 'fit-content', height: 28, padding: '0 12px', borderRadius: 999, background: 'var(--accent-soft, #E7F2FF)', border: '1px solid var(--border-strong, #B5D2F8)', color: 'var(--accent-strong, #007AFB)', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {isPostComposerEditing ? 'Edit Announcement' : 'School Announcement'}
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary, #111827)', lineHeight: 1.1, letterSpacing: '-0.03em' }}>
                    {isPostComposerEditing ? 'Edit your post' : 'Create a new post'}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary, #334155)', lineHeight: 1.5, maxWidth: 420 }}>
                    {isPostComposerEditing
                      ? 'Update the message, audience, or media before publishing the revised version.'
                      : 'Share polished announcements, reminders, and updates with the right audience.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closePostComposerModal}
                  style={{ position: 'absolute', right: 18, top: 18, border: '1px solid var(--border-soft, #dbe2f2)', background: 'var(--surface-panel, #fff)', width: 40, height: 40, borderRadius: '50%', fontSize: 22, color: 'var(--text-secondary, #6b7280)', cursor: 'pointer', lineHeight: 1 }}
                  aria-label="Close create post modal"
                  title="Close"
                >
                  ×
                </button>
              </div>

              <div style={{ padding: '22px 24px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', padding: '14px 16px', borderRadius: 20, border: '1px solid var(--border-soft, #dbe2f2)', background: 'var(--surface-muted, #f8faff)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <Avatar src={admin.profileImage} alt="me" name={admin.name || 'HR Office'} size={48} style={{ border: '2px solid var(--border-strong, #B5D2F8)', boxShadow: 'var(--shadow-glow, 0 0 0 2px rgba(0, 122, 251, 0.18))' }} textSize={16} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary, #111827)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{admin.name || 'HR Office'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>{isPostComposerEditing ? 'Editing from the HR dashboard' : 'Posting from the HR dashboard'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 170 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      Audience
                    </div>
                    <select
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      style={{ height: 40, borderRadius: 12, border: '1px solid var(--input-border, #B5D2F8)', background: 'var(--input-bg, #fff)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #111827)', padding: '0 36px 0 12px', minWidth: 170, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)' }}
                      title="Post target role"
                    >
                      {targetOptions.map((role) => {
                        const label = role === 'all' ? 'All Users' : `${role.charAt(0).toUpperCase()}${role.slice(1)}s`;
                        return <option key={role} value={role}>{label}</option>;
                      })}
                    </select>
                  </div>
                </div>

                <div style={{ border: '1px solid var(--border-soft, #dbe2f2)', borderRadius: 24, background: 'var(--surface-panel, #fff)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 16px 12px', borderBottom: '1px solid color-mix(in srgb, var(--border-soft, #dbe2f2) 80%, transparent 20%)' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary, #111827)' }}>Post message</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>{postText.trim().length} characters</div>
                  </div>

                  <textarea
                    placeholder={isPostComposerEditing ? 'Update your announcement...' : 'Write a clear announcement for your school community...'}
                    value={postText}
                    onChange={(event) => setPostText(event.target.value)}
                    style={{ minHeight: 220, resize: 'vertical', border: 'none', background: 'transparent', borderRadius: 0, padding: '18px 18px 16px', fontSize: 19, lineHeight: 1.6, outline: 'none', color: 'var(--text-primary, #111827)', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ border: '1px solid var(--border-soft, #dbe2f2)', borderRadius: 20, padding: '14px 16px', background: 'var(--surface-panel, #fff)' }}>
                  <div className="fb-post-bottom" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ marginRight: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #111827)' }}>Media and attachments</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>Add a photo or video to make the update stand out.</div>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handlePostMediaSelection}
                      accept="image/*,video/*"
                      style={{ display: 'none' }}
                    />

                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '16px 18px', background: 'linear-gradient(180deg, var(--surface-muted, #f8faff) 0%, #ffffff 100%)', borderRadius: 18, border: '1px dashed var(--border-strong, #B5D2F8)', boxSizing: 'border-box', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '1 1 260px' }}>
                        <div style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--accent-soft, #E7F2FF)', border: '1px solid var(--border-strong, #B5D2F8)', color: 'var(--accent-strong, #007AFB)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                          {(postMedia && String(postMedia.type || '').startsWith('video/')) || (!postMedia && isLikelyVideoMedia(existingPostMediaType, existingPostMediaUrl)) ? <AiFillVideoCamera /> : <AiFillPicture />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary, #111827)' }}>
                            {postMedia
                              ? 'Media ready to attach'
                              : existingPostMediaUrl
                                ? 'Current media will stay attached'
                                : 'Choose a photo or video'}
                          </div>
                          <div style={{ marginTop: 3, fontSize: 12, color: 'var(--text-muted, #64748b)', lineHeight: 1.45 }}>
                            {isOptimizingMedia
                              ? 'Optimizing your image before upload.'
                              : existingPostMediaUrl && !postMedia
                                ? 'Replace it with a new file or remove it below.'
                                : 'Images are automatically compressed and converted to JPEG when that reduces size.'}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginLeft: 'auto' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 999, border: '1px solid var(--border-soft, #dbe2f2)', background: 'var(--surface-panel, #fff)', color: 'var(--text-secondary, #334155)', fontSize: 11, fontWeight: 800, letterSpacing: '0.02em' }}>
                          <AiFillVideoCamera style={{ color: 'var(--danger, #dc2626)', fontSize: 15 }} />
                          Photos and videos
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenPostMediaPicker}
                          disabled={isOptimizingMedia}
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 42, padding: '0 18px', borderRadius: 999, background: isOptimizingMedia ? 'var(--surface-strong, #DCEBFF)' : 'var(--accent, #007AFB)', border: 'none', cursor: isOptimizingMedia ? 'progress' : 'pointer', color: '#fff', fontSize: 13, fontWeight: 800, opacity: isOptimizingMedia ? 0.86 : 1, minWidth: 138 }}
                        >
                          <AiFillPicture style={{ fontSize: 17 }} />
                          <span>{isOptimizingMedia ? 'Optimizing...' : postMedia ? 'Change file' : 'Choose file'}</span>
                        </button>
                      </div>
                    </div>

                    {existingPostMediaUrl && !postMedia ? (
                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 14px', background: 'var(--surface-muted, #f8faff)', borderRadius: 16, border: '1px solid var(--border-soft, #dbe2f2)', boxSizing: 'border-box' }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary, #111827)' }}>Current attachment</div>
                        <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border-soft, #dbe2f2)', background: '#ffffff' }}>
                          {isLikelyVideoMedia(existingPostMediaType, existingPostMediaUrl) ? (
                            <video src={existingPostMediaUrl} controls style={{ width: '100%', maxHeight: 260, display: 'block', background: '#000' }} />
                          ) : (
                            <img src={existingPostMediaUrl} alt="Current attachment" style={{ width: '100%', maxHeight: 260, objectFit: 'contain', display: 'block', background: '#ffffff' }} />
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
                            Save to keep this attachment, or remove it before publishing.
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setExistingPostMediaUrl('');
                              setExistingPostMediaType('');
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            style={{ height: 34, padding: '0 14px', borderRadius: 999, border: '1px solid var(--danger-border, #fca5a5)', background: 'var(--surface-panel, #fff)', color: 'var(--danger, #b91c1c)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                          >
                            Remove current media
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {postMedia ? (
                      <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--surface-muted, #f8faff)', borderRadius: 16, border: '1px solid var(--border-soft, #dbe2f2)', boxSizing: 'border-box' }}>
                        <div style={{ width: 42, height: 42, borderRadius: 12, background: String(postMedia.type || '').startsWith('video/') ? 'var(--warning-soft, #fff7ed)' : 'var(--success-soft, #E9FBF9)', color: String(postMedia.type || '').startsWith('video/') ? 'var(--danger, #dc2626)' : 'var(--success, #00B6A9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {String(postMedia.type || '').startsWith('video/') ? <AiFillVideoCamera style={{ fontSize: 20 }} /> : <AiFillPicture style={{ fontSize: 20 }} />}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, color: 'var(--text-primary, #111827)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{postMedia.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginTop: 2 }}>
                            {postMediaMeta?.wasCompressed
                              ? `Optimized from ${formatFileSize(postMediaMeta.originalSize)} to ${formatFileSize(postMediaMeta.finalSize)}${postMediaMeta.wasConvertedToJpeg ? ' as JPEG' : ''}`
                              : `Ready to attach to this post${postMediaMeta?.wasConvertedToJpeg ? ' as JPEG' : ''}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPostMedia(null);
                            setPostMediaMeta(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          style={{ background: 'var(--surface-panel, #fff)', border: '1px solid var(--border-soft, #dbe2f2)', color: 'var(--text-secondary, #6b7280)', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontSize: 18, lineHeight: 1, flexShrink: 0 }}
                          aria-label="Remove selected media"
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', paddingTop: 2 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', lineHeight: 1.5 }}>
                    {isPostComposerEditing
                      ? 'Your updated post will replace the current version in the HR feed as soon as you save.'
                      : 'Your post will appear in the HR feed immediately after publishing.'}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
                    <button
                      type="button"
                      onClick={closePostComposerModal}
                      style={{ height: 44, padding: '0 18px', borderRadius: 999, border: '1px solid var(--border-soft, #dbe2f2)', background: 'var(--surface-panel, #fff)', color: 'var(--text-secondary, #334155)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={handleSubmitCreatePost}
                      disabled={!canSubmitPost || isPostSubmitting}
                      style={{ minWidth: 160, height: 46, border: 'none', background: canSubmitPost && !isPostSubmitting ? 'var(--accent, #007AFB)' : 'var(--surface-strong, #DCEBFF)', borderRadius: 999, color: canSubmitPost && !isPostSubmitting ? '#fff' : 'var(--text-muted, #64748b)', fontSize: 14, fontWeight: 800, letterSpacing: '0.01em', cursor: canSubmitPost && !isPostSubmitting ? 'pointer' : 'not-allowed', boxShadow: canSubmitPost && !isPostSubmitting ? '0 8px 18px rgba(0, 122, 251, 0.14)' : 'none' }}
                    >
                      {isOptimizingMedia
                        ? 'Optimizing...'
                        : isPostSubmitting
                          ? (isPostComposerEditing ? 'Saving...' : 'Publishing...')
                          : (isPostComposerEditing ? 'Save changes' : 'Publish post')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {showDeletePostModal ? (
        <>
          <div
            onClick={handleCloseDeletePostModal}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.24)', backdropFilter: 'blur(8px)', zIndex: 1210 }}
          />
          <div style={{ position: 'fixed', inset: 0, zIndex: 1211, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, pointerEvents: 'none' }}>
            <div onClick={(event) => event.stopPropagation()} style={{ width: 'min(460px, 100%)', background: 'var(--surface-panel, #fff)', borderRadius: 24, border: '1px solid var(--border-soft, #dbe2f2)', overflow: 'hidden', pointerEvents: 'auto' }}>
              <div style={{ padding: '22px 24px 14px', borderBottom: '1px solid var(--border-soft, #dbe2f2)' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', width: 'fit-content', height: 28, padding: '0 12px', borderRadius: 999, background: 'var(--warning-soft, #FEE2E2)', border: '1px solid var(--warning-border, #FCA5A5)', color: 'var(--danger, #b91c1c)', fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Delete post
                </div>
                <div style={{ marginTop: 12, fontSize: 24, fontWeight: 800, color: 'var(--text-primary, #111827)', lineHeight: 1.15 }}>Delete this post?</div>
                <div style={{ marginTop: 8, fontSize: 14, color: 'var(--text-secondary, #334155)', lineHeight: 1.6 }}>
                  This will permanently remove the post from the HR feed for everyone in the school.
                </div>
              </div>

              <div style={{ padding: '18px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {pendingDeletePost?.message ? (
                  <div style={{ borderRadius: 18, border: '1px solid var(--border-soft, #dbe2f2)', background: 'var(--surface-muted, #F7FBFF)', padding: '14px 16px', fontSize: 14, lineHeight: 1.55, color: 'var(--text-primary, #111827)', whiteSpace: 'pre-wrap' }}>
                    {pendingDeletePost.message}
                  </div>
                ) : null}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleCloseDeletePostModal}
                    disabled={isDeletingPost}
                    style={{ height: 44, padding: '0 18px', borderRadius: 999, border: '1px solid var(--border-soft, #dbe2f2)', background: 'var(--surface-panel, #fff)', color: 'var(--text-secondary, #334155)', fontSize: 13, fontWeight: 700, cursor: isDeletingPost ? 'not-allowed' : 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeletePost}
                    disabled={isDeletingPost}
                    style={{ minWidth: 150, height: 46, border: 'none', borderRadius: 999, background: isDeletingPost ? 'var(--warning-border, #FCA5A5)' : 'var(--danger, #b91c1c)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: isDeletingPost ? 'not-allowed' : 'pointer' }}
                  >
                    {isDeletingPost ? 'Deleting...' : 'Delete post'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {showCalendarEventModal ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'color-mix(in srgb, var(--text-primary, #111827) 26%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 1220,
          }}
          onClick={handleCloseCalendarEventModal}
        >
          <div
            style={{
              width: 'min(470px, 100%)',
              background: 'var(--surface-panel, #fff)',
              borderRadius: 20,
              border: '1px solid var(--border-soft, #dbe2f2)',
              boxShadow: 'var(--shadow-panel, 0 14px 30px rgba(0, 122, 251, 0.14))',
              overflow: 'hidden',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ padding: '16px 16px 12px', background: 'linear-gradient(180deg, var(--surface-overlay, #F1F8FF) 0%, var(--surface-panel, #fff) 100%)', borderBottom: '1px solid var(--border-soft, #dbe2f2)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text-primary, #111827)' }}>
                  {editingCalendarEventId
                    ? 'Edit school calendar event'
                    : calendarModalContext === 'deadline'
                      ? 'Add upcoming deadline'
                      : 'Add school calendar event'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary, #334155)', marginTop: 4 }}>
                  {selectedCalendarDay
                    ? calendarModalContext === 'deadline'
                      ? `Choose the date for this upcoming deadline in ${ETHIOPIAN_MONTHS[calendarViewDate.month - 1]}`
                      : `For Ethiopic day ${selectedCalendarDay.ethDay} in ${ETHIOPIAN_MONTHS[calendarViewDate.month - 1]}`
                    : 'Select a day in the calendar first.'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseCalendarEventModal}
                style={{ width: 34, height: 34, borderRadius: 999, border: '1px solid var(--border-soft, #dbe2f2)', background: 'var(--surface-overlay, #F1F8FF)', color: 'var(--text-secondary, #334155)', fontSize: 20, lineHeight: 1, cursor: 'pointer' }}
                aria-label="Close calendar event modal"
              >
                ×
              </button>
            </div>

            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!canManageCalendar ? (
                <div style={{ fontSize: 10, color: 'var(--warning, #DC2626)', background: 'var(--warning-soft, #FEE2E2)', border: '1px solid var(--warning-border, #FCA5A5)', borderRadius: 10, padding: '8px 10px' }}>
                  View only. HR or admin access is required to add, edit, or delete school calendar events.
                </div>
              ) : null}

              <div style={{ border: '1px solid var(--border-soft, #dbe2f2)', borderRadius: 16, padding: 10, background: 'linear-gradient(180deg, var(--surface-overlay, #F1F8FF) 0%, var(--surface-panel, #fff) 100%)', boxShadow: 'inset 0 1px 0 color-mix(in srgb, white 45%, transparent), var(--shadow-soft, 0 10px 24px rgba(0, 122, 251, 0.10))' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-primary, #111827)' }}>Choose day from calendar</div>
                    <div style={{ fontSize: 9, color: 'var(--text-secondary, #334155)', marginTop: 2, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{calendarMonthLabel}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => handleCalendarMonthChange(-1)}
                      style={{ width: 28, height: 28, borderRadius: 9, border: '1px solid var(--border-soft, #dbe2f2)', background: 'var(--surface-overlay, #F1F8FF)', color: 'var(--text-primary, #111827)', cursor: 'pointer', fontSize: 16, lineHeight: 1, boxShadow: 'var(--shadow-soft, 0 10px 24px rgba(0, 122, 251, 0.10))' }}
                      aria-label="Previous Ethiopian month"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCalendarMonthChange(1)}
                      style={{ width: 28, height: 28, borderRadius: 9, border: '1px solid var(--border-soft, #dbe2f2)', background: 'var(--surface-overlay, #F1F8FF)', color: 'var(--text-primary, #111827)', cursor: 'pointer', fontSize: 16, lineHeight: 1, boxShadow: 'var(--shadow-soft, 0 10px 24px rgba(0, 122, 251, 0.10))' }}
                      aria-label="Next Ethiopian month"
                    >
                      ›
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, marginBottom: 5 }}>
                  {CALENDAR_WEEK_DAYS.map((dayLabel) => (
                    <div key={dayLabel} style={{ textAlign: 'center', fontSize: 8, fontWeight: 800, color: 'var(--text-secondary, #334155)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {dayLabel}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
                  {calendarDays.map((dayItem, index) => {
                    const isSelectedDay = dayItem?.isoDate === selectedCalendarIsoDate;
                    const hasEvents = (dayItem?.events?.length || 0) > 0;
                    const isTodayDay = dayItem?.ethDay === calendarHighlightedDay;
                    const cellBackground = !dayItem
                      ? 'transparent'
                      : isTodayDay
                        ? 'linear-gradient(145deg, var(--accent-soft, #E7F2FF) 0%, color-mix(in srgb, var(--accent, #007AFB) 22%, var(--surface-overlay, #F1F8FF)) 100%)'
                        : isSelectedDay
                          ? 'linear-gradient(145deg, var(--surface-overlay, #F1F8FF) 0%, var(--accent-soft, #E7F2FF) 55%, color-mix(in srgb, var(--accent, #007AFB) 22%, var(--surface-overlay, #F1F8FF)) 100%)'
                          : hasEvents
                            ? 'linear-gradient(145deg, color-mix(in srgb, var(--warning-soft, #FEE2E2) 72%, var(--surface-panel, #fff)) 0%, var(--warning-soft, #FEE2E2) 100%)'
                            : 'linear-gradient(145deg, var(--surface-panel, #fff) 0%, var(--surface-overlay, #F1F8FF) 100%)';

                    return (
                      <button
                        key={`${dayItem?.isoDate || 'blank'}-${index}`}
                        type="button"
                        onClick={() => dayItem && setSelectedCalendarIsoDate(dayItem.isoDate)}
                        disabled={!dayItem || !canManageCalendar}
                        style={{
                          minHeight: 0,
                          aspectRatio: '1 / 1',
                          borderRadius: 10,
                          border: isTodayDay
                            ? '1px solid var(--accent, #007AFB)'
                            : isSelectedDay
                              ? '1px solid var(--accent-strong, #007AFB)'
                              : hasEvents
                                ? '1px solid var(--warning-border, #FCA5A5)'
                                : '1px solid transparent',
                          background: cellBackground,
                          color: !dayItem ? 'transparent' : isSelectedDay || isTodayDay ? 'var(--accent-strong, #007AFB)' : 'var(--text-primary, #111827)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 1,
                          cursor: dayItem && canManageCalendar ? 'pointer' : 'default',
                          boxShadow: isSelectedDay
                            ? '0 0 0 1px color-mix(in srgb, var(--accent, #007AFB) 24%, transparent), 0 12px 22px color-mix(in srgb, var(--accent-strong, #007AFB) 18%, transparent)'
                            : isTodayDay
                              ? '0 10px 18px color-mix(in srgb, var(--accent-strong, #007AFB) 14%, transparent)'
                              : 'var(--shadow-soft, 0 10px 24px rgba(0, 122, 251, 0.10))',
                          padding: '4px 2px',
                          overflow: 'hidden',
                          position: 'relative',
                          transform: isSelectedDay ? 'translateY(-1px) scale(1.02)' : 'translateY(0) scale(1)',
                          transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease',
                        }}
                      >
                        {dayItem ? (
                          <>
                            <div style={{ fontSize: 11, fontWeight: 800, lineHeight: 1 }}>{dayItem.ethDay}</div>
                            <div style={{ fontSize: 8, color: isSelectedDay ? 'var(--accent-strong, #007AFB)' : 'var(--text-secondary, #334155)', lineHeight: 1 }}>{dayItem.gregorianDate.day}/{dayItem.gregorianDate.month}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2, minHeight: 6 }}>
                              {dayItem.events.slice(0, 2).map((eventItem) => (
                                <span
                                  key={eventItem.id}
                                  style={{
                                    width: 5,
                                    height: 5,
                                    borderRadius: '50%',
                                    background: getCalendarEventMeta(eventItem.category).color,
                                    boxShadow: '0 0 0 2px color-mix(in srgb, var(--surface-panel, #fff) 82%, transparent)',
                                  }}
                                />
                              ))}
                            </div>
                          </>
                        ) : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              {calendarModalContext === 'deadline' ? (
                <div style={{ height: 42, borderRadius: 12, border: '1px solid var(--accent, #007AFB)', padding: '0 12px', fontSize: 12, color: 'var(--accent, #007AFB)', background: 'var(--accent-soft, #E7F2FF)', display: 'flex', alignItems: 'center', fontWeight: 800 }}>
                  Academic deadline
                </div>
              ) : (
                <select
                  value={calendarEventForm.category}
                  onChange={(event) => setCalendarEventForm((prev) => ({ ...prev, category: event.target.value, subType: 'general' }))}
                  disabled={!canManageCalendar}
                  style={{ height: 42, borderRadius: 12, border: '1px solid var(--input-border, #B5D2F8)', padding: '0 12px', fontSize: 12, color: 'var(--text-primary, #111827)', background: 'var(--input-bg, #fff)' }}
                >
                  <option value="no-class">No class day</option>
                  <option value="academic">Academic day</option>
                </select>
              )}

              {calendarModalContext === 'deadline' ? (
                <input
                  type="text"
                  value={calendarEventForm.title}
                  onChange={(event) => setCalendarEventForm((prev) => ({ ...prev, title: event.target.value }))}
                  disabled={!canManageCalendar}
                  placeholder="Deadline title"
                  style={{ height: 42, borderRadius: 12, border: '1px solid var(--input-border, #B5D2F8)', padding: '0 12px', fontSize: 12, color: 'var(--text-primary, #111827)', background: 'var(--input-bg, #fff)' }}
                />
              ) : null}

              <textarea
                value={calendarEventForm.notes}
                onChange={(event) => setCalendarEventForm((prev) => ({ ...prev, notes: event.target.value }))}
                disabled={!canManageCalendar}
                placeholder={calendarModalContext === 'deadline' ? 'Optional deadline note' : 'Optional note'}
                rows={3}
                style={{ borderRadius: 12, border: '1px solid var(--input-border, #B5D2F8)', padding: '12px', fontSize: 12, color: 'var(--text-primary, #111827)', background: 'var(--input-bg, #fff)', resize: 'vertical' }}
              />

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                <button
                  type="button"
                  onClick={handleCreateCalendarEvent}
                  disabled={calendarEventSaving || !selectedCalendarDay || !canManageCalendar}
                  style={{
                    flex: '1 1 180px',
                    height: 42,
                    borderRadius: 12,
                    border: 'none',
                    background: calendarEventSaving || !selectedCalendarDay || !canManageCalendar ? 'var(--surface-strong, #DCEBFF)' : 'linear-gradient(135deg, var(--accent, #007AFB) 0%, var(--accent-strong, #007AFB) 100%)',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: calendarEventSaving || !selectedCalendarDay || !canManageCalendar ? 'not-allowed' : 'pointer',
                    boxShadow: calendarEventSaving || !selectedCalendarDay || !canManageCalendar ? 'none' : '0 12px 18px color-mix(in srgb, var(--accent-strong, #007AFB) 18%, transparent)',
                  }}
                >
                  {calendarEventSaving ? 'Saving...' : editingCalendarEventId ? 'Update calendar event' : 'Save calendar event'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseCalendarEventModal}
                  style={{ height: 42, padding: '0 14px', borderRadius: 12, border: '1px solid var(--border-soft, #dbe2f2)', background: 'var(--surface-overlay, #F1F8FF)', color: 'var(--text-primary, #111827)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
