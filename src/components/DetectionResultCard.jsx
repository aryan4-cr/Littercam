import React from 'react';
import { AlertTriangle, Car, User, Shield, CheckCircle2, Clock, MapPin, Receipt, Zap, Info, Eye, XCircle, Search } from 'lucide-react';

/**
 * LitterCam — Detection Result Card
 * ====================================================
 * SIMULATED DETECTION OUTPUT — PROTOTYPE ONLY
 * Displays the parsed result from the mock AI detection pipeline,
 * with confidence-tier routing, OCR failure handling, and
 * plate-not-found display.
 * ====================================================
 *
 * @param {object} props
 * @param {object} props.result - Detection result from runMockDetection()
 * @param {object} props.vahanData - VAHAN lookup result (for vehicle type), or null
 * @param {boolean} props.vahanNotFound - True if VAHAN was searched but no match
 * @param {object} props.challan - Generated challan (if vehicle type, high confidence, plate+owner found)
 * @param {'idle'|'processing'|'done'|'discarded'} props.status
 * @param {string} props.confidenceTier - 'AUTO' | 'NEEDS_REVIEW' | 'DISCARD'
 * @param {boolean} props.ocrFailed - True if vehicle detected but plate OCR failed
 * @param {boolean} props.isDuplicate - True if event was suppressed as duplicate
 * @param {function} props.onPreviewSMS - Callback to open SMS preview modal
 * @param {function} props.onDismiss - Callback to reset/dismiss result
 */
export default function DetectionResultCard({
  result, vahanData, vahanNotFound, challan, status,
  confidenceTier, ocrFailed, isDuplicate, detectionSource,
  onPreviewSMS, onDismiss
}) {
  if (status === 'idle') return null;

  if (status === 'processing') {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 text-center">
        <div className="relative inline-flex mb-4">
          <div className="w-14 h-14 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-2 w-10 h-10 border-4 border-slate-700 border-b-emerald-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
        </div>
        <p className="text-sm font-bold text-slate-200 mb-1">Running AI Detection Pipeline</p>
        <p className="text-xs text-slate-400">YOLOv8 inference → ANPR extraction → VAHAN lookup</p>
        <p className="text-[11px] text-slate-500 mt-2 font-mono">[SIMULATED — PROTOTYPE ONLY]</p>
      </div>
    );
  }

  // ── Discarded as low confidence ──────────────────────────────────────────
  if (status === 'discarded' || confidenceTier === 'DISCARD') {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 space-y-3">
        <div className="flex items-start gap-3">
          <XCircle className="w-6 h-6 text-slate-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-slate-400">Detection Discarded — Low Confidence</h3>
            <p className="text-xs text-slate-500 mt-1">
              Confidence <span className="font-mono text-rose-400">{result ? Math.round(result.confidence * 100) : '?'}%</span> is below
              the actionable threshold (35%). This event has been logged for audit purposes only and will NOT be surfaced as a violation.
            </p>
            <p className="text-[11px] text-slate-600 mt-2 font-mono">
              Logged to audit_log as DETECTION_DISCARDED_LOW_CONFIDENCE
            </p>
          </div>
        </div>
        <div className="pt-2 border-t border-slate-800 flex justify-end">
          <button onClick={onDismiss} className="text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors">
            Clear & Run New Detection
          </button>
        </div>
      </div>
    );
  }

  // ── Duplicate suppressed ─────────────────────────────────────────────────
  if (isDuplicate) {
    return (
      <div className="bg-slate-900 border border-amber-800/50 rounded-xl p-6 space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-amber-300">Duplicate Event Suppressed</h3>
            <p className="text-xs text-slate-400 mt-1">
              This detection matches a recent event from the same camera within a 30-second window with overlapping bounding box.
              Suppressed to prevent duplicate challans for the same physical incident.
            </p>
            <p className="text-[11px] text-slate-600 mt-2 font-mono">
              Logged to audit_log as DUPLICATE_SUPPRESSED
            </p>
          </div>
        </div>
        <div className="pt-2 border-t border-slate-800 flex justify-end">
          <button onClick={onDismiss} className="text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors">
            Clear & Run New Detection
          </button>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const isVehicle = result.event_type === 'vehicle';
  const confidencePct = Math.round(result.confidence * 100);
  const isNeedsReview = confidenceTier === 'NEEDS_REVIEW';

  // Confidence tier badge
  const tierBadge = () => {
    if (confidenceTier === 'AUTO') return (
      <span className="text-[10px] font-mono font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded">
        AUTO-APPROVED ≥85%
      </span>
    );
    if (confidenceTier === 'NEEDS_REVIEW') return (
      <span className="text-[10px] font-mono font-semibold bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded flex items-center gap-1">
      <Eye className="w-3 h-3" /> NEEDS REVIEW 35-85%
      </span>
    );
    return (
      <span className="text-[10px] font-mono font-semibold bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded">
        {confidencePct}% confidence
      </span>
    );
  };

  return (
    <div className={`border rounded-xl overflow-hidden shadow-lg ${
      isNeedsReview ? 'border-amber-700/70 bg-slate-900 ring-1 ring-amber-800/30' :
      isVehicle ? 'border-rose-800/70 bg-slate-900' : 'border-amber-800/70 bg-slate-900'
    }`}>
      {/* Needs-Review Banner */}
      {isNeedsReview && (
        <div className="bg-amber-950/50 border-b border-amber-800/50 px-5 py-2 flex items-center gap-2">
          <Eye className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-amber-300">
            OFFICER REVIEW REQUIRED — Medium confidence detection ({confidencePct}%)
          </span>
        </div>
      )}

      {/* Result Header */}
      <div className={`px-5 py-3 flex items-center justify-between ${
        isVehicle ? 'bg-rose-950/40' : 'bg-amber-950/40'
      }`}>
        <div className="flex items-center gap-3">
          {isVehicle ? (
            <Car className="w-5 h-5 text-rose-400" />
          ) : (
            <User className="w-5 h-5 text-amber-400" />
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-bold ${isVehicle ? 'text-rose-300' : 'text-amber-300'}`}>
                {isVehicle ? 'Vehicle Littering Detected' : 'Pedestrian Violation Detected'}
              </span>
              {tierBadge()}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
              {result.model_version} · Cam: {result.camera_id}
            </p>
          </div>
        </div>
        {detectionSource === 'LIVE_BACKEND' ? (
          <span className="text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-semibold">
            LIVE AI
          </span>
        ) : (
          <span className="text-[10px] font-mono bg-slate-950 text-slate-500 border border-slate-800 px-2 py-0.5 rounded">
            SIMULATED
          </span>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Evidence Photo + Metadata */}
        <div className="flex gap-4">
          <div className="shrink-0">
            <img
              src={result.cropped_image_url}
              alt="Detection crop [SIMULATED]"
              className="w-32 h-24 object-cover rounded-lg border border-slate-700"
            />
            <p className="text-[10px] text-slate-500 text-center mt-1 font-mono">Frame #{result.frame_number}</p>
          </div>
          <div className="flex-1 min-w-0 space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wide">Location</div>
                <div className="text-slate-200">{result.location_address}</div>
                <div className="text-slate-400 font-mono text-[10px]">
                  {result.gps?.lat?.toFixed(5)}, {result.gps?.lng?.toFixed(5)}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wide">Timestamp</div>
                <div className="text-slate-200">
                  {new Date(result.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── VEHICLE BRANCH ─────────────────────────────────────────────── */}
        {isVehicle && (
          <div className="space-y-4">
            {/* OCR Failed */}
            {ocrFailed && (
              <div className="bg-rose-950/30 border border-rose-800/60 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-bold text-rose-300 mb-1">ANPR Failed — Plate Unreadable</div>
                    <p className="text-xs text-rose-200/80 leading-relaxed">
                      The OCR engine could not extract a readable plate number from the detected vehicle
                      (confidence: {result.plate_confidence ? `${Math.round(result.plate_confidence * 100)}%` : 'N/A'}).
                      This event has been routed to the Officer Review Queue for manual plate identification.
                    </p>
                    <p className="text-[11px] text-amber-400/70 mt-2 font-mono">
                      Status: UNREADABLE_PLATE — Manual Review Required
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ANPR Result (only if OCR succeeded) */}
            {!ocrFailed && result.plate_text && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">ANPR Extraction Result</span>
                  <span className="text-[10px] font-mono text-slate-500 ml-auto">{result.ocr_engine}</span>
                </div>
                <div className="flex items-center gap-4">
                  {result.anpr_image_url && (
                    <img
                      src={result.anpr_image_url}
                      alt="ANPR crop [SIMULATED]"
                      className="h-12 rounded border border-slate-700"
                    />
                  )}
                  <div>
                    <div className="font-mono text-2xl font-bold text-amber-400 tracking-widest">
                      {result.plate_text}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Plate confidence: {Math.round((result.plate_confidence || 0) * 100)}%
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VAHAN Lookup Result */}
            {vahanData && (
              <div className={`rounded-lg p-4 border ${
                vahanData.status === 'SUSPENDED'
                  ? 'bg-rose-950/30 border-rose-800/60'
                  : 'bg-emerald-950/20 border-emerald-800/40'
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className={`w-4 h-4 ${vahanData.status === 'SUSPENDED' ? 'text-rose-400' : 'text-emerald-400'}`} />
                  <span className="text-xs font-bold text-slate-200">VAHAN Registry Match</span>
                  <span className="text-[10px] font-mono text-slate-500 ml-auto">src: LOCAL_SEED_[SIMULATED]</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Owner</div>
                    <div className="text-slate-200 font-semibold">{vahanData.ownerName}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Phone</div>
                    <div className="text-slate-200">{vahanData.ownerPhone}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Vehicle</div>
                    <div className="text-slate-200">{vahanData.vehicleMake}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">RTO</div>
                    <div className="text-slate-200">{vahanData.registeredRTO}</div>
                  </div>
                </div>
                {vahanData.status === 'SUSPENDED' && (
                  <div className="mt-2 text-[11px] text-rose-300 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    SUSPENDED REGISTRATION — Escalate to RTO
                  </div>
                )}
              </div>
            )}

            {/* VAHAN Not Found */}
            {vahanNotFound && !ocrFailed && (
              <div className="bg-amber-950/20 border border-amber-800/60 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Search className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-bold text-amber-300 mb-1">Registration Not Found in VAHAN</div>
                    <p className="text-xs text-amber-200/80 leading-relaxed">
                      Plate <span className="font-mono font-bold text-amber-300">{result.plate_text}</span> did not match
                      any record in the VAHAN vehicle registry. This case has been flagged for officer review —
                      the vehicle may be unregistered, the plate may be partially misread, or it may be a newly registered vehicle not yet in the database.
                    </p>
                    <p className="text-[11px] text-amber-400/70 mt-2 font-mono">
                      Status: REGISTRATION_NOT_FOUND — Officer Review Required
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Challan Generated */}
            {challan && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-200">
                      {isNeedsReview ? 'Challan Pending Officer Confirmation' : 'Challan Auto-Generated'}
                    </span>
                  </div>
                  <span className="font-mono text-lg font-bold text-rose-400">₹{challan.fineAmount}</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 mb-3">
                  ID: <span className="text-slate-200">{challan.id}</span> · Due: {challan.dueDate}
                  {challan.offenceCount > 1 && (
                    <span className="ml-2 text-amber-400 font-bold">Offence #{challan.offenceCount} — escalated fine</span>
                  )}
                </div>
                <button
                  onClick={() => onPreviewSMS(challan)}
                  className="w-full bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  Preview SMS Challan Payload
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── PEDESTRIAN BRANCH ──────────────────────────────────────────── */}
        {!isVehicle && (
          <div className="space-y-3">
            <div className="bg-amber-950/20 border border-amber-800/60 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-amber-300 mb-1">Manual Officer Review Required</div>
                  <p className="text-xs text-amber-200/80 leading-relaxed">
                    This pedestrian violation has been added to the Officer Review Queue.
                    No fine will be issued automatically — an authorised officer must review
                    the evidence and approve before any enforcement action is taken.
                  </p>
                  <p className="text-[11px] text-amber-400/70 mt-2 font-mono">
                    Compliance basis: DPDP Act 2023 — automated biometric-to-identity matching prohibited without specific sovereign exemption.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="text-xs">
                <div className="font-bold text-slate-200">Violation Logged to Review Queue</div>
                <div className="text-slate-400 mt-0.5">
                  Check the <span className="text-blue-400 font-semibold">Pending Review</span> tab in the Officer Dashboard.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dismiss / Run Again */}
        <div className="pt-2 border-t border-slate-800 flex justify-end">
          <button
            onClick={onDismiss}
            className="text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            Clear & Run New Detection
          </button>
        </div>
      </div>
    </div>
  );
}
