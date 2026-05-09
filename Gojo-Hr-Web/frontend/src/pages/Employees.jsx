import React, { useEffect, useMemo, useState } from 'react'
import api from '../api'
import { Link, useNavigate } from "react-router-dom";

import { FaBell, FaBuilding, FaChalkboardTeacher, FaCog, FaExclamationTriangle, FaFacebookMessenger, FaFilter, FaSearch, FaUsers, FaUserTie } from "react-icons/fa";
import EmployeeDetailPanel from '../components/EmployeeDetailPanel'
import { getEmployeesSnapshot, setEmployeesSnapshot } from '../hrData';

// // Mock fallback using provided Employees export (used when API fails)
// const MOCK_EMPLOYEES = {
//   "-OltxoGMqQRv8fuufdNI": {
//     "contact": {
//       "address": "Adama",
//       "altEmail": "birukteferahunde@gmail.com",
//       "city": "Adama",
//       "email": "ephremtesema92@gmail.com",
//       "emergencyContactName": "",
//       "emergencyContactPhone": "",
//       "emergencyContactRelationship": "",
//       "phone1": "0952415241",
//       "phone2": "0985246589",
//       "postalCode": "",
//       "subCity": "Bole",
//       "woreda": "Gendehara"
//     },
//     "education": {
//       "additionalCertifications": "CTC",
//       "degreeType": "BSc",
//       "fieldOfStudy": "computer science",
//       "gpa": "3.42",
//       "graduationYear": "2012",
//       "highestQualification": "BSc in Computer Science",
//       "institution": "ASTU",
//       "professionalLicenseNumber": "424545",
//       "workExperience": "one Year"
//     },
//     "family": {
//       "childrenNames": "",
//       "fatherName": "Tefera",
//       "maritalStatus": "single",
//       "motherName": "Alemitu",
//       "numChildren": "",
//       "spouseName": "",
//       "spouseOccupation": ""
//     },
//     "financial": {
//       "accountHolderName": "Test 001",
//       "accountNumber": "10000256321545",
//       "allowances": "2000",
//       "bankBranch": "Adama",
//       "bankName": "CBE",
//       "basicSalary": "13000",
//       "bonusEligibility": false,
//       "overtimeRate": "3000",
//       "paymentMethod": "Bank Transfer"
//     },
//     "job": {
//         "contractEndDate": "2027-01-01",
//         "contractStartDate": "2026-01-01",
//         "dateJoined": "",
//         "department": "ICT",
//         "employeeCategory": "Teacher",
//         "employmentType": "Full-time",
//         "financePosition": "",
//         "gradeAssigned": "",
//         "hireDate": "2026-01-01",
//         "hrPosition": "",
//         "position": "teacher",
//         "reportingManager": "Test X",
//         "status": "Active",
//         "subject": "",
//         "workLocation": "Adama",
//         "workShift": "full time"
//     },
//     "personal": {
//       "bloodGroup": "A+",
//       "disabilityStatus": "none",
//       "dob": "2001-01-17",
//       "employeeId": "",
//       "fatherName": "",
//       "firstName": "Biruk",
//       "gender": "male",
//       "grandfatherName": "",
//       "lastName": "Hunde",
//       "middleName": "Tefera",
//       "nationalId": "0212521452132",
//       "nationality": "Ethiopian",
//       "placeOfBirth": "Adama",
//       "profileImageName": "6769264_60111.jpg",
//       "religion": "Christian"
//     },
//     "profileData": {
//       "contact": {
//         "address": "Adama",
//         "altEmail": "birukteferahunde@gmail.com",
//         "city": "Adama",
//         "email": "ephremtesema92@gmail.com",
//         "emergencyContactName": "",
//         "emergencyContactPhone": "",
//         "emergencyContactRelationship": "",
//         "phone1": "0952415241",
//         "phone2": "0985246589",
//         "postalCode": "",
//         "subCity": "Bole",
//         "woreda": "Gendehara"
//       },
//       "education": {
//         "additionalCertifications": "CTC",
//         "degreeType": "BSc",
//         "fieldOfStudy": "computer science",
//         "gpa": "3.42",
//         "graduationYear": "2012",
//         "highestQualification": "BSc in Computer Science",
//         "institution": "ASTU",
//         "professionalLicenseNumber": "424545",
//         "workExperience": "one Year"
//       },
//       "family": {
//         "childrenNames": "",
//         "fatherName": "Tefera",
//         "maritalStatus": "single",
//         "motherName": "Alemitu",
//         "numChildren": "",
//         "spouseName": "",
//         "spouseOccupation": ""
//       },
//       "financial": {
//         "accountHolderName": "Test 001",
//         "accountNumber": "10000256321545",
//         "allowances": "2000",
//         "bankBranch": "Adama",
//         "bankName": "CBE",
//         "basicSalary": "13000",
//         "bonusEligibility": false,
//         "overtimeRate": "3000",
//         "paymentMethod": "Bank Transfer"
//       },
//       "job": {
//         "contractEndDate": "2027-01-01",
//         "contractStartDate": "2026-01-01",
//         "dateJoined": "",
//         "department": "ICT",
//         "employeeCategory": "Teacher",
//         "employeeId": "",
//         "employmentType": "Full-time",
//         "financePosition": "",
//         "gradeAssigned": "",
//         "hireDate": "2026-01-01",
//         "hrPosition": "",
//         "position": "teacher",
//         "reportingManager": "Test X",
//         "status": "Active",
//         "subject": "",
//         "workLocation": "Adama",
//         "workShift": "full time"
//       },
//       "personal": {
//         "bloodGroup": "A+",
//         "disabilityStatus": "none",
//         "dob": "2001-01-17",
//         "employeeId": "",
//         "fatherName": "",
//         "firstName": "Biruk",
//         "gender": "male",
//         "grandfatherName": "",
//         "lastName": "Hunde",
//         "middleName": "Tefera",
//         "nationalId": "0212521452132",
//         "nationality": "Ethiopian",
//         "placeOfBirth": "Adama",
//         "profileImageName": "6769264_60111.jpg",
//         "religion": "Christian"
//       }
//     },
//     "teacherId": "-OltxoK8koHkGpeZp0uM",
//     "userId": "-OltxoCMvzOWVE7g8ISD"
//   }
// }

const MOCK_EMPLOYEES = {}
const EMPLOYEE_SUMMARY_CACHE_TTL_MS = 5 * 60 * 1000

function getInitials(name) {
  return (name || 'Employee')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'E'
}

function AvatarBadge({ src, name, size = 44, fontSize = 14, radius = '50%', loading = 'eager', decoding = 'auto' }) {
  const [failed, setFailed] = useState(false)
  const initials = getInitials(name)

  useEffect(() => {
    setFailed(false)
  }, [src])

  if (!src || failed) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          background: 'linear-gradient(135deg, #f2f7ff 0%, #e4eefc 100%)',
          border: '1px solid #d9e5f5',
          color: '#1f4f96',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize,
          fontWeight: 800,
          flexShrink: 0,
          userSelect: 'none',
        }}
      >
        {initials}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={name || 'Employee'}
      loading={loading}
      decoding={decoding}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', border: '1px solid #d9e5f5', flexShrink: 0 }}
    />
  )
}

function isEmployeeTerminatedRecord(value) {
  const raw = value || {}
  const employment = raw.employment || raw.profileData?.employment || {}
  const job = { ...(raw.job || raw.profileData?.job || {}), ...employment }
  const statusText = String(job.status || raw.status || '').trim().toLowerCase()
  return Boolean(raw.terminated) || Boolean(raw.termination?.terminatedAt) || statusText.includes('terminated')
}

function normalizeEmployeeRecord(id, value) {
  const raw = value || {}
  const personal = raw.personal || raw.profileData?.personal || {}
  const employment = raw.employment || raw.profileData?.employment || {}
  const job = { ...(raw.job || raw.profileData?.job || {}), ...employment }
  const contact = raw.contact || raw.profileData?.contact || {}
  const name = raw.fullName || raw.name || [personal.firstName, personal.middleName, personal.lastName].filter(Boolean).join(' ') || 'Employee'
  const role = raw.position || raw.role || job.position || job.employeeCategory || job.category || 'Staff'
  const roleId = raw.teacherId || raw.managementId || raw.financeId || raw.hrId || raw.schoolAdminId || raw.adminId || ''
  const department = raw.department || job.department || 'Unassigned'
  const joined = raw.hireDate || job.hireDate || job.dateJoined || job.contractStartDate || ''
  const status = (job.status || raw.status || (raw.deactivated || raw.isActive === false ? 'Inactive' : 'Active') || '').toString()
  const image = String(raw.profileImage || personal.profileImage || personal.profileImageName || raw.profileData?.personal?.profileImage || raw.profileData?.personal?.profileImageName || '').trim()
  const phone = raw.phone || contact.phone1 || contact.phone || contact.phone2 || contact.altPhone || ''
  const email = raw.email || contact.email || contact.altEmail || ''
  const deptPos = [department, raw.position || job.position].filter(Boolean).join(' / ')
  const statusText = status.toString().toLowerCase()
  const isTerminated = isEmployeeTerminatedRecord(raw)
  const isDeactivated = !isTerminated && Boolean(raw.deactivated || raw.isActive === false || statusText.includes('inactive') || statusText.includes('deactivated'))
  const normalizedRole = role.toString().toLowerCase()
  const filterKey = raw.hrId || normalizedRole.includes('human resource') || normalizedRole === 'hr'
    ? 'hr'
    : raw.financeId || normalizedRole.includes('finance') || normalizedRole.includes('account')
      ? 'finance'
      : raw.teacherId || normalizedRole.includes('teacher')
        ? 'teacher'
        : raw.managementId || raw.schoolAdminId || normalizedRole.includes('management') || normalizedRole.includes('director') || normalizedRole.includes('manager') || normalizedRole.includes('principal')
          ? 'management'
          : 'other'

  return {
    id,
    raw,
    personal,
    job,
    contact,
    name,
    role,
    roleId,
    department,
    joined,
    status,
    image,
    phone,
    email,
    deptPos,
    filterKey,
    isActive: !isTerminated && !isDeactivated,
    isTerminated,
    isDeactivated,
    searchIndex: [id, name, role, roleId, department, phone, email].filter(Boolean).join(' ').toLowerCase(),
  }
}

function mapDataToList(data) {
  if (Array.isArray(data)) {
    return data.map((item, index) => normalizeEmployeeRecord(item?.id || item?.employeeId || `employee-${index}`, item))
  }

  return Object.entries(data || {}).map(([id, value]) => normalizeEmployeeRecord(id, value))
}

function formatJoinedDate(value) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function applyTerminationToSnapshot(snapshot, employeeId, actorId, formValues) {
  const terminatedAt = new Date().toISOString()
  const nextTermination = {
    reason: formValues.reason,
    note: formValues.note,
    lastWorkingDate: formValues.lastWorkingDate,
    terminatedAt,
    terminatedBy: actorId || '',
    accessRevokedAt: terminatedAt,
  }

  const patchEmployee = (employee) => {
    const nextEmployee = { ...(employee || {}) }
    nextEmployee.terminated = true
    nextEmployee.terminatedAt = terminatedAt
    nextEmployee.terminatedBy = actorId || ''
    nextEmployee.termination = nextTermination
    delete nextEmployee.status
    delete nextEmployee.isActive

    if (nextEmployee.job && typeof nextEmployee.job === 'object') {
      nextEmployee.job = {
        ...nextEmployee.job,
        status: 'Terminated',
        lastWorkingDate: formValues.lastWorkingDate,
      }
      delete nextEmployee.job.isActive
    }

    if (nextEmployee.employment && typeof nextEmployee.employment === 'object') {
      nextEmployee.employment = {
        ...nextEmployee.employment,
        status: 'Terminated',
        lastWorkingDate: formValues.lastWorkingDate,
      }
      delete nextEmployee.employment.isActive
    }

    if (nextEmployee.profileData?.job && typeof nextEmployee.profileData.job === 'object') {
      nextEmployee.profileData = {
        ...nextEmployee.profileData,
        job: {
          ...nextEmployee.profileData.job,
          status: 'Terminated',
          lastWorkingDate: formValues.lastWorkingDate,
        },
      }
      delete nextEmployee.profileData.job.isActive
    }

    if (nextEmployee.profileData?.employment && typeof nextEmployee.profileData.employment === 'object') {
      nextEmployee.profileData = {
        ...nextEmployee.profileData,
        employment: {
          ...nextEmployee.profileData.employment,
          status: 'Terminated',
          lastWorkingDate: formValues.lastWorkingDate,
        },
      }
      delete nextEmployee.profileData.employment.isActive
    }

    return nextEmployee
  }

  if (Array.isArray(snapshot)) {
    return snapshot.map((employee) => {
      const currentEmployeeId = employee?.id || employee?.employeeId || employee?.raw?.employeeId
      return String(currentEmployeeId) === String(employeeId) ? patchEmployee(employee) : employee
    })
  }

  return Object.fromEntries(
    Object.entries(snapshot || {}).map(([currentEmployeeId, employee]) => [
      currentEmployeeId,
      String(currentEmployeeId) === String(employeeId) ? patchEmployee(employee) : employee,
    ])
  )
}

export default function Employees() {
  const [employees, setEmployees] = useState([])
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [terminationModal, setTerminationModal] = useState({ open: false, employee: null, isSubmitting: false, error: '', reason: '', note: '', lastWorkingDate: '' })
  const [deactivationNotice, setDeactivationNotice] = useState({ open: false, employee: null })
  const [admin, setAdmin] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("admin")) || {};
    } catch (e) {
      return {};
    }
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (!selectedEmployeeId && !terminationModal.open) return undefined
    const { body } = document
    const previousOverflow = body.style.overflow
    body.style.overflow = 'hidden'
    return () => {
      body.style.overflow = previousOverflow
    }
  }, [selectedEmployeeId, terminationModal.open, deactivationNotice.open])

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const snapshot = await getEmployeesSnapshot(EMPLOYEE_SUMMARY_CACHE_TTL_MS)
      const list = mapDataToList(snapshot)
      setEmployees((Array.isArray(list) && list.length) || (!Array.isArray(list) && Object.keys(list || {}).length) ? list : mapDataToList(MOCK_EMPLOYEES))
    } catch (e) {
      console.error(e)
      setEmployees(mapDataToList(MOCK_EMPLOYEES))
    }
  }

  async function recoverCompletedTermination(employeeId, actorId, formValues) {
    let latestSnapshot = null

    try {
      latestSnapshot = await getEmployeesSnapshot(0)
      const latestList = mapDataToList(latestSnapshot)
      const latestEmployee = latestList.find((employee) => String(employee.id) === String(employeeId))
      if (!latestEmployee || latestEmployee.isTerminated) {
        setEmployeesSnapshot(latestSnapshot)
        setEmployees(latestList)
        return true
      }
    } catch (error) {
      console.error('Failed to refresh employee summaries after termination.', error)
    }

    try {
      const response = await api.get(`/employees/${employeeId}`)
      if (!isEmployeeTerminatedRecord(response.data)) {
        return false
      }

      if (Array.isArray(latestSnapshot)) {
        const patchedSnapshot = applyTerminationToSnapshot(latestSnapshot, employeeId, actorId, formValues)
        setEmployeesSnapshot(patchedSnapshot)
        setEmployees(mapDataToList(patchedSnapshot))
      } else {
        setEmployees((currentEmployees) => currentEmployees.filter((employee) => String(employee.id) !== String(employeeId)))
      }

      return true
    } catch (error) {
      console.error('Failed to verify raw employee termination state.', error)
      return false
    }
  }

  async function confirmTerminateEmployee() {
    if (!terminationModal.employee || !terminationModal.reason.trim()) {
      setTerminationModal((previous) => ({ ...previous, error: 'Select a termination reason before continuing.' }))
      return
    }

    try {
      setTerminationModal((previous) => ({ ...previous, isSubmitting: true, error: '' }))
      const employeeId = terminationModal.employee.id
      const hrId = admin.hrId || admin.hrID || admin.adminId || admin.adminID || admin.id || admin.userId;
      const payload = {
        hrId,
        terminationReason: terminationModal.reason,
        terminationNote: terminationModal.note,
        lastWorkingDate: terminationModal.lastWorkingDate,
      }
      await api.post(`/employees/${employeeId}/terminate`, payload)

      try {
        const freshSnapshot = await getEmployeesSnapshot(0)
        const nextSnapshot = applyTerminationToSnapshot(freshSnapshot, employeeId, hrId, terminationModal)
        setEmployeesSnapshot(nextSnapshot)
        setEmployees(mapDataToList(nextSnapshot))
      } catch (refreshError) {
        console.error('Failed to refresh employee list after termination.', refreshError)
        setEmployees((currentEmployees) => currentEmployees.filter((employee) => String(employee.id) !== String(employeeId)))
      }

      setTerminationModal({ open: false, employee: null, isSubmitting: false, error: '', reason: '', note: '', lastWorkingDate: '' })
    } catch (e) {
      console.error(e)
      if (e?.response?.data?.requiresAcademicDeactivation) {
        const employee = terminationModal.employee
        setTerminationModal({ open: false, employee: null, isSubmitting: false, error: '', reason: '', note: '', lastWorkingDate: '' })
        setDeactivationNotice({ open: true, employee })
        return
      }

      const employeeId = terminationModal.employee?.id
      const hrId = admin.hrId || admin.hrID || admin.adminId || admin.adminID || admin.id || admin.userId
      if (employeeId) {
        const recovered = await recoverCompletedTermination(employeeId, hrId, terminationModal)
        if (recovered) {
          setTerminationModal({ open: false, employee: null, isSubmitting: false, error: '', reason: '', note: '', lastWorkingDate: '' })
          return
        }
      }

      setTerminationModal((previous) => ({ ...previous, isSubmitting: false, error: 'Failed to terminate employee. Please try again.' }))
    }
  }

  function openTerminationModal(employee) {
    setTerminationModal({
      open: true,
      employee,
      isSubmitting: false,
      error: '',
      reason: employee.department || employee.role || 'Restructuring',
      note: '',
      lastWorkingDate: new Date().toISOString().slice(0, 10),
    })
  }

  function closeTerminationModal() {
    setTerminationModal({ open: false, employee: null, isSubmitting: false, error: '', reason: '', note: '', lastWorkingDate: '' })
  }

  function handleTerminateAction(employee) {
    if (employee.filterKey === 'teacher' && employee.isActive) {
      setDeactivationNotice({ open: true, employee })
      return
    }
    openTerminationModal(employee)
  }

  function closeDeactivationNotice() {
    setDeactivationNotice({ open: false, employee: null })
  }

  function openEmployeeModal(employeeId) {
    setSelectedEmployeeId(employeeId)
  }

  function closeEmployeeModal() {
    setSelectedEmployeeId('')
  }

  const filteredEmployees = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return employees.filter((employee) => {
      if (employee.isTerminated) return false
      if (filter !== 'all' && employee.filterKey !== filter) return false
      if (term && !employee.searchIndex.includes(term)) return false
      return true
    })
  }, [employees, filter, searchTerm])

  const totalCount = employees.filter((employee) => !employee.isTerminated).length
  const activeCount = employees.filter((employee) => employee.isActive).length
  const departmentCount = new Set(employees.filter((employee) => !employee.isTerminated).map((employee) => employee.department).filter(Boolean)).size
  const leadershipCount = employees.filter((employee) => employee.filterKey === 'management' && !employee.isTerminated).length

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
  }

  const metricCardStyle = {
    background: 'var(--surface-panel)',
    borderRadius: 18,
    border: '1px solid var(--border-soft)',
    padding: 18,
    boxShadow: 'var(--shadow-panel)',
  }

  const filterOptions = [
    { key: 'all', label: 'All Employees' },
    { key: 'management', label: 'Management' },
    { key: 'finance', label: 'Finance' },
    { key: 'hr', label: 'HR' },
    { key: 'teacher', label: 'Teachers' },
  ]

  return (
    <div
      className="dashboard-page"
      style={{
        minHeight: '100vh',
        background: 'var(--page-bg)',
        color: 'var(--text-primary)',
        '--sidebar-width': 'clamp(230px, 16vw, 290px)',
        '--topbar-height': '64px',
      }}
    >
      <nav className="top-navbar" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 'var(--topbar-height)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '0 18px 0 20px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-panel)', zIndex: 60 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Gojo HR</h2>
        </div>

        <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" title="Notifications" style={headerActionStyle}><FaBell /></button>
          <button type="button" title="Messages" onClick={() => navigate('/all-chat')} style={headerActionStyle}><FaFacebookMessenger /></button>
          <Link to="/settings" aria-label="Settings" style={headerActionStyle}><FaCog /></Link>
          <AvatarBadge src={admin.profileImage} name={admin.name || 'HR Office'} size={40} fontSize={14} />
        </div>
      </nav>

      <div className="google-dashboard" style={{ display: 'flex', gap: 14, padding: '18px 14px 18px', height: '100vh', overflow: 'hidden', background: 'var(--page-bg)', width: '100%', boxSizing: 'border-box', alignItems: 'flex-start' }}>
        <div className="admin-sidebar-spacer" style={{ width: 'var(--sidebar-width)', minWidth: 'var(--sidebar-width)', flex: '0 0 var(--sidebar-width)', pointerEvents: 'none' }} />

        <main className="google-main" style={{ flex: '1 1 0', minWidth: 0, maxWidth: 'none', margin: 0, boxSizing: 'border-box', alignSelf: 'flex-start', height: 'calc(100vh - var(--topbar-height) - 36px)', maxHeight: 'calc(100vh - var(--topbar-height) - 36px)', overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', position: 'relative', padding: '0 12px 12px 2px', display: 'flex', justifyContent: 'center', width: '100%' }}>
          <div style={{ width: '100%', maxWidth: 1260 }}>
            <section
              style={{
                background: 'linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-muted) 100%)',
                border: '1px solid var(--border-soft)',
                borderRadius: 22,
                padding: '22px 24px',
                boxShadow: 'var(--shadow-panel)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', width: 'fit-content', height: 30, padding: '0 12px', borderRadius: 999, background: 'var(--surface-accent)', border: '1px solid var(--border-strong)', color: 'var(--accent-strong)', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Employee Directory
                  </div>
                  <h1 style={{ margin: '12px 0 0', fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Employee List</h1>
                  <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 760 }}>
                    Review active and deactivated staff, browse departments, and move into employee details from a cleaner HR workspace built to match the rest of the platform.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 36, padding: '0 14px', borderRadius: 999, border: '1px solid var(--border-soft)', background: 'var(--surface-panel)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 }}>
                    <FaFilter /> {filteredEmployees.length} visible
                  </div>
                </div>
              </div>
            </section>

            <section style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <div style={metricCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Employees</div>
                    <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{totalCount}</div>
                  </div>
                  <div style={{ width: 46, height: 46, borderRadius: 16, background: '#f3f8ff', border: '1px solid #dbe8f7', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}><FaUsers /></div>
                </div>
              </div>
              <div style={metricCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Active Staff</div>
                    <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{activeCount}</div>
                  </div>
                  <div style={{ width: 46, height: 46, borderRadius: 16, background: '#f5fbf7', border: '1px solid #d9efe1', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}><FaUserTie /></div>
                </div>
              </div>
              <div style={metricCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Departments</div>
                    <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{departmentCount}</div>
                  </div>
                  <div style={{ width: 46, height: 46, borderRadius: 16, background: '#fbf8ff', border: '1px solid #ece3fb', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}><FaBuilding /></div>
                </div>
              </div>
              <div style={metricCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Leadership</div>
                    <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{leadershipCount}</div>
                  </div>
                  <div style={{ width: 46, height: 46, borderRadius: 16, background: '#fff8f2', border: '1px solid #f4e3d1', color: '#c2410c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}><FaChalkboardTeacher /></div>
                </div>
              </div>
            </section>

            <section style={{ marginTop: 16, background: 'var(--surface-panel)', borderRadius: 22, border: '1px solid var(--border-soft)', padding: 18, boxShadow: 'var(--shadow-panel)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {filterOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setFilter(option.key)}
                      style={{
                        height: 38,
                        padding: '0 16px',
                        borderRadius: 999,
                        border: filter === option.key ? '1px solid var(--border-strong)' : '1px solid var(--border-soft)',
                        background: filter === option.key ? 'var(--surface-accent)' : 'var(--surface-panel)',
                        color: filter === option.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div style={{ position: 'relative', minWidth: 260, flex: '1 1 280px', maxWidth: 360 }}>
                  <FaSearch style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13 }} />
                  <input
                    aria-label="Search employees"
                    placeholder="Search by name, ID, role, phone, or email"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: '100%', height: 42, borderRadius: 14, border: '1px solid var(--input-border)', padding: '0 14px 0 40px', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
                  />
                </div>
              </div>
            </section>

            <section style={{ marginTop: 16, background: 'var(--surface-panel)', borderRadius: 22, border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-panel)', overflow: 'hidden' }}>
              <div style={{ padding: '18px 18px 12px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Employee Directory</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-muted)' }}>A refined table view for quick HR review, deactivation follow-up, and navigation into employee details.</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{filteredEmployees.length} result{filteredEmployees.length === 1 ? '' : 's'}</div>
              </div>

              {filteredEmployees.length === 0 ? (
                <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, fontWeight: 600 }}>
                  No employee records match the current filters.
                </div>
              ) : (
                <div style={{ width: '100%', overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 1060, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-muted)' }}>
                        <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border-soft)' }}>Employee</th>
                        <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border-soft)' }}>ID</th>
                        <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border-soft)' }}>Role</th>
                        <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border-soft)' }}>Contact</th>
                        <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border-soft)' }}>Department</th>
                        <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border-soft)' }}>Joined</th>
                        <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border-soft)' }}>Status</th>
                        <th style={{ padding: '14px 18px', textAlign: 'right', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border-soft)' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmployees.map((employee) => (
                        <tr key={employee.id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                          <td style={{ padding: '16px 18px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                              <AvatarBadge src={employee.image} name={employee.name} size={54} fontSize={15} radius={16} loading="lazy" decoding="async" />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{employee.name}</div>
                                <div style={{ marginTop: 5, fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{employee.email || 'No email available'}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '16px 18px', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 700 }}>{employee.id}</td>
                          <td style={{ padding: '16px 18px', fontSize: 13, color: 'var(--text-secondary)' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{employee.role || 'Staff'}</div>
                            {/* <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>{employee.roleId || 'No role code'}</div> */}
                          </td>
                          <td style={{ padding: '16px 18px', fontSize: 13, color: 'var(--text-secondary)' }}>{employee.phone || '—'}</td>
                          <td style={{ padding: '16px 18px', fontSize: 13, color: 'var(--text-secondary)' }}>{employee.deptPos || '—'}</td>
                          <td style={{ padding: '16px 18px', fontSize: 13, color: 'var(--text-secondary)' }}>{formatJoinedDate(employee.joined)}</td>
                          <td style={{ padding: '16px 18px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                minHeight: 30,
                                padding: '0 12px',
                                borderRadius: 999,
                                border: employee.isDeactivated ? '1px solid #fcd34d' : '1px solid #dcecf0',
                                background: employee.isDeactivated ? '#fffbea' : '#f5fbf7',
                                color: employee.isDeactivated ? '#92400e' : '#166534',
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              {employee.isDeactivated ? 'Deactivated' : employee.status || 'Active'}
                            </span>
                          </td>
                          <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => openEmployeeModal(employee.id)}
                                style={{ height: 34, padding: '0 14px', borderRadius: 10, border: '1px solid #d8e8ff', background: '#eef6ff', color: '#1f4f96', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                              >
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => handleTerminateAction(employee)}
                                style={{ height: 34, padding: '0 14px', borderRadius: 10, border: '1px solid #fed7aa', background: '#fff7ed', color: '#c2410c', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                              >
                                Terminate
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {selectedEmployeeId ? (
              <div
                role="dialog"
                aria-modal="true"
                onClick={closeEmployeeModal}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 120,
                  background: 'rgba(15, 23, 42, 0.38)',
                  backdropFilter: 'blur(8px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 18,
                }}
              >
                <div onClick={(event) => event.stopPropagation()}>
                  <EmployeeDetailPanel
                    employeeId={selectedEmployeeId}
                    admin={admin}
                    embedded
                    onClose={closeEmployeeModal}
                    onSaved={load}
                  />
                </div>
              </div>
            ) : null}

            {deactivationNotice.open && deactivationNotice.employee ? (
              <div
                role="dialog"
                aria-modal="true"
                onClick={closeDeactivationNotice}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 125,
                  background: 'rgba(15, 23, 42, 0.42)',
                  backdropFilter: 'blur(9px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 18,
                }}
              >
                <div
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    width: 'min(560px, calc(100vw - 32px))',
                    borderRadius: 28,
                    border: '1px solid #dbe7ff',
                    background: '#ffffff',
                    boxShadow: '0 34px 80px rgba(15, 23, 42, 0.24)',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '22px 24px 18px', background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)', borderBottom: '1px solid #e5eefb' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 16, background: '#eef6ff', border: '1px solid #d8e8ff', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                        <FaExclamationTriangle />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', minHeight: 28, padding: '0 12px', borderRadius: 999, background: '#eef6ff', border: '1px solid #d8e8ff', color: '#1e40af', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          Academic Action Required
                        </div>
                        <h3 style={{ margin: '12px 0 0', fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em' }}>Deactivate teacher first</h3>
                        <p style={{ margin: '8px 0 0', fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
                          {deactivationNotice.employee.name} is still an active teacher account. Academic administration must deactivate the teacher before HR can complete termination.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: 24, display: 'grid', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                      <div style={{ border: '1px solid #e7ecf3', borderRadius: 16, padding: 14, background: '#fbfdff' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Employee ID</div>
                        <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{deactivationNotice.employee.id}</div>
                      </div>
                      <div style={{ border: '1px solid #e7ecf3', borderRadius: 16, padding: 14, background: '#fbfdff' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Role</div>
                        <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{deactivationNotice.employee.role}</div>
                      </div>
                    </div>

                    <div style={{ padding: '14px 16px', borderRadius: 16, border: '1px solid #dbe7ff', background: '#f8fbff', color: '#334155', fontSize: 13, lineHeight: 1.7 }}>
                      Once academics deactivates the teacher account, the employee will remain visible here with a deactivated status and HR can then open the termination modal normally.
                    </div>
                  </div>

                  <div style={{ padding: '16px 24px 22px', borderTop: '1px solid #e5eefb', background: '#fcfdff', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={closeDeactivationNotice}
                      style={{ height: 42, border: '1px solid #dbe4ef', borderRadius: 12, padding: '0 16px', fontWeight: 700, cursor: 'pointer', background: '#fff', color: '#334155' }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {terminationModal.open && terminationModal.employee ? (
              <div
                role="dialog"
                aria-modal="true"
                onClick={closeTerminationModal}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 130,
                  background: 'rgba(15, 23, 42, 0.46)',
                  backdropFilter: 'blur(10px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 18,
                }}
              >
                <div
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    width: 'min(640px, calc(100vw - 32px))',
                    borderRadius: 28,
                    border: '1px solid #f3d5b5',
                    background: '#ffffff',
                    boxShadow: '0 34px 80px rgba(15, 23, 42, 0.24)',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '22px 24px 18px', background: 'linear-gradient(180deg, #fffaf5 0%, #ffffff 100%)', borderBottom: '1px solid #f5e7d6' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 16, background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                        <FaExclamationTriangle />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', minHeight: 28, padding: '0 12px', borderRadius: 999, background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          Archive Employee
                        </div>
                        <h3 style={{ margin: '12px 0 0', fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em' }}>Terminate {terminationModal.employee.name}?</h3>
                        <p style={{ margin: '8px 0 0', fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
                          This will archive the employee, disable access, and move the record to the terminated archive without deleting historical data.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: 24, display: 'grid', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                      <div style={{ border: '1px solid #e7ecf3', borderRadius: 16, padding: 14, background: '#fbfdff' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Employee ID</div>
                        <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{terminationModal.employee.id}</div>
                      </div>
                      <div style={{ border: '1px solid #e7ecf3', borderRadius: 16, padding: 14, background: '#fbfdff' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Department</div>
                        <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{terminationModal.employee.department}</div>
                      </div>
                      <div style={{ border: '1px solid #e7ecf3', borderRadius: 16, padding: 14, background: '#fbfdff' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Role</div>
                        <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{terminationModal.employee.role}</div>
                      </div>
                    </div>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Termination Reason</span>
                      <select
                        value={terminationModal.reason}
                        onChange={(event) => setTerminationModal((previous) => ({ ...previous, reason: event.target.value, error: '' }))}
                        style={{ height: 46, borderRadius: 14, border: '1px solid #dbe4ef', padding: '0 14px', fontSize: 14, color: '#0f172a', background: '#fcfdff' }}
                      >
                        <option value="">Select a reason</option>
                        <option value="Contract Ended">Contract Ended</option>
                        <option value="Restructuring">Restructuring</option>
                        <option value="Performance">Performance</option>
                        <option value="Resignation">Resignation</option>
                        <option value="Policy Violation">Policy Violation</option>
                        <option value="Other">Other</option>
                      </select>
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 220px) minmax(0, 1fr)', gap: 14 }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Last Working Date</span>
                        <input
                          type="date"
                          value={terminationModal.lastWorkingDate}
                          onChange={(event) => setTerminationModal((previous) => ({ ...previous, lastWorkingDate: event.target.value }))}
                          style={{ height: 46, borderRadius: 14, border: '1px solid #dbe4ef', padding: '0 14px', fontSize: 14, color: '#0f172a', background: '#fcfdff' }}
                        />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Internal Note</span>
                        <textarea
                          rows={3}
                          value={terminationModal.note}
                          onChange={(event) => setTerminationModal((previous) => ({ ...previous, note: event.target.value }))}
                          placeholder="Add context for HR records, handover details, or follow-up notes"
                          style={{ borderRadius: 14, border: '1px solid #dbe4ef', padding: '12px 14px', fontSize: 14, color: '#0f172a', background: '#fcfdff', resize: 'vertical' }}
                        />
                      </label>
                    </div>

                    {terminationModal.error ? (
                      <div style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid #fecaca', background: '#fff1f2', color: '#b91c1c', fontSize: 13, fontWeight: 700 }}>
                        {terminationModal.error}
                      </div>
                    ) : null}
                  </div>

                  <div style={{ padding: '16px 24px 22px', borderTop: '1px solid #f5e7d6', background: '#fffdfa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 13, color: '#64748b' }}>The record stays in HR history and can be reactivated later.</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        type="button"
                        onClick={closeTerminationModal}
                        style={{ height: 42, border: '1px solid #dbe4ef', borderRadius: 12, padding: '0 16px', fontWeight: 700, cursor: 'pointer', background: '#fff', color: '#334155' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={confirmTerminateEmployee}
                        disabled={terminationModal.isSubmitting}
                        style={{ height: 42, border: '1px solid #c2410c', borderRadius: 12, padding: '0 18px', fontWeight: 800, cursor: terminationModal.isSubmitting ? 'not-allowed' : 'pointer', background: '#c2410c', color: '#fff', opacity: terminationModal.isSubmitting ? 0.7 : 1 }}
                      >
                        {terminationModal.isSubmitting ? 'Archiving...' : 'Terminate Employee'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}
