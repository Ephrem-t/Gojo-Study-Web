import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaBell, FaFacebookMessenger, FaCog } from 'react-icons/fa';
import api from '../api';
import './Dashboard.css';
import '../styles/global.css';
import Sidebar from '../components/Sidebar';

function toIsoDate(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const [attendance, setAttendance] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const markedBy = admin?.adminId || admin?.hrId || admin?.id || admin?.userId || '';

  const normalizedEmployees = useMemo(() => {
    return employees
      .filter((employee) => {
        // Exclude terminated employees from attendance marking
        const status = (employee.status || employee?.job?.status || employee?.profileData?.job?.status || '').toString().toLowerCase();
        const isActive = typeof employee.isActive === 'boolean' ? employee.isActive : true;
        return status !== 'terminated' && isActive !== false;
      })
      .map((employee) => {
        const job = employee?.job || employee?.profileData?.job || {};
        const personal = employee?.personal || employee?.profileData?.personal || {};
        const name = employee.name || employee.fullName || [personal.firstName, personal.middleName, personal.lastName].filter(Boolean).join(' ') || 'Employee';
        return {
          ...employee,
          _name: name,
          _department: job.department || employee.department || 'Unassigned',
          _position: job.position || employee.position || employee.role || 'Staff',
        };
      })
      .sort((a, b) => a._name.localeCompare(b._name));
  }, [employees]);

  useEffect(() => {
    async function loadEmployees() {
      try {
        const res = await api.get('/employees');
        const data = res.data || {};
        const list = Array.isArray(data)
          ? data
          : Object.entries(data || {}).map(([id, payload]) => ({
              ...(payload || {}),
              id,
            }));
        setEmployees(list);
      } catch (e) {
        console.error(e);
        setEmployees([]);
      }
    }

    loadEmployees();
  }, []);

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
      } catch (e) {
        console.error(e);
        setAttendance({});
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
      setSuccessMessage(typeof savedCount === 'number' ? `Saved ${savedCount} records.` : 'Saved attendance.');
    } catch (e) {
      console.error(e);
      setErrorMessage('Failed to save attendance.');
    } finally {
      setIsSaving(false);
    }
  };

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

      <div className="google-dashboard" style={{ display: 'flex', gap: 14, padding: '18px 14px', minHeight: '100vh', background: 'var(--page-bg, #f4f6fb)', width: '100%', boxSizing: 'border-box' }}>
        <Sidebar
          admin={admin}
          fullHeight
          top={4}
          onLogout={() => {
            localStorage.removeItem('admin');
            navigate('/login', { replace: true });
          }}
        />

        <main className="google-main" style={{ flex: '1.08 1 0', minWidth: 0, maxWidth: 'none', margin: '0', boxSizing: 'border-box', alignSelf: 'flex-start', height: 'calc(100vh - 24px)', overflowY: 'auto', position: 'sticky', top: 24, padding: '0 2px', width: '100%' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', background: '#fff', borderRadius: 16, border: '1px solid #e6ecf8', boxShadow: '0 10px 24px rgba(17,24,39,0.08)', padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#111827' }}>Employees Attendance</div>
                <div style={{ marginTop: 4, fontSize: 13, color: '#6b7280' }}>Set each employee as Present, Late, or Absent then save.</div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    style={{ height: 38, borderRadius: 10, border: '1px solid #dbe2f2', padding: '0 10px', fontWeight: 700, color: '#111827' }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || isLoading}
                  style={{
                    height: 38,
                    border: 'none',
                    borderRadius: 10,
                    padding: '0 16px',
                    fontWeight: 800,
                    cursor: isSaving || isLoading ? 'not-allowed' : 'pointer',
                    background: '#4b6cb7',
                    color: '#fff',
                    opacity: isSaving || isLoading ? 0.7 : 1,
                  }}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            {errorMessage ? (
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', fontSize: 13, fontWeight: 700 }}>
                {errorMessage}
              </div>
            ) : null}

            {successMessage ? (
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', fontSize: 13, fontWeight: 700 }}>
                {successMessage}
              </div>
            ) : null}

            <div style={{ marginTop: 14, borderRadius: 14, border: '1px solid #e6ecf8', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.2fr 1.2fr 1.1fr', gap: 0, padding: '11px 12px', background: '#f8faff', borderBottom: '1px solid #e6ecf8', fontSize: 12, fontWeight: 900, color: '#334155' }}>
                <div>Employee</div>
                <div>Department</div>
                <div>Position</div>
                <div style={{ textAlign: 'right' }}>Status</div>
              </div>

              {isLoading ? (
                <div style={{ padding: 14, fontSize: 13, color: '#6b7280' }}>Loading attendance...</div>
              ) : normalizedEmployees.length === 0 ? (
                <div style={{ padding: 14, fontSize: 13, color: '#6b7280' }}>No employees found.</div>
              ) : (
                normalizedEmployees.map((employee) => {
                  const employeeId = employee.id;
                  const hasSavedOrSelectedStatus = Object.prototype.hasOwnProperty.call(attendance || {}, employeeId);
                  const record = attendance?.[employeeId] || {};
                  const rawStatus = hasSavedOrSelectedStatus
                    ? (record.status || (record.present ? 'present' : 'absent')).toString().toLowerCase()
                    : '';
                  const displayStatus = rawStatus === 'late' ? 'late' : rawStatus === 'present' ? 'present' : rawStatus === 'absent' ? 'absent' : '';
                  const styles = statusStyles(displayStatus);

                  return (
                    <div
                      key={employeeId}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2.2fr 1.2fr 1.2fr 1.1fr',
                        gap: 0,
                        padding: '10px 12px',
                        borderBottom: '1px solid #eef2ff',
                        alignItems: 'center',
                        background: styles.bg,
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>{employee._name}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{employeeId}</div>
                      </div>
                      <div style={{ fontSize: 13, color: '#334155', fontWeight: 700 }}>{employee._department}</div>
                      <div style={{ fontSize: 13, color: '#334155', fontWeight: 700 }}>{employee._position}</div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 900,
                            textTransform: displayStatus ? 'capitalize' : 'none',
                            color: styles.text,
                            background: '#fff',
                            border: `1px solid ${styles.border}`,
                            padding: '5px 10px',
                            borderRadius: 999,
                          }}
                        >
                          {displayStatus || 'Not set'}
                        </span>

                        <select
                          value={displayStatus}
                          onChange={(e) => handleSetStatus(employeeId, e.target.value)}
                          style={{
                            height: 34,
                            borderRadius: 10,
                            border: '1px solid #dbe2f2',
                            padding: '0 10px',
                            fontWeight: 800,
                            color: '#111827',
                            background: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="" disabled>Select status</option>
                          <option value="present">Present</option>
                          <option value="late">Late</option>
                          <option value="absent">Absent</option>
                        </select>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
