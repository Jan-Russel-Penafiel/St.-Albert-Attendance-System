import { 
  writeBatch, 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  serverTimestamp,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';

class BulkOperationsService {
  constructor() {
    this.batchSize = 500; // Firestore batch size limit
    this.attendanceCollection = collection(db, 'attendance');
  }

  /**
   * Perform bulk operations on attendance records
   */
  async bulkUpdateStatus(recordIds, newStatus, updatedBy = 'admin') {
    try {
      if (!Array.isArray(recordIds) || recordIds.length === 0) {
        throw new Error('No record IDs provided');
      }

      if (!['Present', 'Late', 'Absent', 'Excused'].includes(newStatus)) {
        throw new Error('Invalid status provided');
      }

      const results = {
        success: 0,
        failed: 0,
        errors: []
      };

      // Process in batches to avoid Firestore limits
      for (let i = 0; i < recordIds.length; i += this.batchSize) {
        const batch = writeBatch(db);
        const batchIds = recordIds.slice(i, i + this.batchSize);

        try {
          for (const recordId of batchIds) {
            const recordRef = doc(db, 'attendance', recordId);
            batch.update(recordRef, {
              status: newStatus,
              updatedAt: serverTimestamp(),
              updatedBy: updatedBy,
              lastModified: new Date().toISOString()
            });
          }

          await batch.commit();
          results.success += batchIds.length;
        } catch (error) {
          console.error(`Batch ${i / this.batchSize + 1} failed:`, error);
          results.failed += batchIds.length;
          results.errors.push({
            batch: i / this.batchSize + 1,
            recordIds: batchIds,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Bulk update failed:', error);
      throw error;
    }
  }

  /**
   * Bulk delete attendance records
   */
  async bulkDeleteRecords(recordIds, deletedBy = 'admin') {
    try {
      if (!Array.isArray(recordIds) || recordIds.length === 0) {
        throw new Error('No record IDs provided');
      }

      const results = {
        success: 0,
        failed: 0,
        errors: []
      };

      // Create audit log before deletion
      await this.createAuditLog('BULK_DELETE', {
        recordIds: recordIds,
        deletedBy: deletedBy,
        timestamp: new Date().toISOString(),
        recordCount: recordIds.length
      });

      // Process in batches
      for (let i = 0; i < recordIds.length; i += this.batchSize) {
        const batch = writeBatch(db);
        const batchIds = recordIds.slice(i, i + this.batchSize);

        try {
          for (const recordId of batchIds) {
            const recordRef = doc(db, 'attendance', recordId);
            batch.delete(recordRef);
          }

          await batch.commit();
          results.success += batchIds.length;
        } catch (error) {
          console.error(`Delete batch ${i / this.batchSize + 1} failed:`, error);
          results.failed += batchIds.length;
          results.errors.push({
            batch: i / this.batchSize + 1,
            recordIds: batchIds,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Bulk delete failed:', error);
      throw error;
    }
  }

  /**
   * Export attendance records with filtering options
   */
  async exportAttendanceData(options = {}) {
    try {
      const {
        format = 'csv',
        dateRange = null,
        departments = [],
        statuses = [],
        barcodeIds = [],
        includeHeaders = true,
        sortBy = 'timestamp',
        sortOrder = 'desc'
      } = options;

      // Build query with filters
      let attendanceQuery = query(this.attendanceCollection);

      // Add date range filter
      if (dateRange && dateRange.start && dateRange.end) {
        const startDate = Timestamp.fromDate(new Date(dateRange.start));
        const endDate = Timestamp.fromDate(new Date(dateRange.end));
        attendanceQuery = query(
          attendanceQuery,
          where('timestamp', '>=', startDate),
          where('timestamp', '<=', endDate)
        );
      }

      // Add status filter
      if (statuses.length > 0) {
        attendanceQuery = query(attendanceQuery, where('status', 'in', statuses));
      }

      // Add sorting
      attendanceQuery = query(
        attendanceQuery, 
        orderBy(sortBy, sortOrder)
      );

      const snapshot = await getDocs(attendanceQuery);
      let records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));

      // Apply additional filters (client-side for complex conditions)
      if (departments.length > 0) {
        records = records.filter(record => {
          if (!record.barcodeId) return false;
          const match = record.barcodeId.match(/\d{4}([A-Z]+)\d+/);
          const dept = match ? match[1] : '';
          return departments.includes(dept);
        });
      }

      if (barcodeIds.length > 0) {
        records = records.filter(record => barcodeIds.includes(record.barcodeId));
      }

      // Format data based on requested format
      switch (format.toLowerCase()) {
        case 'csv':
          return this.formatAsCSV(records, includeHeaders);
        case 'json':
          return this.formatAsJSON(records);
        case 'xlsx':
          return this.formatAsExcel(records, includeHeaders);
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  }

  /**
   * Import attendance records from various formats
   */
  async importAttendanceData(data, format = 'csv', options = {}) {
    try {
      const {
        validateData = true,
        skipDuplicates = true,
        importedBy = 'admin'
      } = options;

      let records = [];

      // Parse data based on format
      switch (format.toLowerCase()) {
        case 'csv':
          records = this.parseCSV(data);
          break;
        case 'json':
          records = typeof data === 'string' ? JSON.parse(data) : data;
          break;
        default:
          throw new Error(`Unsupported import format: ${format}`);
      }

      const results = {
        total: records.length,
        imported: 0,
        skipped: 0,
        errors: []
      };

      // Validate records if requested
      if (validateData) {
        records = records.filter((record, index) => {
          const validation = this.validateRecord(record);
          if (!validation.isValid) {
            results.errors.push({
              row: index + 1,
              record: record,
              errors: validation.errors
            });
            return false;
          }
          return true;
        });
      }

      // Check for duplicates if requested
      if (skipDuplicates) {
        const existingRecords = await this.getExistingRecords(
          records.map(r => ({ barcodeId: r.barcodeId, date: r.date }))
        );

        records = records.filter(record => {
          const isDuplicate = existingRecords.some(existing => 
            existing.barcodeId === record.barcodeId && 
            this.isSameDay(existing.timestamp.toDate(), new Date(record.date))
          );

          if (isDuplicate) {
            results.skipped++;
            return false;
          }
          return true;
        });
      }

      // Import in batches
      for (let i = 0; i < records.length; i += this.batchSize) {
        const batch = writeBatch(db);
        const batchRecords = records.slice(i, i + this.batchSize);

        try {
          for (const record of batchRecords) {
            const recordRef = doc(this.attendanceCollection);
            batch.set(recordRef, {
              barcodeId: record.barcodeId,
              timestamp: Timestamp.fromDate(new Date(record.date)),
              status: record.status || 'Present',
              importedBy: importedBy,
              importedAt: serverTimestamp(),
              createdAt: serverTimestamp()
            });
          }

          await batch.commit();
          results.imported += batchRecords.length;
        } catch (error) {
          console.error(`Import batch ${i / this.batchSize + 1} failed:`, error);
          results.errors.push({
            batch: i / this.batchSize + 1,
            records: batchRecords,
            error: error.message
          });
        }
      }

      // Create audit log
      await this.createAuditLog('BULK_IMPORT', {
        importedBy: importedBy,
        timestamp: new Date().toISOString(),
        results: results
      });

      return results;
    } catch (error) {
      console.error('Import failed:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive attendance reports
   */
  async generateAttendanceReport(options = {}) {
    try {
      const {
        reportType = 'summary',
        dateRange = null,
        departments = [],
        groupBy = 'date'
      } = options;

      // Get filtered attendance data
      const records = await this.getFilteredRecords(dateRange, departments);

      switch (reportType) {
        case 'summary':
          return this.generateSummaryReport(records, groupBy);
        case 'detailed':
          return this.generateDetailedReport(records);
        case 'trends':
          return this.generateTrendsReport(records);
        case 'department':
          return this.generateDepartmentReport(records);
        default:
          throw new Error(`Unknown report type: ${reportType}`);
      }
    } catch (error) {
      console.error('Report generation failed:', error);
      throw error;
    }
  }

  // Private helper methods

  formatAsCSV(records, includeHeaders) {
    const headers = [
      'ID', 'Barcode ID', 'Date', 'Time', 'Status', 
      'Created At', 'Updated At', 'Updated By'
    ];

    let csv = '';
    if (includeHeaders) {
      csv += headers.join(',') + '\n';
    }

    records.forEach(record => {
      const row = [
        record.id || '',
        record.barcodeId || '',
        record.timestamp.toDateString(),
        record.timestamp.toTimeString(),
        record.status || 'Present',
        record.createdAt ? new Date(record.createdAt.seconds * 1000).toISOString() : '',
        record.updatedAt ? new Date(record.updatedAt.seconds * 1000).toISOString() : '',
        record.updatedBy || ''
      ].map(field => `"${String(field).replace(/"/g, '""')}"`);

      csv += row.join(',') + '\n';
    });

    return csv;
  }

  formatAsJSON(records) {
    return JSON.stringify(records.map(record => ({
      ...record,
      timestamp: record.timestamp.toISOString(),
      createdAt: record.createdAt ? new Date(record.createdAt.seconds * 1000).toISOString() : null,
      updatedAt: record.updatedAt ? new Date(record.updatedAt.seconds * 1000).toISOString() : null
    })), null, 2);
  }

  parseCSV(csvData) {
    const lines = csvData.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const records = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const record = {};

      headers.forEach((header, index) => {
        record[header.toLowerCase().replace(/\s+/g, '')] = values[index] || '';
      });

      if (record.barcodeid && record.date) {
        records.push({
          barcodeId: record.barcodeid,
          date: record.date,
          status: record.status || 'Present'
        });
      }
    }

    return records;
  }

  validateRecord(record) {
    const errors = [];

    if (!record.barcodeId) {
      errors.push('Barcode ID is required');
    }

    if (!record.date) {
      errors.push('Date is required');
    } else if (isNaN(new Date(record.date).getTime())) {
      errors.push('Invalid date format');
    }

    if (record.status && !['Present', 'Late', 'Absent', 'Excused'].includes(record.status)) {
      errors.push('Invalid status value');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  async getExistingRecords(queries) {
    const existingRecords = [];
    
    // Batch queries to avoid Firestore limits
    for (let i = 0; i < queries.length; i += 10) {
      const batch = queries.slice(i, i + 10);
      const promises = batch.map(async ({ barcodeId, date }) => {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const q = query(
          this.attendanceCollection,
          where('barcodeId', '==', barcodeId),
          where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
          where('timestamp', '<=', Timestamp.fromDate(endOfDay))
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      });

      const results = await Promise.all(promises);
      existingRecords.push(...results.flat());
    }

    return existingRecords;
  }

  isSameDay(date1, date2) {
    return date1.toDateString() === date2.toDateString();
  }

  async createAuditLog(action, details) {
    try {
      const auditRef = doc(collection(db, 'audit_logs'));
      await writeBatch(db).set(auditRef, {
        action: action,
        details: details,
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString()
      }).commit();
    } catch (error) {
      console.error('Failed to create audit log:', error);
      // Don't throw error for audit log failure
    }
  }

  async getFilteredRecords(dateRange, departments) {
    let attendanceQuery = query(this.attendanceCollection);

    if (dateRange && dateRange.start && dateRange.end) {
      const startDate = Timestamp.fromDate(new Date(dateRange.start));
      const endDate = Timestamp.fromDate(new Date(dateRange.end));
      attendanceQuery = query(
        attendanceQuery,
        where('timestamp', '>=', startDate),
        where('timestamp', '<=', endDate)
      );
    }

    const snapshot = await getDocs(attendanceQuery);
    let records = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date()
    }));

    if (departments.length > 0) {
      records = records.filter(record => {
        if (!record.barcodeId) return false;
        const match = record.barcodeId.match(/\d{4}([A-Z]+)\d+/);
        const dept = match ? match[1] : '';
        return departments.includes(dept);
      });
    }

    return records;
  }

  generateSummaryReport(records, groupBy) {
    const summary = {
      totalRecords: records.length,
      uniqueStudents: new Set(records.map(r => r.barcodeId)).size,
      statusBreakdown: {},
      groupedData: {}
    };

    // Calculate status breakdown
    records.forEach(record => {
      const status = record.status || 'Present';
      summary.statusBreakdown[status] = (summary.statusBreakdown[status] || 0) + 1;
    });

    // Group data by specified field
    records.forEach(record => {
      let groupKey;
      
      switch (groupBy) {
        case 'date':
          groupKey = record.timestamp.toDateString();
          break;
        case 'department': {
          const match = record.barcodeId.match(/\d{4}([A-Z]+)\d+/);
          groupKey = match ? match[1] : 'Unknown';
          break;
        }
        case 'status':
          groupKey = record.status || 'Present';
          break;
        default:
          groupKey = 'All';
      }

      if (!summary.groupedData[groupKey]) {
        summary.groupedData[groupKey] = {
          count: 0,
          students: new Set(),
          statuses: {}
        };
      }

      summary.groupedData[groupKey].count++;
      summary.groupedData[groupKey].students.add(record.barcodeId);
      
      const status = record.status || 'Present';
      summary.groupedData[groupKey].statuses[status] = 
        (summary.groupedData[groupKey].statuses[status] || 0) + 1;
    });

    // Convert sets to counts
    Object.keys(summary.groupedData).forEach(key => {
      summary.groupedData[key].uniqueStudents = summary.groupedData[key].students.size;
      delete summary.groupedData[key].students;
    });

    return summary;
  }

  generateDetailedReport(records) {
    return {
      records: records.map(record => ({
        id: record.id,
        barcodeId: record.barcodeId,
        date: record.timestamp.toDateString(),
        time: record.timestamp.toTimeString(),
        status: record.status || 'Present',
        department: this.extractDepartment(record.barcodeId),
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        updatedBy: record.updatedBy
      })),
      metadata: {
        generatedAt: new Date().toISOString(),
        totalRecords: records.length,
        dateRange: {
          earliest: records.length > 0 ? Math.min(...records.map(r => r.timestamp.getTime())) : null,
          latest: records.length > 0 ? Math.max(...records.map(r => r.timestamp.getTime())) : null
        }
      }
    };
  }

  extractDepartment(barcodeId) {
    if (!barcodeId) return 'Unknown';
    const match = barcodeId.match(/\d{4}([A-Z]+)\d+/);
    return match ? match[1] : 'Unknown';
  }
}

export default new BulkOperationsService();