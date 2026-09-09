/**
 * SortIQ Enforce — Detection Service
 * ====================================================
 * Supports two modes:
 *   1. LIVE — POST to local Python CV backend at LIVE_BACKEND_URL
 *   2. MOCK — simulated results for demo when backend is offline
 *
 * The frontend tries LIVE first and falls back to MOCK automatically.
 *
 * Backend REST contract (POST /detect, multipart/form-data, key: "file"):
 * Response: {
 *   event_type: "vehicle" | "pedestrian",
 *   confidence: number,
 *   bbox: [x, y, width, height],
 *   cropped_image_url: string,
 *   timestamp: string,
 *   camera_id: string,
 *   "license-plate": string | null
 * }
 */

// Dynamic Backend URL: configured via VITE_BACKEND_URL in Vercel or defaults to your ngrok tunnel
export const BACKEND_BASE_URL = (
  import.meta.env.VITE_BACKEND_URL || 'https://saloon-rotunda-strict.ngrok-free.dev'
).replace(/\/+$/, '');

export const LIVE_BACKEND_URL = `${BACKEND_BASE_URL}/detect`;

/**
 * Call the live Python CV backend.
 * Sends the file as multipart/form-data under key "file".
 * Normalises the response to the internal detection result contract.
 *
 * @param {File} file - Image or video frame file to send
 * @param {object} clipMeta - Optional camera/location metadata to enrich the result
 * @returns {Promise<object>} Normalised detection result
 * @throws {Error} If the backend is unreachable or returns an error
 */
export async function runLiveDetection(file, clipMeta = {}) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(LIVE_BACKEND_URL, {
    method: 'POST',
    body: formData,
    headers: {
      'ngrok-skip-browser-warning': '69420',
    },
    // No Content-Type header — browser automatically sets boundary for multipart
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Backend returned ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  // ── Normalise backend contract to internal format ──────────────────
  // Backend might send "event_type" or "eventType", "license-plate" or "license_plate" or "plate_text"
  const rawEventType = (data.event_type || data.eventType || '').toLowerCase().trim();
  const plateText = data['license-plate'] || data['license_plate'] || data.plate_text || null;
  
  // Explicitly identify pedestrian vs vehicle
  const isPedestrian = rawEventType.includes('pedestrian') || (!plateText && rawEventType !== 'vehicle');
  const normalizedEventType = isPedestrian ? 'pedestrian' : 'vehicle';
  const isVehicle = normalizedEventType === 'vehicle';

  const result = {
    event_type: normalizedEventType,
    confidence: Number(data.confidence) || 0.85,
    bbox: data.bbox || [0, 0, 0, 0],
    cropped_image_url: data.cropped_image_url || data.image_url || '',
    timestamp: data.timestamp || new Date().toISOString(),
    camera_id: data.camera_id || clipMeta.cameraId || 'CAM-LIVE',
    location_address: clipMeta.location || 'Live Detection — Location from Camera Feed',
    gps: clipMeta.gps || { lat: 0, lng: 0 },
    frame_number: 0,
    model_version: 'YOLOv8-live',
    clip_id: 'live-upload',
    source: 'LIVE_BACKEND',
  };

  if (isVehicle) {
    result.plate_text = plateText;
    result.plate_confidence = plateText ? 0.90 : 0;
    result.anpr_image_url = null;
    result.ocr_engine = 'Backend ANPR';
  } else {
    result.officer_review_required = true;
    result.face_detection = false;
    result.compliance_note = 'Pedestrian identification requires manual officer review per DPDP Act 2023.';
  }

  return result;
}

// Pre-loaded demo clip definitions (thumbnail + metadata)
export const DEMO_CLIPS = [
  {
    id: 'clip-001',
    label: 'Junction Camera 04 — FC Road, Pune',
    thumbnail: 'https://placehold.co/320x180/0f172a/3b82f6?text=CLIP+01%0AJunction+Cam+04',
    location: 'FC Road & JM Road Junction, Pune, MH',
    gps: { lat: 18.5204, lng: 73.8567 },
    cameraId: 'CAM-FC-04',
    forcedResult: 'vehicle',   // for demo determinism
    plateHint: 'MH12AB1234',
  },
  {
    id: 'clip-002',
    label: 'NH-48 Entry — Overbridge Camera',
    thumbnail: 'https://placehold.co/320x180/0f172a/3b82f6?text=CLIP+02%0ANH-48+Overbridge',
    location: 'NH-48 Makarba Overbridge, Ahmedabad, GJ',
    gps: { lat: 23.0225, lng: 72.5714 },
    cameraId: 'CAM-NH48-11',
    forcedResult: 'vehicle',
    plateHint: 'GJ01AA9988',
  },
  {
    id: 'clip-003',
    label: 'Indiranagar Market — Surveillance Node 7',
    thumbnail: 'https://placehold.co/320x180/0f172a/3b82f6?text=CLIP+03%0AIndiranagar+Mkt',
    location: '100 Ft Road Market Area, Indiranagar, Bengaluru, KA',
    gps: { lat: 12.9716, lng: 77.5946 },
    cameraId: 'CAM-INDNR-07',
    forcedResult: 'pedestrian',
    plateHint: null,
  },
];

// CONFIDENCE THRESHOLD CONFIGURATION
export const CONFIDENCE_THRESHOLDS = {
  AUTO_APPROVE: 0.85,    // >= this: proceed automatically
  NEEDS_REVIEW: 0.60,    // >= this but < AUTO_APPROVE: flag for officer review
  DISCARD: 0.60,         // < this: discard, log to audit only
};

export function classifyConfidence(confidence) {
  if (confidence >= CONFIDENCE_THRESHOLDS.AUTO_APPROVE) return 'AUTO';
  if (confidence >= CONFIDENCE_THRESHOLDS.NEEDS_REVIEW) return 'NEEDS_REVIEW';
  return 'DISCARD';
}

function getRandomBBox() {
  const x = Math.floor(Math.random() * 300) + 50;
  const y = Math.floor(Math.random() * 200) + 50;
  const w = Math.floor(Math.random() * 150) + 50;
  const h = Math.floor(Math.random() * 100) + 50;
  return [x, y, w, h];
}

function computeIoU(box1, box2) {
  const [x1, y1, w1, h1] = box1;
  const [x2, y2, w2, h2] = box2;

  const xA = Math.max(x1, x2);
  const yA = Math.max(y1, y2);
  const xB = Math.min(x1 + w1, x2 + w2);
  const yB = Math.min(y1 + h1, y2 + h2);

  const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
  const box1Area = w1 * h1;
  const box2Area = w2 * h2;

  const iou = interArea / (box1Area + box2Area - interArea);
  return iou;
}

export function isDuplicateEvent(newEvent, recentEvents, windowMs = 30000) {
  const newTime = new Date(newEvent.timestamp).getTime();
  
  for (const event of recentEvents) {
    if (event.camera_id !== newEvent.camera_id) continue;
    
    const eventTime = new Date(event.timestamp).getTime();
    if (Math.abs(newTime - eventTime) > windowMs) continue;
    
    const iou = computeIoU(newEvent.bbox, event.bbox);
    if (iou > 0.5) {
      return true;
    }
  }
  
  return false;
}

function pickRandomPlate() {
  const plates = [
    'MH12AB1234', 'DL4CAF5678', 'KA03MN2211',
    'TN22BX4321', 'GJ01AA9988', 'HP65AB0023',
  ];
  return plates[Math.floor(Math.random() * plates.length)];
}

export async function runMockDetection({ clipId, forceType = null, clipMeta = {} }) {
  const delay = 1000 + Math.random() * 1000;
  await new Promise(resolve => setTimeout(resolve, delay));

  const isUpload = clipId === 'upload';
  let eventType = forceType || clipMeta.forcedResult;
  if (isUpload || !eventType) {
    eventType = Math.random() > 0.4 ? 'vehicle' : 'pedestrian';
  }

  let confidence;
  const randConf = Math.random();
  if (isUpload) {
    confidence = parseFloat((Math.random() * 0.6 + 0.4).toFixed(3)); // 0.4 to 1.0
  } else {
    if (randConf < 0.15) {
      confidence = parseFloat((0.4 + Math.random() * 0.19).toFixed(3)); // <0.6
    } else if (randConf < 0.45) {
      confidence = parseFloat((0.6 + Math.random() * 0.24).toFixed(3)); // 0.6-0.84
    } else {
      confidence = parseFloat((0.85 + Math.random() * 0.14).toFixed(3)); // >=0.85
    }
  }

  const timestamp = new Date().toISOString();

  const baseResult = {
    event_type: eventType,
    confidence,
    bbox: getRandomBBox(),
    cropped_image_url: 'https://placehold.co/480x320/1e293b/94a3b8?text=SIMULATED+DETECTION+CROP%0AViolation+Frame',
    timestamp,
    camera_id: clipMeta.cameraId || 'CAM-UNKNOWN',
    location_address: clipMeta.location || 'Unknown Location',
    gps: clipMeta.gps || { lat: 18.5204, lng: 73.8567 },
    frame_number: Math.floor(Math.random() * 2400) + 300,
    model_version: 'YOLOv8n-litter-v1.2 [SIMULATED]',
    clip_id: clipId,
  };

  if (eventType === 'vehicle') {
    const ocrFailed = Math.random() < 0.20;
    let plateText = null;
    let plateConfidence = null;
    let anprImageUrl = null;

    if (!ocrFailed) {
      plateText = clipMeta.plateHint || pickRandomPlate();
      plateConfidence = parseFloat((0.88 + Math.random() * 0.10).toFixed(3));
      anprImageUrl = 'https://placehold.co/320x120/0f172a/94a3b8?text=ANPR+CROP%0A' + plateText;
    } else {
      plateConfidence = parseFloat((0.1 + Math.random() * 0.19).toFixed(3));
    }

    return {
      ...baseResult,
      plate_text: plateText,
      plate_confidence: plateConfidence,
      anpr_image_url: anprImageUrl,
      ocr_engine: 'EasyOCR-v1.6.2 [SIMULATED]',
    };
  }

  return {
    ...baseResult,
    officer_review_required: true,
    face_detection: false,
    compliance_note: 'Pedestrian identification requires manual officer review per DPDP Act 2023.',
  };
}

function stringHash(str) {
  let hash = 0;
  if (!str || str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

export function generateChallan({ detectionResult, vahanData, violationHistory = [] }) {
  const offenceCount = violationHistory.length + 1;
  const BASE_VEHICLE_FINE = 500;
  let fineAmount = 0;

  if (detectionResult.event_type === 'vehicle') {
    fineAmount = BASE_VEHICLE_FINE;
    if (offenceCount === 2) fineAmount = BASE_VEHICLE_FINE * 2;
    if (offenceCount >= 3) fineAmount = BASE_VEHICLE_FINE * 3;
  } else {
    const offenderName = vahanData?.ownerName || 'Unknown Pedestrian';
    const hash = stringHash(offenderName);
    const BASE_PEDESTRIAN_FINE = 250 + (hash % 251); 
    
    fineAmount = BASE_PEDESTRIAN_FINE;
    if (offenceCount === 2) fineAmount = BASE_PEDESTRIAN_FINE * 2;
    if (offenceCount >= 3) fineAmount = BASE_PEDESTRIAN_FINE * 3;
  }

  fineAmount = Math.min(fineAmount, 5000);

  const challanId = `CHN-${Date.now().toString(36).toUpperCase()}`;
  const dueDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  return {
    id: challanId,
    violationId: `VIOL-${Date.now().toString(36).toUpperCase()}`,
    offenderName: vahanData?.ownerName || 'Unknown (Pedestrian — Pending ID)',
    vehicleNumber: detectionResult.plate_text || null,
    caseId: detectionResult.event_type === 'pedestrian' ? challanId : null,
    offenceType: detectionResult.event_type === 'vehicle' ? 'Vehicle Littering' : 'Pedestrian Littering',
    fineAmount,
    status: 'ISSUED',
    gps: detectionResult.gps,
    locationAddress: detectionResult.location_address,
    timestamp: detectionResult.timestamp,
    createdAt: new Date().toISOString(),
    dueDate,
    evidencePhotoUrl: detectionResult.cropped_image_url,
    anprImageUrl: detectionResult.anpr_image_url || null,
    confidence: detectionResult.confidence,
    cameraId: detectionResult.camera_id,
    issuedByOfficerId: 'officer-demo-101',
    issuedByOfficer: 'Insp. M. Sharma [SIMULATED]',
    offenceCount,
    source: 'AI_DETECTION_[SIMULATED]',
    appealInstructions: 'To dispute this challan, file an appeal at your nearest Municipal Corporation office or visit sortiq.gov.in/appeal within 30 days of issue date.',
    confidenceTier: classifyConfidence(detectionResult.confidence),
  };
}
