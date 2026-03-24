import React, { useEffect, useState } from 'react'
import api from '../api'
import { Link, useNavigate } from "react-router-dom";

import { FaCog, FaBell, FaFacebookMessenger } from "react-icons/fa";
import Sidebar from "../components/Sidebar";

// Mock fallback using provided Employees export (used when API fails)
const MOCK_EMPLOYEES = {
  "-OltxoGMqQRv8fuufdNI": {
    "contact": {
      "address": "Adama",
      "altEmail": "birukteferahunde@gmail.com",
      "city": "Adama",
      "email": "ephremtesema92@gmail.com",
      "emergencyContactName": "",
      "emergencyContactPhone": "",
      "emergencyContactRelationship": "",
      "phone1": "0952415241",
      "phone2": "0985246589",
      "postalCode": "",
      "subCity": "Bole",
      "woreda": "Gendehara"
    },
    "education": {
      "additionalCertifications": "CTC",
      "degreeType": "BSc",
      "fieldOfStudy": "computer science",
      "gpa": "3.42",
      "graduationYear": "2012",
      "highestQualification": "BSc in Computer Science",
      "institution": "ASTU",
      "professionalLicenseNumber": "424545",
      "workExperience": "one Year"
    },
    "family": {
      "childrenNames": "",
      "fatherName": "Tefera",
      "maritalStatus": "single",
      "motherName": "Alemitu",
      "numChildren": "",
      "spouseName": "",
      "spouseOccupation": ""
    },
    "financial": {
      "accountHolderName": "Test 001",
      "accountNumber": "10000256321545",
      "allowances": "2000",
      "bankBranch": "Adama",
      "bankName": "CBE",
      "basicSalary": "13000",
      "bonusEligibility": false,
      "overtimeRate": "3000",
      "paymentMethod": "Bank Transfer"
    },
    "job": {
        "contractEndDate": "2027-01-01",
        "contractStartDate": "2026-01-01",
        "dateJoined": "",
        "department": "ICT",
        "employeeCategory": "Teacher",
        "employmentType": "Full-time",
        "financePosition": "",
        "gradeAssigned": "",
        "hireDate": "2026-01-01",
        "hrPosition": "",
        "position": "teacher",
        "reportingManager": "Test X",
        "status": "Active",
        "subject": "",
        "workLocation": "Adama",
        "workShift": "full time"
    },
    "personal": {
      "bloodGroup": "A+",
      "disabilityStatus": "none",
      "dob": "2001-01-17",
      "employeeId": "",
      "fatherName": "",
      "firstName": "Biruk",
      "gender": "male",
      "grandfatherName": "",
      "lastName": "Hunde",
      "middleName": "Tefera",
      "nationalId": "0212521452132",
      "nationality": "Ethiopian",
      "placeOfBirth": "Adama",
      "profileImageName": "6769264_60111.jpg",
      "religion": "Christian"
    },
    "profileData": {
      "contact": {
        "address": "Adama",
        "altEmail": "birukteferahunde@gmail.com",
        "city": "Adama",
        "email": "ephremtesema92@gmail.com",
        "emergencyContactName": "",
        "emergencyContactPhone": "",
        "emergencyContactRelationship": "",
        "phone1": "0952415241",
        "phone2": "0985246589",
        "postalCode": "",
        "subCity": "Bole",
        "woreda": "Gendehara"
      },
      "education": {
        "additionalCertifications": "CTC",
        "degreeType": "BSc",
        "fieldOfStudy": "computer science",
        "gpa": "3.42",
        "graduationYear": "2012",
        "highestQualification": "BSc in Computer Science",
        "institution": "ASTU",
        "professionalLicenseNumber": "424545",
        "workExperience": "one Year"
      },
      "family": {
        "childrenNames": "",
        "fatherName": "Tefera",
        "maritalStatus": "single",
        "motherName": "Alemitu",
        "numChildren": "",
        "spouseName": "",
        "spouseOccupation": ""
      },
      "financial": {
        "accountHolderName": "Test 001",
        "accountNumber": "10000256321545",
        "allowances": "2000",
        "bankBranch": "Adama",
        "bankName": "CBE",
        "basicSalary": "13000",
        "bonusEligibility": false,
        "overtimeRate": "3000",
        "paymentMethod": "Bank Transfer"
      },
      "job": {
        "contractEndDate": "2027-01-01",
        "contractStartDate": "2026-01-01",
        "dateJoined": "",
        "department": "ICT",
        "employeeCategory": "Teacher",
        "employeeId": "",
        "employmentType": "Full-time",
        "financePosition": "",
        "gradeAssigned": "",
        "hireDate": "2026-01-01",
        "hrPosition": "",
        "position": "teacher",
        "reportingManager": "Test X",
        "status": "Active",
        "subject": "",
        "workLocation": "Adama",
        "workShift": "full time"
      },
      "personal": {
        "bloodGroup": "A+",
        "disabilityStatus": "none",
        "dob": "2001-01-17",
        "employeeId": "",
        "fatherName": "",
        "firstName": "Biruk",
        "gender": "male",
        "grandfatherName": "",
        "lastName": "Hunde",
        "middleName": "Tefera",
        "nationalId": "0212521452132",
        "nationality": "Ethiopian",
        "placeOfBirth": "Adama",
        "profileImageName": "6769264_60111.jpg",
        "religion": "Christian"
      }
    },
    "teacherId": "-OltxoK8koHkGpeZp0uM",
    "userId": "-OltxoCMvzOWVE7g8ISD"
  }
}

export default function Employees() {
  const [employees, setEmployees] = useState([])
  const [filter, setFilter] = useState('all') // 'all' or 'management'
  const [admin, setAdmin] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("admin")) || {};
    } catch (e) {
      return {};
    }
  });
  const navigate = useNavigate();

  // Helper to normalize employees API or RTDB export into list form used by the UI
  function mapDataToList(data) {
    return Array.isArray(data)
      ? data
      : Object.entries(data || {}).map(([id, v]) => {
          const item = v || {}
          const personal = item.personal || (item.profileData && item.profileData.personal) || {}
          const job = item.job || (item.profileData && item.profileData.job) || {}
          const contact = item.contact || (item.profileData && item.profileData.contact) || {}

          const name = item.name || [personal.firstName, personal.middleName, personal.lastName].filter(Boolean).join(' ') || ''
          const title = job.position || job.title || ''
          const email = contact.email || contact.altEmail || item.email || ''

          return ({ id, raw: item, name, title, email })
        })
  }

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const res = await api.get('/employees')
      const data = res.data || {}

      const list = mapDataToList(data)

      // if API returned no employees, fall back to embedded mock export
      const effectiveList = (Array.isArray(list) && list.length) || (!Array.isArray(list) && Object.keys(list || {}).length)
        ? list
        : mapDataToList(MOCK_EMPLOYEES)

      // fetch users and join (prefer lookup by employeeId)
      try {
        const usersRes = await api.get('/users')
        const users = usersRes.data || {}

        // build a map of employeeId -> user for quick lookup
        const usersByEmployeeId = Object.values(users).reduce((acc, u) => {
          const empId = u && (u.employeeId || u.employeeId)
          if (empId) acc[empId] = u
          return acc
        }, {})

        const listWithUsers = effectiveList.map(it => {
          const byEmp = usersByEmployeeId[it.id]
          const byUserId = users[(it.raw && it.raw.userId) || ''] || {}
          return ({ ...it, user: byEmp || byUserId || {} })
        })

        setEmployees(listWithUsers)
      } catch (uErr) {
        // if users fetch fails, still show employees (mock or real)
        setEmployees(effectiveList)
      }
    } catch (e) {
      console.error(e)
      // fallback to embedded mock data
      const list = mapDataToList(MOCK_EMPLOYEES)
      try {
        const usersRes = await api.get('/users')
        const users = usersRes.data || {}
        const listWithUsers = list.map(it => ({ ...it, user: users[(it.raw && it.raw.userId) || ''] || {} }))
        setEmployees(listWithUsers)
      } catch (uErr) {
        setEmployees(list)
      }
    }
  }

  async function remove(id) {
    if (!confirm('Terminate employee? This will remove linked Users and role-node records, but keep Employees record.')) return
    try {
      // Prefer admin.hrId, admin.hrID, admin.adminId, or adminId for HR id
      const hrId = admin.hrId || admin.hrID || admin.adminId || admin.adminID || admin.id || admin.userId;
      await api.post(`/employees/${id}/terminate`, { hrId })
      load()
    } catch (e) {
      console.error(e)
    }
  }

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

        <main className="google-main" style={{ flex: '1.08 1 0', minWidth: 0, maxWidth: 'none', margin: '0', boxSizing: 'border-box', alignSelf: 'flex-start', height: 'calc(100vh - 24px)', overflowY: 'auto', position: 'sticky', top: 24, padding: '0 2px' }}>
          <style>{`
            .emp-main-shell {
              width: 100%;
            }
            .emp-hero {
              background: linear-gradient(135deg, #f8fbff 0%, #edf2ff 56%, #f7fbff 100%);
              border: 1px solid #e1e9ff;
              border-radius: 18px;
              padding: 24px;
              box-shadow: 0 12px 28px rgba(33, 57, 117, 0.08);
              margin-bottom: 18px;
            }
            .emp-title {
              margin: 0;
              font-size: 30px;
              font-weight: 800;
              color: #173467;
            }
            .emp-subtitle {
              margin: 8px 0 0;
              color: #62729a;
              font-size: 14px;
              font-weight: 500;
            }
            .emp-toolbar {
              margin-top: 16px;
              display: flex;
              flex-wrap: wrap;
              gap: 10px;
            }
            .emp-filter-btn {
              border: 1px solid #d6e1ff;
              background: #fff;
              color: #2a4c8b;
              border-radius: 999px;
              padding: 9px 16px;
              font-size: 13px;
              font-weight: 700;
              cursor: pointer;
              transition: all 0.2s ease;
            }
            .emp-filter-btn:hover {
              transform: translateY(-1px);
              box-shadow: 0 8px 16px rgba(53, 92, 176, 0.16);
            }
            .emp-filter-btn.active {
              background: linear-gradient(135deg, #2f67d3, #4d86ee);
              color: #fff;
              border-color: #2f67d3;
            }
            .emp-card {
              background: #fff;
              border: 1px solid #e6ecf8;
              border-radius: 16px;
              box-shadow: 0 12px 26px rgba(23, 43, 91, 0.06);
              overflow: hidden;
            }
            .emp-table-wrap {
              width: 100%;
              overflow-x: auto;
            }
            .emp-table {
              width: 100%;
              min-width: 930px;
              border-collapse: collapse;
            }
            .emp-table thead th {
              text-align: left;
              padding: 14px 12px;
              color: #5f6f91;
              font-size: 12px;
              font-weight: 800;
              letter-spacing: 0.35px;
              border-bottom: 1px solid #e8eefb;
              background: #f9fbff;
            }
            .emp-table tbody td {
              padding: 12px;
              color: #1c2e54;
              font-size: 13px;
              border-bottom: 1px solid #eff3fb;
              vertical-align: middle;
            }
            .emp-table tbody tr:hover {
              background: #fbfdff;
            }
            .emp-avatar {
              width: 46px;
              height: 46px;
              border-radius: 10px;
              object-fit: cover;
              border: 1px solid #dce5f8;
            }
            .emp-avatar-fallback {
              width: 46px;
              height: 46px;
              border-radius: 10px;
              background: #eef2fb;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #6e7d9d;
              font-size: 12px;
              font-weight: 700;
              border: 1px solid #dce5f8;
            }
            .emp-name {
              font-weight: 700;
              color: #193465;
            }
            .emp-role {
              font-weight: 700;
            }
            .emp-status {
              display: inline-block;
              padding: 5px 10px;
              border-radius: 999px;
              font-size: 12px;
              font-weight: 700;
              background: #edf4ff;
              color: #2d55a2;
            }
            .emp-actions {
              display: flex;
              gap: 8px;
            }
            .emp-action-btn {
              border: none;
              border-radius: 8px;
              padding: 7px 12px;
              font-size: 12px;
              font-weight: 700;
              cursor: pointer;
            }
            .emp-action-btn.view {
              background: #e8f1ff;
              color: #2552a1;
            }
            .emp-action-btn.terminate {
              background: #fff7ed;
              color: #c2410c;
            }
            .emp-empty {
              padding: 28px;
              text-align: center;
              color: #6d7e9f;
              font-weight: 600;
            }
          `}</style>

          <div className="emp-main-shell">
            <section className="emp-hero">
              <h1 className="emp-title">Employees</h1>
              <p className="emp-subtitle">Manage all staff profiles, roles, and details from one professional workspace.</p>
              <div className="emp-toolbar">
                <button onClick={() => setFilter('all')} className={`emp-filter-btn ${filter === 'all' ? 'active' : ''}`}>All</button>
                <button onClick={() => setFilter('management')} className={`emp-filter-btn ${filter === 'management' ? 'active' : ''}`}>Management</button>
                <button onClick={() => setFilter('finance')} className={`emp-filter-btn ${filter === 'finance' ? 'active' : ''}`}>Finance</button>
                <button onClick={() => setFilter('hr')} className={`emp-filter-btn ${filter === 'hr' ? 'active' : ''}`}>HR</button>
                <button onClick={() => setFilter('teacher')} className={`emp-filter-btn ${filter === 'teacher' ? 'active' : ''}`}>Teacher</button>
              </div>
            </section>

            <section className="emp-card">
              <div className="emp-table-wrap">
                <table className="emp-table">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Phone</th>
                      <th>Dept / Position</th>
                      <th>Joined</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees
                      .filter(e => {
                        const raw = e.raw || {}
                        const job = raw.job || (raw.profileData && raw.profileData.job) || {}
                        const statusValue = (job.status || raw.status || '').toString().toLowerCase().trim()
                        if (statusValue.includes('terminated')) {
                          return false
                        }
                        const empCat = (job.employeeCategory || job.position || '').toString().toLowerCase()
                        if (filter === 'management') {
                          const isMgmtByEmployeeId = Boolean(raw.managementId || (e.user && e.user.managementId))
                          const isMgmtByCategory = empCat === 'management' || empCat.includes('director') || empCat.includes('manager')
                          return isMgmtByEmployeeId || isMgmtByCategory
                        }
                        if (filter === 'finance') {
                          const isFinanceByEmployeeId = Boolean(raw.financeId || (e.user && e.user.financeId))
                          const isFinanceByCategory = empCat === 'finance'
                          return isFinanceByEmployeeId || isFinanceByCategory
                        }
                        if (filter === 'hr') {
                          const isHrByEmployeeId = Boolean(raw.hrId || (e.user && e.user.hrId))
                          const isHrByCategory = empCat === 'hr'
                          return isHrByEmployeeId || isHrByCategory
                        }
                        if (filter === 'teacher') {
                          const isTeacherByEmployeeId = Boolean(raw.teacherId || (e.user && e.user.teacherId))
                          const isTeacherByCategory = empCat === 'teacher'
                          return isTeacherByEmployeeId || isTeacherByCategory
                        }
                        return true
                      })
                      .map(e => {
                        const raw = e.raw || {}
                        const personal = raw.personal || (raw.profileData && raw.profileData.personal) || {}
                        const job = raw.job || (raw.profileData && raw.profileData.job) || {}
                        const contact = raw.contact || (raw.profileData && raw.profileData.contact) || {}

                        let img = ''
                        if (raw.teacherId || (e.user && e.user.teacherId)) {
                          img = (e.user && (e.user.profileImage || e.user.profileImageName)) || raw.profileImage || personal.profileImageName || (raw.profileData && raw.profileData.personal && raw.profileData.personal.profileImageName) || ''
                        } else if (raw.financeId || (e.user && e.user.financeId)) {
                          img = (e.user && (e.user.profileImage || e.user.profileImageName)) || raw.profileImage || personal.profileImageName || (raw.profileData && raw.profileData.personal && raw.profileData.personal.profileImageName) || ''
                        } else {
                          img = (e.user && (e.user.profileImage || e.user.profileImageName)) || raw.profileImage || personal.profileImageName || (raw.profileData && raw.profileData.personal && raw.profileData.personal.profileImageName) || ''
                        }
                        const idDisplay = (e.id || '').toString()
                        const name = e.name || [personal.firstName, personal.middleName, personal.lastName].filter(Boolean).join(' ')
                        const role = job.employeeCategory || job.position || raw.role || ''
                        const teacherId = raw.teacherId || (raw.profileData && raw.profileData.teacherId) || (e.user && e.user.teacherId) || ''
                        const phone = contact.phone1 || contact.phone || contact.phone2 || ''
                        const deptPos = [job.department, job.position].filter(Boolean).join(' / ')
                        const joined = job.hireDate || job.dateJoined || ''
                        const status = (job.status || raw.status || '').toString()

                        const isActive = (e.user && typeof e.user.isActive !== 'undefined') ? e.user.isActive : true;
                        return (
                          <tr key={e.id}>
                            <td>
                              {img ? (
                                <img src={img} alt="avatar" className="emp-avatar" />
                              ) : (
                                <div className="emp-avatar-fallback">No Img</div>
                              )}
                            </td>
                            <td>{idDisplay}</td>
                            <td className="emp-name">{name || '—'}</td>
                            <td className="emp-role">{role}{teacherId ? ` (${teacherId})` : ''}</td>
                            <td>{phone || '—'}</td>
                            <td>{deptPos || '—'}</td>
                            <td>{joined || '—'}</td>
                            <td><span className="emp-status">{status || 'Unknown'}</span></td>
                            <td>
                              <div className="emp-actions">
                                <button onClick={() => navigate(`/employees/${encodeURIComponent(e.id)}`)} className="emp-action-btn view">View</button>
                                {!isActive && (
                                  <button onClick={() => remove(e.id)} className="emp-action-btn terminate">Terminate</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>

              {employees.length === 0 && (
                <div className="emp-empty">No employee records available yet.</div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
