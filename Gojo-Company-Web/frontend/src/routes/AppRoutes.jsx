import { Navigate, Route, Routes } from 'react-router-dom'
import Books from '../pages/Books'
import ExamPage from '../pages/ExamPage'
import StudentProgressPage from '../pages/StudentProgressPage'
import StudentResultsPage from '../pages/StudentResultsPage'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/exams" replace />} />
      <Route path="/books" element={<Books />} />
      <Route path="/exams" element={<ExamPage />} />
      <Route path="/student-progress" element={<StudentProgressPage />} />
      <Route path="/student-results" element={<StudentResultsPage />} />
      <Route path="*" element={<Navigate to="/exams" replace />} />
    </Routes>
  )
}