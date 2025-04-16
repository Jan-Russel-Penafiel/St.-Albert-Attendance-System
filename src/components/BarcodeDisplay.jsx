import { useRef, useEffect } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import JsBarcode from 'jsbarcode';

function BarcodeDisplay({ studentId, studentName }) {
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (barcodeRef.current && studentId) {
      try {
        JsBarcode(barcodeRef.current, studentId, {
          format: "CODE128",
          width: 2,
          height: 100,
          displayValue: true,
          fontSize: 20,
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
  }, [studentId]);

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
          mb: 2
        }}
      >
        Your Barcode
      </Typography>
      <Typography 
        variant="body2" 
        sx={{ 
          color: 'rgba(255, 255, 255, 0.7)',
          textAlign: 'center',
          mb: 2
        }}
      >
        Show this barcode to your instructor to mark your attendance
      </Typography>
      <Paper
        sx={{
          p: 3,
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          transition: 'transform 0.3s ease',
          '&:hover': {
            transform: 'scale(1.02)'
          }
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
        {studentName && (
          <Typography 
            variant="body2" 
            sx={{ 
              textAlign: 'center',
              mt: 1,
              color: '#666',
              fontWeight: 500
            }}
          >
            {studentName}
          </Typography>
        )}
      </Paper>
    </Box>
  );
}

export default BarcodeDisplay; 