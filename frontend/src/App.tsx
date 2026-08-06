import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';

import LoginPage from './features/auth/LoginPage';
import RegisterPage from './features/auth/RegisterPage';
import DashboardPage from './features/dashboard/DashboardPage';
import GroupsPage from './features/groups/GroupsPage';
import GroupDashboardPage from './features/groups/GroupDashboardPage';
import CreateGroupPage from './features/groups/CreateGroupPage';
import JoinGroupPage from './features/groups/JoinGroupPage';
import LeaderboardPage from './features/leaderboard/LeaderboardPage';
import HeatmapPage from './features/heatmap/HeatmapPage';

/**
 * Root application component.
 * Configures React Router and wraps the tree with AuthProvider.
 */
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/groups"    element={<ProtectedRoute><GroupsPage /></ProtectedRoute>} />
          <Route path="/groups/create" element={<ProtectedRoute><CreateGroupPage /></ProtectedRoute>} />
          <Route path="/groups/join"   element={<ProtectedRoute><JoinGroupPage /></ProtectedRoute>} />
          <Route path="/groups/:groupId" element={<ProtectedRoute><GroupDashboardPage /></ProtectedRoute>} />
          <Route path="/groups/:groupId/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
          <Route path="/heatmap" element={<ProtectedRoute><HeatmapPage /></ProtectedRoute>} />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
