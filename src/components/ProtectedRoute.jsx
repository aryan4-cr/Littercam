import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { currentUser, isOfficer, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-200">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm font-medium tracking-wide">Verifying Municipal Credentials...</p>
        </div>
      </div>
    );
  }

  if (!currentUser || !isOfficer) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return children;
}
