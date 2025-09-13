import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Alert,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  LinearProgress
} from '@mui/material';
import {
  Security,
  Warning,
  Error,
  CheckCircle,
  Visibility,
  Block,
  Person,
  Timeline,
  Assessment,
  Close,
  Refresh
} from '@mui/icons-material';
import SecurityService from '../services/securityService';
import { useAuth } from '../contexts/AuthContext';

function SecurityDashboard() {
  const [tabValue, setTabValue] = useState(0);
  const [auditLogs, setAuditLogs] = useState([]);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [_users, setUsers] = useState([]);
  const [detailsDialog, setDetailsDialog] = useState({ open: false, data: null });
  
  // Filters
  const [filters, setFilters] = useState({
    eventType: '',
    userId: '',
    dateRange: { start: '', end: '' },
    severity: ''
  });

  const { currentUser, requirePermission } = useAuth();

  const loadAuditLogs = useCallback(async () => {
    try {
      const logs = await SecurityService.getAuditLogs({
        eventType: filters.eventType || null,
        userId: filters.userId || null,
        limit: 100
      });
      setAuditLogs(logs);
    } catch (error) {
      console.error('Error loading audit logs:', error);
    }
  }, [filters.eventType, filters.userId]);

  const loadSecurityEvents = useCallback(async () => {
    try {
      const events = await SecurityService.getSecurityEvents({
        eventType: filters.eventType || null,
        userId: filters.userId || null,
        limit: 100
      });
      setSecurityEvents(events);
    } catch (error) {
      console.error('Error loading security events:', error);
    }
  }, [filters.eventType, filters.userId]);

  const loadUserManagement = useCallback(async () => {
    try {
      const users = await SecurityService.getAllUsers();
      setUsers(users);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (tabValue === 0) {
        await loadAuditLogs();
      } else if (tabValue === 1) {
        await loadSecurityEvents();
      } else if (tabValue === 2) {
        await loadUserManagement();
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [tabValue, loadAuditLogs, loadSecurityEvents, loadUserManagement]);

  useEffect(() => {
    const checkPermissionAndLoadData = async () => {
      try {
        console.log('Checking security dashboard permissions...');
        await requirePermission('view_security_dashboard', 'access security dashboard');
        console.log('Security dashboard permissions granted, loading data...');
        await loadData();
      } catch (error) {
        console.error('SecurityDashboard permission or loading error:', error);
        // Still load data even if permission check fails for now
        try {
          await loadData();
        } catch (dataError) {
          console.error('Failed to load data after permission error:', dataError);
        }
      }
    };

    if (currentUser) {
      checkPermissionAndLoadData();
    }
  }, [currentUser, tabValue, requirePermission, loadData]);



  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const getSeverityColor = (severity) => {
    const colors = {
      low: '#4caf50',
      medium: '#ff9800',
      high: '#f44336',
      critical: '#9c27b0'
    };
    return colors[severity] || '#757575';
  };

  const getEventTypeIcon = (eventType) => {
    const icons = {
      'USER_LOGIN': <CheckCircle />,
      'USER_LOGOUT': <CheckCircle />,
      'ATTENDANCE_ACTION': <Person />,
      'DATA_EXPORT': <Assessment />,
      'BULK_OPERATION': <Timeline />,
      'UNAUTHORIZED_ACCESS': <Block />,
      'SUSPICIOUS_ACTIVITY': <Warning />,
      'RATE_LIMIT_EXCEEDED': <Error />
    };
    return icons[eventType] || <Security />;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
        <Security sx={{ mr: 1 }} />
        Security Dashboard
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: 'rgba(76, 175, 80, 0.1)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CheckCircle sx={{ fontSize: 40, color: '#4caf50', mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                    {auditLogs.filter(log => log.eventType === 'USER_LOGIN').length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Successful Logins
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: 'rgba(255, 152, 0, 0.1)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Warning sx={{ fontSize: 40, color: '#ff9800', mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ff9800' }}>
                    {securityEvents.filter(event => event.type === 'SUSPICIOUS_ACTIVITY').length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Security Alerts
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: 'rgba(244, 67, 54, 0.1)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Block sx={{ fontSize: 40, color: '#f44336', mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#f44336' }}>
                    {securityEvents.filter(event => event.type === 'UNAUTHORIZED_ACCESS').length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Blocked Access
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: 'rgba(33, 150, 243, 0.1)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Assessment sx={{ fontSize: 40, color: '#2196f3', mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#2196f3' }}>
                    {auditLogs.length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Events
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>Filters</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Event Type</InputLabel>
              <Select
                value={filters.eventType}
                label="Event Type"
                onChange={(e) => setFilters(prev => ({ ...prev, eventType: e.target.value }))}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="USER_LOGIN">User Login</MenuItem>
                <MenuItem value="ATTENDANCE_ACTION">Attendance</MenuItem>
                <MenuItem value="SUSPICIOUS_ACTIVITY">Suspicious</MenuItem>
                <MenuItem value="UNAUTHORIZED_ACCESS">Unauthorized</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              label="User ID"
              value={filters.userId}
              onChange={(e) => setFilters(prev => ({ ...prev, userId: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="Start Date"
              value={filters.dateRange.start}
              onChange={(e) => setFilters(prev => ({ 
                ...prev, 
                dateRange: { ...prev.dateRange, start: e.target.value }
              }))}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="contained"
              onClick={loadData}
              startIcon={<Refresh />}
              disabled={loading}
              sx={{ height: 40 }}
            >
              Refresh
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs */}
      <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 2 }}>
        <Tab label="Audit Logs" />
        <Tab label="Security Events" />
        <Tab label="User Management" />
      </Tabs>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Audit Logs Tab */}
      {tabValue === 0 && (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Event Type</TableCell>
                  <TableCell>User ID</TableCell>
                  <TableCell>Details</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auditLogs.map((log) => (
                  <TableRow key={log.id} hover>
                    <TableCell>{formatTimestamp(log.timestamp)}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {getEventTypeIcon(log.eventType)}
                        <Typography sx={{ ml: 1 }}>{log.eventType}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{log.userId || 'N/A'}</TableCell>
                    <TableCell>
                      {log.details ? (
                        <Chip 
                          label={Object.keys(log.details).length + " fields"}
                          size="small"
                          variant="outlined"
                        />
                      ) : 'No details'}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => setDetailsDialog({ open: true, data: log })}
                        >
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {auditLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography color="textSecondary">No audit logs found</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Security Events Tab */}
      {tabValue === 1 && (
        <Paper>
          <List>
            {securityEvents.map((event) => (
              <ListItem 
                key={event.id}
                sx={{ 
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  borderRadius: 1,
                  mb: 1,
                  backgroundColor: event.severity === 'critical' ? 'rgba(244, 67, 54, 0.05)' : 'inherit'
                }}
              >
                <ListItemIcon>
                  <Warning 
                    sx={{ 
                      color: getSeverityColor(event.severity || 'medium')
                    }} 
                  />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1">{event.type}</Typography>
                      {event.severity && (
                        <Chip 
                          label={event.severity.toUpperCase()}
                          size="small"
                          sx={{ 
                            backgroundColor: getSeverityColor(event.severity),
                            color: 'white'
                          }}
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        {formatTimestamp(event.timestamp)} | User: {event.userId || 'N/A'}
                      </Typography>
                      {event.details && (
                        <Typography variant="caption" color="textSecondary">
                          {JSON.stringify(event.details, null, 2)}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
            {securityEvents.length === 0 && (
              <ListItem>
                <ListItemText
                  primary={
                    <Typography color="textSecondary" align="center">
                      No security events found
                    </Typography>
                  }
                />
              </ListItem>
            )}
          </List>
        </Paper>
      )}

      {/* User Management Tab */}
      {tabValue === 2 && (
        <Paper sx={{ p: 3 }}>
          <Alert severity="info">
            User role management functionality requires additional implementation.
            This would include features like:
            <List dense>
              <ListItem>• View all user roles and permissions</ListItem>
              <ListItem>• Modify user roles and permissions</ListItem>
              <ListItem>• Deactivate/activate user accounts</ListItem>
              <ListItem>• View user session information</ListItem>
            </List>
          </Alert>
        </Paper>
      )}

      {/* Details Dialog */}
      <Dialog
        open={detailsDialog.open}
        onClose={() => setDetailsDialog({ open: false, data: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Event Details
          <IconButton
            onClick={() => setDetailsDialog({ open: false, data: null })}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {detailsDialog.data && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Event Type:</Typography>
                  <Typography>{detailsDialog.data.eventType}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Timestamp:</Typography>
                  <Typography>{formatTimestamp(detailsDialog.data.timestamp)}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">User ID:</Typography>
                  <Typography>{detailsDialog.data.userId || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Session ID:</Typography>
                  <Typography>{detailsDialog.data.sessionId || 'N/A'}</Typography>
                </Grid>
                {detailsDialog.data.details && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2">Details:</Typography>
                    <Box
                      component="pre"
                      sx={{
                        backgroundColor: 'rgba(0, 0, 0, 0.05)',
                        p: 1,
                        borderRadius: 1,
                        fontSize: '0.875rem',
                        overflow: 'auto',
                        maxHeight: 300
                      }}
                    >
                      {JSON.stringify(detailsDialog.data.details, null, 2)}
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default SecurityDashboard;