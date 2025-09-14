import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BarcodeScanner from '../components/BarcodeScanner';
import attendanceService from '../services/attendanceService';
import { 
  Container, Box, Typography, Button, Paper, Table, 
  TableBody, TableCell, TableContainer, TableHead, 
  TableRow, Alert, Tabs, Tab, TextField, 
  MenuItem, Select, FormControl, InputLabel, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Chip, Checkbox, CircularProgress, Snackbar
} from '@mui/material';
import { collection, query, orderBy, getDocs, Timestamp, doc, writeBatch, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

function AdminDashboard() {
  const [scanResult, setScanResult] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const { currentUser, logout, getUserRole } = useAuth();
  const navigate = useNavigate();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [scannedStatus, setScannedStatus] = useState({ idNumber: '', status: '' });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [selectedRecords, setSelectedRecords] = useState([]);
  
  // Add status configuration
  const statusConfig = {
    Present: {
      color: '#2e7d32',
      bgColor: '#e8f5e9',
      label: 'Present'
    },
    Late: {
      color: '#f57c00',
      bgColor: '#fff3e0',
      label: 'Late'
    },
    Absent: {
      color: '#c62828',
      bgColor: '#ffebee',
      label: 'Absent'
    },
    Excused: {
      color: '#1565c0',
      bgColor: '#e3f2fd',
      label: 'Excused'
    }
  };

  useEffect(() => {
    async function checkAdminAccess() {
      if (!currentUser) {
        navigate('/login');
        return;
      }
      
      try {
        const role = await getUserRole();
        if (role !== 'admin') {
          navigate('/dashboard');
        }
      } catch (error) {
        setError('Failed to verify admin access: ' + error.message);
      }
    }
    
    checkAdminAccess();
    fetchAttendanceRecords();
  }, [currentUser, getUserRole, navigate]);

  // Apply filters when attendanceRecords or filter values change
  useEffect(() => {
    filterRecords();
  }, [attendanceRecords, searchTerm, dateFilter]);

  function filterRecords() {
    let filtered = [...attendanceRecords];
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(record => 
        record.idNumber.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply date filter
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    switch (dateFilter) {
      case 'today':
        filtered = filtered.filter(record => {
          const recordDate = new Date(record.timestamp);
          recordDate.setHours(0, 0, 0, 0);
          return recordDate.getTime() === today.getTime();
        });
        break;
      case 'yesterday':
        filtered = filtered.filter(record => {
          const recordDate = new Date(record.timestamp);
          recordDate.setHours(0, 0, 0, 0);
          return recordDate.getTime() === yesterday.getTime();
        });
        break;
      case 'week':
        filtered = filtered.filter(record => record.timestamp >= lastWeek);
        break;
      case 'month':
        filtered = filtered.filter(record => record.timestamp >= lastMonth);
        break;
      default:
        // 'all' - no filtering needed
        break;
    }
    
    console.log("Filtered records:", filtered);
    setFilteredRecords(filtered);
  }

  async function fetchAttendanceRecords() {
    setLoading(true);
    try {
      console.log("Fetching attendance records...");
      const records = await attendanceService.getAttendanceRecords();
      
      console.log("Fetched records:", records);
      setAttendanceRecords(records);
    } catch (error) {
      console.error("Error fetching attendance records:", error);
      setError('Failed to fetch attendance records: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleScanSuccess(idNumber) {
    console.log("Handling scan success for ID:", idNumber);
    setScanResult(idNumber);
    
    try {
      // Validate ID number
      if (!idNumber || idNumber.trim() === '') {
        setError('Invalid ID number');
        return;
      }

      setLoading(true);
      
      // Use the new attendance service with robust duplicate prevention
      const result = await attendanceService.recordAttendance(
        idNumber.trim(),
        currentUser?.uid || 'unknown'
      );
      
      console.log("Attendance recorded successfully:", result);
      
      // Add the new record to the local state
      const newRecord = {
        id: result.id,
        idNumber: result.idNumber,
        timestamp: result.timestamp,
        status: result.status,
        recordedBy: result.recordedBy
      };
      
      // Update both attendanceRecords and filteredRecords
      setAttendanceRecords(prevRecords => [newRecord, ...prevRecords]);
      setFilteredRecords(prevRecords => [newRecord, ...prevRecords]);
      
      // Show success message with additional info if there was a warning
      let successMsg = `✅ Attendance recorded for ID: ${idNumber} (Present)`;
      if (result.duplicateCheckWarning) {
        successMsg += ` ⚠️ Warning: ${result.duplicateCheckWarning}`;
      }
      
      setSuccessMessage(successMsg);
      setTimeout(() => setSuccessMessage(''), 5000);
      
      // Show status modal
      setScannedStatus({ 
        idNumber: idNumber.trim(),
        status: "Present",
        time: new Date().toLocaleTimeString()
      });
      setStatusModalOpen(true);
      
      // Switch to attendance records tab immediately for manual entry
      setTabValue(1);
      
      // Clear the scan result after a delay
      setTimeout(() => {
        setScanResult('');
      }, 3000);
      
      return true; // Return true to indicate success to the QRScanner
      
    } catch (error) {
      console.error("Error recording attendance:", error);
      
      // Handle different types of errors
      if (error.message.includes('Duplicate attendance detected')) {
        setError(`🚫 ${error.message}`);
        setTimeout(() => setError(''), 5000);
      } else if (error.message.includes("requires an index")) {
        setError(
          "Firebase index needs to be created. Please visit the Firebase console to create the index. " +
          "You can continue to use the app, but duplicate entries will not be detected until the index is created."
        );
        setTimeout(() => setError(''), 8000);
      } else {
        setError(`Failed to record attendance: ${error.message}`);
        setTimeout(() => setError(''), 4000);
      }
      
      throw error; // Re-throw to let QRScanner know there was an error
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      setError('Failed to log out: ' + error.message);
    }
  }

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const exportToCSV = () => {
    const headers = ['ID Number', 'Date', 'Time', 'Status'];
    
    const csvData = filteredRecords.map(record => [
      record.idNumber,
      record.timestamp.toLocaleDateString(),
      record.timestamp.toLocaleTimeString(),
      record.status || 'Present' // Include status, default to 'Present' if not set
    ]);
    
    csvData.unshift(headers);
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.setAttribute('download', `attendance_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteAllRecords = async () => {
    try {
      setLoading(true);
      console.log("Starting to delete all records...");
      
      // Get all attendance records
      const q = query(collection(db, "attendance"));
      const querySnapshot = await getDocs(q);
      
      // Create a batch write
      const batch = writeBatch(db);
      
      // Add each document to the batch delete
      querySnapshot.forEach((document) => {
        batch.delete(doc(db, "attendance", document.id));
      });
      
      // Commit the batch
      await batch.commit();
      console.log("Successfully deleted all records");
      
      // Clear local state
      setAttendanceRecords([]);
      setFilteredRecords([]);
      
      setSuccessMessage("All attendance records have been deleted");
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Close the dialog
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error("Error deleting records:", error);
      setError("Failed to delete records: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditStatus = async (record) => {
    setEditingRecord(record);
    setEditDialogOpen(true);
  };

  const handleSaveStatus = async () => {
    try {
      if (!editingRecord) return;

      const docRef = doc(db, "attendance", editingRecord.id);
      await updateDoc(docRef, {
        status: editingRecord.status
      });

      // Update local state
      setAttendanceRecords(prevRecords =>
        prevRecords.map(record =>
          record.id === editingRecord.id ? editingRecord : record
        )
      );
      setFilteredRecords(prevRecords =>
        prevRecords.map(record =>
          record.id === editingRecord.id ? editingRecord : record
        )
      );

      setSuccessMessage(`Status updated to ${editingRecord.status}`);
      setTimeout(() => setSuccessMessage(''), 3000);
      setEditDialogOpen(false);
    } catch (error) {
      console.error("Error updating status:", error);
      setError('Failed to update status: ' + error.message);
    }
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setEditingRecord(null);
  };

  // Add function to handle checkbox selection
  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectedRecords(filteredRecords.map(record => record.id));
    } else {
      setSelectedRecords([]);
    }
  };

  const handleSelectRecord = (recordId) => {
    setSelectedRecords(prev => {
      if (prev.includes(recordId)) {
        return prev.filter(id => id !== recordId);
      } else {
        return [...prev, recordId];
      }
    });
  };

  // Modify delete function to handle selected records
  const handleDeleteSelected = async () => {
    try {
      setLoading(true);
      console.log("Starting to delete selected records...");
      
      // Create a batch write
      const batch = writeBatch(db);
      
      // Add each selected document to the batch delete
      selectedRecords.forEach((recordId) => {
        batch.delete(doc(db, "attendance", recordId));
      });
      
      // Commit the batch
      await batch.commit();
      console.log("Successfully deleted selected records");
      
      // Update local state
      setAttendanceRecords(prevRecords => 
        prevRecords.filter(record => !selectedRecords.includes(record.id))
      );
      setFilteredRecords(prevRecords => 
        prevRecords.filter(record => !selectedRecords.includes(record.id))
      );
      
      setSuccessMessage(`${selectedRecords.length} attendance record(s) have been deleted`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Clear selection and close dialog
      setSelectedRecords([]);
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error("Error deleting records:", error);
      setError("Failed to delete records: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <Box sx={{ 
        display: 'flex',
        justifyContent: 'center',
        mt: 4
      }}>
        <Box sx={{ 
          width: 100,
          height: 100,
          borderRadius: '50%',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          margin: '0 auto',
          marginTop: -10,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'scale(1.05)',
            boxShadow: '0 6px 25px rgba(10, 132, 255, 0.3)'
          }
        }}>
          <img 
            src="/albert.jpg" 
            alt="Albert Logo" 
            style={{ 
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }} 
          />
        </Box>
      </Box>
      
      <Box sx={{ mt: 4, mb: 4 }}>
        
        <Typography variant="h4" component="h1" gutterBottom>

          Admin Dashboard
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}
        
    

        <Box sx={{ width: '100%', mt: 4 }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            centered
            variant="fullWidth"
            sx={{
              '& .MuiTab-root': {
                fontSize: { xs: '0.8rem', sm: '0.9rem', md: '1rem' },
                padding: { xs: '6px 8px', sm: '12px 16px' }
              }
            }}
          >
            <Tab label="QR Scanner" />
            <Tab label="Attendance Records" />
          </Tabs>
          
          <Box sx={{ p: { xs: 1, sm: 2 } }}>
            {tabValue === 0 && (
              <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, mx: 'auto', overflow: 'hidden' }}>
                <BarcodeScanner onScanSuccess={handleScanSuccess} />
                {scanResult && (
                  <Box sx={{ mt: 3, textAlign: 'center' }}>
                    <Typography variant="h6" sx={{ fontSize: { xs: '0.9rem', sm: '1.1rem', md: '1.25rem' } }}>
                      Scanned ID Number: {scanResult}
                    </Typography>
                  </Box>
                )}
              </Paper>
            )}
            
            {tabValue === 1 && (
              <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, mx: 'auto', overflow: 'auto' }}>
                <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' } }}>
                  Attendance Records
                </Typography>
                
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      fullWidth
                      label="Search by ID"
                      variant="outlined"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <FormControl fullWidth>
                      <InputLabel>Date Filter</InputLabel>
                      <Select
                        value={dateFilter}
                        label="Date Filter"
                        onChange={(e) => setDateFilter(e.target.value)}
                      >
                        <MenuItem value="all">All Time</MenuItem>
                        <MenuItem value="today">Today</MenuItem>
                        <MenuItem value="yesterday">Yesterday</MenuItem>
                        <MenuItem value="week">Last 7 Days</MenuItem>
                        <MenuItem value="month">Last 30 Days</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={12} md={4} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    <Button 
                      variant="outlined"
                      onClick={fetchAttendanceRecords}
                      sx={{ visibility: 'visible' }}
                      color='white'
                    >
                      Refresh
                    </Button>
                    <Button 
                      variant="contained"
                      onClick={exportToCSV}
                    >
                      Export CSV
                    </Button>
                    <Button 
                      variant="contained"
                      color="error"
                      onClick={() => setDeleteDialogOpen(true)}
                      disabled={selectedRecords.length === 0}
                    >
                      Delete Selected ({selectedRecords.length})
                    </Button>
                  </Grid>
                </Grid>
                
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">
                          <Checkbox
                            indeterminate={selectedRecords.length > 0 && selectedRecords.length < filteredRecords.length}
                            checked={filteredRecords.length > 0 && selectedRecords.length === filteredRecords.length}
                            onChange={handleSelectAll}
                            sx={{ color: 'white' }}
                          />
                        </TableCell>
                        <TableCell><Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700 }}>ID Number</Typography></TableCell>
                        <TableCell><Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700 }}>Date</Typography></TableCell>
                        <TableCell><Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700 }}>Time</Typography></TableCell>
                        <TableCell><Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700 }}>Status</Typography></TableCell>
                        <TableCell><Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700 }}>Actions</Typography></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredRecords.length > 0 ? (
                        filteredRecords.map((record) => (
                          <TableRow 
                            key={record.id}
                            hover
                            selected={selectedRecords.includes(record.id)}
                            sx={{ '&.Mui-selected': { backgroundColor: 'rgba(25, 118, 210, 0.15)' } }}
                          >
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={selectedRecords.includes(record.id)}
                                onChange={() => handleSelectRecord(record.id)}
                                sx={{ color: 'white' }}
                              />
                            </TableCell>
                            <TableCell><Typography sx={{ color: 'white' }}>{record.idNumber}</Typography></TableCell>
                            <TableCell><Typography sx={{ color: 'white' }}>{record.timestamp.toLocaleDateString()}</Typography></TableCell>
                            <TableCell><Typography sx={{ color: 'white' }}>{record.timestamp.toLocaleTimeString()}</Typography></TableCell>
                            <TableCell>
                              <Chip
                                label={record.status}
                                sx={{
                                  backgroundColor: statusConfig[record.status].bgColor,
                                  color: statusConfig[record.status].color,
                                  fontWeight: 'bold',
                                  '& .MuiChip-label': {
                                    px: 1.5
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                size="small"
                                onClick={() => handleEditStatus(record)}
                                sx={{ 
                                  minWidth: '80px', 
                                  backgroundColor: '#1976d2', 
                                  color: 'white', 
                                  '&:hover': { backgroundColor: '#115293' },
                                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                                }}
                              >
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} align="center">
                            <Typography sx={{ color: 'white', py: 2 }}>
                              {loading ? 'Loading...' : 'No attendance records found'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="textSecondary">
                    Showing {filteredRecords.length} of {attendanceRecords.length} records
                  </Typography>
                </Box>
              </Paper>
            )}
          </Box>
        </Box>
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{
          sx: {
            backgroundColor: 'rgba(18, 30, 40, 0.95)',
            backdropFilter: 'blur(8px)',
            color: 'white'
          }
        }}
      >
        <DialogTitle sx={{ color: 'white', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          Delete Selected Records
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'white', mt: 2 }}>
            Are you sure you want to delete {selectedRecords.length} selected attendance record(s)? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ color: 'white' }}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteSelected} 
            color="error" 
            variant="contained"
            disabled={loading || selectedRecords.length === 0}
            sx={{ fontWeight: 'bold' }}
          >
            {loading ? 'Deleting...' : `Delete ${selectedRecords.length} Record(s)`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Edit Status Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={handleCloseEditDialog}
        aria-labelledby="edit-dialog-title"
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'rgba(18, 30, 40, 0.95)',
            backdropFilter: 'blur(8px)',
            color: 'white'
          }
        }}
      >
        <DialogTitle id="edit-dialog-title" sx={{ 
          color: 'white',
          background: 'linear-gradient(to right, var(--primary-color), var(--secondary-color))',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px'
        }}>
          Edit Attendance Status
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 1,
              p: 2,
              borderRadius: 1,
              backgroundColor: 'rgba(255, 255, 255, 0.1)'
            }}>
              <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 'bold' }}>
                Attendance Information
              </Typography>
              <Typography sx={{ color: 'white' }}>
                <strong>ID:</strong> {editingRecord?.idNumber}
              </Typography>
              <Typography sx={{ color: 'white' }}>
                <strong>Date:</strong> {editingRecord?.timestamp.toLocaleDateString()}
              </Typography>
              <Typography sx={{ color: 'white' }}>
                <strong>Time:</strong> {editingRecord?.timestamp.toLocaleTimeString()}
              </Typography>
            </Box>

            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Status</InputLabel>
              <Select
                value={editingRecord?.status || 'Present'}
                label="Status"
                onChange={(e) => setEditingRecord(prev => ({ ...prev, status: e.target.value }))}
                sx={{ 
                  color: 'white',
                  '.MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.3)'
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.5)'
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.7)'
                  },
                  '.MuiSvgIcon-root': {
                    color: 'white'
                  }
                }}
              >
                {Object.entries(statusConfig).map(([key, config]) => (
                  <MenuItem key={key} value={key}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1 
                    }}>
                      <Box sx={{ 
                        width: 12, 
                        height: 12, 
                        borderRadius: '50%',
                        backgroundColor: config.bgColor,
                        border: `2px solid ${config.color}`
                      }} />
                      {config.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: 1,
              mt: 1
            }}>
              {Object.entries(statusConfig).map(([key, config]) => (
                <Chip
                  key={key}
                  label={config.label}
                  sx={{
                    backgroundColor: config.bgColor,
                    color: config.color,
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    '&:hover': {
                      opacity: 0.8,
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                    },
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => setEditingRecord(prev => ({ ...prev, status: key }))}
                />
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Button onClick={handleCloseEditDialog} sx={{ color: 'white' }}>Cancel</Button>
          <Button 
            onClick={handleSaveStatus} 
            variant="contained" 
            color="primary"
            sx={{ 
              minWidth: 120,
              background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
              fontWeight: 'bold'
            }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Status Modal Dialog */}
      <Dialog
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        aria-labelledby="status-dialog-title"
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            overflow: 'hidden',
            borderRadius: '16px'
          }
        }}
      >
        <Box sx={{ 
          p: 3, 
          backgroundColor: scannedStatus.status === 'Present' ? 'rgba(46, 125, 50, 0.95)' : 'rgba(245, 124, 0, 0.95)',
          color: 'white',
          textAlign: 'center',
          textShadow: '0 1px 2px rgba(0,0,0,0.2)'
        }}>
          <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
            Attendance Recorded
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
            ID: {scannedStatus.idNumber}
          </Typography>
          <Chip
            label={scannedStatus.status}
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.25)',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '1rem',
              padding: '16px 8px',
              mb: 2,
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}
          />
          <Typography variant="body1" sx={{ mt: 1, color: 'rgba(255, 255, 255, 0.9)' }}>
            Time: {scannedStatus.time}
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => setStatusModalOpen(false)}
            sx={{ 
              mt: 3, 
              width: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.25)',
              color: 'white',
              fontWeight: 'bold',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.35)'
              }
            }}
          >
            Continue
          </Button>
        </Box>
      </Dialog>
    </Container>
  );
}

export default AdminDashboard; 