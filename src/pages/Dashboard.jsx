import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Box, Typography, Button, Paper, CircularProgress, Alert, Snackbar, Tabs, Tab } from '@mui/material';
import { auth, db } from '../firebase/config';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import BarcodeDisplay from '../components/BarcodeDisplay';

function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [tabValue, setTabValue] = useState(0);
  const [studentData, setStudentData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setUser(user);
        try {
          // First fetch student data
          const studentRef = doc(db, 'users', user.uid);
          const studentDoc = await getDoc(studentRef);
          
          if (studentDoc.exists()) {
            setStudentData(studentDoc.data());
            // Then fetch attendance history
            await fetchAttendanceHistory(user.uid);
          } else {
            setError('Student data not found. Please contact your administrator.');
          }
        } catch (err) {
          console.error('Error fetching data:', err);
          setError('Failed to fetch student data');
        }
      } else {
        navigate('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  const fetchAttendanceHistory = async (userId) => {
    try {
      const attendanceRef = collection(db, 'attendance');
      const q = query(attendanceRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      const history = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAttendanceHistory(history.sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate()));
    } catch (err) {
      console.error('Error fetching attendance history:', err);
      setError('Failed to fetch attendance history');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (err) {
      console.error('Error signing out:', err);
      setError('Failed to sign out');
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))'
      }}>
        <CircularProgress sx={{ color: 'white' }} />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        gap: 4
      }}>
        <Typography 
          variant="h4" 
          component="h1" 
          gutterBottom
          sx={{ 
            color: 'white',
            fontWeight: 600,
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
            textAlign: 'center'
          }}
        >
          Welcome, {studentData?.idNumber || user?.displayName || 'User'}!
        </Typography>

        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              width: '100%', 
              maxWidth: '500px',
              backgroundColor: 'rgba(211, 47, 47, 0.15)',
              color: '#ffb8b8',
              '& .MuiAlert-icon': {
                color: '#ffb8b8'
              },
              border: '1px solid rgba(211, 47, 47, 0.3)',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
            }}
          >
            {error}
          </Alert>
        )}

        <Paper 
          elevation={3} 
          sx={{ 
            p: 3, 
            width: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
            '&:hover': {
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.2)',
              transform: 'translateY(-5px)'
            }
          }}
        >
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            sx={{ 
              mb: 3,
              '& .MuiTab-root': {
                color: 'rgba(255, 255, 255, 0.7)',
                '&.Mui-selected': {
                  color: 'white',
                  fontWeight: 600
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: 'white'
              }
            }}
          >
            <Tab label="My Barcode" />
            <Tab label="Attendance History" />
          </Tabs>

          {tabValue === 0 && studentData && (
            <BarcodeDisplay 
              studentId={studentData.idNumber}
              studentName={studentData.idNumber}
            />
          )}

          {tabValue === 1 && (
            <>
              <Typography 
                variant="h6" 
                gutterBottom
                sx={{ 
                  color: 'white',
                  fontWeight: 600,
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                  mb: 2
                }}
              >
                Attendance History
              </Typography>

              {attendanceHistory.length === 0 ? (
                <Typography 
                  sx={{ 
                    color: 'rgba(255, 255, 255, 0.7)',
                    textAlign: 'center',
                    py: 2
                  }}
                >
                  No attendance records found
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {attendanceHistory.map((record) => (
                    <Paper
                      key={record.id}
                      sx={{
                        p: 2,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        '&:hover': {
                          transform: 'translateX(5px)',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                        }
                      }}
                    >
                      <Typography sx={{ color: 'white', fontWeight: 500 }}>
                        {record.timestamp.toDate().toLocaleDateString()}
                      </Typography>
                      <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem' }}>
                        {record.timestamp.toDate().toLocaleTimeString()}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              )}
            </>
          )}
        </Paper>

        <Button
          variant="contained"
          color="error"
          onClick={handleLogout}
          sx={{
            mt: 2,
            background: 'linear-gradient(135deg, #ff4444, #ff0000)',
            color: 'white',
            fontWeight: 'bold',
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.2)',
            '&:hover': {
              boxShadow: '0 6px 15px rgba(0, 0, 0, 0.3)',
            }
          }}
        >
          Logout
        </Button>
      </Box>

      <Snackbar 
        open={!!error} 
        autoHideDuration={6000} 
        onClose={() => setError('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setError('')} 
          severity="error" 
          sx={{ 
            width: '100%',
            backgroundColor: 'rgba(211, 47, 47, 0.15) !important',
            color: '#ffb8b8 !important',
            '& .MuiAlert-icon': {
              color: '#ffb8b8 !important'
            },
            border: '1px solid rgba(211, 47, 47, 0.3)',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
          }}
        >
          {error}
        </Alert>
      </Snackbar>

      <Snackbar 
        open={!!success} 
        autoHideDuration={6000} 
        onClose={() => setSuccess('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSuccess('')} 
          severity="success" 
          sx={{ 
            width: '100%',
            backgroundColor: 'rgba(46, 125, 50, 0.15) !important',
            color: '#b3ffb6 !important',
            '& .MuiAlert-icon': {
              color: '#b3ffb6 !important'
            },
            border: '1px solid rgba(46, 125, 50, 0.3)',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
          }}
        >
          {success}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default Dashboard; 