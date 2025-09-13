import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  where, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  Timestamp,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Real-time Attendance Service
 * Manages live attendance data with Firebase Firestore
 */
export class AttendanceService {
  static listeners = new Map(); // Store active listeners
  static attendanceCache = new Map(); // Cache for faster lookups
  
  /**
   * Subscribe to real-time attendance updates
   * @param {Function} callback - Function to call when data updates
   * @param {Object} filters - Optional filters (date, status, etc.)
   * @returns {Function} - Unsubscribe function
   */
  static subscribeToAttendance(callback, filters = {}) {
    try {
      let attendanceQuery = collection(db, 'attendance');
      
      // Apply filters
      if (filters.date) {
        const startDate = new Date(filters.date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(filters.date);
        endDate.setHours(23, 59, 59, 999);
        
        attendanceQuery = query(
          attendanceQuery,
          where('timestamp', '>=', startDate),
          where('timestamp', '<=', endDate),
          orderBy('timestamp', 'desc')
        );
      } else {
        attendanceQuery = query(attendanceQuery, orderBy('timestamp', 'desc'));
      }
      
      if (filters.status) {
        attendanceQuery = query(attendanceQuery, where('status', '==', filters.status));
      }
      
      if (filters.barcodeId) {
        attendanceQuery = query(attendanceQuery, where('barcodeId', '==', filters.barcodeId));
      }
      
      // Create listener ID for tracking
      const listenerId = Date.now().toString();
      
      const unsubscribe = onSnapshot(
        attendanceQuery,
        (querySnapshot) => {
          console.log('Real-time attendance update received');
          const attendanceRecords = [];
          
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            const record = {
              id: doc.id,
              barcodeId: data.barcodeId || data.idNumber, // Support legacy
              studentId: data.studentId,
              timestamp: data.timestamp?.toDate() || new Date(),
              status: data.status || 'Present',
              recordedBy: data.recordedBy,
              ...data
            };
            
            attendanceRecords.push(record);
            // Update cache
            this.attendanceCache.set(doc.id, record);
          });
          
          callback(attendanceRecords);
        },
        (error) => {
          console.error('Real-time attendance subscription error:', error);
          callback(null, error);
        }
      );
      
      // Store listener for cleanup
      this.listeners.set(listenerId, unsubscribe);
      
      // Return unsubscribe function with cleanup
      return () => {
        unsubscribe();
        this.listeners.delete(listenerId);
      };
    } catch (error) {
      console.error('Error setting up attendance subscription:', error);
      callback(null, error);
      return () => {}; // Return empty unsubscribe function
    }
  }
  
  /**
   * Subscribe to attendance updates for a specific student
   * @param {string} studentId - Student's Firebase user ID
   * @param {Function} callback - Callback function
   * @returns {Function} - Unsubscribe function
   */
  static subscribeToStudentAttendance(studentId, callback) {
    try {
      // First try with composite index query
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('studentId', '==', studentId),
        orderBy('timestamp', 'desc')
      );
      
      const unsubscribe = onSnapshot(
        attendanceQuery,
        (querySnapshot) => {
          const records = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            records.push({
              id: doc.id,
              ...data,
              timestamp: data.timestamp?.toDate() || new Date()
            });
          });
          callback(records);
        },
        (error) => {
          console.error('Student attendance subscription error:', error);
          
          // If composite index missing, try fallback query
          if (error.code === 'failed-precondition' || error.message.includes('index')) {
            console.info('Composite index is building. Using fallback query with client-side sorting...');
            
            try {
              // Fallback to simple where query without orderBy
              const fallbackQuery = query(
                collection(db, 'attendance'),
                where('studentId', '==', studentId)
              );
              
              const fallbackUnsubscribe = onSnapshot(
                fallbackQuery,
                (querySnapshot) => {
                  const records = [];
                  querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    records.push({
                      id: doc.id,
                      ...data,
                      timestamp: data.timestamp?.toDate() || new Date()
                    });
                  });
                  
                  // Sort client-side since we can't use orderBy
                  records.sort((a, b) => b.timestamp - a.timestamp);
                  callback(records);
                },
                (fallbackError) => {
                  console.error('Fallback query also failed:', fallbackError);
                  callback([], fallbackError);
                }
              );
              
              return fallbackUnsubscribe;
            } catch (fallbackError) {
              console.error('Failed to setup fallback query:', fallbackError);
              callback([], fallbackError);
            }
          } else {
            callback([], error);
          }
        }
      );
      
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up student attendance subscription:', error);
      callback([], error);
      return () => {};
    }
  }
  
  /**
   * Add a new attendance record with real-time updates
   * @param {Object} attendanceData - Attendance record data
   * @returns {Promise<Object>} - Created record with ID
   */
  static async addAttendanceRecord(attendanceData) {
    try {
      const recordData = {
        ...attendanceData,
        timestamp: attendanceData.timestamp || serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      console.log('Adding attendance record:', recordData);
      
      const docRef = await addDoc(collection(db, 'attendance'), recordData);
      
      // Create local record for immediate feedback
      const localRecord = {
        id: docRef.id,
        ...recordData,
        timestamp: recordData.timestamp || new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Update cache
      this.attendanceCache.set(docRef.id, localRecord);
      
      console.log('Attendance record added successfully:', docRef.id);
      return localRecord;
    } catch (error) {
      console.error('Error adding attendance record:', error);
      throw error;
    }
  }
  
  /**
   * Update an existing attendance record
   * @param {string} recordId - Record ID to update
   * @param {Object} updateData - Data to update
   * @returns {Promise<void>}
   */
  static async updateAttendanceRecord(recordId, updateData) {
    try {
      const updatePayload = {
        ...updateData,
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(doc(db, 'attendance', recordId), updatePayload);
      
      // Update cache
      if (this.attendanceCache.has(recordId)) {
        const cachedRecord = this.attendanceCache.get(recordId);
        this.attendanceCache.set(recordId, {
          ...cachedRecord,
          ...updateData,
          updatedAt: new Date()
        });
      }
      
      console.log('Attendance record updated:', recordId);
    } catch (error) {
      console.error('Error updating attendance record:', error);
      throw error;
    }
  }
  
  /**
   * Delete an attendance record
   * @param {string} recordId - Record ID to delete
   * @returns {Promise<void>}
   */
  static async deleteAttendanceRecord(recordId) {
    try {
      await deleteDoc(doc(db, 'attendance', recordId));
      
      // Remove from cache
      this.attendanceCache.delete(recordId);
      
      console.log('Attendance record deleted:', recordId);
    } catch (error) {
      console.error('Error deleting attendance record:', error);
      throw error;
    }
  }
  
  /**
   * Bulk update attendance records
   * @param {Array} updates - Array of {id, data} objects
   * @returns {Promise<void>}
   */
  static async bulkUpdateRecords(updates) {
    try {
      const batch = writeBatch(db);
      
      updates.forEach(({ id, data }) => {
        const docRef = doc(db, 'attendance', id);
        batch.update(docRef, {
          ...data,
          updatedAt: serverTimestamp()
        });
      });
      
      await batch.commit();
      
      // Update cache
      updates.forEach(({ id, data }) => {
        if (this.attendanceCache.has(id)) {
          const cachedRecord = this.attendanceCache.get(id);
          this.attendanceCache.set(id, {
            ...cachedRecord,
            ...data,
            updatedAt: new Date()
          });
        }
      });
      
      console.log('Bulk update completed for', updates.length, 'records');
    } catch (error) {
      console.error('Error in bulk update:', error);
      throw error;
    }
  }
  
  /**
   * Check for duplicate attendance (same student, same day)
   * @param {string} barcodeId - Student barcode ID
   * @param {Date} date - Date to check (optional, defaults to today)
   * @returns {Promise<boolean>} - True if duplicate exists
   */
  static async checkDuplicateAttendance(barcodeId, date = new Date()) {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const duplicateQuery = query(
        collection(db, 'attendance'),
        where('barcodeId', '==', barcodeId),
        where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
        where('timestamp', '<=', Timestamp.fromDate(endOfDay))
      );
      
      return new Promise((resolve, reject) => {
        const unsubscribe = onSnapshot(
          duplicateQuery,
          (querySnapshot) => {
            unsubscribe(); // Unsubscribe immediately since we only need one check
            resolve(!querySnapshot.empty);
          },
          (error) => {
            unsubscribe();
            console.error('Error checking duplicate attendance:', error);
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error('Error in duplicate check:', error);
      return false; // Assume no duplicate on error
    }
  }
  
  /**
   * Get attendance statistics for a date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} - Statistics object
   */
  static async getAttendanceStats(startDate, endDate = new Date()) {
    try {
      const statsQuery = query(
        collection(db, 'attendance'),
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        where('timestamp', '<=', Timestamp.fromDate(endDate))
      );
      
      return new Promise((resolve, reject) => {
        const unsubscribe = onSnapshot(
          statsQuery,
          (querySnapshot) => {
            unsubscribe();
            
            const stats = {
              totalRecords: querySnapshot.size,
              present: 0,
              late: 0,
              absent: 0,
              excused: 0,
              uniqueStudents: new Set(),
              dailyBreakdown: {}
            };
            
            querySnapshot.forEach((doc) => {
              const data = doc.data();
              const status = data.status || 'Present';
              const date = data.timestamp?.toDate()?.toDateString() || 'Unknown';
              
              // Count by status
              const statusLower = status.toLowerCase();
              if (Object.prototype.hasOwnProperty.call(stats, statusLower)) {
                stats[statusLower]++;
              }
              
              // Track unique students
              if (data.barcodeId) {
                stats.uniqueStudents.add(data.barcodeId);
              }
              
              // Daily breakdown
              if (!stats.dailyBreakdown[date]) {
                stats.dailyBreakdown[date] = { count: 0, students: new Set() };
              }
              stats.dailyBreakdown[date].count++;
              if (data.barcodeId) {
                stats.dailyBreakdown[date].students.add(data.barcodeId);
              }
            });
            
            // Convert Sets to counts
            stats.uniqueStudents = stats.uniqueStudents.size;
            Object.keys(stats.dailyBreakdown).forEach(date => {
              stats.dailyBreakdown[date].uniqueStudents = stats.dailyBreakdown[date].students.size;
              delete stats.dailyBreakdown[date].students;
            });
            
            resolve(stats);
          },
          (error) => {
            unsubscribe();
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error('Error getting attendance stats:', error);
      throw error;
    }
  }
  
  /**
   * Clean up all active listeners
   */
  static cleanup() {
    console.log('Cleaning up attendance listeners:', this.listeners.size);
    this.listeners.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.listeners.clear();
    this.attendanceCache.clear();
  }
}

export default AttendanceService;