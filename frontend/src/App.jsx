import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ProfileSetupPage from './pages/ProfileSetupPage';
import DiscoverPage from './pages/DiscoverPage';
import MatchesPage from './pages/MatchesPage';
import ChatPage from './pages/ChatPage';
import NotificationsPage from './pages/NotificationsPage';
import ProtectedRoute from './components/ProtectedRoute';
import BottomNav from './components/BottomNav';
import { initSocket, destroySocket } from './socketManager';

/**
 * SocketInitializer — initializes the singleton WebSocket connection
 * when the user is logged in (token exists). Cleans up on logout.
 * Must be inside BrowserRouter to access useLocation.
 */
function SocketInitializer() {
  const location = useLocation();
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (token) {
      // Initialize socket connection once when user is logged in
      initSocket();
    } else {
      // Clean up socket when user is logged out
      destroySocket();
    }
  }, [token, location.pathname]);

  return null;
}

function App() {
  const token = localStorage.getItem('token');

  return (
    <BrowserRouter>
      <SocketInitializer />
      <div className="app-viewport">
        <Routes>
          <Route path="/" element={<Navigate to={token ? '/discover' : '/login'} replace />} />
          <Route path="/login" element={<LoginPage />} />
          {/* Legacy routes redirect to login (Google handles signup now) */}
          <Route path="/signup" element={<Navigate to="/login" replace />} />
          <Route path="/verify-otp" element={<Navigate to="/login" replace />} />
          
          <Route path="/profile-setup" element={
            <ProtectedRoute requireCompletedProfile={false}>
              <ProfileSetupPage />
            </ProtectedRoute>
          } />
          
          <Route path="/discover" element={
            <ProtectedRoute>
              <DiscoverPage />
            </ProtectedRoute>
          } />

          <Route path="/matches" element={
            <ProtectedRoute>
              <MatchesPage />
            </ProtectedRoute>
          } />

          <Route path="/chat/:matchId" element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          } />

          <Route path="/notifications" element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          } />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}

export default App;
