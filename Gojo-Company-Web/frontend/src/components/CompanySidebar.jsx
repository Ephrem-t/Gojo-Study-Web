import { FaChartLine, FaClipboardList, FaFileAlt } from 'react-icons/fa'
import { NavLink } from 'react-router-dom'

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

const menuItems = [
	{ to: '/exams', label: 'Exams', Icon: FaFileAlt },
	{ to: '/student-progress', label: 'Student Progress', Icon: FaChartLine },
	{ to: '/student-results', label: 'Student Results', Icon: FaClipboardList },
]

const sidebarLinkBaseStyle = {
	display: 'flex',
	alignItems: 'center',
	gap: 10,
	padding: '12px 14px',
	marginLeft: 10,
	fontSize: 18,
	fontWeight: 500,
	color: 'var(--text-secondary)',
	borderRadius: 12,
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
	minWidth: 280,
	padding: 18,
	borderRadius: 24,
	background: 'var(--surface-panel)',
	border: '1px solid var(--border-soft)',
	boxShadow: 'var(--shadow-panel)',
	height: 'calc(100vh - 40px)',
	overflowY: 'auto',
	boxSizing: 'border-box',
	display: 'flex',
	flexDirection: 'column',
	alignItems: 'stretch',
}

function getSidebarLinkStyle(isActive) {
	return isActive ? { ...sidebarLinkBaseStyle, ...sidebarLinkActiveStyle } : sidebarLinkBaseStyle
}

export default function CompanySidebar() {
	return (
		<aside className='google-sidebar company-sidebar-admin' style={rootStyle}>
			<div
				className='sidebar-profile'
				style={{
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					gap: 10,
					padding: '20px 18px',
					marginBottom: 12,
					borderRadius: 18,
					background: 'linear-gradient(180deg, var(--surface-accent) 0%, var(--surface-panel) 100%)',
					border: '1px solid var(--border-strong)',
					boxShadow: 'inset 0 1px 0 color-mix(in srgb, white 8%, transparent)',
				}}
			>
				<div
					className='sidebar-img-circle'
					style={{
						width: 72,
						height: 72,
						borderRadius: '50%',
						overflow: 'hidden',
						border: '3px solid var(--border-strong)',
						boxShadow: '0 10px 20px rgba(15,23,42,0.16)',
					}}
				>
					<img src={profileImage} alt='Gojo Company' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
				</div>
				<div
					style={{
						padding: '5px 12px',
						borderRadius: 999,
						background: 'var(--surface-accent)',
						border: '1px solid var(--border-strong)',
						color: 'var(--accent)',
						fontSize: 11,
						fontWeight: 800,
						letterSpacing: '0.08em',
						textTransform: 'uppercase',
					}}
				>
					Exam Office
				</div>
				<h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center' }}>Gojo Company</h3>
				<p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Exam Center</p>
			</div>

			<div className='sidebar-menu' style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 14 }}>
				{menuItems.map(({ to, label, Icon }) => (
					<NavLink
						key={to}
						to={to}
						className='sidebar-btn'
						style={({ isActive }) => getSidebarLinkStyle(isActive)}
					>
						<Icon style={{ width: 17, height: 17, flex: '0 0 auto' }} />
						<span className='sidebar-label'>{label}</span>
					</NavLink>
				))}
			</div>
		</aside>
	)
}