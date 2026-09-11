/**
 * SortIQ Enforce — Firestore Seed Script
 * ====================================================
 * SIMULATED DATA — PROTOTYPE USE ONLY
 * Run this from the browser console or a Node.js environment
 * after configuring your Firebase credentials in .env.
 *
 * Usage: Import and call seedFirestore() from any admin page or
 *        run via the AdminDashboard "Seed Database" button.
 * ====================================================
 */

import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';
import { SEED_VAHAN_RECORDS, SEED_VIOLATIONS, SEED_REPORTS } from '../data/seedData';

/**
 * Seed all Firestore placeholder collections.
 * Uses batched writes for efficiency.
 * @returns {Promise<{success: boolean, summary: object, error?: string}>}
 */
export async function seedFirestore() {
  const summary = {
    vahanRecords: 0,
    violations: 0,
    reports: 0,
    errors: [],
  };

  // Firestore limits batches to 500 writes. Chunk large arrays.
  async function commitInBatches(records, collectionName) {
    const BATCH_LIMIT = 450; // leave some headroom
    for (let i = 0; i < records.length; i += BATCH_LIMIT) {
      const chunk = records.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);
      for (const record of chunk) {
        const { id, ...data } = record;
        const ref = doc(db, collectionName, id);
        batch.set(ref, data, { merge: true });
      }
      await batch.commit();
    }
  }

  try {
    // ── Seed VAHAN RECORDS ───────────────────────────────────────────────────
    await commitInBatches(SEED_VAHAN_RECORDS, COLLECTIONS.VAHAN_RECORDS);
    summary.vahanRecords = SEED_VAHAN_RECORDS.length;
    console.log(`[SEED] ✓ ${summary.vahanRecords} vahan_records written`);

    // ── Seed VIOLATIONS ──────────────────────────────────────────────────────
    await commitInBatches(SEED_VIOLATIONS, COLLECTIONS.VIOLATIONS);
    summary.violations = SEED_VIOLATIONS.length;
    console.log(`[SEED] ✓ ${summary.violations} violations written`);

    // ── Seed REPORTS ─────────────────────────────────────────────────────────
    await commitInBatches(SEED_REPORTS, COLLECTIONS.REPORTS);
    summary.reports = SEED_REPORTS.length;
    console.log(`[SEED] ✓ ${summary.reports} reports written`);

    console.log('[SEED] All simulated records written to Firestore successfully.', summary);
    return { success: true, summary };

  } catch (error) {
    console.error('[SEED] Firestore seed failed:', error);
    return { success: false, summary, error: error.message };
  }
}

/**
 * Clear all seeded data from all collections.
 * Removes only the known seed IDs — does not wipe the entire collection.
 */
export async function clearSeedData() {
  try {
    const allIds = {
      [COLLECTIONS.VAHAN_RECORDS]: SEED_VAHAN_RECORDS.map(r => r.id),
      [COLLECTIONS.VIOLATIONS]: SEED_VIOLATIONS.map(r => r.id),
      [COLLECTIONS.REPORTS]: SEED_REPORTS.map(r => r.id),
    };

    for (const [collectionName, ids] of Object.entries(allIds)) {
      const batch = writeBatch(db);
      for (const id of ids) {
        const ref = doc(db, collectionName, id);
        batch.delete(ref);
      }
      await batch.commit();
      console.log(`[SEED] Cleared ${ids.length} records from ${collectionName}`);
    }
  } catch (error) {
    console.error('[SEED] clearSeedData failed:', error);
  }
}
