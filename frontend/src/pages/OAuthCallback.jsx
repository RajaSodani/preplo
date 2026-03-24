import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * After Google OAuth, the backend redirects to:
 *   /auth/callback#token=<accessToken>
 *
 * This page extracts the token from the URL fragment and saves it.
 * Fragment (#...) is never sent to the server — more secure than a query param.
 */
export default function OAuthCallback() {
  const { handleOAuthCallback } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;             // e.g. "#token=eyJhbGci..."
    const params = new URLSearchParams(hash.slice(1)); // remove leading #
    const token = params.get('token');

    if (token) {
      handleOAuthCallback(token);
      navigate('/dashboard', { replace: true });
    } else {
      navigate('/login?error=oauth_failed', { replace: true });
    }
  }, []);

  return <div>Signing you in...</div>;
}
