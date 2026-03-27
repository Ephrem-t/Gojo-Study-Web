import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import Sidebar from "../components/Sidebar"
import TopNavbar from '../components/TopNavbar';

import { BACKEND_BASE } from "../config.js"


export default function Register() {
  const API_BASE = `${BACKEND_BASE}`
  const [admin] = useState(JSON.parse(localStorage.getItem("admin")) || {})
  const [selectedFile, setSelectedFile] = useState(null)
  const [selectedCertFile, setSelectedCertFile] = useState(null)

  const [selectedRole, setSelectedRole] = useState("")
  const [activeSection, setActiveSection] = useState("personal")

  const navigate = useNavigate()

  const sections = [
    { key: 'personal', label: 'Personal' },
    { key: 'contact', label: 'Contact' },
    { key: 'education', label: 'Education' },
    { key: 'family', label: 'Family' },
    { key: 'job', label: 'Job' },
    { key: 'financial', label: 'Financial' }
  ]

  const [formData, setFormData] = useState({
    personal: { employeeId: '', firstName: '', middleName: '', lastName: '', password: '', dob: '', placeOfBirth: '', nationality: '', gender: '', nationalId: '', profileImageName: '', bloodGroup: '', religion: '', disabilityStatus: '' },
    contact: { phone1: '', phone2: '', email: '', altEmail: '', address: '', city: '', subCity: '', woreda: '' },
    education: { highestQualification: '', degreeType: '', fieldOfStudy: '', institution: '', graduationYear: '', gpa: '', additionalCertifications: '', professionalLicenseNumber: '', workExperience: '' },
    family: { maritalStatus: '', spouseName: '', spouseOccupation: '', numChildren: '', childrenNames: '', fatherName: '', motherName: '' },
    job: { department: '', position: '', employmentType: '', employeeCategory: '', hireDate: '', contractStartDate: '', contractEndDate: '', workLocation: '', reportingManager: '', workShift: '', status: '' },
    financial: { basicSalary: '', allowances: '', overtimeRate: '', bonusEligibility: false, bankName: '', bankBranch: '', accountNumber: '', accountHolderName: '', paymentMethod: '' }
  })

  function setFormValue(section, key, value) {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] || {}),
        [key]: value
      }
    }))
  }

  const [submitting, setSubmitting] = useState(false)

  const currentIndex = Math.max(0, sections.findIndex(s => s.key === activeSection))
  const lastIndex = sections.length - 1
  const progressPercent = Math.round(((currentIndex + 1) / sections.length) * 100)

  function goToPrevSection() { if (currentIndex > 0) setActiveSection(sections[currentIndex - 1].key) }
  function goToNextSection() { if (currentIndex < lastIndex) setActiveSection(sections[currentIndex + 1].key) }

  async function handleSubmitRegistration() {
    setSubmitting(true)
    try {
      if (!selectedRole) {
        throw new Error('Please select a role before submitting.')
      }

      const payload = new FormData()
      payload.append('role', selectedRole)
      payload.append('name', `${formData.personal.firstName || ''} ${formData.personal.middleName || ''} ${formData.personal.lastName || ''}`.trim())
      payload.append('password', formData.personal.password || 'password123')
      payload.append('email', formData.contact.email || '')
      payload.append('phone', formData.contact.phone1 || '')
      payload.append('profileData', JSON.stringify(formData))

      if (selectedFile) {
        payload.append('profile', selectedFile)
      }
      if (selectedCertFile) {
        payload.append('additionalCert', selectedCertFile)
      }

      await axios.post(`${API_BASE}/register/${selectedRole}`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setSubmitting(false)
      // navigate back to employees list
      navigate('/employees')
    } catch (e) {
      setSubmitting(false)
      console.error(e)
      const serverError = e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Registration failed'
      alert(serverError)
    }
  }

  const roleOptions = ['Teacher', 'Management', 'Finance', 'HR', 'Other']
  const activeSectionLabel = sections.find(section => section.key === activeSection)?.label || 'Section'

  return (
    <div className="dashboard-page" style={{ minHeight: '100vh' }}>
      <style>{`
        .register-shell {
          width: 100%;
        }

        .register-hero {
          background: linear-gradient(135deg, #f8fbff 0%, #eef4ff 42%, #f4f9ff 100%);
          border: 1px solid #e3ebff;
          border-radius: 18px;
          padding: 24px;
          box-shadow: 0 10px 30px rgba(25, 55, 110, 0.08);
          margin-bottom: 22px;
        }

        .register-title {
          margin: 0 0 6px;
          font-size: 24px;
          font-weight: 800;
          color: #18243f;
        }

        .register-subtitle {
          margin: 0;
          font-size: 14px;
          color: #5e6c84;
        }

        .role-pill-wrap {
          margin-top: 18px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .role-pill {
          border: 1px solid #d8e3ff;
          background: #fff;
          color: #224177;
          border-radius: 999px;
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .role-pill:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 16px rgba(30, 64, 175, 0.15);
        }

        .role-pill.active {
          background: linear-gradient(135deg, #1f6fe5, #2952cc);
          color: #fff;
          border-color: #2952cc;
        }

        .role-reset {
          border: none;
          background: transparent;
          color: #4c63a8;
          font-weight: 700;
          cursor: pointer;
          padding: 10px 4px;
        }

        .register-layout {
          display: flex;
          gap: 18px;
          align-items: flex-start;
          width: 100%;
        }

        .register-left {
          width: 260px;
          min-width: 240px;
          background: #fff;
          border: 1px solid #e8ecf7;
          border-radius: 16px;
          padding: 18px;
          box-shadow: 0 12px 24px rgba(20, 36, 77, 0.06);
          position: sticky;
          top: 20px;
        }

        .section-title {
          margin: 0 0 10px;
          font-size: 13px;
          color: #6b7895;
          font-weight: 700;
          letter-spacing: 0.4px;
        }

        .section-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px 12px;
          border-radius: 12px;
          border: 1px solid transparent;
          background: #f8faff;
          cursor: pointer;
          text-align: left;
          font-weight: 700;
          color: #1f3056;
          margin-bottom: 8px;
          transition: all 0.2s ease;
        }

        .section-btn:hover {
          background: #f0f5ff;
          border-color: #d7e4ff;
        }

        .section-btn.active {
          background: #e9f1ff;
          border-color: #aac6ff;
          color: #173f8f;
          box-shadow: inset 0 0 0 1px rgba(52, 106, 209, 0.12);
        }

        .section-index {
          width: 24px;
          height: 24px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #dce8ff;
          color: #274b95;
          font-size: 12px;
          font-weight: 800;
          flex-shrink: 0;
        }

        .form-card {
          flex: 1;
          background: #fff;
          border: 1px solid #e7ebf5;
          padding: 26px;
          border-radius: 16px;
          box-shadow: 0 14px 30px rgba(23, 42, 87, 0.07);
          min-width: 0;
        }

        .form-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 18px;
        }

        .form-card h3 {
          margin: 0;
          font-size: 22px;
          color: #152b52;
        }

        .chip {
          font-size: 12px;
          font-weight: 800;
          color: #3159a8;
          background: #edf3ff;
          border: 1px solid #d5e2ff;
          border-radius: 999px;
          padding: 6px 10px;
        }

        .progress-wrap {
          margin-bottom: 18px;
        }

        .progress-meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
          font-size: 12px;
          color: #6e7f9f;
          font-weight: 700;
        }

        .progress-track {
          width: 100%;
          height: 9px;
          border-radius: 999px;
          background: #e9efff;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #3574e8, #4f9dff);
          transition: width 0.25s ease;
        }

        .fields-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .fields-grid .full-width {
          grid-column: 1 / -1;
        }

        .fields-grid .checkbox-row {
          min-height: 44px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 6px;
        }

        .file-label {
          display: block;
          margin-bottom: 6px;
          font-size: 12px;
          font-weight: 700;
          color: #5a6d95;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 20px;
          padding-top: 14px;
          border-top: 1px solid #eef2fb;
        }

        @media (max-width: 1080px) {
          .register-layout {
            flex-direction: column;
          }

          .register-left {
            width: 100%;
            min-width: 0;
            position: static;
          }
        }

        @media (max-width: 760px) {
          .fields-grid {
            grid-template-columns: 1fr;
          }

          .register-hero {
            padding: 20px;
          }

          .form-card {
            padding: 20px;
          }
        }
      `}</style>
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

        <main className="google-main" style={{ flex: '1.08 1 0', minWidth: 0, maxWidth: 'none', margin: '0', boxSizing: 'border-box', alignSelf: 'flex-start', height: 'calc(100vh - var(--topbar-height, 56px) - 36px)', maxHeight: 'calc(100vh - var(--topbar-height, 56px) - 36px)', overflowY: 'auto', position: 'relative', padding: '0 2px 18px' }}>
          <div className="register-shell">
            <div className="register-hero">
              <h3 className="register-title">Employee Registration Workspace</h3>
              <p className="register-subtitle">Choose a role and complete each section to create a polished employee profile.</p>
              {selectedRole === 'other' ? (
                <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 12, border: '1px solid #dbeafe', background: '#eff6ff', color: '#1e3a8a', fontSize: 12, fontWeight: 700 }}>
                  Other employees are stored only in the Employees node. No Users or role nodes will be created.
                </div>
              ) : null}
              <div className="role-pill-wrap">
                {roleOptions.map((role) => {
                  const roleValue = role.toLowerCase()
                  const isSelected = selectedRole === roleValue
                  return (
                    <button
                      key={role}
                      onClick={() => setSelectedRole(roleValue)}
                      className={`role-pill ${isSelected ? 'active' : ''}`}
                    >
                      {role}
                    </button>
                  )
                })}
                {selectedRole && <button onClick={() => setSelectedRole("")} className="role-reset">Reset role</button>}
              </div>
            </div>

            {selectedRole && (
              <div className="register-layout">
                <div className="register-left">
                  <p className="section-title">FORM SECTIONS</p>
                  {sections.map((section, index) => (
                    <button
                      key={section.key}
                      className={`section-btn ${activeSection === section.key ? 'active' : ''}`}
                      onClick={() => setActiveSection(section.key)}
                    >
                      <span className="section-index">{index + 1}</span>
                      <span>{section.label}</span>
                    </button>
                  ))}
                </div>

                <div className="form-card">
                  <div className="form-card-header">
                    <h3>{activeSectionLabel} Details</h3>
                    <span className="chip">{selectedRole.toUpperCase()}</span>
                  </div>

                  <div className="progress-wrap">
                    <div className="progress-meta">
                      <span>Step {currentIndex + 1} of {sections.length}</span>
                      <span>{progressPercent}% Completed</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>

                {activeSection === 'personal' && (
                  <div className="fields-grid">
                    <input placeholder="Employee ID (auto-generated)" className="form-input" value={formData.personal.employeeId} readOnly />
                    <input placeholder="First Name" className="form-input" value={formData.personal.firstName} onChange={(e) => setFormValue('personal', 'firstName', e.target.value)} />
                    <input placeholder="Middle Name" className="form-input" value={formData.personal.middleName} onChange={(e) => setFormValue('personal', 'middleName', e.target.value)} />
                    <input placeholder="Last Name" className="form-input" value={formData.personal.lastName} onChange={(e) => setFormValue('personal', 'lastName', e.target.value)} />
                    <input type="password" placeholder="Password" className="form-input" value={formData.personal.password} onChange={(e) => setFormValue('personal', 'password', e.target.value)} />
                    <input type="date" className="form-input" value={formData.personal.dob} onChange={(e) => setFormValue('personal', 'dob', e.target.value)} />
                    <input placeholder="Place of Birth" className="form-input" value={formData.personal.placeOfBirth} onChange={(e) => setFormValue('personal', 'placeOfBirth', e.target.value)} />
                    <input placeholder="Nationality" className="form-input" value={formData.personal.nationality} onChange={(e) => setFormValue('personal', 'nationality', e.target.value)} />
                    <select className="form-input" value={formData.personal.gender} onChange={(e) => setFormValue('personal', 'gender', e.target.value)}><option value="">Gender</option><option value="male">Male</option><option value="female">Female</option></select>
                    <input placeholder="National ID Number (optional)" className="form-input" value={formData.personal.nationalId} onChange={(e) => setFormValue('personal', 'nationalId', e.target.value)} />
                    <input type="file" accept="image/*" className="form-input full-width" onChange={(e) => { const f = e.target.files[0]; if(f) { setSelectedFile(f); setFormValue('personal','profileImageName', f.name); } }} />
                    <input placeholder="Blood Group (optional)" className="form-input" value={formData.personal.bloodGroup} onChange={(e) => setFormValue('personal', 'bloodGroup', e.target.value)} />
                    <input placeholder="Religion (optional)" className="form-input" value={formData.personal.religion} onChange={(e) => setFormValue('personal', 'religion', e.target.value)} />
                    <input placeholder="Disability Status (optional)" className="form-input full-width" value={formData.personal.disabilityStatus} onChange={(e) => setFormValue('personal', 'disabilityStatus', e.target.value)} />
                  </div>
                )}

                {activeSection === 'contact' && (
                  <div className="fields-grid">
                    <input placeholder="Primary Phone Number" className="form-input" value={formData.contact.phone1} onChange={(e) => setFormValue('contact','phone1', e.target.value)} />
                    <input placeholder="Secondary Phone Number" className="form-input" value={formData.contact.phone2} onChange={(e) => setFormValue('contact','phone2', e.target.value)} />
                    <input placeholder="Email Address" className="form-input" value={formData.contact.email} onChange={(e) => setFormValue('contact','email', e.target.value)} />
                    <input placeholder="Alternative Email (optional)" className="form-input" value={formData.contact.altEmail} onChange={(e) => setFormValue('contact','altEmail', e.target.value)} />
                    <textarea placeholder="Current Address" className="form-input full-width" value={formData.contact.address} onChange={(e) => setFormValue('contact','address', e.target.value)} />
                    <input placeholder="City" className="form-input" value={formData.contact.city} onChange={(e) => setFormValue('contact','city', e.target.value)} />
                    <input placeholder="Sub City" className="form-input" value={formData.contact.subCity} onChange={(e) => setFormValue('contact','subCity', e.target.value)} />
                    <input placeholder="Woreda" className="form-input" value={formData.contact.woreda} onChange={(e) => setFormValue('contact','woreda', e.target.value)} />
                  </div>
                )}

                {activeSection === 'education' && (
                  <div className="fields-grid">
                    <input placeholder="Highest Qualification" className="form-input" value={formData.education.highestQualification} onChange={(e) => setFormValue('education','highestQualification', e.target.value)} />
                    <select className="form-input" value={formData.education.degreeType} onChange={(e) => setFormValue('education','degreeType', e.target.value)}>
                      <option value="">Degree Type</option>
                      <option value="Diploma">Diploma</option>
                      <option value="BSc">BSc</option>
                      <option value="MSc">MSc</option>
                      <option value="PhD">PhD</option>
                    </select>
                    <input placeholder="Field of Study" className="form-input" value={formData.education.fieldOfStudy} onChange={(e) => setFormValue('education','fieldOfStudy', e.target.value)} />
                    <input placeholder="Institution Name" className="form-input" value={formData.education.institution} onChange={(e) => setFormValue('education','institution', e.target.value)} />
                    <input placeholder="Year of Graduation" className="form-input" value={formData.education.graduationYear} onChange={(e) => setFormValue('education','graduationYear', e.target.value)} />
                    <input placeholder="GPA" className="form-input" value={formData.education.gpa} onChange={(e) => setFormValue('education','gpa', e.target.value)} />
                    <input placeholder="Additional Certifications (comma separated)" className="form-input full-width" value={formData.education.additionalCertifications} onChange={(e) => setFormValue('education','additionalCertifications', e.target.value)} />
                    <input placeholder="Professional License Number (optional)" className="form-input full-width" value={formData.education.professionalLicenseNumber} onChange={(e) => setFormValue('education','professionalLicenseNumber', e.target.value)} />
                    <textarea placeholder="Work Experience (brief)" className="form-input full-width" value={formData.education.workExperience} onChange={(e) => setFormValue('education','workExperience', e.target.value)} />
                    <div className="full-width">
                      <label className="file-label">Additional Certifications (PDF)</label>
                      <input type="file" accept="application/pdf" className="form-input" onChange={(e) => { const f = e.target.files[0]; if(f) setSelectedCertFile(f); }} />
                    </div>
                  </div>
                )}

                {activeSection === 'family' && (
                  <div className="fields-grid">
                    <input placeholder="Marital Status (optional)" className="form-input" value={formData.family.maritalStatus} onChange={(e) => setFormValue('family','maritalStatus', e.target.value)} />
                    <input placeholder="Spouse Name (optional)" className="form-input" value={formData.family.spouseName} onChange={(e) => setFormValue('family','spouseName', e.target.value)} />
                    <input placeholder="Spouse Occupation (optional)" className="form-input" value={formData.family.spouseOccupation} onChange={(e) => setFormValue('family','spouseOccupation', e.target.value)} />
                    <input placeholder="Number of Children (optional)" className="form-input" value={formData.family.numChildren} onChange={(e) => setFormValue('family','numChildren', e.target.value)} />
                    <input placeholder="Children Names (comma separated) (optional)" className="form-input full-width" value={formData.family.childrenNames} onChange={(e) => setFormValue('family','childrenNames', e.target.value)} />
                    <input placeholder="Father's Name" className="form-input" value={formData.family.fatherName} onChange={(e) => setFormValue('family','fatherName', e.target.value)} />
                    <input placeholder="Mother's Name" className="form-input" value={formData.family.motherName} onChange={(e) => setFormValue('family','motherName', e.target.value)} />
                  </div>
                )}

                {activeSection === 'job' && (
                  <div className="fields-grid">
                    <input placeholder="Department" className="form-input" value={formData.job.department} onChange={(e) => setFormValue('job','department', e.target.value)} />
                    <input placeholder="Position / Title" className="form-input" value={formData.job.position} onChange={(e) => setFormValue('job','position', e.target.value)} />
                    <select className="form-input" value={formData.job.employmentType} onChange={(e) => setFormValue('job','employmentType', e.target.value)}>
                      <option value="">Employment Type</option>
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Contract">Contract</option>
                    </select>
                    <select className="form-input" value={formData.job.employeeCategory} onChange={(e) => setFormValue('job','employeeCategory', e.target.value)}>
                      <option value="">Employee Category</option>
                      <option value="Teacher">Teacher</option>
                      <option value="Director">Director</option>
                      <option value="Vice Director">Vice Director</option>
                      <option value="Finance">Finance</option>
                      <option value="HR">HR</option>
                      <option value="Administrative">Administrative</option>
                      <option value="Management">Management</option>
                      <option value="Other">Other</option>
                    </select>
                    <input placeholder="Hire Date" type="date" className="form-input" value={formData.job.hireDate} onChange={(e) => setFormValue('job','hireDate', e.target.value)} />
                    <input placeholder="Contract Start Date" type="date" className="form-input" value={formData.job.contractStartDate} onChange={(e) => setFormValue('job','contractStartDate', e.target.value)} />
                    <input placeholder="Contract End Date" type="date" className="form-input" value={formData.job.contractEndDate} onChange={(e) => setFormValue('job','contractEndDate', e.target.value)} />
                    <input placeholder="Work Location" className="form-input" value={formData.job.workLocation} onChange={(e) => setFormValue('job','workLocation', e.target.value)} />
                    <input placeholder="Reporting Manager" className="form-input" value={formData.job.reportingManager} onChange={(e) => setFormValue('job','reportingManager', e.target.value)} />
                    <input placeholder="Work Shift" className="form-input" value={formData.job.workShift} onChange={(e) => setFormValue('job','workShift', e.target.value)} />
                    <select className="form-input" value={formData.job.status} onChange={(e) => setFormValue('job','status', e.target.value)}>
                      <option value="">Status</option>
                      <option value="Active">Active</option>
                      <option value="On Leave">On Leave</option>
                      <option value="Terminated">Terminated</option>
                    </select>
                  </div>
                )}

                {activeSection === 'financial' && (
                  <div className="fields-grid">
                    <input placeholder="Basic Salary (optional)" className="form-input" value={formData.financial.basicSalary} onChange={(e) => setFormValue('financial','basicSalary', e.target.value)} />
                    <input placeholder="Allowances (optional)" className="form-input" value={formData.financial.allowances} onChange={(e) => setFormValue('financial','allowances', e.target.value)} />
                    <input placeholder="Overtime Rate (optional)" className="form-input" value={formData.financial.overtimeRate} onChange={(e) => setFormValue('financial','overtimeRate', e.target.value)} />
                    <div className="checkbox-row">
                      <input type="checkbox" checked={formData.financial.bonusEligibility} onChange={(e) => setFormValue('financial','bonusEligibility', e.target.checked)} />
                      <label style={{margin:0}}>Bonus Eligibility</label>
                    </div>
                    <input placeholder="Bank Name (optional)" className="form-input" value={formData.financial.bankName} onChange={(e) => setFormValue('financial','bankName', e.target.value)} />
                    <input placeholder="Bank Branch (optional)" className="form-input" value={formData.financial.bankBranch} onChange={(e) => setFormValue('financial','bankBranch', e.target.value)} />
                    <input placeholder="Account Number (optional)" className="form-input" value={formData.financial.accountNumber} onChange={(e) => setFormValue('financial','accountNumber', e.target.value)} />
                    <input placeholder="Account Holder Name (optional)" className="form-input" value={formData.financial.accountHolderName} onChange={(e) => setFormValue('financial','accountHolderName', e.target.value)} />
                    <select className="form-input" value={formData.financial.paymentMethod} onChange={(e) => setFormValue('financial','paymentMethod', e.target.value)}>
                      <option value="">Payment Method</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>
                )}

                <div className="form-actions">
                  {currentIndex > 0 && (<button className="secondary-btn" onClick={goToPrevSection}>Back</button>)}
                  {currentIndex < lastIndex ? (<button className="submit-btn" onClick={goToNextSection}>Next</button>) : (<button className="submit-btn" onClick={handleSubmitRegistration} disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Registration'}</button>)}
                </div>
              </div>
            </div>
          )}
          </div>
        </main>
      </div>
    </div>
  )
}
