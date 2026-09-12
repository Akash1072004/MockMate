import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import ConfigBanner from './components/common/ConfigBanner';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import CandidateDashboard from './pages/CandidateDashboard';
import FindInterviewerPage from './pages/FindInterviewerPage';
import InterviewerDashboard from './pages/InterviewerDashboard';
import ProfilePage from './pages/ProfilePage';
import AIInterviewPage from './pages/AIInterviewPage';
import JoinByCodePage from './pages/JoinByCodePage';
import InterviewRoomPage from './pages/InterviewRoomPage';
import InterviewResultsPage from './pages/InterviewResultsPage';
import LeaderboardPage from './pages/LeaderboardPage';
import NotFoundPage from './pages/NotFoundPage';

// Automatic role-based dashboard router
function RoleBasedDashboardRedirect() {
  const { user, profile, role, loading } = useAuth();

  if (loading || (user && !profile)) {
    return <div className="container" style={{ padding: '5rem 1.5rem', textAlign: 'center' }}>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const effectiveRole = profile?.role || role || 'candidate';
  return <Navigate to={effectiveRole === 'interviewer' ? '/interviewer/dashboard' : '/candidate/dashboard'} replace />;
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ConfigBanner />
        <Navbar />
        <main className="main-content">
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />

            {/* Role redirect */}
            <Route path="/dashboard" element={<RoleBasedDashboardRedirect />} />

            {/* Protected Candidate routes */}
            <Route
              path="/candidate/dashboard"
              element={
                <ProtectedRoute allowedRole="candidate">
                  <CandidateDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/candidate/find-interviewer"
              element={
                <ProtectedRoute allowedRole="candidate">
                  <FindInterviewerPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interview/ai"
              element={
                <ProtectedRoute allowedRole="candidate">
                  <AIInterviewPage />
                </ProtectedRoute>
              }
            />

            {/* Protected Interviewer routes */}
            <Route
              path="/interviewer/dashboard"
              element={
                <ProtectedRoute allowedRole="interviewer">
                  <InterviewerDashboard />
                </ProtectedRoute>
              }
            />

            {/* Protected Profile route */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />

            {/* Protected Interview Room routes */}
            <Route
              path="/join"
              element={
                <ProtectedRoute>
                  <JoinByCodePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interview/:id"
              element={
                <ProtectedRoute>
                  <InterviewRoomPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interview/results/:id"
              element={
                <ProtectedRoute>
                  <InterviewResultsPage />
                </ProtectedRoute>
              }
            />

            {/* 404 handler */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <Footer />
      </AuthProvider>
    </Router>
  );
}
