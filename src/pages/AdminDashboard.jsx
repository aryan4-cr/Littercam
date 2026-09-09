import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PrototypeBanner from '../components/PrototypeBanner';
import ChallanTable from '../components/ChallanTable';
import HotspotMap from '../components/HotspotMap';
import SMSPreviewModal from '../components/SMSPreviewModal';
import LegalBasisPanel from '../components/LegalBasisPanel';
import { useAuth } from '../context/AuthContext';
import { SEED_VIOLATIONS } from '../data/seedData';
import { SEED_REPORTS } from '../data/seedData';
import { generateChallan } from '../services/mockDetectionService';
import { getViolationHistory } from '../services/vahanLookup';
import { logAuditEvent, AUDIT_ACTIONS, getAuditLog, getAuditStats } from '../services/auditLog';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';
import {
  LayoutDashboard, Clock, Receipt, Map, FileText,
  FlaskConical, ShieldCheck, Building2, AlertTriangle,
  CheckCircle2, XCircle, User, MapPin, Camera, Eye,
  TrendingUp, Users, Car, Activity, ChevronRight,
  MessageSquare, RefreshCw, Video, ScrollText, Filter
} from 'lucide-react';

/**
 * SortIQ Enforce — Municipal Officer Dashboard
 * ====================================================
 * SIMULATED DATA — PROTOTYPE ONLY
 *
 * Tabs:
 *   1. Overview — analytics cards + quick summary
 *   2. Pending Review — pedestrian violation review queue
 *   3. Challan Register — all issued challans
 *   4. Hotspot Heatmap — unified map
 *   5. Citizen Reports — incoming report management
 *   6. Audit Log — system decision trail
 * ====================================================
 */

const REJECTION_REASONS = [
  { value: 'FALSE_POSITIVE', label: 'False positive — no violation occurred' },
  { value: 'INSUFFICIENT_EVIDENCE', label: 'Insufficient evidence — image unclear' },
  { value: 'DUPLICATE_REPORT', label: 'Duplicate of existing case' },
  { value: 'OTHER', label: 'Other (logged without detail)' },
];

const TABS = [
  { id: 'overview',   label: 'Overview',        icon: LayoutDashboard },
  { id: 'pending',    label: 'Pending Review',   icon: Clock,       badge: true },
  { id: 'challans',   label: 'Challan Register', icon: Receipt },
  { id: 'heatmap',    label: 'Hotspot Heatmap',  icon: Map },
  { id: 'reports',    label: 'Citizen Reports',  icon: FileText },
  { id: 'auditlog',   label: 'Audit Log',        icon: ScrollText },
];

// ── Derived seed data helpers ───────────────────────────────────────────────
function buildInitialChallans() {
  return SEED_VIOLATIONS
    .filter(v => v.status !== 'PENDING_OFFICER_REVIEW')
    .map(v => ({
      id: v.id.replace('viol-', 'CHN-'),
      violationId: v.id,
      offenderName: v.offenderName,
      vehicleNumber: v.vehicleNumber,
      caseId: v.vehicleNumber ? null : v.id,
      offenceType: v.subType || v.type,
      fineAmount: v.fineAmount,
      status: v.status === 'RESOLVED' || v.status === 'PAID' ? 'PAID'
            : v.status === 'APPEALED' ? 'APPEALED'
            : 'ISSUED',
      createdAt: v.createdAt,
      gps: v.gps,
      locationAddress: v.locationAddress,
      evidencePhotoUrl: v.evidencePhotoUrl,
      officerName: v.officerName,
      offenceCount: 1,
      appealInstructions: 'To dispute this challan, file an appeal at your nearest Municipal Corporation office or visit sortiq.gov.in/appeal within 30 days of issue date.',
    }));
}

function buildInitialPendingQueue() {
  return SEED_VIOLATIONS
    .filter(v => v.type === 'PEDESTRIAN_LITTERING' && v.status === 'PENDING_PAYMENT')
    .slice(0, 3)
    .map(v => ({
      ...v,
      status: 'PENDING_OFFICER_REVIEW',
    }));
}

const STATUS_REPORT_STYLES = {
  REPORTED:     'bg-slate-800 text-slate-300 border-slate-700',
  ACKNOWLEDGED: 'bg-amber-950 text-amber-300 border-amber-800',
  RESOLVED:     'bg-emerald-950 text-emerald-300 border-emerald-800',
};

const AUDIT_ACTION_STYLES = {
  DETECTION_AUTO_APPROVED: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  DETECTION_FLAGGED_REVIEW: 'bg-amber-950 text-amber-300 border-amber-800',
  DETECTION_DISCARDED_LOW_CONFIDENCE: 'bg-slate-800 text-slate-400 border-slate-700',
  DETECTION_OCR_FAILED: 'bg-rose-950 text-rose-300 border-rose-800',
  VAHAN_LOOKUP_SUCCESS: 'bg-blue-950 text-blue-300 border-blue-800',
  VAHAN_LOOKUP_NOT_FOUND: 'bg-amber-950 text-amber-300 border-amber-800',
  CHALLAN_GENERATED: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  OFFICER_APPROVED: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  OFFICER_REJECTED: 'bg-rose-950 text-rose-300 border-rose-800',
  DUPLICATE_SUPPRESSED: 'bg-slate-800 text-slate-400 border-slate-700',
};

export default function AdminDashboard() {
  const { currentUser, isOfficer, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [pendingQueue, setPendingQueue] = useState(buildInitialPendingQueue);
  const [challans, setChallans] = useState(buildInitialChallans);
  const [reports, setReports] = useState(SEED_REPORTS.map(r => ({ ...r, status: r.status })));
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsChallan, setSmsChallan] = useState(null);
  const [approvalLoading, setApprovalLoading] = useState({});
  const [rejectModalOpen, setRejectModalOpen] = useState(null); // violation id or null
  const [rejectReason, setRejectReason] = useState('FALSE_POSITIVE');
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const [auditFilter, setAuditFilter] = useState('ALL');

  // Analytics
  const analytics = useMemo(() => {
    const today = new Date().toDateString();
    const todayViolations = challans.filter(c => {
      const d = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt || 0);
      return d.toDateString() === today;
    }).length;

    const totalFines = challans.reduce((sum, c) => sum + (c.fineAmount || 0), 0);
    const pendingReports = reports.filter(r => r.status === 'REPORTED').length;

    const names = challans.map(c => c.offenderName).filter(Boolean);
    const nameCounts = names.reduce((acc, n) => { acc[n] = (acc[n] || 0) + 1; return acc; }, {});
    const repeatOffenders = Object.values(nameCounts).filter(c => c > 1).length;

    return { todayViolations, totalFines, pendingReports, repeatOffenders };
  }, [challans, reports]);

  // Approve: same challan + SMS flow as vehicle path, reusing generateChallan
  const handleApprove = async (violation) => {
    setApprovalLoading(prev => ({ ...prev, [violation.id]: 'approving' }));
    await new Promise(r => setTimeout(r, 800));

    // Look up violation history for this offender (for repeat-offender escalation)
    const historyId = violation.vehicleNumber || violation.offenderName || '';
    const violationHistory = getViolationHistory(historyId);

    const newChallan = generateChallan({
      detectionResult: {
        event_type: violation.vehicleNumber ? 'vehicle' : 'pedestrian',
        gps: violation.gps || { lat: 0, lng: 0 },
        location_address: violation.locationAddress,
        timestamp: violation.createdAt?.toDate?.() || new Date(),
        cropped_image_url: violation.evidencePhotoUrl,
        confidence: violation.confidence || 0.88,
        camera_id: violation.cameraId || 'CAM-REVIEW',
        plate_text: violation.vehicleNumber || null,
      },
      vahanData: violation.vehicleNumber ? { ownerName: violation.offenderName } : null,
      violationHistory,
    });

    logAuditEvent({
      action: AUDIT_ACTIONS.OFFICER_APPROVED,
      details: `Officer approved violation ${violation.id}. Challan ${newChallan.id} generated for ₹${newChallan.fineAmount} (offence #${newChallan.offenceCount}).`,
      actorId: currentUser?.email || 'demo-officer',
      relatedIds: { violationId: violation.id, challanId: newChallan.id },
    });
    logAuditEvent({
      action: AUDIT_ACTIONS.CHALLAN_GENERATED,
      details: `Challan ${newChallan.id}: ₹${newChallan.fineAmount} for ${newChallan.offenderName}`,
      relatedIds: { challanId: newChallan.id },
    });

    setChallans(prev => [newChallan, ...prev]);
    setPendingQueue(prev => prev.filter(v => v.id !== violation.id));
    setApprovalLoading(prev => ({ ...prev, [violation.id]: 'approved' }));
    setSmsChallan(newChallan);
    setSmsOpen(true);
    setAuditRefreshKey(k => k + 1);

    // If violation is from Firestore, update its status
    try {
      const violRef = doc(db, COLLECTIONS.VIOLATIONS, violation.id);
      await updateDoc(violRef, { status: 'RESOLVED', challanId: newChallan.id, updatedAt: new Date() });
    } catch (err) {
      // Ignored for local/seed violations
    }
  };

  // Reject with reason logging
  const handleReject = async (violationId) => {
    const violation = pendingQueue.find(v => v.id === violationId);
    const reasonLabel = REJECTION_REASONS.find(r => r.value === rejectReason)?.label || rejectReason;

    logAuditEvent({
      action: AUDIT_ACTIONS.OFFICER_REJECTED,
      details: `Officer rejected violation ${violationId}. Reason: ${reasonLabel}`,
      actorId: currentUser?.email || 'demo-officer',
      relatedIds: { violationId },
    });

    setPendingQueue(prev => prev.filter(v => v.id !== violationId));
    setRejectModalOpen(null);
    setRejectReason('FALSE_POSITIVE');
    setAuditRefreshKey(k => k + 1);

    // If violation is from Firestore, update its status
    try {
      const violRef = doc(db, COLLECTIONS.VIOLATIONS, violationId);
      await updateDoc(violRef, { status: 'DISMISSED', rejectionReason: reasonLabel, updatedAt: new Date() });
    } catch (err) {
      // Ignored for local/seed violations
    }
  };

  // Fetch live reports and live pending violations from Firestore with fallback to seed data
  useEffect(() => {
    async function loadData() {
      try {
        const snap = await getDocs(collection(db, COLLECTIONS.REPORTS));
        if (!snap.empty) {
          const liveReports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          const liveIds = new Set(liveReports.map(r => r.id));
          const nonDupeSeeds = SEED_REPORTS.filter(r => !liveIds.has(r.id));
          setReports([...liveReports, ...nonDupeSeeds]);
        }
      } catch (err) {
        console.info('[AdminDashboard] Using seed reports (Firestore offline or demo mode):', err.message);
      }

      try {
        const violSnap = await getDocs(collection(db, COLLECTIONS.VIOLATIONS));
        if (!violSnap.empty) {
          const liveViolations = violSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(v => v.status === 'PENDING_OFFICER_REVIEW');
          
          if (liveViolations.length > 0) {
            setPendingQueue(prev => {
              const liveIds = new Set(liveViolations.map(v => v.id));
              const filteredPrev = prev.filter(v => !liveIds.has(v.id));
              return [...liveViolations, ...filteredPrev];
            });
          }
        }
      } catch (err) {
        console.info('[AdminDashboard] Using seed pending queue (Firestore offline or demo mode):', err.message);
      }
    }
    loadData();
  }, []);

  const handleReportStatus = async (reportId, newStatus) => {
    // Optimistic UI update
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: newStatus } : r));

    // Persist status change to Firestore if possible
    try {
      const reportRef = doc(db, COLLECTIONS.REPORTS, reportId);
      await updateDoc(reportRef, { status: newStatus, updatedAt: new Date() });
    } catch (err) {
      console.warn('[AdminDashboard] Could not update report status in Firestore:', err.message);
    }
  };

  const formatDate = (val) => {
    if (!val) return '—';
    const d = val?.toDate ? val.toDate() : new Date(val);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTime = (val) => {
    if (!val) return '—';
    const d = new Date(val);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const STAT_CARDS = [
    {
      label: 'Total Violations Today',
      value: analytics.todayViolations,
      sub: 'AI-detected + approved',
      icon: Activity,
      color: 'text-rose-400',
      bg: 'bg-rose-950/30 border-rose-800/50',
    },
    {
      label: 'Total Fines Issued',
      value: `₹${analytics.totalFines.toLocaleString('en-IN')}`,
      sub: `across ${challans.length} challans`,
      icon: Receipt,
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/30 border-emerald-800/50',
    },
    {
      label: 'Citizen Reports Pending',
      value: analytics.pendingReports,
      sub: 'awaiting acknowledgement',
      icon: Users,
      color: 'text-amber-400',
      bg: 'bg-amber-950/30 border-amber-800/50',
    },
    {
      label: 'Repeat Offenders',
      value: analytics.repeatOffenders,
      sub: 'flagged for escalation',
      icon: AlertTriangle,
      color: 'text-purple-400',
      bg: 'bg-purple-950/30 border-purple-800/50',
    },
  ];

  // Audit log data (re-fetched when auditRefreshKey changes)
  const auditLogData = useMemo(() => {
    // eslint-disable-next-line no-unused-vars
    const _key = auditRefreshKey; // dependency trigger
    const filter = auditFilter === 'ALL' ? null : { action: auditFilter };
    return getAuditLog(filter);
  }, [auditRefreshKey, auditFilter]);

  const auditStats = useMemo(() => {
    const _key = auditRefreshKey;
    return getAuditStats();
  }, [auditRefreshKey]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PrototypeBanner />

      <div className="flex-1 flex overflow-hidden">

        {/* ── Left Sidebar ─────────────────────────────────────────────── */}
        <aside className="w-60 bg-slate-900 border-r border-slate-800 shrink-0 hidden md:flex flex-col">
          <div className="p-4 border-b border-slate-800 flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-blue-400" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-200">Enforcement HQ</div>
              <div className="text-[10px] text-slate-400 font-mono">Officer Dashboard</div>
            </div>
          </div>

          <nav className="p-3 space-y-0.5 flex-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isBadge = tab.badge && pendingQueue.length > 0;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-900/60 text-blue-300 border border-blue-700/60'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </div>
                  {isBadge && (
                    <span className="bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {pendingQueue.length}
                    </span>
                  )}
                </button>
              );
            })}

            <div className="pt-3 border-t border-slate-800/60 mt-3 space-y-0.5">
              <Link
                to="/admin/detection"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold text-blue-400 hover:text-blue-300 hover:bg-blue-950/30 border border-transparent hover:border-blue-900/50 transition-colors"
              >
                <Video className="w-4 h-4" />
                <span>CCTV Detection</span>
              </Link>
              <Link
                to="/admin/mock-services"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold text-amber-400 hover:text-amber-300 hover:bg-amber-950/30 border border-transparent hover:border-amber-900/50 transition-colors"
              >
                <FlaskConical className="w-4 h-4" />
                <span>Mock Services</span>
              </Link>
            </div>
          </nav>

          <div className="p-4 border-t border-slate-800 text-xs">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-slate-300">Authenticated Officer</span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono truncate">
              {currentUser?.email || 'Demo Officer Session'}
            </p>
            <button onClick={logout} className="mt-2 text-[10px] text-rose-400 hover:text-rose-300 font-semibold transition-colors">
              Sign Out
            </button>
          </div>
        </aside>

        {/* ── Main Content ──────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-5 lg:p-8">

          {/* Mobile tab bar */}
          <div className="md:hidden flex gap-1.5 mb-4 overflow-x-auto pb-2 scrollbar-none">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-900/80 text-blue-200 border-blue-600 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}>
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* ── TAB 1: OVERVIEW ───────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold text-white">Municipal Officer Dashboard</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Command centre for reviewing civic violations, managing challans, and monitoring hotspots.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {STAT_CARDS.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <div key={i} className={`p-4 rounded-xl border ${s.bg} flex items-start justify-between`}>
                      <div>
                        <p className="text-xs font-medium text-slate-400">{s.label}</p>
                        <h3 className={`text-2xl font-bold mt-1 font-mono ${s.color}`}>{s.value}</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">{s.sub}</p>
                      </div>
                      <div className={`p-2 rounded-lg bg-slate-900/80 ${s.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button onClick={() => setActiveTab('pending')} className="bg-slate-900 border border-slate-800 hover:border-blue-700 rounded-xl p-4 text-left transition-colors group">
                  <Clock className="w-5 h-5 text-amber-400 mb-2" />
                  <div className="text-sm font-bold text-slate-200 group-hover:text-blue-300 transition-colors">
                    Review Queue
                    {pendingQueue.length > 0 && <span className="ml-2 bg-rose-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingQueue.length}</span>}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Pedestrian violations awaiting review</p>
                </button>
                <Link to="/admin/detection" className="bg-slate-900 border border-slate-800 hover:border-blue-700 rounded-xl p-4 text-left transition-colors group block">
                  <Video className="w-5 h-5 text-blue-400 mb-2" />
                  <div className="text-sm font-bold text-slate-200 group-hover:text-blue-300 transition-colors">CCTV Detection</div>
                  <p className="text-[11px] text-slate-500 mt-1">Run AI detection on demo clips</p>
                </Link>
                <button onClick={() => setActiveTab('auditlog')} className="bg-slate-900 border border-slate-800 hover:border-blue-700 rounded-xl p-4 text-left transition-colors group">
                  <ScrollText className="w-5 h-5 text-purple-400 mb-2" />
                  <div className="text-sm font-bold text-slate-200 group-hover:text-blue-300 transition-colors">Audit Log</div>
                  <p className="text-[11px] text-slate-500 mt-1">System decision accountability trail</p>
                </button>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-slate-200">Recent Challans</h2>
                  <button onClick={() => setActiveTab('challans')} className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1">
                    View All <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-2">
                  {challans.slice(0, 4).map((c, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-950/60 border border-slate-800 rounded-lg px-4 py-2.5 text-xs">
                      <div>
                        <span className="font-semibold text-slate-200">{c.offenderName}</span>
                        <span className="text-slate-500 ml-2 font-mono">{c.vehicleNumber || c.caseId || '—'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold font-mono text-rose-400">₹{c.fineAmount}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-mono font-semibold uppercase ${
                          c.status === 'PAID' ? 'bg-emerald-950 text-emerald-300 border-emerald-800' :
                          c.status === 'APPEALED' ? 'bg-purple-950 text-purple-300 border-purple-800' :
                          'bg-blue-950 text-blue-300 border-blue-800'
                        }`}>{c.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: PENDING REVIEW ──────────────────────────────────── */}
          {activeTab === 'pending' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-3">
                  Pedestrian Violation Review Queue
                  {pendingQueue.length > 0 && (
                    <span className="bg-rose-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">{pendingQueue.length}</span>
                  )}
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Review AI-detected pedestrian violations. Approve to generate challan. Reject with reason for model-improvement analysis.
                </p>
              </div>

              <div className="bg-amber-950/20 border border-amber-800/50 rounded-xl p-3 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">
                  <span className="font-bold">DPDP Act 2023 Compliance:</span> Pedestrian violations require manual officer review before any fine is issued.
                  No automatic biometric-to-identity matching has been performed. Rejection reasons are logged for model improvement analysis.
                </p>
              </div>

              {pendingQueue.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-300">All Clear — No Pending Reviews</p>
                  <p className="text-xs text-slate-500 mt-1">Run the CCTV Detection module to generate new pedestrian violation cards.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingQueue.map(viol => (
                    <div key={viol.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                      <div className="flex items-start gap-4">
                        <img
                          src={viol.evidencePhotoUrl}
                          alt="Evidence [SIMULATED]"
                          className="w-36 h-24 rounded-lg object-cover border border-slate-700 shrink-0"
                        />
                        <div className="flex-1 min-w-0 space-y-1.5 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded">PENDING REVIEW</span>
                            <span className="text-[10px] text-slate-500 font-mono">ID: {viol.id}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-300">
                            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>{viol.locationAddress}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-400">
                            <Activity className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>Confidence: {viol.confidence ? `${Math.round(viol.confidence * 100)}%` : 'N/A'} · {viol.subType || viol.type}</span>
                          </div>
                          <div className="text-slate-400">
                            {formatDate(viol.createdAt)}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-2 border-t border-slate-800">
                        <button
                          onClick={() => handleApprove(viol)}
                          disabled={approvalLoading[viol.id] === 'approving'}
                          className="flex-1 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {approvalLoading[viol.id] === 'approving' ? 'Processing…' : 'Approve & Issue Challan'}
                        </button>
                        <button
                          onClick={() => { setRejectModalOpen(viol.id); setRejectReason('FALSE_POSITIVE'); }}
                          className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors border border-slate-700"
                        >
                          <XCircle className="w-4 h-4 text-rose-400" />
                          Reject with Reason
                        </button>
                      </div>

                      {/* Inline rejection reason picker */}
                      {rejectModalOpen === viol.id && (
                        <div className="bg-rose-950/20 border border-rose-800/50 rounded-lg p-4 space-y-3">
                          <div className="text-xs font-bold text-rose-300 flex items-center gap-2">
                            <XCircle className="w-4 h-4" />
                            Select Rejection Reason
                          </div>
                          <div className="space-y-1.5">
                            {REJECTION_REASONS.map(r => (
                              <label key={r.value} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-xs transition-colors border ${
                                rejectReason === r.value
                                  ? 'bg-rose-950/40 border-rose-700 text-rose-200'
                                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                              }`}>
                                <input type="radio" name={`reject-${viol.id}`} value={r.value}
                                  checked={rejectReason === r.value}
                                  onChange={() => setRejectReason(r.value)}
                                  className="accent-rose-500" />
                                {r.label}
                              </label>
                            ))}
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => handleReject(viol.id)}
                              className="flex-1 bg-rose-800 hover:bg-rose-700 text-white text-xs font-bold py-2 rounded-lg transition-colors"
                            >
                              Confirm Rejection
                            </button>
                            <button
                              onClick={() => setRejectModalOpen(null)}
                              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2 rounded-lg transition-colors border border-slate-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 3: CHALLAN REGISTER ───────────────────────────────── */}
          {activeTab === 'challans' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold text-white">Challan Register</h1>
                <p className="text-xs text-slate-400 mt-0.5">All issued enforcement challans — vehicle and pedestrian. Click SMS to preview the message payload.</p>
              </div>
              <ChallanTable challans={challans} title="All Issued Challans" />
              <LegalBasisPanel collapsed={true} />
            </div>
          )}

          {/* ── TAB 4: HOTSPOT HEATMAP ────────────────────────────────── */}
          {activeTab === 'heatmap' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold text-white">Unified Hotspot Heatmap</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  AI-detected CCTV violations (🔴) and citizen-submitted reports (🟡) on a single enforcement map.
                </p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <HotspotMap />
              </div>
            </div>
          )}

          {/* ── TAB 5: CITIZEN REPORTS ────────────────────────────────── */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold text-white">Citizen Reports Management</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Incoming citizen-submitted reports of overflowing bins, illegal dumping, and littering events.
                </p>
              </div>

              <div className="flex gap-4 text-xs font-semibold flex-wrap">
                {[
                  { label: 'Reported', count: reports.filter(r => r.status === 'REPORTED').length, color: 'text-slate-300' },
                  { label: 'Acknowledged', count: reports.filter(r => r.status === 'ACKNOWLEDGED').length, color: 'text-amber-400' },
                  { label: 'Resolved', count: reports.filter(r => r.status === 'RESOLVED').length, color: 'text-emerald-400' },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
                    <span className={s.color}>{s.count}</span>
                    <span className="text-slate-500">{s.label}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {reports.map(report => (
                  <div key={report.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-4">
                      <img
                        src={report.imageUrl}
                        alt="Report photo [SIMULATED]"
                        className="w-24 h-16 rounded-lg object-cover border border-slate-700 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 flex-wrap mb-1">
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${STATUS_REPORT_STYLES[report.status] || STATUS_REPORT_STYLES.REPORTED}`}>
                            {report.status}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                            report.priority === 'HIGH' ? 'bg-rose-950 text-rose-300 border-rose-800' :
                            report.priority === 'MEDIUM' ? 'bg-amber-950 text-amber-300 border-amber-800' :
                            'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {report.priority} Priority
                          </span>
                        </div>
                        <h3 className="text-xs font-bold text-slate-200 leading-tight">{report.title}</h3>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{report.location?.address}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">{report.description}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-slate-800 flex-wrap">
                      {report.status === 'REPORTED' && (
                        <button
                          onClick={() => handleReportStatus(report.id, 'ACKNOWLEDGED')}
                          className="text-[11px] font-bold bg-amber-900/60 hover:bg-amber-900 text-amber-300 border border-amber-800 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Mark Acknowledged
                        </button>
                      )}
                      {report.status === 'ACKNOWLEDGED' && (
                        <button
                          onClick={() => handleReportStatus(report.id, 'RESOLVED')}
                          className="text-[11px] font-bold bg-emerald-900/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mark Resolved
                        </button>
                      )}
                      {report.status === 'RESOLVED' && (
                        <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5 px-2">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                        </span>
                      )}
                      <button className="text-[11px] font-bold bg-blue-950/60 hover:bg-blue-950 text-blue-300 border border-blue-900 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        Escalate to Hotspot
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB 6: AUDIT LOG ──────────────────────────────────────── */}
          {activeTab === 'auditlog' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-3">
                  <ScrollText className="w-6 h-6 text-purple-400" />
                  System Audit Log
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Every automated decision recorded for accountability and explainability. This trail supports system governance audits and model improvement analysis.
                </p>
              </div>

              {/* Stats bar */}
              <div className="flex gap-3 flex-wrap">
                <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-xs">
                  <span className="text-slate-500">Total Events:</span>
                  <span className="font-bold text-slate-200 ml-1.5 font-mono">{auditStats.total}</span>
                </div>
                {Object.entries(auditStats.byAction || {}).map(([action, count]) => (
                  <div key={action} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-[10px] flex items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded border font-mono font-semibold ${AUDIT_ACTION_STYLES[action] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                      {count}
                    </span>
                    <span className="text-slate-500 truncate max-w-[120px]">{action.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>

              {/* Filter bar */}
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-4 h-4 text-slate-500" />
                <select
                  value={auditFilter}
                  onChange={(e) => setAuditFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg text-xs px-3 py-1.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="ALL">All Actions</option>
                  {Object.values(AUDIT_ACTIONS).map(a => (
                    <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
                  ))}
                </select>
                <button
                  onClick={() => setAuditRefreshKey(k => k + 1)}
                  className="text-xs text-slate-400 hover:text-slate-200 bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>

              {/* Log entries */}
              {auditLogData.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center">
                  <ScrollText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-400">No Audit Events Recorded Yet</p>
                  <p className="text-xs text-slate-500 mt-1">Run the CCTV Detection module to generate audit trail entries.</p>
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
                          <th className="text-left px-4 py-2.5">Time</th>
                          <th className="text-left px-4 py-2.5">Action</th>
                          <th className="text-left px-4 py-2.5">Details</th>
                          <th className="text-left px-4 py-2.5">Actor</th>
                          <th className="text-left px-4 py-2.5">ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {auditLogData.map(entry => (
                          <tr key={entry.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-4 py-2.5 font-mono text-slate-400 text-[10px] whitespace-nowrap">
                              {formatTime(entry.timestamp)}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex px-2 py-0.5 rounded border text-[9px] font-mono font-bold uppercase ${AUDIT_ACTION_STYLES[entry.action] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                {entry.action.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-300 max-w-[300px] truncate" title={entry.details}>
                              {entry.details}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 font-mono text-[10px]">
                              {entry.actorId}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-slate-600 text-[9px]">
                              {entry.id}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* SMS Preview Modal */}
      <SMSPreviewModal
        isOpen={smsOpen}
        onClose={() => setSmsOpen(false)}
        challan={smsChallan}
      />
    </div>
  );
}
