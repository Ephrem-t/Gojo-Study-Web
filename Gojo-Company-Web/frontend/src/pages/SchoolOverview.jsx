import { useEffect, useMemo, useState } from 'react'
import {
	FaArrowRight,
	FaBuilding,
	FaChartBar,
	FaCheckCircle,
	FaGraduationCap,
	FaImage,
	FaLayerGroup,
	FaMapMarkerAlt,
	FaPhoneAlt,
	FaSave,
	FaSchool,
	FaSearch,
	FaSyncAlt,
	FaUserTie,
	FaUsers,
} from 'react-icons/fa'
import { Link } from 'react-router-dom'
import CompanySidebar from '../components/CompanySidebar'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '')

const LANGUAGE_OPTIONS = [
	{ key: 'am', label: 'Amharic' },
	{ key: 'en', label: 'English' },
]

const LEVEL_OPTIONS = [
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
		languages: { am: true, en: true },
		levels: { elementary: true, secondary: false },
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
		},
		levels: {
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
		},
		levels: {
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
	return (
		<article className='school-overview-contact-card'>
			<div className='school-overview-contact-top'>
				<div>
					<span>{label}</span>
					<strong>{member.name || member.id}</strong>
				</div>
				<span className={`progress-school-chip${member.status === 'active' ? ' strong' : ''}`}>{member.status || 'active'}</span>
			</div>
			<p>{member.id}</p>
			<div className='school-overview-contact-meta'>
				<span>{member.email || 'Email pending'}</span>
				<span>{member.phone || 'Phone pending'}</span>
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
	const [editor, setEditor] = useState(() => createEditorState())
	const [editorBaseline, setEditorBaseline] = useState('')
	const [saveState, setSaveState] = useState({ loading: false, error: '', success: '' })
	const [uploadState, setUploadState] = useState({ loadingKey: '', error: '', success: '' })

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

	const populationPeak = Math.max(...(charts.population || []).map((item) => Number(item.value) || 0), 0)
	const gradePeak = Math.max(...(charts.grades || []).map((item) => Number(item.studentCount) || 0), 0)
	const leadingPopulation = [...(charts.population || [])].sort((left, right) => (right.value || 0) - (left.value || 0))[0] || null
	const leadingGrade = [...(charts.grades || [])].sort((left, right) => {
		if ((right.studentCount || 0) !== (left.studentCount || 0)) {
			return (right.studentCount || 0) - (left.studentCount || 0)
		}
		return (right.sectionCount || 0) - (left.sectionCount || 0)
	})[0] || null
	const editorPayload = useMemo(() => buildUpdatePayload(editor), [editor])
	const isDirty = Boolean(school) && JSON.stringify(editorPayload) !== editorBaseline
	const totalVisibleSchools = filteredSchools.length

	useEffect(() => {
		loadDirectory()
	}, [])

	useEffect(() => {
		if (!selectedSchoolCode) {
			return
		}
		loadSchoolDetail(selectedSchoolCode)
	}, [selectedSchoolCode])

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
							<span className='eyebrow'>School Intelligence Hub</span>
							<h1>Review every school, open its operational profile, and edit live school information from one screen.</h1>
							<p>
								This workspace combines the school directory, leadership visibility, academic structure signals, and a clean edit
								panel so the company team can manage schools without leaving the dashboard.
							</p>
							<div className='hero-actions'>
								<a className='primary-action' href='#school-directory'>Open school directory</a>
								<a className='secondary-action' href='#school-editor'>Edit active school</a>
							</div>
							<div className='progress-analytics-meta'>
								<div className='progress-hero-note'>
									<strong>Live school scope</strong>
									<span>{directory.count ? `${formatNumber(directory.count)} schools are now visible in the company registry.` : 'No schools have been created yet.'}</span>
								</div>
								<div className='progress-hero-note'>
									<strong>Management flow</strong>
									<span>Pick a school to inspect its counts, graph bars, operator directory, academic years, and editable profile data.</span>
								</div>
							</div>
						</div>

						<div className='school-overview-hero-card'>
							<div className='builder-stat-grid school-overview-hero-stats'>
								<StatCard label='Schools' value={formatNumber(directory.count)} tone='gold' />
								<StatCard label='Active Schools' value={formatNumber(directory.activeCount)} tone='teal' />
								<StatCard label='HR Accounts' value={formatNumber(directory.hrAccountCount)} tone='coral' />
								<StatCard label='Registerers' value={formatNumber(directory.registererAccountCount)} tone='teal' />
							</div>

							<div className='school-overview-hero-spotlight'>
								<div>
									<span className='pill pill-gold'>Selected School</span>
									<h3>{selectedSummary?.name || 'Choose a school from the directory'}</h3>
									<p>
										{selectedSummary
											? `${selectedSummary.city || 'City pending'}, ${selectedSummary.region || 'Region pending'} with ${formatNumber(selectedSummary.studentCount)} students and ${formatNumber(selectedSummary.employeeCount)} employees in the summary view.`
											: 'Once you select a school, the profile panel and analytics cards will update here.'}
									</p>
								</div>
								<div className='school-overview-hero-actions'>
									<button className='secondary-action school-overview-inline-button' type='button' onClick={() => loadDirectory(selectedSchoolCode)}>
										<FaSyncAlt /> Refresh directory
									</button>
									<Link className='primary-action school-overview-inline-button' to='/schools/create'>
										<FaArrowRight /> Create school
									</Link>
								</div>
							</div>
						</div>
					</section>

					<section className='section-block school-overview-panel' id='school-directory'>
						<div className='section-header-row'>
							<div className='section-heading'>
								<span className='section-kicker'>Directory + Detail</span>
								<h2>Switch between schools and inspect the current operating picture</h2>
							</div>
							<p className='progress-section-note'>The selected school drives the graph bars, operator directory, and edit form on the right.</p>
						</div>

						<div className='school-overview-layout'>
							<aside className='catalog-card school-overview-directory-card'>
								<div className='school-overview-directory-head'>
									<div>
										<span className='pill pill-teal'>All Schools</span>
										<h3>Company school directory</h3>
									</div>
									<p>{directory.count ? `Showing ${formatNumber(totalVisibleSchools)} of ${formatNumber(directory.count)} schools.` : 'The directory is waiting for the first school.'}</p>
								</div>
								<label className='school-overview-search'>
									<FaSearch aria-hidden='true' />
									<input
										type='search'
										placeholder='Search by name, code, city, or short name'
										value={searchTerm}
										onChange={(event) => setSearchTerm(event.target.value)}
									/>
								</label>

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
												<div>
													<strong>{schoolItem.name}</strong>
													<span>{schoolItem.code}</span>
												</div>
												<span className={`progress-school-chip${schoolItem.active ? ' strong' : ''}`}>{schoolItem.active ? 'Active' : 'Review'}</span>
											</div>
											<div className='school-overview-directory-item-meta'>
												<span>{schoolItem.city || 'City pending'}</span>
												<span>{formatNumber(schoolItem.studentCount)} students</span>
												<span>{formatNumber(schoolItem.employeeCount)} employees</span>
											</div>
										</button>
									))}
								</div>
							</aside>

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
																<span className='eyebrow'>Active School Profile</span>
																<h3>{school.name}</h3>
																<p>{school.locationLabel || 'Location details are still being completed.'}</p>
															</div>
														</div>
														<div className='school-overview-banner-chips'>
															<span>{school.code}</span>
															<span>{formatAcademicYearLabel(school.currentAcademicYear)}</span>
															<span>{school.active ? 'Active' : 'Review mode'}</span>
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
													<article className='catalog-card'>
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

													<article className='catalog-card school-overview-grades-card'>
														<div className='progress-chart-header'>
															<div className='progress-chart-heading'>
																<span className='pill pill-gold'>Grade Bars</span>
																<h3>Student concentration by grade</h3>
															</div>
															<p>Each grade card balances student totals with the grade structure that already exists in the school setup.</p>
														</div>

														<div className='progress-school-bars'>
															{(charts.grades || []).map((grade, index) => {
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
														</div>
													</article>
												</section>

												<section className='school-overview-meta-grid'>
													<article className='catalog-card school-overview-ops-card'>
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

													<article className='catalog-card school-overview-activity-card'>
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
														<p>This panel saves changes directly back to the active school profile without changing school codes or seeded operator IDs.</p>
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
														<label className='field school-overview-active-field'>
															<span>School status</span>
															<label className='school-overview-inline-check'>
																<input type='checkbox' checked={editor.active} onChange={(event) => updateEditorField('active', event.target.checked)} />
																<span>Keep this school active</span>
															</label>
														</label>
													</div>

													<div className='school-overview-editor-media'>
														<div className='field'>
															<span>Logo URL</span>
															<input type='text' value={editor.logoUrl} onChange={(event) => updateEditorField('logoUrl', event.target.value)} />
														</div>
														<label className='school-overview-upload'>
															<FaImage />
															<span>{uploadState.loadingKey === 'logo' ? 'Uploading logo...' : 'Upload logo image'}</span>
															<input type='file' accept='image/*' onChange={(event) => handleAssetUpload(event.target.files?.[0], 'logo')} />
														</label>
														<div className='field'>
															<span>Cover image URL</span>
															<input type='text' value={editor.coverImageUrl} onChange={(event) => updateEditorField('coverImageUrl', event.target.value)} />
														</div>
														<label className='school-overview-upload'>
															<FaImage />
															<span>{uploadState.loadingKey === 'cover' ? 'Uploading cover...' : 'Upload cover image'}</span>
															<input type='file' accept='image/*' onChange={(event) => handleAssetUpload(event.target.files?.[0], 'cover')} />
														</label>
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

													{uploadState.error ? <div className='form-feedback error'>{uploadState.error}</div> : null}
													{uploadState.success ? <div className='form-feedback success'>{uploadState.success}</div> : null}
													{saveState.error ? <div className='form-feedback error'>{saveState.error}</div> : null}
													{saveState.success ? <div className='form-feedback success'>{saveState.success}</div> : null}

													<div className='school-overview-submit-row'>
														<div className='school-overview-submit-copy'>
															<strong>{isDirty ? 'Unsaved changes are ready to publish.' : 'School information is synced.'}</strong>
															<span>School codes, short names, and seeded operator IDs stay fixed while profile data is updated.</span>
														</div>
														<button className='primary-action school-overview-inline-button' disabled={!isDirty || saveState.loading} type='submit'>
															<FaSave /> {saveState.loading ? 'Saving...' : 'Save school changes'}
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