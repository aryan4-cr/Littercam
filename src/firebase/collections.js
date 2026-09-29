import { collection } from 'firebase/firestore';
import { db } from './config';

/**
 * Placeholder Firestore Collection References
 * Scaffolding for LitterCam data model
 */
export const COLLECTIONS = {
  REPORTS: 'reports',
  VIOLATIONS: 'violations',
  CHALLANS: 'challans',
  VAHAN_RECORDS: 'vahan_records',
  USERS: 'users',
};

// Collection references
export const reportsRef = collection(db, COLLECTIONS.REPORTS);
export const violationsRef = collection(db, COLLECTIONS.VIOLATIONS);
export const challansRef = collection(db, COLLECTIONS.CHALLANS);
export const vahanRecordsRef = collection(db, COLLECTIONS.VAHAN_RECORDS);
export const usersRef = collection(db, COLLECTIONS.USERS);

/**
 * Mock/Placeholder schema representations for documentation & scaffolding
 */
export const SCHEMAS = {
  report: {
    id: '',
    citizenId: '',
    title: '',
    category: '', // e.g. Illegal Dumping, Traffic Obstruction, Encroachment
    location: { lat: 0, lng: 0, address: '' },
    imageUrl: '',
    status: 'PENDING', // PENDING, UNDER_INVESTIGATION, RESOLVED, REJECTED
    createdAt: null,
  },
  violation: {
    id: '',
    reportId: '',
    officerId: '',
    severity: 'MEDIUM', // LOW, MEDIUM, HIGH, CRITICAL
    type: '',
    vehicleNumber: '',
    notes: '',
    createdAt: null,
  },
  challan: {
    id: '',
    violationId: '',
    amount: 0,
    dueDate: null,
    status: 'ISSUED', // ISSUED, PAID, OVERDUE, APPEALED
    issuedTo: '',
    issuedByOfficerId: '',
    createdAt: null,
  },
  vahanRecord: {
    vehicleNumber: '',
    ownerName: '',
    vehicleClass: '',
    registrationDate: '',
    chassisNumberMasked: '',
    status: 'ACTIVE',
  }
};
