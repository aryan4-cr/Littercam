import React, { useState } from 'react';
import { X, MessageSquare, AlertTriangle, MapPin, Camera, Receipt, Clock, Copy, CheckCheck } from 'lucide-react';

/**
 * LitterCam — Mock SMS Preview Modal
 * ====================================================
 * SIMULATED / PROTOTYPE COMPONENT — NOT CONNECTED TO REAL SMS SERVICE
 * This renders the exact text payload that would be sent via an SMS gateway
 * (e.g., MSG91, Textlocal, or government-approved NIC messaging).
 * No actual SMS is dispatched by this component.
 * ====================================================
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Controls visibility of modal
 * @param {function} props.onClose - Callback to close modal
 * @param {object} props.challan - Challan object with:
 *   - id: string
 *   - offenderName: string
 *   - vehicleNumber?: string
 *   - caseId?: string
 *   - fineAmount: number
 *   - gps: { lat: number, lng: number }
 *   - locationAddress?: string
 *   - timestamp: Date | string
 *   - evidencePhotoUrl?: string
 *   - offenceType: string
 *   - dueDate?: string
 *   - issuedByOfficer?: string
 */
export default function SMSPreviewModal({ isOpen, onClose, challan }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !challan) return null;

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = date?.toDate ? date.toDate() : new Date(date);
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  };

  const formatCurrency = (amt) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt);

  const dueDate = challan.dueDate ||
    new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });

  const referenceId = challan.id || challan.caseId || `CHN-${Math.floor(Math.random() * 90000) + 10000}`;
  const vehicleOrCase = challan.vehicleNumber ? `Veh: ${challan.vehicleNumber}` : `Case: ${challan.caseId}`;
  const gpsLink = challan.gps
    ? `https://maps.google.com/?q=${challan.gps.lat},${challan.gps.lng}`
    : 'N/A';

  // ── SMS TEXT PAYLOAD ──────────────────────────────────────────────────────
  // This is exactly what would be dispatched to the SMS gateway.
  // Character count target: ≤320 characters (2 SMS units @ 160 chars each)
  const smsText = [
    `[MUNICIPAL ENFORCEMENT - LITTERCAM]`,
    `Ref: ${referenceId}`,
    ``,
    `Dear ${challan.offenderName},`,
    `A civic violation challan has been issued against you.`,
    ``,
    `${vehicleOrCase}`,
    `Offence: ${challan.offenceType || challan.type || 'Civic Violation'}`,
    `Date: ${formatDate(challan.timestamp || challan.createdAt)}`,
    `Location: ${challan.locationAddress || `${challan.gps?.lat?.toFixed(4)}, ${challan.gps?.lng?.toFixed(4)}`}`,
    `Fine: ${formatCurrency(challan.fineAmount)}${challan.offenceCount > 1 ? ` (Offence #${challan.offenceCount} — escalated rate)` : ''}`,
    `Pay by: ${dueDate}`,
    ``,
    `Evidence: ${challan.evidencePhotoUrl || 'On file'}`,
    `GPS: ${gpsLink}`,
    ``,
    `Pay online at: littercam.gov.in/pay/${referenceId}`,
    `Helpline: 1800-XXX-XXXX`,
    ``,
    `${challan.appealInstructions || 'To dispute this challan, file an appeal at your nearest Municipal Corporation office or visit littercam.gov.in/appeal within 30 days of issue date.'}`,
    ``,
    `[SIMULATED MESSAGE - PROTOTYPE ONLY]`,
  ].join('\n');

  const charCount = smsText.replace(/\[SIMULATED MESSAGE - PROTOTYPE ONLY\]/g, '').length;
  const smsUnits = Math.ceil(charCount / 160);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(smsText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for non-HTTPS
      const el = document.createElement('textarea');
      el.value = smsText;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl my-4">

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-950 text-blue-400 rounded-lg border border-blue-800">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">SMS Challan Preview</h2>
              <p className="text-[11px] text-amber-400 font-medium font-mono flex items-center gap-1 mt-0.5">
                <AlertTriangle className="w-3 h-3" />
                SIMULATED — NOT SENDING REAL SMS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 hover:bg-slate-800 p-1.5 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Challan Data Summary Panel */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60 grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-start gap-2">
            <Receipt className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-slate-500 uppercase tracking-wide text-[10px]">Challan Ref</div>
              <div className="font-mono text-slate-200 font-semibold">{referenceId}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-slate-500 uppercase tracking-wide text-[10px]">Issued At</div>
              <div className="text-slate-200">{formatDate(challan.timestamp || challan.createdAt)}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-slate-500 uppercase tracking-wide text-[10px]">GPS Location</div>
              <div className="text-slate-200 text-[11px] leading-tight">
                {challan.locationAddress || `${challan.gps?.lat?.toFixed(4)}, ${challan.gps?.lng?.toFixed(4)}`}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Camera className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-slate-500 uppercase tracking-wide text-[10px]">Evidence Photo</div>
              {challan.evidencePhotoUrl ? (
                <a
                  href={challan.evidencePhotoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-[11px] underline"
                >
                  View Placeholder →
                </a>
              ) : (
                <span className="text-slate-400 text-[11px]">On file (not attached)</span>
              )}
            </div>
          </div>
        </div>

        {/* Fine Amount Callout */}
        <div className="px-5 py-3 bg-rose-950/30 border-b border-rose-900/50 flex items-center justify-between">
          <span className="text-xs font-semibold text-rose-300 uppercase tracking-wider">Total Fine Amount</span>
          <span className="text-xl font-bold text-rose-400 font-mono">{formatCurrency(challan.fineAmount)}</span>
        </div>

        {/* SMS Text Payload Preview */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">SMS Gateway Payload</span>
            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                charCount > 320
                  ? 'bg-rose-950 border-rose-800 text-rose-300'
                  : 'bg-emerald-950 border-emerald-800 text-emerald-300'
              }`}>
                {charCount} chars / {smsUnits} SMS unit{smsUnits > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="relative">
            <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-[11px] text-emerald-300 font-mono leading-relaxed whitespace-pre-wrap break-words max-h-72 overflow-y-auto">
              {smsText}
            </pre>
            {/* Simulated phone frame decoration */}
            <div className="absolute top-2 right-2 text-[10px] font-mono text-slate-600 bg-slate-950 px-1">
              SMS ▸
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 py-4 border-t border-slate-800 flex items-center justify-between gap-3 mt-2">
          <div className="text-[10px] text-slate-500 max-w-[200px] leading-tight">
            Gateway: NIC / MSG91 (not configured) · Sender ID: <span className="font-mono">LTRCAM</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                copied
                  ? 'bg-emerald-900 text-emerald-300 border border-emerald-700'
                  : 'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700'
              }`}
            >
              {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Text'}</span>
            </button>

            <button
              onClick={onClose}
              className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
            >
              Close Preview
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
