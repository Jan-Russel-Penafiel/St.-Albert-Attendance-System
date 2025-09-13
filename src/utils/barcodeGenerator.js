import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Generates a unique barcode identifier for a student
 * Format: YEAR + DEPARTMENT + SEQUENTIAL_NUMBER (e.g., 2025CS001)
 */
export class BarcodeGenerator {
  static DEPARTMENTS = {
    CS: 'Computer Science',
    IT: 'Information Technology', 
    ENG: 'Engineering',
    BUS: 'Business',
    EDU: 'Education',
    MED: 'Medicine',
    LAW: 'Law',
    ART: 'Arts',
    SCI: 'Science',
    GEN: 'General'
  };

  /**
   * Generates a unique student barcode
   * @param {string} department - Department code (CS, IT, ENG, etc.)
   * @param {number} year - Academic year (optional, defaults to current year)
   * @returns {Promise<string>} - Unique barcode identifier
   */
  static async generateUniqueBarcode(department = 'GEN', year = new Date().getFullYear()) {
    try {
      // Validate department
      if (!this.DEPARTMENTS[department.toUpperCase()]) {
        department = 'GEN';
      }
      
      const departmentCode = department.toUpperCase();
      const yearString = year.toString();
      
      // Find the next available sequential number
      const sequentialNumber = await this.getNextSequentialNumber(yearString, departmentCode);
      
      // Format: YEAR + DEPARTMENT + 3-digit sequential number
      const barcode = `${yearString}${departmentCode}${sequentialNumber.toString().padStart(3, '0')}`;
      
      return barcode;
    } catch (error) {
      console.error('Error generating unique barcode:', error);
      throw new Error('Failed to generate unique barcode');
    }
  }

  /**
   * Gets the next available sequential number for a given year and department
   * @param {string} year - Year string
   * @param {string} departmentCode - Department code
   * @returns {Promise<number>} - Next sequential number
   */
  static async getNextSequentialNumber(year, departmentCode) {
    try {
      const prefix = `${year}${departmentCode}`;
      
      // Query for existing barcodes with the same prefix
      const q = query(
        collection(db, "users"),
        where("barcodeId", ">=", prefix + "000"),
        where("barcodeId", "<=", prefix + "999")
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return 1; // First student in this year/department
      }
      
      // Extract sequential numbers from existing barcodes
      const existingNumbers = [];
      querySnapshot.forEach((doc) => {
        const barcodeId = doc.data().barcodeId;
        if (barcodeId && barcodeId.startsWith(prefix)) {
          const sequentialPart = barcodeId.substring(prefix.length);
          const number = parseInt(sequentialPart, 10);
          if (!isNaN(number)) {
            existingNumbers.push(number);
          }
        }
      });
      
      // Find the next available number
      existingNumbers.sort((a, b) => a - b);
      let nextNumber = 1;
      
      for (const num of existingNumbers) {
        if (num === nextNumber) {
          nextNumber++;
        } else if (num > nextNumber) {
          break;
        }
      }
      
      return nextNumber;
    } catch (error) {
      console.error('Error getting next sequential number:', error);
      // Fallback: generate a random number between 100-999
      return Math.floor(Math.random() * 900) + 100;
    }
  }

  /**
   * Validates a barcode format
   * @param {string} barcode - Barcode to validate
   * @returns {object} - Validation result with isValid and details
   */
  static validateBarcode(barcode) {
    if (!barcode || typeof barcode !== 'string') {
      return { isValid: false, error: 'Barcode is required' };
    }

    // Check minimum length (YEAR + DEPT + 3 digits = 9 characters minimum)
    if (barcode.length < 9) {
      return { isValid: false, error: 'Barcode too short' };
    }

    // Extract components
    const year = barcode.substring(0, 4);
    const dept = barcode.substring(4, barcode.length - 3);
    const sequential = barcode.substring(barcode.length - 3);

    // Validate year (should be 4 digits)
    if (!/^\d{4}$/.test(year)) {
      return { isValid: false, error: 'Invalid year format' };
    }

    // Validate department code
    if (!this.DEPARTMENTS[dept]) {
      return { isValid: false, error: 'Invalid department code' };
    }

    // Validate sequential number (should be 3 digits)
    if (!/^\d{3}$/.test(sequential)) {
      return { isValid: false, error: 'Invalid sequential number format' };
    }

    return {
      isValid: true,
      year: parseInt(year),
      department: dept,
      departmentName: this.DEPARTMENTS[dept],
      sequential: parseInt(sequential),
      fullBarcode: barcode
    };
  }

  /**
   * Checks if a barcode already exists in the database
   * @param {string} barcode - Barcode to check
   * @returns {Promise<boolean>} - True if barcode exists
   */
  static async barcodeExists(barcode) {
    try {
      const q = query(
        collection(db, "users"),
        where("barcodeId", "==", barcode)
      );
      
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking barcode existence:', error);
      return false; // Assume it doesn't exist in case of error
    }
  }

  /**
   * Generates a secure QR code data string with additional verification
   * @param {string} barcode - Student barcode
   * @param {string} studentId - Student's Firebase user ID
   * @returns {string} - Secure QR code data
   */
  static generateSecureQRData(barcode, studentId) {
    const timestamp = Date.now();
    const checksum = this.generateChecksum(barcode + studentId + timestamp);
    
    return JSON.stringify({
      barcode,
      studentId,
      timestamp,
      checksum,
      version: '1.0'
    });
  }

  /**
   * Validates secure QR code data
   * @param {string} qrData - QR code data string
   * @returns {object} - Validation result
   */
  static validateSecureQRData(qrData) {
    try {
      const data = JSON.parse(qrData);
      
      if (!data.barcode || !data.studentId || !data.timestamp || !data.checksum) {
        return { isValid: false, error: 'Invalid QR code format' };
      }

      // Verify checksum
      const expectedChecksum = this.generateChecksum(
        data.barcode + data.studentId + data.timestamp
      );
      
      if (data.checksum !== expectedChecksum) {
        return { isValid: false, error: 'QR code integrity check failed' };
      }

      // Check if QR code is not too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      if (Date.now() - data.timestamp > maxAge) {
        return { isValid: false, error: 'QR code has expired' };
      }

      return {
        isValid: true,
        barcode: data.barcode,
        studentId: data.studentId,
        timestamp: data.timestamp,
        version: data.version
      };
    } catch {
      return { isValid: false, error: 'Invalid QR code data' };
    }
  }

  /**
   * Generates a simple checksum for data integrity
   * @param {string} data - Data to generate checksum for
   * @returns {string} - Checksum string
   */
  static generateChecksum(data) {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

export default BarcodeGenerator;