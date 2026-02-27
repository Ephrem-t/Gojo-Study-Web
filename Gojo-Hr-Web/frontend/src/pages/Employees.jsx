import React, { useEffect, useState } from 'react'
import api from '../api'
import { Link, useNavigate } from "react-router-dom";

import { FaHome, FaFileAlt, FaChalkboardTeacher, FaCog, FaSignOutAlt, FaBell, FaFacebookMessenger, FaCalendarAlt } from "react-icons/fa";

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
    if (!confirm('Delete employee?')) return
    try {
      await api.delete(`/employees/${id}`)
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
            <Link className="sidebar-btn" to="/"> <FaHome /> Dashboard</Link>
            <Link className="sidebar-btn" to="/employees" style={{backgroundColor: "#4b6cb7", color: "white"}}> <FaChalkboardTeacher /> Employees</Link>
            <Link className="sidebar-btn" to="/register"> <FaFileAlt /> Registration</Link>
            <button className="logout-btn" onClick={() => { localStorage.removeItem('admin'); window.location.href = '/login' }}>Logout</button>
          </div>
        </aside>

        <main className="google-main">
          <h1 style={{ fontWeight: 800, fontSize: 32, color: '#4b6cb7', marginBottom: 24 }}>Employees</h1>
          <div style={{ marginBottom: 24, display: 'flex', gap: 12 }}>
            <button onClick={() => setFilter('all')} style={{ padding: '8px 18px', background: filter === 'all' ? '#4b6cb7' : '#eee', color: filter === 'all' ? '#fff' : '#4b6cb7', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 15, boxShadow: filter === 'all' ? '0 2px 8px rgba(75,108,183,0.08)' : 'none' }}>All</button>
            <button onClick={() => setFilter('management')} style={{ padding: '8px 18px', background: filter === 'management' ? '#4b6cb7' : '#eee', color: filter === 'management' ? '#fff' : '#4b6cb7', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 15, boxShadow: filter === 'management' ? '0 2px 8px rgba(75,108,183,0.08)' : 'none' }}>Management</button>
            <button onClick={() => setFilter('finance')} style={{ padding: '8px 18px', background: filter === 'finance' ? '#4b6cb7' : '#eee', color: filter === 'finance' ? '#fff' : '#4b6cb7', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 15, boxShadow: filter === 'finance' ? '0 2px 8px rgba(75,108,183,0.08)' : 'none' }}>Finance</button>
            <button onClick={() => setFilter('hr')} style={{ padding: '8px 18px', background: filter === 'hr' ? '#4b6cb7' : '#eee', color: filter === 'hr' ? '#fff' : '#4b6cb7', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 15, boxShadow: filter === 'hr' ? '0 2px 8px rgba(75,108,183,0.08)' : 'none' }}>HR</button>
            <button onClick={() => setFilter('teacher')} style={{ padding: '8px 18px', background: filter === 'teacher' ? '#4b6cb7' : '#eee', color: filter === 'teacher' ? '#fff' : '#4b6cb7', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 15, boxShadow: filter === 'teacher' ? '0 2px 8px rgba(75,108,183,0.08)' : 'none' }}>Teacher</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(75,108,183,0.08)', overflow: 'hidden' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                <th style={{ padding: 8 }}>Image</th>
                <th style={{ padding: 8 }}>ID</th>
                <th style={{ padding: 8 }}>Name</th>
                <th style={{ padding: 8 }}>Role</th>
                <th style={{ padding: 8 }}>Phone</th>
                <th style={{ padding: 8 }}>Dept / Position</th>
                <th style={{ padding: 8 }}>Joined</th>
                <th style={{ padding: 8 }}>Status</th>
                <th style={{ padding: 8 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees
                .filter(e => {
                  const raw = e.raw || {}
                  const job = raw.job || (raw.profileData && raw.profileData.job) || {}
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

                  // Prefer teacher/finance profile image from both employee and user nodes
                  let img = '';
                  // Teacher: check user, employee, and profileData
                  if (raw.teacherId || (e.user && e.user.teacherId)) {
                    img = (e.user && (e.user.profileImage || e.user.profileImageName)) || raw.profileImage || personal.profileImageName || (raw.profileData && raw.profileData.personal && raw.profileData.personal.profileImageName) || '';
                  } else if (raw.financeId || (e.user && e.user.financeId)) {
                    img = (e.user && (e.user.profileImage || e.user.profileImageName)) || raw.profileImage || personal.profileImageName || (raw.profileData && raw.profileData.personal && raw.profileData.personal.profileImageName) || '';
                  } else {
                    img = (e.user && (e.user.profileImage || e.user.profileImageName)) || raw.profileImage || personal.profileImageName || (raw.profileData && raw.profileData.personal && raw.profileData.personal.profileImageName) || '';
                  }
                  const idDisplay = (e.id || '').toString()
                  const name = e.name || [personal.firstName, personal.middleName, personal.lastName].filter(Boolean).join(' ')
                  const role = job.employeeCategory || job.position || raw.role || ''
                  // teacher id may be stored on employee record or on the joined user
                  const teacherId = raw.teacherId || (raw.profileData && raw.profileData.teacherId) || (e.user && e.user.teacherId) || ''
                  const phone = contact.phone1 || contact.phone || contact.phone2 || ''
                  const deptPos = [job.department, job.position].filter(Boolean).join(' / ')
                  const joined = job.hireDate || job.dateJoined || ''
                  const status = (job.status || raw.status || '').toString()

                  return (
                    <tr key={e.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: 8 }}>
                        {img ? (
                          <img src={img} alt="avatar" style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 48, height: 48, borderRadius: 6, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>No</div>
                        )}
                      </td>
                      <td style={{ padding: 8 }}>{idDisplay}</td>
                      <td style={{ padding: 8 }}>{name}</td>
                      <td style={{ padding: 8 }}>{role}{teacherId ? ` (${teacherId})` : ''}</td>
                      <td style={{ padding: 8 }}>{phone}</td>
                      <td style={{ padding: 8 }}>{deptPos}</td>
                      <td style={{ padding: 8 }}>{joined}</td>
                      <td style={{ padding: 8 }}>{status}</td>
                      <td style={{ padding: 8 }}>
                        <button onClick={() => window.location.assign(`/employees/${encodeURIComponent(e.id)}`)} style={{ marginRight: 8 }}>View</button>
                        <button onClick={() => remove(e.id)}>Delete</button>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </main>
      </div>
    </div>
  )
}
