# TeleMedSecure Production Deployment Guide

## Overview
- **Frontend**: Vercel - https://telemedicsecure.vercel.app/
- **Backend**: Render - https://telemedsecure-backend.onrender.com/
- **Database**: PostgreSQL (Render Postgres)

## Prerequisites
- GitHub repository with code
- Vercel account (connected to GitHub)
- Render account (connected to GitHub)

## Backend Deployment (Render)

### 1. Database Setup
1. Go to Render Dashboard
2. Create a new PostgreSQL database
3. Name it: `telemedsecure-db`
4. Copy the internal database URL

### 2. Environment Variables
Set these in Render dashboard:
```env
DATABASE_URL=<your-render-postgres-connection-string>
PORT=10000
JWT_SECRET=<generate-a-strong-secret>
JWT_REFRESH_SECRET=<generate-a-strong-secret>
FRONTEND_URL=https://telemedicsecure.vercel.app
NODE_ENV=production
```

### 3. Deploy via Render.yaml
The `render.yaml` file is already configured. Simply:
1. Push code to GitHub
2. In Render, create a new "Web Service"
3. Connect to your GitHub repository
4. Render will auto-detect the `render.yaml` file
5. Click "Deploy Web Service"

### 4. Run Migrations
After deployment, the start script will automatically:
- Run `prisma migrate deploy` to apply migrations
- Run `prisma db seed` to seed demo users

### 5. Verify Backend
Check health endpoint:
```
https://telemedsecure-backend.onrender.com/health
```

## Frontend Deployment (Vercel)

### 1. Environment Variables
Set these in Vercel project settings:
```env
VITE_API_URL=https://telemedsecure-backend.onrender.com
VITE_WS_URL=https://telemedsecure-backend.onrender.com
```

### 2. Deploy via Vercel CLI or Dashboard
The `vercel.json` file is already configured. Simply:
1. Push code to GitHub
2. In Vercel, import the GitHub repository
3. Vercel will auto-detect the `vercel.json` file
4. Click "Deploy"

### 3. Verify Frontend
Visit: https://telemedicsecure.vercel.app/

## Production Login Credentials

After seeding, these credentials will be available:

| Role | Email | Password |
|------|-------|----------|
| Doctor | doctor1@telemed.com | Password123! |
| Patient | patient1@telemed.com | Password123! |
| Nurse | nurse1@telemed.com | Password123! |
| Admin | admin@telemed.com | Password123! |

## CORS Configuration

Both services are configured to allow:
- `https://telemedicsecure.vercel.app` (production frontend)
- `https://telemedsecure-backend.onrender.com` (production backend)
- Local development URLs (localhost, 127.0.0.1)

## WebSocket Configuration

The backend Socket.IO server is configured to accept connections from:
- Production frontend URL
- Local development URLs

## Monitoring

### Backend Health Check
```bash
curl https://telemedsecure-backend.onrender.com/health
```

### Frontend
Visit https://telemedicsecure.vercel.app/ and check browser console for API configuration logs.

## Troubleshooting

### Backend won't start
- Check Render logs for database connection errors
- Verify DATABASE_URL is correct
- Ensure migrations ran successfully

### Frontend can't connect to backend
- Check browser console for CORS errors
- Verify VITE_API_URL is set correctly in Vercel
- Check backend is running and accessible

### Login fails
- Verify database was seeded with users
- Check backend logs for authentication errors
- Ensure JWT secrets are set in environment variables

## Security Notes

1. **JWT Secrets**: Generate strong, unique secrets for production
2. **Database**: Use Render's internal PostgreSQL (not public)
3. **HTTPS**: Both Vercel and Render enforce HTTPS
4. **CORS**: Only allow production and trusted origins
5. **Rate Limiting**: Configured to prevent brute force attacks

## Updates

To deploy updates:
1. Push changes to GitHub
2. Render will auto-deploy backend
3. Vercel will auto-deploy frontend
4. Monitor deployment logs for errors
