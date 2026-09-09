/**
 * SortIQ Enforce — Mock VAHAN Lookup Service
 * ====================================================
 * SIMULATED SERVICE — FOR PROTOTYPE USE ONLY
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';
import { SEED_VAHAN_RECORDS, SEED_VIOLATIONS } from '../data/seedData';

// Normalise plate numbers: uppercase, strip spaces, hyphens
export function normalisePlate(plate) {
  if (!plate) return '';
  return plate.toUpperCase().replace(/[\s\-]/g, '');
}

/**
 * Look up a vehicle registration plate number.
 * Priority:
 *   1. Firestore (when Firebase is connected)
 *   2. Local seed data fallback (for offline / demo mode)
 *
 * @param {string} plateNumber - e.g. "MH12AB1234" or "MH 12 AB 1234"
 * @returns {Promise<{found: boolean, data?: object, source: string, error?: string, plateSearched?: string}>}
 */
export async function vahanLookup(plateNumber) {
  if (!plateNumber?.trim()) {
    return { found: false, source: 'INPUT_ERROR', error: 'No plate number provided.' };
  }

  const normalisedPlate = normalisePlate(plateNumber);

  // ── 1. Try Firestore first ─────────────────────────────────────────────────
  try {
    const ref = doc(db, COLLECTIONS.VAHAN_RECORDS, `vahan-${normalisedPlate}`);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return {
        found: true,
        data: { ...snap.data(), vehicleNumber: normalisedPlate },
        source: 'FIRESTORE',
      };
    }

    const vahanRef = doc(db, COLLECTIONS.VAHAN_RECORDS, findSeedIdByPlate(normalisedPlate));
    const vahanSnap = await getDoc(vahanRef);
    if (vahanSnap.exists()) {
      return {
        found: true,
        data: { id: vahanSnap.id, ...vahanSnap.data() },
        source: 'FIRESTORE',
      };
    }
  } catch (err) {
    console.info('[VAHAN] Firestore unavailable, falling back to local seed data:', err.message);
  }

  // ── 2. Local seed data fallback ────────────────────────────────────────────
  const match = SEED_VAHAN_RECORDS.find(
    r => normalisePlate(r.vehicleNumber) === normalisedPlate
  );

  if (match) {
    return {
      found: true,
      data: match,
      source: 'LOCAL_SEED_[SIMULATED]',
    };
  }

  return {
    found: false,
    source: 'LOCAL_SEED_[SIMULATED]',
    error: `No record found for plate: ${normalisedPlate}`,
    plateSearched: normalisedPlate,
  };
}

// Internal helper: find a seed ID from a normalised plate
function findSeedIdByPlate(normalisedPlate) {
  const match = SEED_VAHAN_RECORDS.find(
    r => normalisePlate(r.vehicleNumber) === normalisedPlate
  );
  return match?.id || 'not-found';
}

/**
 * Format a VAHAN lookup result into a human-readable summary string.
 */
export function formatVahanSummary(data) {
  if (!data) return 'No data';
  return [
    `Owner: ${data.ownerName}`,
    `Phone: ${data.ownerPhone}`,
    `Vehicle: ${data.vehicleMake} (${data.vehicleNumber})`,
    `Class: ${data.vehicleClass}`,
    `RTO: ${data.registeredRTO}`,
    `Status: ${data.status}`,
  ].join('\n');
}

/**
 * Get violation history for a given vehicle plate or offender name.
 * Searches the simulated SEED_VIOLATIONS.
 */
export function getViolationHistory(ownerIdentifier) {
  if (!ownerIdentifier) return [];
  const normalizedId = normalisePlate(ownerIdentifier);
  
  return SEED_VIOLATIONS.filter(v => {
    if (v.vehicleNumber && normalisePlate(v.vehicleNumber) === normalizedId) {
      return true;
    }
    if (v.offenderName && v.offenderName.toUpperCase() === ownerIdentifier.toUpperCase()) {
      return true;
    }
    return false;
  });
}
