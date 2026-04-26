import { useEffect, useState } from 'react'
import { FaBars, FaBookOpen, FaChartLine, FaChevronDown, FaClipboardList, FaFileAlt, FaSchool, FaTimes } from 'react-icons/fa'
import { Link, useLocation } from 'react-router-dom'

const profileImage = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4b6cb7" />
      <stop offset="100%" stop-color="#182848" />
    </linearGradient>
  </defs>
  <rect width="120" height="120" rx="60" fill="url(#g)" />
  <circle cx="60" cy="46" r="20" fill="#ffffff" fill-opacity="0.95" />
  <path d="M24 103c8-19 24-29 36-29s28 10 36 29" fill="#ffffff" fill-opacity="0.95" />
</svg>
`)}`

const SIDEBAR_SECTIONS = [
	{
		key: 'schools',
		title: 'Schools',
		icon: FaSchool,
		items: [
			{ to: '/schools/overview', label: 'School Overview', icon: FaSchool },
			{ to: '/schools/create', label: 'School Registry', icon: FaSchool },
		],
	},
	{
		key: 'books',
		title: 'Books',
		icon: FaBookOpen,
		items: [
			{ to: '/books/save', label: 'Create Books', icon: FaBookOpen },
			{ to: '/books/library', label: 'All Books', icon: FaBookOpen },
		],
	},
	{
		key: 'exams',
		title: 'Exams',
		icon: FaFileAlt,
		items: [
			{ to: '/exams/competitive', label: 'Competitive Exams', icon: FaFileAlt },
			{ to: '/exams/practice', label: 'Practice Exams', icon: FaFileAlt },
			
		],
	},
	{
		key: 'performance',
		title: 'Performance',
		icon: FaChartLine,
		items: [
			{ to: '/student-progress', label: 'Student Progress', icon: FaChartLine },
			{ to: '/student-results', label: 'Student Results', icon: FaClipboardList },
		],
	},
]

const createDefaultSidebarSections = () =>
	SIDEBAR_SECTIONS.reduce((allSections, section) => {
		allSections[section.key] = false
		return allSections
	}, {})

const SIDEBAR_SECTIONS_STORAGE_KEY = 'company_sidebar_sections_state'

const readStoredSidebarSections = () => {
	const defaultSections = createDefaultSidebarSections()

	try {
		const rawValue = localStorage.getItem(SIDEBAR_SECTIONS_STORAGE_KEY)
		if (!rawValue) {
			return defaultSections
		}

		const parsedValue = JSON.parse(rawValue)
		if (!parsedValue || typeof parsedValue !== 'object') {
			return defaultSections
		}

		return Object.keys(defaultSections).reduce((normalizedValue, sectionKey) => {
			normalizedValue[sectionKey] = Boolean(parsedValue[sectionKey])
			return normalizedValue
		}, {})
	} catch {
		return defaultSections
	}
}

let sidebarSectionsState = readStoredSidebarSections()

const COMPACT_SIDEBAR_MEDIA_QUERY = '(max-width: 1100px)'

const readCompactViewportState = () => {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
		return false
	}

	return window.matchMedia(COMPACT_SIDEBAR_MEDIA_QUERY).matches
}

const sidebarLinkBaseStyle = {
	display: 'flex',
	alignItems: 'center',
	gap: 10,
	padding: '11px 14px',
	marginLeft: 8,
	fontSize: 13,
	fontWeight: 700,
	color: 'var(--text-secondary)',
	borderRadius: 14,
	background: 'var(--surface-muted)',
	border: '1px solid var(--border-soft)',
	textDecoration: 'none',
}

const sidebarLinkActiveStyle = {
	background: 'var(--accent-strong)',
	color: '#ffffff',
	border: '1px solid var(--accent-strong)',
	boxShadow: 'var(--shadow-glow)',
}

const desktopRootStyle = {
	width: 'var(--sidebar-width)',
	marginLeft: -10,
	marginRight: 0,
	padding: 18,
	borderRadius: 26,
	background: 'var(--surface-panel)',
	border: '1px solid var(--border-soft)',
	boxShadow: 'var(--shadow-panel)',
	height: 'calc(100vh - 40px)',
	maxHeight: 'calc(100vh - 40px)',
	minHeight: 'calc(100vh - 40px)',
	overflowY: 'auto',
	overflowX: 'hidden',
	boxSizing: 'border-box',
	display: 'flex',
	flexDirection: 'column',
	alignSelf: 'stretch',
	fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
	scrollbarWidth: 'thin',
	scrollbarColor: 'var(--border-strong) transparent',
	transition: 'opacity 180ms ease, filter 180ms ease',
}

const sidebarSectionStyle = {
	display: 'flex',
	flexDirection: 'column',
	gap: 10,
}

const sidebarSectionTitleStyle = {
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	gap: 10,
	fontSize: 13,
	fontWeight: 800,
	color: 'var(--text-primary)',
	padding: '10px 12px',
	borderRadius: 12,
	border: '1px solid var(--border-strong)',
	background: 'linear-gradient(135deg, var(--surface-accent) 0%, var(--surface-panel) 100%)',
	cursor: 'pointer',
}

const sidebarSectionChildrenStyle = {
	display: 'flex',
	flexDirection: 'column',
	gap: 8,
	marginLeft: 12,
	paddingLeft: 12,
	borderLeft: '2px solid var(--border-strong)',
}

export default function CompanySidebar() {
	const location = useLocation()
	const currentPath = location.pathname
	const [sidebarSections, setSidebarSections] = useState(() => ({ ...sidebarSectionsState }))
	const [isCompactViewport, setIsCompactViewport] = useState(readCompactViewportState)
	const [isDrawerOpen, setIsDrawerOpen] = useState(false)

	useEffect(() => {
		if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
			return undefined
		}

		const mediaQuery = window.matchMedia(COMPACT_SIDEBAR_MEDIA_QUERY)
		const handleViewportChange = (event) => {
			setIsCompactViewport(event.matches)
			if (!event.matches) {
				setIsDrawerOpen(false)
			}
		}

		setIsCompactViewport(mediaQuery.matches)

		if (typeof mediaQuery.addEventListener === 'function') {
			mediaQuery.addEventListener('change', handleViewportChange)
			return () => mediaQuery.removeEventListener('change', handleViewportChange)
		}

		mediaQuery.addListener(handleViewportChange)
		return () => mediaQuery.removeListener(handleViewportChange)
	}, [])

	useEffect(() => {
		if (!isCompactViewport) {
			return undefined
		}

		setIsDrawerOpen(false)
		return undefined
	}, [currentPath, isCompactViewport])

	useEffect(() => {
		if (typeof document === 'undefined') {
			return undefined
		}

		const previousOverflow = document.body.style.overflow
		if (isCompactViewport && isDrawerOpen) {
			document.body.style.overflow = 'hidden'
			return () => {
				document.body.style.overflow = previousOverflow
			}
		}

		document.body.style.overflow = previousOverflow
		return undefined
	}, [isCompactViewport, isDrawerOpen])

	const isSectionActive = sectionKey =>
		SIDEBAR_SECTIONS.find(section => section.key === sectionKey)?.items.some(
			item => currentPath === item.to || currentPath.startsWith(`${item.to}/`),
		) || false

	const getSidebarSectionButtonStyle = sectionKey =>
		sidebarSections[sectionKey] || isSectionActive(sectionKey)
			? {
					...sidebarSectionTitleStyle,
					background: 'linear-gradient(135deg, var(--accent-soft, rgba(37, 99, 235, 0.12)) 0%, var(--surface-accent) 100%)',
					border: isSectionActive(sectionKey) ? '2px solid var(--accent)' : '1px solid var(--border-strong)',
					boxShadow: isSectionActive(sectionKey) ? 'var(--shadow-glow)' : '0 10px 22px rgba(15,23,42,0.08)',
					color: 'var(--text-primary)',
			  }
			: sidebarSectionTitleStyle

	const getSidebarLinkStyle = path =>
		currentPath === path || currentPath.startsWith(`${path}/`)
			? { ...sidebarLinkBaseStyle, ...sidebarLinkActiveStyle }
			: sidebarLinkBaseStyle

	const toggleSidebarSection = sectionKey => {
		setSidebarSections(previousState => {
			const nextState = {
				...previousState,
				[sectionKey]: !previousState[sectionKey],
			}

			sidebarSectionsState = nextState
			try {
				localStorage.setItem(SIDEBAR_SECTIONS_STORAGE_KEY, JSON.stringify(nextState))
			} catch {}

			return nextState
		})
	}

	const computedRootStyle = isCompactViewport
		? {
				width: 'min(88vw, 360px)',
				marginLeft: 0,
				marginRight: 0,
				padding: 18,
				borderRadius: '0 28px 28px 0',
				background: 'var(--surface-panel)',
				border: '1px solid var(--border-soft)',
				boxShadow: '0 34px 90px rgba(15, 23, 42, 0.28)',
				height: '100dvh',
				maxHeight: '100dvh',
				minHeight: '100dvh',
				overflowY: 'auto',
				overflowX: 'hidden',
				boxSizing: 'border-box',
				display: 'flex',
				flexDirection: 'column',
				alignSelf: 'stretch',
				fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
				scrollbarWidth: 'thin',
				scrollbarColor: 'var(--border-strong) transparent',
				transition: 'transform 220ms ease, box-shadow 220ms ease, opacity 180ms ease, filter 180ms ease',
				position: 'fixed',
				top: 0,
				left: 0,
				zIndex: 90,
				transform: isDrawerOpen ? 'translateX(0)' : 'translateX(calc(-100% - 24px))',
			}
		: desktopRootStyle

	return (
		<>
			{isCompactViewport ? (
				<>
					<button
						className={`company-sidebar-toggle${isDrawerOpen ? ' is-open' : ''}`}
						type='button'
						onClick={() => setIsDrawerOpen((currentValue) => !currentValue)}
						aria-expanded={isDrawerOpen}
						aria-controls='company-sidebar-navigation'
					>
						{isDrawerOpen ? <FaTimes aria-hidden='true' /> : <FaBars aria-hidden='true' />}
						<span>{isDrawerOpen ? 'Close menu' : 'Open menu'}</span>
					</button>
					<button
						className={`company-sidebar-overlay${isDrawerOpen ? ' is-visible' : ''}`}
						type='button'
						onClick={() => setIsDrawerOpen(false)}
						aria-label='Close navigation menu'
					/>
				</>
			) : null}

			<aside
				className={`google-sidebar company-sidebar-admin${isCompactViewport ? ' compact-viewport' : ''}${isDrawerOpen ? ' is-mobile-open' : ''}`}
				style={computedRootStyle}
				id='company-sidebar-navigation'
			>
				{isCompactViewport ? (
					<div className='company-sidebar-mobile-head'>
						<div>
							<span>Navigation</span>
							<strong>Gojo Company</strong>
						</div>
						<button type='button' onClick={() => setIsDrawerOpen(false)} aria-label='Close sidebar'>
							<FaTimes aria-hidden='true' />
						</button>
					</div>
				) : null}

				<div
				className='sidebar-profile'
				style={{
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					gap: 8,
					padding: '14px 12px',
					marginBottom: 8,
					borderRadius: 16,
					background: 'linear-gradient(180deg, var(--surface-accent) 0%, var(--surface-panel) 100%)',
					border: '1px solid var(--border-strong)',
					boxShadow: 'inset 0 1px 0 color-mix(in srgb, white 8%, transparent)',
				}}
			>
				<div
					className='sidebar-img-circle'
					style={{
						width: 60,
						height: 60,
						borderRadius: '50%',
						overflow: 'hidden',
						border: '2px solid var(--border-strong)',
						boxShadow: 'var(--shadow-glow)',
					}}
				>
					<img src={profileImage} alt='Gojo Company' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
				</div>
				<div
					style={{
						padding: '4px 10px',
						borderRadius: 999,
						background: 'var(--surface-accent)',
						border: '1px solid var(--border-strong)',
						color: 'var(--accent)',
						fontSize: 10,
						fontWeight: 800,
						letterSpacing: '0.06em',
						textTransform: 'uppercase',
					}}
				>
					Main Office
				</div>
				<h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center' }}>Gojo Company</h3>
				<p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Main Center</p>
			</div>

				<div
				className='sidebar-menu'
				style={{
					display: 'flex',
					flexDirection: 'column',
					gap: 16,
					marginTop: 14,
					flex: 1,
					minHeight: 0,
					overflow: 'visible',
					paddingRight: 2,
				}}
			>
				{SIDEBAR_SECTIONS.map(section => {
					const SectionIcon = section.icon
					const isOpen = sidebarSections[section.key] || isSectionActive(section.key)

					return (
						<div key={section.key} style={sidebarSectionStyle}>
							<button type='button' onClick={() => toggleSidebarSection(section.key)} style={getSidebarSectionButtonStyle(section.key)}>
								<span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
									<SectionIcon style={{ width: 17, height: 17, color: 'var(--accent-strong)' }} />
									{section.title}
								</span>
								<FaChevronDown
									style={{
										width: 14,
										height: 14,
										color: 'var(--accent)',
										transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
										transition: 'transform 160ms ease',
									}}
								/>
							</button>

							{isOpen ? (
								<div style={sidebarSectionChildrenStyle}>
									{section.items.map(({ to, label, icon: Icon }) => (
										<Link
											key={to}
											className='sidebar-btn'
											to={to}
											style={getSidebarLinkStyle(to)}
											onClick={() => {
												if (isCompactViewport) {
													setIsDrawerOpen(false)
												}
											}}
										>
											<Icon style={{ width: 17, height: 17 }} />
											<span className='sidebar-label'>{label}</span>
										</Link>
									))}
								</div>
							) : null}
						</div>
					)
				})}
				</div>
			</aside>
		</>
	)
}