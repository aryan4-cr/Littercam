import React, { useState } from 'react';
import { 
  Shield, Send, Camera, MapPin, CheckCircle2, User, Phone, 
  Clock, AlertCircle, FileText, PlusCircle, RefreshCw, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SEED_REPORTS } from '../data/seedData';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';

/**
 * SortIQ Enforce — Citizen Civic Reporting Portal
 * ====================================================
 * Route: /report
 * The ONLY citizen-facing module in this system.
 *
 * Tabs:
 *   1. Report Incident — submit new overflowing bin / illegal dumping report
 *   2. My Reports — see status of citizen's own submitted reports
 * ====================================================
 */

const CATEGORIES = [
  { value: 'Overflowing Bin', label: 'Overflowing Garbage Bin / Dustbin' },
  { value: 'Illegal Dumping', label: 'Illegal Solid Waste Dumping' },
  { value: 'Vehicle Littering', label: 'Vehicle Littering Observed (Plate noted)' },
  { value: 'Blocked Drain', label: 'Drain / Nala Blocked by Garbage' },
  { value: 'Other Civic Offense', label: 'Other Municipal Infrastructure Offense' },
];

const STATUS_CONFIG = {
  REPORTED:     { label: 'Reported', color: 'text-slate-300', bg: 'bg-slate-800', border: 'border-slate-700', dot: 'bg-slate-400' },
  ACKNOWLEDGED: { label: 'Acknowledged', color: 'text-amber-300', bg: 'bg-amber-950', border: 'border-amber-800', dot: 'bg-amber-400' },
  RESOLVED:     { label: 'Resolved', color: 'text-emerald-300', bg: 'bg-emerald-950', border: 'border-emerald-800', dot: 'bg-emerald-400' },
};

const STATUS_STEPS = ['REPORTED', 'ACKNOWLEDGED', 'RESOLVED'];

// Mock "my reports" — in production, queried by citizenId from Firestore
const MY_MOCK_REPORTS = SEED_REPORTS.slice(0, 4).map(r => ({
  ...r,
  // Simulate a mix of statuses
  location: r.location,
}));

export default function CitizenPortal() {
  const { currentUser, loginCitizen } = useAuth();
  const [activeTab, setActiveTab] = useState('report');

  // Report form state
  const [reportType, setReportType] = useState('Overflowing Bin');
  const [description, setDescription] = useState('');
  const [locationText, setLocationText] = useState('');
  const [gpsCoords, setGpsCoords] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [myReports, setMyReports] = useState(MY_MOCK_REPORTS);
  const [contactInfo, setContactInfo] = useState('');

  const handleGeoTag = () => {
    if (!navigator.geolocation) {
      setStatusMessage({ type: 'error', text: 'Geolocation not supported on this device.' });
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationText(`GPS: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        setGpsLoading(false);
      },
      () => {
        // Fallback to mock coordinates for demo
        const mockCoords = { lat: 18.5204 + (Math.random() - 0.5) * 0.05, lng: 73.8567 + (Math.random() - 0.5) * 0.05 };
        setGpsCoords(mockCoords);
        setLocationText(`GPS (demo): ${mockCoords.lat.toFixed(5)}, ${mockCoords.lng.toFixed(5)}`);
        setGpsLoading(false);
      },
      { timeout: 6000 }
    );
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
    }
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    setSubmitting(true);

    // Simulate realistic civic dispatch & evidence transmission delay (1.4s - 1.8s)
    await new Promise(r => setTimeout(r, 1400 + Math.random() * 400));

    const newReport = {
      citizenId: currentUser.uid || 'demo-citizen',
      title: `${reportType} — ${locationText || 'Location not specified'}`,
      category: reportType,
      description: description || '[No description provided]',
      location: { lat: gpsCoords?.lat || 0, lng: gpsCoords?.lng || 0, address: locationText },
      imageUrl: photoPreview || 'https://placehold.co/800x600/0f172a/64748b?text=CITIZEN+REPORT+PHOTO',
      status: 'REPORTED',
      priority: 'MEDIUM',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      vehiclePlate: vehiclePlate || null,
    };

    let savedId = `rep-local-${Date.now()}`;

    // ── Try Firestore write, fall back to local state ────────────────
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.REPORTS), newReport);
      savedId = docRef.id;
      console.log('[CitizenPortal] Report written to Firestore:', savedId);
    } catch (err) {
      console.warn('[CitizenPortal] Firestore write failed, saving locally:', err.message);
      // Still proceed — report saved in local state below
    }

    setMyReports(prev => [{ ...newReport, id: savedId, createdAt: new Date() }, ...prev]);
    setStatusMessage({ type: 'success', text: 'Report submitted successfully! Track status in "My Reports" tab.' });
    setDescription('');
    setLocationText('');
    setGpsCoords(null);
    setVehiclePlate('');
    setPhotoPreview(null);
    setSubmitting(false);
    setTimeout(() => setActiveTab('myreports'), 1500);
  };

  const handleCitizenAuth = async (e) => {
    e.preventDefault();
    try {
      await loginCitizen();
      setAuthModalOpen(false);
      setStatusMessage({ type: 'success', text: 'Citizen session established. You may now submit reports.' });
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: 'error', text: 'Authentication failed. Please try again.' });
    }
  };

  const formatDate = (val) => {
    if (!val) return '—';
    try {
      const d = val?.toDate ? val.toDate() : new Date(val);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return '—'; }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      {/* Portal Header */}
      <div className="bg-slate-900 text-white py-5 sm:py-7 px-4 border-b border-slate-800">
        <div className="max-w-xl mx-auto text-center">
          <span className="inline-flex items-center gap-1.5 bg-blue-900/80 text-blue-300 text-[11px] sm:text-xs px-2.5 py-0.5 sm:py-1 rounded-full font-mono mb-2.5 border border-blue-700/50">
            <Shield className="w-3.5 h-3.5" /> Municipal Civic Services
          </span>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-white">Citizen Reporting Portal</h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-md mx-auto leading-relaxed">
            Report overflowing bins, illegal dumping, and littering incidents directly to Municipal Enforcement.
          </p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-3.5 sm:px-4 mt-4 sm:mt-6">

        {/* Status Toast */}
        {statusMessage && (
          <div className={`mb-5 p-4 rounded-lg flex items-start gap-3 shadow-sm border text-sm ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}>
            {statusMessage.type === 'success'
              ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
            <div className="font-medium">{statusMessage.text}</div>
          </div>
        )}

        {/* Citizen Session Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-5 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-full text-slate-700"><User className="w-5 h-5" /></div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">Citizen Session</div>
              <div className="text-sm font-semibold text-slate-800">
                {currentUser ? (currentUser.email || `Session Active`) : 'Guest Citizen'}
              </div>
            </div>
          </div>
          {!currentUser ? (
            <button onClick={() => setAuthModalOpen(true)}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-md hover:bg-blue-100 transition-colors">
              Sign In
            </button>
          ) : (
            <span className="text-xs bg-emerald-100 text-emerald-800 font-medium px-2.5 py-1 rounded-full border border-emerald-300">Active</span>
          )}
        </div>

        {/* Tab Nav */}
        <div className="flex bg-slate-100 rounded-xl p-1 mb-5 border border-slate-200">
          <button onClick={() => setActiveTab('report')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'report' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <PlusCircle className="w-4 h-4" /> Report Incident
          </button>
          <button onClick={() => setActiveTab('myreports')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'myreports' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <FileText className="w-4 h-4" /> My Reports
            {myReports.length > 0 && (
              <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{myReports.length}</span>
            )}
          </button>
        </div>

        {/* ── TAB 1: REPORT INCIDENT ─────────────────────────────────── */}
        {activeTab === 'report' && (
          <form onSubmit={handleSubmitReport} className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">Submit Violation Report</h2>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Violation Category</label>
              <select value={reportType} onChange={(e) => setReportType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600">
                {CATEGORIES.map(c => <option key={c.value + c.label} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            {/* Vehicle Plate (if vehicle littering selected) */}
            {reportType === 'Vehicle Littering Observed (Plate noted)' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Observed Vehicle Plate</label>
                <input type="text" placeholder="e.g. MH12AB1234" value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 uppercase" />
              </div>
            )}

            {/* Location + Geotag */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Location / Address</span>
                <button type="button" onClick={handleGeoTag} disabled={gpsLoading}
                  className="text-[11px] text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1 disabled:opacity-50">
                  {gpsLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
                  {gpsLoading ? 'Getting GPS…' : 'Auto-Geotag'}
                </button>
              </label>
              <div className="relative">
                <input type="text" placeholder="Street address or tap Auto-Geotag"
                  value={locationText} onChange={(e) => setLocationText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md pl-9 pr-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600" />
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
              {gpsCoords && (
                <p className="text-[11px] text-emerald-700 mt-1.5 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  GPS tagged: {gpsCoords.lat.toFixed(5)}, {gpsCoords.lng.toFixed(5)}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Incident Description</label>
              <textarea rows={3} placeholder="Describe the violation — vehicle plate, time observed, size of dump…"
                value={description} onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none" />
            </div>

            {/* Photo Upload */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Evidence Photo</label>
              {photoPreview ? (
                <div className="relative">
                  <img src={photoPreview} alt="Preview" className="w-full h-40 object-cover rounded-lg border border-slate-300" />
                  <button type="button" onClick={() => setPhotoPreview(null)}
                    className="absolute top-2 right-2 bg-slate-900/70 text-white text-xs px-2 py-1 rounded font-semibold">
                    Remove
                  </button>
                </div>
              ) : (
                <label className="block border-2 border-dashed border-slate-300 rounded-md p-4 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                  <Camera className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                  <p className="text-xs font-medium text-slate-600">Tap to capture or upload photograph</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">JPEG, PNG up to 10MB</p>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
                </label>
              )}
            </div>

            {/* Submit */}
            <button type="submit" disabled={submitting}
              className="w-full bg-blue-800 hover:bg-blue-900 text-white font-semibold py-2.5 px-4 rounded-md shadow-sm transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-60">
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{submitting ? 'Submitting…' : 'Transmit Official Report'}</span>
            </button>
          </form>
        )}

        {/* ── TAB 2: MY REPORTS ──────────────────────────────────────── */}
        {activeTab === 'myreports' && (
          <div className="space-y-4">
            {myReports.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-10 text-center shadow-sm">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-500">No reports submitted yet.</p>
                <button onClick={() => setActiveTab('report')}
                  className="mt-3 text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 mx-auto">
                  Submit your first report <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              myReports.map(report => {
                const statusCfg = STATUS_CONFIG[report.status] || STATUS_CONFIG.REPORTED;
                const stepIdx = STATUS_STEPS.indexOf(report.status);
                return (
                  <div key={report.id} className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
                    <div className="flex items-start gap-3">
                      <img src={report.imageUrl || 'https://placehold.co/80x56/f1f5f9/94a3b8?text=Photo'}
                        alt="Report" className="w-20 h-14 rounded-lg object-cover border border-slate-200 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${statusCfg.bg} ${statusCfg.border} ${statusCfg.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot} inline-block`}></span>
                            {statusCfg.label}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 leading-tight">{report.title}</h3>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{report.location?.address || '—'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>Submitted: {formatDate(report.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Timeline */}
                    <div className="border-t border-slate-100 pt-3">
                      <div className="flex items-center gap-0">
                        {STATUS_STEPS.map((step, i) => {
                          const passed = i <= stepIdx;
                          const stepCfg = STATUS_CONFIG[step];
                          return (
                            <React.Fragment key={step}>
                              <div className="flex flex-col items-center">
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                  passed ? `${stepCfg.bg} ${stepCfg.border}` : 'bg-slate-100 border-slate-300'
                                }`}>
                                  {passed && <span className={`w-2.5 h-2.5 rounded-full ${stepCfg.dot}`}></span>}
                                </div>
                                <span className={`text-[10px] font-semibold mt-1 ${passed ? stepCfg.color : 'text-slate-400'}`}>
                                  {stepCfg.label}
                                </span>
                              </div>
                              {i < STATUS_STEPS.length - 1 && (
                                <div className={`flex-1 h-0.5 mx-1 mb-4 ${i < stepIdx ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-slate-500 font-medium space-y-1">
          <p>SortIQ Enforce Platform — Official Citizen Dispatch Interface</p>
          <p className="text-[11px] text-slate-400">All submissions are logged into the municipal enforcement pipeline.</p>
        </div>
      </div>

      {/* Citizen Auth Modal */}
      {authModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 text-blue-800 rounded-lg"><Shield className="w-5 h-5" /></div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Citizen Identity Verification</h3>
                <p className="text-xs text-slate-500">Sign in to track and submit reports</p>
              </div>
            </div>
            <form onSubmit={handleCitizenAuth} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Mobile Number / Email</label>
                <div className="relative">
                  <input type="text" placeholder="+91 98765 43210 or email@domain.gov"
                    value={contactInfo} onChange={(e) => setContactInfo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md pl-9 pr-3 py-2 text-sm text-slate-800" />
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>
              <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded border border-slate-200">
                <div className="font-semibold text-slate-700 mb-0.5">Demo Mode:</div>
                Click authenticate to start a demo citizen session with no Firebase credentials required.
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setAuthModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 rounded-md text-xs">Cancel</button>
                <button type="submit"
                  className="flex-1 bg-blue-800 hover:bg-blue-900 text-white font-semibold py-2 rounded-md text-xs">Authenticate</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
