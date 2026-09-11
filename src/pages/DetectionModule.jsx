import React, { useState, useRef } from 'react';
import { Video, Play, Upload, Loader2, AlertTriangle, Shield, Info } from 'lucide-react';
import PrototypeBanner from '../components/PrototypeBanner';
import DetectionResultCard from '../components/DetectionResultCard';
import LegalBasisPanel from '../components/LegalBasisPanel';
import SMSPreviewModal from '../components/SMSPreviewModal';
import {
  DEMO_CLIPS, runMockDetection, runLiveDetection, generateChallan,
  classifyConfidence, isDuplicateEvent, LIVE_BACKEND_URL, BACKEND_BASE_URL
} from '../services/mockDetectionService';
import { vahanLookup, getViolationHistory } from '../services/vahanLookup';
import { logAuditEvent, AUDIT_ACTIONS } from '../services/auditLog';
import { collection, addDoc, setDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';

/**
 * SortIQ Enforce — CCTV Violation Detection Module
 * ====================================================
 * SIMULATED AI PIPELINE — PROTOTYPE ONLY
 * Route: /admin/detection
 *
 * Hardened pipeline:
 *   1. Select a demo clip (or upload file)
 *   2. Run Detection → mocked YOLOv8 + ANPR pipeline
 *   3. Confidence routing:
 *      - ≥ 0.85: AUTO — proceed to vehicle/pedestrian branch
 *      - 0.35–0.84: NEEDS_REVIEW — flag for officer regardless of type
 *      - < 0.35: DISCARD — log to audit only
 *   4a. Vehicle + plate readable + VAHAN match → Challan → SMS Preview
 *   4b. Vehicle + plate unreadable → Officer queue ("Unreadable Plate")
 *   4c. Vehicle + plate readable + VAHAN not found → Officer queue ("Registration Not Found")
 *   4d. Pedestrian → always officer queue (DPDP Act compliance)
 *   5. Deduplication: suppress events matching same camera + time window + bbox overlap
 *   6. Audit trail: every decision logged
 * ====================================================
 */
export default function DetectionModule() {
  const [selectedClip, setSelectedClip] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [detectionStatus, setDetectionStatus] = useState('idle'); // idle | processing | done | discarded
  const [detectionResult, setDetectionResult] = useState(null);
  const [vahanData, setVahanData] = useState(null);
  const [vahanNotFound, setVahanNotFound] = useState(false);
  const [challan, setChallan] = useState(null);
  const [confidenceTier, setConfidenceTier] = useState(null);
  const [ocrFailed, setOcrFailed] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [error, setError] = useState(null);
  const [detectionSource, setDetectionSource] = useState(null); // 'LIVE_BACKEND' | 'MOCK' | null
  const [backendOnline, setBackendOnline] = useState(null); // null = unknown, true/false
  const [forcedEventType, setForcedEventType] = useState('auto'); // 'auto' | 'pedestrian' | 'vehicle'
  const [processingStage, setProcessingStage] = useState('');

  // Track recent events for deduplication (in production, this would query Firestore)
  const recentEvents = useRef([]);

  const handleSelectClip = (clip) => {
    setSelectedClip(clip);
    setUploadedFile(null);
    setForcedEventType(clip.forcedResult || 'auto');
    resetDetection();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setSelectedClip(null);
      // Auto-detect based on filename hints if present
      const lowerName = file.name.toLowerCase();
      if (lowerName.includes('pedestrian') || lowerName.includes('walk') || lowerName.includes('person')) {
        setForcedEventType('pedestrian');
      } else if (lowerName.includes('vehicle') || lowerName.includes('car') || lowerName.includes('scooter') || lowerName.includes('bike')) {
        setForcedEventType('vehicle');
      }
      resetDetection();
    }
  };

  const resetDetection = () => {
    setDetectionStatus('idle');
    setDetectionResult(null);
    setVahanData(null);
    setVahanNotFound(false);
    setChallan(null);
    setConfidenceTier(null);
    setOcrFailed(false);
    setIsDuplicate(false);
    setError(null);
    setDetectionSource(null);
    setProcessingStage('');
  };

  const handleRunDetection = async () => {
    if (!selectedClip && !uploadedFile) return;
    setDetectionStatus('processing');
    setError(null);
    setVahanNotFound(false);
    setOcrFailed(false);
    setIsDuplicate(false);

    try {
      // ── Step 1: Run detection ─────────────────────────────────────────
      // For uploaded files: try live Python CV backend first, fall back to mock.
      // For demo clips: always use mock (they don't have real video data).
      let result;
      let source = 'MOCK';

      if (uploadedFile) {
        try {
          result = await runLiveDetection(uploadedFile, selectedClip || {
            location: 'Uploaded File — Location from Camera Feed',
            gps: { lat: 18.5204, lng: 73.8567 },
          }, forcedEventType !== 'auto' ? forcedEventType : null);
          source = 'LIVE_BACKEND';
          setBackendOnline(true);
        } catch (liveErr) {
          console.warn('[DetectionModule] Live backend unavailable, falling back to mock:', liveErr.message);
          setBackendOnline(false);
          // Fall back to mock detection
          result = await runMockDetection({
            clipId: 'upload',
            forceType: forcedEventType !== 'auto' ? forcedEventType : null,
            clipMeta: {
              location: 'Uploaded File — Location Unknown',
              gps: { lat: 18.5204, lng: 73.8567 },
            },
            onStageUpdate: setProcessingStage,
          });
        }
      } else {
        // Demo clip — always mock
        result = await runMockDetection({
          clipId: selectedClip?.id || 'upload',
          forceType: forcedEventType !== 'auto' ? forcedEventType : (selectedClip?.forcedResult || null),
          clipMeta: selectedClip || {
            location: 'Uploaded File — Location Unknown',
            gps: { lat: 18.5204, lng: 73.8567 },
          },
          onStageUpdate: setProcessingStage,
        });
      }

      setDetectionSource(source);
      setDetectionResult(result);

      // ── Step 2: Deduplication check ────────────────────────────────────
      if (isDuplicateEvent(result, recentEvents.current)) {
        setIsDuplicate(true);
        setDetectionStatus('done');
        logAuditEvent({
          action: AUDIT_ACTIONS.DUPLICATE_SUPPRESSED,
          details: `Duplicate event from ${result.camera_id} suppressed (same camera + time window + bbox overlap >50%)`,
          relatedIds: { cameraId: result.camera_id, clipId: result.clip_id },
        });
        return;
      }

      // Record as recent event for future dedup checks
      recentEvents.current = [result, ...recentEvents.current.slice(0, 19)];

      // ── Step 3: Confidence routing ─────────────────────────────────────
      const tier = classifyConfidence(result.confidence);
      setConfidenceTier(tier);

      if (tier === 'DISCARD') {
        setDetectionStatus('discarded');
        logAuditEvent({
          action: AUDIT_ACTIONS.DETECTION_DISCARDED_LOW_CONFIDENCE,
          details: `Confidence ${(result.confidence * 100).toFixed(1)}% below threshold. Event discarded.`,
          relatedIds: { cameraId: result.camera_id, clipId: result.clip_id },
        });
        return;
      }

      // ── Step 4: Branch on event type + confidence ──────────────────────
      const isVehicle = result.event_type === 'vehicle';
      const isAutoApprove = tier === 'AUTO';

      if (isVehicle) {
        // Check OCR success
        const plateUnreadable = !result.plate_text || (result.plate_confidence != null && result.plate_confidence < 0.3);

        if (plateUnreadable) {
          // OCR failed → route to officer queue as "Unreadable Plate"
          setOcrFailed(true);
          setDetectionStatus('done');
          logAuditEvent({
            action: AUDIT_ACTIONS.DETECTION_OCR_FAILED,
            details: `Vehicle detected but plate OCR failed (confidence: ${result.plate_confidence?.toFixed(3) || 'N/A'}). Routed to officer review.`,
            relatedIds: { cameraId: result.camera_id },
          });
          return;
        }

        // Plate readable → VAHAN lookup
        const vahanResult = await vahanLookup(result.plate_text);

        if (!vahanResult.found) {
          // Plate not found in VAHAN → flag for officer review
          setVahanNotFound(true);
          setDetectionStatus('done');
          logAuditEvent({
            action: AUDIT_ACTIONS.VAHAN_LOOKUP_NOT_FOUND,
            details: `Plate ${vahanResult.plateSearched || result.plate_text} not found in VAHAN registry. Flagged for officer review.`,
            relatedIds: { plate: result.plate_text, cameraId: result.camera_id },
          });
          return;
        }

        // VAHAN match found
        const vahanRecord = vahanResult.data;
        setVahanData(vahanRecord);
        logAuditEvent({
          action: AUDIT_ACTIONS.VAHAN_LOOKUP_SUCCESS,
          details: `Plate ${result.plate_text} matched to owner: ${vahanRecord.ownerName}`,
          relatedIds: { plate: result.plate_text, ownerId: vahanRecord.id },
        });

        // If NEEDS_REVIEW confidence, still show the result but don't auto-challan
        if (!isAutoApprove) {
          setDetectionStatus('done');
          logAuditEvent({
            action: AUDIT_ACTIONS.DETECTION_FLAGGED_REVIEW,
            details: `Vehicle violation confidence ${(result.confidence * 100).toFixed(1)}% — flagged for officer review despite readable plate.`,
            relatedIds: { plate: result.plate_text, cameraId: result.camera_id },
          });
          return;
        }

        // AUTO confidence + plate matched → generate challan
        const violationHistory = getViolationHistory(result.plate_text);
        const newChallan = generateChallan({
          detectionResult: result,
          vahanData: vahanRecord,
          violationHistory,
        });
        setChallan(newChallan);

        logAuditEvent({
          action: AUDIT_ACTIONS.DETECTION_AUTO_APPROVED,
          details: `Vehicle violation auto-approved (confidence: ${(result.confidence * 100).toFixed(1)}%). Challan ${newChallan.id} generated for ₹${newChallan.fineAmount}.`,
          relatedIds: { challanId: newChallan.id, plate: result.plate_text },
        });
        logAuditEvent({
          action: AUDIT_ACTIONS.CHALLAN_GENERATED,
          details: `Challan ${newChallan.id}: ₹${newChallan.fineAmount} (offence #${newChallan.offenceCount}) for ${vahanRecord.ownerName}`,
          relatedIds: { challanId: newChallan.id, violationId: newChallan.violationId },
        });

      } else {
        // Pedestrian — always to officer queue, never auto-challan
        const pendingCard = {
          id: `viol-${Date.now().toString(36).toUpperCase()}`,
          evidencePhotoUrl: result.cropped_image_url || 'https://placehold.co/480x320/1e293b/94a3b8?text=PEDESTRIAN+EVIDENCE',
          locationAddress: result.location_address || 'Surveillance Node',
          gps: result.gps || { lat: 18.5204, lng: 73.8567 },
          createdAt: Timestamp.now(),
          confidence: result.confidence || 0.88,
          cameraId: result.camera_id || 'CAM-CCTV',
          status: 'PENDING_OFFICER_REVIEW',
          type: 'PEDESTRIAN_LITTERING',
          notes: 'AI-detected pedestrian violation awaiting manual officer review per DPDP Act 2023.',
          source: result.source || 'AI_DETECTION_[SIMULATED]',
        };

        // Write to Firestore so it immediately appears in the Officer Dashboard Pending Review queue
        // Use setDoc with explicit ID so AdminDashboard can updateDoc by this same ID
        try {
          const { id: violId, ...violData } = pendingCard;
          await setDoc(doc(db, COLLECTIONS.VIOLATIONS, violId), violData);
          console.log('[DetectionModule] Pedestrian violation persisted to Firestore pending queue:', violId);
        } catch (err) {
          console.warn('[DetectionModule] Could not persist pedestrian violation to Firestore:', err.message);
        }

        logAuditEvent({
          action: isAutoApprove
            ? AUDIT_ACTIONS.DETECTION_FLAGGED_REVIEW
            : AUDIT_ACTIONS.DETECTION_FLAGGED_REVIEW,
          details: `Pedestrian violation (confidence: ${(result.confidence * 100).toFixed(1)}%) routed to officer review queue. No auto-ID per DPDP Act 2023.`,
          relatedIds: { cameraId: result.camera_id },
        });
      }

      setDetectionStatus('done');
    } catch (err) {
      setError('Detection pipeline error: ' + err.message);
      setDetectionStatus('idle');
    }
  };

  const canRun = (selectedClip || uploadedFile) && detectionStatus !== 'processing';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <PrototypeBanner />

      <div className="max-w-5xl mx-auto px-3.5 sm:px-4 py-5 sm:py-8 space-y-6 sm:space-y-8">

        {/* Page Header */}
        <div className="border-b border-slate-800 pb-5 sm:pb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white flex flex-wrap items-center gap-2 sm:gap-3">
                <Video className="w-5 h-5 sm:w-7 sm:h-7 text-blue-400 shrink-0" />
                <span>CCTV Detection Module</span>
                {detectionSource === 'LIVE_BACKEND' ? (
                  <span className="text-[10px] sm:text-xs bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-mono font-normal">
                    LIVE BACKEND
                  </span>
                ) : (
                  <span className="text-[10px] sm:text-xs bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded font-mono font-normal">
                    {detectionSource === 'MOCK' ? 'MOCK FALLBACK' : 'SIMULATED AI'}
                  </span>
                )}
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1.5 max-w-2xl leading-relaxed">
                Upload image/video or select a demo clip. Analyzed via YOLOv8 detection & ANPR pipeline with confidence routing.
              </p>
              {backendOnline === false && (
                <div className="mt-2 flex items-center gap-2 text-xs text-amber-300">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                  Backend offline — using simulated mock detection
                </div>
              )}
              {backendOnline === true && (
                <div className="mt-2 flex items-center gap-2 text-xs text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Connected to live detection backend
                </div>
              )}
            </div>
          </div>

          {/* AI Pipeline Info Bar */}
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-mono">
            {[
              { label: 'YOLOv8n-litter', color: 'text-blue-400 bg-blue-950/60 border-blue-900' },
              { label: 'EasyOCR ANPR', color: 'text-emerald-400 bg-emerald-950/60 border-emerald-900' },
              { label: 'VAHAN Lookup', color: 'text-amber-400 bg-amber-950/60 border-amber-900' },
              { label: 'Confidence Routing', color: 'text-purple-400 bg-purple-950/60 border-purple-900' },
              { label: 'Audit Trail', color: 'text-rose-400 bg-rose-950/60 border-rose-900' },
              { 
                label: BACKEND_BASE_URL.replace(/^https?:\/\//, ''), 
                color: backendOnline ? 'text-emerald-400 bg-emerald-950/60 border-emerald-900' : 'text-slate-400 bg-slate-800/60 border-slate-700' 
              },
            ].map(p => (
              <span key={p.label} className={`px-2.5 py-1 rounded border font-semibold ${p.color}`}>
                {p.label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Confidence Routing Info ──────────────────────────────────────── */}
        <div className="bg-blue-950/20 border border-blue-800/40 rounded-xl p-4 text-xs text-blue-200 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-blue-300 text-sm mb-1">
            <Info className="w-4 h-4" /> Confidence-Based Routing
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span className="font-semibold text-emerald-300">≥ 85%</span> — Auto-process (vehicle → challan, pedestrian → queue)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <span className="font-semibold text-amber-300">35–84%</span> — Flagged for officer review regardless of type
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
              <span className="font-semibold text-slate-400">&lt; 35%</span> — Discarded, audit-logged only
            </span>
          </div>
        </div>

        {/* ── Video Selector Panel ───────────────────────────────────────── */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            <Video className="w-4 h-4 text-blue-400" />
            Step 1 — Select Video Source
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {DEMO_CLIPS.map(clip => (
              <button
                key={clip.id}
                onClick={() => handleSelectClip(clip)}
                className={`text-left rounded-lg border overflow-hidden transition-all ${
                  selectedClip?.id === clip.id
                    ? 'border-blue-500 ring-2 ring-blue-500/30'
                    : 'border-slate-700 hover:border-slate-500'
                }`}
              >
                <img
                  src={clip.thumbnail}
                  alt={clip.label}
                  className="w-full h-28 object-cover"
                />
                <div className="p-3 bg-slate-900">
                  <p className="text-xs font-semibold text-slate-200 leading-tight">{clip.label}</p>
                  <p className="text-[10px] text-slate-500 mt-1 font-mono">{clip.cameraId}</p>
                  <span className={`mt-1.5 inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono ${
                    clip.forcedResult === 'vehicle'
                      ? 'bg-rose-950 text-rose-300 border-rose-800'
                      : 'bg-amber-950 text-amber-300 border-amber-800'
                  }`}>
                    {clip.forcedResult === 'vehicle' ? 'Vehicle Event' : 'Pedestrian Event'}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* File Upload */}
          <div className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            uploadedFile ? 'border-emerald-600 bg-emerald-950/20' : 'border-slate-700 hover:border-slate-500'
          }`}
            onClick={() => document.getElementById('video-upload').click()}
          >
            <Upload className={`w-6 h-6 mx-auto mb-2 ${uploadedFile ? 'text-emerald-400' : 'text-slate-500'}`} />
            {uploadedFile ? (
              <p className="text-xs font-semibold text-emerald-300">{uploadedFile.name}</p>
            ) : (
              <>
                <p className="text-xs font-semibold text-slate-300">Upload a test image or video frame</p>
                <p className="text-[11px] text-slate-500 mt-0.5">JPEG, PNG, MP4 — sent to live backend at {LIVE_BACKEND_URL}</p>
              </>
            )}
            <input id="video-upload" type="file" accept="image/*,video/*" className="hidden" onChange={handleFileUpload} />
          </div>

          {/* Incident Type Classification Override for uploaded footage */}
          {uploadedFile && (
            <div className="mt-4 p-3.5 bg-slate-950/80 border border-slate-800 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-slate-300">Target Violation Category:</span>
                <p className="text-[11px] text-slate-500">Ensure model or mock classifies appropriately</p>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setForcedEventType('auto')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    forcedEventType === 'auto' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Auto-Detect
                </button>
                <button
                  type="button"
                  onClick={() => setForcedEventType('pedestrian')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    forcedEventType === 'pedestrian' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🚶 Pedestrian
                </button>
                <button
                  type="button"
                  onClick={() => setForcedEventType('vehicle')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    forcedEventType === 'vehicle' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🚗 Vehicle
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── DPDP Compliance Notice ─────────────────────────────────────── */}
        <div className="bg-amber-950/20 border border-amber-800/60 rounded-xl p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200">
            <span className="font-bold">DPDP Act 2023 Compliance Notice:</span>
            {' '}For vehicle violations, this system cross-references plates against the VAHAN registry (government data) — this is legally permissible.
            For pedestrian violations, <span className="font-bold underline">no automatic face-to-identity matching is performed</span>. All pedestrian violations require manual officer review before any enforcement action. See Legal Basis below.
          </div>
        </div>

        {/* ── Run Detection Button ───────────────────────────────────────── */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            <Play className="w-4 h-4 text-emerald-400" />
            Step 2 — Run AI Detection Pipeline
          </h2>

          {error && (
            <div className="mb-4 bg-rose-950/60 border border-rose-800 text-rose-300 p-3 rounded-lg text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {!selectedClip && !uploadedFile && (
            <div className="mb-4 text-xs text-slate-400 flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-500" />
              Select a demo clip or upload a file above to enable detection.
            </div>
          )}

          <button
            onClick={handleRunDetection}
            disabled={!canRun}
            className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-3 transition-all shadow-lg ${
              canRun
                ? 'bg-blue-700 hover:bg-blue-600 text-white cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {detectionStatus === 'processing' ? (
              <div className="flex items-center gap-2.5">
                <Loader2 className="w-5 h-5 animate-spin text-blue-300" />
                <span className="font-mono text-xs sm:text-sm">
                  {processingStage || 'Processing AI Pipeline — YOLOv8 → ANPR → VAHAN…'}
                </span>
              </div>
            ) : (
              <>
                <Play className="w-5 h-5" />
                <span>Run Detection on {selectedClip ? `"${selectedClip.label}"` : uploadedFile?.name || 'Selected Source'}</span>
              </>
            )}
          </button>
        </section>

        {/* ── Detection Result ───────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Step 3 — Detection Output
          </h2>
          <DetectionResultCard
            result={detectionResult}
            vahanData={vahanData}
            vahanNotFound={vahanNotFound}
            challan={challan}
            status={detectionStatus}
            confidenceTier={confidenceTier}
            ocrFailed={ocrFailed}
            isDuplicate={isDuplicate}
            detectionSource={detectionSource}
            onPreviewSMS={() => setSmsOpen(true)}
            onDismiss={resetDetection}
          />
          {detectionStatus === 'idle' && !detectionResult && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-xs">
              Detection results will appear here after running the pipeline.
            </div>
          )}
        </section>

        {/* ── Legal Basis Panel ──────────────────────────────────────────── */}
        <LegalBasisPanel collapsed={true} />

      </div>

      {/* SMS Preview Modal */}
      <SMSPreviewModal
        isOpen={smsOpen}
        onClose={() => setSmsOpen(false)}
        challan={challan}
      />
    </div>
  );
}
