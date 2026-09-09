import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, UserCheck, LogOut, FileText, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { currentUser, isOfficer, logout } = useAuth();
  const location = useLocation();

  const isAdminArea = location.pathname.startsWith('/admin');

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand Logo & Name */}
          <Link to="/report" className="flex items-center gap-3 group">
            <div className="p-2 bg-blue-700 group-hover:bg-blue-600 rounded-md transition-colors">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-wide text-lg text-white">SortIQ Enforce</span>
                <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-1.5 py-0.5 rounded uppercase tracking-wider border border-slate-700">Gov-v1.0</span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Municipal Enforcement Authority</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link
              to="/report"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
                location.pathname === '/report'
                  ? 'bg-slate-800 text-blue-400 font-semibold border border-slate-700'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Citizen Portal</span>
            </Link>

            <Link
              to="/admin"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
                isAdminArea
                  ? 'bg-blue-900/60 text-blue-300 font-semibold border border-blue-700/50'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>Officer Dashboard</span>
            </Link>

            {currentUser && (
              <div className="flex items-center gap-3 pl-4 border-l border-slate-800">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-slate-200">
                    {isOfficer ? 'Officer Account' : 'Citizen Session'}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
                    {currentUser.email || currentUser.uid}
                  </div>
                </div>
                <button
                  onClick={logout}
                  title="Logout"
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </nav>

        </div>
      </div>
    </header>
  );
}
