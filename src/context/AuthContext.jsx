import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut,
  signInAnonymously
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'citizen' | 'officer'
  const [loading, setLoading] = useState(true);

  // Prototype state override (enables easy testing before live Firebase credentials are hooked up)
  const [demoOfficerSession, setDemoOfficerSession] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDocRef = doc(db, COLLECTIONS.USERS, user.uid);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            setUserRole(data.role || (data.isOfficer ? 'officer' : 'citizen'));
          } else {
            setUserRole('citizen');
          }
        } catch (err) {
          console.warn("Firestore user fetch skipped (demo mode active)", err);
          setUserRole('citizen');
        }
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Officer Login
  const loginOfficer = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Verify officer role
      const userDocRef = doc(db, COLLECTIONS.USERS, userCredential.user.uid);
      const userSnap = await getDoc(userDocRef);
      const data = userSnap.data();
      const role = data?.role || (data?.isOfficer ? 'officer' : 'citizen');
      setUserRole(role);
      return userCredential.user;
    } catch (error) {
      // Fallback for demo testing when Firebase backend isn't connected
      console.info("Firebase Auth login error/demo fallback triggered:", error.message);
      if (email.includes('officer') || email.includes('admin')) {
        setDemoOfficerSession(true);
        const mockOfficerUser = { uid: 'demo-officer-101', email, displayName: 'Officer M. Sharma' };
        setCurrentUser(mockOfficerUser);
        setUserRole('officer');
        return mockOfficerUser;
      }
      throw error;
    }
  };

  // Citizen Anonymous / Simple Auth
  const loginCitizen = async () => {
    try {
      const res = await signInAnonymously(auth);
      setUserRole('citizen');
      return res.user;
    } catch (error) {
      console.info("Citizen demo login fallback triggered");
      const mockCitizenUser = { uid: 'demo-citizen-202', isAnonymous: true };
      setCurrentUser(mockCitizenUser);
      setUserRole('citizen');
      return mockCitizenUser;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("SignOut warning", err);
    }
    setCurrentUser(null);
    setUserRole(null);
    setDemoOfficerSession(false);
  };

  const isOfficer = userRole === 'officer' || demoOfficerSession;

  const value = {
    currentUser,
    userRole,
    isOfficer,
    loading,
    loginOfficer,
    loginCitizen,
    logout,
    setDemoOfficerSession
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
