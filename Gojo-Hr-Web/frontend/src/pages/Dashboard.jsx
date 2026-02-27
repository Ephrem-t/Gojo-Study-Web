import React, { useEffect, useState } from 'react';
import api from '../api';
import { Link, useNavigate } from "react-router-dom";
import { FaBell, FaFacebookMessenger, FaCog, FaUsers, FaBuilding, FaClipboardList, FaChartLine, FaChartPie, FaBirthdayCake, FaCalendarAlt, FaClock, FaArrowUp, FaArrowDown, FaMale, FaFemale } from "react-icons/fa";
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
  const [admin, setAdmin] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("admin")) || {};
    } catch (e) {
      return {};
    }
  });
  const navigate = useNavigate();

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

  const recentHires = employees
    .slice()
    .sort((a, b) => new Date(b.hireDate || 0) - new Date(a.hireDate || 0))
    .slice(0, 5)
    .map(e => ({ name: e.name || e.fullName || 'Unnamed', role: e.role || e.position || 'Staff', date: e.hireDate ? new Date(e.hireDate).toLocaleDateString() : '—', avatar: e.profileImage || '/default-profile.png' }));

  // generate simple growth data for last 6 months (simulated from current count)
  const months = 6;
  const lineData = Array.from({ length: months }).map((_, i) => Math.max(2, Math.round(count - (months - 1 - i) * (count / (months + 2)) + (i * 1.5))));

  // gender distribution for donut / cards
  function extractGender(e) {
    const raw = e || {};
    const g = (raw.gender || (raw.personal && raw.personal.gender) || (raw.profileData && raw.profileData.personal && raw.profileData.personal.gender) || '').toString().toLowerCase();
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

  return (
    <div className="dashboard-page" style={{ minHeight: '100vh' }}>
      <nav className="top-navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <h2>Gojo HR</h2>
          <span className="muted">— Admin Dashboard</span>
        </div>

        <div className="nav-right">
          <div className="icon-circle" title="Notifications"><FaBell /></div>
          <div className="icon-circle" title="Messages" onClick={() => navigate('/all-chat')}><FaFacebookMessenger /></div>
          <Link to="/settings" className="icon-circle" aria-label="Settings"><FaCog /></Link>
          <img src={admin.profileImage || '/default-profile.png'} alt="admin" className="profile-img" />
        </div>
      </nav>

      <div className="google-dashboard">
        <aside className="google-sidebar">
          <div className="sidebar-profile">
            <div className="sidebar-img-circle">
              <img src={admin?.profileImage || '/default-profile.png'} alt="profile" />
            </div>
            <h3>{admin?.name || 'Admin Name'}</h3>
            <p>{admin?.adminId || 'username'}</p>
          </div>

          <div className="sidebar-menu">
            <Link className="sidebar-btn" to="/" style={{backgroundColor: "#4b6cb7", color: "white"}}> <FaUsers /> Dashboard</Link>
            <Link className="sidebar-btn" to="/employees"> <FaBuilding /> Employees</Link>
            <Link className="sidebar-btn" to="/register"> <FaClipboardList /> Registration</Link>
            <button className="logout-btn" onClick={() => { localStorage.removeItem('admin'); window.location.href = '/login' }}>Logout</button>
          </div>
        </aside>

        <main className="google-main">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: -22, marginBottom: 18 }}>
            <h1 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>HR Dashboard</h1>
            <div style={{ color: '#6b7280' }}>Welcome back, <strong style={{ color: '#111827' }}>{admin?.name?.split(' ')[0] || 'Admin'}</strong></div>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
            <div className="stat-card" style={{ background: '#fff', borderRadius: 12, padding: 18, minWidth: 180, flex: 1, boxShadow: '0 6px 20px rgba(50,60,90,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="stat-icon" style={{ background: '#4b6cb7' }}><FaUsers /></div>
              <div>
                <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>Employees</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>{count || '—'}</div>
              </div>
            </div>

            <div className="stat-card" style={{ background: '#fff', borderRadius: 12, padding: 18, minWidth: 180, flex: 1, boxShadow: '0 6px 20px rgba(50,60,90,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="stat-icon" style={{ background: '#06b6d4' }}><FaBuilding /></div>
              <div>
                <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>Departments</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>{departments}</div>
              </div>
            </div>

            <div className="stat-card" style={{ background: '#fff', borderRadius: 12, padding: 18, minWidth: 180, flex: 1, boxShadow: '0 6px 20px rgba(50,60,90,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="stat-icon" style={{ background: '#f97316' }}><FaClipboardList /></div>
              <div>
                <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>Open Positions</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>{openPositions}</div>
              </div>
            </div>

            <div className="stat-card" style={{ background: '#fff', borderRadius: 12, padding: 18, minWidth: 180, flex: 1, boxShadow: '0 6px 20px rgba(50,60,90,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="stat-icon" style={{ background: '#10b981' }}><FaChartLine /></div>
              <div>
                <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>Attendance</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>{attendanceRate}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <div style={{ flex: 1 }}>
              <StatCard title="Male" value={maleCount} icon={<FaMale />} color="#4b6cb7" />
            </div>
            <div style={{ flex: 1 }}>
              <StatCard title="Female" value={femaleCount} icon={<FaFemale />} color="#e0245e" />
            </div>
            <div style={{ width: 300, background: '#fff', padding: 12, borderRadius: 12, boxShadow: '0 6px 20px rgba(50,60,90,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GenderBar male={maleCount} female={femaleCount} other={otherCount} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
            <div style={{ flex: 2, background: '#fff', padding: 18, borderRadius: 12, boxShadow: '0 6px 20px rgba(50,60,90,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 800, color: '#0f172a' }}>Employee Growth</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Last {lineData.length} months</div>
              </div>
              <div style={{ marginTop: 6 }}>
                <LineChart data={lineData} color="#4b6cb7" />
              </div>
            </div>

            <div style={{ flex: 1, background: '#fff', padding: 18, borderRadius: 12, boxShadow: '0 6px 20px rgba(50,60,90,0.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Gender Distribution</div>
              <DonutChart values={genderValues} colors={["#4b6cb7", "#e0245e", "#f59e0b"]} />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ width: 10, height: 10, background: '#4b6cb7', display: 'inline-block', borderRadius: 2 }}></span><span style={{ fontSize: 13, color: '#374151' }}>Male ({genderValues[0]})</span></div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ width: 10, height: 10, background: '#e0245e', display: 'inline-block', borderRadius: 2 }}></span><span style={{ fontSize: 13, color: '#374151' }}>Female ({genderValues[1]})</span></div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <KPI title="Leaves Today" value={leavesToday} delta="+2 vs yesterday" sparkData={[2,3,2,4,3,leavesToday]} positive={true} />
            <KPI title="Avg Tenure" value={avgTenureFormatted} delta="+0.1" sparkData={[avgTenure, avgTenure, avgTenure, avgTenure, avgTenure]} positive={true} />
            <KPI title="Turnover Rate" value={turnoverRate} delta="-0.2%" sparkData={[1,1,2,1,2,Math.max(1, parseInt(turnoverRate)||1)]} positive={turnoverRate === '—' ? true : (parseInt(turnoverRate) < 5)} />
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1, background: '#fff', padding: 18, borderRadius: 12, boxShadow: '0 6px 20px rgba(50,60,90,0.04)' }}>
              <div style={{ fontWeight: 800, marginBottom: 12 }}>Recent Hires</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {recentHires.length ? recentHires.map((h, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <img src={h.avatar} alt={h.name} style={{ width: 44, height: 44, borderRadius: 8 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{h.name}</div>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>{h.role}</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{h.date}</div>
                  </div>
                )) : <div style={{ color: '#9ca3af' }}>No recent hires</div>}
              </div>
            </div>

            <div style={{ width: 300, background: '#fff', padding: 18, borderRadius: 12, boxShadow: '0 6px 20px rgba(50,60,90,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 800 }}>Quick Actions</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Shortcuts</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button style={{ padding: 10, borderRadius: 8, border: '1px solid #e6eefc', background: '#fff', cursor: 'pointer' }}>New Employee</button>
                <button style={{ padding: 10, borderRadius: 8, border: '1px solid #e6eefc', background: '#fff', cursor: 'pointer' }}>Post Job</button>
                <button style={{ padding: 10, borderRadius: 8, border: '1px solid #e6eefc', background: '#fff', cursor: 'pointer' }}>Export</button>
                <button style={{ padding: 10, borderRadius: 8, border: '1px solid #e6eefc', background: '#fff', cursor: 'pointer' }}>Settings</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
