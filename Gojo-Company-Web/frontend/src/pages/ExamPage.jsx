import { useEffect, useState } from 'react'

const rolloutSteps = [
  'Define grade and subject scope',
  'Prepare question sets and answer keys',
  'Publish exam windows to teachers and students',
  'Review submissions and finalize marks',
]

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000'

const fallbackSchools = [
  { code: 'ET-ORO-ADA-GMI', name: 'Guda Miju', shortName: 'GMI' },
]

const fallbackOverview = {
  packages: [],
  exams: [],
  questionBanks: [],
  config: {},
  stats: {
    packageCount: 0,
    examCount: 0,
    questionBankCount: 0,
    competitiveExamCount: 0,
    practiceExamCount: 0,
    entranceExamCount: 0,
    totalQuestions: 0,
  },
}

function formatGradeLabel(grade) {
  if (!grade) {
    return 'Unscoped'
  }

  return grade.replace('grade', 'Grade ')
}

function formatSeconds(seconds) {
  if (!seconds) {
    return 'No timer'
  }

  const totalMinutes = Math.round(seconds / 60)
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`
  }

  return `${totalMinutes}m`
}

function formatMode(mode) {
  return String(mode || 'practice').replace('_', ' ')
}

export default function ExamPage() {
  const [schools, setSchools] = useState([])
  const [overview, setOverview] = useState(fallbackOverview)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadDashboard() {
      try {
        const [schoolsResponse, overviewResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/schools`),
          fetch(`${API_BASE_URL}/api/company-exams/overview`),
        ])

        if (!schoolsResponse.ok || !overviewResponse.ok) {
          throw new Error('Failed to load company exam data')
        }

        const [schoolsPayload, overviewPayload] = await Promise.all([
          schoolsResponse.json(),
          overviewResponse.json(),
        ])

        if (isMounted) {
          setSchools(Array.isArray(schoolsPayload.schools) ? schoolsPayload.schools : fallbackSchools)
          setOverview({
            ...fallbackOverview,
            ...overviewPayload,
            stats: {
              ...fallbackOverview.stats,
              ...(overviewPayload.stats || {}),
            },
          })
          setErrorMessage('')
        }
      } catch {
        if (isMounted) {
          setSchools(fallbackSchools)
          setOverview(fallbackOverview)
          setErrorMessage('Backend unavailable. Showing the route shell without live exam data.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadDashboard()

    return () => {
      isMounted = false
    }
  }, [])

  const examTracks = [
    {
      title: 'Question Bank',
      tone: 'gold',
      description: 'Question bank metadata is now loaded from the root-level questionBanks node.',
      stats: [
        `${overview.stats.questionBankCount} banks loaded`,
        `${overview.stats.totalQuestions} questions indexed`,
        'metadata-backed subject mapping',
      ],
    },
    {
      title: 'Assessment Pipeline',
      tone: 'teal',
      description: 'Exam definitions are read from companyExams.exams and normalized by the backend.',
      stats: [
        `${overview.stats.examCount} exams published`,
        `${overview.stats.practiceExamCount} practice flows`,
        `${overview.stats.competitiveExamCount} competitive rounds`,
      ],
    },
    {
      title: 'Package Control',
      tone: 'coral',
      description: 'Exam packages are grouped from companyExams.packages for rollout planning.',
      stats: [
        `${overview.stats.packageCount} packages active`,
        `${overview.stats.entranceExamCount} entrance sets`,
        `${schools.length} school targets`,
      ],
    },
  ]

  return (
    <main className="exam-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Gojo Company</span>
          <h1>Exam control room for school-wide planning and release.</h1>
          <p>
            This page is now wired to the live Firebase-backed Company exam nodes, using normalized backend
            endpoints for packages, exams, question banks, and rollout config.
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="#exam-tracks">Open exam modules</a>
            <a className="secondary-action" href="#exam-catalog">Browse exam catalog</a>
          </div>
          {errorMessage ? <div className="status-banner warning">{errorMessage}</div> : null}
        </div>

        <div className="hero-card">
          <div className="hero-card-label">Live readiness</div>
          <div className="hero-metric">
            {isLoading ? 'Loading...' : `${overview.stats.examCount} exams / ${overview.stats.questionBankCount} banks`}
          </div>
          <p>School registry, exam packages, and question-bank metadata are now sourced from the database.</p>
          <ul className="metric-list">
            <li>{schools.length} schools available for rollout</li>
            <li>Route entry available at <strong>/exams</strong></li>
            <li>{overview.stats.totalQuestions} indexed questions across linked banks</li>
          </ul>
        </div>
      </section>

      <section id="exam-tracks" className="section-block">
        <div className="section-heading">
          <span className="section-kicker">Exam modules</span>
          <h2>Three focused surfaces to run the exam cycle cleanly.</h2>
        </div>

        <div className="track-grid">
          {examTracks.map((track) => (
            <article key={track.title} className={`track-card tone-${track.tone}`}>
              <h3>{track.title}</h3>
              <p>{track.description}</p>
              <ul>
                {track.stats.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block split-layout">
        <div className="timeline-panel">
          <span className="section-kicker">Release flow</span>
          <h2>Operational sequence</h2>
          <ol className="timeline-list">
            {rolloutSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <div id="school-grid" className="schools-panel">
          <span className="section-kicker">School registry</span>
          <h2>Schools available for exam rollout</h2>
          <div className="school-grid">
            {schools.map((school) => (
              <article key={school.code} className="school-card">
                <div className="school-badge">{school.shortName || 'SCH'}</div>
                <h3>{school.name}</h3>
                <p>{school.code}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-block split-layout">
        <div className="timeline-panel">
          <span className="section-kicker">Packages</span>
          <h2>Active company exam packages</h2>
          <div className="catalog-grid compact-grid">
            {overview.packages.map((pkg) => (
              <article key={pkg.packageId} className="catalog-card">
                <div className="catalog-meta-row">
                  <span className="pill pill-teal">{formatGradeLabel(pkg.grade)}</span>
                  <span className="pill">{formatMode(pkg.type)}</span>
                </div>
                <h3>{pkg.name}</h3>
                <p>{pkg.description || 'No package description provided.'}</p>
                <div className="catalog-footnote">{pkg.examCount} linked exams</div>
              </article>
            ))}
          </div>
        </div>

        <div className="schools-panel">
          <span className="section-kicker">Config</span>
          <h2>Exam runtime settings</h2>
          <div className="config-grid">
            <article className="config-card">
              <div className="config-value">{overview.config?.attempts?.defaultRefillIntervalMs || 0} ms</div>
              <p>Default attempt refill interval</p>
            </article>
            <article className="config-card">
              <div className="config-value">{overview.config?.lives?.defaultMaxLives || 0}</div>
              <p>Default max lives</p>
            </article>
            <article className="config-card">
              <div className="config-value">{overview.config?.lives?.practiceDeductionMode || 'n/a'}</div>
              <p>Practice deduction mode</p>
            </article>
            <article className="config-card">
              <div className="config-value">{overview.config?.ui?.showRankingInfoInCompetitiveRules ? 'On' : 'Off'}</div>
              <p>Competitive ranking info visibility</p>
            </article>
          </div>
        </div>
      </section>

      <section id="exam-catalog" className="section-block">
        <div className="section-heading">
          <span className="section-kicker">Exam catalog</span>
          <h2>Live exams from companyExams.exams</h2>
        </div>

        <div className="catalog-grid">
          {overview.exams.map((exam) => (
            <article key={exam.examId} className="catalog-card">
              <div className="catalog-meta-row">
                <span className="pill pill-gold">{formatGradeLabel(exam.grade)}</span>
                <span className="pill">{formatMode(exam.mode)}</span>
              </div>
              <h3>{exam.examId}</h3>
              <p>
                Bank: {exam.questionBankId || 'Unassigned'}
                <br />
                Subject: {exam.subject || 'Unknown'}
              </p>
              <ul className="catalog-list">
                <li>{exam.totalQuestions} total questions</li>
                <li>{exam.questionPoolSize} pool size</li>
                <li>{formatSeconds(exam.timeLimit)} timer</li>
                <li>{exam.maxAttempts} max attempts</li>
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <span className="section-kicker">Question banks</span>
          <h2>Metadata from questionBanks.questionBanks</h2>
        </div>

        <div className="catalog-grid compact-grid">
          {overview.questionBanks.map((questionBank) => (
            <article key={questionBank.questionBankId} className="catalog-card">
              <div className="catalog-meta-row">
                <span className="pill pill-coral">{formatGradeLabel(questionBank.grade)}</span>
                <span className="pill">{questionBank.subject || 'general'}</span>
              </div>
              <h3>{questionBank.questionBankId}</h3>
              <p>{questionBank.title || 'Untitled question bank'}</p>
              <div className="catalog-footnote">{questionBank.totalQuestions} questions indexed</div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}