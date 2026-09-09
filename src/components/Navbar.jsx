import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, LogOut, FileText, Lock, Menu, X, Video, FlaskConical } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { currentUser, isOfficer, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdminArea = location.pathname.startsWith('/admin');

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          
          {/* Brand Logo & Name */}
          <Link to="/report" className="flex items-center gap-2.5 sm:gap-3 group shrink-0 min-w-0" onClick={() => setMobileMenuOpen(false)}>
            <div className="p-1.5 sm:p-2 bg-blue-700 group-hover:bg-blue-600 rounded-md transition-colors shrink-0">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-wide text-sm sm:text-lg text-white truncate">SortIQ Enforce</span>
                <span className="hidden xs:inline-block text-[9px] sm:text-[10px] bg-slate-800 text-slate-300 font-mono px-1 py-0.2 sm:px-1.5 sm:py-0.5 rounded uppercase border border-slate-700">Gov</span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 font-medium truncate max-w-[170px] sm:max-w-none">Municipal Enforcement</p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-3 text-sm font-medium">
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
              <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-200">
                    {isOfficer ? 'Officer' : 'Citizen'}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate max-w-[120px]">
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

          {/* Mobile Right Controls: Compact Buttons + Hamburger */}
          <div className="flex md:hidden items-center gap-1.5 sm:gap-2">
            <Link
              to="/report"
              className={`text-xs px-2.5 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1 ${
                location.pathname === '/report'
                  ? 'bg-blue-900/70 text-blue-300 border border-blue-700/60'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Report</span>
            </Link>

            <Link
              to="/admin"
              className={`text-xs px-2.5 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1 ${
                isAdminArea
                  ? 'bg-blue-900/70 text-blue-300 border border-blue-700/60'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Officer</span>
            </Link>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="p-1.5 text-slate-400 hover:text-white bg-slate-800 border border-slate-700 rounded-md transition-colors ml-1"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950/95 backdrop-blur px-4 py-3 space-y-2 text-sm shadow-xl">
          <Link
            to="/report"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-slate-200 hover:bg-slate-800/80 font-medium"
          >
            <FileText className="w-4 h-4 text-blue-400" />
            <span>Citizen Civic Reporting Portal</span>
          </Link>

          <Link
            to="/admin"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-slate-200 hover:bg-slate-800/80 font-medium"
          >
            <Lock className="w-4 h-4 text-emerald-400" />
            <span>Officer Command Dashboard</span>
          </Link>

          <Link
            to="/admin/detection"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-slate-200 hover:bg-slate-800/80 font-medium"
          >
            <Video className="w-4 h-4 text-amber-400" />
            <span>CCTV Violation Detection AI</span>
          </Link>

          <Link
            to="/admin/mock-services"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-slate-200 hover:bg-slate-800/80 font-medium"
          >
            <FlaskConical className="w-4 h-4 text-purple-400" />
            <span>VAHAN & SMS Preview Lab</span>
          </Link>

          {currentUser && (
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between px-3 text-xs text-slate-400">
              <div>
                <div className="font-semibold text-slate-200">{isOfficer ? 'Officer Active' : 'Citizen Session'}</div>
                <div className="text-[11px] truncate max-w-[200px]">{currentUser.email || currentUser.uid}</div>
              </div>
              <button
                onClick={() => { logout(); setMobileMenuOpen(false); }}
                className="flex items-center gap-1 text-rose-400 hover:text-rose-300 font-semibold px-2 py-1 rounded bg-slate-900 border border-slate-800"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
