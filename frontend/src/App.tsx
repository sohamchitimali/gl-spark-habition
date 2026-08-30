import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';

import LoginPage from './features/auth/LoginPage';
import RegisterPage from './features/auth/RegisterPage';
import ForgotPasswordPage from './features/auth/ForgotPasswordPage';
import DashboardPage from './features/dashboard/DashboardPage';
import GroupsPage from './features/groups/GroupsPage';
import HabitGroupPage from './features/groups/HabitGroupPage';
import GroupJoinRequestsPage from './features/groups/GroupJoinRequestsPage';
import CreateGroupPage from './features/groups/CreateGroupPage';
import JoinGroupPage from './features/groups/JoinGroupPage';
import SearchPage from './features/search/SearchPage';
import LeaderboardPage from './features/leaderboard/LeaderboardPage';
import HeatmapPage from './features/heatmap/HeatmapPage';
import ProfilePage from './features/profile/ProfilePage';
import ChatsPage from './features/chats/ChatsPage';
import MySentRequestsPage from './features/groups/MySentRequestsPage';

import { ConfirmProvider } from './context/ConfirmContext';

/**
 * Root application component.
 * Configures React Router and wraps the tree with AuthProvider.
 */
function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <BrowserRouter>
          <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Protected routes */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/groups" element={<ProtectedRoute><GroupsPage /></ProtectedRoute>} />
          <Route path="/groups/create" element={<ProtectedRoute><CreateGroupPage /></ProtectedRoute>} />
          <Route path="/groups/join" element={<ProtectedRoute><JoinGroupPage /></ProtectedRoute>} />
          <Route path="/groups/discover" element={<Navigate to="/search" replace />} />
          <Route path="/groups/my-requests" element={<ProtectedRoute><MySentRequestsPage /></ProtectedRoute>} />
          <Route path="/groups/:groupId" element={<ProtectedRoute><HabitGroupPage /></ProtectedRoute>} />
          <Route path="/groups/:groupId/join-requests" element={<ProtectedRoute><GroupJoinRequestsPage /></ProtectedRoute>} />
          <Route path="/groups/:groupId/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
          <Route path="/chats" element={<ProtectedRoute><ChatsPage /></ProtectedRoute>} />
          <Route path="/people" element={<Navigate to="/search" replace />} />
          <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/heatmap" element={<ProtectedRoute><HeatmapPage /></ProtectedRoute>} />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </BrowserRouter>
      </ConfirmProvider>
    </AuthProvider>
  );
}

export default App;
