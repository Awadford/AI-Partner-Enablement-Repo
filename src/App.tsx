import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Login } from './pages/Login'
import { SetPassword } from './pages/SetPassword'
import { LearnerDashboard } from './pages/learner/Dashboard'
import { ModulePage } from './pages/learner/ModulePage'
import { AdminDashboard } from './pages/admin/Dashboard'
import { AdminPartners } from './pages/admin/Partners'
import { AdminPartnerDetail } from './pages/admin/PartnerDetail'
import { AdminModules } from './pages/admin/Modules'
import { AdminUsers } from './pages/admin/Users'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminRoute } from './components/AdminRoute'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/set-password" element={<SetPassword />} />

        {/* Learner routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute><LearnerDashboard /></ProtectedRoute>
        } />
        <Route path="/module/:moduleId" element={
          <ProtectedRoute><ModulePage /></ProtectedRoute>
        } />

        {/* Admin routes */}
        <Route path="/admin" element={
          <AdminRoute><AdminDashboard /></AdminRoute>
        } />
        <Route path="/admin/partners" element={
          <AdminRoute><AdminPartners /></AdminRoute>
        } />
        <Route path="/admin/partners/:partnerId" element={
          <AdminRoute><AdminPartnerDetail /></AdminRoute>
        } />
        <Route path="/admin/modules" element={
          <AdminRoute><AdminModules /></AdminRoute>
        } />
        <Route path="/admin/users" element={
          <AdminRoute><AdminUsers /></AdminRoute>
        } />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
