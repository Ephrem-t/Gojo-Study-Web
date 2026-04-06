import { Navigate, Route, Routes } from 'react-router-dom'
import ExamPage from '../pages/ExamPage'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/exams" replace />} />
      <Route path="/exams" element={<ExamPage />} />
      <Route path="*" element={<Navigate to="/exams" replace />} />
    </Routes>
  )
}