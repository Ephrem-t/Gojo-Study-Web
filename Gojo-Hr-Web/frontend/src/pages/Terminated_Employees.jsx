import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaBell, FaFacebookMessenger, FaCog } from 'react-icons/fa';
import api from '../api';
import './Dashboard.css';
import '../styles/global.css';
import Sidebar from '../components/Sidebar';
import TopNavbar from '../components/TopNavbar';

function normalizeEmployees(data) {
  const list = Array.isArray(data)
    ? data
    : Object.entries(data || {}).map(([id, payload]) => ({
        ...(payload || {}),
        id,
      }));

  return list
    .map((employee) => {
      const job = employee?.job || employee?.profileData?.job || {};
      const personal = employee?.personal || employee?.profileData?.personal || {};
      const contact = employee?.contact || employee?.profileData?.contact || {};
      const statusValue = String(job.status || employee.status || '').toLowerCase().trim();
      const isTerminated = statusValue.includes('terminated');

      return {
        ...employee,
        _job: job,
        _personal: personal,
        _contact: contact,
        _status: statusValue,
        _isTerminated: isTerminated,
        _name:
          employee.name
          || employee.fullName
          || [personal.firstName, personal.middleName, personal.lastName].filter(Boolean).join(' ')
          || 'Employee',
        _department: job.department || employee.department || 'Unassigned',
        _position: job.position || employee.position || employee.role || 'Staff',
        _email: contact.email || contact.altEmail || employee.email || '—',
      };
    })
    .filter((employee) => employee._isTerminated)
    .sort((leftItem, rightItem) => leftItem._name.localeCompare(rightItem._name));
}

export default function TerminatedEmployees() {
  const navigate = useNavigate();
  const [admin] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('admin') || '{}');
    } catch {
      return {};
    }
  });

  // Helper to get the best available admin/HR id for backend
  function getAdminIdPayload() {
    // Try all possible fields
    const payload = {};
    if (admin.hrId) payload.hrId = admin.hrId;
    if (admin.hrID) payload.hrID = admin.hrID;
    if (admin.adminId) payload.adminId = admin.adminId;
    if (admin.adminID) payload.adminID = admin.adminID;
    if (admin.userId) payload.userId = admin.userId;
    if (admin.id) payload.userId = admin.id;
    return payload;
  }
  const [terminatedEmployees, setTerminatedEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadEmployees() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await api.get('/employees');
        const normalizedList = normalizeEmployees(response.data || {});
        setTerminatedEmployees(normalizedList);
      } catch (error) {
        console.error(error);
        setTerminatedEmployees([]);
        setErrorMessage('Failed to load terminated employees.');
      } finally {
        setIsLoading(false);
      }
    }

    loadEmployees();
  }, []);

  const summary = useMemo(() => {
    const total = terminatedEmployees.length;
    const departments = new Set(terminatedEmployees.map((employee) => employee._department).filter(Boolean)).size;
    return {
      total,
      departments,
    };
  }, [terminatedEmployees]);

  return (
    <div className="dashboard-page" style={{ minHeight: '100vh' }}>
      <TopNavbar admin={admin} />

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

        <main className="google-main" style={{ flex: '1.08 1 0', minWidth: 0, maxWidth: 'none', margin: '0', boxSizing: 'border-box', alignSelf: 'flex-start', height: 'calc(100vh - var(--topbar-height, 56px) - 36px)', maxHeight: 'calc(100vh - var(--topbar-height, 56px) - 36px)', overflowY: 'auto', position: 'relative', padding: '0 2px 18px', width: '100%' }}>
          <div style={{ maxWidth: 1500, margin: '0 auto', background: '#fff', borderRadius: 16, border: '1px solid #e6ecf8', boxShadow: '0 10px 24px rgba(17,24,39,0.08)', padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#111827' }}>Terminated Employees</div>
                <div style={{ marginTop: 4, fontSize: 13, color: '#6b7280' }}>Employee records with status marked as terminated.</div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ border: '1px solid #dbe2f2', borderRadius: 10, background: '#f8faff', padding: '7px 11px' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 800 }}>Total</div>
                  <div style={{ marginTop: 2, fontSize: 18, color: '#111827', fontWeight: 900 }}>{summary.total}</div>
                </div>
                <div style={{ border: '1px solid #dbe2f2', borderRadius: 10, background: '#f8faff', padding: '7px 11px' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 800 }}>Departments</div>
                  <div style={{ marginTop: 2, fontSize: 18, color: '#111827', fontWeight: 900 }}>{summary.departments}</div>
                </div>
              </div>
            </div>

            {errorMessage ? (
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', fontSize: 13, fontWeight: 700 }}>
                {errorMessage}
              </div>
            ) : null}

            <div style={{ marginTop: 14, borderRadius: 14, border: '1px solid #e6ecf8', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2.1fr 1.2fr 1.2fr 1.5fr 1fr', gap: 0, padding: '11px 12px', background: '#f8faff', borderBottom: '1px solid #e6ecf8', fontSize: 12, fontWeight: 900, color: '#334155' }}>
                <div>Employee</div>
                <div>Department</div>
                <div>Position</div>
                <div>Email</div>
                <div style={{ textAlign: 'right' }}>Status</div>
              </div>

              {isLoading ? (
                <div style={{ padding: 14, fontSize: 13, color: '#6b7280' }}>Loading terminated employees...</div>
              ) : terminatedEmployees.length === 0 ? (
                <div style={{ padding: 14, fontSize: 13, color: '#6b7280' }}>No terminated employees found.</div>
              ) : (
                terminatedEmployees.map((employee) => (
                  <div
                    key={employee.id || employee._name}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2.1fr 1.2fr 1.2fr 1.5fr 1fr',
                      gap: 0,
                      padding: '10px 12px',
                      borderBottom: '1px solid #eef2ff',
                      alignItems: 'center',
                      background: '#fff',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>{employee._name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{employee.id || '—'}</div>
                    </div>
                    <div style={{ fontSize: 13, color: '#334155', fontWeight: 700 }}>{employee._department}</div>
                    <div style={{ fontSize: 13, color: '#334155', fontWeight: 700 }}>{employee._position}</div>
                    <div style={{ fontSize: 13, color: '#334155', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{employee._email}</div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          textTransform: 'capitalize',
                          color: '#991b1b',
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          padding: '5px 10px',
                          borderRadius: 999,
                        }}
                      >
                        terminated
                      </span>
                      <button
                        style={{
                          marginLeft: 10,
                          background: '#e0fbe0',
                          color: '#166534',
                          border: '1px solid #bbf7d0',
                          borderRadius: 8,
                          padding: '5px 14px',
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                        onClick={async () => {
                          try {
                            setIsLoading(true);
                            setErrorMessage('');
                            // Send admin/HR id in POST body
                            await api.post(`/employees/${employee.id}/reactivate`, getAdminIdPayload());
                            // Refresh list
                            const response = await api.get('/employees');
                            const normalizedList = normalizeEmployees(response.data || {});
                            setTerminatedEmployees(normalizedList);
                          } catch (err) {
                            setErrorMessage('Failed to reactivate employee.');
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                        title="Restore this employee as active and recreate access"
                      >
                        Activate
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
