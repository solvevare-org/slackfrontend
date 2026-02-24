import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import ChannelPage from "./pages/ChannelPage";
import DirectMessage from "./pages/DirectMessage";
import ProjectPage from "./pages/ProjectPage";
import Admin from "./pages/Admin";
import CreateGroup from "./pages/CreateGroup";
import CreateCommunity from "./pages/CreateCommunity";
import GroupChat from "./pages/GroupChat";
import Channels from "./pages/Channels";

import { ProtectedRoute } from "./components/ProtectedRoute";
import Workspace from "./pages/workspace";
import Massage from "./pages/massage";

const App = () => {
  return (
    <Router>
      <Routes>

        {/* PUBLIC ROUTES */}
        <Route path="/login" element={<Login />} />
        <Route path="/accept-invite" element={<Signup />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* DEFAULT REDIRECT */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* PROTECTED ROUTES */}
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
          path="/group/:groupId"
          element={
            <ProtectedRoute>
              <GroupChat />
            </ProtectedRoute>
          }
        />

        <Route
          path="/workspace"
          element={
            <ProtectedRoute requiredRole="admin">
              <Workspace />
            </ProtectedRoute>
          }
        />


        {/* <Route
          path="/channels"
          element={
            <ProtectedRoute>
              <Channels />
            </ProtectedRoute>
          }
        /> */}

        {/* ADMIN ONLY ROUTES */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <Admin />
            </ProtectedRoute>
          }
        />

        <Route
          path="/create-channel"
          element={
            <ProtectedRoute requiredRole="admin">
              <CreateGroup />
            </ProtectedRoute>
          }
        />

        <Route
          path="/massage"
          element={
            <ProtectedRoute>
              <Massage/>
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

        {/* 404 FALLBACK */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />

      </Routes>
    </Router>
  );
};

export default App;
