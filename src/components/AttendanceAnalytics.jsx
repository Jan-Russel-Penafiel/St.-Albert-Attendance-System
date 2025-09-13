import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  People,
  Schedule,
  Assessment,
  Download,
  Close
} from '@mui/icons-material';
import AttendanceService from '../services/attendanceService';

const COLORS = ['#4caf50', '#ff9800', '#f44336', '#2196f3'];
const STATUS_COLORS = {
  Present: '#4caf50',
  Late: '#ff9800', 
  Absent: '#f44336',
  Excused: '#2196f3'
};

function AttendanceAnalytics({ attendanceRecords }) {
  const [timeRange, setTimeRange] = useState('week');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [detailsDialog, setDetailsDialog] = useState({ open: false, data: null });

  const generateAnalytics = useCallback(() => {
    if (!attendanceRecords || attendanceRecords.length === 0) {
      setAnalyticsData(null);
      return;
    }

    try {
      const now = new Date();
      let startDate = new Date();

      // Calculate date range
      switch (timeRange) {
        case 'day':
          startDate.setDate(now.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(now.getMonth() - 3);
          break;
        default:
          startDate.setDate(now.getDate() - 7);
      }

      // Filter records by date range
      const filteredRecords = attendanceRecords.filter(record => {
        const recordDate = new Date(record.timestamp);
        return recordDate >= startDate && recordDate <= now;
      });

      // Calculate basic statistics
      const totalRecords = filteredRecords.length;
      const uniqueStudents = new Set(filteredRecords.map(r => r.barcodeId)).size;
      
      // Status breakdown
      const statusCounts = {
        Present: 0,
        Late: 0,
        Absent: 0,
        Excused: 0
      };

      filteredRecords.forEach(record => {
        const status = record.status || 'Present';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      // Daily breakdown for trends
      const dailyData = {};
      filteredRecords.forEach(record => {
        const date = new Date(record.timestamp).toDateString();
        if (!dailyData[date]) {
          dailyData[date] = {
            date: date,
            count: 0,
            students: new Set(),
            Present: 0,
            Late: 0,
            Absent: 0,
            Excused: 0
          };
        }
        dailyData[date].count++;
        dailyData[date].students.add(record.barcodeId);
        const status = record.status || 'Present';
        dailyData[date][status] = (dailyData[date][status] || 0) + 1;
      });

      // Convert to array and add unique student count
      const dailyTrends = Object.values(dailyData)
        .map(day => ({
          ...day,
          uniqueStudents: day.students.size,
          students: undefined // Remove the Set for JSON serialization
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      // Peak attendance times (hourly breakdown)
      const hourlyData = {};
      filteredRecords.forEach(record => {
        const hour = new Date(record.timestamp).getHours();
        const hourLabel = `${hour}:00`;
        hourlyData[hourLabel] = (hourlyData[hourLabel] || 0) + 1;
      });

      const hourlyTrends = Object.entries(hourlyData)
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

      // Department breakdown (if available)
      const departmentData = {};
      filteredRecords.forEach(record => {
        if (record.barcodeId) {
          // Extract department from barcode ID (e.g., 2025CS001 -> CS)
          const match = record.barcodeId.match(/\d{4}([A-Z]+)\d+/);
          const dept = match ? match[1] : 'Unknown';
          departmentData[dept] = (departmentData[dept] || 0) + 1;
        }
      });

      const departmentBreakdown = Object.entries(departmentData)
        .map(([dept, count]) => ({ department: dept, count }))
        .sort((a, b) => b.count - a.count);

      // Calculate attendance rate
      const presentRate = totalRecords > 0 ? (statusCounts.Present / totalRecords) * 100 : 0;
      const lateRate = totalRecords > 0 ? (statusCounts.Late / totalRecords) * 100 : 0;
      
      // Calculate trend (compared to previous period)
      const prevStartDate = new Date(startDate);
      const daysDiff = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
      prevStartDate.setDate(startDate.getDate() - daysDiff);

      const prevRecords = attendanceRecords.filter(record => {
        const recordDate = new Date(record.timestamp);
        return recordDate >= prevStartDate && recordDate < startDate;
      });

      const prevTotal = prevRecords.length;
      const trend = prevTotal > 0 ? ((totalRecords - prevTotal) / prevTotal) * 100 : 0;

      setAnalyticsData({
        summary: {
          totalRecords,
          uniqueStudents,
          attendanceRate: presentRate,
          lateRate,
          trend
        },
        statusBreakdown: Object.entries(statusCounts).map(([status, count]) => ({
          name: status,
          value: count,
          percentage: totalRecords > 0 ? (count / totalRecords) * 100 : 0
        })),
        dailyTrends,
        hourlyTrends,
        departmentBreakdown,
        topStudents: getTopStudents(filteredRecords)
      });

    } catch (error) {
      console.error('Error generating analytics:', error);
    }
  }, [attendanceRecords, timeRange]);

  useEffect(() => {
    generateAnalytics();
  }, [generateAnalytics]);

  const getTopStudents = (records) => {
    const studentCounts = {};
    records.forEach(record => {
      const id = record.barcodeId;
      if (id) {
        studentCounts[id] = (studentCounts[id] || 0) + 1;
      }
    });

    return Object.entries(studentCounts)
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  };

  const exportAnalytics = async () => {
    if (!analyticsData) return;

    try {
      // Create CSV content
      const csvContent = [
        ['Attendance Analytics Report'],
        ['Generated on:', new Date().toLocaleString()],
        ['Time Range:', timeRange],
        [''],
        ['Summary'],
        ['Total Records:', analyticsData.summary.totalRecords],
        ['Unique Students:', analyticsData.summary.uniqueStudents],
        ['Attendance Rate:', `${analyticsData.summary.attendanceRate.toFixed(1)}%`],
        ['Late Rate:', `${analyticsData.summary.lateRate.toFixed(1)}%`],
        [''],
        ['Status Breakdown'],
        ['Status', 'Count', 'Percentage'],
        ...analyticsData.statusBreakdown.map(item => [
          item.name, 
          item.value, 
          `${item.percentage.toFixed(1)}%`
        ]),
        [''],
        ['Daily Trends'],
        ['Date', 'Records', 'Unique Students', 'Present', 'Late', 'Absent', 'Excused'],
        ...analyticsData.dailyTrends.map(day => [
          day.date,
          day.count,
          day.uniqueStudents,
          day.Present || 0,
          day.Late || 0,
          day.Absent || 0,
          day.Excused || 0
        ])
      ].map(row => row.join(',')).join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance_analytics_${timeRange}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error exporting analytics:', error);
    }
  };

  if (!analyticsData) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="textSecondary">
          No attendance data available for analysis
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* Controls */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Time Range</InputLabel>
          <Select
            value={timeRange}
            label="Time Range"
            onChange={(e) => setTimeRange(e.target.value)}
            sx={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
          >
            <MenuItem value="day">Last 24 Hours</MenuItem>
            <MenuItem value="week">Last 7 Days</MenuItem>
            <MenuItem value="month">Last 30 Days</MenuItem>
            <MenuItem value="quarter">Last 90 Days</MenuItem>
          </Select>
        </FormControl>

        <Button
          variant="contained"
          startIcon={<Download />}
          onClick={exportAnalytics}
          sx={{ backgroundColor: '#4caf50' }}
        >
          Export Report
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: 'rgba(76, 175, 80, 0.1)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <People sx={{ fontSize: 40, color: '#4caf50', mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                    {analyticsData.summary.totalRecords}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Records
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
                {analyticsData.summary.trend >= 0 ? (
                  <TrendingUp sx={{ fontSize: 16, color: '#4caf50' }} />
                ) : (
                  <TrendingDown sx={{ fontSize: 16, color: '#f44336' }} />
                )}
                <Typography variant="caption" sx={{ ml: 0.5 }}>
                  {analyticsData.summary.trend >= 0 ? '+' : ''}{analyticsData.summary.trend.toFixed(1)}%
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: 'rgba(33, 150, 243, 0.1)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Schedule sx={{ fontSize: 40, color: '#2196f3', mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#2196f3' }}>
                    {analyticsData.summary.uniqueStudents}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Unique Students
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: 'rgba(76, 175, 80, 0.1)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Assessment sx={{ fontSize: 40, color: '#4caf50', mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                    {analyticsData.summary.attendanceRate.toFixed(1)}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Attendance Rate
                  </Typography>
                </Box>
              </Box>
              <LinearProgress
                variant="determinate"
                value={analyticsData.summary.attendanceRate}
                sx={{ mt: 1, height: 6, borderRadius: 3 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: 'rgba(255, 152, 0, 0.1)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Schedule sx={{ fontSize: 40, color: '#ff9800', mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ff9800' }}>
                    {analyticsData.summary.lateRate.toFixed(1)}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Late Rate
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Status Breakdown Pie Chart */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Status Distribution
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analyticsData.statusBreakdown}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                >
                  {analyticsData.statusBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Daily Trends Line Chart */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Daily Attendance Trend
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analyticsData.dailyTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#2196f3" strokeWidth={2} />
                <Line type="monotone" dataKey="uniqueStudents" stroke="#4caf50" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Hourly Distribution */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: 300 }}>
            <Typography variant="h6" gutterBottom>
              Peak Attendance Hours
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.hourlyTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <RechartsTooltip />
                <Bar dataKey="count" fill="#ff9800" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Department Breakdown */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: 300 }}>
            <Typography variant="h6" gutterBottom>
              Department Distribution
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.departmentBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="department" />
                <YAxis />
                <RechartsTooltip />
                <Bar dataKey="count" fill="#9c27b0" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Top Students Table */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Most Active Students
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Rank</TableCell>
                <TableCell>Student ID</TableCell>
                <TableCell align="right">Attendance Count</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {analyticsData.topStudents.map((student, index) => (
                <TableRow key={student.id} hover>
                  <TableCell>#{index + 1}</TableCell>
                  <TableCell>{student.id}</TableCell>
                  <TableCell align="right">
                    <Chip 
                      label={student.count}
                      size="small"
                      color={index < 3 ? "primary" : "default"}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => setDetailsDialog({ 
                          open: true, 
                          data: { studentId: student.id, count: student.count }
                        })}
                      >
                        <Assessment />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Student Details Dialog */}
      <Dialog
        open={detailsDialog.open}
        onClose={() => setDetailsDialog({ open: false, data: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Student Attendance Details
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
              <Typography variant="body1">
                <strong>Student ID:</strong> {detailsDialog.data.studentId}
              </Typography>
              <Typography variant="body1">
                <strong>Total Attendance:</strong> {detailsDialog.data.count}
              </Typography>
              {/* Add more detailed statistics here */}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default AttendanceAnalytics;