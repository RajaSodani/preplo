import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute wraps any route that requires authentication.
 * If the user isn't logged in, redirect to /login and remember
 * where they were trying to go (via location.state) so we can
 * send them there after login.
 *
 * Usage in router:
 *   <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // Show nothing while we verify the token on first load
  // (avoids a flash of the login page for authenticated users)
  if (loading) return <div>Loading...</div>;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
