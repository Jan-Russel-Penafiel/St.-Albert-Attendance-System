
# Student Attendance Tracking System

A modern web application built with React and Vite for tracking student attendance using QR code scanning technology. This system allows students to display their unique QR codes for attendance marking, while administrators can scan these codes to record attendance.

## Features

### Core Attendance System
- 🔐 **Secure Authentication**: Student and admin roles with Firebase Authentication
- 📱 **Mobile-First Design**: Responsive interface optimized for smartphones and tablets
- 📊 **Real-time Dashboard**: Live attendance tracking and data visualization
- 🔍 **Unique Barcode System**: Individual QR codes for each student to prevent duplication
- 📷 **Enhanced Scanner**: Fast, accurate QR code scanning with fallback manual entry
- � **Live Data Sync**: Real-time attendance updates across all devices

### Advanced Security & Management
- 🛡️ **Comprehensive Security**: Role-based access control with audit logging
- 📈 **Analytics Dashboard**: Interactive charts showing attendance patterns and trends
- 🔍 **Security Monitoring**: Real-time security event tracking and alerts
- � **Bulk Operations**: Efficient management of multiple attendance records
- 🎯 **Session Management**: Secure user session tracking with automatic timeout
- 📊 **Performance Metrics**: System evaluation for accuracy, usability, and efficiency

### Data Management
- ☁️ **Cloud Integration**: Secure Firebase Firestore real-time database
- 📊 **Advanced Analytics**: Comprehensive reporting with interactive visualizations
- � **Data Synchronization**: Automatic backup and sync across devices
- 📱 **Offline Capability**: Graceful handling when internet connection is unavailable
- � **Smart Filtering**: Advanced search and filter options for attendance records
- 📈 **Export Features**: Data export capabilities for external analysis

## Technologies Used

- React + Vite for fast and efficient frontend development
- Firebase Authentication for user management
- Firestore for database storage
- Material UI for responsive component styling
- HTML5-QRCode library for QR scanning functionality
- date-fns for date formatting

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v16.0.0 or later recommended)
- pnpm, npm (v7.0.0 or later), or yarn
- Git

## Installation

### Step 1: Install pnpm (if not already installed)

```bash
# Using npm
npm install -g pnpm

# Using Homebrew on macOS
brew install pnpm

# Using Scoop on Windows
scoop install pnpm
```

Verify the installation:
```bash
pnpm --version
```

### Step 2: Clone the repository

```bash
git clone https://github.com/yourusername/student-attendance-system.git
cd student-attendance-system
```

### Step 3: Install dependencies

```bash
# Using pnpm (recommended)
pnpm install

# Using npm
npm install

# Using yarn
yarn
```

### Step 4: Set up Firebase

1. Create a Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Enable Authentication (Email/Password method)
3. Create a Firestore database
4. Register your web app in Firebase to get your configuration
5. Create a `.env` file in the project root with your Firebase configuration:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### Step 5: Set up Firebase Firestore

1. **Deploy Security Rules and Indexes** (Required for the application to work properly):

   First, install Firebase CLI if you haven't already:
   ```bash
   npm install -g firebase-tools
   ```

   Login to Firebase:
   ```bash
   firebase login
   ```

   Deploy the Firestore rules and indexes:
   ```bash
   firebase deploy --only firestore
   ```

   This will deploy:
   - Security rules from `firestore.rules`
   - Composite indexes from `firestore.indexes.json`

2. **Database Collections Structure**:

   The following collections will be automatically created when you use the app:
   - `users` - User profile data (email, idNumber, role, etc.)
   - `attendance` - Attendance records (studentId, timestamp, status, etc.)
   - `audit_logs` - Security audit logs for admin monitoring
   - `security_events` - Security events and alerts
   - `user_sessions` - User session tracking for security

3. **Create an Admin User**:
   
   After deploying, you can create an admin user by:
   - Registering a new account through the app
   - Manually updating the user document in Firestore to set `role: 'admin'`
   - Or use the admin setup feature (navigate to `/admin-setup` after registration)

## Running the Application

### Development Mode

```bash
# Using pnpm (recommended)
pnpm run dev

# Using npm
npm run dev

# Using yarn
yarn dev
```

The application will run on [http://localhost:5173](http://localhost:5173) by default.

To run on a specific port:
```bash
pnpm run dev -- --port 3000
```

### Production Build

```bash
# Using pnpm
pnpm run build

# Using npm
npm run build

# Using yarn
yarn build
```

### Preview Production Build Locally

```bash
# Using pnpm
pnpm run preview

# Using npm
npm run preview

# Using yarn
yarn preview
```

## Environment Setup

For development, you can create a `.env.development` file with development-specific variables:
```
VITE_API_URL=http://localhost:8080/api
VITE_DEBUG_MODE=true
```

For production, create a `.env.production` file:
```
VITE_API_URL=https://api.yourdomain.com
VITE_DEBUG_MODE=false
```

## Usage Instructions

### For Students:

1. **Registration and Login**
   - Create an account or log in with your credentials
   - Your profile will display your unique ID number

2. **Viewing Your QR Code**
   - On the Dashboard's "Profile" tab, you'll see your personal QR code
   - This QR code contains your ID number for attendance tracking
   - Present this QR code to your instructor during class

3. **Checking Attendance Records**
   - Navigate to the "Attendance Records" tab
   - View your complete attendance history with dates and status
   - The records are sorted with the most recent at the top
   - Use the "Refresh" button to update your records

### For Administrators:

1. **Scanning Attendance**
   - Log in with admin credentials
   - Navigate to the "Scan QR" tab in the Dashboard
   - Use the scanner to scan student QR codes
   - The system will automatically record the attendance

2. **Manual ID Entry**
   - If scanning is difficult, use the "Enter ID manually" option
   - Type the student ID number and submit
   - Confirmation will appear when attendance is recorded

3. **Managing Records**
   - View all attendance records in the system
   - Records show date, time, and attendance status (Present, Late, Absent, Excused)

## Project Structure

```
src/
├── components/        # Reusable UI components
│   ├── LoadingSpinner.jsx
│   └── QRScanner.jsx
├── contexts/          # React context providers
│   └── AuthContext.jsx
├── firebase/          # Firebase configuration
│   └── config.js
├── pages/             # Main application pages
│   ├── Dashboard.jsx
│   ├── Login.jsx
│   └── Register.jsx
├── utils/             # Utility functions
│   └── qrCode.js
├── App.jsx            # Main application component
└── main.jsx           # Entry point
```

## Mobile Optimization

The application is optimized for mobile devices with:
- Responsive layouts that adapt to different screen sizes
- Smaller UI elements and fonts on mobile screens
- Optimized QR scanner for mobile cameras
- Touch-friendly buttons and input fields
- Streamlined navigation for smaller screens

## Performance Optimization

To ensure optimal performance, the project uses:
- Code splitting for faster initial load times
- Lazy loading of components where appropriate
- Optimized bundle size through Vite's build process
- Image optimization for faster loading

## Troubleshooting

### QR Scanner Issues
- Ensure your camera is working and has proper permissions
- Make sure there is adequate lighting when scanning
- Position the QR code within the scanning frame
- If scanning fails, use the manual input option
- Try using a different browser if camera access is problematic

### Login Problems
- Verify your email and password
- Check your internet connection
- Clear browser cache and cookies
- Contact an administrator if you cannot access your account

### Development Server Issues
- If `pnpm run dev` fails to start, check that port 5173 is not in use
- Verify all dependencies are correctly installed with `pnpm install`
- Check for any error messages in the console
- Try running with the verbose flag: `pnpm run dev --verbose`

## Building for Production

```bash
# Using pnpm
pnpm run build

# Using npm
npm run build

# Using yarn
yarn build
```

This will generate a `dist` folder with optimized production files that can be deployed to any static hosting service.

## Deployment

You can deploy the built application to services like:
- Firebase Hosting
- Vercel
- Netlify
- GitHub Pages

### Deploying to Firebase Hosting

1. Install Firebase CLI:
```bash
pnpm add -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

3. Initialize Firebase Hosting:
```bash
firebase init hosting
```

4. Deploy the application:
```bash
firebase deploy --only hosting
```

## License

This project is licensed under the MIT License.

---

This project was bootstrapped with [Vite](https://vitejs.dev/) using the React template.
