import { useState } from 'react'
import { FaBookOpen, FaChartLine, FaChevronDown, FaClipboardList, FaFileAlt } from 'react-icons/fa'
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
			{ to: '/exams/entrance', label: 'Entrance Exams', icon: FaFileAlt },
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

const rootStyle = {
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

	return (
		<aside className='google-sidebar company-sidebar-admin' style={rootStyle}>
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
										<Link key={to} className='sidebar-btn' to={to} style={getSidebarLinkStyle(to)}>
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
	)
}