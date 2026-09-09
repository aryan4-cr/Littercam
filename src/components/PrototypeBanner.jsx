import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * PrototypeBanner Component
 * Displays persistent alert banner on admin screens indicating prototype simulation state.
 */
export default function PrototypeBanner() {
  return (
    <div className="bg-amber-500 text-slate-950 font-semibold px-4 py-1.5 text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm border-b border-amber-600">
      <AlertTriangle className="w-4 h-4 text-slate-950 shrink-0" />
      <span>SIMULATED DATA — PROTOTYPE ONLY</span>
    </div>
  );
}
