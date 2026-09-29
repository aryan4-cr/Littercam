/**
 * LitterCam — Audit Trail Service
 * Records every automated decision for accountability.
 * In production this writes to Firestore `audit_log` collection.
 * For prototype, maintains an in-memory array.
 */

const auditLog = [];

export const AUDIT_ACTIONS = {
  DETECTION_AUTO_APPROVED: 'DETECTION_AUTO_APPROVED',
  DETECTION_FLAGGED_REVIEW: 'DETECTION_FLAGGED_REVIEW',
  DETECTION_DISCARDED_LOW_CONFIDENCE: 'DETECTION_DISCARDED_LOW_CONFIDENCE',
  DETECTION_OCR_FAILED: 'DETECTION_OCR_FAILED',
  VAHAN_LOOKUP_SUCCESS: 'VAHAN_LOOKUP_SUCCESS',
  VAHAN_LOOKUP_NOT_FOUND: 'VAHAN_LOOKUP_NOT_FOUND',
  CHALLAN_GENERATED: 'CHALLAN_GENERATED',
  OFFICER_APPROVED: 'OFFICER_APPROVED',
  OFFICER_REJECTED: 'OFFICER_REJECTED',
  DUPLICATE_SUPPRESSED: 'DUPLICATE_SUPPRESSED',
};

export function logAuditEvent({ action, details, actorId, relatedIds }) {
  const entry = {
    id: `AUD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    action,
    details: details || '',
    actorId: actorId || 'SYSTEM',
    relatedIds: relatedIds || {},
    timestamp: new Date().toISOString(),
  };
  auditLog.unshift(entry);
  console.log(`[AUDIT] ${action}:`, entry);
  return entry;
}

export function getAuditLog(filter) {
  if (!filter) return [...auditLog];
  return auditLog.filter(e => {
    if (filter.action && e.action !== filter.action) return false;
    if (filter.since) {
      const sinceMs = new Date(filter.since).getTime();
      if (new Date(e.timestamp).getTime() < sinceMs) return false;
    }
    return true;
  });
}

export function getAuditStats() {
  const stats = {};
  for (const entry of auditLog) {
    stats[entry.action] = (stats[entry.action] || 0) + 1;
  }
  return { total: auditLog.length, byAction: stats };
}
