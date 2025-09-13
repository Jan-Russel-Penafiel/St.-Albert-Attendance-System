import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  LinearProgress,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Upload,
  Download,
  Edit,
  Delete,
  CheckCircle,
  Error,
  Warning,
  Info,
  ExpandMore,
  CloudUpload,
  GetApp,
  Assessment
} from '@mui/icons-material';
import BulkOperationsService from '../services/bulkOperationsService';

function BulkOperationsPanel({ selectedRecords = [], onOperationComplete }) {
  const [operationDialog, setOperationDialog] = useState({ open: false, type: null });
  const [importDialog, setImportDialog] = useState({ open: false });
  const [exportDialog, setExportDialog] = useState({ open: false });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  
  // Bulk update states
  const [bulkStatus, setBulkStatus] = useState('Present');
  
  // Import states
  const [importFile, setImportFile] = useState(null);
  const [importFormat, setImportFormat] = useState('csv');
  const [importOptions, setImportOptions] = useState({
    validateData: true,
    skipDuplicates: true
  });
  
  // Export states
  const [exportOptions, setExportOptions] = useState({
    format: 'csv',
    includeHeaders: true,
    dateRange: { start: '', end: '' },
    departments: [],
    statuses: []
  });

  const statusOptions = ['Present', 'Late', 'Absent', 'Excused'];


  const handleBulkStatusUpdate = async () => {
    if (selectedRecords.length === 0) {
      alert('Please select records to update');
      return;
    }

    setLoading(true);
    try {
      const result = await BulkOperationsService.bulkUpdateStatus(
        selectedRecords,
        bulkStatus,
        'admin'
      );
      
      setResults({
        type: 'update',
        success: true,
        data: result
      });
      
      if (onOperationComplete) {
        onOperationComplete('update', result);
      }
    } catch (error) {
      setResults({
        type: 'update',
        success: false,
        error: error.message
      });
    } finally {
      setLoading(false);
      setOperationDialog({ open: false, type: null });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRecords.length === 0) {
      alert('Please select records to delete');
      return;
    }

    setLoading(true);
    try {
      const result = await BulkOperationsService.bulkDeleteRecords(
        selectedRecords,
        'admin'
      );
      
      setResults({
        type: 'delete',
        success: true,
        data: result
      });
      
      if (onOperationComplete) {
        onOperationComplete('delete', result);
      }
    } catch (error) {
      setResults({
        type: 'delete',
        success: false,
        error: error.message
      });
    } finally {
      setLoading(false);
      setOperationDialog({ open: false, type: null });
    }
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const exportData = await BulkOperationsService.exportAttendanceData({
        ...exportOptions,
        dateRange: exportOptions.dateRange.start && exportOptions.dateRange.end 
          ? exportOptions.dateRange 
          : null
      });

      // Create and download file
      const blob = new Blob([exportData], { 
        type: exportOptions.format === 'csv' ? 'text/csv' : 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance_export_${new Date().toISOString().slice(0, 10)}.${exportOptions.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setResults({
        type: 'export',
        success: true,
        data: { message: 'Export completed successfully' }
      });
    } catch (error) {
      setResults({
        type: 'export',
        success: false,
        error: error.message
      });
    } finally {
      setLoading(false);
      setExportDialog({ open: false });
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      alert('Please select a file to import');
      return;
    }

    setLoading(true);
    try {
      const fileContent = await readFileContent(importFile);
      const result = await BulkOperationsService.importAttendanceData(
        fileContent,
        importFormat,
        {
          ...importOptions,
          importedBy: 'admin'
        }
      );
      
      setResults({
        type: 'import',
        success: true,
        data: result
      });
      
      if (onOperationComplete) {
        onOperationComplete('import', result);
      }
    } catch (error) {
      setResults({
        type: 'import',
        success: false,
        error: error.message
      });
    } finally {
      setLoading(false);
      setImportDialog({ open: false });
      setImportFile(null);
    }
  };

  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const fileExtension = file.name.split('.').pop().toLowerCase();
      
      if (fileExtension === 'csv' || fileExtension === 'json') {
        setImportFile(file);
        setImportFormat(fileExtension);
      } else {
        alert('Please select a CSV or JSON file');
      }
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Bulk Operations
      </Typography>

      {/* Quick Actions */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: 'rgba(25, 118, 210, 0.1)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Edit sx={{ fontSize: 24, color: '#1976d2', mr: 1 }} />
                <Typography variant="h6" sx={{ color: '#1976d2' }}>
                  Update Status
                </Typography>
              </Box>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Update status for selected records
              </Typography>
              <Button
                fullWidth
                variant="contained"
                disabled={selectedRecords.length === 0}
                onClick={() => setOperationDialog({ open: true, type: 'update' })}
                sx={{ backgroundColor: '#1976d2' }}
              >
                Update ({selectedRecords.length})
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: 'rgba(244, 67, 54, 0.1)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Delete sx={{ fontSize: 24, color: '#f44336', mr: 1 }} />
                <Typography variant="h6" sx={{ color: '#f44336' }}>
                  Delete Records
                </Typography>
              </Box>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Permanently delete selected records
              </Typography>
              <Button
                fullWidth
                variant="contained"
                color="error"
                disabled={selectedRecords.length === 0}
                onClick={() => setOperationDialog({ open: true, type: 'delete' })}
              >
                Delete ({selectedRecords.length})
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: 'rgba(76, 175, 80, 0.1)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <CloudUpload sx={{ fontSize: 24, color: '#4caf50', mr: 1 }} />
                <Typography variant="h6" sx={{ color: '#4caf50' }}>
                  Import Data
                </Typography>
              </Box>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Import attendance from CSV/JSON
              </Typography>
              <Button
                fullWidth
                variant="contained"
                onClick={() => setImportDialog({ open: true })}
                sx={{ backgroundColor: '#4caf50' }}
              >
                Import
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: 'rgba(255, 152, 0, 0.1)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <GetApp sx={{ fontSize: 24, color: '#ff9800', mr: 1 }} />
                <Typography variant="h6" sx={{ color: '#ff9800' }}>
                  Export Data
                </Typography>
              </Box>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Export attendance to CSV/JSON
              </Typography>
              <Button
                fullWidth
                variant="contained"
                onClick={() => setExportDialog({ open: true })}
                sx={{ backgroundColor: '#ff9800' }}
              >
                Export
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Results Display */}
      {results && (
        <Accordion sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {results.success ? (
                <CheckCircle sx={{ color: '#4caf50', mr: 1 }} />
              ) : (
                <Error sx={{ color: '#f44336', mr: 1 }} />
              )}
              <Typography>
                Operation Results - {results.type.toUpperCase()}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {results.success ? (
              <Box>
                {results.data.success !== undefined && (
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Alert severity="success">
                        Success: {results.data.success} records
                      </Alert>
                    </Grid>
                    {results.data.failed > 0 && (
                      <Grid item xs={6}>
                        <Alert severity="error">
                          Failed: {results.data.failed} records
                        </Alert>
                      </Grid>
                    )}
                  </Grid>
                )}
                
                {results.data.imported !== undefined && (
                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={4}>
                      <Alert severity="success">
                        Imported: {results.data.imported}
                      </Alert>
                    </Grid>
                    <Grid item xs={4}>
                      <Alert severity="warning">
                        Skipped: {results.data.skipped}
                      </Alert>
                    </Grid>
                    <Grid item xs={4}>
                      <Alert severity="info">
                        Total: {results.data.total}
                      </Alert>
                    </Grid>
                  </Grid>
                )}

                {results.data.errors && results.data.errors.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2">Errors:</Typography>
                    <List dense>
                      {results.data.errors.slice(0, 5).map((error, index) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <Warning sx={{ color: '#ff9800' }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={error.error || 'Unknown error'}
                            secondary={error.batch ? `Batch ${error.batch}` : `Row ${error.row}`}
                          />
                        </ListItem>
                      ))}
                      {results.data.errors.length > 5 && (
                        <ListItem>
                          <ListItemText
                            primary={`... and ${results.data.errors.length - 5} more errors`}
                          />
                        </ListItem>
                      )}
                    </List>
                  </Box>
                )}
              </Box>
            ) : (
              <Alert severity="error">
                Error: {results.error}
              </Alert>
            )}
          </AccordionDetails>
        </Accordion>
      )}

      {/* Bulk Update Dialog */}
      <Dialog
        open={operationDialog.open && operationDialog.type === 'update'}
        onClose={() => setOperationDialog({ open: false, type: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Bulk Status Update
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography gutterBottom>
              Update status for {selectedRecords.length} selected records
            </Typography>
            
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>New Status</InputLabel>
              <Select
                value={bulkStatus}
                label="New Status"
                onChange={(e) => setBulkStatus(e.target.value)}
              >
                {statusOptions.map(status => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOperationDialog({ open: false, type: null })}>
            Cancel
          </Button>
          <Button
            onClick={handleBulkStatusUpdate}
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Update Records'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog
        open={operationDialog.open && operationDialog.type === 'delete'}
        onClose={() => setOperationDialog({ open: false, type: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Confirm Bulk Delete
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone!
          </Alert>
          <Typography>
            Are you sure you want to delete {selectedRecords.length} selected attendance records?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOperationDialog({ open: false, type: null })}>
            Cancel
          </Button>
          <Button
            onClick={handleBulkDelete}
            variant="contained"
            color="error"
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete Records'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Export Dialog */}
      <Dialog
        open={exportDialog.open}
        onClose={() => setExportDialog({ open: false })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Export Attendance Data</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Format</InputLabel>
                <Select
                  value={exportOptions.format}
                  label="Format"
                  onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value }))}
                >
                  <MenuItem value="csv">CSV</MenuItem>
                  <MenuItem value="json">JSON</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Include Headers</InputLabel>
                <Select
                  value={exportOptions.includeHeaders}
                  label="Include Headers"
                  onChange={(e) => setExportOptions(prev => ({ ...prev, includeHeaders: e.target.value }))}
                >
                  <MenuItem value={true}>Yes</MenuItem>
                  <MenuItem value={false}>No</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                value={exportOptions.dateRange.start}
                onChange={(e) => setExportOptions(prev => ({
                  ...prev,
                  dateRange: { ...prev.dateRange, start: e.target.value }
                }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                value={exportOptions.dateRange.end}
                onChange={(e) => setExportOptions(prev => ({
                  ...prev,
                  dateRange: { ...prev.dateRange, end: e.target.value }
                }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialog({ open: false })}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            variant="contained"
            disabled={loading}
            startIcon={<Download />}
          >
            {loading ? 'Exporting...' : 'Export'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog
        open={importDialog.open}
        onClose={() => setImportDialog({ open: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Import Attendance Data</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <input
              type="file"
              accept=".csv,.json"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button
                variant="outlined"
                component="span"
                fullWidth
                startIcon={<Upload />}
                sx={{ mb: 2 }}
              >
                {importFile ? importFile.name : 'Choose File (CSV/JSON)'}
              </Button>
            </label>

            {importFile && (
              <Box sx={{ mb: 2 }}>
                <Chip
                  label={`${importFile.name} (${(importFile.size / 1024).toFixed(1)} KB)`}
                  onDelete={() => setImportFile(null)}
                  color="primary"
                />
              </Box>
            )}

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Format</InputLabel>
              <Select
                value={importFormat}
                label="Format"
                onChange={(e) => setImportFormat(e.target.value)}
              >
                <MenuItem value="csv">CSV</MenuItem>
                <MenuItem value="json">JSON</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Validate Data</InputLabel>
              <Select
                value={importOptions.validateData}
                label="Validate Data"
                onChange={(e) => setImportOptions(prev => ({ ...prev, validateData: e.target.value }))}
              >
                <MenuItem value={true}>Yes</MenuItem>
                <MenuItem value={false}>No</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Skip Duplicates</InputLabel>
              <Select
                value={importOptions.skipDuplicates}
                label="Skip Duplicates"
                onChange={(e) => setImportOptions(prev => ({ ...prev, skipDuplicates: e.target.value }))}
              >
                <MenuItem value={true}>Yes</MenuItem>
                <MenuItem value={false}>No</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialog({ open: false })}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            variant="contained"
            disabled={loading || !importFile}
            startIcon={<Upload />}
          >
            {loading ? 'Importing...' : 'Import'}
          </Button>
        </DialogActions>
      </Dialog>

      {loading && (
        <Box sx={{ width: '100%', mt: 2 }}>
          <LinearProgress />
        </Box>
      )}
    </Box>
  );
}

export default BulkOperationsPanel;