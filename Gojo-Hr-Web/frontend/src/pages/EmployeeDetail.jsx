import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FaHome, FaFileAlt, FaChalkboardTeacher, FaBell, FaFacebookMessenger, FaCog } from 'react-icons/fa'
import api from '../api'

const DEFAULT_FORM = {
  personal: { employeeId: '', firstName: '', middleName: '', lastName: '', dob: '', placeOfBirth: '', nationality: '', gender: '', nationalId: '', profileImageName: '', bloodGroup: '', religion: '', disabilityStatus: '' },
  contact: { phone1: '', phone2: '', email: '', altEmail: '', address: '', city: '', subCity: '', woreda: '' },
  education: { highestQualification: '', degreeType: '', fieldOfStudy: '', institution: '', graduationYear: '', gpa: '', additionalCertifications: '', professionalLicenseNumber: '', workExperience: '' },
  family: { maritalStatus: '', spouseName: '', spouseOccupation: '', numChildren: '', childrenNames: '', fatherName: '', motherName: '' },
  job: { department: '', position: '', employmentType: '', employeeCategory: '', hireDate: '', contractStartDate: '', contractEndDate: '', workLocation: '', reportingManager: '', workShift: '', status: '' },
  financial: { basicSalary: '', allowances: '', overtimeRate: '', bonusEligibility: false, bankName: '', bankBranch: '', accountNumber: '', accountHolderName: '', paymentMethod: '' }
}

const FIELD_CONFIG = {
  personal: [
    { key: 'employeeId', label: 'Employee ID', type: 'text', readOnly: true },
    { key: 'firstName', label: 'First Name', type: 'text' },
    { key: 'middleName', label: 'Middle Name', type: 'text' },
    { key: 'lastName', label: 'Last Name', type: 'text' },
    { key: 'dob', label: 'Date of Birth', type: 'date' },
    { key: 'placeOfBirth', label: 'Place of Birth', type: 'text' },
    { key: 'nationality', label: 'Nationality', type: 'text' },
    { key: 'gender', label: 'Gender', type: 'select', options: ['', 'male', 'female'] },
    { key: 'nationalId', label: 'National ID', type: 'text' },
    { key: 'profileImageName', label: 'Profile Image', type: 'text' },
    { key: 'bloodGroup', label: 'Blood Group', type: 'text' },
    { key: 'religion', label: 'Religion', type: 'text' },
    { key: 'disabilityStatus', label: 'Disability Status', type: 'text', fullWidth: true }
  ],
  contact: [
    { key: 'phone1', label: 'Primary Phone', type: 'text' },
    { key: 'phone2', label: 'Secondary Phone', type: 'text' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'altEmail', label: 'Alternative Email', type: 'email' },
    { key: 'address', label: 'Address', type: 'textarea', fullWidth: true },
    { key: 'city', label: 'City', type: 'text' },
    { key: 'subCity', label: 'Sub City', type: 'text' },
    { key: 'woreda', label: 'Woreda', type: 'text' }
  ],
  education: [
    { key: 'highestQualification', label: 'Highest Qualification', type: 'text' },
    { key: 'degreeType', label: 'Degree Type', type: 'select', options: ['', 'Diploma', 'BSc', 'MSc', 'PhD'] },
    { key: 'fieldOfStudy', label: 'Field of Study', type: 'text' },
    { key: 'institution', label: 'Institution', type: 'text' },
    { key: 'graduationYear', label: 'Graduation Year', type: 'text' },
    { key: 'gpa', label: 'GPA', type: 'text' },
    { key: 'additionalCertifications', label: 'Additional Certifications', type: 'text', fullWidth: true },
    { key: 'professionalLicenseNumber', label: 'Professional License Number', type: 'text' },
    { key: 'workExperience', label: 'Work Experience', type: 'textarea', fullWidth: true }
  ],
  family: [
    { key: 'maritalStatus', label: 'Marital Status', type: 'text' },
    { key: 'spouseName', label: 'Spouse Name', type: 'text' },
    { key: 'spouseOccupation', label: 'Spouse Occupation', type: 'text' },
    { key: 'numChildren', label: 'Number of Children', type: 'text' },
    { key: 'childrenNames', label: 'Children Names', type: 'text', fullWidth: true },
    { key: 'fatherName', label: 'Father Name', type: 'text' },
    { key: 'motherName', label: 'Mother Name', type: 'text' }
  ],
  job: [
    { key: 'department', label: 'Department', type: 'text' },
    { key: 'position', label: 'Position', type: 'text' },
    { key: 'employmentType', label: 'Employment Type', type: 'select', options: ['', 'Full-time', 'Part-time', 'Contract'] },
    { key: 'employeeCategory', label: 'Employee Category', type: 'select', options: ['', 'Teacher', 'Director', 'Vice Director', 'Finance', 'HR', 'Administrative', 'Management'] },
    { key: 'hireDate', label: 'Hire Date', type: 'date' },
    { key: 'contractStartDate', label: 'Contract Start Date', type: 'date' },
    { key: 'contractEndDate', label: 'Contract End Date', type: 'date' },
    { key: 'workLocation', label: 'Work Location', type: 'text' },
    { key: 'reportingManager', label: 'Reporting Manager', type: 'text' },
    { key: 'workShift', label: 'Work Shift', type: 'text' },
    { key: 'status', label: 'Status', type: 'select', options: ['', 'Active', 'On Leave', 'Terminated'] }
  ],
  financial: [
    { key: 'basicSalary', label: 'Basic Salary', type: 'text' },
    { key: 'allowances', label: 'Allowances', type: 'text' },
    { key: 'overtimeRate', label: 'Overtime Rate', type: 'text' },
    { key: 'bonusEligibility', label: 'Bonus Eligibility', type: 'checkbox' },
    { key: 'bankName', label: 'Bank Name', type: 'text' },
    { key: 'bankBranch', label: 'Bank Branch', type: 'text' },
    { key: 'accountNumber', label: 'Account Number', type: 'text' },
    { key: 'accountHolderName', label: 'Account Holder Name', type: 'text' },
    { key: 'paymentMethod', label: 'Payment Method', type: 'select', options: ['', 'Bank Transfer', 'Cash'] }
  ]
}

const SECTION_ORDER = [
  { key: 'personal', label: 'Personal Information' },
  { key: 'contact', label: 'Contact Information' },
  { key: 'education', label: 'Education Information' },
  { key: 'family', label: 'Family Information' },
  { key: 'job', label: 'Job Information' },
  { key: 'financial', label: 'Financial Information' }
]

function normalizeEmployeeRecord(data) {
  const profileData = data?.profileData || {}
  return {
    ...DEFAULT_FORM,
    personal: { ...DEFAULT_FORM.personal, ...(data?.personal || profileData.personal || {}) },
    contact: { ...DEFAULT_FORM.contact, ...(data?.contact || profileData.contact || {}) },
    education: { ...DEFAULT_FORM.education, ...(data?.education || profileData.education || {}) },
    family: { ...DEFAULT_FORM.family, ...(data?.family || profileData.family || {}) },
    job: { ...DEFAULT_FORM.job, ...(data?.job || profileData.job || {}) },
    financial: { ...DEFAULT_FORM.financial, ...(data?.financial || profileData.financial || {}) }
  }
}

export default function EmployeeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [admin] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('admin')) || {}
    } catch (e) {
      return {}
    }
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [meta, setMeta] = useState({})
  const [formData, setFormData] = useState(DEFAULT_FORM)

  const displayName = useMemo(() => {
    const p = formData.personal || {}
    return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ') || 'Employee'
  }, [formData])

  useEffect(() => {
    loadEmployee()
  }, [id])

  async function loadEmployee() {
    setLoading(true)
    setError('')
    try {
      const response = await api.get(`/employees/${encodeURIComponent(id)}`)
      const payload = response.data || {}
      setMeta({
        userId: payload.userId || '',
        teacherId: payload.teacherId || '',
        managementId: payload.managementId || '',
        financeId: payload.financeId || '',
        hrId: payload.hrId || ''
      })
      setFormData(normalizeEmployeeRecord(payload))
    } catch (e) {
      console.error(e)
      setError('Unable to load employee information.')
    } finally {
      setLoading(false)
    }
  }

  function setField(section, key, value) {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] || {}),
        [key]: value
      }
    }))
  }

  async function saveEmployee() {
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...meta,
        personal: formData.personal,
        contact: formData.contact,
        education: formData.education,
        family: formData.family,
        job: formData.job,
        financial: formData.financial,
        profileData: {
          personal: formData.personal,
          contact: formData.contact,
          education: formData.education,
          family: formData.family,
          job: formData.job,
          financial: formData.financial
        }
      }

      await api.put(`/employees/${encodeURIComponent(id)}`, payload)
      alert('Employee information updated successfully.')
    } catch (e) {
      console.error(e)
      setError('Failed to save employee information.')
    } finally {
      setSaving(false)
    }
  }

  function renderField(sectionKey, field) {
    const value = formData?.[sectionKey]?.[field.key]

    if (field.type === 'checkbox') {
      return (
        <label key={field.key} className={`ed-field ed-checkbox ${field.fullWidth ? 'full' : ''}`}>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => setField(sectionKey, field.key, e.target.checked)}
          />
          <span>{field.label}</span>
        </label>
      )
    }

    if (field.type === 'textarea') {
      return (
        <label key={field.key} className={`ed-field ${field.fullWidth ? 'full' : ''}`}>
          <span>{field.label}</span>
          <textarea
            value={value || ''}
            onChange={(e) => setField(sectionKey, field.key, e.target.value)}
            className="ed-input"
            rows={3}
          />
        </label>
      )
    }

    if (field.type === 'select') {
      return (
        <label key={field.key} className={`ed-field ${field.fullWidth ? 'full' : ''}`}>
          <span>{field.label}</span>
          <select
            value={value || ''}
            onChange={(e) => setField(sectionKey, field.key, e.target.value)}
            className="ed-input"
          >
            {(field.options || []).map(opt => (
              <option key={opt || 'empty'} value={opt}>{opt || 'Select'}</option>
            ))}
          </select>
        </label>
      )
    }

    return (
      <label key={field.key} className={`ed-field ${field.fullWidth ? 'full' : ''}`}>
        <span>{field.label}</span>
        <input
          type={field.type || 'text'}
          value={value || ''}
          readOnly={field.readOnly}
          onChange={(e) => setField(sectionKey, field.key, e.target.value)}
          className="ed-input"
        />
      </label>
    )
  }

  return (
    <div className="dashboard-page" style={{ minHeight: '100vh' }}>
      <style>{`
        .employee-detail-shell { width: 100%; }
        .employee-page-bg {
          background: linear-gradient(180deg, #f6f9ff 0%, #fbfdff 45%, #f8fbff 100%);
          border-radius: 22px;
          padding: 14px;
        }
        .employee-head {
          background: linear-gradient(135deg, #ffffff 0%, #f0f5ff 58%, #f8fcff 100%);
          border: 1px solid #dfe8ff;
          border-radius: 20px;
          padding: 24px 26px;
          margin-bottom: 16px;
          box-shadow: 0 14px 32px rgba(26, 54, 112, 0.1);
        }
        .employee-head h1 {
          margin: 0;
          font-size: 30px;
          color: #1a335f;
          font-weight: 800;
        }
        .employee-sub {
          margin-top: 8px;
          color: #5e7094;
          font-size: 14px;
          max-width: 720px;
        }
        .meta-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }
        .meta-chip {
          background: #eef3ff;
          border: 1px solid #d7e3ff;
          color: #2b4f95;
          font-size: 12px;
          font-weight: 700;
          border-radius: 999px;
          padding: 6px 12px;
        }
        .employee-layout {
          display: grid;
          grid-template-columns: 220px minmax(0, 1fr);
          gap: 14px;
          align-items: start;
        }
        .employee-nav {
          background: #fff;
          border: 1px solid #e4ebfa;
          border-radius: 16px;
          box-shadow: 0 12px 24px rgba(21, 44, 95, 0.07);
          padding: 12px;
          position: sticky;
          top: 18px;
        }
        .employee-nav-title {
          margin: 2px 2px 10px;
          color: #65789f;
          font-size: 11px;
          letter-spacing: 0.45px;
          font-weight: 800;
        }
        .employee-nav-link {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          border-radius: 10px;
          border: 1px solid transparent;
          background: #f7faff;
          color: #274577;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          padding: 9px 10px;
          margin-bottom: 7px;
          transition: all 0.2s ease;
        }
        .employee-nav-link:hover {
          border-color: #d5e3ff;
          background: #edf4ff;
        }
        .employee-nav-index {
          width: 21px;
          height: 21px;
          border-radius: 999px;
          background: #d9e8ff;
          color: #2553a5;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 800;
          flex-shrink: 0;
        }
        .employee-content {
          display: grid;
          gap: 14px;
        }
        .ed-card {
          background: #fff;
          border: 1px solid #e4ebfa;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 12px 24px rgba(17, 38, 80, 0.07);
        }
        .ed-card h3 {
          margin: 0 0 12px;
          font-size: 18px;
          color: #1d3a6f;
        }
        .ed-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 13px;
        }
        .ed-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .ed-field.full {
          grid-column: 1 / -1;
        }
        .ed-field span {
          font-size: 12px;
          color: #62769d;
          font-weight: 700;
        }
        .ed-input {
          width: 100%;
          border: 1px solid #d8e1f3;
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 14px;
          color: #1a2e57;
          background: #fcfdff;
          box-sizing: border-box;
        }
        .ed-input:focus {
          outline: none;
          border-color: #6f99ed;
          box-shadow: 0 0 0 3px rgba(75, 122, 219, 0.15);
        }
        .ed-input[readonly] {
          background: #f6f8fc;
          color: #7a879f;
        }
        .ed-checkbox {
          margin-top: 14px;
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #28447f;
          font-weight: 700;
        }
        .ed-actions {
          position: sticky;
          bottom: 0;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          background: rgba(248, 252, 255, 0.95);
          backdrop-filter: blur(4px);
          border: 1px solid #dfe7f9;
          border-radius: 14px;
          padding: 12px;
          margin-top: 6px;
          box-shadow: 0 8px 20px rgba(19, 44, 91, 0.08);
        }
        .ed-btn {
          border: none;
          border-radius: 10px;
          padding: 10px 16px;
          font-weight: 700;
          cursor: pointer;
        }
        .ed-btn.secondary { background: #ecf1ff; color: #29457c; }
        .ed-btn.primary { background: #356fda; color: #fff; }
        .ed-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .ed-error {
          background: #fff0f1;
          color: #b32736;
          border: 1px solid #ffc8ce;
          padding: 10px 12px;
          border-radius: 10px;
          margin-bottom: 12px;
          font-weight: 700;
          font-size: 13px;
        }
        .ed-loading {
          padding: 30px;
          text-align: center;
          color: #4f6694;
          font-weight: 700;
        }
        @media (max-width: 1100px) {
          .employee-layout {
            grid-template-columns: 1fr;
          }
          .employee-nav {
            position: static;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }
          .employee-nav-title {
            grid-column: 1 / -1;
            margin-bottom: 2px;
          }
          .employee-nav-link {
            margin-bottom: 0;
          }
        }
        @media (max-width: 900px) {
          .ed-grid { grid-template-columns: 1fr; }
          .employee-page-bg { padding: 10px; }
        }
      `}</style>

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
            <Link className="sidebar-btn" to="/employees" style={{ backgroundColor: '#4b6cb7', color: 'white' }}> <FaChalkboardTeacher /> Employees</Link>
            <Link className="sidebar-btn" to="/register"> <FaFileAlt /> Registration</Link>
            <button className="logout-btn" onClick={() => { localStorage.removeItem('admin'); window.location.href = '/login' }}>Logout</button>
          </div>
        </aside>

        <main className="google-main">
          <div className="employee-detail-shell">
            <div className="employee-page-bg">
              <div className="employee-head">
                <h1>{displayName}</h1>
                <p className="employee-sub">Full employee profile with editable sections and complete record visibility.</p>
                <div className="meta-row">
                  <span className="meta-chip">Record: {id}</span>
                  {meta.userId ? <span className="meta-chip">User: {meta.userId}</span> : null}
                  {meta.teacherId ? <span className="meta-chip">Teacher ID: {meta.teacherId}</span> : null}
                  {meta.managementId ? <span className="meta-chip">Management ID: {meta.managementId}</span> : null}
                  {meta.financeId ? <span className="meta-chip">Finance ID: {meta.financeId}</span> : null}
                  {meta.hrId ? <span className="meta-chip">HR ID: {meta.hrId}</span> : null}
                </div>
              </div>

              {error ? <div className="ed-error">{error}</div> : null}
              {loading ? (
                <div className="ed-card ed-loading">Loading employee information...</div>
              ) : (
                <>
                  <div className="employee-layout">
                    <aside className="employee-nav">
                      <p className="employee-nav-title">SECTION NAVIGATION</p>
                      {SECTION_ORDER.map((section, index) => (
                        <a key={section.key} href={`#section-${section.key}`} className="employee-nav-link">
                          <span className="employee-nav-index">{index + 1}</span>
                          <span>{section.label}</span>
                        </a>
                      ))}
                    </aside>

                    <div className="employee-content">
                      {SECTION_ORDER.map(section => (
                        <section key={section.key} id={`section-${section.key}`} className="ed-card">
                          <h3>{section.label}</h3>
                          <div className="ed-grid">
                            {(FIELD_CONFIG[section.key] || []).map(field => renderField(section.key, field))}
                          </div>
                        </section>
                      ))}
                    </div>
                  </div>

                  <div className="ed-actions">
                    <button className="ed-btn secondary" onClick={() => navigate('/employees')}>Back to Employees</button>
                    <button className="ed-btn primary" onClick={saveEmployee} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
