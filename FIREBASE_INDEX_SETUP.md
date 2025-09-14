# Firebase Composite Index Setup Guide

## 🚨 Required Action: Create Firebase Composite Index

Your St. Albert Attendance System requires a **composite index** in Firestore to prevent duplicate attendance entries and improve query performance.

## 📋 Index Configuration

**Collection:** `attendance`  
**Fields to Index:**
1. `idNumber` (Ascending)
2. `timestamp` (Ascending)

## 🔗 Quick Setup Methods

### Method 1: Automatic Creation via Error Link (Recommended)
1. Run your app and trigger the duplicate check by scanning a barcode twice
2. Check the browser console for the error message containing a direct Firebase link
3. Click the link in the console - it will automatically configure the index
4. Wait 1-5 minutes for the index to build

### Method 2: Manual Creation via Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **ehrsksu**
3. Navigate to **Firestore Database** → **Indexes**
4. Click **Create Index**
5. Configure the index:
   - **Collection ID:** `attendance`
   - **Field 1:** `idNumber` (Ascending)
   - **Field 2:** `timestamp` (Ascending)
   - **Query scope:** Collection
6. Click **Create**

## 🎯 Expected Query Pattern
The app uses this query to check for duplicate entries:
```javascript
query(
  collection(db, "attendance"),
  where("idNumber", "==", idNumber.trim()),
  where("timestamp", ">=", today),
  where("timestamp", "<", tomorrow)
);
```

## ⚡ Build Time
- **Small collections:** 1-2 minutes
- **Large collections:** 3-5 minutes
- **Very large collections:** Up to 10 minutes

## ✅ Verification
After the index is created:
1. Refresh your app
2. Try scanning the same barcode twice
3. You should see: "Attendance for ID [number] already recorded today at [time]"

## 📞 Troubleshooting
- **Index still building?** Wait a few more minutes and refresh
- **Still getting errors?** Check the index status in Firebase Console
- **Wrong configuration?** Delete the index and recreate it with the correct fields

## 🔒 Security Notes
This index is safe and only improves query performance. It doesn't affect your data or security rules.

---
**Firebase Project:** ehrsksu  
**Collection:** attendance  
**Required Fields:** idNumber, timestamp