# Firebase Deployment Guide

## Prerequisites

1. **Install Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

## Initial Setup

### 1. Initialize Firebase in Your Project

If not already done, initialize Firebase:
```bash
firebase init
```

Select:
- ☑ Firestore: Configure security rules and indexes files
- ☑ Hosting: Configure files for Firebase Hosting and (optionally) GitHub Action deploys

### 2. Configure Firestore

The project includes pre-configured files:
- `firestore.rules` - Security rules
- `firestore.indexes.json` - Composite indexes
- `.firebaserc` - Project configuration

## Deployment Steps

### 1. Deploy Firestore Rules and Indexes

**Important**: This step is required for the application to work properly.

```bash
firebase deploy --only firestore
```

This command will:
- Deploy security rules to protect your data
- Create composite indexes required for complex queries
- Set up proper permissions for all collections

### 2. Deploy to Firebase Hosting (Optional)

First, build the project:
```bash
npm run build
```

Then deploy:
```bash
firebase deploy --only hosting
```

## Required Firestore Collections

The application will automatically create these collections when used:

### Core Collections
- **users**: User profiles with roles and authentication data
- **attendance**: Attendance records with timestamps and student information

### Security Collections
- **audit_logs**: System audit trail for security monitoring
- **security_events**: Security alerts and suspicious activity tracking
- **user_sessions**: Active user session management

### Analytics Collections
- **system_settings**: Application configuration and settings

## Security Configuration

### Firestore Security Rules

The deployed rules provide:
- **User Data Protection**: Users can only access their own data
- **Admin Privileges**: Admins can read/write all user and attendance data
- **Authenticated Access**: All operations require authentication
- **Collection Isolation**: Proper permissions for each collection type

### Composite Indexes

Required indexes for optimal performance:
1. **Attendance by Student**: `studentId` + `timestamp` (descending)
2. **Attendance by Date**: `date` + `timestamp` (descending)
3. **Audit Logs**: `userId` + `timestamp` (descending)
4. **Security Events**: `userId` + `timestamp` (descending)
5. **User Sessions**: `userId` + `lastActivity` (descending)

## Troubleshooting

### Common Issues

1. **"Missing or insufficient permissions"**
   - Run: `firebase deploy --only firestore:rules`
   - Wait 1-2 minutes for rules to propagate

2. **"The query requires an index"**
   - Run: `firebase deploy --only firestore:indexes`
   - Wait 5-10 minutes for indexes to build
   - Check progress in Firebase Console → Firestore → Indexes

3. **"Permission denied on collection"**
   - Verify user authentication is working
   - Check that user has proper role in Firestore
   - Ensure security rules are deployed

### Monitoring Deployment

1. **Check Rules Deployment**:
   - Firebase Console → Firestore → Rules
   - Verify the rules match your `firestore.rules` file

2. **Monitor Index Building**:
   - Firebase Console → Firestore → Indexes
   - Status should show "Building" then "Enabled"

3. **Test Database Access**:
   - Use the Firebase Console to test read/write operations
   - Verify authentication works in your application

## Production Checklist

Before going live:

- [ ] Deploy Firestore rules and indexes
- [ ] Test authentication with real users
- [ ] Verify all security collections work properly
- [ ] Test attendance recording and retrieval
- [ ] Confirm admin dashboard functionality
- [ ] Test mobile responsiveness
- [ ] Verify backup and export features
- [ ] Set up monitoring and alerts

## Maintenance

### Regular Updates
- Monitor Firebase usage and quotas
- Review security logs for suspicious activity
- Update indexes as queries evolve
- Keep Firebase SDK and dependencies updated

### Backup Strategy
- Enable Firestore automatic backups
- Export critical data regularly
- Test restore procedures periodically
- Maintain documentation of schema changes

## Support

For issues with:
- **Firebase Configuration**: Check Firebase Console and documentation
- **Application Features**: Review the main README.md
- **Security Issues**: Check audit logs in the Security Dashboard
- **Performance**: Monitor Firebase Console → Performance tab