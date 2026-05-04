import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaBell, FaCalendarAlt, FaCheckCircle, FaClock, FaCog, FaFacebookMessenger, FaFilter, FaSearch, FaTimesCircle, FaUserCheck, FaUsers } from 'react-icons/fa';
import api from '../api';
import './Dashboard.css';
import '../styles/global.css';
import { getEmployeeJob, getEmployeeName, getEmployeeProfileImage, getEmployeesSnapshot } from '../hrData';

const ATTENDANCE_AUTOSAVE_STORAGE_KEY = 'gojo-hr-attendance-autosave-enabled';

function toIsoDate(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getInitials(name) {
  return (name || 'Employee')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'E';
}

function createAttendanceSignature(date, attendanceMap) {
  const entries = Object.entries(attendanceMap || {})
    .map(([employeeId, record]) => {
      const entry = record && typeof record === 'object' ? record : {};
      const rawStatus = (entry.status || '').toString().toLowerCase();
      const status = rawStatus === 'late' ? 'late' : rawStatus === 'present' ? 'present' : rawStatus === 'absent' ? 'absent' : '';
      const present = typeof entry.present === 'boolean' ? entry.present : status !== 'absent';

      return [String(employeeId), { status, present }];
    })
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId));

  return JSON.stringify({ date: String(date || ''), attendance: entries });
}

function AvatarBadge({ src, name, size = 48 }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 16,
          border: '1px solid #d7e7fb',
          background: 'linear-gradient(135deg, #eef6ff 0%, #dfeeff 100%)',
          color: '#1f4f96',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 15,
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        {getInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name || 'Employee'}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: 16, objectFit: 'cover', border: '1px solid #d7e7fb', flexShrink: 0 }}
    />
  );
}

function MetricCard({ icon: Icon, label, value, accent }) {
  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 18,
        border: '1px solid #e7ecf3',
        padding: 18,
        boxShadow: '0 18px 44px rgba(15, 23, 42, 0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
          <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800, color: '#0f172a' }}>{value}</div>
        </div>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 16,
            background: accent.background,
            border: `1px solid ${accent.border}`,
            color: accent.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
          }}
        >
          <Icon />
        </div>
      </div>
    </div>
  );
}

function StatusActionButton({ label, value, active, colors, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      style={{
        minHeight: 34,
        padding: '0 12px',
        borderRadius: 999,
        border: `1px solid ${active ? colors.border : '#dbe2f2'}`,
        background: active ? colors.background : '#ffffff',
        color: active ? colors.color : '#475569',
        fontSize: 12,
        fontWeight: 800,
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        boxShadow: active ? '0 8px 18px rgba(15, 23, 42, 0.06)' : 'none',
      }}
    >
      {label}
    </button>
  );
}

export default function EmployeesAttendance() {
  const navigate = useNavigate();
  const [admin] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('admin') || '{}');
    } catch {
      return {};
    }
  });

  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()));
  const [employees, setEmployees] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredEmployeeId, setHoveredEmployeeId] = useState(null);
  const [attendance, setAttendance] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem(ATTENDANCE_AUTOSAVE_STORAGE_KEY);
      return stored == null ? true : stored === 'true';
    } catch {
      return true;
    }
  });
  const [autoSaveState, setAutoSaveState] = useState('idle');

  const userEditedAttendanceRef = useRef(false);
  const lastSavedSignatureRef = useRef('');

  const markedBy = admin?.adminId || admin?.hrId || admin?.id || admin?.userId || '';
  const isBusy = isLoading || isSaving || isAutoSaving;

  const positions = useMemo(() => {
    const set = new Set();
    (employees || []).forEach((emp) => {
      const job = getEmployeeJob(emp);
      const pos = job.position || emp.position || emp.role || 'Staff';
      if (pos) set.add(pos);
    });
    return Array.from(set).sort();
  }, [employees]);

  const normalizedEmployees = useMemo(() => {
    const list = (employees || [])
      .filter((employee) => {
        // Exclude terminated employees from attendance marking
        const status = (employee.status || employee?.job?.status || employee?.profileData?.job?.status || '').toString().toLowerCase();
        const isActive = typeof employee.isActive === 'boolean' ? employee.isActive : true;
        return status !== 'terminated' && isActive !== false;
      })
      .map((employee) => {
        const job = getEmployeeJob(employee);
        const name = getEmployeeName(employee);
        const avatar = getEmployeeProfileImage(employee);
        return {
          ...employee,
          _name: name,
          _avatar: avatar,
          _initials: getInitials(name),
          _department: job.department || employee.department || 'Unassigned',
          _position: job.position || employee.position || employee.role || 'Staff',
        };
      });

    let filtered = selectedPosition ? list.filter((e) => e._position === selectedPosition) : list;
    if (searchTerm && searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      filtered = filtered.filter((e) => (e._name || '').toLowerCase().includes(q) || (e.id || '').toLowerCase().includes(q));
    }
    return filtered.sort((a, b) => a._name.localeCompare(b._name));
  }, [employees, selectedPosition, searchTerm]);

  useEffect(() => {
    async function loadEmployees() {
      try {
        const snapshot = await getEmployeesSnapshot();
        setEmployees(snapshot);
      } catch (e) {
        console.error(e);
        setEmployees([]);
      }
    }

    loadEmployees();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(ATTENDANCE_AUTOSAVE_STORAGE_KEY, autoSaveEnabled ? 'true' : 'false');
    } catch {
      // Ignore storage persistence errors and keep the in-memory toggle working.
    }

    if (!autoSaveEnabled) {
      setAutoSaveState('idle');
    }
  }, [autoSaveEnabled]);

  useEffect(() => {
    userEditedAttendanceRef.current = false;
    setAutoSaveState('idle');
  }, [selectedDate]);

  useEffect(() => {
    async function loadAttendance() {
      setIsLoading(true);
      setErrorMessage('');
      setSuccessMessage('');
      try {
        const res = await api.get('/api/employee_attendance', {
          params: { date: selectedDate },
        });
        const map = res.data?.attendance || {};
        const normalized = typeof map === 'object' && map ? map : {};
        // normalize legacy records to always include status
        const withStatus = Object.entries(normalized).reduce((acc, [employeeId, record]) => {
          const entry = record && typeof record === 'object' ? record : {};
          const rawStatus = (entry.status || '').toString().toLowerCase();
          const status = rawStatus === 'late' ? 'late' : rawStatus === 'present' ? 'present' : 'absent';
          const present = typeof entry.present === 'boolean' ? entry.present : status !== 'absent';
          acc[employeeId] = {
            ...entry,
            status,
            present,
          };
          return acc;
        }, {});
        setAttendance(withStatus);
        lastSavedSignatureRef.current = createAttendanceSignature(selectedDate, withStatus);
        userEditedAttendanceRef.current = false;
        setAutoSaveState('idle');
      } catch (e) {
        console.error(e);
        setAttendance({});
        lastSavedSignatureRef.current = createAttendanceSignature(selectedDate, {});
        userEditedAttendanceRef.current = false;
        setAutoSaveState('idle');
        setErrorMessage('Failed to load attendance for the selected date.');
      } finally {
        setIsLoading(false);
      }
    }

    if (selectedDate) loadAttendance();
  }, [selectedDate]);

  const handleSetStatus = (employeeId, status) => {
    const normalizedStatus = (status || '').toString().toLowerCase();
    const finalStatus = normalizedStatus === 'late' ? 'late' : normalizedStatus === 'present' ? 'present' : 'absent';
    const present = finalStatus !== 'absent';
    userEditedAttendanceRef.current = true;
    setErrorMessage('');
    setSuccessMessage('');
    if (autoSaveEnabled) {
      setAutoSaveState('pending');
    }
    setAttendance((prev) => {
      const next = { ...(prev || {}) };
      next[employeeId] = {
        ...(next[employeeId] || {}),
        present,
        status: finalStatus,
      };
      return next;
    });
  };

  const statusStyles = (status) => {
    if (!status) return { bg: '#ffffff', border: '#dbe2f2', text: '#64748b' };
    if (status === 'present') return { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' };
    if (status === 'late') return { bg: '#fffbeb', border: '#fde68a', text: '#92400e' };
    return { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' };
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const payload = {
        date: selectedDate,
        markedBy,
        attendance,
      };
      const res = await api.post('/api/employee_attendance', payload);
      const savedCount = res.data?.savedCount;
      lastSavedSignatureRef.current = nextSignature;
      userEditedAttendanceRef.current = false;
      setAutoSaveState('saved');

      if (!silent) {
        setSuccessMessage(typeof savedCount === 'number' ? `Saved ${savedCount} records.` : 'Saved attendance.');
      }
      return true;
    } catch (e) {
      console.error(e);
      setAutoSaveState('error');
      setErrorMessage(silent ? 'Auto-save failed. Use Save Attendance.' : 'Failed to save attendance.');
      return false;
    } finally {
      if (silent) {
        setIsAutoSaving(false);
      } else {
        setIsSaving(false);
      }
    }
  }, [attendance, markedBy, selectedDate];

  useEffect(() => {
    if (!autoSaveEnabled || !selectedDate || isLoading || isSaving || isAutoSaving) {
      return undefined;
    }

    if (!userEditedAttendanceRef.current) {
      return undefined;
    }

    const nextSignature = createAttendanceSignature(selectedDate, attendance);
    if (nextSignature === lastSavedSignatureRef.current) {
      userEditedAttendanceRef.current = false;
      setAutoSaveState('saved');
      return undefined;
    }

    setAutoSaveState('pending');
    const timeoutId = window.setTimeout(() => {
      handleSave({ silent: true }).catch(console.error);
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [attendance, autoSaveEnabled, handleSave, isAutoSaving, isLoading, isSaving, selectedDate]);

  const autoSaveLabel = autoSaveEnabled
    ? autoSaveState === 'saving'
      ? 'Auto-saving changes...'
      : autoSaveState === 'saved'
        ? 'Changes save automatically'
        : autoSaveState === 'error'
          ? 'Auto-save needs attention'
          : 'Changes will save automatically'
    : 'Manual save only';

  return (
    <div
      className="dashboard-page"
      style={{
        minHeight: '100vh',
        background: '#ffffff',
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
        '--danger': '#b91c1c',
        '--danger-soft': '#fff1f2',
        '--danger-border': '#fecaca',
        '--shadow-soft': '0 10px 24px rgba(0, 122, 251, 0.10)',
        '--shadow-panel': '0 14px 30px rgba(0, 122, 251, 0.14)',
        '--shadow-glow': '0 0 0 2px rgba(0, 122, 251, 0.18)',
        '--sidebar-width': 'clamp(230px, 16vw, 290px)',
        '--topbar-height': '64px',
      }}
    >
      <nav className="top-navbar" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 'var(--topbar-height)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '0 18px 0 20px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-panel)', zIndex: 60 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em' }}>Gojo HR</h2>
        </div>

        <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" title="Notifications" style={headerActionStyle}><FaBell /></button>
          <button type="button" title="Messages" onClick={() => navigate('/all-chat')} style={headerActionStyle}><FaFacebookMessenger /></button>
          <Link to="/settings" aria-label="Settings" style={headerActionStyle}><FaCog /></Link>
          <AvatarBadge src={admin.profileImage} name={admin.name || 'HR Office'} size={40} />
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: 'flex', gap: 14, padding: 'calc(var(--topbar-height) + 18px) 14px 18px', minHeight: '100vh', background: '#ffffff', width: '100%', boxSizing: 'border-box', alignItems: 'flex-start' }}>
        <div className="admin-sidebar-spacer" style={{ width: 'var(--sidebar-width)', minWidth: 'var(--sidebar-width)', flex: '0 0 var(--sidebar-width)', pointerEvents: 'none' }} />

        <main className="google-main" style={{ flex: '1 1 0', minWidth: 0, maxWidth: 'none', margin: 0, boxSizing: 'border-box', alignSelf: 'flex-start', minHeight: 'calc(100vh - 24px)', overflowY: 'visible', overflowX: 'hidden', position: 'relative', padding: '0 12px 0 2px', display: 'flex', justifyContent: 'center', width: '100%' }}>
          <div style={{ width: '100%', maxWidth: 1320 }}>
            <section
              style={{
                background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
                border: '1px solid #e7ecf3',
                borderRadius: 22,
                padding: '22px 24px',
                boxShadow: '0 20px 46px rgba(15, 23, 42, 0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', width: 'fit-content', height: 30, padding: '0 12px', borderRadius: 999, background: '#eef6ff', border: '1px solid #d8e8ff', color: '#0f4fa8', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Workforce Attendance
                  </div>
                  <h1 style={{ margin: '12px 0 0', fontSize: 28, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em' }}>Employees Attendance</h1>
                  <p style={{ margin: '8px 0 0', fontSize: 14, color: '#64748b', lineHeight: 1.6, maxWidth: 760 }}>
                    Review daily staff attendance from one premium workspace, filter quickly, and mark each employee with faster status actions.
                  </p>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 36, padding: '0 14px', borderRadius: 999, border: '1px solid #e7ecf3', background: '#fff', color: '#334155', fontSize: 12, fontWeight: 700 }}>
                  <FaCalendarAlt /> {selectedDate}
                </div>
              </div>
            </section>

            <section style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <MetricCard icon={FaUsers} label="Active Employees" value={attendanceStats.total} accent={{ background: '#f3f8ff', border: '#dbe8f7', color: '#2563eb' }} />
              <MetricCard icon={FaCheckCircle} label="Present" value={attendanceStats.present} accent={{ background: '#f5fbf7', border: '#d9efe1', color: '#059669' }} />
              <MetricCard icon={FaClock} label="Late" value={attendanceStats.late} accent={{ background: '#fffbeb', border: '#fde68a', color: '#d97706' }} />
              <MetricCard icon={FaTimesCircle} label="Absent / Unset" value={attendanceStats.absent + attendanceStats.unset} accent={{ background: '#fff7f7', border: '#fecaca', color: '#dc2626' }} />
            </section>

            <section style={{ marginTop: 16, background: '#ffffff', borderRadius: 22, border: '1px solid #e7ecf3', padding: 18, boxShadow: '0 20px 46px rgba(15, 23, 42, 0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: '1 1 720px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Date</label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      style={{ height: 42, borderRadius: 14, border: '1px solid #dbe4ef', padding: '0 14px', fontSize: 13, fontWeight: 700, color: '#0f172a', background: '#fbfdff' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Position</label>
                    <div style={{ position: 'relative' }}>
                      <FaFilter style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 13 }} />
                      <select
                        value={selectedPosition}
                        onChange={(e) => setSelectedPosition(e.target.value)}
                        style={{ width: '100%', height: 42, borderRadius: 14, border: '1px solid #dbe4ef', padding: '0 14px 0 40px', fontSize: 13, fontWeight: 700, color: '#0f172a', background: '#fbfdff', cursor: 'pointer' }}
                      >
                        <option value="">All positions</option>
                        {positions.length ? positions.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        )) : <option disabled>No positions</option>}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 280, flex: '1 1 280px' }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Search</label>
                    <div style={{ position: 'relative' }}>
                      <FaSearch style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 13 }} />
                      <input
                        placeholder="Search by name or employee ID"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: '100%', height: 42, borderRadius: 14, border: '1px solid #dbe4ef', padding: '0 14px 0 40px', fontSize: 13, fontWeight: 700, color: '#0f172a', background: '#fbfdff' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                    <button
                      type="button"
                      onClick={() => setAutoSaveEnabled((prev) => !prev)}
                      aria-pressed={autoSaveEnabled}
                      style={{
                        height: 40,
                        border: `1px solid ${autoSaveEnabled ? '#bfdbfe' : '#dbe4ef'}`,
                        borderRadius: 999,
                        padding: '0 14px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        background: autoSaveEnabled ? '#eff6ff' : '#fff',
                        color: autoSaveEnabled ? '#007afb' : '#334155',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          width: 34,
                          height: 20,
                          borderRadius: 999,
                          background: autoSaveEnabled ? '#007afb' : '#cbd5e1',
                          position: 'relative',
                          transition: 'background 0.18s ease',
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            top: 2,
                            left: autoSaveEnabled ? 16 : 2,
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            background: '#ffffff',
                            boxShadow: '0 2px 6px rgba(15, 23, 42, 0.18)',
                            transition: 'left 0.18s ease',
                          }}
                        />
                      </span>
                      Auto-save
                    </button>
                    <span style={{ fontSize: 11, fontWeight: 700, color: autoSaveState === 'error' ? '#b91c1c' : '#64748b' }}>
                      {autoSaveLabel}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => { setSelectedPosition(''); setSearchTerm(''); }}
                    style={{ height: 40, border: '1px solid #dbe4ef', borderRadius: 12, padding: '0 14px', fontWeight: 800, cursor: 'pointer', background: '#fff', color: '#334155' }}
                  >
                    Clear
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isBusy}
                    style={{ height: 40, border: '1px solid #007afb', borderRadius: 12, padding: '0 18px', fontWeight: 800, cursor: isBusy ? 'not-allowed' : 'pointer', background: '#007afb', color: '#fff', opacity: isBusy ? 0.7 : 1 }}
                  >
                    {isBusy ? 'Saving...' : 'Save Attendance'}
                  </button>
                </div>
              </div>
            </section>

            {errorMessage ? (
              <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 14, border: '1px solid #fecaca', background: '#fff1f2', color: '#b91c1c', fontSize: 13, fontWeight: 700 }}>
                {errorMessage}
              </div>
            ) : null}

            {successMessage ? (
              <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 14, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', fontSize: 13, fontWeight: 700 }}>
                {successMessage}
              </div>
            ) : null}

            <section style={{ marginTop: 16, background: '#ffffff', borderRadius: 22, border: '1px solid #e7ecf3', boxShadow: '0 20px 46px rgba(15, 23, 42, 0.05)', overflow: 'hidden' }}>
              <div style={{ padding: '18px 18px 12px', borderBottom: '1px solid #edf2f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Daily Attendance Sheet</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: '#64748b' }}>Use the action pills for faster marking, then save once when the register is complete.</div>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 34, padding: '0 14px', borderRadius: 999, border: '1px solid #e7ecf3', background: '#fff', color: '#334155', fontSize: 12, fontWeight: 700 }}>
                  <FaUserCheck /> {normalizedEmployees.length} visible employee{normalizedEmployees.length === 1 ? '' : 's'}
                </div>
              </div>

              {isLoading ? (
                <div style={{ padding: '28px 20px', fontSize: 14, color: '#64748b', fontWeight: 600 }}>Loading attendance...</div>
              ) : normalizedEmployees.length === 0 ? (
                <div style={{ padding: '28px 20px', fontSize: 14, color: '#64748b', fontWeight: 600 }}>No employees found for the current filters.</div>
              ) : (
                <div style={{ width: '100%', overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 1080, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#fbfdff' }}>
                        <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #edf2f7' }}>Employee</th>
                        <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #edf2f7' }}>Department</th>
                        <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #edf2f7' }}>Position</th>
                        <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #edf2f7' }}>Current Status</th>
                        <th style={{ padding: '14px 18px', textAlign: 'right', fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #edf2f7' }}>Mark Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {normalizedEmployees.map((employee) => {
                        const employeeId = employee.id;
                        const isHovered = hoveredEmployeeId === employeeId;
                        const hasSavedOrSelectedStatus = Object.prototype.hasOwnProperty.call(attendance || {}, employeeId);
                        const record = attendance?.[employeeId] || {};
                        const rawStatus = hasSavedOrSelectedStatus
                          ? (record.status || (record.present ? 'present' : 'absent')).toString().toLowerCase()
                          : '';
                        const displayStatus = rawStatus === 'late' ? 'late' : rawStatus === 'present' ? 'present' : rawStatus === 'absent' ? 'absent' : '';
                        const styles = statusStyles(displayStatus);

                        return (
                          <tr
                            key={employeeId}
                            onMouseEnter={() => setHoveredEmployeeId(employeeId)}
                            onMouseLeave={() => setHoveredEmployeeId(null)}
                            style={{ background: isHovered ? '#fcfdff' : '#ffffff', transition: 'background 0.18s ease' }}
                          >
                            <td style={{ padding: '16px 18px', borderBottom: '1px solid #f1f5f9' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                <AvatarBadge src={employee._avatar} name={employee._name} size={50} />
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{employee._name}</div>
                                  <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>{employeeId}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '16px 18px', fontSize: 13, color: '#334155', fontWeight: 700, borderBottom: '1px solid #f1f5f9' }}>{employee._department}</td>
                            <td style={{ padding: '16px 18px', fontSize: 13, color: '#334155', fontWeight: 700, borderBottom: '1px solid #f1f5f9' }}>{employee._position}</td>
                            <td style={{ padding: '16px 18px', borderBottom: '1px solid #f1f5f9' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: 30, padding: '0 12px', borderRadius: 999, border: `1px solid ${styles.border}`, background: styles.bg, color: styles.text, fontSize: 12, fontWeight: 800, textTransform: displayStatus ? 'capitalize' : 'none' }}>
                                {displayStatus || 'Not set'}
                              </span>
                            </td>
                            <td style={{ padding: '16px 18px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                <StatusActionButton label="Present" value="present" active={displayStatus === 'present'} colors={presentColors} onClick={(value) => handleSetStatus(employeeId, value)} />
                                <StatusActionButton label="Late" value="late" active={displayStatus === 'late'} colors={lateColors} onClick={(value) => handleSetStatus(employeeId, value)} />
                                <StatusActionButton label="Absent" value="absent" active={displayStatus === 'absent'} colors={absentColors} onClick={(value) => handleSetStatus(employeeId, value)} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section style={{ position: 'sticky', bottom: 18, marginTop: 16, background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', border: '1px solid #dbe8f6', borderRadius: 20, padding: '14px 18px', boxShadow: '0 16px 38px rgba(15, 23, 42, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Attendance Ready to Save</div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>
                  {attendanceStats.present} present, {attendanceStats.late} late, {attendanceStats.absent} absent, {attendanceStats.unset} not set.
                </div>
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={isBusy}
                style={{ height: 42, border: '1px solid #007afb', borderRadius: 12, padding: '0 18px', fontWeight: 800, cursor: isBusy ? 'not-allowed' : 'pointer', background: '#007afb', color: '#fff', opacity: isBusy ? 0.7 : 1 }}
              >
                {isBusy ? 'Saving...' : 'Save Attendance'}
              </button>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
