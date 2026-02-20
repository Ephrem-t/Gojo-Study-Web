import React, { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  FaHome,
  FaChalkboardTeacher,
  FaCog,
  FaSignOutAlt,
  FaBell,
  FaFacebookMessenger,
} from "react-icons/fa"
import axios from "axios"

import { BACKEND_BASE } from "../config.js"

export default function Register() {
  const API_BASE = `${BACKEND_BASE}`
  const [admin, setAdmin] = useState(JSON.parse(localStorage.getItem("admin")) || {})
  const [selectedFile, setSelectedFile] = useState(null)
  const [selectedCertFile, setSelectedCertFile] = useState(null)
  const [profileImage, setProfileImage] = useState(admin.profileImage || "/default-profile.png")
 

  const [selectedRole, setSelectedRole] = useState("")
  const [activeSection, setActiveSection] = useState("personal")

  const [formData, setFormData] = useState({
    personal: {
      employeeId: "",
      password: "",
      firstName: "",
      middleName: "",
      lastName: "",
      dob: "",
      gender: "",
      placeOfBirth: "",
      nationality: "",
      nationalId: "",
      profileImageName: "",
      bloodGroup: "",
      religion: "",
      disabilityStatus: "",
    },
    contact: {
      phone1: "",
      phone2: "",
      email: "",
      altEmail: "",
      address: "",
      city: "",
      subCity: "",
      woreda: "",
    },
    education: {
      highestQualification: "",
      degreeType: "",
      fieldOfStudy: "",
      institution: "",
      graduationYear: "",
      gpa: "",
      additionalCertifications: "",
      professionalLicenseNumber: "",
      workExperience: "",
    },
    family: {
      maritalStatus: "",
      spouseName: "",
      spouseOccupation: "",
      numChildren: "",
      childrenNames: "",
      fatherName: "",
      motherName: "",
    },
    job: {
      department: "",
      position: "",
      employmentType: "",
      employeeCategory: "",
      hireDate: "",
      contractStartDate: "",
      contractEndDate: "",
      workLocation: "",
      reportingManager: "",
      workShift: "",
      status: "",
     
    },
    financial: {
      basicSalary: "",
      allowances: "",
      overtimeRate: "",
      bonusEligibility: false,
      bankName: "",
      bankBranch: "",
      accountNumber: "",
      accountHolderName: "",
      paymentMethod: "",
    },
  })

  const setFormValue = (section, key, value) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }))
  }

  const navigate = useNavigate()

  const sections = [
    { key: "personal", label: "Personal Info" },
    { key: "contact", label: "Contact Info" },
    { key: "education", label: "Education Qualification" },
    { key: "family", label: "Family Details" },
    { key: "job", label: "Job Details" },
    { key: "financial", label: "Financial Details" },
  ]

  const sectionKeys = sections.map((s) => s.key)
  const currentIndex = sectionKeys.indexOf(activeSection)
  const lastIndex = sectionKeys.length - 1
  const goToNextSection = () => {
    const idx = sectionKeys.indexOf(activeSection)
    if (idx < sectionKeys.length - 1) setActiveSection(sectionKeys[idx + 1])
  }
  const goToPrevSection = () => {
    const idx = sectionKeys.indexOf(activeSection)
    if (idx > 0) setActiveSection(sectionKeys[idx - 1])
  }

  const [submitting, setSubmitting] = useState(false)

  const handleSubmitRegistration = async () => {
    try {
      setSubmitting(true)

      const fullName = [
        formData.personal.firstName,
        formData.personal.middleName,
        formData.personal.lastName,
      ]
        .filter(Boolean)
        .join(" ")

      let url = ""
      const fd = new FormData()

      fd.append("name", fullName || formData.personal.firstName || "")
      fd.append("password", formData.personal.password || formData.job.employeeId || formData.personal.employeeId || "password123")
      fd.append("email", formData.contact.email || "")
      fd.append("phone", formData.contact.phone1 || "")
      fd.append("gender", formData.personal.gender || "")

      if (selectedFile) fd.append("profile", selectedFile)
      if (selectedCertFile) fd.append("additionalCert", selectedCertFile)

      if (selectedRole === "management") {
        url = `${API_BASE}/register/management`
        fd.append("department", formData.job.department || "")
      } else if (selectedRole === "finance") {
        url = `${API_BASE}/register/finance`
        fd.append("bankName", formData.financial.bankName || "")
        fd.append("accountNumber", formData.financial.accountNumber || "")
      } else if (selectedRole === "hr") {
        url = `${API_BASE}/register/hr`
        fd.append("title", formData.job.hrPosition || formData.job.position || "")
      } else if (selectedRole === "teacher") {
        url = `${API_BASE}/register/teacher`
        
        
      } else {
        fd.append("profileData", JSON.stringify(formData))
        fd.append("role", selectedRole)
        alert("Unknown role selected.")
        setSubmitting(false)
        return
      }

      fd.append("profileData", JSON.stringify(formData))
      fd.append("role", selectedRole)

      const res = await axios.post(url, fd, { headers: { "Content-Type": "multipart/form-data" } })

      if (res?.data) {
        alert(res.data.message || "Registration successful")
        // reset
        setFormData({
          personal: { employeeId: "", password: "", firstName: "", middleName: "", lastName: "", dob: "", gender: "", placeOfBirth: "", nationality: "", nationalId: "", profileImageName: "", bloodGroup: "", religion: "", disabilityStatus: "" },
          contact: { phone1: "", phone2: "", email: "", altEmail: "", address: "", city: "", subCity: "", woreda: "" },
          education: { highestQualification: "", degreeType: "", fieldOfStudy: "", institution: "", graduationYear: "", gpa: "", additionalCertifications: "", professionalLicenseNumber: "", workExperience: "" },
          family: { maritalStatus: "", spouseName: "", spouseOccupation: "", numChildren: "", childrenNames: "", fatherName: "", motherName: "" },
          job: { department: "", position: "", employmentType: "", employeeCategory: "", hireDate: "", contractStartDate: "", contractEndDate: "", workLocation: "", reportingManager: "", workShift: "", status: "" },
          financial: { basicSalary: "", allowances: "", overtimeRate: "", bonusEligibility: false, bankName: "", bankBranch: "", accountNumber: "", accountHolderName: "", paymentMethod: "" },
        })
        setSelectedRole("")
        setActiveSection("personal")
        setSelectedFile(null)
        setSelectedCertFile(null)
        navigate("/teachers")
      } else {
        alert("Registration failed")
      }
    } catch (err) {
      console.error("Registration error:", err?.response || err)
      alert((err?.response?.data?.message) || "Registration failed, see console.")
    } finally {
      setSubmitting(false)
    }
  }

  // simple unread/post notification wiring from previous component is intentionally omitted for brevity

  useEffect(() => { /* placeholder for fetching notifications if needed */ }, [])

  return (
    <div className="dashboard-page">
      <nav className="top-navbar" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Gojo Dashboard</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ cursor: 'pointer' }}><FaBell /></div>
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/all-chat')}><FaFacebookMessenger /></div>
          <Link to="/settings"><FaCog /></Link>
          <img src={admin.profileImage || '/default-profile.png'} alt="admin" style={{ width: 36, height: 36, borderRadius: '50%' }} />
        </div>
      </nav>

      <div style={{ display: 'flex' }}>
        <div style={{ width: 220, padding: 10 }}>
          <div style={{ textAlign: 'center', padding: 12 }}>
            <img src={admin?.profileImage || '/default-profile.png'} alt="profile" style={{ width: 64, height: 64, borderRadius: '50%' }} />
            <h3 style={{ margin: 6 }}>{admin?.name || 'Admin Name'}</h3>
            <p style={{ margin: 0, color: '#666' }}>{admin?.adminId || 'username'}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link to="/dashboard">Home</Link>
            <Link to="/teachers">Teachers</Link>
            <Link to="/register" style={{ backgroundColor: '#4b6cb7', color: '#fff', padding: 8, borderRadius: 8 }}>Registration</Link>
            <button onClick={() => { localStorage.removeItem('admin'); window.location.href = '/login' }}>Logout</button>
          </div>
        </div>

        <div style={{ padding: 25, flex: 1 }}>
          <div style={{ background: '#fff', padding: '20px 24px', borderRadius: 12, textAlign: 'center', boxShadow: '0 8px 30px rgba(2,6,23,0.04)' }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Select Employee Type</h3>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 14 }}>
              {["Teacher", "Management", "Finance"].map((role) => (
                <button key={role} onClick={() => setSelectedRole(role.toLowerCase())} style={{ padding: '10px 18px', borderRadius: 10, border: selectedRole === role.toLowerCase() ? '2px solid #2e7d32' : 'none', background: selectedRole === role.toLowerCase() ? '#e6f4ea' : '#2e7d32', color: selectedRole === role.toLowerCase() ? '#0f5132' : '#fff', fontWeight: 700, cursor: 'pointer' }}>{role}</button>
              ))}
              {selectedRole && <button onClick={() => setSelectedRole("")} style={{ marginLeft: 8 }}>Change</button>}
            </div>
          </div>

          {selectedRole && (
            <div className="register-layout" style={{ display: 'flex', gap: 24, alignItems: 'flex-start', marginTop: 18 }}>
              <style>{`.register-left{width:20%;min-width:220px;background:#fff;padding:20px;border-radius:15px;display:flex;flex-direction:column;gap:12px;box-shadow:0 8px 30px rgba(2,6,23,0.06)} .section-btn{width:100%;padding:12px 14px;border-radius:10px;border:none;background:#f5f7fa;cursor:pointer;text-align:left;font-weight:700;color:#0f172a;margin-bottom:8px} .section-btn.active{background:#fff3cd}`}</style>

              <div className="register-left">
                {sections.map((section) => (
                  <button key={section.key} className={`section-btn ${activeSection === section.key ? 'active' : ''}`} onClick={() => setActiveSection(section.key)}>{section.label}</button>
                ))}
              </div>

              <div className="form-card" style={{ width: '75%', background: '#fff', padding: 32, borderRadius: 15, boxShadow: '0 10px 30px rgba(2,6,23,0.06)' }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 18 }}> {activeSection.replace('_', ' ')} Details</h3>

                {/* PERSONAL */}
                {activeSection === 'personal' && (
                  <>
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
                    <input type="file" accept="image/*" className="form-input" onChange={(e) => { const f = e.target.files[0]; if(f) { setSelectedFile(f); setFormValue('personal','profileImageName', f.name); } }} />
                    <input placeholder="Blood Group (optional)" className="form-input" value={formData.personal.bloodGroup} onChange={(e) => setFormValue('personal', 'bloodGroup', e.target.value)} />
                    <input placeholder="Religion (optional)" className="form-input" value={formData.personal.religion} onChange={(e) => setFormValue('personal', 'religion', e.target.value)} />
                    <input placeholder="Disability Status (optional)" className="form-input" value={formData.personal.disabilityStatus} onChange={(e) => setFormValue('personal', 'disabilityStatus', e.target.value)} />
                  </>
                )}

                {/* CONTACT */}
                {activeSection === 'contact' && (
                  <>
                    <input placeholder="Primary Phone Number" className="form-input" value={formData.contact.phone1} onChange={(e) => setFormValue('contact','phone1', e.target.value)} />
                    <input placeholder="Secondary Phone Number" className="form-input" value={formData.contact.phone2} onChange={(e) => setFormValue('contact','phone2', e.target.value)} />
                    <input placeholder="Email Address" className="form-input" value={formData.contact.email} onChange={(e) => setFormValue('contact','email', e.target.value)} />
                    <input placeholder="Alternative Email (optional)" className="form-input" value={formData.contact.altEmail} onChange={(e) => setFormValue('contact','altEmail', e.target.value)} />
                    <textarea placeholder="Current Address" className="form-input" value={formData.contact.address} onChange={(e) => setFormValue('contact','address', e.target.value)} />
                    <input placeholder="City" className="form-input" value={formData.contact.city} onChange={(e) => setFormValue('contact','city', e.target.value)} />
                    <input placeholder="Sub City" className="form-input" value={formData.contact.subCity} onChange={(e) => setFormValue('contact','subCity', e.target.value)} />
                    <input placeholder="Woreda" className="form-input" value={formData.contact.woreda} onChange={(e) => setFormValue('contact','woreda', e.target.value)} />
                  </>
                )}

                {/* EDUCATION */}
                {activeSection === 'education' && (
                  <>
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
                    <input placeholder="Additional Certifications (comma separated)" className="form-input" value={formData.education.additionalCertifications} onChange={(e) => setFormValue('education','additionalCertifications', e.target.value)} />
                    <input placeholder="Professional License Number (optional)" className="form-input" value={formData.education.professionalLicenseNumber} onChange={(e) => setFormValue('education','professionalLicenseNumber', e.target.value)} />
                    <textarea placeholder="Work Experience (brief)" className="form-input" value={formData.education.workExperience} onChange={(e) => setFormValue('education','workExperience', e.target.value)} />
                    <div style={{marginTop:8}}>
                      <label style={{fontSize:13, color:'#555'}}>Additional Certifications (PDF)</label>
                      <input type="file" accept="application/pdf" className="form-input" onChange={(e) => { const f = e.target.files[0]; if(f) setSelectedCertFile(f); }} />
                    </div>
                  </>
                )}

                {/* FAMILY */}
                {activeSection === 'family' && (
                  <>
                    <input placeholder="Marital Status (optional)" className="form-input" value={formData.family.maritalStatus} onChange={(e) => setFormValue('family','maritalStatus', e.target.value)} />
                    <input placeholder="Spouse Name (optional)" className="form-input" value={formData.family.spouseName} onChange={(e) => setFormValue('family','spouseName', e.target.value)} />
                    <input placeholder="Spouse Occupation (optional)" className="form-input" value={formData.family.spouseOccupation} onChange={(e) => setFormValue('family','spouseOccupation', e.target.value)} />
                    <input placeholder="Number of Children (optional)" className="form-input" value={formData.family.numChildren} onChange={(e) => setFormValue('family','numChildren', e.target.value)} />
                    <input placeholder="Children Names (comma separated) (optional)" className="form-input" value={formData.family.childrenNames} onChange={(e) => setFormValue('family','childrenNames', e.target.value)} />
                    <input placeholder="Father's Name" className="form-input" value={formData.family.fatherName} onChange={(e) => setFormValue('family','fatherName', e.target.value)} />
                    <input placeholder="Mother's Name" className="form-input" value={formData.family.motherName} onChange={(e) => setFormValue('family','motherName', e.target.value)} />
                  </>
                )}

                {/* JOB */}
                {activeSection === 'job' && (
                  <>
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
                 </>
                )}

                {/* FINANCIAL */}
                {activeSection === 'financial' && (
                  <>
                    <input placeholder="Basic Salary (optional)" className="form-input" value={formData.financial.basicSalary} onChange={(e) => setFormValue('financial','basicSalary', e.target.value)} />
                    <input placeholder="Allowances (optional)" className="form-input" value={formData.financial.allowances} onChange={(e) => setFormValue('financial','allowances', e.target.value)} />
                    <input placeholder="Overtime Rate (optional)" className="form-input" value={formData.financial.overtimeRate} onChange={(e) => setFormValue('financial','overtimeRate', e.target.value)} />
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
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
                  </>
                )}

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 18 }}>
                  {currentIndex > 0 && (<button className="secondary-btn" onClick={goToPrevSection}>Back</button>)}
                  {currentIndex < lastIndex ? (<button className="submit-btn" onClick={goToNextSection}>Next</button>) : (<button className="submit-btn" onClick={handleSubmitRegistration} disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Registration'}</button>)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
