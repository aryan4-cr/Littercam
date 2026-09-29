import React from 'react';
import { Scale, BookOpen, Shield, ChevronDown, ChevronUp, ExternalLink, AlertTriangle } from 'lucide-react';

/**
 * LitterCam — Legal Basis Info Panel
 * ====================================================
 * Cites the real Indian legislative framework that makes
 * automated municipal littering enforcement legally valid.
 * This is real existing law — not invented for this app.
 * ====================================================
 */

const LEGAL_REFERENCES = [
  {
    id: 'dmc',
    badge: 'Central / State Act',
    badgeColor: 'bg-blue-950 text-blue-300 border-blue-800',
    title: 'Municipal Corporation Acts',
    citation: 'Delhi Municipal Corporation Act, 1957 — § 359 (Sanitation) & State equivalents (BBMP Act, PMC Act)',
    summary: 'Municipal bodies are empowered to levy spot fines for littering and unauthorized dumping of solid waste in public spaces. Fines are enforceable by designated enforcement officers.',
    relevance: 'Authorises all vehicle and pedestrian fines issued through this system.',
    fineNote: '₹500 precedent for vehicle littering aligns with Delhi MCD Act enforcement practice.',
  },
  {
    id: 'swm',
    badge: 'Central Rule',
    badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-800',
    title: 'Solid Waste Management Rules, 2016',
    citation: 'Ministry of Environment, Forest and Climate Change (MoEFCC) — SWM Rules 2016, Rule 16 & 22',
    summary: 'Rule 16 prohibits littering, open burning, and mixing of waste streams. Rule 22 mandates that "waste generators shall not litter or throw or burn solid waste on streets, open public spaces outside, inter-city roads or highways." Violations attract spot fines.',
    relevance: 'National framework authorising spot fines for open dumping and littering events detected by this system.',
    fineNote: 'Spot fine range ₹250–500 per violation is directly within SWM Rule 22 enforcement norms.',
  },
  {
    id: 'mva',
    badge: 'Central Act',
    badgeColor: 'bg-amber-950 text-amber-300 border-amber-800',
    title: 'Motor Vehicles Act, 1988',
    citation: 'Motor Vehicles Act, 1988 — § 177 (General Offences), as amended by Motor Vehicles (Amendment) Act, 2019',
    summary: 'Enables enforcement of traffic-adjacent offences by vehicle (including waste disposal from moving vehicles) via registered owner lookup through government vehicle registry databases such as VAHAN (MoRTH). Automatic Number Plate Recognition (ANPR) challan issuance is already legally operative on Indian roads under this framework.',
    relevance: 'Authorises ANPR-based vehicle identification and automated challan generation to registered owners.',
    fineNote: 'ANPR-issued challans are already in operational use by multiple state traffic police departments (e.g., Delhi Traffic Police, Maharashtra, Karnataka).',
  },
  {
    id: 'dpdp',
    badge: 'Privacy Law',
    badgeColor: 'bg-rose-950 text-rose-300 border-rose-800',
    title: 'Digital Personal Data Protection Act, 2023 (DPDP)',
    citation: 'DPDP Act, 2023 — § 4 (Lawful Processing), § 7 (Consent), § 17 (Special Provisions)',
    summary: 'The DPDP Act constrains automated biometric-to-identity matching without explicit consent and defined lawful purpose. Facial recognition linked directly to government identity databases (Aadhaar, CCTNS) requires specific sovereign exemption. This system deliberately does NOT implement any automatic face-to-identity matching for pedestrian violations.',
    relevance: 'Explains the deliberate design decision: pedestrian violations require manual officer review before any fine is issued.',
    fineNote: null,
    isComplianceNote: true,
  },
];

export default function LegalBasisPanel({ collapsed = true }) {
  const [isOpen, setIsOpen] = React.useState(!collapsed);

  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-900">
      {/* Header Toggle */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/60 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-blue-950 text-blue-400 rounded-lg border border-blue-800">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-200">Legal Basis & Compliance Framework</span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Indian legislative authority for automated municipal enforcement · Click to {isOpen ? 'collapse' : 'expand'}
            </p>
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        )}
      </button>

      {/* Expandable Body */}
      {isOpen && (
        <div className="border-t border-slate-800 divide-y divide-slate-800/60">
          {LEGAL_REFERENCES.map((ref) => (
            <div key={ref.id} className={`px-5 py-4 ${ref.isComplianceNote ? 'bg-rose-950/10' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {ref.isComplianceNote ? (
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  ) : (
                    <BookOpen className="w-4 h-4 text-slate-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h4 className="text-sm font-bold text-slate-200">{ref.title}</h4>
                    <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${ref.badgeColor}`}>
                      {ref.badge}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-slate-400 mb-2 leading-relaxed">{ref.citation}</p>
                  <p className="text-xs text-slate-300 leading-relaxed mb-2">{ref.summary}</p>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-start gap-2 text-[11px]">
                      <Shield className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <span className="text-emerald-300 font-medium">{ref.relevance}</span>
                    </div>
                    {ref.fineNote && (
                      <div className="text-[11px] text-slate-400 pl-5">{ref.fineNote}</div>
                    )}
                    {ref.isComplianceNote && (
                      <div className="mt-1 bg-rose-950/40 border border-rose-900/60 rounded p-2 text-[11px] text-rose-300 font-semibold">
                        ⚠ This system deliberately omits automatic face-to-identity matching. All pedestrian violations require manual officer review before any enforcement action is taken.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Footer */}
          <div className="px-5 py-3 bg-slate-950/40 text-[11px] text-slate-500 flex items-center gap-2">
            <Scale className="w-3.5 h-3.5 shrink-0" />
            <span>Legal references are accurate as of 2024. Consult a licensed legal practitioner before operational deployment.</span>
          </div>
        </div>
      )}
    </div>
  );
}
