import React, { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { FaBell, FaFacebookMessenger, FaCog, FaChevronDown, FaChevronUp } from "react-icons/fa"
import api from "../api"
import { getDepartmentsSnapshot, getPositionsSnapshot, setDepartmentsSnapshot, setPositionsSnapshot } from '../hrData'
import { downloadCredentialSlipPdf, openCredentialSlipPrint } from '../utils/credentialSlip'
import "./Dashboard.css"
import "../styles/global.css"

const CURRENT_YEAR = new Date().getFullYear()

const MARITAL_STATUS_OPTIONS = ['', 'Single', 'Married', 'Divorced', 'Widowed', 'Separated']

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

const COUNTRY_OPTIONS = [
  '',
  'Afghanistan',
  'Albania',
  'Algeria',
  'Andorra',
  'Angola',
  'Antigua and Barbuda',
  'Argentina',
  'Armenia',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bahamas',
  'Bahrain',
  'Bangladesh',
  'Barbados',
  'Belarus',
  'Belgium',
  'Belize',
  'Benin',
  'Bhutan',
  'Bolivia',
  'Bosnia and Herzegovina',
  'Botswana',
  'Brazil',
  'Brunei',
  'Bulgaria',
  'Burkina Faso',
  'Burundi',
  'Cambodia',
  'Cameroon',
  'Canada',
  'Cape Verde',
  'Central African Republic',
  'Chad',
  'Chile',
  'China',
  'Colombia',
  'Comoros',
  'Congo',
  'Costa Rica',
  'Croatia',
  'Cuba',
  'Cyprus',
  'Czech Republic',
  'Democratic Republic of the Congo',
  'Denmark',
  'Djibouti',
  'Dominica',
  'Dominican Republic',
  'Ecuador',
  'Egypt',
  'El Salvador',
  'Equatorial Guinea',
  'Eritrea',
  'Estonia',
  'Eswatini',
  'Ethiopia',
  'Fiji',
  'Finland',
  'France',
  'Gabon',
  'Gambia',
  'Georgia',
  'Germany',
  'Ghana',
  'Greece',
  'Grenada',
  'Guatemala',
  'Guinea',
  'Guinea-Bissau',
  'Guyana',
  'Haiti',
  'Honduras',
  'Hungary',
  'Iceland',
  'India',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',
  'Ivory Coast',
  'Jamaica',
  'Japan',
  'Jordan',
  'Kazakhstan',
  'Kenya',
  'Kiribati',
  'Kuwait',
  'Kyrgyzstan',
  'Laos',
  'Latvia',
  'Lebanon',
  'Lesotho',
  'Liberia',
  'Libya',
  'Liechtenstein',
  'Lithuania',
  'Luxembourg',
  'Madagascar',
  'Malawi',
  'Malaysia',
  'Maldives',
  'Mali',
  'Malta',
  'Marshall Islands',
  'Mauritania',
  'Mauritius',
  'Mexico',
  'Micronesia',
  'Moldova',
  'Monaco',
  'Mongolia',
  'Montenegro',
  'Morocco',
  'Mozambique',
  'Myanmar',
  'Namibia',
  'Nauru',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Nicaragua',
  'Niger',
  'Nigeria',
  'North Korea',
  'North Macedonia',
  'Norway',
  'Oman',
  'Pakistan',
  'Palau',
  'Panama',
  'Papua New Guinea',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Romania',
  'Russia',
  'Rwanda',
  'Saint Kitts and Nevis',
  'Saint Lucia',
  'Saint Vincent and the Grenadines',
  'Samoa',
  'San Marino',
  'Sao Tome and Principe',
  'Saudi Arabia',
  'Senegal',
  'Serbia',
  'Seychelles',
  'Sierra Leone',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'Solomon Islands',
  'Somalia',
  'South Africa',
  'South Korea',
  'South Sudan',
  'Spain',
  'Sri Lanka',
  'Sudan',
  'Suriname',
  'Sweden',
  'Switzerland',
  'Syria',
  'Taiwan',
  'Tajikistan',
  'Tanzania',
  'Thailand',
  'Timor-Leste',
  'Togo',
  'Tonga',
  'Trinidad and Tobago',
  'Tunisia',
  'Turkey',
  'Turkmenistan',
  'Tuvalu',
  'Uganda',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Uruguay',
  'Uzbekistan',
  'Vanuatu',
  'Vatican City',
  'Venezuela',
  'Vietnam',
  'Yemen',
  'Zambia',
  'Zimbabwe'
]

const HIGHEST_QUALIFICATION_OPTIONS = [
  '',
  'High School',
  'Certificate',
  'Diploma',
  "Bachelor's Degree",
  "Master's Degree",
  'PhD',
  'Other'
]

const GRADUATION_YEAR_OPTIONS = [
  '',
  ...Array.from({ length: CURRENT_YEAR - 1949 }, (_, index) => String(CURRENT_YEAR - index))
]

function createInitialFormData() {
  return {
    personal: { employeeId: '', firstName: '', middleName: '', lastName: '', password: createGeneratedPassword(8), dob: '', placeOfBirth: '', nationality: '', gender: '', nationalId: '', profileImageName: '', bloodGroup: '', religion: '', disabilityStatus: '' },
    contact: { phone1: '', phone2: '', email: '', altEmail: '', address: '', city: '', subCity: '', woreda: '' },
    education: { highestQualification: '', degreeType: '', fieldOfStudy: '', institution: '', graduationYear: '', gpa: '', additionalCertifications: '', professionalLicenseNumber: '', workExperience: '' },
    family: { maritalStatus: '', spouseName: '', spouseOccupation: '', numChildren: '', childrenNames: '', fatherName: '', motherName: '' },
    employment: { departmentId: '', department: '', positionId: '', position: '', employmentType: '', employeeCategory: '', category: '', hireDate: '', contractStartDate: '', contractEndDate: '', workLocation: '', reportingManager: '', workShift: '', status: '' },
    financial: { basicSalary: '', allowances: '', overtimeRate: '', bonusEligibility: false, bankName: '', bankBranch: '', accountNumber: '', accountHolderName: '', paymentMethod: '' }
  }
}

function createInitialReferenceForms() {
  return {
    department: { name: '', description: '', status: 'active' },
    position: { name: '', departmentId: '' },
  }
}


function getInitials(name) {
  return (name || 'HR Office')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'HR'
}

function createGeneratedPassword(length = 8) {
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  const digits = '23456789'
  const allChars = `${lower}${upper}${digits}`

  const pick = (source) => source[Math.floor(Math.random() * source.length)]
  const nextPassword = [pick(lower), pick(upper), pick(digits)]

  while (nextPassword.length < Math.max(8, length)) {
    nextPassword.push(pick(allChars))
  }

  return nextPassword
    .sort(() => Math.random() - 0.5)
    .join('')
}

function formatFileSize(bytes) {
  const numericBytes = Number(bytes || 0)
  if (!numericBytes) return '0 KB'
  if (numericBytes >= 1024 * 1024) {
    return `${(numericBytes / (1024 * 1024)).toFixed(2)} MB`
  }
  return `${Math.max(1, Math.round(numericBytes / 1024))} KB`
}

async function compressImageToJpeg(file, { maxDimension = 960, maxBytes = 350 * 1024 } = {}) {
  if (!file || !String(file.type || '').startsWith('image/') || file.type === 'image/svg+xml') {
    return {
      file,
      originalSize: Number(file?.size || 0),
      finalSize: Number(file?.size || 0),
      wasCompressed: false,
      wasConvertedToJpeg: false,
    }
  }

  const imageUrl = URL.createObjectURL(file)

  try {
    const imageElement = await new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Unable to process selected image.'))
      image.src = imageUrl
    })

    const originalWidth = imageElement.naturalWidth || imageElement.width || 1
    const originalHeight = imageElement.naturalHeight || imageElement.height || 1
    const scale = Math.min(1, maxDimension / Math.max(originalWidth, originalHeight))
    let targetWidth = Math.max(1, Math.round(originalWidth * scale))
    let targetHeight = Math.max(1, Math.round(originalHeight * scale))
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { alpha: false })

    if (!context) {
      throw new Error('Canvas context unavailable.')
    }

    const renderImage = () => {
      canvas.width = targetWidth
      canvas.height = targetHeight
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, targetWidth, targetHeight)
      context.drawImage(imageElement, 0, 0, targetWidth, targetHeight)
    }

    const canvasToBlob = (quality) => new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob)
          return
        }
        reject(new Error('Image compression failed.'))
      }, 'image/jpeg', quality)
    })

    renderImage()

    const qualitySteps = [0.78, 0.68, 0.58, 0.48, 0.4]
    let bestBlob = null

    for (const quality of qualitySteps) {
      const candidateBlob = await canvasToBlob(quality)
      bestBlob = candidateBlob
      if (candidateBlob.size <= maxBytes) {
        break
      }
    }

    if (bestBlob && bestBlob.size > maxBytes) {
      targetWidth = Math.max(480, Math.round(targetWidth * 0.8))
      targetHeight = Math.max(480, Math.round(targetHeight * 0.8))
      renderImage()
      bestBlob = await canvasToBlob(0.4)
    }

    if (!bestBlob) {
      throw new Error('Image compression failed.')
    }

    const jpegFile = new File(
      [bestBlob],
      `${file.name.replace(/\.[^.]+$/, '') || 'profile-image'}.jpg`,
      { type: 'image/jpeg', lastModified: Date.now() },
    )

    return {
      file: jpegFile,
      originalSize: Number(file.size || 0),
      finalSize: Number(jpegFile.size || 0),
      wasCompressed: jpegFile.size < file.size,
      wasConvertedToJpeg: true,
    }
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

function AvatarBadge({ src, name, size = 40, fontSize = 14, radius = '50%' }) {
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
      alt={name || 'HR Office'}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', border: '1px solid #d9e5f5', flexShrink: 0 }}
    />
  )
}


export default function Register() {
  const [admin] = useState(JSON.parse(localStorage.getItem("admin")) || {})
  const [selectedFile, setSelectedFile] = useState(null)
  const [profileImageMeta, setProfileImageMeta] = useState(null)
  const [isOptimizingProfileImage, setIsOptimizingProfileImage] = useState(false)
  const [selectedCertFile, setSelectedCertFile] = useState(null)
  const [createdCredentials, setCreatedCredentials] = useState(null)
  const [validationErrors, setValidationErrors] = useState({})

  const [selectedRole, setSelectedRole] = useState("")
  const [activeSection, setActiveSection] = useState("personal")

  const navigate = useNavigate()

  const sections = [
    { key: 'personal', label: 'Personal' },
    { key: 'contact', label: 'Contact' },
    { key: 'education', label: 'Education' },
    { key: 'family', label: 'Family' },
    { key: 'employment', label: 'Employment' },
    { key: 'financial', label: 'Financial' }
  ]

  const [formData, setFormData] = useState(() => createInitialFormData())
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [referenceError, setReferenceError] = useState('')
  const [referenceForms, setReferenceForms] = useState(() => createInitialReferenceForms())
  const [referenceStatus, setReferenceStatus] = useState({ type: '', message: '' })
  const [referenceSubmitting, setReferenceSubmitting] = useState({ department: false, position: false })
  const [isReferenceManagerExpanded, setIsReferenceManagerExpanded] = useState(true)

  function setFormValue(section, key, value) {
    const errorKey = `${section}.${key}`
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] || {}),
        [key]: value
      }
    }))
    setValidationErrors((prev) => {
      if (!prev[errorKey]) return prev
      const nextErrors = { ...prev }
      delete nextErrors[errorKey]
      return nextErrors
    })
  }

  function setEmploymentFormData(updater) {
    setFormData((prev) => ({
      ...prev,
      employment: typeof updater === 'function' ? updater(prev.employment || {}) : updater,
    }))
  }

  function clearValidationError(errorKey) {
    setValidationErrors((prev) => {
      if (!prev[errorKey]) return prev
      const nextErrors = { ...prev }
      delete nextErrors[errorKey]
      return nextErrors
    })
  }

  function setReferenceFormValue(section, key, value) {
    setReferenceForms((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section] || {}),
        [key]: value,
      },
    }))
    if (referenceStatus.message) {
      setReferenceStatus({ type: '', message: '' })
    }
  }

  function toggleReferenceManager() {
    setIsReferenceManagerExpanded((prev) => !prev)
  }

  function handleEmploymentTypeChange(nextEmploymentType) {
    setEmploymentFormData((currentEmployment) => ({
      ...currentEmployment,
      employmentType: nextEmploymentType,
      contractStartDate: nextEmploymentType === 'Contract' ? currentEmployment.contractStartDate || '' : '',
      contractEndDate: nextEmploymentType === 'Contract' ? currentEmployment.contractEndDate || '' : '',
      status: currentEmployment.status || 'Active',
    }))

    clearValidationError('employment.employmentType')
    if (nextEmploymentType !== 'Contract') {
      clearValidationError('employment.contractStartDate')
      clearValidationError('employment.contractEndDate')
    }
  }

  function resetRegistrationForm(nextRole = '') {
    setSelectedFile(null)
    setProfileImageMeta(null)
    setIsOptimizingProfileImage(false)
    setSelectedCertFile(null)
    setSelectedRole(nextRole)
    setActiveSection('personal')
    setCreatedCredentials(null)
    setValidationErrors({})
    setFormData(createInitialFormData())
  }

  async function handleProfileImageSelection(event) {
    const file = event.target.files && event.target.files[0]

    if (!file) {
      setSelectedFile(null)
      setProfileImageMeta(null)
      setFormValue('personal', 'profileImageName', '')
      return
    }

    setIsOptimizingProfileImage(true)

    try {
      const optimizedResult = await compressImageToJpeg(file)
      setSelectedFile(optimizedResult.file)
      setProfileImageMeta({
        originalSize: optimizedResult.originalSize,
        finalSize: optimizedResult.finalSize,
        wasCompressed: optimizedResult.wasCompressed,
        wasConvertedToJpeg: optimizedResult.wasConvertedToJpeg,
      })
      setFormValue('personal', 'profileImageName', optimizedResult.file?.name || file.name)
    } catch (error) {
      console.error(error)
      setSelectedFile(file)
      setProfileImageMeta({
        originalSize: Number(file.size || 0),
        finalSize: Number(file.size || 0),
        wasCompressed: false,
        wasConvertedToJpeg: false,
        optimizationFailed: true,
      })
      setFormValue('personal', 'profileImageName', file.name)
    } finally {
      setIsOptimizingProfileImage(false)
      event.target.value = ''
    }
  }

  async function reloadReferenceData() {
    const [departmentsResponse, positionsResponse] = await Promise.all([
      api.get('/departments'),
      api.get('/positions'),
    ])

    const nextDepartments = Array.isArray(departmentsResponse?.data) ? departmentsResponse.data : []
    const nextPositions = Array.isArray(positionsResponse?.data) ? positionsResponse.data : []

    setDepartments(nextDepartments)
    setPositions(nextPositions)
    setDepartmentsSnapshot(nextDepartments)
    setPositionsSnapshot(nextPositions)
    setReferenceError('')

    return { nextDepartments, nextPositions }
  }

  async function handleCreateDepartment() {
    const name = String(referenceForms.department.name || '').trim()
    const description = String(referenceForms.department.description || '').trim()
    const status = String(referenceForms.department.status || 'active').trim().toLowerCase() || 'active'

    if (!name) {
      setReferenceStatus({ type: 'error', message: 'Department name is required.' })
      return
    }

    setReferenceSubmitting((prev) => ({ ...prev, department: true }))
    try {
      const response = await api.post('/departments', { name, description, status })
      const createdDepartment = response?.data || {}
      await reloadReferenceData()
      setReferenceForms((prev) => ({
        department: createInitialReferenceForms().department,
        position: {
          ...(prev.position || {}),
          departmentId: createdDepartment.id || prev.position?.departmentId || '',
        },
      }))
      if (activeSection === 'employment') {
        setFormData((prev) => ({
          ...prev,
          employment: {
            ...(prev.employment || {}),
            departmentId: createdDepartment.id || prev.employment?.departmentId || '',
            department: createdDepartment.name || prev.employment?.department || '',
            positionId: '',
            position: '',
          },
        }))
      }
      setReferenceStatus({ type: 'success', message: `${createdDepartment.name || 'Department'} created successfully.` })
    } catch (error) {
      console.error(error)
      const serverError = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Unable to create department.'
      setReferenceStatus({ type: 'error', message: serverError })
    } finally {
      setReferenceSubmitting((prev) => ({ ...prev, department: false }))
    }
  }

  async function handleCreatePosition() {
    const name = String(referenceForms.position.name || '').trim()
    const departmentId = String(referenceForms.position.departmentId || '').trim()

    if (!departmentId) {
      setReferenceStatus({ type: 'error', message: 'Select a department before creating a position.' })
      return
    }
    if (!name) {
      setReferenceStatus({ type: 'error', message: 'Position name is required.' })
      return
    }

    setReferenceSubmitting((prev) => ({ ...prev, position: true }))
    try {
      const response = await api.post('/positions', { name, departmentId })
      const createdPosition = response?.data || {}
      const { nextDepartments } = await reloadReferenceData()
      const linkedDepartment = nextDepartments.find((item) => String(item.id) === String(departmentId))
      setReferenceForms((prev) => ({
        ...prev,
        position: {
          ...(prev.position || {}),
          name: '',
          departmentId,
        },
      }))
      if (activeSection === 'employment') {
        setFormData((prev) => ({
          ...prev,
          employment: {
            ...(prev.employment || {}),
            departmentId,
            department: linkedDepartment?.name || prev.employment?.department || '',
            positionId: createdPosition.id || prev.employment?.positionId || '',
            position: createdPosition.name || prev.employment?.position || '',
            employeeCategory: prev.employment?.employeeCategory || createdPosition.name || '',
            category: prev.employment?.category || createdPosition.name || '',
          },
        }))
      }
      setReferenceStatus({ type: 'success', message: `${createdPosition.name || 'Position'} created successfully.` })
    } catch (error) {
      console.error(error)
      const serverError = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Unable to create position.'
      setReferenceStatus({ type: 'error', message: serverError })
    } finally {
      setReferenceSubmitting((prev) => ({ ...prev, position: false }))
    }
  }

  async function copyCredentials() {
    if (!createdCredentials) return

    const credentialText = [
      `Name: ${createdCredentials.name}`,
      `Role: ${createdCredentials.role}`,
      `Employee ID: ${createdCredentials.employeeId}`,
      `Portal Username: ${createdCredentials.loginUsername}`,
      `Password: ${createdCredentials.password}`,
    ].join('\n')

    try {
      await navigator.clipboard.writeText(credentialText)
      alert('Credentials copied.')
    } catch (error) {
      console.error(error)
      alert(credentialText)
    }
  }

  async function openCredentialSlip(mode = 'print') {
    if (!createdCredentials) return

    if (mode === 'pdf') {
      try {
        await downloadCredentialSlipPdf(createdCredentials)
      } catch (error) {
        console.error(error)
        alert('Unable to export the credential slip as PDF.')
      }
      return
    }

    if (!openCredentialSlipPrint(createdCredentials)) {
      alert('Allow pop-ups to print or save the credential slip.')
    }
  }

  const departmentOptions = useMemo(() => departments.filter((item) => String(item?.status || 'active').toLowerCase() !== 'inactive'), [departments])
  const availablePositions = useMemo(() => {
    if (!formData.employment.departmentId) return positions
    return positions.filter((item) => String(item?.departmentId || '') === String(formData.employment.departmentId))
  }, [positions, formData.employment.departmentId])

  const [submitting, setSubmitting] = useState(false)
  const employmentType = formData.employment.employmentType
  const isContractEmployment = employmentType === 'Contract'
  const employmentTypeHint = employmentType === 'Full-time'
    ? 'Hire date is the employee\'s official start date. Full-time employees do not use contract start and end dates.'
    : employmentType === 'Part-time'
      ? 'Hire date is still the official start date. Part-time employees keep the same required employment details, but contract dates are not used.'
      : employmentType === 'Contract'
        ? 'Hire date shows when the employee started work. Contract start and end dates are required to define the agreement period.'
        : 'Choose the work type to show how the employment dates should be used.'

  useEffect(() => {
    async function loadReferences() {
      try {
        const [nextDepartments, nextPositions] = await Promise.all([
          getDepartmentsSnapshot(),
          getPositionsSnapshot(),
        ])
        setDepartments(nextDepartments)
        setPositions(nextPositions)
        setDepartmentsSnapshot(nextDepartments)
        setPositionsSnapshot(nextPositions)
        setReferenceError('')
      } catch (error) {
        console.error(error)
        setReferenceError('Departments and positions could not be loaded. You can still continue with manual values if needed.')
      }
    }

    loadReferences()
  }, [])

  const currentIndex = Math.max(0, sections.findIndex(s => s.key === activeSection))
  const lastIndex = sections.length - 1
  const progressPercent = Math.round(((currentIndex + 1) / sections.length) * 100)

  function validateEmploymentSection() {
    const nextErrors = {}
    const employment = formData.employment || {}

    if (!String(employment.departmentId || '').trim()) nextErrors['employment.departmentId'] = 'Department is required.'
    if (!String(employment.positionId || '').trim()) nextErrors['employment.positionId'] = 'Position is required.'
    if (!String(employment.employmentType || '').trim()) nextErrors['employment.employmentType'] = 'Employment type is required.'
    if (!String(employment.employeeCategory || '').trim()) nextErrors['employment.employeeCategory'] = 'Employee category is required.'
    if (!String(employment.hireDate || '').trim()) nextErrors['employment.hireDate'] = 'Hire date is required.'
    if (!String(employment.workLocation || '').trim()) nextErrors['employment.workLocation'] = 'Work location is required.'
    if (!String(employment.workShift || '').trim()) nextErrors['employment.workShift'] = 'Work shift is required.'

    if (employment.employmentType === 'Contract') {
      if (!String(employment.contractStartDate || '').trim()) nextErrors['employment.contractStartDate'] = 'Contract start date is required for contract staff.'
      if (!String(employment.contractEndDate || '').trim()) nextErrors['employment.contractEndDate'] = 'Contract end date is required for contract staff.'
      if (employment.contractStartDate && employment.contractEndDate && employment.contractEndDate < employment.contractStartDate) {
        nextErrors['employment.contractEndDate'] = 'Contract end date must be after the start date.'
      }
    }

    setValidationErrors((prev) => ({
      ...prev,
      ...nextErrors,
    }))

    if (Object.keys(nextErrors).length) {
      setActiveSection('employment')
      return false
    }

    return true
  }

  function validatePersonalSection() {
    const nextErrors = {}
    const personal = formData.personal || {}

    if (!String(personal.firstName || '').trim()) nextErrors['personal.firstName'] = 'First name is required.'
    if (!String(personal.middleName || '').trim()) nextErrors['personal.middleName'] = 'Middle name is required.'
    if (!String(personal.lastName || '').trim()) nextErrors['personal.lastName'] = 'Last name is required.'
    if (!String(personal.password || '').trim()) nextErrors['personal.password'] = 'Password is required.'
    if (String(personal.password || '').trim() && String(personal.password || '').trim().length < 8) {
      nextErrors['personal.password'] = 'Password must be at least 8 characters.'
    }
    if (!String(personal.dob || '').trim()) nextErrors['personal.dob'] = 'Date of birth is required.'
    if (!String(personal.placeOfBirth || '').trim()) nextErrors['personal.placeOfBirth'] = 'Place of birth is required.'
    if (!String(personal.nationality || '').trim()) nextErrors['personal.nationality'] = 'Nationality is required.'
    if (!String(personal.gender || '').trim()) nextErrors['personal.gender'] = 'Gender is required.'

    setValidationErrors((prev) => ({ ...prev, ...nextErrors }))

    if (Object.keys(nextErrors).length) {
      setActiveSection('personal')
      return false
    }

    return true
  }

  function validateEducationSection() {
    const nextErrors = {}
    const education = formData.education || {}

    if (!String(education.highestQualification || '').trim()) nextErrors['education.highestQualification'] = 'Highest qualification is required.'
    if (!String(education.degreeType || '').trim()) nextErrors['education.degreeType'] = 'Degree type is required.'
    if (!String(education.fieldOfStudy || '').trim()) nextErrors['education.fieldOfStudy'] = 'Field of study is required.'
    if (!String(education.institution || '').trim()) nextErrors['education.institution'] = 'Institution name is required.'
    if (!String(education.graduationYear || '').trim()) nextErrors['education.graduationYear'] = 'Graduation year is required.'
    if (!String(education.gpa || '').trim()) nextErrors['education.gpa'] = 'GPA is required.'
    if (!String(education.workExperience || '').trim()) nextErrors['education.workExperience'] = 'Work experience is required. Use N/A if none.'

    setValidationErrors((prev) => ({ ...prev, ...nextErrors }))

    if (Object.keys(nextErrors).length) {
      setActiveSection('education')
      return false
    }

    return true
  }

  function goToPrevSection() { if (currentIndex > 0) setActiveSection(sections[currentIndex - 1].key) }
  function goToNextSection() {
    const currentSectionKey = sections[currentIndex]?.key
    if (currentSectionKey === 'personal' && !validatePersonalSection()) return
    if (currentSectionKey === 'education' && !validateEducationSection()) return
    if (currentSectionKey === 'employment' && !validateEmploymentSection()) return
    if (currentIndex < lastIndex) setActiveSection(sections[currentIndex + 1].key)
  }

  async function handleSubmitRegistration() {
    setSubmitting(true)
    try {
      if (!selectedRole) {
        throw new Error('Please select a role before submitting.')
      }

      if (!validatePersonalSection() || !validateEducationSection()) {
        setSubmitting(false)
        return
      }

      if (!validateEmploymentSection()) {
        setSubmitting(false)
        return
      }

      const selectedDepartment = departmentOptions.find((item) => String(item.id) === String(formData.employment.departmentId))
      const selectedPositionRecord = positions.find((item) => String(item.id) === String(formData.employment.positionId))
      const employmentSection = {
        ...formData.employment,
        departmentId: formData.employment.departmentId || selectedPositionRecord?.departmentId || '',
        department: formData.employment.department || selectedDepartment?.name || '',
        positionId: formData.employment.positionId || '',
        position: formData.employment.position || selectedPositionRecord?.name || '',
        employeeCategory: formData.employment.employeeCategory || formData.employment.category || formData.employment.position || selectedPositionRecord?.name || selectedRole,
        category: formData.employment.category || formData.employment.employeeCategory || formData.employment.position || selectedPositionRecord?.name || selectedRole,
        status: formData.employment.status || 'Active',
      }
      const normalizedProfileData = {
        ...formData,
        employment: employmentSection,
        family: {
          ...(formData.family || {}),
          maritalStatus: formData.family?.maritalStatus || '',
        },
      }

      const payload = new FormData()
      payload.append('role', selectedRole)
      payload.append('name', `${formData.personal.firstName || ''} ${formData.personal.middleName || ''} ${formData.personal.lastName || ''}`.trim())
      payload.append('password', formData.personal.password || 'password123')
      payload.append('email', formData.contact.email || '')
      payload.append('phone', formData.contact.phone1 || '')
      payload.append('profileData', JSON.stringify(normalizedProfileData))

      if (selectedFile) {
        payload.append('profile', selectedFile)
      }
      if (selectedCertFile) {
        payload.append('additionalCert', selectedCertFile)
      }

      const response = await api.post(`/register/${selectedRole}`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setSubmitting(false)
      const responseData = response?.data || {}
      setCreatedCredentials({
        name: `${formData.personal.firstName || ''} ${formData.personal.middleName || ''} ${formData.personal.lastName || ''}`.trim() || 'Employee',
        role: selectedRoleLabel,
        employeeId: responseData.employeeId || 'Not available',
        loginUsername: responseData.loginUsername || responseData.roleId || responseData.employeeId || 'Not available',
        password: formData.personal.password,
      })
    } catch (e) {
      setSubmitting(false)
      console.error(e)
      const serverError = e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Registration failed'
      alert(serverError)
    }
  }

  const roleOptions = [
    { label: 'Teacher', value: 'teacher' },
    { label: 'School Admins', value: 'school_admins' },
    { label: 'Finance', value: 'finance' },
    { label: 'HR', value: 'hr' },
    { label: 'Other', value: 'other' }
  ]
  const activeSectionLabel = sections.find(section => section.key === activeSection)?.label || 'Section'
  const selectedRoleLabel = roleOptions.find((role) => role.value === selectedRole)?.label || 'Employee'
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
      <style>{`
        .register-shell {
          width: 100%;
          max-width: 1260px;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .register-hero {
          background: var(--surface-panel);
          border: 1px solid var(--border-soft);
          border-radius: 22px;
          padding: 22px 24px;
          box-shadow: var(--shadow-panel);
          position: relative;
          overflow: hidden;
        }

        .register-hero::before {
          content: none;
          pointer-events: none;
        }

        .register-hero-header {
          position: relative;
          z-index: 1;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
          margin-bottom: 18px;
        }

        .register-badge {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          min-height: 30px;
          padding: 0 12px;
          border-radius: 999px;
          border: 1px solid var(--border-strong);
          background: var(--surface-accent);
          color: var(--accent-strong);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-bottom: 12px;
        }

        .register-title {
          margin: 0;
          font-size: 28px;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1.1;
          letter-spacing: -0.03em;
        }

        .register-subtitle {
          margin: 8px 0 0;
          font-size: 14px;
          line-height: 1.6;
          color: var(--text-muted);
          max-width: 760px;
        }

        .register-hero-metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(110px, 1fr));
          gap: 12px;
          min-width: min(100%, 420px);
        }

        .register-metric {
          background: var(--surface-panel);
          border: 1px solid var(--border-soft);
          border-radius: 18px;
          padding: 16px;
          box-shadow: var(--shadow-panel);
        }

        .register-metric-value {
          display: block;
          font-size: 24px;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1.1;
        }

        .register-metric-label {
          display: block;
          margin-top: 5px;
          font-size: 11px;
          font-weight: 800;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .register-alert {
          position: relative;
          z-index: 1;
          margin-top: 14px;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid var(--warning-border);
          background: var(--warning-soft);
          color: var(--warning);
          font-size: 13px;
          font-weight: 700;
        }

        .role-pill-wrap {
          position: relative;
          z-index: 1;
          margin-top: 18px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .role-pill {
          border: 1px solid var(--border-soft);
          background: var(--surface-panel);
          color: var(--text-secondary);
          border-radius: 999px;
          min-height: 38px;
          padding: 0 16px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease, color 0.18s ease;
        }

        .role-pill:hover {
          transform: translateY(-1px);
          border-color: var(--border-strong);
          background: var(--surface-accent);
          box-shadow: var(--shadow-soft);
        }

        .role-pill.active {
          background: var(--surface-accent);
          color: var(--text-primary);
          border-color: var(--border-strong);
          box-shadow: none;
        }

        .role-reset {
          min-height: 38px;
          border: 1px solid var(--border-strong);
          background: var(--surface-accent);
          color: var(--accent-strong);
          font-weight: 700;
          cursor: pointer;
          padding: 0 14px;
          border-radius: 999px;
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
          background: var(--surface-panel);
          border: 1px solid var(--border-soft);
          border-radius: 20px;
          padding: 18px;
          box-shadow: var(--shadow-panel);
          position: sticky;
          top: 20px;
        }

        .section-title {
          margin: 0 0 10px;
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 800;
          letter-spacing: 0.08em;
        }

        .section-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 13px;
          border-radius: 14px;
          border: 1px solid var(--border-soft);
          background: var(--surface-panel);
          cursor: pointer;
          text-align: left;
          font-weight: 700;
          color: var(--text-secondary);
          margin-bottom: 8px;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease, color 0.18s ease;
        }

        .section-btn:hover {
          transform: translateY(-1px);
          background: var(--surface-accent);
          border-color: var(--border-strong);
          box-shadow: var(--shadow-soft);
        }

        .section-btn.active {
          background: var(--surface-accent);
          border-color: var(--border-strong);
          color: var(--text-primary);
          box-shadow: none;
        }

        .section-index {
          width: 26px;
          height: 26px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--surface-accent);
          color: var(--accent-strong);
          font-size: 12px;
          font-weight: 800;
          flex-shrink: 0;
        }

        .section-btn.active .section-index {
          background: var(--surface-strong);
          color: var(--accent-strong);
        }

        .form-card {
          flex: 1;
          background: var(--surface-panel);
          border: 1px solid var(--border-soft);
          padding: 28px;
          border-radius: 22px;
          box-shadow: var(--shadow-panel);
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
          color: var(--text-primary);
        }

        .chip {
          font-size: 12px;
          font-weight: 800;
          color: var(--accent-strong);
          background: var(--surface-accent);
          border: 1px solid var(--border-strong);
          border-radius: 999px;
          padding: 7px 11px;
        }

        .progress-wrap {
          margin-bottom: 22px;
          padding: 16px;
          border-radius: 16px;
          border: 1px solid var(--border-soft);
          background: var(--surface-muted);
        }

        .progress-meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 800;
        }

        .progress-track {
          width: 100%;
          height: 9px;
          border-radius: 999px;
          background: var(--surface-strong);
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, var(--accent) 0%, var(--accent-strong) 100%);
          transition: width 0.25s ease;
        }

        .fields-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        .fields-grid .full-width {
          grid-column: 1 / -1;
        }

        .field-stack {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field-label {
          font-size: 12px;
          font-weight: 800;
          color: var(--text-secondary);
          letter-spacing: 0.01em;
        }

        .date-range-group {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .field-error {
          font-size: 12px;
          color: var(--danger);
          font-weight: 700;
        }

        .section-helper {
          margin-bottom: 16px;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid var(--border-soft);
          background: var(--surface-muted);
          font-size: 13px;
          line-height: 1.6;
          color: var(--text-muted);
        }

        .fields-grid .checkbox-row {
          min-height: 44px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 14px;
          border-radius: 14px;
          border: 1px solid var(--border-soft);
          background: var(--surface-muted);
          color: var(--text-secondary);
          font-weight: 700;
        }

        .form-input {
          width: 100%;
          min-height: 46px;
          border-radius: 14px;
          border: 1px solid var(--input-border);
          background: var(--input-bg);
          color: var(--text-primary);
          padding: 0 14px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
          box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.02);
        }

        textarea.form-input {
          min-height: 108px;
          padding: 12px 14px;
          resize: vertical;
        }

        select.form-input,
        input.form-input[type="date"],
        input.form-input[type="file"] {
          padding-top: 0;
          padding-bottom: 0;
        }

        .form-input:focus {
          border-color: var(--input-focus);
          box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.18);
        }

        .form-input::placeholder {
          color: #94a3b8;
        }

        .form-input.has-error {
          border-color: #fca5a5;
          box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.12);
        }

        .file-note {
          margin-top: 6px;
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted);
        }

        .file-label {
          display: block;
          margin-bottom: 6px;
          font-size: 12px;
          font-weight: 800;
          color: var(--text-secondary);
        }

        .file-input-hidden {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .file-upload-control {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          min-height: 76px;
          padding: 16px 18px;
          border-radius: 18px;
          border: 1px solid var(--border-soft);
          background: linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-muted) 100%);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }

        .file-upload-copy {
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 0;
        }

        .file-upload-title {
          font-size: 14px;
          font-weight: 800;
          color: var(--text-primary);
        }

        .file-upload-subtitle {
          font-size: 12px;
          line-height: 1.5;
          color: var(--text-muted);
        }

        .file-upload-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 150px;
          min-height: 42px;
          padding: 0 16px;
          border-radius: 999px;
          border: 1px solid var(--border-strong);
          background: var(--surface-accent);
          color: var(--accent-strong);
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease;
          flex-shrink: 0;
        }

        .file-upload-button:hover {
          transform: translateY(-1px);
          border-color: var(--border-strong);
          background: var(--surface-strong);
          box-shadow: var(--shadow-soft);
        }

        .file-upload-button:focus-visible {
          outline: none;
          box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.18);
        }

        .form-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 24px;
          padding-top: 18px;
          border-top: 1px solid var(--border-soft);
        }

        .submit-btn,
        .secondary-btn {
          min-width: 132px;
          height: 46px;
          border-radius: 14px;
          padding: 0 18px;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
        }

        .submit-btn {
          border: none;
          color: #ffffff;
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%);
          box-shadow: var(--shadow-glow);
        }

        .submit-btn:hover:not(:disabled),
        .secondary-btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .submit-btn:disabled,
        .secondary-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
          transform: none;
        }

        .secondary-btn {
          border: 1px solid var(--border-soft);
          background: var(--surface-panel);
          color: var(--text-secondary);
          box-shadow: var(--shadow-soft);
        }

        .reference-manager {
          background: linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-muted) 100%);
          border: 1px solid var(--border-soft);
          border-radius: 22px;
          box-shadow: var(--shadow-panel);
          padding: 24px;
        }

        .reference-manager-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
          margin-bottom: 18px;
        }

        .reference-manager-title {
          margin: 0;
          font-size: 24px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.03em;
        }

        .reference-manager-copy {
          margin: 8px 0 0;
          font-size: 14px;
          line-height: 1.6;
          color: var(--text-muted);
          max-width: 760px;
        }

        .reference-manager-toggle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 999px;
          border: 1px solid var(--border-strong);
          background: var(--surface-accent);
          color: var(--accent-strong);
          cursor: pointer;
          flex-shrink: 0;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease;
        }

        .reference-manager-toggle:hover {
          transform: translateY(-1px);
          border-color: var(--border-strong);
          background: var(--surface-strong);
          box-shadow: var(--shadow-soft);
        }

        .reference-manager-toggle:focus-visible {
          outline: none;
          box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.18);
        }

        .reference-manager-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .reference-card {
          border-radius: 20px;
          border: 1px solid var(--border-soft);
          background: var(--surface-panel);
          padding: 18px;
          box-shadow: var(--shadow-soft);
        }

        .reference-card-title {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }

        .reference-card-copy {
          margin: 8px 0 16px;
          font-size: 13px;
          line-height: 1.6;
          color: var(--text-muted);
        }

        .reference-form {
          display: grid;
          gap: 12px;
        }

        .reference-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .reference-status {
          margin-bottom: 16px;
          padding: 12px 14px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.5;
        }

        .reference-status.success {
          border: 1px solid var(--border-strong);
          background: var(--surface-accent);
          color: var(--accent-strong);
        }

        .reference-status.error {
          border: 1px solid var(--danger-border);
          background: var(--danger-soft);
          color: var(--danger);
        }

        .register-empty {
          background: var(--surface-panel);
          border: 1px solid var(--border-soft);
          border-radius: 22px;
          box-shadow: var(--shadow-panel);
          padding: 28px;
        }

        .register-empty h4 {
          margin: 0 0 8px;
          font-size: 20px;
          font-weight: 900;
          color: var(--text-primary);
        }

        .register-empty p {
          margin: 0;
          color: var(--text-muted);
          line-height: 1.7;
        }

        .credentials-panel {
          background: linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-muted) 100%);
          border: 1px solid var(--border-strong);
          border-radius: 22px;
          box-shadow: var(--shadow-panel);
          padding: 24px;
        }

        .credentials-title {
          margin: 0;
          font-size: 24px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.03em;
        }

        .credentials-subtitle {
          margin: 8px 0 0;
          font-size: 14px;
          line-height: 1.6;
          color: var(--text-muted);
          max-width: 720px;
        }

        .credentials-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          margin-top: 18px;
        }

        .credentials-card {
          border-radius: 18px;
          border: 1px solid var(--border-soft);
          background: var(--surface-panel);
          padding: 16px;
        }

        .credentials-label {
          display: block;
          font-size: 11px;
          font-weight: 800;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .credentials-value {
          display: block;
          margin-top: 8px;
          font-size: 22px;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1.2;
          word-break: break-word;
        }

        .credentials-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 20px;
        }

        @media (max-width: 1080px) {
          .register-hero-header {
            flex-direction: column;
          }

          .register-hero-metrics {
            width: 100%;
            min-width: 0;
          }

          .reference-manager-grid {
            grid-template-columns: 1fr;
          }

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
          .register-shell {
            gap: 14px;
          }

          .register-hero,
          .register-empty,
          .reference-manager {
            padding: 22px;
          }

          .credentials-panel {
            padding: 22px;
          }

          .register-hero-metrics {
            grid-template-columns: 1fr;
          }

          .fields-grid {
            grid-template-columns: 1fr;
          }

          .date-range-group {
            grid-template-columns: 1fr;
          }

          .form-card {
            padding: 20px;
          }

          .form-card-header,
          .form-actions,
          .progress-meta {
            flex-direction: column;
            align-items: flex-start;
          }

          .form-actions {
            width: 100%;
          }

          .submit-btn,
          .secondary-btn {
            width: 100%;
          }

          .file-upload-control {
            flex-direction: column;
            align-items: stretch;
          }

          .file-upload-button {
            width: 100%;
          }
        }
      `}</style>
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
          <div className="register-shell">
            <div className="register-hero">
              <div className="register-hero-header">
                <div>
                  <span className="register-badge">HR Workspace</span>
                  <h3 className="register-title">Employee Registration</h3>
                  <p className="register-subtitle">Create new staff records from the same dashboard layout and visual system used across the HR portal.</p>
                </div>

                <div className="register-hero-metrics">
                  <div className="register-metric">
                    <span className="register-metric-value">{departmentOptions.length}</span>
                    <span className="register-metric-label">Departments</span>
                  </div>
                  <div className="register-metric">
                    <span className="register-metric-value">{positions.length}</span>
                    <span className="register-metric-label">Positions</span>
                  </div>
                  <div className="register-metric">
                    <span className="register-metric-value">{selectedRole ? selectedRoleLabel : 'Choose'}</span>
                    <span className="register-metric-label">Current Role</span>
                  </div>
                </div>
              </div>

              {referenceError ? <div className="register-alert">{referenceError}</div> : null}
              <div className="role-pill-wrap">
                {roleOptions.map((role) => {
                  const isSelected = selectedRole === role.value
                  return (
                    <button
                      key={role.value}
                      onClick={() => setSelectedRole(role.value)}
                      className={`role-pill ${isSelected ? 'active' : ''}`}
                    >
                      {role.label}
                    </button>
                  )
                })}
                {selectedRole && <button onClick={() => setSelectedRole("")} className="role-reset">Reset role</button>}
              </div>
            </div>

            <div className="reference-manager">
              <div className="reference-manager-header">
                <div>
                  <span className="register-badge">Reference Setup</span>
                  <h3 className="reference-manager-title">Create Departments and Positions</h3>
                  <p className="reference-manager-copy">Add new reference items directly into the school database using the same structure as your export: departments are saved with name, description, and status, and positions are saved with name plus department ID.</p>
                </div>
                <button type="button" className="reference-manager-toggle" onClick={toggleReferenceManager} aria-expanded={isReferenceManagerExpanded} aria-label={isReferenceManagerExpanded ? 'Collapse reference setup' : 'Expand reference setup'}>
                  {isReferenceManagerExpanded ? <FaChevronUp /> : <FaChevronDown />}
                </button>
              </div>

              {referenceStatus.message ? <div className={`reference-status ${referenceStatus.type === 'error' ? 'error' : 'success'}`}>{referenceStatus.message}</div> : null}

              {isReferenceManagerExpanded ? (
              <div className="reference-manager-grid">
                <div className="reference-card">
                  <h4 className="reference-card-title">New Department</h4>
                  <p className="reference-card-copy">This creates a new node in Departments with the exact shape your database expects.</p>
                  <div className="reference-form">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Department name"
                      value={referenceForms.department.name}
                      onChange={(event) => setReferenceFormValue('department', 'name', event.target.value)}
                    />
                    <textarea
                      className="form-input"
                      placeholder="Department description (optional)"
                      value={referenceForms.department.description}
                      onChange={(event) => setReferenceFormValue('department', 'description', event.target.value)}
                    />
                    <select
                      className="form-input"
                      value={referenceForms.department.status}
                      onChange={(event) => setReferenceFormValue('department', 'status', event.target.value)}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    <div className="reference-actions">
                      <button type="button" className="submit-btn" onClick={handleCreateDepartment} disabled={referenceSubmitting.department}>
                        {referenceSubmitting.department ? 'Creating...' : 'Create Department'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="reference-card">
                  <h4 className="reference-card-title">New Position</h4>
                  <p className="reference-card-copy">Each new position is stored under Positions with its department link, so it can be used in registration and employee edits.</p>
                  <div className="reference-form">
                    <select
                      className="form-input"
                      value={referenceForms.position.departmentId}
                      onChange={(event) => setReferenceFormValue('position', 'departmentId', event.target.value)}
                      disabled={!departmentOptions.length}
                    >
                      <option value="">{departmentOptions.length ? 'Select department' : 'Create a department first'}</option>
                      {departmentOptions.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Position name"
                      value={referenceForms.position.name}
                      onChange={(event) => setReferenceFormValue('position', 'name', event.target.value)}
                      disabled={!departmentOptions.length}
                    />
                    <div className="reference-actions">
                      <button type="button" className="submit-btn" onClick={handleCreatePosition} disabled={referenceSubmitting.position || !departmentOptions.length}>
                        {referenceSubmitting.position ? 'Creating...' : 'Create Position'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              ) : null}
            </div>

            {!selectedRole && (
              <div className="register-empty">
                <h4>Select a role to start registration</h4>
                <p>Choose Teacher, Management, Finance, or HR above to open the employee form. The page will keep the same dashboard layout as the rest of the HR portal while you complete each section.</p>
              </div>
            )}

            {createdCredentials ? (
              <div className="credentials-panel">
                <h3 className="credentials-title">Employee Created</h3>
                <p className="credentials-subtitle">Share these credentials with the employee. Keep the employee ID for records, and use the portal username plus password for login.</p>

                <div className="credentials-grid">
                  <div className="credentials-card">
                    <span className="credentials-label">Employee name</span>
                    <span className="credentials-value">{createdCredentials.name}</span>
                  </div>
                  <div className="credentials-card">
                    <span className="credentials-label">Employee ID</span>
                    <span className="credentials-value">{createdCredentials.employeeId}</span>
                  </div>
                  <div className="credentials-card">
                    <span className="credentials-label">Portal username</span>
                    <span className="credentials-value">{createdCredentials.loginUsername}</span>
                  </div>
                  <div className="credentials-card">
                    <span className="credentials-label">Temporary password</span>
                    <span className="credentials-value">{createdCredentials.password}</span>
                  </div>
                </div>

                <div className="credentials-actions">
                  <button className="submit-btn" type="button" onClick={copyCredentials}>Copy Credentials</button>
                  <button className="secondary-btn" type="button" onClick={() => openCredentialSlip('print')}>Print Slip</button>
                  <button className="secondary-btn" type="button" onClick={() => openCredentialSlip('pdf')}>Export PDF</button>
                  <button className="secondary-btn" type="button" onClick={() => resetRegistrationForm(selectedRole)}>Register Another</button>
                  <button className="secondary-btn" type="button" onClick={() => navigate('/employees')}>Go To Employees</button>
                </div>
              </div>
            ) : null}

            {selectedRole && !createdCredentials && (
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
                    <span className="chip">{selectedRoleLabel}</span>
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
                    <div className="field-stack">
                      <input placeholder="First Name" className={`form-input ${validationErrors['personal.firstName'] ? 'has-error' : ''}`} value={formData.personal.firstName} onChange={(e) => setFormValue('personal', 'firstName', e.target.value)} />
                      {validationErrors['personal.firstName'] ? <span className="field-error">{validationErrors['personal.firstName']}</span> : null}
                    </div>
                    <div className="field-stack">
                      <input placeholder="Middle Name" className={`form-input ${validationErrors['personal.middleName'] ? 'has-error' : ''}`} value={formData.personal.middleName} onChange={(e) => setFormValue('personal', 'middleName', e.target.value)} />
                      {validationErrors['personal.middleName'] ? <span className="field-error">{validationErrors['personal.middleName']}</span> : null}
                    </div>
                    <div className="field-stack">
                      <input placeholder="Last Name" className={`form-input ${validationErrors['personal.lastName'] ? 'has-error' : ''}`} value={formData.personal.lastName} onChange={(e) => setFormValue('personal', 'lastName', e.target.value)} />
                      {validationErrors['personal.lastName'] ? <span className="field-error">{validationErrors['personal.lastName']}</span> : null}
                    </div>
                    <div className="field-stack">
                      <input type="password" placeholder="Password" minLength={8} className={`form-input ${validationErrors['personal.password'] ? 'has-error' : ''}`} value={formData.personal.password} onChange={(e) => setFormValue('personal', 'password', e.target.value)} />
                      {validationErrors['personal.password'] ? <span className="field-error">{validationErrors['personal.password']}</span> : null}
                    </div>
                    <div className="field-stack">
                      <label className="field-label">Date Of Birth</label>
                      <input type="date" className={`form-input ${validationErrors['personal.dob'] ? 'has-error' : ''}`} value={formData.personal.dob} onChange={(e) => setFormValue('personal', 'dob', e.target.value)} />
                      {validationErrors['personal.dob'] ? <span className="field-error">{validationErrors['personal.dob']}</span> : null}
                    </div>
                    <div className="field-stack">
                      <input placeholder="Place of Birth" className={`form-input ${validationErrors['personal.placeOfBirth'] ? 'has-error' : ''}`} value={formData.personal.placeOfBirth} onChange={(e) => setFormValue('personal', 'placeOfBirth', e.target.value)} />
                      {validationErrors['personal.placeOfBirth'] ? <span className="field-error">{validationErrors['personal.placeOfBirth']}</span> : null}
                    </div>
                    <div className="field-stack">
                      <select className={`form-input ${validationErrors['personal.nationality'] ? 'has-error' : ''}`} value={formData.personal.nationality} onChange={(e) => setFormValue('personal', 'nationality', e.target.value)}>
                        <option value="">Nationality</option>
                        {COUNTRY_OPTIONS.filter(Boolean).map((country) => (
                          <option key={country} value={country}>{country}</option>
                        ))}
                      </select>
                      {validationErrors['personal.nationality'] ? <span className="field-error">{validationErrors['personal.nationality']}</span> : null}
                    </div>
                    <div className="field-stack">
                      <select className={`form-input ${validationErrors['personal.gender'] ? 'has-error' : ''}`} value={formData.personal.gender} onChange={(e) => setFormValue('personal', 'gender', e.target.value)}><option value="">Gender</option><option value="male">Male</option><option value="female">Female</option></select>
                      {validationErrors['personal.gender'] ? <span className="field-error">{validationErrors['personal.gender']}</span> : null}
                    </div>
                    <input placeholder="National ID Number (optional)" className="form-input" value={formData.personal.nationalId} onChange={(e) => setFormValue('personal', 'nationalId', e.target.value)} />
                    <div className="full-width">
                      <label className="file-label">Profile Photo</label>
                      <div className="file-upload-control">
                        <div className="file-upload-copy">
                          <span className="file-upload-title">Upload employee photo</span>
                          <span className="file-upload-subtitle">Use a clear image in JPG, PNG, or WEBP format. The file is automatically compressed and converted to JPEG before upload to reduce storage size.</span>
                        </div>
                        <label className="file-upload-button" htmlFor="profile-photo-input">
                          {isOptimizingProfileImage ? 'Compressing...' : selectedFile ? 'Change photo' : 'Choose photo'}
                        </label>
                      </div>
                      <input id="profile-photo-input" type="file" accept="image/*" className="file-input-hidden" onChange={handleProfileImageSelection} />
                      {isOptimizingProfileImage ? <div className="file-note">Compressing image and converting it to JPEG for upload...</div> : null}
                      {selectedFile && !isOptimizingProfileImage ? (
                        <div className="file-note">
                          Selected file: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                          {profileImageMeta?.originalSize && profileImageMeta.originalSize !== profileImageMeta.finalSize ? `, original ${formatFileSize(profileImageMeta.originalSize)}` : ''}
                          {profileImageMeta?.wasConvertedToJpeg ? ', JPEG optimized' : ''}
                          {profileImageMeta?.optimizationFailed ? ', original file kept' : ''}
                        </div>
                      ) : null}
                    </div>
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
                    <div className="field-stack">
                      <select className={`form-input ${validationErrors['education.highestQualification'] ? 'has-error' : ''}`} value={formData.education.highestQualification} onChange={(e) => setFormValue('education','highestQualification', e.target.value)}>
                        <option value="">Highest Qualification</option>
                        {HIGHEST_QUALIFICATION_OPTIONS.filter(Boolean).map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                      {validationErrors['education.highestQualification'] ? <span className="field-error">{validationErrors['education.highestQualification']}</span> : null}
                    </div>
                    <div className="field-stack">
                      <select className={`form-input ${validationErrors['education.degreeType'] ? 'has-error' : ''}`} value={formData.education.degreeType} onChange={(e) => setFormValue('education','degreeType', e.target.value)}>
                        <option value="">Degree Type</option>
                        <option value="Diploma">Diploma</option>
                        <option value="BSc">BSc</option>
                        <option value="MSc">MSc</option>
                        <option value="PhD">PhD</option>
                      </select>
                      {validationErrors['education.degreeType'] ? <span className="field-error">{validationErrors['education.degreeType']}</span> : null}
                    </div>
                    <div className="field-stack">
                      <input placeholder="Field of Study" className={`form-input ${validationErrors['education.fieldOfStudy'] ? 'has-error' : ''}`} value={formData.education.fieldOfStudy} onChange={(e) => setFormValue('education','fieldOfStudy', e.target.value)} />
                      {validationErrors['education.fieldOfStudy'] ? <span className="field-error">{validationErrors['education.fieldOfStudy']}</span> : null}
                    </div>
                    <div className="field-stack">
                      <input placeholder="Institution Name" className={`form-input ${validationErrors['education.institution'] ? 'has-error' : ''}`} value={formData.education.institution} onChange={(e) => setFormValue('education','institution', e.target.value)} />
                      {validationErrors['education.institution'] ? <span className="field-error">{validationErrors['education.institution']}</span> : null}
                    </div>
                    <div className="field-stack">
                      <select className={`form-input ${validationErrors['education.graduationYear'] ? 'has-error' : ''}`} value={formData.education.graduationYear} onChange={(e) => setFormValue('education','graduationYear', e.target.value)}>
                        <option value="">Year of Graduation</option>
                        {GRADUATION_YEAR_OPTIONS.filter(Boolean).map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                      {validationErrors['education.graduationYear'] ? <span className="field-error">{validationErrors['education.graduationYear']}</span> : null}
                    </div>
                    <div className="field-stack">
                      <input placeholder="GPA" className={`form-input ${validationErrors['education.gpa'] ? 'has-error' : ''}`} value={formData.education.gpa} onChange={(e) => setFormValue('education','gpa', e.target.value)} />
                      {validationErrors['education.gpa'] ? <span className="field-error">{validationErrors['education.gpa']}</span> : null}
                    </div>
                    <div className="field-stack full-width">
                      <input placeholder="Additional Certifications (comma separated)" className={`form-input ${validationErrors['education.additionalCertifications'] ? 'has-error' : ''}`} value={formData.education.additionalCertifications} onChange={(e) => setFormValue('education','additionalCertifications', e.target.value)} />
                      {validationErrors['education.additionalCertifications'] ? <span className="field-error">{validationErrors['education.additionalCertifications']}</span> : null}
                    </div>
                    <input placeholder="Professional License Number (optional)" className="form-input full-width" value={formData.education.professionalLicenseNumber} onChange={(e) => setFormValue('education','professionalLicenseNumber', e.target.value)} />
                    <div className="field-stack full-width">
                      <textarea placeholder="Work Experience (brief)" className={`form-input ${validationErrors['education.workExperience'] ? 'has-error' : ''}`} value={formData.education.workExperience} onChange={(e) => setFormValue('education','workExperience', e.target.value)} />
                      {validationErrors['education.workExperience'] ? <span className="field-error">{validationErrors['education.workExperience']}</span> : null}
                    </div>
                    <div className="full-width">
                      <label className="file-label">Additional Certifications (PDF)</label>
                      <input type="file" accept="application/pdf" className="form-input" onChange={(e) => { const f = e.target.files[0]; if(f) setSelectedCertFile(f); }} />
                      {selectedCertFile ? <div className="file-note">Selected file: {selectedCertFile.name}</div> : null}
                    </div>
                  </div>
                )}

                {activeSection === 'family' && (
                  <div className="fields-grid">
                    <select className="form-input" value={formData.family.maritalStatus} onChange={(e) => setFormValue('family','maritalStatus', e.target.value)}>
                      <option value="">Marital Status (optional)</option>
                      {MARITAL_STATUS_OPTIONS.filter(Boolean).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <input placeholder="Spouse Name (optional)" className="form-input" value={formData.family.spouseName} onChange={(e) => setFormValue('family','spouseName', e.target.value)} />
                    <input placeholder="Spouse Occupation (optional)" className="form-input" value={formData.family.spouseOccupation} onChange={(e) => setFormValue('family','spouseOccupation', e.target.value)} />
                    <input placeholder="Number of Children (optional)" className="form-input" value={formData.family.numChildren} onChange={(e) => setFormValue('family','numChildren', e.target.value)} />
                    <input placeholder="Children Names (comma separated) (optional)" className="form-input full-width" value={formData.family.childrenNames} onChange={(e) => setFormValue('family','childrenNames', e.target.value)} />
                    <input placeholder="Father's Name" className="form-input" value={formData.family.fatherName} onChange={(e) => setFormValue('family','fatherName', e.target.value)} />
                    <input placeholder="Mother's Name" className="form-input" value={formData.family.motherName} onChange={(e) => setFormValue('family','motherName', e.target.value)} />
                  </div>
                )}

                {activeSection === 'employment' && (
                  <div className="fields-grid">
                    <div className="section-helper full-width">
                      The employment section is required. Department, position, work type, category, hire date, work location, and shift must be filled before registration. Contract staff also require start and end dates.
                      <div style={{ marginTop: 6, fontWeight: 700, color: '#334155' }}>{employmentTypeHint}</div>
                    </div>

                    <div className="field-stack">
                      <select
                        className={`form-input ${validationErrors['employment.departmentId'] ? 'has-error' : ''}`}
                        value={formData.employment.departmentId}
                        onChange={(e) => {
                          const nextDepartment = departmentOptions.find((item) => String(item.id) === e.target.value)
                          setFormData((prev) => ({
                            ...prev,
                            employment: {
                              ...(prev.employment || {}),
                              departmentId: e.target.value,
                              department: nextDepartment?.name || '',
                              positionId: '',
                              position: '',
                            },
                          }))
                          clearValidationError('employment.departmentId')
                          clearValidationError('employment.positionId')
                        }}
                      >
                        <option value="">Department</option>
                        {departmentOptions.map((item) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                      {validationErrors['employment.departmentId'] ? <span className="field-error">{validationErrors['employment.departmentId']}</span> : null}
                    </div>

                    <div className="field-stack">
                      <select
                        className={`form-input ${validationErrors['employment.positionId'] ? 'has-error' : ''}`}
                        value={formData.employment.positionId}
                        onChange={(e) => {
                          const nextPosition = positions.find((item) => String(item.id) === e.target.value)
                          const nextDepartment = departmentOptions.find((item) => String(item.id) === String(nextPosition?.departmentId || formData.employment.departmentId || ''))
                          setFormData((prev) => ({
                            ...prev,
                            employment: {
                              ...(prev.employment || {}),
                              departmentId: nextDepartment?.id || prev.employment.departmentId || '',
                              department: nextDepartment?.name || prev.employment.department || '',
                              positionId: e.target.value,
                              position: nextPosition?.name || '',
                              employeeCategory: prev.employment.employeeCategory || nextPosition?.name || '',
                              category: prev.employment.category || nextPosition?.name || '',
                            },
                          }))
                          clearValidationError('employment.positionId')
                        }}
                      >
                        <option value="">Position / Title</option>
                        {availablePositions.map((item) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                      {validationErrors['employment.positionId'] ? <span className="field-error">{validationErrors['employment.positionId']}</span> : null}
                    </div>

                    <div className="field-stack">
                      <select className={`form-input ${validationErrors['employment.employmentType'] ? 'has-error' : ''}`} value={formData.employment.employmentType} onChange={(e) => handleEmploymentTypeChange(e.target.value)}>
                        <option value="">Employment Type</option>
                        <option value="Full-time">Full-time</option>
                        <option value="Part-time">Part-time</option>
                        <option value="Contract">Contract</option>
                      </select>
                      {validationErrors['employment.employmentType'] ? <span className="field-error">{validationErrors['employment.employmentType']}</span> : null}
                    </div>

                    <div className="field-stack">
                      <select className={`form-input ${validationErrors['employment.employeeCategory'] ? 'has-error' : ''}`} value={formData.employment.employeeCategory} onChange={(e) => setFormValue('employment','employeeCategory', e.target.value)}>
                        <option value="">Employee Category</option>
                        <option value="Teacher">Teacher</option>
                        <option value="Director">Director</option>
                        <option value="Vice Director">Vice Director</option>
                        <option value="Finance">Finance</option>
                        <option value="HR">HR</option>
                        <option value="Administrative">Administrative</option>
                      </select>
                      {validationErrors['employment.employeeCategory'] ? <span className="field-error">{validationErrors['employment.employeeCategory']}</span> : null}
                    </div>

                    <div className="field-stack">
                      <label className="field-label">Work Start Date</label>
                      <input type="date" className={`form-input ${validationErrors['employment.hireDate'] ? 'has-error' : ''}`} value={formData.employment.hireDate} onChange={(e) => setFormValue('employment','hireDate', e.target.value)} />
                      {validationErrors['employment.hireDate'] ? <span className="field-error">{validationErrors['employment.hireDate']}</span> : null}
                    </div>

                    <div className="field-stack full-width">
                      {/* <label className="field-label">Contract Date Range</label> */}
                      <div className="date-range-group">
                        <div className="field-stack">
                          <label className="field-label">Contract Start Date</label>
                          <input
                            type="date"
                            className={`form-input ${validationErrors['employment.contractStartDate'] ? 'has-error' : ''}`}
                            value={formData.employment.contractStartDate}
                            onChange={(e) => setFormValue('employment','contractStartDate', e.target.value)}
                            disabled={!isContractEmployment}
                            aria-label="Contract start date"
                          />
                          {validationErrors['employment.contractStartDate'] ? <span className="field-error">{validationErrors['employment.contractStartDate']}</span> : null}
                        </div>

                        <div className="field-stack">
                          <label className="field-label">Contract End Date</label>
                          <input
                            type="date"
                            className={`form-input ${validationErrors['employment.contractEndDate'] ? 'has-error' : ''}`}
                            value={formData.employment.contractEndDate}
                            onChange={(e) => setFormValue('employment','contractEndDate', e.target.value)}
                            disabled={!isContractEmployment}
                            min={formData.employment.contractStartDate || undefined}
                            aria-label="Contract end date"
                          />
                          {validationErrors['employment.contractEndDate'] ? <span className="field-error">{validationErrors['employment.contractEndDate']}</span> : null}
                        </div>
                      </div>
                    </div>

                    <div className="field-stack">
                      <input placeholder="Work Location" className={`form-input ${validationErrors['employment.workLocation'] ? 'has-error' : ''}`} value={formData.employment.workLocation} onChange={(e) => setFormValue('employment','workLocation', e.target.value)} />
                      {validationErrors['employment.workLocation'] ? <span className="field-error">{validationErrors['employment.workLocation']}</span> : null}
                    </div>

                    <div className="field-stack">
                      <input placeholder="Reporting Manager" className="form-input" value={formData.employment.reportingManager} onChange={(e) => setFormValue('employment','reportingManager', e.target.value)} />
                    </div>

                    <div className="field-stack">
                      <input placeholder="Work Shift" className={`form-input ${validationErrors['employment.workShift'] ? 'has-error' : ''}`} value={formData.employment.workShift} onChange={(e) => setFormValue('employment','workShift', e.target.value)} />
                      {validationErrors['employment.workShift'] ? <span className="field-error">{validationErrors['employment.workShift']}</span> : null}
                    </div>

                    <div className="field-stack">
                      <select className="form-input" value={formData.employment.status} onChange={(e) => setFormValue('employment','status', e.target.value)}>
                        <option value="">Status</option>
                        <option value="Active">Active</option>
                        <option value="On Leave">On Leave</option>
                        <option value="Terminated">Terminated</option>
                      </select>
                    </div>
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
                    <select className="form-input" value={formData.financial.bankName} onChange={(e) => setFormValue('financial','bankName', e.target.value)}>
                      <option value="">Bank Name (optional)</option>
                      {ETHIOPIAN_BANK_OPTIONS.filter(Boolean).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
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
          </div>
        </main>
      </div>
    </div>
  )
}
