import React, { useState } from 'react';
import { Search, CheckCircle2, XCircle, Loader2, Car, User, Phone, MapPin, Receipt, MessageSquare, Database, AlertTriangle } from 'lucide-react';
import { vahanLookup, formatVahanSummary } from '../services/vahanLookup';
import { SEED_VIOLATIONS } from '../data/seedData';
import SMSPreviewModal from '../components/SMSPreviewModal';
import PrototypeBanner from '../components/PrototypeBanner';

/**
 * Mock Services Demo Page — /admin/mock-services
 * ====================================================
 * SIMULATED / PROTOTYPE PAGE
 * Demonstrates:
 *   1. Mock VAHAN plate lookup (Firestore + local seed fallback)
 *   2. SMS Preview Modal for violation challans
 *   3. Seeded violation records browse
 * ====================================================
 */
export default function MockServicesDemo() {
  // VAHAN Lookup state
  const [plateInput, setPlateInput] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState(null);

  // SMS Preview state
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [selectedChallan, setSelectedChallan] = useState(null);

  const handleVahanLookup = async (e) => {
    e.preventDefault();
    if (!plateInput.trim()) return;
    setLookupLoading(true);
    setLookupResult(null);
    setLookupError(null);

    const result = await vahanLookup(plateInput.trim());
    setLookupLoading(false);

    if (result.found) {
      setLookupResult(result);
    } else {
      setLookupError(`No registered vehicle found for plate "${plateInput.toUpperCase()}"`);
    }
  };

  const handlePreviewSMS = (violation) => {
    setSelectedChallan({
      ...violation,
      id: violation.id,
      offenderName: violation.offenderName,
      vehicleNumber: violation.vehicleNumber,
      fineAmount: violation.fineAmount,
      gps: violation.gps,
      locationAddress: violation.locationAddress,
      timestamp: violation.createdAt,
      offenceType: violation.subType || violation.type,
      evidencePhotoUrl: violation.evidencePhotoUrl,
      issuedByOfficer: violation.officerName,
    });
    setSmsModalOpen(true);
  };

  const statusBadge = (status) => {
    const styles = {
      PENDING_PAYMENT: 'bg-amber-950 text-amber-300 border-amber-800',
      RESOLVED: 'bg-emerald-950 text-emerald-300 border-emerald-800',
      PAID: 'bg-blue-950 text-blue-300 border-blue-800',
      APPEALED: 'bg-purple-950 text-purple-300 border-purple-800',
    };
    return `inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-mono font-semibold uppercase ${styles[status] || 'bg-slate-800 text-slate-300 border-slate-700'}`;
  };

  const violationTypeBadge = (type) => {
    return type === 'VEHICLE_LITTERING'
      ? 'bg-rose-950 border-rose-800 text-rose-300'
      : 'bg-slate-800 border-slate-700 text-slate-300';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <PrototypeBanner />

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">

        {/* Page Header */}
        <div className="border-b border-slate-800 pb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span>Mock Services Demo</span>
            <span className="text-xs bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded font-mono font-normal">
              SIMULATED DATA
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Interactive demos for VAHAN plate lookup, SMS challan preview, and seeded violation records.
          </p>
        </div>

        {/* ── SECTION 1: VAHAN LOOKUP ─────────────────────────────────────── */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-950 text-blue-400 rounded-lg border border-blue-800">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Mock VAHAN Vehicle Lookup</h2>
              <p className="text-xs text-slate-400">Query registered owner details from seeded Firestore / local data. Enter a plate from the seeded records to see a match.</p>
            </div>
          </div>

          <form onSubmit={handleVahanLookup} className="flex gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={plateInput}
                onChange={(e) => setPlateInput(e.target.value)}
                placeholder="e.g. MH12AB1234 or KA03MN2211"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
              />
              <Car className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            </div>
            <button
              type="submit"
              disabled={lookupLoading}
              className="bg-blue-700 hover:bg-blue-600 text-white font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm transition-colors disabled:opacity-50"
            >
              {lookupLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>{lookupLoading ? 'Querying...' : 'Look Up'}</span>
            </button>
          </form>

          {/* Quick plate shortcuts */}
          <div className="flex flex-wrap gap-2">
            <span className="text-[11px] text-slate-500 self-center">Quick test:</span>
            {['MH12AB1234', 'KA03MN2211', 'TN22BX4321', 'WB02KL8877', 'ZZZZ99XX0000'].map(plate => (
              <button
                key={plate}
                onClick={() => setPlateInput(plate)}
                className="text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded border border-slate-700 transition-colors"
              >
                {plate}
              </button>
            ))}
          </div>

          {/* Lookup Result */}
          {lookupError && (
            <div className="bg-rose-950/50 border border-rose-800 rounded-lg p-4 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-rose-300">Vehicle Not Found</div>
                <div className="text-xs text-rose-400 mt-0.5">{lookupError}</div>
                <div className="text-[11px] text-slate-500 mt-1 font-mono">Source: LOCAL_SEED_[SIMULATED]</div>
              </div>
            </div>
          )}

          {lookupResult && lookupResult.data && (
            <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Vehicle Found</span>
                </div>
                <span className="text-[10px] font-mono bg-slate-900 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
                  src: {lookupResult.source}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  { icon: User, label: 'Owner Name', value: lookupResult.data.ownerName },
                  { icon: Phone, label: 'Phone', value: lookupResult.data.ownerPhone },
                  { icon: Car, label: 'Vehicle', value: `${lookupResult.data.vehicleMake} (${lookupResult.data.vehicleNumber})` },
                  { icon: MapPin, label: 'Address', value: lookupResult.data.address },
                  { icon: Receipt, label: 'RTO', value: lookupResult.data.registeredRTO },
                  { icon: AlertTriangle, label: 'Status', value: lookupResult.data.status },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-2">
                    <Icon className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</div>
                      <div className={`text-slate-200 font-medium ${lookupResult.data.status === 'SUSPENDED' && label === 'Status' ? 'text-rose-400' : ''}`}>
                        {value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {lookupResult.data.status === 'SUSPENDED' && (
                <div className="bg-rose-950/60 border border-rose-800 rounded p-2 text-xs text-rose-300 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  SUSPENDED REGISTRATION — Do not issue clearance. Escalate to RTO.
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── SECTION 2: SMS PREVIEW (from violations) ───────────────────── */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-950 text-emerald-400 rounded-lg border border-emerald-800">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Mock SMS Challan Preview</h2>
              <p className="text-xs text-slate-400">Click any violation below to preview the exact SMS message that would be dispatched to the offender. No real SMS sent.</p>
            </div>
          </div>

          <div className="space-y-2">
            {SEED_VIOLATIONS.map((viol) => (
              <div
                key={viol.id}
                className="flex items-center justify-between bg-slate-950/80 border border-slate-800 rounded-lg p-3 gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${violationTypeBadge(viol.type)}`}>
                      {viol.type === 'VEHICLE_LITTERING' ? '🚗 Vehicle' : '🚶 Pedestrian'}
                    </span>
                    <span className={statusBadge(viol.status)}>{viol.status.replace(/_/g, ' ')}</span>
                    {viol.vehicleNumber && (
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        {viol.vehicleNumber}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-slate-200 truncate">{viol.offenderName}</p>
                  <p className="text-[11px] text-slate-500 truncate">{viol.locationAddress}</p>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-rose-400 font-mono">₹{viol.fineAmount}</div>
                  <button
                    onClick={() => handlePreviewSMS(viol)}
                    className="mt-1 flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 bg-blue-950/50 hover:bg-blue-950 border border-blue-900 px-2 py-1 rounded transition-colors font-semibold"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>Preview SMS</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 3: Seed Data Summary ───────────────────────────────── */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-slate-800 text-slate-400 rounded-lg border border-slate-700">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Seed Data Summary</h2>
              <p className="text-xs text-slate-400">Import <code className="text-blue-400 bg-slate-800 px-1 py-0.5 rounded">seedFirestore()</code> from <code className="text-blue-400 bg-slate-800 px-1 py-0.5 rounded">services/seedFirestore.js</code> to populate live Firestore.</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'vahan_records', count: 15, color: 'text-blue-400' },
              { label: 'violations', count: 10, color: 'text-rose-400' },
              { label: 'reports', count: 8, color: 'text-amber-400' },
            ].map(item => (
              <div key={item.label} className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 text-center">
                <div className={`text-3xl font-bold font-mono ${item.color}`}>{item.count}</div>
                <div className="text-[11px] text-slate-400 font-mono mt-1">{item.label}</div>
                <div className="text-[10px] text-slate-600 mt-0.5 uppercase tracking-wider">simulated records</div>
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* SMS Preview Modal */}
      <SMSPreviewModal
        isOpen={smsModalOpen}
        onClose={() => setSmsModalOpen(false)}
        challan={selectedChallan}
      />
    </div>
  );
}
