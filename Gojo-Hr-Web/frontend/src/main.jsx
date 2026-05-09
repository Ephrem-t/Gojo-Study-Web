import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './routes/AppRoutes'
import './index.css'
import { ThemeProvider, applyTheme, getStoredTheme } from './theme/ThemeContext'

applyTheme(getStoredTheme())

createRoot(document.getElementById('root')).render(
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <ThemeProvider>
      <AppRoutes />
    </ThemeProvider>
  </BrowserRouter>
)
