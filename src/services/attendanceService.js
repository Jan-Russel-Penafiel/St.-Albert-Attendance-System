import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Service for managing attendance records with robust duplicate prevention
 */
class AttendanceService {
  /**
   * Check if attendance already exists for a student today
   * Uses multiple fallback methods for duplicate detection
   */
  async checkDuplicateAttendance(idNumber) {
    const studentId = idNumber.toString().trim();
    
    // Get today's date range
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    
    console.log(`Checking duplicate attendance for ID: ${studentId} on ${startOfToday.toDateString()}`);
    
    try {
      // Method 1: Try composite index query (most efficient)
      const compositeQuery = query(
        collection(db, "attendance"),
        where("idNumber", "==", studentId),
        where("timestamp", ">=", Timestamp.fromDate(startOfToday)),
        where("timestamp", "<=", Timestamp.fromDate(endOfToday))
      );
      
      const compositeSnapshot = await getDocs(compositeQuery);
      if (!compositeSnapshot.empty) {
        const existingRecord = compositeSnapshot.docs[0].data();
        return {
          isDuplicate: true,
          method: 'composite_index',
          existingRecord: {
            ...existingRecord,
            timestamp: existingRecord.timestamp.toDate(),
            id: compositeSnapshot.docs[0].id
          }
        };
      }
      
      return { isDuplicate: false, method: 'composite_index' };
      
    } catch (indexError) {
      console.warn("Composite index not available, falling back to alternative methods:", indexError.message);
      
      // Method 2: Fallback - Query by idNumber only, then filter by date
      try {
        const fallbackQuery = query(
          collection(db, "attendance"),
          where("idNumber", "==", studentId),
          orderBy("timestamp", "desc"),
          limit(10) // Limit to recent records for performance
        );
        
        const fallbackSnapshot = await getDocs(fallbackQuery);
        
        for (const doc of fallbackSnapshot.docs) {
          const data = doc.data();
          const recordDate = data.timestamp.toDate();
          
          // Check if this record is from today
          if (this.isSameDay(recordDate, today)) {
            return {
              isDuplicate: true,
              method: 'fallback_filter',
              existingRecord: {
                ...data,
                timestamp: recordDate,
                id: doc.id
              }
            };
          }
        }
        
        return { isDuplicate: false, method: 'fallback_filter' };
        
      } catch (fallbackError) {
        console.warn("Fallback method failed, using memory cache method:", fallbackError.message);
        
        // Method 3: Last resort - Get all records for this student and filter locally
        try {
          const allRecordsQuery = query(
            collection(db, "attendance"),
            where("idNumber", "==", studentId)
          );
          
          const allRecordsSnapshot = await getDocs(allRecordsQuery);
          
          for (const doc of allRecordsSnapshot.docs) {
            const data = doc.data();
            const recordDate = data.timestamp.toDate();
            
            if (this.isSameDay(recordDate, today)) {
              return {
                isDuplicate: true,
                method: 'local_filter',
                existingRecord: {
                  ...data,
                  timestamp: recordDate,
                  id: doc.id
                }
              };
            }
          }
          
          return { isDuplicate: false, method: 'local_filter' };
          
        } catch (finalError) {
          console.error("All duplicate check methods failed:", finalError);
          // Return false but with error flag to show warning
          return { 
            isDuplicate: false, 
            method: 'failed',
            error: finalError.message 
          };
        }
      }
    }
  }
  
  /**
   * Helper function to check if two dates are the same day
   */
  isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }
  
  /**
   * Record attendance with comprehensive duplicate prevention
   */
  async recordAttendance(idNumber, recordedBy = 'unknown', additionalData = {}) {
    const studentId = idNumber.toString().trim();
    
    if (!studentId) {
      throw new Error('Invalid ID number provided');
    }
    
    console.log(`Recording attendance for ID: ${studentId}`);
    
    // Check for duplicates
    const duplicateCheck = await this.checkDuplicateAttendance(studentId);
    
    if (duplicateCheck.isDuplicate) {
      const existingTime = duplicateCheck.existingRecord.timestamp.toLocaleTimeString();
      const existingDate = duplicateCheck.existingRecord.timestamp.toLocaleDateString();
      
      throw new Error(
        `Duplicate attendance detected! ` +
        `ID ${studentId} was already recorded today (${existingDate}) at ${existingTime}. ` +
        `Detection method: ${duplicateCheck.method}`
      );
    }
    
    // If duplicate check failed but we're proceeding, show warning
    if (duplicateCheck.error) {
      console.warn(
        `Duplicate check failed (${duplicateCheck.error}), proceeding with caution. ` +
        `Please manually verify no duplicate exists for ID ${studentId}`
      );
    }
    
    // Create attendance record
    const attendanceData = {
      idNumber: studentId,
      timestamp: Timestamp.now(),
      status: "Present",
      recordedBy: recordedBy,
      duplicateCheckMethod: duplicateCheck.method,
      ...additionalData
    };
    
    try {
      const docRef = await addDoc(collection(db, "attendance"), attendanceData);
      
      const result = {
        id: docRef.id,
        ...attendanceData,
        timestamp: attendanceData.timestamp.toDate(),
        duplicateCheckWarning: duplicateCheck.error ? duplicateCheck.error : null
      };
      
      console.log(`Attendance recorded successfully:`, result);
      return result;
      
    } catch (error) {
      console.error("Failed to record attendance:", error);
      throw new Error(`Failed to record attendance: ${error.message}`);
    }
  }
  
  /**
   * Get attendance records with optional filtering
   */
  async getAttendanceRecords(filters = {}) {
    try {
      let q = collection(db, "attendance");
      
      // Apply filters
      if (filters.idNumber) {
        q = query(q, where("idNumber", "==", filters.idNumber.toString().trim()));
      }
      
      if (filters.startDate && filters.endDate) {
        q = query(
          q, 
          where("timestamp", ">=", Timestamp.fromDate(filters.startDate)),
          where("timestamp", "<=", Timestamp.fromDate(filters.endDate))
        );
      }
      
      // Always order by timestamp descending
      q = query(q, orderBy("timestamp", "desc"));
      
      if (filters.limit) {
        q = query(q, limit(filters.limit));
      }
      
      const snapshot = await getDocs(q);
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      }));
      
      return records;
      
    } catch (error) {
      console.error("Failed to fetch attendance records:", error);
      throw new Error(`Failed to fetch attendance records: ${error.message}`);
    }
  }
  
  /**
   * Get today's attendance count
   */
  async getTodayAttendanceCount() {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    
    try {
      const records = await this.getAttendanceRecords({
        startDate: startOfToday,
        endDate: endOfToday
      });
      
      return records.length;
    } catch (error) {
      console.error("Failed to get today's attendance count:", error);
      return 0;
    }
  }
  
  /**
   * Check if a specific student attended today
   */
  async hasAttendedToday(idNumber) {
    const duplicateCheck = await this.checkDuplicateAttendance(idNumber);
    return duplicateCheck.isDuplicate;
  }
}

// Create and export a singleton instance
const attendanceService = new AttendanceService();
export default attendanceService;