import { useRef, useEffect, useState } from 'react';
import { Box, Typography, Paper, Alert, Chip, CircularProgress } from '@mui/material';
import JsBarcode from 'jsbarcode';
import { BarcodeGenerator } from '../utils/barcodeGenerator';
import { useAuth } from '../contexts/AuthContext';

function BarcodeDisplay() {
  const barcodeRef = useRef(null);
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { currentUser, getUserData } = useAuth();

  useEffect(() => {
    async function fetchStudentData() {
      if (!currentUser) return;
      
      try {
        setLoading(true);
        const userData = await getUserData();
        
        if (!userData) {
          setError('Student data not found');
          return;
        }

        setStudentData(userData);
        
      } catch (err) {
        console.error('Error fetching student data:', err);
        setError('Failed to load student information');
      } finally {
        setLoading(false);
      }
    }

    fetchStudentData();
  }, [currentUser, getUserData]);

  useEffect(() => {
    if (barcodeRef.current && studentData?.barcodeId) {
      try {
        JsBarcode(barcodeRef.current, studentData.barcodeId, {
          format: "CODE128",
          width: 2,
          height: 100,
          displayValue: true,
          fontSize: 16,
          margin: 10,
          background: "white",
          lineColor: "#000000",
          textAlign: "center",
          textPosition: "bottom",
          textMargin: 6,
          fontOptions: "bold",
          flat: true,
          valid: (valid) => {
            if (!valid) {
              console.error('Invalid barcode data');
            }
          }
        });
      } catch (err) {
        console.error('Error generating barcode:', err);
      }
    }
  }, [studentData]);

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        gap: 2
      }}>
        <CircularProgress sx={{ color: 'white' }} />
        <Typography sx={{ color: 'white' }}>Loading student information...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        gap: 2
      }}>
        <Alert severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!studentData) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        gap: 2
      }}>
        <Alert severity="warning" sx={{ width: '100%' }}>
          No student data available
        </Alert>
      </Box>
    );
  }

  const barcodeValidation = BarcodeGenerator.validateBarcode(studentData.barcodeId);

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      gap: 2
    }}>
      <Typography 
        variant="h6" 
        gutterBottom
        sx={{ 
          color: 'white',
          fontWeight: 600,
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          mb: 1
        }}
      >
        Your Digital ID
      </Typography>
      
      {/* Student Information */}
      <Box sx={{ textAlign: 'center', mb: 2 }}>
        <Typography variant="body1" sx={{ color: 'white', fontWeight: 500 }}>
          {studentData.fullName}
        </Typography>
        <Chip 
          label={`${barcodeValidation.departmentName} • ${barcodeValidation.year}`}
          size="small"
          sx={{ 
            mt: 1, 
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            color: 'white'
          }}
        />
      </Box>
      
      <Typography 
        variant="body2" 
        sx={{ 
          color: 'rgba(255, 255, 255, 0.7)',
          textAlign: 'center',
          mb: 2
        }}
      >
        Show this barcode to mark your attendance
      </Typography>

      {/* Barcode */}
      <Paper
        sx={{
          p: 3,
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          transition: 'transform 0.3s ease',
          '&:hover': {
            transform: 'scale(1.02)'
          },
          mb: 2
        }}
      >
        <Box sx={{ 
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, var(--primary-color), var(--secondary-color))',
            borderRadius: '12px 12px 0 0'
          }
        }}>
          <svg ref={barcodeRef}></svg>
        </Box>
        <Typography 
          variant="body2" 
          sx={{ 
            textAlign: 'center',
            mt: 1,
            color: '#666',
            fontWeight: 500
          }}
        >
          {studentData.barcodeId}
        </Typography>
      </Paper>


    </Box>
  );
}

export default BarcodeDisplay; 