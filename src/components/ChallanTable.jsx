import React, { useState } from 'react';
import { Receipt, MessageSquare, ExternalLink, ChevronUp, ChevronDown, CheckCircle2 } from 'lucide-react';
import SMSPreviewModal from './SMSPreviewModal';

/**
 * SortIQ Enforce — Challan Register Table
 * ====================================================
 * SIMULATED DATA — PROTOTYPE ONLY
 * Reusable table for all issued challans.
 * ====================================================
 *
 * @param {object} props
 * @param {Array} props.challans - Array of challan objects
 * @param {string} props.title - Optional section title override
 */
export default function ChallanTable({ challans = [], title = 'Challan Register' }) {
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [selectedChallan, setSelectedChallan] = useState(null);

  const STATUS_STYLES = {
    ISSUED:   'bg-blue-950 text-blue-300 border-blue-800',
    PAID:     'bg-emerald-950 text-emerald-300 border-emerald-800',
    OVERDUE:  'bg-rose-950 text-rose-300 border-rose-800',
    APPEALED: 'bg-purple-950 text-purple-300 border-purple-800',
    PENDING_PAYMENT: 'bg-amber-950 text-amber-300 border-amber-800',
    DISMISSED: 'bg-slate-800 text-slate-400 border-slate-700',
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const sorted = [...challans].sort((a, b) => {
    let av = a[sortField] ?? '';
    let bv = b[sortField] ?? '';
    // Handle Firestore Timestamp objects
    if (av?.toDate) av = av.toDate().getTime();
    if (bv?.toDate) bv = bv.toDate().getTime();
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 text-slate-600 inline ml-1" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-blue-400 inline ml-1" />
      : <ChevronDown className="w-3 h-3 text-blue-400 inline ml-1" />;
  };

  const formatDate = (val) => {
    if (!val) return '—';
    const d = val?.toDate ? val.toDate() : new Date(val);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handlePreviewSMS = (challan) => {
    setSelectedChallan({
      ...challan,
      offenceType: challan.offenceType || challan.type || challan.subType,
      timestamp: challan.createdAt || challan.timestamp,
    });
    setSmsModalOpen(true);
  };

  if (challans.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
        <Receipt className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-400">No Challans Issued Yet</p>
        <p className="text-xs text-slate-500 mt-1">Run a detection or approve a pedestrian violation to generate the first challan.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Receipt className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-200">{title}</h3>
              <p className="text-[11px] text-slate-500">{challans.length} records · SIMULATED DATA</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-rose-400 font-mono">
              ₹{challans.reduce((sum, c) => sum + (c.fineAmount || 0), 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-slate-500">Total Fines</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="text-left px-4 py-3 cursor-pointer hover:text-slate-300" onClick={() => handleSort('id')}>
                  Challan ID <SortIcon field="id" />
                </th>
                <th className="text-left px-4 py-3 cursor-pointer hover:text-slate-300" onClick={() => handleSort('offenderName')}>
                  Offender <SortIcon field="offenderName" />
                </th>
                <th className="text-left px-4 py-3">Vehicle / Case</th>
                <th className="text-left px-4 py-3 cursor-pointer hover:text-slate-300" onClick={() => handleSort('fineAmount')}>
                  Fine <SortIcon field="fineAmount" />
                </th>
                <th className="text-left px-4 py-3 cursor-pointer hover:text-slate-300" onClick={() => handleSort('createdAt')}>
                  Date <SortIcon field="createdAt" />
                </th>
                <th className="text-left px-4 py-3 cursor-pointer hover:text-slate-300" onClick={() => handleSort('status')}>
                  Status <SortIcon field="status" />
                </th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sorted.map((c, idx) => (
                <tr key={c.id || idx} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-300 text-[11px]">{c.id}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-200 truncate max-w-[160px]">{c.offenderName}</div>
                    <div className="text-slate-500 text-[10px] truncate max-w-[160px]">{c.locationAddress}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300">
                    {c.vehicleNumber || c.caseId || '—'}
                  </td>
                  <td className="px-4 py-3 font-bold font-mono text-rose-400">₹{(c.fineAmount || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-slate-400">{formatDate(c.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-mono font-semibold uppercase ${STATUS_STYLES[c.status] || STATUS_STYLES.ISSUED}`}>
                      {(c.status || 'ISSUED').replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handlePreviewSMS(c)}
                      className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 bg-blue-950/40 hover:bg-blue-950/70 border border-blue-900/60 px-2 py-1 rounded transition-colors font-semibold whitespace-nowrap"
                    >
                      <MessageSquare className="w-3 h-3" />
                      SMS
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <SMSPreviewModal
        isOpen={smsModalOpen}
        onClose={() => setSmsModalOpen(false)}
        challan={selectedChallan}
      />
    </>
  );
}
