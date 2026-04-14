import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import CompanySidebar from '../components/CompanySidebar'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '')

const gradeOptions = ['grade7', 'grade8', 'grade9', 'grade10', 'grade11', 'grade12']

function createUnit(index) {
	return {
		key: `unit${index}`,
		title: '',
		pdfUrl: '',
	}
}

const defaultForm = {
	gradeKey: 'grade7',
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

function formatGradeLabel(value) {
	const match = String(value || '').match(/(\d+)/)
	return match ? `Grade ${match[1]}` : value || 'Grade'
}

function formatSubjectLabel(value) {
	return String(value || '')
		.split('_')
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ')
}

function isPdfUrl(value) {
	return trimText(value).toLowerCase().split('?', 1)[0].endsWith('.pdf')
}

function buildTextbookNode(form) {
	const units = form.textbook.units.reduce((result, unit, index) => {
		const unitKey = trimText(unit.key) || `unit${index + 1}`
		if (!hasContent(unit.title) && !hasContent(unit.pdfUrl)) {
			return result
		}

		result[unitKey] = {
			title: trimText(unit.title),
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

export default function Books({ view = 'save' }) {
	const [form, setForm] = useState(defaultForm)
	const [overview, setOverview] = useState({ textbooks: [], stats: {}, tree: {} })
	const [loadState, setLoadState] = useState({ loading: true, error: '' })
	const [submitState, setSubmitState] = useState({ loading: false, error: '', success: '' })
	const [assetUploadState, setAssetUploadState] = useState({ loadingKey: '', error: '', success: '' })
	const [allowOverwrite, setAllowOverwrite] = useState(false)
	const [manualSubjectKey, setManualSubjectKey] = useState(false)

	const resolvedGradeKey = normalizeGradeKey(form.gradeKey) || 'grade7'
	const resolvedSubjectKey = trimText(form.subjectKey) || normalizeSubjectKey(form.subjectName) || 'subject_key'
	const textbookNode = buildTextbookNode(form)
	const normalizedView = view === 'library' ? 'library' : 'save'
	const showSaveView = normalizedView === 'save'
	const previewPdfCount = overview.textbooks.filter((textbook) => Boolean(textbook.previewPdfUrl)).length
	const payload = {
		gradeKey: resolvedGradeKey,
		subjectKey: resolvedSubjectKey,
		textbook: textbookNode,
		overwrite: allowOverwrite,
	}

	const groupedTextbooks = useMemo(() => {
		return overview.textbooks.reduce((result, textbook) => {
			const gradeKey = textbook.grade || 'grade'
			result[gradeKey] = result[gradeKey] || []
			result[gradeKey].push(textbook)
			return result
		}, {})
	}, [overview.textbooks])

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
		setAssetUploadState({ loadingKey, error: '', success: '' })

		try {
			const body = new FormData()
			body.append('file', file)
			body.append('assetType', assetType)
			body.append('gradeKey', resolvedGradeKey)
			body.append('subjectKey', resolvedSubjectKey)
			if (assetType === 'unit') {
				body.append('unitKey', trimText(unitKey) || `unit${(unitIndex ?? 0) + 1}`)
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
				updateUnit(unitIndex, 'pdfUrl', uploadedUrl)
			}

			setAssetUploadState({
				loadingKey: '',
				error: '',
				success: `${file.name} uploaded and linked successfully. URL: ${uploadedUrl}`,
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
		setSubmitState({ loading: true, error: '', success: '' })

		try {
			const response = await fetch(`${API_BASE_URL}/api/textbooks/save-record`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
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
							<span className='eyebrow'>TextBooks Registry</span>
							<h1>{showSaveView ? 'Create Textbook records' : 'Browse saved textbook records'}</h1>
							
							<div className='hero-actions'>
								{showSaveView ? (
									<a className='primary-action' href='#books-form'>Create textbook record</a>
								) : (
									<Link className='primary-action' to='/books/save'>Open save books</Link>
								)}
							</div>
							
							{loadState.error ? <div className='status-banner warning'>{loadState.error}</div> : null}
							{assetUploadState.error ? <div className='status-banner warning'>{assetUploadState.error}</div> : null}
							{assetUploadState.success ? <div className='status-banner success-banner'>{assetUploadState.success}</div> : null}
							{submitState.error ? <div className='status-banner warning'>{submitState.error}</div> : null}
							{submitState.success ? <div className='status-banner success-banner'>{submitState.success}</div> : null}
						</div>
						<div className='hero-card books-hero-card'>
							<div className='builder-stat-grid books-hero-stats'>
								<StatCard label='Grades in library' value={overview.stats.gradeCount || 0} tone='teal' />
								<StatCard label='Textbook records' value={overview.stats.textbookCount || 0} tone='gold' />
								<StatCard label='Units indexed' value={overview.stats.unitCount || 0} tone='coral' />
								{showSaveView ? (
									<StatCard label='Units in draft' value={Object.keys(textbookNode.units).length} tone='teal' />
								) : (
									<StatCard label='Preview PDFs' value={previewPdfCount} tone='teal' />
								)}
							</div>
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
										<span className='field-hint'>Stable key used in Firebase under the selected grade.</span>
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
										<span>Cover URL</span>
										<input value={form.textbook.coverUrl} onChange={(event) => updateTextbookField('coverUrl', event.target.value)} placeholder='https://example.com/covers/math7.jpg' />
										<span className='field-hint'>Paste an existing image URL or upload an image file and this field will be filled automatically.</span>
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
										<span className='field-hint'>Accepted: JPG, PNG, WEBP, GIF. Uploaded file URL is stored in coverUrl.</span>
										{form.textbook.coverUrl ? (
											<div className='asset-url-display'>
												<strong>Stored cover URL</strong>
												<a href={form.textbook.coverUrl} target='_blank' rel='noreferrer'>
													{form.textbook.coverUrl}
												</a>
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
													<input value={unit.key} onChange={(event) => updateUnit(index, 'key', event.target.value)} placeholder={`unit${index + 1}`} />
												</label>
												<label className='field'>
													<span>Unit title</span>
													<input value={unit.title} onChange={(event) => updateUnit(index, 'title', event.target.value)} placeholder='Integers' />
												</label>
												<label className='field field-span-2'>
													<span>PDF / DOC / DOCX URL</span>
													<input value={unit.pdfUrl} onChange={(event) => updateUnit(index, 'pdfUrl', event.target.value)} placeholder='https://example.com/books/grade7/math/unit1.pdf' />
													<span className='field-hint'>Paste an existing document URL or upload a PDF, DOC, or DOCX file below.</span>
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
													<span className='field-hint'>Accepted: PDF, DOC, DOCX. Uploaded file URL is stored in pdfUrl.</span>
													{unit.pdfUrl ? (
														<div className='asset-url-display'>
															<strong>Stored unit URL</strong>
															<a href={unit.pdfUrl} target='_blank' rel='noreferrer'>
																{unit.pdfUrl}
															</a>
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
						</div>

						{loadState.loading ? <p className='empty-state'>Loading textbooks...</p> : null}
						{!loadState.loading && !overview.textbooks.length ? <p className='empty-state'>No textbook records found yet.</p> : null}

						<div className='books-grade-stack'>
							{Object.entries(groupedTextbooks)
								.sort((left, right) => Number(left[0].replace(/[^0-9]/g, '')) - Number(right[0].replace(/[^0-9]/g, '')))
								.map(([gradeKey, textbooks]) => (
									<div className='books-grade-group' key={gradeKey}>
										<div className='podium-grade-header'>
											<div className='podium-grade-heading'>
												<span className='section-kicker'>{formatGradeLabel(gradeKey)}</span>
												<h3>{textbooks.length} textbook records</h3>
											</div>
											<p className='podium-grade-note'>Each card reflects one subject entry stored under this grade node.</p>
										</div>
										<div className='catalog-grid books-catalog-grid'>
											{textbooks.map((textbook) => (
												<article className='catalog-card books-catalog-card' key={`${textbook.grade}-${textbook.subjectKey}`}>
													<div className='catalog-meta-row'>
														<span className='pill pill-teal'>{formatSubjectLabel(textbook.subjectKey)}</span>
														<span className='pill pill-gold'>{textbook.language || 'Language missing'}</span>
														<span className='pill pill-coral'>{textbook.region || 'Region missing'}</span>
													</div>
													{textbook.coverUrl ? (
														<a href={textbook.coverUrl} target='_blank' rel='noreferrer' className='books-cover-link'>
															<img className='asset-preview-image books-cover-preview' src={textbook.coverUrl} alt={`${textbook.title} cover`} />
														</a>
													) : null}
													<h3>{textbook.title}</h3>
													<p className='catalog-footnote'>{`Platform1/TextBooks/${textbook.grade}/${textbook.subjectKey}`}</p>
													{textbook.previewPdfUrl ? (
														<div className='books-document-panel'>
															<div className='books-document-header'>
																<strong>Fetched Book PDF</strong>
																<span>{textbook.pdfUnitCount || 1} PDF unit{textbook.pdfUnitCount === 1 ? '' : 's'} available</span>
															</div>
															<iframe
																className='books-pdf-preview'
																src={textbook.previewPdfUrl}
																title={`${textbook.title} PDF preview`}
																loading='lazy'
															/>
															<div className='books-document-actions'>
																<a className='inline-button asset-inline-link' href={textbook.previewPdfUrl} target='_blank' rel='noreferrer'>Open book PDF</a>
															</div>
														</div>
													) : textbook.firstDocumentUrl ? (
														<div className='books-document-panel compact'>
															<div className='books-document-header'>
																<strong>Fetched Book File</strong>
																<span>{textbook.documentCount || 1} document unit{textbook.documentCount === 1 ? '' : 's'} available</span>
															</div>
															<p className='books-document-note'>This record has linked documents, but no PDF previewable file. Open the first document below.</p>
															<div className='books-document-actions'>
																<a className='inline-button asset-inline-link' href={textbook.firstDocumentUrl} target='_blank' rel='noreferrer'>Open first document</a>
															</div>
														</div>
													) : null}
													<ul className='catalog-list'>
														{textbook.units.map((unit) => (
															<li key={unit.unitKey}>
																<strong>{unit.unitKey}</strong>: {unit.title}
																{unit.pdfUrl ? (
																	<>
																		{' '}
																		<a href={unit.pdfUrl} target='_blank' rel='noreferrer'>Open file</a>
																		{isPdfUrl(unit.pdfUrl) ? <span>{' • PDF'}</span> : null}
																	</>
																) : null}
															</li>
														))}
													</ul>
												</article>
											))}
										</div>
									</div>
								))}
						</div>
						</section>
					) : null}
				</div>
			</main>
		</div>
	)
}