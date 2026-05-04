import { NavLink } from 'react-router-dom'

const navItems = [
	{ to: '/exams', label: 'Exams' },
	{ to: '/student-progress', label: 'Student Progress' },
	{ to: '/student-results', label: 'Student Results' },
]

export default function PageNavBar() {
	return (
		<nav className='page-nav' aria-label='Exam pages'>
			<div className='page-nav-inner'>
				<span className='page-nav-label'>Gojo Company</span>
				<div className='page-nav-links'>
					{navItems.map((item) => (
						<NavLink
							key={item.to}
							to={item.to}
							className={({ isActive }) => `page-nav-link${isActive ? ' active' : ''}`}
						>
							{item.label}
						</NavLink>
					))}
				</div>
			</div>
		</nav>
	)
}