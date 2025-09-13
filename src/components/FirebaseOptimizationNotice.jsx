import React, { useState, useEffect } from 'react';
import { Alert, Snackbar, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const FirebaseOptimizationNotice = () => {
  const [showNotice, setShowNotice] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if user has dismissed the notice before
    const hasSeenNotice = localStorage.getItem('firebase-optimization-notice-dismissed');
    
    // Since Firebase indexes should be built by now, we don't need to show this notice
    // This component is kept for future Firebase optimization scenarios
    if (!hasSeenNotice && !dismissed) {
      // Only show if there's an actual optimization in progress
      // For now, we'll keep it hidden since the indexes should be ready
    }
  }, [dismissed]);

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setShowNotice(false);
  };

  const handleDismiss = () => {
    setShowNotice(false);
    setDismissed(true);
    localStorage.setItem('firebase-optimization-notice-dismissed', 'true');
  };

  return (
    <Snackbar
      open={showNotice}
      autoHideDuration={10000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        severity="info"
        sx={{
          backgroundColor: 'rgba(25, 118, 210, 0.9)',
          color: 'white',
          '& .MuiAlert-icon': { color: 'white' }
        }}
        action={
          <IconButton
            size="small"
            color="inherit"
            onClick={handleDismiss}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      >
        🔧 System Optimization in Progress: Database indexes are building for improved performance. 
        Current functionality is unaffected.
      </Alert>
    </Snackbar>
  );
};

export default FirebaseOptimizationNotice;