import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import CitizenPortal from './pages/CitizenPortal';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import MockServicesDemo from './pages/MockServicesDemo';
import DetectionModule from './pages/DetectionModule';

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
        <Navbar />
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<Navigate to="/report" replace />} />
            <Route path="/report" element={<CitizenPortal />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin/detection"
              element={
                <ProtectedRoute>
                  <DetectionModule />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/mock-services"
              element={
                <ProtectedRoute>
                  <MockServicesDemo />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/report" replace />} />
          </Routes>
        </div>
      </div>
    </AuthProvider>
  );
}
