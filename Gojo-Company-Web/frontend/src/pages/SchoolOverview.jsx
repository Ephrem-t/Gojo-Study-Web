import { useEffect, useMemo, useState } from 'react'
import {
	FaArrowRight,
	FaBuilding,
	FaGraduationCap,
	FaImage,
	FaLayerGroup,
	FaSave,
	FaSchool,
	FaSearch,
	FaSyncAlt,
} from 'react-icons/fa'
import { Link } from 'react-router-dom'
import CompanySidebar from '../components/CompanySidebar'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '')

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

function trimText(value) {
	return String(value || '').trim()
}

function formatAcademicYearLabel(value) {
	const normalized = trimText(value)
	const parts = normalized.split(/[\/_-]+/).filter(Boolean)
	if (parts.length === 2) {
		return `${parts[0]}/${parts[1]}`
	}
	if (parts.length === 1 && /^\d{4}$/.test(parts[0])) {
		return `${parts[0]}/${Number(parts[0]) + 1}`
	}
	return normalized || 'Academic year pending'
}

function formatDateLabel(value) {
	const normalized = trimText(value)
	if (!normalized) {
		return 'Not recorded yet'
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

function formatNumber(value) {
	return new Intl.NumberFormat().format(Number(value) || 0)
}

function formatRatio(value, suffix) {
	if (value === null || value === undefined || Number.isNaN(Number(value))) {
		return 'Not available'
	}
	return `${Number(value).toFixed(1)} ${suffix}`
}

function formatListSummary(values, fallback) {
	const labels = values
		.map((value) => trimText(value))
		.filter(Boolean)

	return labels.length ? labels.join(' • ') : fallback
}

function getInitials(value, fallback = 'NA') {
	const parts = trimText(value)
		.split(/\s+/)
		.filter(Boolean)

	if (!parts.length) {
		return fallback
	}

	return parts
		.slice(0, 2)
		.map((part) => part[0].toUpperCase())
		.join('')
}

function createEditorState() {
	return {
		name: '',
		email: '',
		phone: '',
		alternativePhone: '',
		country: 'Ethiopia',
		region: '',
		city: '',
		subCity: '',
		kebele: '',
		addressLine: '',
		currentAcademicYear: '',
		logoUrl: '',
		coverImageUrl: '',
		active: true,
		languages: { am: true, en: true, om: false },
		levels: { preprimary: false, elementary: true, secondary: false },
	}
}

function createEditorFromSchool(school) {
	if (!school) {
		return createEditorState()
	}

	return {
		name: trimText(school.name),
		email: trimText(school.email),
		phone: trimText(school.phone),
		alternativePhone: trimText(school.alternativePhone),
		country: trimText(school.country) || 'Ethiopia',
		region: trimText(school.region),
		city: trimText(school.city),
		subCity: trimText(school.subCity),
		kebele: trimText(school.kebele),
		addressLine: trimText(school.addressLine),
		currentAcademicYear: trimText(school.currentAcademicYear),
		logoUrl: trimText(school.logoUrl),
		coverImageUrl: trimText(school.coverImageUrl),
		active: Boolean(school.active),
		languages: {
			am: Boolean(school.languages?.am),
			en: Boolean(school.languages?.en),
			om: Boolean(school.languages?.om),
		},
		levels: {
			preprimary: Boolean(school.levels?.preprimary),
			elementary: Boolean(school.levels?.elementary),
			secondary: Boolean(school.levels?.secondary),
		},
	}
}

function buildUpdatePayload(editor) {
	return {
		name: trimText(editor.name),
		email: trimText(editor.email),
		phone: trimText(editor.phone),
		alternativePhone: trimText(editor.alternativePhone),
		country: trimText(editor.country) || 'Ethiopia',
		region: trimText(editor.region),
		city: trimText(editor.city),
		subCity: trimText(editor.subCity),
		kebele: trimText(editor.kebele),
		addressLine: trimText(editor.addressLine),
		currentAcademicYear: trimText(editor.currentAcademicYear),
		logoUrl: trimText(editor.logoUrl),
		coverImageUrl: trimText(editor.coverImageUrl),
		active: Boolean(editor.active),
		languages: {
			am: Boolean(editor.languages?.am),
			en: Boolean(editor.languages?.en),
			om: Boolean(editor.languages?.om),
		},
		levels: {
			preprimary: Boolean(editor.levels?.preprimary),
			elementary: Boolean(editor.levels?.elementary),
			secondary: Boolean(editor.levels?.secondary),
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

function DirectoryMember({ member, label }) {
	const displayName = trimText(member.name) || trimText(member.id) || label
	const badgeText = getInitials(displayName, label.slice(0, 2).toUpperCase())
	const memberId = trimText(member.id)
	const memberRole = trimText(member.position || member.role)
	const contactDetails = [member.email, member.phone].map((value) => trimText(value)).filter(Boolean)

	return (
		<article className='school-overview-contact-card'>
			<div className='school-overview-contact-top'>
				<div className='school-overview-contact-person'>
					<div className='school-overview-contact-avatar'>
						{member.profileImage ? <img alt={displayName} src={member.profileImage} /> : badgeText}
					</div>
					<div>
						<span>{label}</span>
						<strong>{displayName}</strong>
					</div>
				</div>
				<span className={`progress-school-chip${member.status === 'active' ? ' strong' : ''}`}>{member.status || 'active'}</span>
			</div>
			{memberId || memberRole ? (
				<div className='school-overview-contact-stack'>
					{memberId ? <span>{memberId}</span> : null}
					{memberRole ? <span>{memberRole}</span> : null}
				</div>
			) : null}
			<div className='school-overview-contact-meta'>
				{contactDetails.length ? contactDetails.map((item) => <span key={item}>{item}</span>) : <span>Contact details pending</span>}
			</div>
		</article>
	)
}

export default function SchoolOverview() {
	const [directory, setDirectory] = useState({ schools: [], count: 0, activeCount: 0, hrAccountCount: 0, registererAccountCount: 0 })
	const [directoryState, setDirectoryState] = useState({ loading: true, error: '' })
	const [detailState, setDetailState] = useState({ loading: false, error: '', detail: null })
	const [selectedSchoolCode, setSelectedSchoolCode] = useState('')
	const [searchTerm, setSearchTerm] = useState('')
	const [statusFilter, setStatusFilter] = useState('all')
	const [gradeFilter, setGradeFilter] = useState('all')
	const [editor, setEditor] = useState(() => createEditorState())
	const [editorBaseline, setEditorBaseline] = useState('')
	const [saveState, setSaveState] = useState({ loading: false, error: '', success: '' })
	const [uploadState, setUploadState] = useState({ loadingKey: '', error: '', success: '' })

	const filteredSchools = useMemo(() => {
		const query = trimText(searchTerm).toLowerCase()

		return directory.schools.filter((school) => {
			const matchesQuery = !query || [school.name, school.code, school.shortName, school.city, school.region]
				.some((value) => trimText(value).toLowerCase().includes(query))
			const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? Boolean(school.active) : !school.active)
			return matchesQuery && matchesStatus
		})
	}, [directory.schools, searchTerm, statusFilter])

	const selectedSummary = useMemo(
		() => directory.schools.find((school) => school.code === selectedSchoolCode) || null,
		[directory.schools, selectedSchoolCode],
	)
	const school = detailState.detail?.school || null
	const stats = detailState.detail?.stats || {}
	const charts = detailState.detail?.charts || { population: [], grades: [], gender: {} }
	const hrDirectory = detailState.detail?.directories?.hr || []
	const registererDirectory = detailState.detail?.directories?.registerers || []
	const activity = detailState.detail?.activity || { academicYears: [], rollover: null }
	const gradeOptions = useMemo(() => (charts.grades || []).map((grade) => ({
		key: trimText(grade.key) || trimText(grade.label),
		label: trimText(grade.label) || trimText(grade.key) || 'Unnamed grade',
	})), [charts.grades])
	const filteredGrades = useMemo(() => {
		if (gradeFilter === 'all') {
			return charts.grades || []
		}

		return (charts.grades || []).filter((grade) => {
			const gradeKey = trimText(grade.key) || trimText(grade.label)
			return gradeKey === gradeFilter
		})
	}, [charts.grades, gradeFilter])

	const populationPeak = Math.max(...(charts.population || []).map((item) => Number(item.value) || 0), 0)
	const gradePeak = Math.max(...filteredGrades.map((item) => Number(item.studentCount) || 0), 0)
	const leadingPopulation = [...(charts.population || [])].sort((left, right) => (right.value || 0) - (left.value || 0))[0] || null
	const leadingGrade = [...filteredGrades].sort((left, right) => {
		if ((right.studentCount || 0) !== (left.studentCount || 0)) {
			return (right.studentCount || 0) - (left.studentCount || 0)
		}
		return (right.sectionCount || 0) - (left.sectionCount || 0)
	})[0] || null
	const editorPayload = useMemo(() => buildUpdatePayload(editor), [editor])
	const isDirty = Boolean(school) && JSON.stringify(editorPayload) !== editorBaseline
	const totalVisibleSchools = filteredSchools.length
	const operatorPortfolioCount = directory.hrAccountCount + directory.registererAccountCount
	const selectedLocation = [selectedSummary?.city, selectedSummary?.region].filter((value) => trimText(value)).join(', ') || 'Awaiting school selection'
	const selectedStatusLabel = selectedSummary ? (selectedSummary.active ? 'System access enabled' : 'System access blocked') : 'Selection pending'
	const directoryFilterLabel = statusFilter === 'active' ? 'Active schools' : statusFilter === 'inactive' ? 'Inactive schools' : 'All schools'
	const accessStatusChanged = Boolean(school) && editor.active !== Boolean(school.active)
	const accessStatusLabel = editor.active ? 'Active' : 'Inactive'
	const accessStatusSummary = accessStatusChanged
		? editor.active
			? 'Save to reactivate this school and allow it to use the system again.'
			: 'Save to block this school from using the system.'
		: editor.active
			? 'This school is currently allowed to use the system.'
			: 'This school is currently blocked from using the system.'
	const submitButtonLabel = saveState.loading
		? 'Saving...'
		: accessStatusChanged
			? editor.active
				? 'Save and activate school'
				: 'Save and deactivate school'
			: 'Save school changes'

	useEffect(() => {
		loadDirectory()
	}, [])

	useEffect(() => {
		if (!selectedSchoolCode) {
			return
		}
		loadSchoolDetail(selectedSchoolCode)
	}, [selectedSchoolCode])

	useEffect(() => {
		setGradeFilter('all')
	}, [selectedSchoolCode])

	useEffect(() => {
		if (!filteredSchools.length) {
			return
		}

		if (!selectedSchoolCode || !filteredSchools.some((school) => school.code === selectedSchoolCode)) {
			setSelectedSchoolCode(filteredSchools[0].code)
		}
	}, [filteredSchools, selectedSchoolCode])

	async function loadDirectory(preferredSchoolCode = '') {
		setDirectoryState({ loading: true, error: '' })

		try {
			const response = await fetch(`${API_BASE_URL}/api/schools`)
			const data = await response.json()
			if (!response.ok) {
				throw new Error(data.error || 'Unable to load schools')
			}

			const schools = Array.isArray(data.schools) ? data.schools : []
			setDirectory({
				schools,
				count: Number(data.count) || 0,
				activeCount: Number(data.activeCount) || 0,
				hrAccountCount: Number(data.hrAccountCount) || 0,
				registererAccountCount: Number(data.registererAccountCount) || 0,
			})
			setDirectoryState({ loading: false, error: '' })

			const nextSelection = preferredSchoolCode && schools.some((school) => school.code === preferredSchoolCode)
				? preferredSchoolCode
				: selectedSchoolCode && schools.some((school) => school.code === selectedSchoolCode)
					? selectedSchoolCode
					: schools[0]?.code || ''

			setSelectedSchoolCode((current) => current || nextSelection)
			if (!selectedSchoolCode && nextSelection) {
				setSelectedSchoolCode(nextSelection)
			}
		} catch (error) {
			setDirectoryState({ loading: false, error: error.message || 'Unable to connect to backend' })
		}
	}

	async function loadSchoolDetail(schoolCode) {
		setDetailState((current) => ({ ...current, loading: true, error: '' }))
		setSaveState({ loading: false, error: '', success: '' })

		try {
			const response = await fetch(`${API_BASE_URL}/api/schools/${schoolCode}`)
			const data = await response.json()
			if (!response.ok) {
				throw new Error(data.error || 'Unable to load school details')
			}

			const nextEditor = createEditorFromSchool(data.school)
			setDetailState({ loading: false, error: '', detail: data })
			setEditor(nextEditor)
			setEditorBaseline(JSON.stringify(buildUpdatePayload(nextEditor)))
		} catch (error) {
			setDetailState({ loading: false, error: error.message || 'Unable to connect to backend', detail: null })
			setEditor(createEditorState())
			setEditorBaseline('')
		}
	}

	function updateEditorField(field, value) {
		setEditor((current) => ({
			...current,
			[field]: value,
		}))
	}

	function setSchoolAccessStatus(nextActive) {
		setEditor((current) => ({
			...current,
			active: nextActive,
		}))
		setSaveState((current) => ({
			...current,
			error: '',
			success: '',
		}))
	}

	function toggleSelection(groupKey, optionKey) {
		setEditor((current) => ({
			...current,
			[groupKey]: {
				...current[groupKey],
				[optionKey]: !current[groupKey][optionKey],
			},
		}))
	}

	async function handleAssetUpload(file, assetType) {
		if (!file || !school) {
			return
		}

		setUploadState({ loadingKey: assetType, error: '', success: '' })

		try {
			const body = new FormData()
			body.append('file', file)
			body.append('assetType', assetType)
			body.append('schoolShortName', school.shortName || selectedSummary?.shortName || 'school')

			const response = await fetch(`${API_BASE_URL}/api/schools/upload-asset`, {
				method: 'POST',
				body,
			})
			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'Asset upload failed')
			}

			const uploadedUrl = trimText(data.url || data.downloadUrl || data.publicUrl)
			if (!uploadedUrl) {
				throw new Error('Upload succeeded but no URL was returned')
			}

			if (assetType === 'logo') {
				updateEditorField('logoUrl', uploadedUrl)
			} else if (assetType === 'cover') {
				updateEditorField('coverImageUrl', uploadedUrl)
			}

			setUploadState({ loadingKey: '', error: '', success: `${assetType === 'logo' ? 'Logo' : 'Cover'} updated.` })
		} catch (error) {
			setUploadState({ loadingKey: '', error: error.message || 'Asset upload failed', success: '' })
		}
	}

	async function handleSave(event) {
		event.preventDefault()
		if (!selectedSchoolCode) {
			return
		}

		setSaveState({ loading: true, error: '', success: '' })

		try {
			const response = await fetch(`${API_BASE_URL}/api/schools/${selectedSchoolCode}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ school: editorPayload }),
			})
			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'Unable to save school information')
			}

			const refreshedDetail = data.detail || null
			if (refreshedDetail?.school) {
				const nextEditor = createEditorFromSchool(refreshedDetail.school)
				setDetailState({ loading: false, error: '', detail: refreshedDetail })
				setEditor(nextEditor)
				setEditorBaseline(JSON.stringify(buildUpdatePayload(nextEditor)))
			}

			setSaveState({ loading: false, error: '', success: 'School information updated successfully.' })
			await loadDirectory(selectedSchoolCode)
		} catch (error) {
			setSaveState({ loading: false, error: error.message || 'Unable to save school information', success: '' })
		}
	}

	return (
		<div className='google-dashboard'>
			<CompanySidebar />
			<main className='google-main company-main'>
				<div className='exam-shell builder-shell school-overview-shell'>
					<section className='hero-panel school-hero-panel school-overview-hero'>
						<div className='hero-copy school-overview-hero-copy'>
							<div className='school-overview-hero-kicker-row'>
								<span className='eyebrow'>School Intelligence Hub</span>
								<span className='school-overview-hero-live-chip'>{selectedSummary?.active ? 'School access enabled' : 'School access blocked'}</span>
							</div>
							<h1>Manage the school directory.</h1>
							<p>
								Focus on the active school, review the core analytics, and publish profile or access changes without leaving the dashboard.
							</p>
							<div className='hero-actions'>
								<a className='primary-action' href='#school-directory'>Open school directory</a>
								<a className='secondary-action' href='#school-editor'>Edit selected school</a>
							</div>
						</div>

						<div className='school-overview-hero-card'>
							<div className='school-overview-hero-card-top'>
								<div>
									<span className='pill pill-gold'>Executive Snapshot</span>
									<h3>{selectedSummary?.name || 'Choose a school from the directory'}</h3>
									<p>
										{selectedSummary
											? `${selectedLocation}. ${selectedStatusLabel}. Analytics and editing below are focused on this school.`
											: 'Once a school is selected, its summary deck, analytics, and editor all update together.'}
									</p>
								</div>
								<div className='school-overview-hero-card-badge'>
									<span>School code</span>
									<strong>{selectedSummary?.code || 'Pending selection'}</strong>
									<small>{selectedSummary?.shortName || 'Company registry'}</small>
								</div>
							</div>

							<div className='builder-stat-grid school-overview-hero-stats'>
								<StatCard label='Schools' value={formatNumber(directory.count)} tone='gold' />
								<StatCard label='Active Schools' value={formatNumber(directory.activeCount)} tone='teal' />
								</div>
						</div>
					</section>

					<section className='section-block school-overview-panel' id='school-directory'>
						<div className='section-header-row'>
							<div className='section-heading'>
								<span className='section-kicker'>Directory + Detail</span>
								<h2>Switch between schools and inspect the current operating picture</h2>
							</div>
							<p className='progress-section-note'>Select a school to load its analytics and editing workspace.</p>
						</div>

						<div className='school-overview-layout'>
							<section className='catalog-card school-overview-directory-card school-overview-directory-rail-card'>
								<div className='school-overview-directory-head'>
									<div className='school-overview-directory-head-top'>
										<div>
											<span className='pill pill-teal'>All Schools</span>
											<h3>Choose a school</h3>
										</div>
										<button className='school-overview-ghost-action' type='button' onClick={() => loadDirectory(selectedSchoolCode)}>
											<FaSyncAlt /> Refresh
										</button>
									</div>
									<p>{directory.count ? `${directoryFilterLabel} · ${formatNumber(totalVisibleSchools)} of ${formatNumber(directory.count)} visible.` : 'The directory is waiting for the first school.'}</p>
								</div>

								<div className='school-overview-directory-toolbar'>
									<label className='school-overview-search'>
										<FaSearch aria-hidden='true' />
										<input
											type='search'
											placeholder='Search by name, code, city, or short name'
											value={searchTerm}
											onChange={(event) => setSearchTerm(event.target.value)}
										/>
									</label>
									<label className='school-overview-filter'>
										<span>Show</span>
										<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
											<option value='all'>All schools</option>
											<option value='active'>Active only</option>
											<option value='inactive'>Inactive only</option>
										</select>
									</label>
									<div className='school-overview-directory-metrics'>
										<div>
											<span>Visible</span>
											<strong>{formatNumber(totalVisibleSchools)}</strong>
										</div>
										<div>
											<span>Operators</span>
											<strong>{formatNumber(operatorPortfolioCount)}</strong>
										</div>
									</div>
								</div>

								{directoryState.loading ? <div className='school-overview-empty'>Loading school directory...</div> : null}
								{directoryState.error ? <div className='form-feedback error'>{directoryState.error}</div> : null}

								{!directoryState.loading && !directoryState.error && !filteredSchools.length ? (
									<div className='school-overview-empty'>
										<p>No schools match the current search.</p>
										{directory.count ? null : <Link to='/schools/create'>Create the first school</Link>}
									</div>
								) : null}

								<div className='school-overview-directory-list'>
									{filteredSchools.map((schoolItem) => (
										<button
											className={`school-overview-directory-item${selectedSchoolCode === schoolItem.code ? ' is-active' : ''}`}
											key={schoolItem.code}
											type='button'
											onClick={() => setSelectedSchoolCode(schoolItem.code)}
										>
											<div className='school-overview-directory-item-top'>
												<div className='school-overview-directory-badge'>
													{schoolItem.logoUrl ? <img alt={schoolItem.name} src={schoolItem.logoUrl} /> : <FaSchool />}
												</div>
												<div className='school-overview-directory-item-copy'>
													<div className='school-overview-directory-item-header'>
														<strong>{schoolItem.name}</strong>
														<span className={`progress-school-chip${schoolItem.active ? ' strong' : ''}`}>{schoolItem.active ? 'Active' : 'Inactive'}</span>
													</div>
													<span>{schoolItem.code}</span>
												</div>
											</div>
											<div className='school-overview-directory-item-meta'>
												<span>{schoolItem.city || 'City pending'}</span>
												<span>{formatNumber(schoolItem.studentCount)} students</span>
												<span>{formatNumber(schoolItem.employeeCount)} employees</span>
											</div>
										</button>
									))}
								</div>
							</section>

							<div className='school-overview-detail-stack'>
								{!directory.count && !directoryState.loading ? (
									<div className='catalog-card school-overview-empty-state'>
										<h3>There are no schools in the registry yet.</h3>
										<p>Create the first school to unlock this management dashboard.</p>
										<Link className='primary-action school-overview-inline-button' to='/schools/create'>
											<FaArrowRight /> Open school registry
										</Link>
									</div>
								) : null}

								{directory.count ? (
									<>
										{detailState.loading ? <div className='catalog-card school-overview-loading'>Loading school analytics...</div> : null}
										{detailState.error ? <div className='form-feedback error'>{detailState.error}</div> : null}

										{school ? (
											<>
												<section
													className='catalog-card school-overview-banner'
													style={
														school.coverImageUrl
															? {
																backgroundImage: `linear-gradient(135deg, rgba(8, 15, 30, 0.78), rgba(15, 118, 110, 0.72)), url(${school.coverImageUrl})`,
															}
															: undefined
													}
												>
													<div className='school-overview-banner-head'>
														<div className='school-overview-banner-brand'>
															<div className='school-overview-banner-logo'>
																{school.logoUrl ? <img alt={school.name} src={school.logoUrl} /> : <FaBuilding />}
															</div>
															<div>
																<span className='eyebrow'>{school.active ? 'Active School Profile' : 'Inactive School Profile'}</span>
																<h3>{school.name}</h3>
																<p>{school.locationLabel || 'Location details are still being completed.'}</p>
															</div>
														</div>
														<div className='school-overview-banner-chips'>
															<span>{school.code}</span>
															<span>{formatAcademicYearLabel(school.currentAcademicYear)}</span>
															<span>{school.active ? 'Active' : 'Inactive'}</span>
														</div>
													</div>
													<div className='builder-stat-grid school-overview-banner-stats'>
														<StatCard label='Students' value={formatNumber(stats.studentCount)} tone='teal' />
														<StatCard label='Employees' value={formatNumber(stats.employeeCount)} tone='gold' />
														<StatCard label='Teachers' value={formatNumber(stats.teacherCount)} tone='coral' />
														<StatCard label='Academic Years' value={formatNumber(stats.academicYearCount)} tone='teal' />
													</div>
													<div className='progress-chart-signal-row school-overview-signal-row'>
														<div className='progress-chart-signal-card accent-teal'>
															<span>Leading Population</span>
															<strong>{leadingPopulation ? leadingPopulation.label : 'No data yet'}</strong>
															<small>{leadingPopulation ? `${formatNumber(leadingPopulation.value)} records currently lead this school profile.` : 'Population bars will appear once data exists.'}</small>
														</div>
														<div className='progress-chart-signal-card accent-gold'>
															<span>Top Grade</span>
															<strong>{leadingGrade ? leadingGrade.label : 'No grade data yet'}</strong>
															<small>{leadingGrade ? `${formatNumber(leadingGrade.studentCount)} students and ${formatNumber(leadingGrade.sectionCount)} sections are visible here.` : 'Grade bars will appear when student or grade data exists.'}</small>
														</div>
														<div className='progress-chart-signal-card accent-coral'>
															<span>Student Teacher Ratio</span>
															<strong>{formatRatio(stats.studentTeacherRatio, 'students / teacher')}</strong>
															<small>Based on the current school student and teacher records in Firebase.</small>
														</div>
														<div className='progress-chart-signal-card'>
															<span>Last Updated</span>
															<strong>{formatDateLabel(school.updatedAt || school.createdAt)}</strong>
															<small>{school.phone || 'Phone not set'} · {school.email || 'Email not set'}</small>
														</div>
													</div>
											</section>

												<section className='school-overview-analytics-grid'>
													<article className='catalog-card school-overview-analytics-card school-overview-volume-card'>
														<div className='progress-chart-header'>
															<div className='progress-chart-heading'>
																<span className='pill pill-teal'>Population Bars</span>
																<h3>Operational volume across the school</h3>
															</div>
															<p>This chart compares the major school record groups so the company team can spot the current scale instantly.</p>
														</div>

														<div className='progress-bar-list'>
															{(charts.population || []).map((item) => (
																<div className={`progress-bar-row${leadingPopulation?.key === item.key ? ' is-leading' : ''}`} key={item.key}>
																	<div className='progress-bar-copy'>
																		<div className='progress-bar-title-row'>
																			<strong>{item.label}</strong>
																			{leadingPopulation?.key === item.key ? <span className='progress-bar-badge'>Lead</span> : null}
																		</div>
																		<span>{formatNumber(item.value)} total records for this school node.</span>
																	</div>
																	<div className='progress-bar-track'>
																		<div className='progress-bar-fill tone-teal' style={{ width: `${populationPeak ? Math.max((item.value / populationPeak) * 100, 10) : 0}%` }} />
																	</div>
																	<div className='progress-bar-value'>
																		<strong>{formatNumber(item.value)}</strong>
																		<span>{populationPeak ? `${Math.round((item.value / populationPeak) * 100)}% of peak` : 'No share yet'}</span>
																	</div>
																</div>
															))}
														</div>
													</article>

													<article className='catalog-card school-overview-analytics-card school-overview-grades-card'>
														<div className='progress-chart-header'>
															<div className='progress-chart-heading'>
																<span className='pill pill-gold'>Grade Bars</span>
																<h3>Student concentration by grade</h3>
															</div>
															<p>Each grade card balances student totals with the grade structure that already exists in the school setup.</p>
														</div>

														<div className='school-overview-grade-filter-row'>
															<label className='school-overview-filter school-overview-grade-filter'>
																<span>Grade</span>
																<select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)}>
																	<option value='all'>All grades</option>
																	{gradeOptions.map((option) => (
																		<option key={option.key} value={option.key}>{option.label}</option>
																	))}
																</select>
															</label>
															<span className='school-overview-grade-filter-count'>
																Showing {formatNumber(filteredGrades.length)} of {formatNumber(charts.grades?.length || 0)} grades
															</span>
														</div>

														<div className='progress-school-bars'>
															{filteredGrades.map((grade, index) => {
																const studentCount = Number(grade.studentCount) || 0
																const height = gradePeak ? Math.max((studentCount / gradePeak) * 100, studentCount ? 16 : 10) : 12
																return (
																	<article className={`progress-school-bar-card${leadingGrade?.label === grade.label ? ' is-leading' : ''}`} key={grade.key || grade.label}>
																		<div className='progress-school-card-top'>
																			<span className='progress-school-rank'>#{index + 1}</span>
																			<span className='progress-school-share'>{formatNumber(studentCount)} students</span>
																		</div>
																		<div className='progress-school-bar-track'>
																			<div className='progress-school-bar-fill' style={{ height: `${height}%` }}>
																				<span className='progress-school-bar-value'>{formatNumber(studentCount)}</span>
																			</div>
																		</div>
																		<div className='progress-school-card-copy'>
																			<strong>{grade.label}</strong>
																			<span>{formatNumber(grade.sectionCount)} sections and {formatNumber(grade.subjectCount)} subjects mapped to this grade.</span>
																		</div>
																		<div className='progress-school-card-stats'>
																			<span className='progress-school-chip strong'>{formatNumber(grade.studentCount)} students</span>
																			<span className='progress-school-chip'>{formatNumber(grade.sectionCount)} sections</span>
																			<span className='progress-school-chip'>{formatNumber(grade.subjectCount)} subjects</span>
																		</div>
																		<small>{leadingGrade?.label === grade.label ? 'Most concentrated grade in this school' : 'School grade structure snapshot'}</small>
																	</article>
																)
															})}
															{!filteredGrades.length ? <div className='school-overview-empty'>No grades match the current filter.</div> : null}
														</div>
													</article>
												</section>

												<section className='school-overview-meta-grid'>
													<article className='catalog-card school-overview-meta-card school-overview-ops-card'>
														<div className='progress-chart-header'>
															<div className='progress-chart-heading'>
																<span className='pill pill-coral'>Team Directory</span>
																<h3>Operator visibility</h3>
															</div>
															<p>Review the first-line school operators that were seeded or connected to this school node.</p>
														</div>

														<div className='school-overview-contact-grid'>
															{hrDirectory.map((member) => <DirectoryMember key={member.id} label='HR Lead' member={member} />)}
															{registererDirectory.map((member) => <DirectoryMember key={member.id} label='Registerer' member={member} />)}
															{!hrDirectory.length && !registererDirectory.length ? <div className='school-overview-empty'>No operator records were found for this school yet.</div> : null}
														</div>

														<div className='school-overview-gender-row'>
															<div className='school-overview-mini-stat'>
																<span>Male Students</span>
																<strong>{formatNumber(charts.gender?.male)}</strong>
															</div>
															<div className='school-overview-mini-stat'>
																<span>Female Students</span>
																<strong>{formatNumber(charts.gender?.female)}</strong>
															</div>
															<div className='school-overview-mini-stat'>
																<span>Unspecified</span>
																<strong>{formatNumber(charts.gender?.unspecified)}</strong>
															</div>
														</div>
													</article>

													<article className='catalog-card school-overview-meta-card school-overview-activity-card'>
														<div className='progress-chart-header'>
															<div className='progress-chart-heading'>
																<span className='pill pill-teal'>School Activity</span>
																<h3>Academic year timeline</h3>
															</div>
															<p>Track the current academic year state and the most recent rollover activity from the school node.</p>
														</div>

														<div className='school-overview-year-list'>
															{(activity.academicYears || []).map((year) => (
																<div className={`school-overview-year-item${year.isCurrent ? ' is-current' : ''}`} key={year.key}>
																	<div>
																		<strong>{year.label}</strong>
																		<span>{year.status || 'active'}</span>
																	</div>
																	<small>{year.isCurrent ? 'Current year' : formatDateLabel(year.updatedAt)}</small>
																</div>
															))}
															{!(activity.academicYears || []).length ? <div className='school-overview-empty'>No academic year history is available yet.</div> : null}
														</div>

														<div className='school-overview-rollover-card'>
															<span>Latest rollover</span>
															<strong>{activity.rollover?.status || 'not-started'}</strong>
															<p>
																{activity.rollover?.createdAt
																	? `Started ${formatDateLabel(activity.rollover.createdAt)}${activity.rollover.targetYear ? ` targeting ${formatAcademicYearLabel(activity.rollover.targetYear)}` : ''}.`
																	: 'No rollover history has been recorded for this school yet.'}
															</p>
														</div>
													</article>
												</section>

												<form className='catalog-card school-overview-editor-card' id='school-editor' onSubmit={handleSave}>
													<div className='progress-chart-header'>
														<div className='progress-chart-heading'>
															<span className='pill pill-gold'>Edit School</span>
															<h3>Update school information</h3>
														</div>
														<p>Update the selected school profile and publish access changes from one clean editor.</p>
													</div>

													<div className='school-overview-editor-status-grid'>
														<article className='school-overview-editor-status-card accent-teal'>
															<span>Save state</span>
															<strong>{isDirty ? 'Pending publish' : 'Synced'}</strong>
															<p>{isDirty ? 'Changes are staged locally until you publish this form.' : 'The live school profile already matches the current editor state.'}</p>
														</article>
														<article className={`school-overview-editor-status-card ${editor.active ? 'accent-teal' : 'accent-coral'}`}>
															<span>System access</span>
															<strong>{accessStatusLabel}</strong>
															<p>{accessStatusSummary}</p>
														</article>
												</div>

													<div className='school-overview-editor-sections'>
														<section className='school-overview-editor-section'>
															<div className='school-overview-editor-section-head'>
																<span>Identity and contact</span>
																<h4>Keep the public-facing school identity polished and reachable.</h4>
															<p>These details appear across the directory and the selected-school header.</p>
															</div>
															<div className='school-overview-editor-grid'>
																<label className='field'>
																	<span>School name</span>
																	<input type='text' value={editor.name} onChange={(event) => updateEditorField('name', event.target.value)} />
																</label>
																<label className='field'>
																	<span>Contact email</span>
																	<input type='email' value={editor.email} onChange={(event) => updateEditorField('email', event.target.value)} />
																</label>
																<label className='field'>
																	<span>Phone</span>
																	<input type='text' value={editor.phone} onChange={(event) => updateEditorField('phone', event.target.value)} />
																</label>
																<label className='field'>
																	<span>Alternative phone</span>
																	<input type='text' value={editor.alternativePhone} onChange={(event) => updateEditorField('alternativePhone', event.target.value)} />
																</label>
															</div>
														</section>

														<section className='school-overview-editor-section'>
															<div className='school-overview-editor-section-head'>
																<span>Location and operations</span>
																<h4>Control the location footprint and live operating status.</h4>
																<p>Keep the school discoverable, aligned to the right academic year, and active or inactive in the system.</p>
															</div>
															<div className='school-overview-editor-grid'>
																<label className='field'>
																	<span>Country</span>
																	<input type='text' value={editor.country} onChange={(event) => updateEditorField('country', event.target.value)} />
																</label>
																<label className='field'>
																	<span>Region</span>
																	<input type='text' value={editor.region} onChange={(event) => updateEditorField('region', event.target.value)} />
																</label>
																<label className='field'>
																	<span>City</span>
																	<input type='text' value={editor.city} onChange={(event) => updateEditorField('city', event.target.value)} />
																</label>
																<label className='field'>
																	<span>Sub city</span>
																	<input type='text' value={editor.subCity} onChange={(event) => updateEditorField('subCity', event.target.value)} />
																</label>
																<label className='field'>
																	<span>Kebele</span>
																	<input type='text' value={editor.kebele} onChange={(event) => updateEditorField('kebele', event.target.value)} />
																</label>
																<label className='field'>
																	<span>Address line</span>
																	<input type='text' value={editor.addressLine} onChange={(event) => updateEditorField('addressLine', event.target.value)} />
																</label>
																<label className='field'>
																	<span>Current academic year</span>
																	<input type='text' value={editor.currentAcademicYear} onChange={(event) => updateEditorField('currentAcademicYear', event.target.value)} placeholder='2026_2027' />
																</label>
																<div className='field school-overview-active-field'>
																	<span>System access</span>
																	<div aria-label='School access status' className='school-overview-status-toggle' role='group'>
																		<button
																			className={`school-overview-status-button school-overview-status-button-allow${editor.active ? ' is-active' : ''}`}
																			type='button'
																			onClick={() => setSchoolAccessStatus(true)}
																		>
																			Active
																		</button>
																		<button
																			className={`school-overview-status-button school-overview-status-button-block${!editor.active ? ' is-active' : ''}`}
																			type='button'
																			onClick={() => setSchoolAccessStatus(false)}
																		>
																			Inactive
																		</button>
																	</div>
																	<small className='field-hint'>{accessStatusSummary}</small>
																</div>
															</div>
														</section>

														<section className='school-overview-editor-section'>
															<div className='school-overview-editor-section-head'>
																<span>Visual identity</span>
																<h4>Keep the banner and directory imagery sharp and consistent.</h4>
																<p>Upload the two core school images used across the profile.</p>
															</div>

															<div className='school-overview-editor-media'>
																<article className='school-overview-media-card'>
																	<div className='school-overview-media-card-head'>
																		<div>
																			<span>Logo image</span>
																			<strong>{editor.logoUrl ? 'Stored and ready' : 'No logo uploaded yet'}</strong>
																		</div>
																		<div className='school-overview-media-state'>{editor.logoUrl ? 'Stored' : 'Pending'}</div>
																	</div>

																	<div className={`school-overview-media-preview${editor.logoUrl ? ' has-image' : ''}`}>
																		{editor.logoUrl ? (
																			<img alt='School logo preview' className='school-overview-media-preview-image' src={editor.logoUrl} />
																		) : (
																			<>
																				<FaImage />
																				<span>Upload a square logo for the directory badge and hero brand mark.</span>
																			</>
																		)}
																	</div>

																	<label className='school-overview-upload'>
																		<FaImage />
																		<span>{uploadState.loadingKey === 'logo' ? 'Uploading logo...' : 'Upload logo image'}</span>
																		<input type='file' accept='image/*' onChange={(event) => handleAssetUpload(event.target.files?.[0], 'logo')} />
																	</label>
																</article>

																<article className='school-overview-media-card'>
																	<div className='school-overview-media-card-head'>
																		<div>
																			<span>Cover image</span>
																			<strong>{editor.coverImageUrl ? 'Stored and ready' : 'No cover uploaded yet'}</strong>
																		</div>
																		<div className='school-overview-media-state'>{editor.coverImageUrl ? 'Stored' : 'Pending'}</div>
																	</div>

																	<div className={`school-overview-media-preview${editor.coverImageUrl ? ' has-image' : ''}`}>
																		{editor.coverImageUrl ? (
																			<img alt='School cover preview' className='school-overview-media-preview-image' src={editor.coverImageUrl} />
																		) : (
																			<>
																				<FaImage />
																				<span>Upload a wide cover image to elevate the hero banner and school profile.</span>
																			</>
																		)}
																	</div>

																	<label className='school-overview-upload'>
																		<FaImage />
																		<span>{uploadState.loadingKey === 'cover' ? 'Uploading cover...' : 'Upload cover image'}</span>
																		<input type='file' accept='image/*' onChange={(event) => handleAssetUpload(event.target.files?.[0], 'cover')} />
																	</label>
																</article>
															</div>
														</section>

														<section className='school-overview-editor-section'>
															<div className='school-overview-editor-section-head'>
																<span>Academic signal system</span>
																<h4>Keep the school profile aligned with its academic structure.</h4>
																<p>Keep the visible levels and languages aligned with the current setup.</p>
															</div>

															<div className='school-overview-toggle-groups'>
																<div className='school-overview-toggle-group'>
																	<div className='school-overview-toggle-head'>
																		<FaGraduationCap />
																		<div>
																			<strong>Academic Levels</strong>
																			<span>Control which levels are signaled on the school profile.</span>
																		</div>
																	</div>
																	<div className='school-overview-toggle-list'>
																		{LEVEL_OPTIONS.map((option) => (
																			<button className={`school-overview-toggle-pill${editor.levels[option.key] ? ' is-active' : ''}`} key={option.key} type='button' onClick={() => toggleSelection('levels', option.key)}>
																				{option.label}
																			</button>
																		))}
																	</div>
																</div>

																<div className='school-overview-toggle-group'>
																	<div className='school-overview-toggle-head'>
																		<FaLayerGroup />
																		<div>
																			<strong>School Languages</strong>
																			<span>Keep the school language indicators aligned with its current setup.</span>
																		</div>
																	</div>
																	<div className='school-overview-toggle-list'>
																		{LANGUAGE_OPTIONS.map((option) => (
																			<button className={`school-overview-toggle-pill${editor.languages[option.key] ? ' is-active' : ''}`} key={option.key} type='button' onClick={() => toggleSelection('languages', option.key)}>
																				{option.label}
																			</button>
																		))}
																	</div>
																</div>
															</div>
														</section>
													</div>

													{uploadState.error ? <div className='form-feedback error'>{uploadState.error}</div> : null}
													{uploadState.success ? <div className='form-feedback success'>{uploadState.success}</div> : null}
													{saveState.error ? <div className='form-feedback error'>{saveState.error}</div> : null}
													{saveState.success ? <div className='form-feedback success'>{saveState.success}</div> : null}

													<div className='school-overview-submit-row'>
														<div className='school-overview-submit-copy'>
															<strong>{isDirty ? 'Unsaved changes are ready to publish.' : 'School information is synced.'}</strong>
															<span>School codes, short names, and seeded operator IDs stay fixed while profile data and access status are updated.</span>
														</div>
														<button className='primary-action school-overview-inline-button' disabled={!isDirty || saveState.loading} type='submit'>
															<FaSave /> {submitButtonLabel}
														</button>
													</div>
												</form>
											</>
										) : null}
									</>
								) : null}
							</div>
						</div>
					</section>
				</div>
			</main>
		</div>
	)
}