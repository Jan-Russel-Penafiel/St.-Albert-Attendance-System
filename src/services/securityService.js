import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  serverTimestamp,
  limit
} from 'firebase/firestore';
import { db } from '../firebase/config';

class SecurityService {
  constructor() {
    this.auditCollection = collection(db, 'audit_logs');
    this.rolesCollection = collection(db, 'user_roles');
    this.securityCollection = collection(db, 'security_events');
    this.sessionsCollection = collection(db, 'user_sessions');
    // Flags to prevent repeated warnings
    this.permissionWarningLogged = false;
    this.indexBuildingWarningLogged = false;
  }

  /**
   * Role-based access control
   */
  async getUserRole(userId) {
    try {
      // First, try to get role from user document (primary source of truth)
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role) {
          // Return role in SecurityService format
          return {
            role: userData.role,
            permissions: this.getDefaultPermissions(userData.role),
            lastUpdated: userData.updatedAt || userData.createdAt,
            isActive: true
          };
        }
      }
      
      // Fallback to user_roles collection
      const userRoleRef = doc(this.rolesCollection, userId);
      const roleDoc = await getDoc(userRoleRef);
      
      if (roleDoc.exists()) {
        return {
          role: roleDoc.data().role || 'student',
          permissions: roleDoc.data().permissions || [],
          lastUpdated: roleDoc.data().lastUpdated,
          isActive: roleDoc.data().isActive !== false
        };
      }
      
      // Default role for new users
      const defaultRole = {
        role: 'student',
        permissions: ['view_own_attendance', 'scan_barcode'],
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        isActive: true
      };
      
      await setDoc(userRoleRef, defaultRole);
      return defaultRole;
    } catch (error) {
      // Handle permission errors gracefully
      if (error.code === 'permission-denied' || error.message?.includes('permissions')) {
        // Only log once per session to reduce console noise
        if (!this.permissionWarningLogged) {
          console.warn('SecurityService: Permission denied for security roles collection. Fallback completed successfully.');
          this.permissionWarningLogged = true;
        }
        return {
          role: 'student',
          permissions: ['view_own_attendance', 'scan_barcode'],
          isActive: true
        };
      }
      
      // Log other errors normally
      console.error('Error getting user role:', error);
      throw new Error('Failed to retrieve user role');
    }
  }

  async updateUserRole(userId, newRole, updatedBy, permissions = null) {
    try {
      // Validate role
      const validRoles = ['admin', 'instructor', 'student', 'viewer'];
      if (!validRoles.includes(newRole)) {
        throw new Error(`Invalid role: ${newRole}`);
      }

      // Get current role for audit
      const currentRole = await this.getUserRole(userId);
      
      // Define default permissions for each role
      const rolePermissions = permissions || this.getDefaultPermissions(newRole);
      
      const userRoleRef = doc(this.rolesCollection, userId);
      const updateData = {
        role: newRole,
        permissions: rolePermissions,
        lastUpdated: serverTimestamp(),
        updatedBy: updatedBy
      };

      await updateDoc(userRoleRef, updateData);

      // Log the role change
      await this.logSecurityEvent({
        type: 'ROLE_CHANGE',
        userId: userId,
        oldRole: currentRole.role,
        newRole: newRole,
        changedBy: updatedBy,
        timestamp: new Date(),
        details: {
          previousPermissions: currentRole.permissions,
          newPermissions: rolePermissions
        }
      });

      return { success: true, role: newRole, permissions: rolePermissions };
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  }

  getDefaultPermissions(role) {
    const permissions = {
      admin: [
        'view_all_attendance',
        'manage_attendance',
        'bulk_operations',
        'user_management',
        'system_settings',
        'audit_logs',
        'view_security_dashboard',
        'export_data',
        'import_data'
      ],
      instructor: [
        'view_class_attendance',
        'manage_class_attendance',
        'export_class_data',
        'scan_barcode'
      ],
      student: [
        'view_own_attendance',
        'scan_barcode'
      ],
      viewer: [
        'view_reports'
      ]
    };

    return permissions[role] || permissions.student;
  }

  async hasPermission(userId, permission) {
    try {
      const userRole = await this.getUserRole(userId);
      
      if (!userRole.isActive) {
        return false;
      }
      
      return userRole.permissions.includes(permission) || userRole.role === 'admin';
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  async requirePermission(userId, permission, operation = 'access') {
    const hasAccess = await this.hasPermission(userId, permission);
    
    if (!hasAccess) {
      // Log unauthorized access attempt
      await this.logSecurityEvent({
        type: 'UNAUTHORIZED_ACCESS',
        userId: userId,
        operation: operation,
        permission: permission,
        timestamp: new Date(),
        blocked: true
      });
      
      throw new Error(`Access denied. Required permission: ${permission}`);
    }
    
    // Log authorized access
    await this.logSecurityEvent({
      type: 'AUTHORIZED_ACCESS',
      userId: userId,
      operation: operation,
      permission: permission,
      timestamp: new Date(),
      allowed: true
    });
    
    return true;
  }

  /**
   * Audit logging system
   */
  async logAuditEvent(eventType, userId, details = {}) {
    try {
      const auditEntry = {
        eventType: eventType,
        userId: userId,
        timestamp: serverTimestamp(),
        details: details,
        sessionId: this.getCurrentSessionId(),
        ipAddress: await this.getCurrentIPAddress(),
        userAgent: navigator.userAgent,
        createdAt: new Date().toISOString()
      };

      await addDoc(this.auditCollection, auditEntry);
      return true;
    } catch (error) {
      console.warn('Could not log audit event (this is expected if security collections are not configured):', error.code);
      // Don't throw error for audit logging failures - just log and continue
      return false;
    }
  }

  async logAttendanceAction(action, userId, attendanceData, result = 'success') {
    return this.logAuditEvent('ATTENDANCE_ACTION', userId, {
      action: action,
      attendanceData: attendanceData,
      result: result,
      timestamp: new Date()
    });
  }

  async logDataExport(userId, exportType, filters = {}) {
    return this.logAuditEvent('DATA_EXPORT', userId, {
      exportType: exportType,
      filters: filters,
      timestamp: new Date()
    });
  }

  async logBulkOperation(userId, operation, recordCount, result) {
    return this.logAuditEvent('BULK_OPERATION', userId, {
      operation: operation,
      recordCount: recordCount,
      result: result,
      timestamp: new Date()
    });
  }

  async getAuditLogs(options = {}) {
    try {
      const {
        userId = null,
        eventType = null,
        startDate = null,
        endDate = null,
        limit: queryLimit = 100
      } = options;

      let auditQuery = query(this.auditCollection, orderBy('timestamp', 'desc'));

      if (userId) {
        auditQuery = query(auditQuery, where('userId', '==', userId));
      }

      if (eventType) {
        auditQuery = query(auditQuery, where('eventType', '==', eventType));
      }

      if (queryLimit) {
        auditQuery = query(auditQuery, limit(queryLimit));
      }

      const snapshot = await getDocs(auditQuery);
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(doc.data().createdAt)
      }));

      // Apply client-side date filtering if needed
      if (startDate || endDate) {
        return logs.filter(log => {
          const logDate = log.timestamp;
          if (startDate && logDate < startDate) return false;
          if (endDate && logDate > endDate) return false;
          return true;
        });
      }

      return logs;
    } catch (error) {
      console.error('Error getting audit logs:', error);
      throw error;
    }
  }

  /**
   * Security event logging
   */
  async logSecurityEvent(eventData) {
    try {
      const securityEvent = {
        ...eventData,
        timestamp: serverTimestamp(),
        sessionId: this.getCurrentSessionId(),
        ipAddress: await this.getCurrentIPAddress(),
        createdAt: new Date().toISOString()
      };

      await addDoc(this.securityCollection, securityEvent);
      return true;
    } catch (error) {
      console.warn('Could not log security event (this is expected if security collections are not configured):', error.code);
      // Don't throw error for security logging failures - just log and continue
      return false;
    }
  }

  async getSecurityEvents(options = {}) {
    try {
      const {
        userId = null,
        eventType = null,
        limit: queryLimit = 50
      } = options;

      let securityQuery = query(this.securityCollection, orderBy('timestamp', 'desc'));

      if (userId) {
        securityQuery = query(securityQuery, where('userId', '==', userId));
      }

      if (eventType) {
        securityQuery = query(securityQuery, where('type', '==', eventType));
      }

      if (queryLimit) {
        securityQuery = query(securityQuery, limit(queryLimit));
      }

      const snapshot = await getDocs(securityQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(doc.data().createdAt)
      }));
    } catch (error) {
      console.error('Error getting security events:', error);
      
      // Handle different types of Firebase errors gracefully
      if (error.code === 'permission-denied' || error.message.includes('permission')) {
        console.warn('Security events access denied, returning empty results');
        return [];
      }
      
      // Handle index building errors
      if (error.message.includes('requires an index') || error.message.includes('index is building')) {
        if (!this.indexBuildingWarningLogged) {
          console.warn('Firebase index is building for security events, returning empty results temporarily');
          this.indexBuildingWarningLogged = true;
        }
        return [];
      }
      
      return [];
    }
  }

  /**
   * Fraud prevention and detection
   */
  async detectSuspiciousActivity(userId, action, context = {}) {
    try {
      // Check for rapid-fire attendance submissions
      if (action === 'ATTENDANCE_SCAN') {
        const recentScans = await this.getRecentAttendanceScans(userId, 5); // Last 5 minutes
        
        if (recentScans.length > 10) {
          await this.logSecurityEvent({
            type: 'SUSPICIOUS_ACTIVITY',
            subType: 'RAPID_SCANNING',
            userId: userId,
            details: {
              scanCount: recentScans.length,
              timeframe: '5 minutes'
            },
            severity: 'high'
          });
          return { suspicious: true, reason: 'Too many scans in short time' };
        }
      }

      // Check for duplicate barcode usage
      if (action === 'ATTENDANCE_SCAN' && context.barcodeId) {
        const duplicateUsage = await this.checkBarcodeReuse(context.barcodeId, userId);
        
        if (duplicateUsage.isDuplicate) {
          await this.logSecurityEvent({
            type: 'SUSPICIOUS_ACTIVITY',
            subType: 'BARCODE_REUSE',
            userId: userId,
            details: {
              barcodeId: context.barcodeId,
              originalUser: duplicateUsage.originalUser,
              timeGap: duplicateUsage.timeGap
            },
            severity: 'critical'
          });
          return { suspicious: true, reason: 'Barcode already used by another user' };
        }
      }

      // Check for unusual login patterns
      if (action === 'LOGIN') {
        const loginPattern = await this.analyzeLoginPattern(userId);
        
        if (loginPattern.unusual) {
          await this.logSecurityEvent({
            type: 'SUSPICIOUS_ACTIVITY',
            subType: 'UNUSUAL_LOGIN',
            userId: userId,
            details: loginPattern.details,
            severity: 'medium'
          });
        }
      }

      return { suspicious: false };
    } catch (error) {
      console.error('Error detecting suspicious activity:', error);
      return { suspicious: false, error: error.message };
    }
  }

  async getRecentAttendanceScans(userId, minutesBack = 5) {
    try {
      const cutoffTime = new Date();
      cutoffTime.setMinutes(cutoffTime.getMinutes() - minutesBack);

      const auditQuery = query(
        this.auditCollection,
        where('userId', '==', userId),
        where('eventType', '==', 'ATTENDANCE_ACTION'),
        where('timestamp', '>=', cutoffTime),
        orderBy('timestamp', 'desc')
      );

      const snapshot = await getDocs(auditQuery);
      return snapshot.docs.map(doc => doc.data());
    } catch (error) {
      console.error('Error getting recent scans:', error);
      return [];
    }
  }

  async checkBarcodeReuse(barcodeId, currentUserId) {
    try {
      // Check if this barcode belongs to the current user
      const userQuery = query(
        collection(db, 'users'),
        where('barcodeId', '==', barcodeId)
      );

      const userSnapshot = await getDocs(userQuery);
      
      if (userSnapshot.empty) {
        return { isDuplicate: false };
      }

      const barcodeOwner = userSnapshot.docs[0];
      const ownerData = barcodeOwner.data();

      if (barcodeOwner.id !== currentUserId) {
        return {
          isDuplicate: true,
          originalUser: barcodeOwner.id,
          originalUserEmail: ownerData.email,
          timeGap: null
        };
      }

      return { isDuplicate: false };
    } catch (error) {
      console.error('Error checking barcode reuse:', error);
      return { isDuplicate: false, error: error.message };
    }
  }

  async analyzeLoginPattern(userId) {
    // Simplified login pattern analysis
    try {
      const recentLogins = await this.getSecurityEvents({
        userId: userId,
        eventType: 'LOGIN',
        limit: 10
      });

      // Check for multiple locations
      const locations = new Set(recentLogins.map(login => login.ipAddress));
      if (locations.size > 3) {
        return {
          unusual: true,
          details: {
            reason: 'Multiple IP addresses',
            locationCount: locations.size,
            ips: Array.from(locations)
          }
        };
      }

      // Check for unusual hours
      const currentHour = new Date().getHours();
      if (currentHour < 6 || currentHour > 22) {
        return {
          unusual: true,
          details: {
            reason: 'Login at unusual hour',
            hour: currentHour
          }
        };
      }

      return { unusual: false };
    } catch (error) {
      console.error('Error analyzing login pattern:', error);
      // Return safe default instead of throwing
      return { unusual: false, error: 'Analysis failed due to permissions' };
    }
  }

  /**
   * Session management
   */
  async createUserSession(userId, loginData = {}) {
    try {
      const sessionData = {
        userId: userId,
        startTime: serverTimestamp(),
        ipAddress: await this.getCurrentIPAddress(),
        userAgent: navigator.userAgent,
        isActive: true,
        lastActivity: serverTimestamp(),
        loginMethod: loginData.method || 'email',
        createdAt: new Date().toISOString()
      };

      const sessionRef = await addDoc(this.sessionsCollection, sessionData);
      
      // Store session ID locally
      localStorage.setItem('sessionId', sessionRef.id);
      
      await this.logSecurityEvent({
        type: 'SESSION_START',
        userId: userId,
        sessionId: sessionRef.id,
        details: loginData
      });

      return sessionRef.id;
    } catch (error) {
      console.warn('Could not create user session (security features may be limited):', error.code);
      // Generate a temporary session ID for basic functionality
      const tempSessionId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('sessionId', tempSessionId);
      return tempSessionId;
    }
  }

  async updateSessionActivity(sessionId) {
    try {
      if (!sessionId || sessionId.startsWith('temp_')) return false;

      const sessionRef = doc(this.sessionsCollection, sessionId);
      await updateDoc(sessionRef, {
        lastActivity: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.warn('Could not update session activity:', error.code);
      return false;
    }
  }

  async endUserSession(sessionId, userId) {
    try {
      if (!sessionId) return false;

      // Only try to update if it's not a temporary session
      if (!sessionId.startsWith('temp_')) {
        const sessionRef = doc(this.sessionsCollection, sessionId);
        await updateDoc(sessionRef, {
          endTime: serverTimestamp(),
          isActive: false
        });

        await this.logSecurityEvent({
          type: 'SESSION_END',
          userId: userId,
          sessionId: sessionId
        });
      }

      localStorage.removeItem('sessionId');
      return true;
    } catch (error) {
      console.warn('Could not end user session:', error.code);
      // Still remove from localStorage even if Firestore update fails
      localStorage.removeItem('sessionId');
      return false;
    }
  }

  /**
   * Utility methods
   */
  getCurrentSessionId() {
    return localStorage.getItem('sessionId') || 'unknown';
  }

  async getCurrentIPAddress() {
    try {
      // In production, you might want to use a more reliable IP detection service
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Security policy enforcement
   */
  async enforceSecurityPolicies(userId, operation, data = {}) {
    try {
      // Check if user account is active
      const userRole = await this.getUserRole(userId);
      if (!userRole.isActive) {
        throw new Error('Account is deactivated');
      }

      // Check rate limiting
      const rateLimitCheck = await this.checkRateLimit(userId, operation);
      if (rateLimitCheck.exceeded) {
        await this.logSecurityEvent({
          type: 'RATE_LIMIT_EXCEEDED',
          userId: userId,
          operation: operation,
          limit: rateLimitCheck.limit,
          current: rateLimitCheck.current
        });
        throw new Error(`Rate limit exceeded for ${operation}`);
      }

      // Check suspicious activity
      const suspiciousCheck = await this.detectSuspiciousActivity(userId, operation, data);
      if (suspiciousCheck.suspicious) {
        throw new Error(`Suspicious activity detected: ${suspiciousCheck.reason}`);
      }

      return true;
    } catch (error) {
      console.error('Security policy enforcement failed:', error);
      throw error;
    }
  }

  async checkRateLimit(userId, operation) {
    // Simple rate limiting implementation
    const limits = {
      'ATTENDANCE_SCAN': { count: 50, window: 60 * 60 * 1000 }, // 50 per hour
      'DATA_EXPORT': { count: 10, window: 60 * 60 * 1000 }, // 10 per hour
      'BULK_OPERATION': { count: 5, window: 60 * 60 * 1000 } // 5 per hour
    };

    const limit = limits[operation];
    if (!limit) return { exceeded: false };

    try {
      const windowStart = new Date(Date.now() - limit.window);
      
      const recentActions = await this.getAuditLogs({
        userId: userId,
        startDate: windowStart,
        limit: limit.count + 1
      });

      const operationCount = recentActions.filter(log => 
        log.details && log.details.action === operation
      ).length;

      return {
        exceeded: operationCount >= limit.count,
        current: operationCount,
        limit: limit.count,
        windowMinutes: limit.window / (60 * 1000)
      };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return { exceeded: false };
    }
  }
}

export default new SecurityService();