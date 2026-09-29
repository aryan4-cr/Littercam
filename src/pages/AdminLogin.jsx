import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Lock, Mail, Key, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { loginOfficer, setDemoOfficerSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/admin';

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await loginOfficer(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check officer credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleBypassDemoLogin = async () => {
    // Use loginOfficer with demo email — AuthContext fallback will create mock user
    try {
      await loginOfficer('demo-officer@municipal.gov.in', 'demo');
    } catch {
      // If even the fallback fails, force demo session
      setDemoOfficerSession(true);
    }
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-900 text-slate-100 flex flex-col justify-center items-center px-4 py-12">
      <div className="max-w-md w-full">
        
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-blue-950 border border-blue-800 rounded-xl mb-4 text-blue-400">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Municipal Officer Access Portal
          </h1>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-mono">
            LitterCam — Authorized Officer Login
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-rose-950/80 border border-rose-800 text-rose-200 p-4 rounded-lg flex items-start gap-3 text-xs">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block mb-0.5">Authentication Error</span>
              {error}
            </div>
          </div>
        )}

        {/* Login Card */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Officer Email / Badge ID
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="officer.sharma@municipal.gov.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Secure Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Key className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {loading ? (
                <span>Verifying Officer Credentials...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Authenticate Officer Account</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-700/80 text-center">
            <p className="text-xs text-slate-400 mb-3">Testing & Scaffolding Mode Quick Access:</p>
            <button
              type="button"
              onClick={handleBypassDemoLogin}
              className="w-full bg-slate-900 hover:bg-slate-950 text-blue-400 font-semibold py-2 px-4 rounded-lg border border-slate-700 hover:border-blue-500/50 text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Grant Demo Officer Access</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="mt-6 text-center text-[11px] text-slate-500">
          Un-authorized access to Municipal Enforcement systems is strictly prohibited under Public Infrastructure Acts.
        </div>

      </div>
    </div>
  );
}
