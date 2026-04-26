import { useEffect, useMemo, useState } from 'react'
import { FaArrowRight, FaBook, FaFilePdf, FaFilter, FaLayerGroup } from 'react-icons/fa'
import { Link } from 'react-router-dom'
import CompanySidebar from '../components/CompanySidebar'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '')

const gradeOptions = ['grade1', 'grade2', 'grade3', 'grade4', 'grade5', 'grade6', 'grade7', 'grade8', 'grade9', 'grade10', 'grade11', 'grade12']

function createUnit(index) {
	return {
		key: `unit${index}`,
		title: '',
		pdfUrl: '',
	}
}

const defaultForm = {
	gradeKey: 'grade1',
	subjectName: '',
	subjectKey: '',
	textbook: {
		title: '',
		language: 'English',
		region: 'national',
		coverUrl: '',
		units: [createUnit(1)],
	},
}

function trimText(value) {
	return String(value || '').trim()
}

function hasContent(value) {
	return trimText(value).length > 0
}

function normalizeGradeKey(value) {
	const normalized = trimText(value).toLowerCase()
	if (normalized.startsWith('grade')) {
		return normalized
	}

	const match = normalized.match(/(\d+)/)
	return match ? `grade${match[1]}` : normalized
}

function normalizeSubjectKey(value) {
	return trimText(value)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
}

function normalizeUnitKey(value, fallback = 'unit1') {
	const normalized = trimText(value)
		.replace(/[^A-Za-z0-9_.-]+/g, '_')
		.replace(/^_+|_+$/g, '')

	return normalized || fallback
}

function deriveUnitTitleFromFileName(fileName, fallback = 'Untitled unit') {
	const baseName = trimText(fileName).replace(/\.[^.]+$/, '')
	if (!baseName) {
		return fallback
	}

	return baseName
		.replace(/[_-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

function formatGradeLabel(value) {
	const match = String(value || '').match(/(\d+)/)
	return match ? `Grade ${match[1]}` : value || 'Grade'
}

function getGradeOrder(value) {
	const match = String(value || '').match(/(\d+)/)
	return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

function formatSubjectLabel(value) {
	return String(value || '')
		.split('_')
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ')
}

function buildTextbookTitle(form, gradeKey, subjectKey) {
	const explicitTitle = trimText(form.textbook.title)
	if (explicitTitle) {
		return explicitTitle
	}

	const subjectLabel = trimText(form.subjectName) || formatSubjectLabel(subjectKey) || 'Textbook'
	return `${subjectLabel} ${formatGradeLabel(gradeKey)}`
}

function isPdfUrl(value) {
	return trimText(value).toLowerCase().split('?', 1)[0].endsWith('.pdf')
}

function buildTextbookNode(form) {
	const units = form.textbook.units.reduce((result, unit, index) => {
		const unitKey = normalizeUnitKey(unit.key, `unit${index + 1}`)
		if (!hasContent(unit.title) && !hasContent(unit.pdfUrl)) {
			return result
		}

		result[unitKey] = {
			title: trimText(unit.title) || unitKey,
			pdfUrl: trimText(unit.pdfUrl),
		}
		return result
	}, {})

	return {
		coverUrl: trimText(form.textbook.coverUrl),
		language: trimText(form.textbook.language),
		region: trimText(form.textbook.region),
		title: trimText(form.textbook.title),
		units,
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

function CommandCard({ icon: Icon, label, value, detail, tone = 'teal' }) {
	return (
		<article className={`books-command-card accent-${tone}`}>
			<div className='books-command-icon'>
				<Icon />
			</div>
			<div>
				<span>{label}</span>
				<strong>{value}</strong>
				<p>{detail}</p>
			</div>
		</article>
	)
}

export default function Books({ view = 'save' }) {
	const [form, setForm] = useState(defaultForm)
	const [overview, setOverview] = useState({ textbooks: [], stats: {}, tree: {} })
	const [loadState, setLoadState] = useState({ loading: true, error: '' })
	const [submitState, setSubmitState] = useState({ loading: false, error: '', success: '' })
	const [assetUploadState, setAssetUploadState] = useState({ loadingKey: '', error: '', success: '' })
	const [allowOverwrite, setAllowOverwrite] = useState(false)
	const [manualSubjectKey, setManualSubjectKey] = useState(false)
	const [selectedLibraryGrade, setSelectedLibraryGrade] = useState('all')

	const resolvedGradeKey = normalizeGradeKey(form.gradeKey) || 'grade7'
	const resolvedSubjectKey = trimText(form.subjectKey) || normalizeSubjectKey(form.subjectName) || 'subject_key'
	const resolvedTextbookTitle = buildTextbookTitle(form, resolvedGradeKey, resolvedSubjectKey)
	const textbookNode = buildTextbookNode(form)
	const normalizedView = view === 'library' ? 'library' : 'save'
	const showSaveView = normalizedView === 'save'
	const payload = {
		gradeKey: resolvedGradeKey,
		subjectKey: resolvedSubjectKey,
		textbook: textbookNode,
		overwrite: allowOverwrite,
	}

	const libraryGradeOptions = useMemo(() => {
		return [...new Set(
			overview.textbooks
				.map((textbook) => normalizeGradeKey(textbook.grade))
				.filter(Boolean),
		)].sort((left, right) => getGradeOrder(left) - getGradeOrder(right))
	}, [overview.textbooks])

	const filteredTextbooks = useMemo(() => {
		const visibleTextbooks = selectedLibraryGrade === 'all'
			? overview.textbooks
			: overview.textbooks.filter((textbook) => normalizeGradeKey(textbook.grade) === selectedLibraryGrade)

		return [...visibleTextbooks].sort((left, right) => {
			const gradeDifference = getGradeOrder(left.grade) - getGradeOrder(right.grade)
			if (gradeDifference !== 0) {
				return gradeDifference
			}

			return formatSubjectLabel(left.subjectKey).localeCompare(formatSubjectLabel(right.subjectKey))
		})
	}, [overview.textbooks, selectedLibraryGrade])

	const booksWithPdfCount = filteredTextbooks.filter((textbook) => Boolean(textbook.previewPdfUrl)).length
	const activeLibraryGradeLabel = selectedLibraryGrade === 'all' ? 'All grades' : formatGradeLabel(selectedLibraryGrade)
	const visibleTextbookCount = filteredTextbooks.length
	const draftUnitCount = form.textbook.units.length
	const populatedDraftUnitCount = Object.keys(textbookNode.units).length
	const hasCoverAsset = hasContent(form.textbook.coverUrl)
	const draftSubjectLabel = formatSubjectLabel(resolvedSubjectKey) || 'Subject pending'
	const heroDescription = showSaveView
		? 'Build textbook metadata, upload covers, attach unit files, and write the record into the correct grade bucket from one cleaner premium workspace.'
		: 'Browse the full textbook library in a wider premium grid, filter by grade instantly, and open the available book files without leaving the page.'
	const heroLiveChip = showSaveView
		? `${formatGradeLabel(resolvedGradeKey)} save flow`
		: `${visibleTextbookCount} books visible`
	const heroCommands = showSaveView
		? [
			{ icon: FaLayerGroup, label: 'Grade bucket', value: formatGradeLabel(resolvedGradeKey), detail: `${draftSubjectLabel} will be stored under the selected grade node.`, tone: 'teal' },
			{ icon: FaBook, label: 'Draft scope', value: `${draftUnitCount} unit slot${draftUnitCount === 1 ? '' : 's'}`, detail: `${populatedDraftUnitCount} populated unit record${populatedDraftUnitCount === 1 ? '' : 's'} are currently ready for save.`, tone: 'gold' },
			{ icon: FaFilePdf, label: 'Asset readiness', value: hasCoverAsset ? 'Cover ready' : 'Cover pending', detail: 'Cover and unit uploads can link directly into the textbook record before publishing.', tone: 'coral' },
		]
		: [
			{ icon: FaFilter, label: 'Active grade', value: activeLibraryGradeLabel, detail: `${visibleTextbookCount} textbook record${visibleTextbookCount === 1 ? '' : 's'} match the current grade filter.`, tone: 'teal' },
			{ icon: FaBook, label: 'Library coverage', value: `${overview.stats.textbookCount || 0} total books`, detail: `${overview.stats.gradeCount || libraryGradeOptions.length || 0} grade bucket${(overview.stats.gradeCount || libraryGradeOptions.length || 0) === 1 ? '' : 's'} are represented in the library.`, tone: 'gold' },
			{ icon: FaFilePdf, label: 'PDF availability', value: `${booksWithPdfCount} books linked`, detail: 'Books with linked PDF units can be opened directly from the unit actions.', tone: 'coral' },
		]
	const hasHeroFeedback = Boolean(
		loadState.error
		|| assetUploadState.error
		|| assetUploadState.success
		|| submitState.error
		|| submitState.success,
	)

	useEffect(() => {
		if (selectedLibraryGrade === 'all') {
			return
		}

		if (!libraryGradeOptions.includes(selectedLibraryGrade)) {
			setSelectedLibraryGrade('all')
		}
	}, [libraryGradeOptions, selectedLibraryGrade])

	useEffect(() => {
		async function loadTextbooks() {
			setLoadState({ loading: true, error: '' })

			try {
				const response = await fetch(`${API_BASE_URL}/api/textbooks`)
				const data = await response.json()

				if (!response.ok) {
					throw new Error(data.error || 'Unable to load textbooks')
				}

				setOverview(data)
				setLoadState({ loading: false, error: '' })
			} catch (error) {
				setLoadState({ loading: false, error: error.message || 'Unable to connect to backend' })
			}
		}

		loadTextbooks()
	}, [])

	useEffect(() => {
		if (manualSubjectKey) {
			return
		}

		setForm((current) => {
			const generatedSubjectKey = normalizeSubjectKey(current.subjectName)
			if (current.subjectKey === generatedSubjectKey) {
				return current
			}

			return {
				...current,
				subjectKey: generatedSubjectKey,
			}
		})
	}, [form.subjectName, manualSubjectKey])

	function updateForm(updater) {
		setForm((current) => updater(current))
	}

	function updateTextbookField(field, value) {
		updateForm((current) => ({
			...current,
			textbook: {
				...current.textbook,
				[field]: value,
			},
		}))
	}

	function updateUnit(index, field, value) {
		updateForm((current) => ({
			...current,
			textbook: {
				...current.textbook,
				units: current.textbook.units.map((unit, unitIndex) => {
					if (unitIndex !== index) {
						return unit
					}

					return {
						...unit,
						[field]: value,
					}
				}),
			},
		}))
	}

	function addUnit() {
		updateForm((current) => ({
			...current,
			textbook: {
				...current.textbook,
				units: [...current.textbook.units, createUnit(current.textbook.units.length + 1)],
			},
		}))
	}

	function removeUnit(index) {
		updateForm((current) => ({
			...current,
			textbook: {
				...current.textbook,
				units: current.textbook.units.filter((_, unitIndex) => unitIndex !== index),
			},
		}))
	}

	async function handleAssetUpload(file, { assetType, unitIndex = null, unitKey = '' }) {
		if (!file) {
			return
		}

		const loadingKey = assetType === 'cover' ? 'cover' : `unit-${unitIndex}`
		const resolvedUnitKey = assetType === 'unit'
			? normalizeUnitKey(unitKey, `unit${(unitIndex ?? 0) + 1}`)
			: ''
		setAssetUploadState({ loadingKey, error: '', success: '' })

		try {
			const body = new FormData()
			body.append('file', file)
			body.append('assetType', assetType)
			body.append('gradeKey', resolvedGradeKey)
			body.append('subjectKey', resolvedSubjectKey)
			if (assetType === 'unit') {
				body.append('unitKey', resolvedUnitKey)
			}

			const response = await fetch(`${API_BASE_URL}/api/textbooks/upload-asset`, {
				method: 'POST',
				body,
			})
			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'Upload failed')
			}

			const uploadedUrl = trimText(data.url || data.downloadUrl || data.coverUrl || data.pdfUrl)
			if (!uploadedUrl) {
				throw new Error('Upload succeeded but no URL was returned')
			}

			if (assetType === 'cover') {
				updateTextbookField('coverUrl', uploadedUrl)
			} else if (unitIndex !== null) {
				const derivedTitle = deriveUnitTitleFromFileName(file.name, resolvedUnitKey)
				updateUnit(unitIndex, 'key', resolvedUnitKey)
				if (!hasContent(form.textbook.units[unitIndex]?.title)) {
					updateUnit(unitIndex, 'title', derivedTitle)
				}
				updateUnit(unitIndex, 'pdfUrl', uploadedUrl)
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

	async function reloadOverview() {
		try {
			const response = await fetch(`${API_BASE_URL}/api/textbooks`)
			const data = await response.json()
			if (!response.ok) {
				throw new Error(data.error || 'Unable to reload textbooks')
			}
			setOverview(data)
		} catch {
			return
		}
	}

	async function handleSubmit(event) {
		event.preventDefault()

		const hasUploadedUnit = Object.values(textbookNode.units).some((unit) => hasContent(unit.pdfUrl))
		if (!hasUploadedUnit) {
			setSubmitState({
				loading: false,
				error: 'Upload at least one unit document before saving the textbook.',
				success: '',
			})
			return
		}

		setSubmitState({ loading: true, error: '', success: '' })

		try {
			const submitPayload = {
				...payload,
				textbook: {
					...textbookNode,
					title: resolvedTextbookTitle,
				},
			}

			const response = await fetch(`${API_BASE_URL}/api/textbooks/save-record`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(submitPayload),
			})
			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'Save failed')
			}

			const totalUnits = Number(data.saved?.unitCount) || Object.keys(textbookNode.units).length
			const actionLabel = data.action === 'merged' ? 'Merged' : data.action === 'updated' ? 'Updated' : 'Saved'

			setSubmitState({
				loading: false,
				error: '',
				success: `${actionLabel} textbook into ${data.location} with ${totalUnits} total unit${totalUnits === 1 ? '' : 's'}.`,
			})
			setForm((current) => ({
				...current,
				textbook: {
					...current.textbook,
					title: resolvedTextbookTitle,
				},
			}))
			await reloadOverview()
		} catch (error) {
			setSubmitState({ loading: false, error: error.message || 'Save failed', success: '' })
		}
	}

	return (
		<div className='google-dashboard'>
			<CompanySidebar />
			<main className='google-main company-main'>
				<div className='exam-shell books-shell'>
					<section className='hero-panel books-hero-panel'>
						<div className='hero-copy books-hero-copy'>
							<div className='books-hero-kicker-row'>
								<span className='eyebrow'>TextBooks Registry</span>
								<span className='books-hero-live-chip'>{heroLiveChip}</span>
							</div>
							<h1>{showSaveView ? 'Build textbook records and upload files from one premium workspace.' : 'Browse the full textbook library with a premium five-column catalog.'}</h1>
							<p>{heroDescription}</p>
							<div className='books-command-grid'>
								{heroCommands.map((command) => (
									<CommandCard
										key={command.label}
										detail={command.detail}
										icon={command.icon}
										label={command.label}
										tone={command.tone}
										value={command.value}
									/>
								))}
							</div>
							
							<div className='hero-actions books-hero-actions'>
								{showSaveView ? (
									<>
										<a className='primary-action' href='#books-form'>Create textbook record <FaArrowRight aria-hidden='true' /></a>
										<Link className='secondary-action' to='/books/library'>Open library</Link>
									</>
								) : (
									<>
										<Link className='primary-action' to='/books/save'>Open save books <FaArrowRight aria-hidden='true' /></Link>
										<a className='secondary-action' href='#books-library'>Jump to catalog</a>
									</>
								)}
							</div>
							
							{hasHeroFeedback ? (
								<div className='books-hero-feedback'>
									{loadState.error ? <div className='status-banner warning'>{loadState.error}</div> : null}
									{assetUploadState.error ? <div className='status-banner warning'>{assetUploadState.error}</div> : null}
									{assetUploadState.success ? <div className='status-banner success-banner'>{assetUploadState.success}</div> : null}
									{submitState.error ? <div className='status-banner warning'>{submitState.error}</div> : null}
									{submitState.success ? <div className='status-banner success-banner'>{submitState.success}</div> : null}
								</div>
							) : null}
						</div>
						
					</section>

				
					{showSaveView ? (
						<div className='builder-grid books-builder-grid' id='books-form'>
							<form className='builder-form-panel books-form-panel' onSubmit={handleSubmit}>
							<section className='form-card books-location-card'>
								<div className='compact-heading'>
									<span className='section-kicker'>Location</span>
									<h2>Grade and subject bucket</h2>
								</div>
								<div className='form-grid two-column'>
									<label className='field'>
										<span>Grade key</span>
										<select value={form.gradeKey} onChange={(event) => updateForm((current) => ({ ...current, gradeKey: event.target.value }))}>
											{gradeOptions.map((grade) => (
												<option key={grade} value={grade}>
													{formatGradeLabel(grade)}
												</option>
											))}
										</select>
									</label>
									<label className='field'>
										<div className='field-heading'>
											<span>Subject key</span>
											<button className='field-toggle' type='button' onClick={() => setManualSubjectKey((current) => !current)}>
												{manualSubjectKey ? 'Use auto key' : 'Edit manually'}
											</button>
										</div>
										<input
											className={manualSubjectKey ? '' : 'field-auto-input'}
											value={form.subjectKey}
											onChange={(event) => updateForm((current) => ({ ...current, subjectKey: event.target.value }))}
											placeholder='mathematics'
											readOnly={!manualSubjectKey}
										/>
										
									</label>
									<label className='field field-span-2'>
										<span>Subject name</span>
										<input
											value={form.subjectName}
											onChange={(event) => updateForm((current) => ({ ...current, subjectName: event.target.value }))}
											placeholder='Mathematics'
										/>
										<span className='field-hint'>Used to generate the subject key when manual editing is off.</span>
									</label>
								</div>
							</section>

							<section className='form-card books-details-card'>
								<div className='compact-heading'>
									<span className='section-kicker'>Textbook details</span>
									<h2>Book metadata</h2>
								</div>
								<div className='form-grid two-column'>
									<label className='field field-span-2'>
										<span>Title</span>
										<input value={form.textbook.title} onChange={(event) => updateTextbookField('title', event.target.value)} placeholder='Mathematics Grade 7' />
									</label>
									<label className='field'>
										<span>Language</span>
										<input value={form.textbook.language} onChange={(event) => updateTextbookField('language', event.target.value)} placeholder='English' />
									</label>
									<label className='field'>
										<span>Region</span>
										<input value={form.textbook.region} onChange={(event) => updateTextbookField('region', event.target.value)} placeholder='national' />
									</label>
									<label className='field field-span-2'>
										<span>Upload cover image</span>
										<input
											type='file'
											accept='image/*'
											onChange={(event) => {
												const [file] = event.target.files || []
												void handleAssetUpload(file, { assetType: 'cover' })
												event.target.value = ''
											}}
											disabled={assetUploadState.loadingKey === 'cover'}
										/>
											<span className='field-hint'>Accepted: JPG, PNG, WEBP, GIF. The cover image is stored in the database without exposing its raw URL in this form.</span>
										{form.textbook.coverUrl ? (
												<div className='books-file-state'>
													<strong>Cover image stored</strong>
													<span>The uploaded cover is linked to this textbook record.</span>
												<img className='asset-preview-image' src={form.textbook.coverUrl} alt='Uploaded cover preview' />
											</div>
										) : null}
									</label>
								</div>
							</section>

							<section className='form-card package-card books-units-card'>
								<div className='row-header'>
									<div>
										<span className='section-kicker'>Units</span>
										<h3>PDF unit entries</h3>
									</div>
									<button className='inline-button' type='button' onClick={addUnit}>Add unit</button>
								</div>
								<div className='stack-list'>
									{form.textbook.units.map((unit, index) => (
										<div className='editor-card' key={`${unit.key}-${index}`}>
											<div className='inline-row'>
												<h3>{trimText(unit.key) || `Unit ${index + 1}`}</h3>
												{form.textbook.units.length > 1 ? (
													<button className='ghost-button' type='button' onClick={() => removeUnit(index)}>
														Remove
													</button>
												) : null}
											</div>
											<div className='form-grid two-column'>
												<label className='field'>
													<span>Unit key</span>
													<input value={unit.key} onChange={(event) => updateUnit(index, 'key', normalizeUnitKey(event.target.value, `unit${index + 1}`))} placeholder={`unit${index + 1}`} />
												</label>
												<label className='field'>
													<span>Unit title</span>
													<input value={unit.title} onChange={(event) => updateUnit(index, 'title', event.target.value)} placeholder='Integers' />
												</label>
												<label className='field field-span-2'>
													<span>Upload unit document</span>
													<input
														type='file'
														accept='.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
														onChange={(event) => {
															const [file] = event.target.files || []
															void handleAssetUpload(file, { assetType: 'unit', unitIndex: index, unitKey: unit.key })
															event.target.value = ''
														}}
														disabled={assetUploadState.loadingKey === `unit-${index}`}
													/>
														<span className='field-hint'>Accepted: PDF, DOC, DOCX. The unit document is stored in the database without exposing its raw URL in this form.</span>
													{unit.pdfUrl ? (
															<div className='books-file-state compact'>
																<strong>Unit document stored</strong>
																<span>The file is attached and ready for opening from the unit record.</span>
																<a className='inline-button asset-inline-link' href={unit.pdfUrl} target='_blank' rel='noreferrer'>Open uploaded file</a>
															</div>
													) : null}
												</label>
											</div>
										</div>
									))}
								</div>
							</section>

							<div className='submit-row books-submit-row'>
								<label className='toggle-field'>
									<input type='checkbox' checked={allowOverwrite} onChange={(event) => setAllowOverwrite(event.target.checked)} />
									<span>Allow replacing existing unit keys if they already exist</span>
								</label>
								<button className='primary-action' type='submit' disabled={submitState.loading}>
									{submitState.loading ? 'Saving...' : 'Save textbook'}
								</button>
							</div>
							</form>

						</div>
					) : null}

					{!showSaveView ? (
						<section className='section-block books-library-section' id='books-library'>
						<div className='section-header-row'>
							<div className='section-heading'>
								<span className='section-kicker'>Existing library</span>
								<h2>Current textbook records</h2>
							</div>
							<div className='books-library-toolbar'>
								<div className='books-library-count-card'>
									<span>Library view</span>
									<strong>{activeLibraryGradeLabel}</strong>
									<small>{`${visibleTextbookCount} textbook record${visibleTextbookCount === 1 ? '' : 's'} currently visible.`}</small>
								</div>
								<div className='books-grade-filter-panel'>
									<span>Grade filter</span>
									<div className='books-grade-filter-row'>
										<button className={`books-grade-filter-pill${selectedLibraryGrade === 'all' ? ' is-active' : ''}`} type='button' onClick={() => setSelectedLibraryGrade('all')}>
											All grades
										</button>
										{libraryGradeOptions.map((gradeKey) => (
											<button className={`books-grade-filter-pill${selectedLibraryGrade === gradeKey ? ' is-active' : ''}`} key={gradeKey} type='button' onClick={() => setSelectedLibraryGrade(gradeKey)}>
												{formatGradeLabel(gradeKey)}
											</button>
										))}
									</div>
								</div>
							</div>
						</div>

						{loadState.loading ? <p className='empty-state'>Loading textbooks...</p> : null}
						{!loadState.loading && !overview.textbooks.length ? <p className='empty-state'>No textbook records found yet.</p> : null}
						{!loadState.loading && overview.textbooks.length && !filteredTextbooks.length ? <p className='empty-state'>No textbook records matched the selected grade filter.</p> : null}

						{!loadState.loading && filteredTextbooks.length ? (
							<div className='catalog-grid books-catalog-grid'>
								{filteredTextbooks.map((textbook) => (
									<article className='catalog-card books-catalog-card' key={`${textbook.grade}-${textbook.subjectKey}`}>
										<div className='catalog-meta-row'>
											<span className='pill pill-teal'>{formatGradeLabel(textbook.grade)}</span>
											<span className='pill pill-gold'>{formatSubjectLabel(textbook.subjectKey)}</span>
											<span className='pill pill-coral'>{textbook.language || 'Language missing'}</span>
										</div>
										{textbook.coverUrl ? (
											<a href={textbook.coverUrl} target='_blank' rel='noreferrer' className='books-cover-link'>
												<img className='asset-preview-image books-cover-preview' src={textbook.coverUrl} alt={`${textbook.title} cover`} />
											</a>
										) : null}
										<h3>{textbook.title}</h3>
										<p className='catalog-footnote'>{`Platform1/TextBooks/${textbook.grade}/${textbook.subjectKey}`}</p>
										<ul className='catalog-list'>
											{textbook.units.map((unit) => (
												<li className='books-unit-item' key={unit.unitKey}>
													<div className='books-unit-copy'>
														<strong>{unit.unitKey}</strong>
														<span>{unit.title}</span>
													</div>
													{unit.pdfUrl ? (
														<a className='books-unit-link' href={unit.pdfUrl} target='_blank' rel='noreferrer'>
															{isPdfUrl(unit.pdfUrl) ? 'Download PDF' : 'Open file'}
														</a>
													) : (
														<span className='books-unit-muted'>File pending</span>
													)}
												</li>
											))}
										</ul>
									</article>
								))}
							</div>
						) : null}
						</section>
					) : null}
				</div>
			</main>
		</div>
	)
}