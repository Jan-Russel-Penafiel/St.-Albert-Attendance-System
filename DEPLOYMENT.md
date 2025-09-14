# Deployment Guide for St. Albert Attendance System

This guide explains how to deploy the React app to Render.

## Prerequisites

1. A GitHub repository with your code
2. A [Render](https://render.com) account
3. Firebase project credentials

## Deployment Steps

### 1. Prepare Your Repository

Ensure your code is pushed to GitHub:
```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### 2. Deploy to Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "Static Site"
3. Connect your GitHub repository
4. Select the repository: `St.-Albert-Attendance-System`
5. Configure the deployment:
   - **Name**: `st-albert-attendance-system`
   - **Branch**: `main`
   - **Build Command**: `corepack enable && pnpm install && pnpm run build`
   - **Publish Directory**: `dist`

### 3. Environment Variables (Optional for Enhanced Security)

For better security, you can move Firebase configuration to environment variables:

In Render dashboard → Environment tab, add:
- `VITE_FIREBASE_API_KEY`: Your Firebase API key
- `VITE_FIREBASE_AUTH_DOMAIN`: Your auth domain
- `VITE_FIREBASE_PROJECT_ID`: Your project ID
- `VITE_FIREBASE_STORAGE_BUCKET`: Your storage bucket
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: Your messaging sender ID
- `VITE_FIREBASE_APP_ID`: Your app ID
- `VITE_FIREBASE_MEASUREMENT_ID`: Your measurement ID

### 4. Build Configuration

The project includes a `render.yaml` file that automatically configures:
- Node.js version 20.10.0 (LTS)
- Build command: `corepack enable && pnpm install && pnpm run build`
- Static file serving from `dist` directory
- Single Page Application routing (all routes redirect to index.html)

### 5. Domain and SSL

- Render provides a free subdomain: `https://st-albert-attendance-system.onrender.com`
- SSL certificate is automatically provisioned
- You can add a custom domain in the Settings tab

### 6. Automatic Deployments

- Every push to the `main` branch will trigger a new deployment
- Build logs are available in the Render dashboard
- Failed builds will not affect the live site

## Troubleshooting

### Build Failures
- Check build logs in Render dashboard
- Ensure all dependencies are in `package.json`
- Verify Node.js version compatibility

### Runtime Issues
- Check browser console for errors
- Verify Firebase configuration
- Ensure all environment variables are set correctly

### Performance
- Static sites on Render have excellent performance
- Assets are automatically cached
- Global CDN distribution included

## Manual Deployment Commands

To test the build locally before deployment:
```bash
# Install dependencies
pnpm install

# Build for production
pnpm run build

# Preview the build locally
pnpm run preview
```

## Firebase Security Rules

Ensure your Firestore security rules are properly configured for production use. Check the `firestore.rules` file and deploy updates to Firebase if needed.

## Post-Deployment Checklist

- [ ] Site loads correctly at the Render URL
- [ ] All routes work properly (SPA routing)
- [ ] Firebase authentication functions
- [ ] Firestore read/write operations work
- [ ] All features tested in production environment
- [ ] Performance is acceptable
- [ ] Security rules are production-ready