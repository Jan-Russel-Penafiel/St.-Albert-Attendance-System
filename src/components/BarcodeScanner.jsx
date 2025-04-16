import { useEffect, useState, useRef } from 'react';
import { BrowserMultiFormatReader, BarcodeFormat } from '@zxing/browser';
import { Box, Typography, CircularProgress, Button, Alert, TextField, Snackbar, Paper, keyframes } from '@mui/material';

// Define scan line animation
const scanLineAnimation = keyframes`
  0% {
    transform: translateY(-10px);
  }
  50% {
    transform: translateY(10px);
  }
  100% {
    transform: translateY(-10px);
  }
`;

function BarcodeScanner({ onScanSuccess }) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [scannerInitialized, setScannerInitialized] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastScannedCode, setLastScannedCode] = useState('');
  const [lastScanTime, setLastScanTime] = useState(0);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const streamRef = useRef(null);

  // Toggle flashlight/torch if available
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    
    try {
      const track = streamRef.current.getVideoTracks()[0];
      if (!track) return;
      
      const capabilities = track.getCapabilities();
      if (!capabilities.torch) return;
      
      const newTorchState = !torchEnabled;
      await track.applyConstraints({
        advanced: [{ torch: newTorchState }],
      });
      
      setTorchEnabled(newTorchState);
      console.log("Torch toggled:", newTorchState);
    } catch (err) {
      console.error("Error toggling torch:", err);
    }
  };
  
  const initializeScanner = async () => {
    try {
      // Create a new reader
      const codeReader = new BrowserMultiFormatReader();
      
      // Request camera access with specific constraints for better barcode scanning
      const constraints = {
        video: {
          facingMode: "environment", // Use back camera if available
          width: { ideal: 1280 },
          height: { ideal: 720 },
          aspectRatio: { ideal: 1.777777778 },
          frameRate: { ideal: 30, min: 10 }
        }
      };

      try {
        // First, get camera access
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        
        // Check if torch is available
        const track = stream.getVideoTracks()[0];
        if (track) {
          const capabilities = track.getCapabilities();
          setTorchAvailable(!!capabilities.torch);
        }
        
        // Attach stream to video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        
        console.log("Camera access granted, available tracks:", stream.getVideoTracks().length);
      } catch (mediaError) {
        console.error("Media access error:", mediaError);
        throw mediaError;
      }
      
      // Get video devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      if (videoDevices.length === 0) {
        throw new Error('No camera found');
      }

      console.log("Available video devices:", videoDevices.length);
      
      // Use the first device or environment camera if available
      const deviceId = videoDevices.find(d => d.label.toLowerCase().includes('back'))?.deviceId || videoDevices[0].deviceId;
      
      console.log("Using camera:", deviceId);
      
      try {
        controlsRef.current = await codeReader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result, error) => {
            if (result) {
              const scannedText = result.getText();
              console.log("Barcode scanned successfully:", scannedText);
              
              // Simpler debounce - only check last scan time
              const currentTime = new Date().getTime();
              if (currentTime - lastScanTime > 2000) {
                setLastScanTime(currentTime);
                
                // Validate the scanned text (should be a numeric ID)
                if (/^\d+$/.test(scannedText)) {
                  onScanSuccess(scannedText);
                  setSubmitSuccess(true);
                  setTimeout(() => {
                    setSubmitSuccess(false);
                  }, 3000);
                } else {
                  console.warn("Invalid barcode format:", scannedText);
                  setError("Invalid barcode format. Please scan a valid student ID.");
                }
              } else {
                console.log("Ignoring duplicate scan");
              }
            }
            if (error && error.name !== 'NotFoundException') {
              console.warn("Barcode scan error:", error);
            }
          }
        );

        setIsScanning(true);
        setScannerInitialized(true);
      } catch (scannerError) {
        console.error("Scanner initialization error:", scannerError);
        throw scannerError;
      }
    } catch (err) {
      console.error("Scanner initialization error:", err);
      if (err.name === 'NotReadableError') {
        setCameraError({
          type: "camera_in_use",
          message: "Camera is in use by another application. Please close other apps using the camera and try again."
        });
      } else if (err.message.includes('No camera found')) {
        setCameraError({
          type: "no_camera",
          message: "No camera found. Please make sure your device has a camera and you've granted camera access."
        });
      } else if (err.name === 'NotAllowedError') {
        setCameraError({
          type: "permission_denied",
          message: "Camera access denied. Please allow camera access in your browser settings."
        });
      } else {
        setError(`Failed to initialize scanner: ${err.toString()}`);
      }
      setShowManualInput(true);
    }
  };

  useEffect(() => {
    let mounted = true;

    const startScanner = async () => {
      if (mounted) {
        console.log("Starting scanner initialization");
        await initializeScanner();
      }
    };

    startScanner();

    return () => {
      mounted = false;
      
      // Stop video stream
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        tracks.forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Stop scanner
      if (controlsRef.current) {
        console.log("Stopping scanner");
        try {
          controlsRef.current.stop();
          controlsRef.current = null;
        } catch (err) {
          console.error("Error stopping scanner:", err);
        }
      }
      
      // Clean up video
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setIsScanning(false);
      setTorchEnabled(false);
    };
  }, [onScanSuccess, retryCount]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setError('');
    setCameraError(null);
    setShowManualInput(false);
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualCode.trim()) {
      setError('Please enter an ID number');
      return;
    }

    // Validate the manual code format (assuming it's a numeric ID)
    if (!/^\d+$/.test(manualCode.trim())) {
      setError('Please enter a valid numeric ID number');
      return;
    }

    console.log("Manual code submitted:", manualCode);
    try {
      setIsSubmitting(true);
      setError('');
      
      console.log("Calling onScanSuccess with:", manualCode.trim());
      await onScanSuccess(manualCode.trim());
      
      console.log("Manual submission successful");
      setSubmitSuccess(true);
      setManualCode('');
      
      setTimeout(() => {
        setSubmitSuccess(false);
      }, 3000);
    } catch (err) {
      console.error("Error in manual submission:", err);
      setError('Failed to record attendance: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearError = () => {
    setError('');
    setCameraError(null);
  };

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
          fontSize: { xs: '1rem', sm: '1.25rem' }
        }}
      >
        Scan Barcode
      </Typography>
      
      {(error || cameraError) && (
        <Alert 
          severity={cameraError ? "warning" : "error"}
          sx={{ 
            width: '100%', 
            mb: 2,
            backgroundColor: cameraError ? 'rgba(255, 152, 0, 0.15) !important' : 'rgba(211, 47, 47, 0.15) !important',
            color: cameraError ? '#ffd180 !important' : '#ffb8b8 !important',
            '& .MuiAlert-icon': {
              color: cameraError ? '#ffd180 !important' : '#ffb8b8 !important'
            },
            border: `1px solid ${cameraError ? 'rgba(255, 152, 0, 0.3)' : 'rgba(211, 47, 47, 0.3)'}`,
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
          }} 
          onClose={clearError}
        >
          <Typography sx={{ 
            color: cameraError ? '#ffd180' : '#ffb8b8', 
            fontSize: { xs: '0.8rem', sm: '0.9rem' } 
          }}>
            {cameraError ? cameraError.message : error}
          </Typography>
          <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button 
              size="small" 
              variant="outlined" 
              onClick={handleRetry}
              sx={{ 
                color: cameraError ? '#ffd180' : '#ffb8b8',
                borderColor: cameraError ? 'rgba(255, 209, 128, 0.5)' : 'rgba(255, 184, 184, 0.5)',
                fontSize: { xs: '0.7rem', sm: '0.8rem' },
                '&:hover': {
                  borderColor: cameraError ? '#ffd180' : '#ffb8b8',
                  backgroundColor: cameraError ? 'rgba(255, 209, 128, 0.08)' : 'rgba(255, 184, 184, 0.08)'
                }
              }}
            >
              Retry Camera
            </Button>
            <Button 
              size="small" 
              variant="outlined"
              onClick={() => setShowManualInput(true)}
              sx={{ 
                color: cameraError ? '#ffd180' : '#ffb8b8',
                borderColor: cameraError ? 'rgba(255, 209, 128, 0.5)' : 'rgba(255, 184, 184, 0.5)',
                fontSize: { xs: '0.7rem', sm: '0.8rem' },
                '&:hover': {
                  borderColor: cameraError ? '#ffd180' : '#ffb8b8',
                  backgroundColor: cameraError ? 'rgba(255, 209, 128, 0.08)' : 'rgba(255, 184, 184, 0.08)'
                }
              }}
            >
              Enter Code Manually
            </Button>
          </Box>
        </Alert>
      )}

      {!scannerInitialized && !error && (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          gap: 1,
          color: 'white'
        }}>
          <CircularProgress sx={{ color: 'white' }} />
          <Typography sx={{ color: 'white', textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)', fontSize: { xs: '0.8rem', sm: '0.9rem' } }}>
            Initializing scanner...
          </Typography>
        </Box>
      )}
      
      <Paper
        elevation={3}
        sx={{
          width: '100%',
          maxWidth: { xs: '350px', sm: '500px' },
          margin: '0 auto',
          display: showManualInput ? 'none' : 'block',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
          transition: 'transform 0.3s ease, box-shadow 0.3s ease',
          '&:hover': {
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.2)',
            transform: 'translateY(-5px)'
          }
        }}
      >
        <Box sx={{ 
          position: 'relative',
          width: '100%',
          height: '300px',
          overflow: 'hidden',
          borderRadius: '12px',
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <video
            ref={videoRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '12px',
              backgroundColor: 'transparent'
            }}
            playsInline
            autoPlay
            muted
          />
          {/* Scan area overlay */}
          {isScanning && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '80%',
                height: '100px',
                border: '2px solid rgba(255, 255, 255, 0.7)',
                borderRadius: '4px',
                boxShadow: '0 0 0 5000px rgba(0, 0, 0, 0.5)',
                zIndex: 1,
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: '50%',
                  left: 0,
                  right: 0,
                  height: '2px',
                  backgroundColor: 'rgba(255, 255, 255, 0.5)',
                  animation: `${scanLineAnimation} 2s linear infinite`
                }
              }}
            />
          )}
          {!scannerInitialized && (
            <Box sx={{ 
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              color: 'white'
            }}>
              <CircularProgress sx={{ color: 'white' }} />
              <Typography sx={{ 
                color: 'white', 
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)', 
                fontSize: { xs: '0.8rem', sm: '0.9rem' } 
              }}>
                Initializing camera...
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>
      
      {!error && isScanning && !showManualInput && (
        <>
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'rgba(255, 255, 255, 0.8)', 
              mt: 2,
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
              fontWeight: 500,
              fontSize: { xs: '0.75rem', sm: '0.85rem' }
            }}
          >
            Position the barcode within the scanning area
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'rgba(255, 255, 255, 0.6)', 
              mt: 1,
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
              fontStyle: 'italic',
              fontSize: { xs: '0.7rem', sm: '0.8rem' }
            }}
          >
            Hold the barcode steady and parallel to the screen
          </Typography>
          
          {torchAvailable && (
            <Button
              variant="contained"
              onClick={toggleTorch}
              sx={{
                mt: 2,
                bgcolor: torchEnabled ? 'rgba(255, 209, 102, 0.7)' : 'rgba(255, 255, 255, 0.08)',
                color: 'white',
                fontWeight: 500,
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
                fontSize: { xs: '0.75rem', sm: '0.85rem' },
                '&:hover': {
                  bgcolor: torchEnabled ? 'rgba(255, 209, 102, 0.9)' : 'rgba(255, 255, 255, 0.15)'
                }
              }}
            >
              {torchEnabled ? 'Turn Flashlight Off' : 'Turn Flashlight On'}
            </Button>
          )}
        </>
      )}
      
      <Snackbar
        open={submitSuccess}
        autoHideDuration={3000}
        onClose={() => setSubmitSuccess(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          severity="success" 
          sx={{ 
            backgroundColor: 'rgba(46, 125, 50, 0.9)',
            color: 'white',
            width: '100%',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
          }}
        >
          <Typography variant="body2">
            Barcode scanned successfully!
          </Typography>
        </Alert>
      </Snackbar>
      
      {(showManualInput || error) && (
        <Paper
          elevation={3}
          component="form" 
          onSubmit={handleManualSubmit} 
          sx={{ 
            width: '100%', 
            maxWidth: { xs: '300px', sm: '400px' },
            mt: 2,
            p: { xs: 2, sm: 3 },
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
            '&:hover': {
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.2)',
              transform: 'translateY(-5px)'
            }
          }}
        >
          <Typography 
            variant="h6" 
            gutterBottom
            sx={{ 
              color: 'white',
              fontWeight: 600,
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
              mb: 2,
              fontSize: { xs: '0.9rem', sm: '1.1rem' }
            }}
          >
            Manual ID Input
          </Typography>
          
          {submitSuccess && (
            <Alert 
              severity="success" 
              sx={{ 
                mb: 2,
                backgroundColor: 'rgba(46, 125, 50, 0.15) !important',
                color: '#b3ffb6 !important',
                '& .MuiAlert-icon': {
                  color: '#b3ffb6 !important'
                },
                border: '1px solid rgba(46, 125, 50, 0.3)',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                fontSize: { xs: '0.75rem', sm: '0.85rem' }
              }}
            >
              <Typography sx={{ color: '#b3ffb6', fontSize: { xs: '0.75rem', sm: '0.85rem' } }}>
                Attendance recorded successfully!
              </Typography>
            </Alert>
          )}
          
          <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
            <TextField
              fullWidth
              label="Enter ID Number"
              variant="outlined"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Enter ID number"
              disabled={isSubmitting}
              inputProps={{
                pattern: "[0-9]*",
                inputMode: "numeric",
                autoComplete: "off"
              }}
              sx={{ 
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  '& fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.2)'
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.4)'
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.6)'
                  }
                },
                '& .MuiInputLabel-root': {
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: { xs: '0.8rem', sm: '0.9rem' }
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: 'white'
                },
                '& .MuiInputBase-input': {
                  color: 'white',
                  fontSize: { xs: '0.85rem', sm: '0.95rem' }
                }
              }}
            />
            <Button 
              type="submit" 
              variant="contained" 
              color="primary"
              disabled={isSubmitting}
              sx={{ 
                height: { xs: '45px', sm: '56px' }, 
                minWidth: { xs: '100%', sm: '120px' },
                mt: { xs: 1, sm: 0 },
                background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
                fontWeight: 'bold',
                fontSize: { xs: '0.8rem', sm: '0.9rem' },
                boxShadow: '0 4px 10px rgba(0, 0, 0, 0.2)',
                '&:hover': {
                  boxShadow: '0 6px 15px rgba(0, 0, 0, 0.3)',
                },
                '&:disabled': {
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  color: 'rgba(255, 255, 255, 0.3)'
                }
              }}
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </Button>
          </Box>
        </Paper>
      )}

      {!showManualInput && !error && (
        <Button 
          variant="text" 
          onClick={() => setShowManualInput(true)}
          sx={{ 
            mt: 2,
            color: 'white',
            fontWeight: 500,
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
            fontSize: { xs: '0.75rem', sm: '0.85rem' },
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.08)'
            }
          }}
        >
          Can't scan? Enter ID manually
        </Button>
      )}
    </Box>
  );
}

export default BarcodeScanner; 