import React, { useEffect, useState } from 'react'
import api from '../api'

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
    <div style={{ padding: 20 }}>
      <h1>Employees</h1>
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => setFilter('all')} style={{ marginRight: 8, padding: '6px 10px', background: filter === 'all' ? '#2e7d32' : '#eee', color: filter === 'all' ? '#fff' : '#000', borderRadius: 6 }}>All</button>
        <button onClick={() => setFilter('management')} style={{ padding: '6px 10px', background: filter === 'management' ? '#2e7d32' : '#eee', color: filter === 'management' ? '#fff' : '#000', borderRadius: 6 }}>Management</button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
              if (filter !== 'management') return true
              const raw = e.raw || {}
              const job = raw.job || (raw.profileData && raw.profileData.job) || {}
              // management can be indicated by a managementId on the employee node or on the joined user,
              // or by job.employeeCategory === 'Management' (case-insensitive)
              const isMgmtByEmployeeId = Boolean(raw.managementId || (e.user && e.user.managementId))
              const empCat = (job.employeeCategory || job.position || '').toString().toLowerCase()
              const isMgmtByCategory = empCat === 'management' || empCat.includes('director') || empCat.includes('manager')
              return isMgmtByEmployeeId || isMgmtByCategory
            })
            .map(e => {
            const raw = e.raw || {}
            const personal = raw.personal || (raw.profileData && raw.profileData.personal) || {}
            const job = raw.job || (raw.profileData && raw.profileData.job) || {}
            const contact = raw.contact || (raw.profileData && raw.profileData.contact) || {}

            const img = (e.user && (e.user.profileImage || e.user.profileImageName)) || raw.profileImage || personal.profileImageName || ''
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
    </div>
  )
}
