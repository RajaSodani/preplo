import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import OAuthCallback from './pages/OAuthCallback';

// Pages (created as stubs below — Sprint 2+ fills them out)
const Login    = () => <div>Login page</div>;
const Register = () => <div>Register page</div>;
const Dashboard = () => <div>Dashboard — Sprint 2</div>;

export default function App() {
  return (
    <BrowserRouter>
      {/* AuthProvider wraps everything so useAuth() works anywhere in the tree */}
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login"          element={<Login />} />
          <Route path="/register"       element={<Register />} />
          <Route path="/auth/callback"  element={<OAuthCallback />} />

          {/* Protected routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
