import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="container" style={{ padding: '6rem 1.5rem', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', marginBottom: '1.5rem' }}>
        <AlertCircle size={32} />
      </div>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>404 - Page Not Found</h1>
      <p style={{ maxWidth: '460px', marginBottom: '2rem' }}>
        The page you are looking for does not exist or has been moved to a new route.
      </p>
      <Link to="/" className="btn btn-primary">
        <Home size={18} />
        <span>Return to Home</span>
      </Link>
    </div>
  );
}
