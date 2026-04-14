import { Navigate, Route, Routes } from 'react-router-dom'
import Books from '../pages/Books'
import ExamPage from '../pages/ExamPage'
import StudentProgressPage from '../pages/StudentProgressPage'
import StudentResultsPage from '../pages/StudentResultsPage'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/exams/practice" replace />} />
      <Route path="/books" element={<Navigate to="/books/save" replace />} />
      <Route path="/books/save" element={<Books view='save' />} />
      <Route path="/books/library" element={<Books view='library' />} />
      <Route path="/exams" element={<Navigate to="/exams/practice" replace />} />
      <Route path="/exams/practice" element={<ExamPage routeMode='practice' />} />
      <Route path="/exams/competitive" element={<ExamPage routeMode='competitive' />} />
      <Route path="/exams/entrance" element={<ExamPage routeMode='entrance' />} />
      <Route path="/student-progress" element={<StudentProgressPage />} />
      <Route path="/student-results" element={<StudentResultsPage />} />
      <Route path="*" element={<Navigate to="/exams/practice" replace />} />
    </Routes>
  )
}