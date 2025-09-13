import { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import SecurityService from '../services/securityService';

const AuthContext = createContext({});

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    console.warn('useAuth must be used within an AuthProvider');
    return {}; // Return empty object instead of throwing
  }
  return context;
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function signup(studentData, email, password) {
    try {
      console.log("Creating user account with email:", email);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log("User account created, now creating Firestore document with barcode ID:", studentData.barcodeId);
      
      // Create user document in Firestore
      const userData = {
        firstName: studentData.firstName,
        lastName: studentData.lastName,
        fullName: `${studentData.firstName} ${studentData.lastName}`,
        department: studentData.department,
        academicYear: studentData.academicYear,
        barcodeId: studentData.barcodeId,
        email,
        role: (email === "admin@gmail.com" && password === "admin") ? "admin" : "student",
        createdAt: new Date(),
        isActive: true
      };
      
      console.log("User data to save:", userData);
      
      await setDoc(doc(db, "users", userCredential.user.uid), userData);
      console.log("User document created successfully");
      
      return userCredential;
    } catch (error) {
      console.error("Error in signup:", error);
      throw error;
    }
  }

    async function login(email, password) {
    try {
      console.log("Attempting login for:", email);
      
      // Check for suspicious activity before login
      try {
        await SecurityService.detectSuspiciousActivity('unknown', 'LOGIN', { 
          email: email, 
          timestamp: new Date() 
        });
      } catch (securityError) {
        console.warn("Security check warning:", securityError.message);
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Create security session
      try {
        await SecurityService.createUserSession(userCredential.user.uid, {
          method: 'email',
          email: email,
          timestamp: new Date()
        });
      } catch (sessionError) {
        console.warn("Failed to create security session:", sessionError.message);
      }

      // Log successful login
      await SecurityService.logAuditEvent('USER_LOGIN', userCredential.user.uid, {
        email: email,
        timestamp: new Date(),
        success: true
      });
      
      // Special handling for admin user to ensure they have admin role
      const userRef = doc(db, "users", userCredential.user.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        
        // If user has email admin@gmail.com and password is admin, ensure they have admin role
        if (email === "admin@gmail.com" && password === "admin" && userData.role !== "admin") {
          await updateDoc(userRef, {
            role: "admin"
          });
          
          // Update security role
          await SecurityService.updateUserRole(
            userCredential.user.uid, 
            'admin', 
            'system_auto_promotion'
          );
          
          console.log("User promoted to admin automatically");
        }
      }
      
      return userCredential;
    } catch (error) {
      console.error("Error in login:", error);
      
      // Log failed login attempt
      try {
        await SecurityService.logSecurityEvent({
          type: 'LOGIN_FAILED',
          email: email,
          error: error.code || error.message,
          timestamp: new Date()
        });
      } catch (logError) {
        console.warn("Failed to log security event:", logError.message);
      }
      
      throw error;
    }
  }

  async function logout() {
    try {
      if (currentUser) {
        // End security session
        const sessionId = SecurityService.getCurrentSessionId();
        await SecurityService.endUserSession(sessionId, currentUser.uid);
        
        // Log logout event
        await SecurityService.logAuditEvent('USER_LOGOUT', currentUser.uid, {
          timestamp: new Date(),
          sessionId: sessionId
        });
      }
      
      return await signOut(auth);
    } catch (error) {
      console.error("Error in logout:", error);
      // Still attempt to sign out even if security logging fails
      return await signOut(auth);
    }
  }

  async function getUserRole() {
    if (!currentUser) return null;
    
    try {
      // First, try to get role from user document (primary source of truth)
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.role) {
          return userData.role;
        }
      }
      
      // Fallback to SecurityService for role management
      const roleData = await SecurityService.getUserRole(currentUser.uid);
      return roleData.role;
    } catch (error) {
      console.warn("Role detection failed, defaulting to student", error);
      
      // Final fallback
      return 'student';
    }
  }

  async function hasPermission(permission) {
    if (!currentUser) return false;
    
    try {
      return await SecurityService.hasPermission(currentUser.uid, permission);
    } catch (error) {
      console.error("Error checking permission:", error);
      return false;
    }
  }

  async function requirePermission(permission, operation = 'access') {
    if (!currentUser) throw new Error('Not authenticated');
    
    return await SecurityService.requirePermission(currentUser.uid, permission, operation);
  }

  async function getUserData() {
    if (!currentUser) return null;
    try {
      console.log("Getting user data for:", currentUser.uid);
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        console.log("User data found:", userData);
        return userData;
      } else {
        console.log("No user data found!");
        return null;
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      throw error;
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    loading,
    signup,
    login,
    logout,
    getUserRole,
    getUserData,
    hasPermission,
    requirePermission
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
} 