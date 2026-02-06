import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ChannelPage from './pages/ChannelPage'
import DirectMessage from './pages/DirectMessage'
import ProjectPage from './pages/ProjectPage'
import Admin from './pages/Admin'
import CreateGroup from './pages/CreateGroup'
import CreateCommunity from './pages/CreateCommunity'
import GroupChat from './pages/GroupChat'
import Signup from './pages/Signup'
import { ProtectedRoute } from './components/ProtectedRoute'

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/channel/:channelId"
          element={
            <ProtectedRoute>
              <ChannelPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dm/:userId"
          element={
            <ProtectedRoute>
              <DirectMessage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/project/:projectId"
          element={
            <ProtectedRoute>
              <ProjectPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <Admin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-group"
          element={
            <ProtectedRoute requiredRole="admin">
              <CreateGroup />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-community"
          element={
            <ProtectedRoute requiredRole="admin">
              <CreateCommunity />
            </ProtectedRoute>
          }
        />
        <Route
          path="/group/:groupId"
          element={
            <ProtectedRoute>
              <GroupChat />
            </ProtectedRoute>
          }
        />
        <Route path="/accept-invite" element={<Signup />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  )
}

export default App