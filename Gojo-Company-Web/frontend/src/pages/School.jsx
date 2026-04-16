import { useEffect, useMemo, useState } from 'react'
import { FaArrowRight, FaBuilding, FaCheckCircle, FaIdBadge, FaImage, FaLayerGroup, FaMapMarkerAlt, FaSearch, FaSyncAlt } from 'react-icons/fa'
import CompanySidebar from '../components/CompanySidebar'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '')

const COUNTRY_OPTIONS = [
	{ value: 'Ethiopia', label: 'Ethiopia', code: 'ET' },
]

const REGION_OPTIONS = [
	{ value: 'Addis Ababa', label: 'Addis Ababa', code: 'AAB' },
	{ value: 'Afar', label: 'Afar', code: 'AFR' },
	{ value: 'Amhara', label: 'Amhara', code: 'AMH' },
	{ value: 'Benishangul-Gumuz', label: 'Benishangul-Gumuz', code: 'BSG' },
	{ value: 'Central Ethiopia', label: 'Central Ethiopia', code: 'CET' },
	{ value: 'Dire Dawa', label: 'Dire Dawa', code: 'DDA' },
	{ value: 'Gambela', label: 'Gambela', code: 'GAM' },
	{ value: 'Harari', label: 'Harari', code: 'HAR' },
	{ value: 'Oromia', label: 'Oromia', code: 'ORO' },
	{ value: 'Sidama', label: 'Sidama', code: 'SID' },
	{ value: 'Somali', label: 'Somali', code: 'SOM' },
	{ value: 'South Ethiopia', label: 'South Ethiopia', code: 'SET' },
	{ value: "South West Ethiopia Peoples' Region", label: "South West Ethiopia Peoples' Region", code: 'SWE' },
	{ value: "Southern Nations, Nationalities, and Peoples' Region", label: "Southern Nations, Nationalities, and Peoples' Region", code: 'SNN' },
	{ value: 'Tigray', label: 'Tigray', code: 'TIG' },
]

const CITY_OPTIONS = [
	{ value: 'Addis Ababa', label: 'Addis Ababa', code: 'AAB' },
	{ value: 'Adama', label: 'Adama', code: 'ADA' },
	{ value: 'Bishoftu', label: 'Bishoftu', code: 'BSH' },
	{ value: 'Hawassa', label: 'Hawassa', code: 'HAW' },
]

const DEFAULT_COUNTRY = COUNTRY_OPTIONS[0]

const LANGUAGE_OPTIONS = [
	{ key: 'am', label: 'Amharic' },
	{ key: 'en', label: 'English' },
	{ key: 'om', label: 'Oromic' },
]

const LEVEL_OPTIONS = [
	{ key: 'preprimary', label: 'Pre-primary' },
	{ key: 'elementary', label: 'Elementary' },
	{ key: 'secondary', label: 'Secondary' },
]

const HR_GENDER_OPTIONS = ['male', 'female']
const REGISTRATION_GENDER_OPTIONS = ['Male', 'Female']

function createDefaultForm() {
	const currentYear = new Date().getFullYear()
	return {
		school: {
			name: '',
			shortName: '',
			country: DEFAULT_COUNTRY.value,
			region: '',
			city: '',
			subCity: '',
			kebele: '',
			addressLine: '',
			phone: '',
			alternativePhone: '',
			email: '',
			currentAcademicYear: `${currentYear}_${currentYear + 1}`,
			logoUrl: '',
			coverImageUrl: '',
			active: true,
			languages: {
				am: true,
				en: true,
				om: false,
			},
			levels: {
				preprimary: false,
				elementary: true,
				secondary: false,
			},
		},
		hr: {
			firstName: '',
			middleName: '',
			lastName: '',
			gender: 'male',
			profileImage: '',
			email: '',
			phone: '',
			alternativePhone: '',
			password: '',
			position: 'HR Manager',
		},
		registerer: {
			firstName: '',
			middleName: '',
			lastName: '',
			gender: 'Male',
			profileImage: '',
			email: '',
			phone: '',
			alternativePhone: '',
			password: '',
			position: 'Registerer',
		},
	}
}

function trimText(value) {
	return String(value || '').trim()
}

function hasContent(value) {
	return trimText(value).length > 0
}

function normalizeToken(value) {
	return trimText(value)
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, '')
}

function normalizeCodeSegment(value, length, fallback = '') {
	const normalized = normalizeToken(value)
	if (!normalized) {
		return fallback
	}
	return normalized.slice(0, length)
}

function normalizeShortName(value) {
	return normalizeToken(value)
}

function findOptionByValue(options, value) {
	const normalizedValue = trimText(value).toLowerCase()
	if (!normalizedValue) {
		return null
	}

	return options.find((option) => option.value.toLowerCase() === normalizedValue) || null
}

function resolveCountryCode(value) {
	return findOptionByValue(COUNTRY_OPTIONS, value)?.code || DEFAULT_COUNTRY.code
}

function resolveRegionCode(value) {
	return findOptionByValue(REGION_OPTIONS, value)?.code || normalizeCodeSegment(value, 3, 'REG')
}

function resolveCityCode(value) {
	return findOptionByValue(CITY_OPTIONS, value)?.code || normalizeCodeSegment(value, 3, 'CITY')
}

function buildAcademicYearKey(value) {
	const normalized = trimText(value)
	if (!normalized) {
		const currentYear = new Date().getFullYear()
		return `${currentYear}_${currentYear + 1}`
	}

	const parts = normalized.split(/[\/_-]+/).filter(Boolean)
	if (parts.length === 1 && /^\d{4}$/.test(parts[0])) {
		const startYear = Number(parts[0])
		return `${startYear}_${startYear + 1}`
	}

	if (parts.length === 2 && /^\d{4}$/.test(parts[0]) && /^\d{4}$/.test(parts[1])) {
		const startYear = Number(parts[0])
		const endYear = Number(parts[1])
		if (endYear === startYear + 1) {
			return `${startYear}_${endYear}`
		}
	}

	return normalized
}

function formatAcademicYearLabel(value) {
	const normalized = buildAcademicYearKey(value)
	const [startYear, endYear] = normalized.split('_')
	if (!startYear || !endYear) {
		return normalized || 'Academic year pending'
	}
	return `${startYear}/${endYear}`
}

function formatDateLabel(value) {
	const normalized = trimText(value)
	if (!normalized) {
		return 'Recently added'
	}

	const parsed = new Date(normalized)
	if (Number.isNaN(parsed.getTime())) {
		return normalized
	}

	return parsed.toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	})
}

function joinNameParts(...parts) {
	return parts.map(trimText).filter(Boolean).join(' ')
}

function formatListSummary(values, fallback) {
	const labels = values.map((value) => trimText(value)).filter(Boolean)
	return labels.length ? labels.join(' • ') : fallback
}

function buildSchoolCodePreview(school) {
	const countryCode = resolveCountryCode(school.country)
	const regionCode = resolveRegionCode(school.region)
	const cityCode = resolveCityCode(school.city)
	const shortName = normalizeShortName(school.shortName) || 'SCH'
	return `${countryCode}-${regionCode}-${cityCode}-${shortName}`
}

function buildCurrentYearSuffix() {
	return String(new Date().getFullYear() % 100).padStart(2, '0')
}

function buildHrIdPreview(shortName) {
	const normalizedShortName = normalizeShortName(shortName) || 'SCH'
	return `${normalizedShortName}H_0001_${buildCurrentYearSuffix()}`
}

function buildRegistererIdPreview(shortName) {
	const normalizedShortName = normalizeShortName(shortName) || 'SCH'
	return `${normalizedShortName}R_0001_${buildCurrentYearSuffix()}`
}

function buildPayload(form) {
	return {
		school: {
			...form.school,
			country: trimText(form.school.country) || DEFAULT_COUNTRY.value,
			countryCode: resolveCountryCode(form.school.country),
			regionCode: resolveRegionCode(form.school.region),
			cityCode: resolveCityCode(form.school.city),
			currentAcademicYear: buildAcademicYearKey(form.school.currentAcademicYear),
		},
		hr: {
			...form.hr,
			gender: trimText(form.hr.gender) || 'male',
		},
		registerer: {
			...form.registerer,
			gender: trimText(form.registerer.gender) || 'Male',
		},
	}
}

function StatCard({ label, value, tone = 'teal' }) {
	return (
		<div className={`builder-stat-card tone-${tone}`}>
			<p className='config-key'>{label}</p>
			<p className='config-value'>{value}</p>
		</div>
	)
}

function SignalCard({ icon: Icon, label, value, tone = 'accent' }) {
	return (
		<div className={`school-signal-card tone-${tone}`}>
			<span className='school-signal-icon' aria-hidden='true'>
				<Icon />
			</span>
			<div className='school-signal-copy'>
				<span>{label}</span>
				<strong>{value}</strong>
			</div>
		</div>
	)
}

function DetailChip({ label, value, tone = 'neutral' }) {
	return (
		<div className={`school-detail-chip tone-${tone}`}>
			<span>{label}</span>
			<strong>{value}</strong>
		</div>
	)
}

export default function School() {
	const [form, setForm] = useState(() => createDefaultForm())
	const [directory, setDirectory] = useState({ schools: [], count: 0, activeCount: 0, hrAccountCount: 0, registererAccountCount: 0 })
	const [loadState, setLoadState] = useState({ loading: true, error: '' })
	const [assetUploadState, setAssetUploadState] = useState({ loadingKey: '', error: '', success: '' })
	const [submitState, setSubmitState] = useState({ loading: false, error: '', success: '' })
	const [searchTerm, setSearchTerm] = useState('')
	const [lastCreated, setLastCreated] = useState(null)

	const payload = useMemo(() => buildPayload(form), [form])
	const schoolCodePreview = useMemo(() => buildSchoolCodePreview(form.school), [form.school])
	const hrIdPreview = useMemo(() => buildHrIdPreview(form.school.shortName), [form.school.shortName])
	const registererIdPreview = useMemo(() => buildRegistererIdPreview(form.school.shortName), [form.school.shortName])
	const academicYearLabel = useMemo(() => formatAcademicYearLabel(form.school.currentAcademicYear), [form.school.currentAcademicYear])
	const hrDisplayName = joinNameParts(form.hr.firstName, form.hr.middleName, form.hr.lastName) || 'HR lead pending'
	const registererDisplayName = joinNameParts(form.registerer.firstName, form.registerer.middleName, form.registerer.lastName) || 'Registration lead pending'
	const enabledLanguages = LANGUAGE_OPTIONS.filter((item) => form.school.languages[item.key]).map((item) => item.label)
	const enabledLevels = LEVEL_OPTIONS.filter((item) => form.school.levels[item.key]).map((item) => item.label)
	const enabledLanguageSummary = formatListSummary(enabledLanguages, 'No school languages selected yet')
	const enabledLevelSummary = formatListSummary(enabledLevels, 'No academic levels selected yet')
	const locationPreview = [form.school.city, form.school.region, form.school.country].filter(hasContent).join(', ') || 'Location pending'
	const schoolStatusLabel = form.school.active ? 'Active on creation' : 'Staged for review'
	const assetCompletionCount = [form.school.logoUrl, form.school.coverImageUrl].filter(hasContent).length
	const heroLiveChip = directory.count ? `${directory.count} schools in registry` : 'New launch workspace'
	const launchTeamLabel = `${hrDisplayName} + ${registererDisplayName}`
	const lastLaunchSummary = lastCreated
		? `${lastCreated.schoolName || 'School'} launched as ${lastCreated.schoolCode || 'a new school'} with ${lastCreated.hrId || 'HR'} and ${lastCreated.registererId || 'registerer'} ready.`
		: `HR ${hrIdPreview} and Registerer ${registererIdPreview} will be generated when you publish this launch.`
	const heroSignals = [
		{ icon: FaMapMarkerAlt, label: 'Launch geography', value: locationPreview, tone: 'accent' },
		{ icon: FaLayerGroup, label: 'Academic cycle', value: academicYearLabel, tone: 'gold' },
		{ icon: FaCheckCircle, label: 'Activation mode', value: schoolStatusLabel, tone: form.school.active ? 'teal' : 'neutral' },
	]
	const filteredSchools = useMemo(() => {
		const query = trimText(searchTerm).toLowerCase()
		if (!query) {
			return directory.schools
		}

		return directory.schools.filter((school) => {
			return [school.name, school.code, school.shortName, school.city, school.region]
				.some((value) => trimText(value).toLowerCase().includes(query))
		})
	}, [directory.schools, searchTerm])
	const directoryCountLabel = directory.count
		? filteredSchools.length === directory.count
			? `Showing all ${directory.count} schools`
			: `Showing ${filteredSchools.length} of ${directory.count} schools`
		: 'Registry is waiting for the first school'

	useEffect(() => {
		reloadDirectory()
	}, [])

	async function reloadDirectory() {
		setLoadState({ loading: true, error: '' })

		try {
			const response = await fetch(`${API_BASE_URL}/api/schools`)
			const data = await response.json()
			if (!response.ok) {
				throw new Error(data.error || 'Unable to load schools')
			}

			setDirectory({
				schools: Array.isArray(data.schools) ? data.schools : [],
				count: Number(data.count) || 0,
				activeCount: Number(data.activeCount) || 0,
				hrAccountCount: Number(data.hrAccountCount) || 0,
				registererAccountCount: Number(data.registererAccountCount) || 0,
			})
			setLoadState({ loading: false, error: '' })
		} catch (error) {
			setLoadState({ loading: false, error: error.message || 'Unable to connect to backend' })
		}
	}

	function updateSchoolField(field, value) {
		setForm((current) => ({
			...current,
			school: {
				...current.school,
				[field]: value,
			},
		}))
	}

	function updateHrField(field, value) {
		setForm((current) => ({
			...current,
			hr: {
				...current.hr,
				[field]: value,
			},
		}))
	}

	function updateRegistererField(field, value) {
		setForm((current) => ({
			...current,
			registerer: {
				...current.registerer,
				[field]: value,
			},
		}))
	}

	function toggleSchoolSelection(groupKey, itemKey) {
		setForm((current) => ({
			...current,
			school: {
				...current.school,
				[groupKey]: {
					...current.school[groupKey],
					[itemKey]: !current.school[groupKey][itemKey],
				},
			},
		}))
	}

	async function handleSchoolAssetUpload(file, assetType) {
		if (!file) {
			return
		}

		const loadingKey = trimText(assetType).toLowerCase()
		setAssetUploadState({ loadingKey, error: '', success: '' })

		try {
			const body = new FormData()
			body.append('file', file)
			body.append('assetType', loadingKey)
			body.append('schoolShortName', normalizeShortName(form.school.shortName) || 'school')

			const response = await fetch(`${API_BASE_URL}/api/schools/upload-asset`, {
				method: 'POST',
				body,
			})
			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'Upload failed')
			}

			const uploadedUrl = trimText(data.url || data.downloadUrl || data.logoUrl || data.coverImageUrl || data.profileImage)
			if (!uploadedUrl) {
				throw new Error('Upload succeeded but no URL was returned')
			}

			if (loadingKey === 'logo') {
				updateSchoolField('logoUrl', uploadedUrl)
			} else if (loadingKey === 'cover') {
				updateSchoolField('coverImageUrl', uploadedUrl)
			} else if (loadingKey === 'hr-profile') {
				updateHrField('profileImage', uploadedUrl)
			} else if (loadingKey === 'registerer-profile') {
				updateRegistererField('profileImage', uploadedUrl)
			}

			setAssetUploadState({
				loadingKey: '',
				error: '',
				success: `${file.name} uploaded and linked successfully.`,
			})
		} catch (error) {
			setAssetUploadState({ loadingKey: '', error: error.message || 'Upload failed', success: '' })
		}
	}

	async function handleSubmit(event) {
		event.preventDefault()
		setSubmitState({ loading: true, error: '', success: '' })

		try {
			const response = await fetch(`${API_BASE_URL}/api/schools`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
			})
			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'School creation failed')
			}

			setLastCreated(data.created || null)
			setSubmitState({
				loading: false,
				error: '',
				success: `Created ${data.created?.schoolName || 'school'} as ${data.created?.schoolCode}. HR ${data.created?.hrId} and registerer ${data.created?.registererId} are ready for launch.`,
			})
			setForm(createDefaultForm())
			await reloadDirectory()
		} catch (error) {
			setSubmitState({ loading: false, error: error.message || 'School creation failed', success: '' })
		}
	}

	return (
		<div className='google-dashboard'>
			<CompanySidebar />
			<main className='google-main company-main'>
				<div className='exam-shell builder-shell school-shell'>
					<section className='hero-panel school-hero-panel'>
						<div className='hero-copy school-hero-copy'>
							<div className='school-hero-kicker-row'>
								<span className='eyebrow'>Platform1 School Registry</span>
								<span className='school-hero-live-chip'>{heroLiveChip}</span>
							</div>
							<h1>Launch a school, its HR lead, and its registerer from one premium control room.</h1>
							<p>
								Provision school identity, hidden location codes, brand assets, and first operator accounts in one save while keeping
								the registry aligned with the rest of the Gojo company platform.
							</p>
							<div className='school-command-grid'>
								{heroSignals.map((signal) => (
									<SignalCard key={signal.label} icon={signal.icon} label={signal.label} value={signal.value} tone={signal.tone} />
								))}
							</div>
							<div className='hero-actions school-hero-actions'>
								<a className='primary-action' href='#school-form'>
									<span>Launch a school</span>
									<FaArrowRight aria-hidden='true' />
								</a>
								<a className='secondary-action' href='#school-directory'>
									<FaSearch aria-hidden='true' />
									<span>View school directory</span>
								</a>
							</div>
							{loadState.error ? <div className='status-banner warning'>{loadState.error}</div> : null}
							{assetUploadState.error ? <div className='status-banner warning'>{assetUploadState.error}</div> : null}
							{assetUploadState.success ? <div className='status-banner success-banner'>{assetUploadState.success}</div> : null}
							{submitState.error ? <div className='status-banner warning'>{submitState.error}</div> : null}
							{submitState.success ? <div className='status-banner success-banner'>{submitState.success}</div> : null}
						</div>

						<div className='school-hero-card'>
							<div className='school-hero-card-top'>
								<div>
									<span className='pill pill-gold'>Launch Snapshot</span>
									<h3>{form.school.name || 'Your next school launch'}</h3>
									<p>
										{form.school.name
											? `${locationPreview}. ${schoolStatusLabel}. ${academicYearLabel}.`
											: 'Complete the school identity, operators, and media assets to provision the next campus in one publish.'}
									</p>
								</div>
								<div className='school-hero-card-badge'>
									<span>Preview school code</span>
									<strong>{schoolCodePreview}</strong>
									<small>{academicYearLabel}</small>
								</div>
							</div>

							<div className='school-hero-highlight-grid'>
								<article className='school-hero-highlight-card'>
									<span>Languages</span>
									<strong>{enabledLanguages.length ? `${enabledLanguages.length} enabled` : 'Pending'}</strong>
									<small>{enabledLanguageSummary}</small>
								</article>
								<article className='school-hero-highlight-card'>
									<span>Levels</span>
									<strong>{enabledLevels.length ? `${enabledLevels.length} active` : 'Pending'}</strong>
									<small>{enabledLevelSummary}</small>
								</article>
								<article className='school-hero-highlight-card'>
									<span>Brand assets</span>
									<strong>{`${assetCompletionCount}/2 uploaded`}</strong>
									<small>{assetCompletionCount === 2 ? 'Logo and cover are both ready for launch.' : 'Upload the logo and cover to complete the school presentation.'}</small>
								</article>
							</div>

							<div className='builder-stat-grid school-hero-stats'>
								<StatCard label='Schools' value={directory.count} tone='gold' />
								<StatCard label='Active Schools' value={directory.activeCount} tone='teal' />
								<StatCard label='HR Accounts' value={directory.hrAccountCount} tone='teal' />
								<StatCard label='Registerers' value={directory.registererAccountCount} tone='gold' />
							</div>

							<div className='school-hero-launch-note'>
								<div className='school-hero-launch-copy'>
									<span className='pill pill-gold'>Launch team</span>
									<h4>{launchTeamLabel}</h4>
									<p>{lastLaunchSummary}</p>
								</div>
							</div>
						</div>
					</section>

					<section className='section-block' id='school-form'>
						<div className='section-header-row'>
							<div className='section-heading'>
								<span className='section-kicker'>Onboarding</span>
								<h2>Provision the school and its first operators</h2>
							</div>
							<div className='school-code-pill'>
								<span>Preview school code</span>
								<strong>{schoolCodePreview}</strong>
								<p>{`${academicYearLabel} | ${schoolStatusLabel}`}</p>
							</div>
						</div>

						<div className='builder-grid school-builder-grid'>
							<form className='builder-form-panel school-form-panel' onSubmit={handleSubmit}>
								<section className='form-card package-card school-blueprint-card'>
									<div className='compact-heading'>
										<span className='section-kicker'>School blueprint</span>
										<h2>Identity, location, and operating settings</h2>
										<p className='inline-note'>Location codes are generated automatically behind the scenes while this form stays focused on the visible operating profile.</p>
									</div>

									<div className='school-preview-pill-row school-onboarding-strip'>
										<DetailChip label='School code' value={schoolCodePreview} tone='accent' />
										<DetailChip label='Launch IDs' value={`${hrIdPreview} · ${registererIdPreview}`} tone='teal' />
										<DetailChip label='Brand assets' value={`${assetCompletionCount}/2 uploaded`} tone='gold' />
									</div>

									<div className='form-grid two-column'>
										<label className='field'>
											<span>School name</span>
											<input value={form.school.name} onChange={(event) => updateSchoolField('name', event.target.value)} placeholder='School Name' required />
										</label>

										<label className='field'>
											<span>Short name</span>
											<input value={form.school.shortName} onChange={(event) => updateSchoolField('shortName', event.target.value)} placeholder='Code' required />
								
										</label>

										<label className='field'>
											<span>Country</span>
											<select value={form.school.country} onChange={(event) => updateSchoolField('country', event.target.value)}>
												{COUNTRY_OPTIONS.map((option) => (
													<option key={option.code} value={option.value}>
														{option.label}
													</option>
												))}
											</select>
										</label>

										<label className='field'>
											<span>Region</span>
											<select value={form.school.region} onChange={(event) => updateSchoolField('region', event.target.value)} required>
												<option value=''>Select region</option>
												{REGION_OPTIONS.map((option) => (
													<option key={option.code} value={option.value}>
														{option.label}
													</option>
												))}
											</select>
										</label>

										<label className='field'>
											<span>City</span>
											<select value={form.school.city} onChange={(event) => updateSchoolField('city', event.target.value)} required>
												<option value=''>Select city</option>
												{CITY_OPTIONS.map((option) => (
													<option key={option.code} value={option.value}>
														{option.label}
													</option>
												))}
											</select>
										</label>

										<label className='field'>
											<span>Sub-city</span>
											<input value={form.school.subCity} onChange={(event) => updateSchoolField('subCity', event.target.value)} placeholder='Bole' />
										</label>

										<label className='field'>
											<span>Kebele / Woreda</span>
											<input value={form.school.kebele} onChange={(event) => updateSchoolField('kebele', event.target.value)} placeholder='01' />
										</label>

										<label className='field field-span-2'>
											<span>Address line</span>
											<input value={form.school.addressLine} onChange={(event) => updateSchoolField('addressLine', event.target.value)} placeholder='Main campus, near bus station' />
										</label>

										<label className='field'>
											<span>Phone</span>
											<input value={form.school.phone} onChange={(event) => updateSchoolField('phone', event.target.value)} placeholder='+2519...' required />
										</label>

										<label className='field'>
											<span>Alternative phone</span>
											<input value={form.school.alternativePhone} onChange={(event) => updateSchoolField('alternativePhone', event.target.value)} placeholder='+2519...' />
										</label>

										<label className='field'>
											<span>Email</span>
											<input type='email' value={form.school.email} onChange={(event) => updateSchoolField('email', event.target.value)} placeholder='school@example.com' required />
										</label>

										<label className='field'>
											<span>Current academic year</span>
											<input value={form.school.currentAcademicYear} onChange={(event) => updateSchoolField('currentAcademicYear', event.target.value)} placeholder='2026_2027' required />
											
										</label>

										<div className='school-media-grid field-span-2'>
											<div className='school-media-card'>
												<div className='school-media-card-head'>
													<div>
														<span>Logo image</span>
														<strong>{form.school.logoUrl ? 'Stored and ready' : 'Upload square logo'}</strong>
													</div>
													<div className='school-media-state'>{form.school.logoUrl ? 'Stored' : 'Pending'}</div>
												</div>

												<div className={`school-media-preview${form.school.logoUrl ? ' has-image' : ''}`}>
													{form.school.logoUrl ? (
														<img className='school-media-preview-image school-branding-preview' src={form.school.logoUrl} alt='School logo preview' />
													) : (
														<>
															<FaImage />
															<span>Upload a square logo for the directory badge and launch hero.</span>
														</>
													)}
												</div>

												<label className='school-media-upload'>
													<FaImage />
													<span>{assetUploadState.loadingKey === 'logo' ? 'Uploading logo...' : 'Upload logo image'}</span>
													<input
														type='file'
														accept='image/*'
														onChange={(event) => {
															const [file] = event.target.files || []
															void handleSchoolAssetUpload(file, 'logo')
															event.target.value = ''
														}}
														disabled={assetUploadState.loadingKey === 'logo'}
													/>
												</label>
											</div>

											<div className='school-media-card'>
												<div className='school-media-card-head'>
													<div>
														<span>Cover image</span>
														<strong>{form.school.coverImageUrl ? 'Stored and ready' : 'Upload wide cover'}</strong>
													</div>
													<div className='school-media-state'>{form.school.coverImageUrl ? 'Stored' : 'Pending'}</div>
												</div>

												<div className={`school-media-preview${form.school.coverImageUrl ? ' has-image' : ''}`}>
													{form.school.coverImageUrl ? (
														<img className='school-media-preview-image school-branding-preview' src={form.school.coverImageUrl} alt='School cover preview' />
													) : (
														<>
															<FaImage />
															<span>Upload a wide cover image for a stronger launch presentation.</span>
														</>
													)}
												</div>

												<label className='school-media-upload'>
													<FaImage />
													<span>{assetUploadState.loadingKey === 'cover' ? 'Uploading cover...' : 'Upload cover image'}</span>
													<input
														type='file'
														accept='image/*'
														onChange={(event) => {
															const [file] = event.target.files || []
															void handleSchoolAssetUpload(file, 'cover')
															event.target.value = ''
														}}
														disabled={assetUploadState.loadingKey === 'cover'}
													/>
												</label>
											</div>
										</div>
									</div>

									<div className='school-toggle-block'>
										<label className='toggle-field'>
											<input type='checkbox' checked={form.school.active} onChange={(event) => updateSchoolField('active', event.target.checked)} />
											<span>School active on creation</span>
										</label>
									</div>

									<div className='school-selection-grid'>
										<div className='school-selection-card'>
											<p className='config-key'>Languages</p>
											<div className='school-pill-toggle-list'>
												{LANGUAGE_OPTIONS.map((item) => (
													<button className={`school-pill-toggle${form.school.languages[item.key] ? ' is-active' : ''}`} key={item.key} type='button' onClick={() => toggleSchoolSelection('languages', item.key)}>
														{item.label}
													</button>
												))}
											</div>
										</div>

										<div className='school-selection-card'>
											<p className='config-key'>Levels</p>
											<div className='school-pill-toggle-list'>
												{LEVEL_OPTIONS.map((item) => (
													<button className={`school-pill-toggle${form.school.levels[item.key] ? ' is-active' : ''}`} key={item.key} type='button' onClick={() => toggleSchoolSelection('levels', item.key)}>
														{item.label}
													</button>
												))}
											</div>
										</div>
									</div>
								</section>

								<section className='form-card school-account-card school-account-card-hr'>
									<div className='compact-heading'>
										<span className='section-kicker'>Launch HR</span>
										<h2>First HR account</h2>
									</div>

									<div className='form-grid two-column'>
										<label className='field'>
											<span>First name</span>
											<input value={form.hr.firstName} onChange={(event) => updateHrField('firstName', event.target.value)} placeholder='Biruk' required />
										</label>
										<label className='field'>
											<span>Middle name</span>
											<input value={form.hr.middleName} onChange={(event) => updateHrField('middleName', event.target.value)} placeholder='Hunde' />
										</label>
										<label className='field'>
											<span>Last name</span>
											<input value={form.hr.lastName} onChange={(event) => updateHrField('lastName', event.target.value)} placeholder='Tefera' required />
										</label>
										<label className='field'>
											<span>Gender</span>
											<select value={form.hr.gender} onChange={(event) => updateHrField('gender', event.target.value)}>
												{HR_GENDER_OPTIONS.map((option) => (
													<option key={option} value={option}>
														{option}
													</option>
												))}
											</select>
										</label>
										<label className='field'>
											<span>Email</span>
											<input type='email' value={form.hr.email} onChange={(event) => updateHrField('email', event.target.value)} placeholder='hr@example.com' required />
										</label>
										<label className='field'>
											<span>Phone</span>
											<input value={form.hr.phone} onChange={(event) => updateHrField('phone', event.target.value)} placeholder='+2519...' required />
										</label>
										<label className='field'>
											<span>Alternative phone</span>
											<input value={form.hr.alternativePhone} onChange={(event) => updateHrField('alternativePhone', event.target.value)} placeholder='+2519...' />
										</label>
										<label className='field'>
											<span>Position</span>
											<input value={form.hr.position} onChange={(event) => updateHrField('position', event.target.value)} placeholder='HR Manager' />
										</label>
										<label className='field field-span-2'>
											<span>Temporary password</span>
											<input value={form.hr.password} onChange={(event) => updateHrField('password', event.target.value)} placeholder='Set the first HR password' required />
										</label>
										<div className='school-profile-field field-span-2'>
											<div className='school-profile-avatar-wrap'>
												{form.hr.profileImage ? (
													<img className='school-profile-avatar' src={form.hr.profileImage} alt='HR profile preview' />
												) : (
													<div className='school-profile-avatar school-profile-avatar-placeholder'>HR</div>
												)}
											</div>
											<div className='school-profile-content'>
												<span className='config-key'>Profile image</span>
												<strong>HR profile photo</strong>
												<p>Stored in the database and used across the operator directory.</p>
												<label className='school-profile-upload'>
													<FaImage />
													<span>{assetUploadState.loadingKey === 'hr-profile' ? 'Uploading HR image...' : 'Upload HR profile image'}</span>
													<input
														type='file'
														accept='image/*'
														onChange={(event) => {
															const [file] = event.target.files || []
															void handleSchoolAssetUpload(file, 'hr-profile')
															event.target.value = ''
														}}
														disabled={assetUploadState.loadingKey === 'hr-profile'}
													/>
												</label>
											</div>
										</div>
									</div>
								</section>

								<section className='form-card school-account-card school-account-card-registerer'>
									<div className='compact-heading'>
										<span className='section-kicker'>Launch registration</span>
										<h2>First registerer account</h2>
									</div>

									<div className='form-grid two-column'>
										<label className='field'>
											<span>First name</span>
											<input value={form.registerer.firstName} onChange={(event) => updateRegistererField('firstName', event.target.value)} placeholder='Bemnet' required />
										</label>
										<label className='field'>
											<span>Middle name</span>
											<input value={form.registerer.middleName} onChange={(event) => updateRegistererField('middleName', event.target.value)} placeholder='Tilahun' />
										</label>
										<label className='field'>
											<span>Last name</span>
											<input value={form.registerer.lastName} onChange={(event) => updateRegistererField('lastName', event.target.value)} placeholder='Bekele' required />
										</label>
										<label className='field'>
											<span>Gender</span>
											<select value={form.registerer.gender} onChange={(event) => updateRegistererField('gender', event.target.value)}>
												{REGISTRATION_GENDER_OPTIONS.map((option) => (
													<option key={option} value={option}>
														{option}
													</option>
												))}
											</select>
										</label>
										<label className='field'>
											<span>Email</span>
											<input type='email' value={form.registerer.email} onChange={(event) => updateRegistererField('email', event.target.value)} placeholder='register@example.com' required />
										</label>
										<label className='field'>
											<span>Phone</span>
											<input value={form.registerer.phone} onChange={(event) => updateRegistererField('phone', event.target.value)} placeholder='+2519...' required />
										</label>
										<label className='field'>
											<span>Alternative phone</span>
											<input value={form.registerer.alternativePhone} onChange={(event) => updateRegistererField('alternativePhone', event.target.value)} placeholder='+2519...' />
										</label>
										<label className='field'>
											<span>Position</span>
											<input value={form.registerer.position} onChange={(event) => updateRegistererField('position', event.target.value)} placeholder='Registerer' />
										</label>
										<label className='field field-span-2'>
											<span>Temporary password</span>
											<input value={form.registerer.password} onChange={(event) => updateRegistererField('password', event.target.value)} placeholder='Set the first registerer password' required />
										</label>
										<div className='school-profile-field field-span-2'>
											<div className='school-profile-avatar-wrap'>
												{form.registerer.profileImage ? (
													<img className='school-profile-avatar' src={form.registerer.profileImage} alt='Registerer profile preview' />
												) : (
													<div className='school-profile-avatar school-profile-avatar-placeholder'>RG</div>
												)}
											</div>
											<div className='school-profile-content'>
												<span className='config-key'>Profile image</span>
												<strong>Registerer profile photo</strong>
												<p>Stored in the database and used across the registration workspace.</p>
												<label className='school-profile-upload'>
													<FaImage />
													<span>{assetUploadState.loadingKey === 'registerer-profile' ? 'Uploading registerer image...' : 'Upload registerer profile image'}</span>
													<input
														type='file'
														accept='image/*'
														onChange={(event) => {
															const [file] = event.target.files || []
															void handleSchoolAssetUpload(file, 'registerer-profile')
															event.target.value = ''
														}}
														disabled={assetUploadState.loadingKey === 'registerer-profile'}
													/>
												</label>
											</div>
										</div>
									</div>
								</section>

								<div className='submit-row school-submit-row'>
									<div className='school-submit-copy'>
										<strong>{submitState.loading ? 'Provisioning the school and launch operators...' : 'Ready to publish this school launch.'}</strong>
										<span>{lastLaunchSummary}</span>
									</div>
									<div className='school-submit-actions'>
										<button className='primary-action' type='submit' disabled={submitState.loading}>
											{submitState.loading ? 'Provisioning school...' : 'Create school'}
										</button>
									</div>
								</div>
							</form>

							
						</div>
					</section>

					<section className='section-block' id='school-directory'>
						<div className='section-header-row'>
							<div className='section-heading'>
								<span className='section-kicker'>Directory</span>
								<h2>Existing school registry</h2>
							</div>
							<div className='school-directory-tools'>
								<div className='school-directory-tools-top'>
									<div className='school-directory-count'>
										<span className='config-key'>Registry view</span>
										<strong>{directoryCountLabel}</strong>
									</div>
									<button className='school-directory-refresh' type='button' onClick={() => reloadDirectory()}>
										<FaSyncAlt aria-hidden='true' />
										Refresh
									</button>
								</div>
								<div className='filter-bar school-filter-bar'>
									<label className='filter-field school-search-field'>
										<span>
											<FaSearch aria-hidden='true' />
											Search school
										</span>
										<input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder='Search by code, short name, city, or school name' />
									</label>
								</div>
							</div>
						</div>

						{loadState.loading ? (
							<p className='empty-state'>Loading the school registry...</p>
						) : filteredSchools.length ? (
							<div className='catalog-grid school-directory-grid'>
								{filteredSchools.map((school) => (
									<article className='catalog-card school-directory-card' key={school.code}>
										<div className='catalog-meta-row'>
											<span className='pill pill-teal'>{school.shortName || 'Short name pending'}</span>
											<span className={`pill ${school.active ? 'pill-gold' : 'pill-coral'}`}>{school.active ? 'Active' : 'Inactive'}</span>
										</div>
										<h3>{school.name}</h3>
										<div className='school-directory-code-pill'>
											<FaIdBadge aria-hidden='true' />
											<span>{school.code}</span>
										</div>
										<div className='school-directory-meta'>
											<div>
												<span className='config-key'>Location</span>
												<strong>{[school.city, school.region].filter(Boolean).join(', ') || 'Location pending'}</strong>
											</div>
											<div>
												<span className='config-key'>Academic year</span>
												<strong>{formatAcademicYearLabel(school.currentAcademicYear)}</strong>
											</div>
											<div>
												<span className='config-key'>Launch accounts</span>
												<strong>{`${school.hrCount || 0} HR / ${school.registererCount || 0} Registerers`}</strong>
											</div>
										</div>
										<p className='school-directory-date'>Created {formatDateLabel(school.createdAt)}</p>
									</article>
								))}
							</div>
						) : (
							<p className='empty-state'>No schools matched the current filter.</p>
						)}
					</section>
				</div>
			</main>
		</div>
	)
}