import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { TextField, Button, Box, Typography, Container, Alert, MenuItem, FormControl, InputLabel, Select } from '@mui/material';
import { BarcodeGenerator } from '../utils/barcodeGenerator';

function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [department, setDepartment] = useState('');
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();

    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    if (!firstName.trim() || !lastName.trim()) {
      return setError('First name and last name are required');
    }

    if (!department) {
      return setError('Department is required');
    }

    try {
      setError('');
      setLoading(true);
      
      // Generate unique barcode ID
      const barcodeId = await BarcodeGenerator.generateUniqueBarcode(department, academicYear);
      
      const studentData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        department,
        academicYear,
        barcodeId
      };
      
      await signup(studentData, email, password);
      navigate('/dashboard');
    } catch (error) {
      setError('Failed to create an account: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-container">
      {/* Logo Circle */}
      <Box sx={{ 
        display: 'flex',
        justifyContent: 'center',
        mb: 3
      }}>
        <Box sx={{ 
          width: 100,
          height: 100,
          borderRadius: '50%',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          marginBottom: -2,
          border: '2px solid rgba(255, 255, 255, 0.2)',
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
              objectFit: 'cover',
            }}
          />
        </Box>
      </Box>
      
      {/* App Title */}
      <Typography className="app-title">
        Attendance
      </Typography>
      <Typography className="app-subtitle">
        TRACKING
      </Typography>

      {/* Form Container */}
      <div className="form-container">
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        <Box component="form" onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="firstName"
              label="First Name"
              name="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              variant="filled"
              InputProps={{
                disableUnderline: true,
              }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              id="lastName"
              label="Last Name"
              name="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              variant="filled"
              InputProps={{
                disableUnderline: true,
              }}
            />
          </Box>
          
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            variant="filled"
            InputProps={{
              disableUnderline: true,
            }}
          />
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <FormControl 
              fullWidth 
              margin="normal" 
              variant="filled"
              required
            >
              <InputLabel>Department</InputLabel>
              <Select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disableUnderline
              >
                {Object.entries(BarcodeGenerator.DEPARTMENTS).map(([code, name]) => (
                  <MenuItem key={code} value={code}>
                    {name} ({code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <TextField
              margin="normal"
              fullWidth
              id="academicYear"
              label="Academic Year"
              name="academicYear"
              type="number"
              value={academicYear}
              onChange={(e) => setAcademicYear(parseInt(e.target.value))}
              variant="filled"
              InputProps={{
                disableUnderline: true,
              }}
            />
          </Box>
          
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            variant="filled"
            InputProps={{
              disableUnderline: true,
            }}
          />
          
          <TextField
            margin="normal"
            required
            fullWidth
            name="confirmPassword"
            label="Confirm Password"
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            variant="filled"
            InputProps={{
              disableUnderline: true,
            }}
          />
          
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
          >
            {loading ? 'Registering...' : 'Register'}
          </Button>
          
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography variant="body2" sx={{ color: 'white', opacity: 0.8 }}>
              Already have an account? <Link to="/login" style={{ color: 'white', fontWeight: 'bold' }}>Log In</Link>
            </Typography>
          </Box>
        </Box>
      </div>
    </div>
  );
}

export default Register; 