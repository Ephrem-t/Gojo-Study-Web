import React, { useEffect, useMemo, useState } from 'react'
import { FaArrowLeft, FaDownload, FaIdBadge, FaPrint, FaSave, FaTimes, FaUpload } from 'react-icons/fa'
import api from '../api'
import { getDepartmentsSnapshot, getPositionsSnapshot } from '../hrData'
import { downloadCredentialSlipPdf, hasCredentialSlipData, openCredentialSlipPrint } from '../utils/credentialSlip'

const DEFAULT_FORM = {
  personal: { employeeId: '', firstName: '', middleName: '', lastName: '', dob: '', placeOfBirth: '', nationality: '', gender: '', nationalId: '', profileImageName: '', bloodGroup: '', religion: '', disabilityStatus: '' },
  contact: { phone1: '', phone2: '', email: '', altEmail: '', address: '', city: '', subCity: '', woreda: '', postalCode: '', emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelationship: '' },
  education: { highestQualification: '', degreeType: '', fieldOfStudy: '', institution: '', graduationYear: '', gpa: '', additionalCertifications: '', professionalLicenseNumber: '', workExperience: '' },
  family: { maritalStatus: '', spouseName: '', spouseOccupation: '', numChildren: '', childrenNames: '', fatherName: '', motherName: '' },
  employment: { employeeId: '', departmentId: '', department: '', positionId: '', position: '', employmentType: '', employeeCategory: '', category: '', hireDate: '', contractStartDate: '', contractEndDate: '', workLocation: '', reportingManager: '', workShift: '', status: '', dateJoined: '', financePosition: '', gradeAssigned: '', hrPosition: '', subject: '' },
  financial: { basicSalary: '', allowances: '', overtimeRate: '', bonusEligibility: false, bankName: '', bankBranch: '', accountNumber: '', accountHolderName: '', paymentMethod: '' }
}

const ETHIOPIAN_BANK_OPTIONS = [
  '',
  'Commercial Bank of Ethiopia',
  'Development Bank of Ethiopia',
  'Awash Bank',
  'Bank of Abyssinia',
  'Dashen Bank',
  'Wegagen Bank',
  'United Bank',
  'Nib International Bank',
  'Cooperative Bank of Oromia',
  'Lion International Bank',
  'Zemen Bank',
  'Oromia International Bank',
  'Bunna Bank',
  'Berhan Bank',
  'Abay Bank',
  'Addis International Bank',
  'Debub Global Bank',
  'Enat Bank',
  'Rammis Bank',
  'Hibret Bank',
  'Tsehay Bank',
  'Hijra Bank',
  'Siinqee Bank',
  'Gadaa Bank',
  'Ahadu Bank',
  'Amhara Bank',
  'Shabelle Bank',
  'Goh Betoch Bank',
  'ZamZam Bank',
  'Tsedey Bank'
]

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
    { key: 'profileImageName', label: 'Profile Image', type: 'file', isImage: true },
    { key: 'bloodGroup', label: 'Blood Group', type: 'text' },
    { key: 'religion', label: 'Religion', type: 'text' },
    { key: 'disabilityStatus', label: 'Disability Status', type: 'text', fullWidth: true }
  ],
  contact: [
    { key: 'phone1', label: 'Primary Phone', type: 'text' },
    { key: 'phone2', label: 'Secondary Phone', type: 'text' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'altEmail', label: 'Alternative Email', type: 'email' },
    { key: 'city', label: 'City', type: 'text' },
    { key: 'subCity', label: 'Sub City', type: 'text' },
    { key: 'woreda', label: 'Woreda', type: 'text' },
    { key: 'postalCode', label: 'Postal Code', type: 'text' },
    { key: 'address', label: 'Address', type: 'textarea', fullWidth: true },
    { key: 'emergencyContactName', label: 'Emergency Contact Name', type: 'text' },
    { key: 'emergencyContactPhone', label: 'Emergency Contact Phone', type: 'text' },
    { key: 'emergencyContactRelationship', label: 'Emergency Contact Relationship', type: 'text' }
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
    { key: 'maritalStatus', label: 'Marital Status', type: 'select', options: ['', 'Single', 'Married', 'Divorced', 'Widowed', 'Separated'] },
    { key: 'spouseName', label: 'Spouse Name', type: 'text' },
    { key: 'spouseOccupation', label: 'Spouse Occupation', type: 'text' },
    { key: 'numChildren', label: 'Number of Children', type: 'text' },
    { key: 'childrenNames', label: 'Children Names', type: 'text', fullWidth: true },
    { key: 'fatherName', label: 'Father Name', type: 'text' },
    { key: 'motherName', label: 'Mother Name', type: 'text' }
  ],
  employment: [
    { key: 'employeeId', label: 'Employee ID', type: 'text', readOnly: true },
    { key: 'departmentId', label: 'Department', type: 'select' },
    { key: 'positionId', label: 'Position', type: 'select' },
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
    { key: 'bankName', label: 'Bank Name', type: 'select', options: ETHIOPIAN_BANK_OPTIONS },
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
  { key: 'employment', label: 'Employment Information' },
  { key: 'family', label: 'Family Information' },
  { key: 'financial', label: 'Financial Information' }
]

function normalizeMaritalStatusValue(value) {
  const normalized = String(value || '').trim().toLowerCase()

  if (!normalized) return ''
  if (normalized === 'single') return 'Single'
  if (normalized === 'married') return 'Married'
  if (normalized === 'divorced') return 'Divorced'
  if (normalized === 'widowed') return 'Widowed'
  if (normalized === 'separated') return 'Separated'

  return value || ''
}

function normalizeEmploymentNode(employment = {}, job = {}, fallbackEmployeeId = '') {
  const merged = {
    ...DEFAULT_FORM.employment,
    ...(job || {}),
    ...(employment || {}),
  }
  const employeeId = merged.employeeId || fallbackEmployeeId || ''
  const employeeCategory = merged.employeeCategory || merged.category || ''

  return {
    ...merged,
    employeeId,
    employeeCategory,
    category: merged.category || employeeCategory,
  }
}

function syncStructuredSections(personal = {}, employment = {}, fallbackEmployeeId = '', job = {}) {
  const resolvedEmployeeId = personal?.employeeId || employment?.employeeId || job?.employeeId || fallbackEmployeeId || ''
  const nextPersonal = {
    ...(personal || {}),
    employeeId: resolvedEmployeeId || personal?.employeeId || '',
  }
  const nextEmployment = normalizeEmploymentNode(employment, job, resolvedEmployeeId)

  return {
    personal: nextPersonal,
    employment: nextEmployment,
  }
}

function normalizeEmployeeRecord(data) {
  const profileData = data?.profileData || {}
  const personal = { ...DEFAULT_FORM.personal, ...(data?.personal || profileData.personal || {}) }
  const structuredSections = syncStructuredSections(
    personal,
    data?.employment || profileData.employment || {},
    data?.employeeId || personal?.employeeId || '',
    data?.job || profileData.job || {}
  )

  return {
    ...DEFAULT_FORM,
    personal: { ...DEFAULT_FORM.personal, ...structuredSections.personal },
    contact: { ...DEFAULT_FORM.contact, ...(data?.contact || profileData.contact || {}) },
    education: { ...DEFAULT_FORM.education, ...(data?.education || profileData.education || {}) },
    family: {
      ...DEFAULT_FORM.family,
      ...(data?.family || profileData.family || {}),
      maritalStatus: normalizeMaritalStatusValue((data?.family || profileData.family || {}).maritalStatus),
    },
    employment: structuredSections.employment,
    financial: { ...DEFAULT_FORM.financial, ...(data?.financial || profileData.financial || {}) },
  }
}

function getInitials(name) {
  return (name || 'Employee')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'E'
}

function SummaryChip({ icon: Icon, label }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 34, padding: '0 14px', borderRadius: 999, border: '1px solid #dbe8f6', background: '#f8fbff', color: '#334155', fontSize: 12, fontWeight: 700 }}>
      <Icon style={{ color: '#2563eb', fontSize: 12 }} />
      {label}
    </div>
  )
}

export default function EmployeeDetailPanel({ employeeId, admin = {}, onClose, onSaved, embedded = false }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [meta, setMeta] = useState({})
  const [credentialSlip, setCredentialSlip] = useState(null)
  const [formData, setFormData] = useState(DEFAULT_FORM)
  const [profileImagePreview, setProfileImagePreview] = useState('')
  const [profileImageFile, setProfileImageFile] = useState(null)
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])

  const displayName = useMemo(() => {
    const personal = formData.personal || {}
    return [personal.firstName, personal.middleName, personal.lastName].filter(Boolean).join(' ') || 'Employee'
  }, [formData])

  const quickRole = formData.employment?.employeeCategory || formData.employment?.position || 'Staff'
  const quickDepartment = formData.employment?.department || 'Unassigned'
  const quickPhone = formData.contact?.phone1 || formData.contact?.phone2 || 'No phone'
  const quickEmail = formData.contact?.email || formData.contact?.altEmail || 'No email'
  const quickLocation = formData.employment?.workLocation || formData.contact?.city || 'No location'
  const currentStatus = formData.employment?.status || 'Active'

  const resolvedCredentialSlip = useMemo(() => ({
    name: credentialSlip?.name || displayName,
    role: credentialSlip?.role || quickRole,
    employeeId: credentialSlip?.employeeId || formData.personal?.employeeId || employeeId || '',
    loginUsername: credentialSlip?.loginUsername || '',
    password: credentialSlip?.password || '',
  }), [credentialSlip, displayName, quickRole, formData.personal?.employeeId, employeeId])

  const canUseCredentialSlip = hasCredentialSlipData(resolvedCredentialSlip)

  useEffect(() => {
    if (!employeeId) return
    loadEmployee()
  }, [employeeId])

  useEffect(() => {
    async function loadReferences() {
      try {
        const [nextDepartments, nextPositions] = await Promise.all([
          getDepartmentsSnapshot(),
          getPositionsSnapshot(),
        ])
        setDepartments(nextDepartments)
        setPositions(nextPositions)
      } catch (referenceError) {
        console.error(referenceError)
      }
    }

    loadReferences()
  }, [])

  useEffect(() => {
    if (!departments.length && !positions.length) return

    setFormData((previous) => {
      const currentEmployment = previous.employment || {}
      let nextEmployment = currentEmployment
      let changed = false

      if (!currentEmployment.departmentId && currentEmployment.department) {
        const matchedDepartment = departments.find(
          (item) => String(item?.name || '').trim().toLowerCase() === String(currentEmployment.department || '').trim().toLowerCase()
        )
        if (matchedDepartment?.id) {
          nextEmployment = { ...nextEmployment, departmentId: matchedDepartment.id }
          changed = true
        }
      }

      if (!currentEmployment.positionId && currentEmployment.position) {
        const effectiveDepartmentId = nextEmployment.departmentId || currentEmployment.departmentId || ''
        const matchedPosition = positions.find((item) => {
          const sameName = String(item?.name || '').trim().toLowerCase() === String(currentEmployment.position || '').trim().toLowerCase()
          if (!sameName) return false
          if (!effectiveDepartmentId) return true
          return String(item?.departmentId || '') === String(effectiveDepartmentId)
        })

        if (matchedPosition?.id) {
          nextEmployment = {
            ...nextEmployment,
            positionId: matchedPosition.id,
            departmentId: nextEmployment.departmentId || matchedPosition.departmentId || currentEmployment.departmentId || '',
          }
          changed = true
        }
      }

      if (!changed) {
        return previous
      }

      const synced = syncStructuredSections(previous.personal || {}, nextEmployment, employeeId)
      return {
        ...previous,
        personal: { ...(previous.personal || {}), ...synced.personal },
        employment: synced.employment,
      }
    })
  }, [departments, employeeId, positions])

  async function loadEmployee() {
    setLoading(true)
    setError('')
    try {
      const response = await api.get(`/employees/${encodeURIComponent(employeeId)}`)
      const payload = response.data || {}
      setMeta({
        userId: payload.userId || payload.meta?.userId || payload.profileData?.meta?.userId || '',
        teacherId: payload.teacherId || '',
        managementId: payload.managementId || '',
        financeId: payload.financeId || payload.financialId || '',
        hrId: payload.hrId || ''
      })
      setCredentialSlip({
        name: payload.credentialSlip?.name || payload.fullName || payload.name || '',
        role: payload.credentialSlip?.role || payload.role || payload.position || '',
        employeeId: payload.credentialSlip?.employeeId || payload.personal?.employeeId || employeeId || '',
        loginUsername: payload.credentialSlip?.loginUsername || payload.loginUsername || '',
        password: payload.credentialSlip?.password || payload.password || '',
      })
      setFormData(normalizeEmployeeRecord(payload))
      const imageUrl = payload.personal?.profileImage || payload.personal?.profileImageName || payload.profileData?.personal?.profileImage || payload.profileData?.personal?.profileImageName || payload.profileImage || ''
      setProfileImagePreview(imageUrl && String(imageUrl).startsWith('http') ? imageUrl : '')
      setProfileImageFile(null)
    } catch (loadError) {
      console.error(loadError)
      setCredentialSlip(null)
      setError('Unable to load employee information.')
    } finally {
      setLoading(false)
    }
  }

  async function handleExportCredentialSlip() {
    if (!canUseCredentialSlip) return

    try {
      await downloadCredentialSlipPdf(resolvedCredentialSlip)
    } catch (downloadError) {
      console.error(downloadError)
      window.alert('Unable to export the credential slip as PDF.')
    }
  }

  function handlePrintCredentialSlip() {
    if (!canUseCredentialSlip) return

    if (!openCredentialSlipPrint(resolvedCredentialSlip)) {
      window.alert('Allow pop-ups to print the credential slip.')
    }
  }

  function setField(section, key, value) {
    setFormData((previous) => ({
      ...(section === 'employment'
        ? (() => {
            const synced = syncStructuredSections(
              previous.personal || {},
              { ...(previous.employment || {}), [key]: value },
              employeeId
            )
            return {
              ...previous,
              personal: { ...(previous.personal || {}), ...synced.personal },
              employment: synced.employment,
            }
          })()
          : section === 'personal' && key === 'employeeId'
            ? (() => {
                const synced = syncStructuredSections(
                  { ...(previous.personal || {}), employeeId: value },
                  previous.employment || {},
                  employeeId
                )
                return {
                  ...previous,
                  personal: { ...(previous.personal || {}), ...synced.personal },
                  employment: synced.employment,
                }
              })()
            : {
                ...previous,
                [section]: {
                  ...(previous[section] || {}),
                  [key]: value,
                },
              }),
    }))
  }

  const availablePositions = useMemo(() => {
    if (!formData.employment?.departmentId) return positions
    return positions.filter((item) => String(item?.departmentId || '') === String(formData.employment.departmentId))
  }, [positions, formData.employment?.departmentId])

  async function saveEmployee() {
    setSaving(true)
    setError('')
    try {
      let profileUrl = formData.personal?.profileImageName || ''
      if (profileImageFile) {
        const uploadData = new FormData()
        uploadData.append('profile', profileImageFile)
        const uploadResponse = await api.post(`/employees/${encodeURIComponent(employeeId)}/upload_profile_image`, uploadData)
        profileUrl = uploadResponse.data?.profileImageUrl || profileUrl
      }

      const nextPersonal = profileUrl
        ? { ...(formData.personal || {}), profileImageName: profileUrl }
        : { ...(formData.personal || {}) }

      const synced = syncStructuredSections(nextPersonal, formData.employment || {}, employeeId)
      const nextEmployment = synced.employment

      const payload = {
        personal: synced.personal,
        contact: formData.contact,
        education: formData.education,
        family: formData.family,
        employment: nextEmployment,
        financial: formData.financial,
      }

      if (meta.userId) {
        payload.userId = meta.userId
      }

      await api.put(`/employees/${encodeURIComponent(employeeId)}`, payload)
      await loadEmployee()
      if (typeof onSaved === 'function') {
        await onSaved()
      }
      window.alert('Employee information updated successfully.')
    } catch (saveError) {
      console.error(saveError)
      setError('Failed to save employee information.')
    } finally {
      setSaving(false)
    }
  }

  function renderField(sectionKey, field) {
    const value = formData?.[sectionKey]?.[field.key]

    if (sectionKey === 'employment' && field.key === 'departmentId') {
      return (
        <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>{field.label}</span>
          <select
            value={value || ''}
            onChange={(event) => {
              const nextDepartment = departments.find((item) => String(item.id) === event.target.value)
              setFormData((previous) => {
                const synced = syncStructuredSections(
                  previous.personal || {},
                  {
                    ...(previous.employment || {}),
                    departmentId: event.target.value,
                    department: nextDepartment?.name || '',
                    positionId: '',
                    position: '',
                  },
                    employeeId
                )

                return {
                  ...previous,
                  personal: { ...(previous.personal || {}), ...synced.personal },
                  employment: synced.employment,
                }
              })
            }}
            style={{ width: '100%', height: 46, border: '1px solid #dbe4ef', borderRadius: 14, padding: '0 14px', fontSize: 14, color: '#0f172a', background: '#fcfdff', boxSizing: 'border-box' }}
          >
            <option value="">Select</option>
            {departments.map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
        </label>
      )
    }

    if (sectionKey === 'employment' && field.key === 'positionId') {
      return (
        <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>{field.label}</span>
          <select
            value={value || ''}
            onChange={(event) => {
              const nextPosition = positions.find((item) => String(item.id) === event.target.value)
              const nextDepartment = departments.find((item) => String(item.id) === String(nextPosition?.departmentId || formData.employment?.departmentId || ''))
              setFormData((previous) => {
                const currentEmployment = previous.employment || {}
                const synced = syncStructuredSections(
                  previous.personal || {},
                  {
                    ...currentEmployment,
                    departmentId: nextDepartment?.id || currentEmployment.departmentId || '',
                    department: nextDepartment?.name || currentEmployment.department || '',
                    positionId: event.target.value,
                    position: nextPosition?.name || '',
                    employeeCategory: currentEmployment.employeeCategory || nextPosition?.name || '',
                    category: currentEmployment.category || nextPosition?.name || '',
                  },
                  employeeId
                )

                return {
                  ...previous,
                  personal: { ...(previous.personal || {}), ...synced.personal },
                  employment: synced.employment,
                }
              })
            }}
            style={{ width: '100%', height: 46, border: '1px solid #dbe4ef', borderRadius: 14, padding: '0 14px', fontSize: 14, color: '#0f172a', background: '#fcfdff', boxSizing: 'border-box' }}
          >
            <option value="">Select</option>
            {availablePositions.map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
        </label>
      )
    }

    if (field.type === 'file' && field.isImage) {
      return (
        <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 8, gridColumn: field.fullWidth ? '1 / -1' : 'auto' }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>{field.label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 42, padding: '0 16px', borderRadius: 12, border: '1px solid #dbe8f6', background: '#f8fbff', color: '#1f4f96', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <FaUpload /> Choose Image
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  setProfileImageFile(file)
                  setProfileImagePreview(URL.createObjectURL(file))
                }}
              />
            </label>
            <div style={{ fontSize: 12, color: '#64748b' }}>{profileImageFile?.name || 'Upload a portrait or profile photo'}</div>
          </div>
          {(profileImagePreview || value) ? (
            <img src={profileImagePreview || value} alt="Profile preview" style={{ width: 132, height: 132, objectFit: 'cover', borderRadius: 20, border: '1px solid #dbe8f6', background: '#f8fbff' }} />
          ) : null}
        </label>
      )
    }

    if (field.type === 'checkbox') {
      return (
        <label key={field.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minHeight: 46, padding: '0 14px', borderRadius: 12, border: '1px solid #e7ecf3', background: '#fbfdff', color: '#334155', fontSize: 13, fontWeight: 700, gridColumn: field.fullWidth ? '1 / -1' : 'auto' }}>
          <input type="checkbox" checked={Boolean(value)} onChange={(event) => setField(sectionKey, field.key, event.target.checked)} />
          {field.label}
        </label>
      )
    }

    if (field.type === 'textarea') {
      return (
        <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 8, gridColumn: field.fullWidth ? '1 / -1' : 'auto' }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>{field.label}</span>
          <textarea
            value={value || ''}
            onChange={(event) => setField(sectionKey, field.key, event.target.value)}
            rows={4}
            style={{ width: '100%', border: '1px solid #dbe4ef', borderRadius: 14, padding: '12px 14px', fontSize: 14, color: '#0f172a', background: '#fcfdff', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </label>
      )
    }

    if (field.type === 'select') {
      const baseOptions = field.options || []
      const selectOptions = value && !baseOptions.includes(value)
        ? (baseOptions.includes('')
            ? ['', value, ...baseOptions.filter((option) => option !== '' && option !== value)]
            : [value, ...baseOptions.filter((option) => option !== value)])
        : baseOptions

      return (
        <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 8, gridColumn: field.fullWidth ? '1 / -1' : 'auto' }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>{field.label}</span>
          <select
            value={value || ''}
            onChange={(event) => setField(sectionKey, field.key, event.target.value)}
            style={{ width: '100%', height: 46, border: '1px solid #dbe4ef', borderRadius: 14, padding: '0 14px', fontSize: 14, color: '#0f172a', background: '#fcfdff', boxSizing: 'border-box' }}
          >
            {selectOptions.map((option) => (
              <option key={option || 'empty'} value={option}>{option || 'Select'}</option>
            ))}
          </select>
        </label>
      )
    }

    return (
      <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 8, gridColumn: field.fullWidth ? '1 / -1' : 'auto' }}>
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>{field.label}</span>
        <input
          type={field.type || 'text'}
          value={value || ''}
          readOnly={field.readOnly}
          onChange={(event) => setField(sectionKey, field.key, event.target.value)}
          style={{ width: '100%', height: 46, border: '1px solid #dbe4ef', borderRadius: 14, padding: '0 14px', fontSize: 14, color: field.readOnly ? '#64748b' : '#0f172a', background: field.readOnly ? '#f8fafc' : '#fcfdff', boxSizing: 'border-box' }}
        />
      </label>
    )
  }

  const panelStyle = embedded
    ? {
        width: 'min(1180px, calc(100vw - 40px))',
        maxHeight: 'calc(100vh - 36px)',
        overflow: 'hidden',
        borderRadius: 28,
        border: '1px solid #dbe8f6',
        background: '#ffffff',
        boxShadow: '0 30px 90px rgba(15, 23, 42, 0.24)',
        display: 'flex',
        flexDirection: 'column',
      }
    : {
        width: '100%',
        borderRadius: 24,
        border: '1px solid #dbe8f6',
        background: '#ffffff',
        boxShadow: '0 18px 48px rgba(15, 23, 42, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }

  return (
    <div style={panelStyle}>
      <div style={{ padding: embedded ? '22px 24px 18px' : '24px 24px 18px', borderBottom: '1px solid #edf2f7', background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0, flex: 1 }}>
            <div style={{ width: 84, height: 84, borderRadius: 24, background: 'linear-gradient(135deg, #eef6ff 0%, #dfeeff 100%)', border: '1px solid #d7e6fb', color: '#1f4f96', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, overflow: 'hidden', flexShrink: 0 }}>
              {(profileImagePreview || formData.personal?.profileImageName) ? (
                <img src={profileImagePreview || formData.personal?.profileImageName} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : getInitials(displayName)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', minHeight: 28, padding: '0 12px', borderRadius: 999, background: '#eef6ff', border: '1px solid #d8e8ff', color: '#0f4fa8', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Employee Profile
              </div>
              <h2 style={{ margin: '12px 0 0', fontSize: 30, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em' }}>{displayName}</h2>
              <p style={{ margin: '8px 0 0', fontSize: 14, color: '#64748b', lineHeight: 1.6, maxWidth: 760 }}>
                Update the employee record from a single premium workspace without leaving the employee list.
              </p>
              {/* <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <SummaryChip icon={FaBriefcase} label={quickRole} />
                <SummaryChip icon={FaBuilding} label={quickDepartment} />
                <SummaryChip icon={FaPhoneAlt} label={quickPhone} />
                <SummaryChip icon={FaEnvelope} label={quickEmail} />
                <SummaryChip icon={FaMapMarkerAlt} label={quickLocation} />
                <SummaryChip icon={FaUserTie} label={currentStatus} />
              </div> */}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handlePrintCredentialSlip}
              disabled={!canUseCredentialSlip}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 16px', borderRadius: 12, border: '1px solid #d8e8ff', background: '#eef6ff', color: '#1f4f96', fontSize: 13, fontWeight: 700, cursor: canUseCredentialSlip ? 'pointer' : 'not-allowed', opacity: canUseCredentialSlip ? 1 : 0.55 }}
            >
              <FaPrint /> Print Slip
            </button>
            <button
              type="button"
              onClick={handleExportCredentialSlip}
              disabled={!canUseCredentialSlip}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 16px', borderRadius: 12, border: '1px solid #007afb', background: '#007afb', color: '#ffffff', fontSize: 13, fontWeight: 700, cursor: canUseCredentialSlip ? 'pointer' : 'not-allowed', opacity: canUseCredentialSlip ? 1 : 0.55 }}
            >
              <FaDownload /> Export PDF
            </button>
            {onClose ? (
              <button type="button" onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 16px', borderRadius: 12, border: '1px solid #dbe8f6', background: '#ffffff', color: '#334155', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {embedded ? <FaTimes /> : <FaArrowLeft />} {embedded ? 'Close' : 'Back'}
              </button>
            ) : null}
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <SummaryChip icon={FaIdBadge} label={`Record: ${employeeId || '—'}`} />
          {meta.userId ? <SummaryChip icon={FaIdBadge} label={`User: ${meta.userId}`} /> : null}
          {meta.teacherId ? <SummaryChip icon={FaIdBadge} label={`Teacher ID: ${meta.teacherId}`} /> : null}
          {meta.managementId ? <SummaryChip icon={FaIdBadge} label={`Management ID: ${meta.managementId}`} /> : null}
          {meta.financeId ? <SummaryChip icon={FaIdBadge} label={`Finance ID: ${meta.financeId}`} /> : null}
          {meta.hrId ? <SummaryChip icon={FaIdBadge} label={`HR ID: ${meta.hrId}`} /> : null}
        </div>

        {!loading && !canUseCredentialSlip ? (
          <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 14, border: '1px solid #dbe8f6', background: '#f8fbff', color: '#475569', fontSize: 12, fontWeight: 700 }}>
            Linked portal credentials are not available for this employee yet, so the slip actions are disabled.
          </div>
        ) : null}
      </div>

      {error ? (
        <div style={{ margin: '16px 24px 0', padding: '12px 14px', borderRadius: 14, border: '1px solid #fecaca', background: '#fff1f2', color: '#b91c1c', fontSize: 13, fontWeight: 700 }}>
          {error}
        </div>
      ) : null}

      {loading ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>Loading employee information...</div>
      ) : (
        <>
          <div style={{ padding: '16px 24px 0', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {SECTION_ORDER.map((section, index) => (
              <a key={section.key} href={`#employee-section-${section.key}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 38, padding: '0 14px', borderRadius: 999, border: '1px solid #e7ecf3', background: '#ffffff', color: '#334155', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#eef6ff', color: '#1f4f96', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{index + 1}</span>
                {section.label}
              </a>
            ))}
          </div>

          <div style={{ padding: '18px 24px 24px', overflowY: 'auto' }}>
            <div style={{ display: 'grid', gap: 16 }}>
              {SECTION_ORDER.map((section) => (
                <section key={section.key} id={`employee-section-${section.key}`} style={{ background: '#ffffff', border: '1px solid #e7ecf3', borderRadius: 22, padding: 20, boxShadow: '0 14px 34px rgba(15, 23, 42, 0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{section.label}</h3>
                      <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>Keep this section current and aligned with the employee record.</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                    {(FIELD_CONFIG[section.key] || []).map((field) => renderField(section.key, field))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <div style={{ padding: '16px 24px 22px', borderTop: '1px solid #edf2f7', background: 'rgba(255,255,255,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>Changes are saved directly to the employee record and linked profile data.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {onClose ? (
                <button type="button" onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 16px', borderRadius: 12, border: '1px solid #dbe8f6', background: '#ffffff', color: '#334155', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  <FaArrowLeft /> Back
                </button>
              ) : null}
              <button type="button" onClick={saveEmployee} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 18px', borderRadius: 12, border: '1px solid #007afb', background: '#007afb', color: '#ffffff', fontSize: 13, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                <FaSave /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}