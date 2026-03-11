import React, { useEffect, useRef, useState } from 'react';
import api from '../api';
import { Link, useNavigate } from "react-router-dom";
import { AiFillPicture, AiFillVideoCamera } from "react-icons/ai";
import { FaBell, FaFacebookMessenger, FaCog, FaUsers, FaBuilding, FaClipboardList, FaChalkboardTeacher, FaChartLine, FaChartPie, FaBirthdayCake, FaCalendarAlt, FaClock, FaArrowUp, FaArrowDown, FaMale, FaFemale, FaThumbsUp, FaEllipsisH } from "react-icons/fa";
import './Dashboard.css';
import '../styles/global.css';

function StatCard({ title, value, icon, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 18, minWidth: 180, flex: 1, boxShadow: '0 6px 20px rgba(50,60,90,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ background: color || '#eef2ff', color: '#fff', padding: 12, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div>
        <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>{value}</div>
      </div>
    </div>
  )
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

function GenderBar({ male = 0, female = 0, other = 0, width = 220, height = 80 }) {
  const total = Math.max(1, male + female + other);
  const max = Math.max(male, female, other, 1);
  const barW = 40;
  const gap = 16;
  const startX = 10;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {[{k:'Male',v:male,color:'#4b6cb7'},{k:'Female',v:female,color:'#e0245e'},{k:'Other',v:other,color:'#f59e0b'}].map((b,i)=>{
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

function KPI({ title, value, delta, sparkData, positive=true }) {
  return (
    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <div>
        <h3>{title}</h3>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{value}</div>
        <div style={{ fontSize: 12, color: positive ? '#059669' : '#dc2626', marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ display: 'inline-flex', alignItems: 'center' }}>{positive ? <FaArrowUp /> : <FaArrowDown />}</span>{delta}</div>
      </div>
      <div>
        <Sparkline data={sparkData} />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [employees, setEmployees] = useState([]);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [upcomingCalendarEvents, setUpcomingCalendarEvents] = useState([]);
  const [postText, setPostText] = useState('');
  const [postMedia, setPostMedia] = useState(null);
  const [targetRole, setTargetRole] = useState('all');
  const [targetOptions] = useState(['all', 'teacher', 'management', 'finance', 'hr']);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [expandedPostDescriptions, setExpandedPostDescriptions] = useState({});
  const [admin, setAdmin] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("admin")) || {};
    } catch (e) {
      return {};
    }
  });
  const navigate = useNavigate();
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [dashboardView, setDashboardView] = useState('home');
  const [postFeedView, setPostFeedView] = useState('all');
  const [isDashboardMenuOpen, setIsDashboardMenuOpen] = useState(true);
  const [selectedCalendarIsoDate, setSelectedCalendarIsoDate] = useState('');
  const [hoveredCalendarIsoDate, setHoveredCalendarIsoDate] = useState('');
  const fileInputRef = useRef(null);
  const CALENDAR_WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const ethiopicMonthYearFormatter = new Intl.DateTimeFormat('en-US-u-ca-ethiopic', {
    month: 'long',
    year: 'numeric',
  });
  const ethiopicDayFormatter = new Intl.DateTimeFormat('en-US-u-ca-ethiopic', {
    day: 'numeric',
  });
  const ethiopicDayMonthFormatter = new Intl.DateTimeFormat('en-US-u-ca-ethiopic', {
    day: 'numeric',
    month: 'numeric',
  });
  const ethiopicLongFormatter = new Intl.DateTimeFormat('en-US-u-ca-ethiopic', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/employees');
        const items = res.data || [];
        setEmployees(Array.isArray(items) ? items : Object.values(items || {}));
      } catch (e) {
        console.error(e);
      }
    }
    load();
  }, []);

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await api.get('/users');
        const items = res.data || [];
        if (Array.isArray(items)) {
          setUsers(items);
          return;
        }
        const normalized = Object.entries(items || {}).map(([id, payload]) => ({
          ...(payload || {}),
          id,
        }));
        setUsers(normalized);
      } catch (e) {
        console.error(e);
        setUsers([]);
      }
    }

    loadUsers();
  }, []);

  useEffect(() => {
    async function fetchPosts() {
      try {
        const response = await api.get('/api/get_posts');
        const items = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data?.posts)
            ? response.data.posts
            : [];
        setPosts(items);
      } catch (error) {
        console.error('Failed to load posts:', error);
        setPosts([]);
      }
    }

    fetchPosts();
  }, []);

  useEffect(() => {
    async function fetchCalendarDeadlines() {
      try {
        const response = await api.get('/api/calendar_events', {
          params: {
            deadlinesOnly: 1,
            upcoming: 1,
            days: 120,
          },
        });

        const events = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data?.events)
            ? response.data.events
            : [];

        setUpcomingCalendarEvents(events);
      } catch (error) {
        console.error('Failed to load calendar deadlines:', error);
        setUpcomingCalendarEvents([]);
      }
    }

    fetchCalendarDeadlines();
  }, []);

  const count = employees.length;
  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean))).length || 3;
  const openPositions = Math.max(2, Math.round((count / 10))) ;
  const attendanceRate = employees.length ? `${Math.round((employees.filter(e => e.presentToday).length / employees.length) * 100) || 96}%` : '—';

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
    const job = raw.job || raw.profileData?.job || {};
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

  const usersById = users.reduce((acc, user) => {
    const id = user?.id || user?.userId;
    if (id) acc[id] = user;
    return acc;
  }, {});

  // gender distribution for donut / cards
  function extractGender(e) {
    const raw = e || {};
    const userId = raw.userId || raw.profileData?.userId || raw.account?.userId || raw.auth?.userId;
    const linkedUser = userId ? usersById[userId] : null;

    const g = (
      raw.gender ||
      raw.personal?.gender ||
      raw.profileData?.personal?.gender ||
      linkedUser?.gender ||
      linkedUser?.personal?.gender ||
      ''
    )
      .toString()
      .toLowerCase();
    if (g.includes('f')) return 'female';
    if (g.includes('m')) return 'male';
    return 'other';
  }

  const genderCounts = employees.reduce((acc, e) => {
    const g = extractGender(e);
    acc[g] = (acc[g] || 0) + 1;
    return acc;
  }, {});
  const maleCount = genderCounts.male || 0;
  const femaleCount = genderCounts.female || 0;
  const otherCount = genderCounts.other || 0;
  const genderValues = [maleCount, femaleCount, otherCount];

  const notificationCount = upcomingBirthdays.length + upcomingContracts.length;
  const messageCount = recentHires.length;
  const todayPostCount = posts.filter((post) => {
    if (!post?.time) return false;
    const postDate = new Date(post.time);
    return !Number.isNaN(postDate.getTime()) && postDate.toDateString() === new Date().toDateString();
  }).length;

  const currentMonthLabel = ethiopicMonthYearFormatter.format(calendarViewDate);
  const calendarMonthStartGregorian = {
    day: 1,
    month: calendarViewDate.getMonth() + 1,
    year: calendarViewDate.getFullYear(),
  };
  const calendarMonthEndGregorian = {
    day: new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 0).getDate(),
    month: calendarViewDate.getMonth() + 1,
    year: calendarViewDate.getFullYear(),
  };
  const calendarFirstWeekday = new Date(
    calendarViewDate.getFullYear(),
    calendarViewDate.getMonth(),
    1,
  ).getDay();
  const calendarDaysInMonth = new Date(
    calendarViewDate.getFullYear(),
    calendarViewDate.getMonth() + 1,
    0,
  ).getDate();

  const toIsoDate = (dateObj) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayIsoDate = toIsoDate(new Date());

  const calendarDays = Array.from({ length: calendarFirstWeekday + calendarDaysInMonth }, (_, index) => {
    if (index < calendarFirstWeekday) return null;
    const day = index - calendarFirstWeekday + 1;
    const fullDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth(), day);
    const dayBirthdays = employees.filter((employee) => {
      if (!employee.birthDate) return false;
      const parsed = new Date(employee.birthDate);
      return parsed.getMonth() === fullDate.getMonth() && parsed.getDate() === fullDate.getDate();
    });
    const dayContracts = employees.filter((employee) => {
      if (!employee.contractEnd) return false;
      const parsed = new Date(employee.contractEnd);
      return parsed.getFullYear() === fullDate.getFullYear() && parsed.getMonth() === fullDate.getMonth() && parsed.getDate() === fullDate.getDate();
    });

    return {
      day,
      isoDate: toIsoDate(fullDate),
      birthdays: dayBirthdays,
      contracts: dayContracts,
      eventCount: dayBirthdays.length + dayContracts.length,
    };
  });

  const selectedCalendarDay = calendarDays.find((dayItem) => dayItem?.isoDate === selectedCalendarIsoDate) || null;
  const monthEventCount = calendarDays.reduce((total, dayItem) => total + (dayItem?.eventCount || 0), 0);

  const handleCalendarMonthChange = (offset) => {
    setCalendarViewDate((currentDate) => new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
    setSelectedCalendarIsoDate('');
  };

  const todayHires = employees.filter((employee) => {
    const hireDate = getEmployeeHireDate(employee);
    if (!hireDate) return false;
    return hireDate.toDateString() === new Date().toDateString();
  }).length;

  const recentContacts = recentHires.slice(0, 4);
  const normalizedEmployees = employees.map((employee) => {
    const job = employee?.job || employee?.profileData?.job || {};
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

  const overviewCardStyle = {
    background: 'linear-gradient(180deg, var(--surface-panel, #fff) 0%, var(--surface-muted, #f8faff) 100%)',
    border: '1px solid var(--border-soft, #dbe2f2)',
    borderRadius: 16,
    boxShadow: '0 10px 24px rgba(17,24,39,0.08)',
    padding: 16,
  };

  const widgetCardStyle = {
    background: 'linear-gradient(180deg, var(--surface-panel, #fff) 0%, var(--surface-accent, #f8faff) 100%)',
    borderRadius: 16,
    boxShadow: 'var(--shadow-soft, 0 8px 22px rgba(17,24,39,0.08))',
    padding: '11px',
    border: '1px solid var(--border-soft, #dbe2f2)',
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
    maxWidth: '780px',
    margin: '0 auto',
    boxSizing: 'border-box',
  };
  const shellCardStyle = {
    background: 'var(--surface-panel, #fff)',
    color: 'var(--text-primary, #111827)',
    borderRadius: 16,
    border: '1px solid var(--border-soft, #dbe2f2)',
    boxShadow: 'var(--shadow-soft, 0 8px 22px rgba(17,24,39,0.08))',
  };
  const canSubmitPost = Boolean(postText.trim() || postMedia);
  const postOwnerId = admin?.adminId || admin?.hrId || admin?.id || admin?.userId || 'hr-admin';
  const currentLikeActorId = admin?.userId || admin?.id || admin?.adminId || admin?.hrId || 'hr-admin';
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
    if (!canSubmitPost) return;

    if (!postOwnerId) {
      alert('Session expired');
      return;
    }

    let postUrl = '';
    if (postMedia) {
      postUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event?.target?.result || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(postMedia);
      });
    }

    try {
      const payload = {
        message: postText,
        postUrl,
        adminId: postOwnerId,
        userId: admin?.userId || admin?.id || postOwnerId,
        adminName: admin?.name || 'HR Office',
        adminProfile: admin?.profileImage || '/default-profile.png',
        targetRole: targetRole || 'all',
      };

      const response = await api.post('/api/create_post', payload);
      const createdPost = response?.data?.post;

      if (createdPost) {
        setPosts((currentPosts) => [createdPost, ...currentPosts]);
      }

      setPostText('');
      setPostMedia(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return createdPost;
    } catch (error) {
      console.error('Failed to create post:', error?.response?.data || error);
      throw error;
    }
  };

  const handleSubmitCreatePost = async () => {
    if (!canSubmitPost) return;
    try {
      await handlePost();
      setShowCreatePostModal(false);
    } catch (error) {
      console.error('Create post failed:', error?.response?.data || error);
      alert(error?.response?.data?.message || 'Unable to create post. Please try again.');
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      await api.delete(`/api/delete_post/${postId}`);
      setPosts((currentPosts) => currentPosts.filter((post) => post.postId !== postId));
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert('Unable to delete post. Please try again.');
    }
  };

  const handleLikePost = async (postId) => {
    try {
      const response = await api.post('/api/like_post', {
        postId,
        userId: currentLikeActorId,
        adminId: postOwnerId,
      });

      const likeCount = response?.data?.likeCount;
      const likes = response?.data?.likes;

      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.postId === postId
            ? {
                ...post,
                likeCount: typeof likeCount === 'number' ? likeCount : post.likeCount,
                likes: likes && typeof likes === 'object' ? likes : (post.likes || {}),
              }
            : post,
        ),
      );
    } catch (error) {
      console.error('Failed to like post:', error);
      alert('Unable to update like. Please try again.');
    }
  };

  return (
    <div className="dashboard-page" style={{ background: 'var(--page-bg, #f4f6fb)', minHeight: '100vh' }}>
      <nav className="top-navbar" style={{ borderBottom: '1px solid var(--border-soft, #dbe2f2)', background: 'var(--surface-overlay, #ffffff)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <h2>Gojo HR</h2>
          <span className="muted">— Admin Dashboard</span>
        </div>

        <div className="nav-right" style={{ position: 'relative' }}>
          <div className="icon-circle" title="Notifications" onClick={() => setShowNotificationDropdown((prev) => !prev)} style={{ position: 'relative' }}>
            <FaBell />
            {notificationCount > 0 ? (
              <span style={{ position: 'absolute', top: -4, right: -2, minWidth: 17, height: 17, borderRadius: '999px', background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                {notificationCount}
              </span>
            ) : null}
          </div>
          {showNotificationDropdown ? (
            <div style={{ position: 'absolute', top: 48, right: 96, width: 320, maxHeight: 320, overflowY: 'auto', borderRadius: 10, border: '1px solid var(--border-soft, #dbe2f2)', background: 'var(--surface-panel, #fff)', boxShadow: '0 16px 40px rgba(20,35,78,0.15)', zIndex: 1200 }}>
              <div style={{ padding: '10px 12px', fontSize: 13, fontWeight: 800, borderBottom: '1px solid var(--border-soft, #dbe2f2)' }}>Notifications</div>
              {notificationCount === 0 ? (
                <div style={{ padding: 12, fontSize: 12, color: 'var(--text-muted, #6b7280)' }}>No new notifications</div>
              ) : (
                <>
                  {upcomingBirthdays.slice(0, 4).map((item, index) => (
                    <div key={`bday-${index}`} style={{ padding: '9px 12px', borderBottom: '1px solid var(--border-soft, #eef2ff)', fontSize: 12 }}>
                      🎂 {item.name || item.fullName || 'Employee'} has a birthday soon
                    </div>
                  ))}
                  {upcomingContracts.slice(0, 4).map((item, index) => (
                    <div key={`contract-${index}`} style={{ padding: '9px 12px', borderBottom: '1px solid var(--border-soft, #eef2ff)', fontSize: 12 }}>
                      📄 {item.name || item.fullName || 'Employee'} contract ends soon
                    </div>
                  ))}
                </>
              )}
            </div>
          ) : null}
          <div className="icon-circle" title="Messages" onClick={() => navigate('/all-chat')}><FaFacebookMessenger /></div>
          <Link to="/settings" className="icon-circle" aria-label="Settings"><FaCog /></Link>
          <img src={admin.profileImage || '/default-profile.png'} alt="admin" className="profile-img" />
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: 'flex', gap: 14, padding: '18px 14px', paddingLeft: 'calc(var(--sidebar-width, 220px) + 54px)', minHeight: '100vh', background: 'var(--page-bg, #f4f6fb)', width: '100%', boxSizing: 'border-box' }}>
        <aside className="google-sidebar">
          <div className="sidebar-profile">
            <div className="sidebar-img-circle">
              <img src={admin?.profileImage || '/default-profile.png'} alt="profile" />
            </div>
            <h3>{admin?.name || 'Admin Name'}</h3>
            <p>{admin?.hrId || 'username'}</p>
          </div>

          <div className="sidebar-menu">
            <button
              type="button"
              className="sidebar-btn"
              onClick={() => setIsDashboardMenuOpen((open) => !open)}
              aria-expanded={isDashboardMenuOpen}
              style={{ backgroundColor: "#4b6cb7", color: "white" }}
            >
              <FaUsers /> Dashboard
            </button>

            {isDashboardMenuOpen ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2, marginBottom: 6 }}>
                <button
                  type="button"
                  className="sidebar-btn"
                  onClick={() => {
                    setDashboardView('home');
                    setPostFeedView('all');
                  }}
                  style={{
                    marginLeft: 18,
                    width: 'calc(100% - 18px)',
                    fontSize: 14,
                    backgroundColor: dashboardView === 'home' && postFeedView === 'all' ? '#4b6cb7' : undefined,
                    color: dashboardView === 'home' && postFeedView === 'all' ? '#fff' : undefined,
                  }}
                >
                  Home
                </button>
                <button
                  type="button"
                  className="sidebar-btn"
                  onClick={() => {
                    setDashboardView('home');
                    setPostFeedView('mine');
                  }}
                  style={{
                    marginLeft: 18,
                    width: 'calc(100% - 18px)',
                    fontSize: 14,
                    backgroundColor: dashboardView === 'home' && postFeedView === 'mine' ? '#4b6cb7' : undefined,
                    color: dashboardView === 'home' && postFeedView === 'mine' ? '#fff' : undefined,
                  }}
                >
                  My Post
                </button>
                <button
                  type="button"
                  className="sidebar-btn"
                  onClick={() => setDashboardView('overview')}
                  style={{
                    marginLeft: 18,
                    width: 'calc(100% - 18px)',
                    fontSize: 14,
                    backgroundColor: dashboardView === 'overview' ? '#4b6cb7' : undefined,
                    color: dashboardView === 'overview' ? '#fff' : undefined,
                  }}
                >
                  Overview
                </button>
              </div>
            ) : null}
        
            <Link className="sidebar-btn" to="/employees"> <FaChalkboardTeacher /> Employees</Link>
            <Link className="sidebar-btn" to="/employees/attendance"> <FaCalendarAlt /> Attendance</Link>
            <Link className="sidebar-btn" to="/register"> <FaClipboardList /> Registration</Link>
            <button className="logout-btn" onClick={() => { localStorage.removeItem('admin'); window.location.href = '/login' }}>Logout</button>
          </div>
        </aside>

        <main className="google-main" style={{ flex: '1.08 1 0', minWidth: 0, maxWidth: 'none', margin: '0', boxSizing: 'border-box', alignSelf: 'flex-start', height: 'calc(100vh - 24px)', overflowY: 'auto', position: 'sticky', top: 24, padding: '0 2px' }}>
          <div style={{ width: '100%', maxWidth: dashboardView === 'home' ? 780 : 1100, margin: '0 auto 14px', background: 'linear-gradient(180deg, var(--surface-panel, #fff) 0%, var(--surface-muted, #f8faff) 100%)', border: '1px solid var(--border-soft, #dbe2f2)', borderRadius: 14, padding: '12px 14px', boxShadow: '0 8px 20px rgba(20,35,78,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary, #111827)' }}>Dashboard Workspace</div>
                <div style={{ marginTop: 3, fontSize: 13, color: 'var(--text-secondary, #6b7280)' }}>Switch between feed updates and professional analytics overview.</div>
              </div>
            </div>
          </div>

          {dashboardView === 'home' ? (
            <>
              

                <div className="post-box" style={{ ...FEED_SECTION_STYLE, ...shellCardStyle, margin: '0 auto 14px', borderRadius: 12, overflow: 'hidden', padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--surface-panel, #fff)', border: 'none', boxShadow: 'none', padding: 0 }}>
                  <img
                    src={admin.profileImage || '/default-profile.png'}
                    alt="me"
                    style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-soft, #dbe2f2)', flexShrink: 0 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePostModal(true)}
                    style={{ flex: 1, height: 42, border: '1px solid var(--border-soft, #dbe2f2)', background: 'var(--surface-muted, #f8faff)', borderRadius: 999, padding: '0 16px', fontSize: 14, textAlign: 'left', color: 'var(--text-muted, #6b7280)', cursor: 'pointer' }}
                  >
                    What's on your mind?
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreatePostModal(true)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, border: 'none', borderRadius: 8, background: 'transparent', color: 'var(--danger, #dc2626)', fontSize: 18, cursor: 'pointer', flexShrink: 0 }}
                    title="Live video"
                  >
                    <AiFillVideoCamera />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreatePostModal(true)}
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
                  visiblePosts.map((post) => (
                    <div key={post.postId} className="post-card facebook-post-card" style={{ ...shellCardStyle, borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: '12px 16px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0, flex: 1 }}>
                          <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                            <img src={post.adminProfile || '/default-profile.png'} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <h4 style={{ margin: 0, fontSize: 15, color: 'var(--text-primary, #111827)', fontWeight: 700, lineHeight: 1.2 }}>{post.adminName || 'HR Office'}</h4>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2, fontSize: 13, color: 'var(--text-muted, #6b7280)', fontWeight: 500 }}>
                              <span>{post.time ? new Date(post.time).toLocaleString() : 'Just now'}</span>
                              <span>·</span>
                              <span>{post.targetRole && post.targetRole !== 'all' ? `Visible to ${post.targetRole}` : 'Visible to everyone'}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!isPostOwnedByCurrentUser(post)) return;
                            if (window.confirm('Delete this post?')) {
                              handleDeletePost(post.postId);
                            }
                          }}
                          style={{ width: 36, height: 36, border: 'none', borderRadius: '50%', background: 'transparent', color: 'var(--text-muted, #6b7280)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                          aria-label={isPostOwnedByCurrentUser(post) ? 'Delete post' : 'Post options'}
                          title={isPostOwnedByCurrentUser(post) ? 'Delete post' : 'Post options'}
                        >
                          <FaEllipsisH style={{ width: 14, height: 14 }} />
                        </button>
                      </div>

                      {post.message ? (() => {
                        const canExpandPost = shouldShowPostSeeMore(post.message);
                        const isPostExpanded = !!expandedPostDescriptions[post.postId];

                        return (
                          <div style={{ padding: '0 16px 12px', color: 'var(--text-primary, #111827)', fontSize: 15, lineHeight: 1.3333, wordBreak: 'break-word' }}>
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
                                style={{ border: 'none', background: 'transparent', padding: 0, marginTop: 4, color: 'var(--text-muted, #6b7280)', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
                              >
                                {isPostExpanded ? 'See less' : 'See more'}
                              </button>
                            ) : null}
                          </div>
                        );
                      })() : null}

                      {post.postUrl ? (
                        <div style={{ background: '#000', borderTop: '1px solid var(--border-soft, #dbe2f2)', borderBottom: '1px solid var(--border-soft, #dbe2f2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src={post.postUrl} alt="post media" style={{ width: '100%', height: 'auto', maxHeight: 'min(78vh, 720px)', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                        </div>
                      ) : null}

                      <div style={{ padding: '10px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 13, color: 'var(--text-muted, #6b7280)' }}>
                        <button
                          type="button"
                          onClick={() => handleLikePost(post.postId)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: post.likes && post.likes[currentLikeActorId] ? 'var(--accent-strong, #1d4ed8)' : 'var(--text-muted, #6b7280)', fontSize: 13, fontWeight: 600 }}
                        >
                          <span style={{ width: 20, height: 20, borderRadius: '50%', background: post.likes && post.likes[currentLikeActorId] ? 'var(--accent-strong, #1d4ed8)' : 'var(--surface-strong, #e8ecf8)', color: post.likes && post.likes[currentLikeActorId] ? '#fff' : 'var(--text-muted, #6b7280)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <FaThumbsUp style={{ width: 10, height: 10 }} />
                          </span>
                          <span style={{ whiteSpace: 'nowrap' }}>{post.likeCount || 0} like{(post.likeCount || 0) === 1 ? '' : 's'}</span>
                        </button>
                        <div style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                          {post.targetRole && post.targetRole !== 'all' ? `Visible to ${post.targetRole}` : 'Visible to everyone'}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div style={{ width: '100%', maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <StatCard title="Total Employees" value={count} icon={<FaUsers />} color="#4b6cb7" />
                <StatCard title="Active" value={activeEmployeesCount} icon={<FaChartLine />} color="#059669" />
                <StatCard title="On Leave" value={onLeaveEmployeesCount} icon={<FaClock />} color="#f59e0b" />
                <StatCard title="Terminated" value={terminatedEmployeesCount} icon={<FaArrowDown />} color="#dc2626" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                <KPI title="Attendance Rate" value={attendanceRate} delta="Compared to last week" sparkData={lineData} positive />
                <KPI title="Avg Tenure" value={avgTenureFormatted} delta="Stable workforce" sparkData={lineData.map((value, index) => value - (index % 2 ? 1 : 0))} positive />
                <KPI title="Turnover" value={turnoverRate} delta="Monitor exits this quarter" sparkData={lineData.map((value, index) => Math.max(1, value - (index * 2)))} positive={false} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12 }}>
                <div style={overviewCardStyle}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Employee Growth Trend</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>Headcount movement over recent months</div>
                  <LineChart data={lineData} width={700} height={160} color="#4b6cb7" />
                </div>
                <div style={overviewCardStyle}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Gender Distribution</div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
                    <DonutChart values={genderValues} colors={['#4b6cb7', '#ec4899', '#f59e0b']} size={130} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 12, color: '#374151', fontWeight: 700 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FaMale color="#4b6cb7" /> Male: {maleCount}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FaFemale color="#ec4899" /> Female: {femaleCount}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FaUsers color="#f59e0b" /> Other: {otherCount}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <GenderBar male={maleCount} female={femaleCount} other={otherCount} width={250} height={86} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={overviewCardStyle}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Top Positions</div>
                  <PositionChart employees={normalizedEmployees.map((employee) => ({ position: employee._position, role: employee._position }))} maxBars={7} />
                </div>

                <div style={overviewCardStyle}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Department Breakdown</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {topDepartments.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#6b7280' }}>No department data available.</div>
                    ) : (
                      topDepartments.map(([departmentName, departmentCount], index) => {
                        const pct = Math.round((departmentCount / Math.max(1, count)) * 100);
                        return (
                          <div key={`${departmentName}-${index}`}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#334155', fontWeight: 700 }}>
                              <span>{departmentName}</span>
                              <span>{departmentCount} ({pct}%)</span>
                            </div>
                            <div style={{ width: '100%', height: 8, borderRadius: 999, background: '#e7edff', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #4b6cb7, #7c9ef0)' }} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={overviewCardStyle}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Upcoming Birthdays</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {upcomingBirthdays.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#6b7280' }}>No upcoming birthdays in the next 30 days.</div>
                    ) : (
                      upcomingBirthdays.map((employee, index) => (
                        <div key={`overview-birthday-${index}`} style={{ border: '1px solid #fbcfe8', background: '#fdf2f8', borderRadius: 10, padding: '8px 10px', fontSize: 12, color: '#374151' }}>
                          🎂 <strong>{employee.name || employee.fullName || 'Employee'}</strong>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div style={overviewCardStyle}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Upcoming Contract Expirations</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {upcomingContracts.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#6b7280' }}>No contract expirations in the next 90 days.</div>
                    ) : (
                      upcomingContracts.map((employee, index) => (
                        <div key={`overview-contract-${index}`} style={{ border: '1px solid #bae6fd', background: '#ecfeff', borderRadius: 10, padding: '8px 10px', fontSize: 12, color: '#374151' }}>
                          📄 <strong>{employee.name || employee.fullName || 'Employee'}</strong>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {dashboardView === 'home' ? (
        <div className="dashboard-widgets" style={{ width: 'clamp(300px, 21vw, 360px)', minWidth: 300, maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12, alignSelf: 'flex-start', height: 'calc(100vh - 48px)', overflowY: 'auto', position: 'sticky', top: 24, paddingRight: 2, paddingBottom: 12, marginLeft: 'auto', marginRight: 0, opacity: 0.98 }}>
          <div style={widgetCardStyle}>
            <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: 'var(--text-primary, #111827)' }}>Quick Statistics</h4>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <div style={smallStatStyle}>
                <div style={{ fontSize: 10, color: 'var(--text-muted, #6b7280)', fontWeight: 600 }}>Employees</div>
                <div style={{ marginTop: 3, fontSize: 13, fontWeight: 800, color: 'var(--text-primary, #111827)' }}>{count}</div>
              </div>
              <div style={smallStatStyle}>
                <div style={{ fontSize: 10, color: 'var(--text-muted, #6b7280)', fontWeight: 600 }}>Unread</div>
                <div style={{ marginTop: 3, fontSize: 13, fontWeight: 800, color: 'var(--text-primary, #111827)' }}>{messageCount}</div>
              </div>
              <div style={smallStatStyle}>
                <div style={{ fontSize: 10, color: 'var(--text-muted, #6b7280)', fontWeight: 600 }}>Notifications</div>
                <div style={{ marginTop: 3, fontSize: 13, fontWeight: 800, color: 'var(--text-primary, #111827)' }}>{notificationCount}</div>
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
                        onClick={() => navigate('/all-chat')}
                        style={{ ...softPanelStyle, display: 'flex', alignItems: 'center', gap: 7, width: '100%', textAlign: 'left', padding: '6px 7px', cursor: 'pointer' }}
                      >
                        <img src={contact.avatar || '/default-profile.png'} alt={contact.name} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary, #111827)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contact.name}</div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted, #6b7280)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contact.role}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: 'linear-gradient(180deg, var(--surface-panel, #fff) 0%, var(--surface-muted, #f6f8fc) 100%)', borderRadius: 20, boxShadow: 'var(--shadow-panel, 0 10px 28px rgba(17,24,39,0.1))', padding: '10px', minHeight: 760, border: '1px solid var(--border-soft, #dbe2f2)', overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', top: -40, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, color-mix(in srgb, var(--accent, #4b6cb7) 16%, transparent) 0%, transparent 72%)', pointerEvents: 'none' }} />
            <div style={{ margin: '-10px -10px 10px', padding: '12px 10px 10px', background: 'linear-gradient(135deg, var(--accent-soft, #eef2ff) 0%, var(--surface-muted, #f6f8fc) 55%, var(--surface-panel, #fff) 100%)', borderBottom: '1px solid var(--border-soft, #dbe2f2)', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 12, background: 'linear-gradient(135deg, var(--accent-soft, #eef2ff) 0%, color-mix(in srgb, var(--accent, #4b6cb7) 20%, transparent) 100%)', color: 'var(--accent-strong, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 1px 0 color-mix(in srgb, white 30%, transparent), var(--shadow-glow, 0 8px 20px rgba(29,78,216,0.18))' }}>
                    <FaCalendarAlt style={{ width: 14, height: 14 }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: 14, fontWeight: 900, margin: 0, color: 'var(--text-primary, #111827)', letterSpacing: '-0.02em' }}>School Calendar</h4>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary, #6b7280)', marginTop: 3, fontWeight: 800 }}>{currentMonthLabel}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted, #6b7280)', marginTop: 2, fontWeight: 500 }}>
                      {`${calendarMonthStartGregorian.day}/${calendarMonthStartGregorian.month}/${calendarMonthStartGregorian.year} - ${calendarMonthEndGregorian.day}/${calendarMonthEndGregorian.month}/${calendarMonthEndGregorian.year}`}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => handleCalendarMonthChange(-1)} style={{ width: 28, height: 28, borderRadius: 9, border: '1px solid var(--border-soft, #dbe2f2)', background: 'var(--surface-panel, #fff)', color: 'var(--text-secondary, #6b7280)', cursor: 'pointer', fontSize: 17, lineHeight: 1, boxShadow: 'var(--shadow-soft, 0 8px 22px rgba(17,24,39,0.08))' }} aria-label="Previous month" title="Previous month">‹</button>
                  <button type="button" onClick={() => handleCalendarMonthChange(1)} style={{ width: 28, height: 28, borderRadius: 9, border: '1px solid var(--border-soft, #dbe2f2)', background: 'var(--surface-panel, #fff)', color: 'var(--text-secondary, #6b7280)', cursor: 'pointer', fontSize: 17, lineHeight: 1, boxShadow: 'var(--shadow-soft, 0 8px 22px rgba(17,24,39,0.08))' }} aria-label="Next month" title="Next month">›</button>
                </div>
              </div>

              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <div style={{ padding: '4px 8px', borderRadius: 999, background: 'var(--surface-panel, #fff)', border: '1px solid var(--border-soft, #dbe2f2)', fontSize: 9, color: 'var(--accent-strong, #1d4ed8)', fontWeight: 800 }}>
                    {monthEventCount} event{monthEventCount === 1 ? '' : 's'}
                  </div>
                  <div style={{ padding: '4px 8px', borderRadius: 999, background: 'var(--warning-soft, #fff7ed)', border: '1px solid var(--warning-border, #fdba74)', fontSize: 9, color: 'var(--warning, #d97706)', fontWeight: 800 }}>
                    View only
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: 'linear-gradient(180deg, var(--surface-muted, #f8faff) 0%, color-mix(in srgb, var(--surface-muted, #f8faff) 92%, var(--page-bg, #f4f6fb) 8%) 100%)', border: '1px solid var(--border-soft, #dbe2f2)', borderRadius: 16, padding: '10px', boxShadow: 'inset 0 1px 0 color-mix(in srgb, white 22%, transparent)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, marginBottom: 6 }}>
                {CALENDAR_WEEK_DAYS.map((day) => (
                  <div key={day} style={{ textAlign: 'center', fontSize: 9, fontWeight: 800, color: 'var(--text-muted, #6b7280)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                    {day}
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
                {calendarDays.map((dayItem, index) => {
                  if (!dayItem) {
                    return <button type="button" key={`empty-${index}`} style={{ minHeight: 0, aspectRatio: '1 / 1', border: 'none', background: 'transparent', padding: 0 }} disabled />;
                  }
                  const dayOfWeek = index % 7;
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const isSelected = dayItem.isoDate === selectedCalendarIsoDate;
                  const isToday = dayItem.isoDate === todayIsoDate;
                  const isHovered = dayItem.isoDate === hoveredCalendarIsoDate;
                  const hasBirthday = dayItem.birthdays.length > 0;
                  const hasContract = dayItem.contracts.length > 0;
                  const dayBackground = isToday
                    ? 'linear-gradient(145deg, var(--accent-soft, #eef2ff) 0%, color-mix(in srgb, var(--accent, #4b6cb7) 26%, transparent) 100%)'
                    : isSelected
                      ? 'linear-gradient(145deg, var(--surface-accent, #eef2ff) 0%, var(--accent-soft, #eef2ff) 55%, color-mix(in srgb, var(--accent, #4b6cb7) 26%, transparent) 100%)'
                      : hasBirthday
                        ? 'linear-gradient(145deg, color-mix(in srgb, var(--warning-soft, #fff7ed) 78%, var(--surface-panel, #fff) 22%) 0%, var(--warning-soft, #fff7ed) 100%)'
                        : hasContract
                          ? 'linear-gradient(145deg, color-mix(in srgb, var(--success-soft, #ecfeff) 78%, var(--surface-panel, #fff) 22%) 0%, var(--success-soft, #ecfeff) 100%)'
                          : isWeekend
                            ? 'linear-gradient(145deg, var(--surface-muted, #f8faff) 0%, color-mix(in srgb, var(--surface-muted, #f8faff) 84%, var(--page-bg, #f4f6fb) 16%) 100%)'
                            : 'linear-gradient(145deg, var(--surface-panel, #fff) 0%, var(--surface-muted, #f8faff) 100%)';
                  return (
                    <button
                      type="button"
                      key={dayItem.isoDate}
                      onClick={() => setSelectedCalendarIsoDate(dayItem.isoDate)}
                      onMouseEnter={() => setHoveredCalendarIsoDate(dayItem.isoDate)}
                      onMouseLeave={() => setHoveredCalendarIsoDate('')}
                      onFocus={() => setHoveredCalendarIsoDate(dayItem.isoDate)}
                      onBlur={() => setHoveredCalendarIsoDate('')}
                      style={{
                        minHeight: 0,
                        aspectRatio: '1 / 1',
                        borderRadius: 10,
                        border: isToday
                          ? '1px solid var(--accent, #4b6cb7)'
                          : isSelected
                            ? '1px solid var(--accent-strong, #1d4ed8)'
                            : isHovered
                              ? '1px solid var(--border-strong, #c7d2fe)'
                              : hasBirthday
                                ? '1px solid var(--warning-border, #fdba74)'
                                : hasContract
                                    ? '1px solid var(--success-border, #a5f3fc)'
                                  : '1px solid transparent',
                        background: dayBackground,
                        color: isToday ? 'var(--accent-strong, #1d4ed8)' : 'var(--text-secondary, #475569)',
                        fontSize: 10,
                        fontWeight: isToday ? 800 : 700,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                        padding: '5px 2px',
                        boxShadow: isSelected
                          ? 'var(--shadow-glow, 0 8px 20px rgba(29,78,216,0.18))'
                          : isHovered
                            ? 'var(--shadow-soft, 0 8px 22px rgba(17,24,39,0.08))'
                            : 'var(--shadow-soft, 0 8px 22px rgba(17,24,39,0.08))',
                        cursor: 'pointer',
                        outline: 'none',
                        transform: isSelected ? 'translateY(-2px) scale(1.03)' : isHovered ? 'translateY(-1px) scale(1.015)' : 'translateY(0) scale(1)',
                        transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease, color 160ms ease',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 800, color: isToday || isSelected ? 'var(--accent-strong, #1d4ed8)' : 'var(--text-primary, #111827)', lineHeight: 1 }}>
                        {ethiopicDayFormatter.format(new Date(dayItem.isoDate))}
                      </div>
                      <div style={{ fontSize: 8, color: isSelected ? 'var(--accent, #4b6cb7)' : 'var(--text-muted, #6b7280)', lineHeight: 1 }}>
                        {ethiopicDayMonthFormatter.format(new Date(dayItem.isoDate))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, minHeight: 6 }}>
                        {dayItem.birthdays.length > 0 ? <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--warning, #d97706)', boxShadow: '0 0 0 2px color-mix(in srgb, var(--surface-panel, #fff) 84%, transparent)' }} /> : null}
                        {dayItem.contracts.length > 0 ? <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success, #0f766e)', boxShadow: '0 0 0 2px color-mix(in srgb, var(--surface-panel, #fff) 84%, transparent)' }} /> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--text-secondary, #475569)', fontWeight: 800, background: 'var(--warning-soft, #fff7ed)', border: '1px solid var(--warning-border, #fdba74)', borderRadius: 999, padding: '5px 8px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning, #d97706)' }} /> No Class
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--text-secondary, #475569)', fontWeight: 800, background: 'var(--success-soft, #ecfeff)', border: '1px solid var(--success-border, #a5f3fc)', borderRadius: 999, padding: '5px 8px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success, #0f766e)' }} /> Academic
              </div>
            </div>

            <div style={{ marginTop: 12, background: 'linear-gradient(180deg, var(--surface-panel, #fff) 0%, var(--surface-muted, #f6f8fc) 100%)', border: '1px solid var(--border-soft, #dbe2f2)', borderRadius: 14, padding: '10px', boxShadow: 'var(--shadow-soft, 0 8px 22px rgba(17,24,39,0.08))' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-primary, #111827)' }}>
                    {selectedCalendarDay ? ethiopicLongFormatter.format(new Date(selectedCalendarDay.isoDate)) : 'Select a date'}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted, #6b7280)', marginTop: 2 }}>
                    {selectedCalendarDay ? `Gregorian ${new Date(selectedCalendarDay.isoDate).toLocaleDateString()}` : 'Choose a day to view or add calendar events.'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {!selectedCalendarDay ? (
                  <div style={{ fontSize: 9, color: 'var(--text-muted, #6b7280)', background: 'var(--surface-muted, #f8faff)', borderRadius: 10, border: '1px solid var(--border-soft, #dbe2f2)', padding: '7px 9px' }}>
                    No school events on this day.
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 9, color: 'var(--text-secondary, #475569)', background: 'var(--warning-soft, #fff7ed)', border: '1px solid var(--warning-border, #fdba74)', borderRadius: 10, padding: '7px 9px' }}>
                      No Class: {selectedCalendarDay.birthdays.length}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-secondary, #475569)', background: 'var(--success-soft, #ecfeff)', border: '1px solid var(--success-border, #a5f3fc)', borderRadius: 10, padding: '7px 9px' }}>
                      Academic: {selectedCalendarDay.contracts.length}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={widgetCardStyle}>
            <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: 'var(--text-primary, #111827)' }}>Upcoming Deadlines</h4>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upcomingCalendarEvents.length === 0 ? (
                <div style={{ ...softPanelStyle, padding: '8px 9px', fontSize: 10, color: 'var(--text-muted, #6b7280)' }}>
                  No upcoming calendar deadlines.
                </div>
              ) : (
                upcomingCalendarEvents.slice(0, 5).map((eventItem, index) => (
                  <div key={`deadline-${index}`} style={{ padding: '8px 9px', borderRadius: 10, border: '1px solid #bae6fd', background: '#ecfeff', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-primary, #111827)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#06b6d4', flexShrink: 0 }} />
                        <span>{eventItem.title || 'Calendar event'}</span>
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted, #6b7280)', marginTop: 3 }}>
                        {eventItem.notes || eventItem.category || 'Event'}
                      </div>
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-secondary, #475569)', whiteSpace: 'nowrap' }}>
                      {eventItem.gregorianDate
                        ? (
                          <>
                            <div>{new Date(`${eventItem.gregorianDate}T00:00:00`).toLocaleDateString()}</div>
                            <div style={{ marginTop: 2, fontSize: 8, fontWeight: 700, color: 'var(--text-muted, #6b7280)' }}>
                              {ethiopicDayMonthFormatter.format(new Date(`${eventItem.gregorianDate}T00:00:00`))}
                            </div>
                          </>
                        )
                        : '—'}
                    </div>
                  </div>
                ))
              )}
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
        ) : null}
      </div>

      {showCreatePostModal ? (
        <>
          <div
            onClick={() => setShowCreatePostModal(false)}
            style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, var(--surface-overlay, #ffffff) 84%, transparent)', backdropFilter: 'blur(6px)', zIndex: 1200 }}
          />
          <div style={{ position: 'fixed', inset: 0, zIndex: 1201, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, pointerEvents: 'none' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(500px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface-panel, #fff)', borderRadius: 18, border: '1px solid var(--border-soft, #dbe2f2)', boxShadow: '0 24px 52px rgba(20,35,78,0.26)', pointerEvents: 'auto' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 20px 13px', borderBottom: '1px solid var(--border-soft, #dbe2f2)' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary, #111827)', lineHeight: 1.2, letterSpacing: '-0.01em' }}>Create post</div>
                <button
                  type="button"
                  onClick={() => setShowCreatePostModal(false)}
                  style={{ position: 'absolute', right: 16, top: 10, border: '1px solid var(--border-soft, #dbe2f2)', background: 'var(--surface-muted, #f8faff)', width: 40, height: 40, borderRadius: '50%', fontSize: 22, color: 'var(--text-secondary, #6b7280)', cursor: 'pointer', lineHeight: 1 }}
                  aria-label="Close create post modal"
                  title="Close"
                >
                  ×
                </button>
              </div>

              <div style={{ padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img src={admin.profileImage || '/default-profile.png'} alt="me" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #111827)', lineHeight: 1.2 }}>{admin.name || 'HR Office'}</div>
                    <select
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      style={{ height: 28, borderRadius: 6, border: '1px solid var(--border-soft, #dbe2f2)', background: 'var(--surface-muted, #f8faff)', fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #111827)', padding: '0 28px 0 10px', width: 'fit-content', minWidth: 118 }}
                      title="Post target role"
                    >
                      {targetOptions.map((role) => {
                        const label = role === 'all' ? 'All Users' : `${role.charAt(0).toUpperCase()}${role.slice(1)}s`;
                        return <option key={role} value={role}>{label}</option>;
                      })}
                    </select>
                  </div>
                </div>

                <textarea
                  placeholder="What's on your mind?"
                  value={postText}
                  onChange={(event) => setPostText(event.target.value)}
                  style={{ minHeight: 210, resize: 'vertical', border: 'none', background: 'transparent', borderRadius: 0, padding: 0, fontSize: 28, lineHeight: 1.3333, outline: 'none', color: 'var(--text-primary, #111827)' }}
                />

                <div style={{ border: '1px solid var(--border-soft, #dbe2f2)', borderRadius: 12, padding: '8px 12px', boxShadow: 'var(--shadow-soft, 0 8px 22px rgba(17,24,39,0.08))', background: 'var(--surface-overlay, #fcfdff)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ marginRight: 'auto', fontSize: 15, fontWeight: 600, color: 'var(--text-primary, #111827)' }}>Add media</div>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'transparent', cursor: 'pointer', color: 'var(--success, #16a34a)', fontSize: 24 }} title="Upload media">
                      <AiFillPicture />
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={(event) => {
                          const file = event.target.files && event.target.files[0];
                          setPostMedia(file || null);
                        }}
                        accept="image/*,video/*"
                        style={{ display: 'none' }}
                      />
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', color: 'var(--danger, #dc2626)', fontSize: 22, background: 'transparent', opacity: 0.9 }}>
                      <AiFillVideoCamera />
                    </div>

                    {postMedia ? (
                      <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface-muted, #f8faff)', borderRadius: 10, boxSizing: 'border-box' }}>
                        <AiFillPicture style={{ color: 'var(--success, #16a34a)', fontSize: 18, flexShrink: 0 }} />
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text-primary, #111827)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{postMedia.name}</span>
                        <button
                          onClick={() => {
                            setPostMedia(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          style={{ background: 'var(--surface-strong, #e8ecf8)', border: '1px solid var(--border-soft, #dbe2f2)', color: 'var(--text-secondary, #6b7280)', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
                          aria-label="Remove selected media"
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <button
                  onClick={handleSubmitCreatePost}
                  disabled={!canSubmitPost}
                  style={{ width: '100%', border: 'none', background: canSubmitPost ? 'linear-gradient(135deg, #4b6cb7 0%, #182848 100%)' : 'var(--surface-strong, #e8ecf8)', borderRadius: 6, height: 36, color: canSubmitPost ? '#fff' : 'var(--text-muted, #6b7280)', fontSize: 15, fontWeight: 700, cursor: canSubmitPost ? 'pointer' : 'not-allowed' }}
                >
                  Post
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
