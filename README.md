# Run and deploy this app

This contains everything you need to run this app locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in the backend environment (`.env` locally, or a server/secret-manager variable in production). Do not expose this key through frontend env files.
3. Run the app:
   `npm run dev`

## OpenClaw Audit (Remote Reporter)

If you want to run OpenClaw audit on a separate Ubuntu laptop and push results into `/todo`, use:

- Backend env: `OPENCLAW_AUDIT_REPORT_TOKEN`
- Optional remote-only mode: `ENABLE_OPENCLAW_AUDIT=false`
- Setup guide: `docs/openclaw-audit-remote-reporter.md`
- End-to-end flow: `docs/openclaw-audit-end-to-end.md`

# 🛠️ Technical Stack

This document outlines the modern full-stack architecture used in the **DistilledChild** portfolio project. The application combines high-performance frontend rendering with real-time backend capabilities.

## 💻 Core Technologies

| Category | Technology | Description |
| :--- | :--- | :--- |
| **Language** | **TypeScript** | Provides static typing for enhanced code reliability and developer experience. (Node.js backend uses JavaScript). |
| **Frontend** | **React + Vite** | Utilizes Vite for lightning-fast builds and HMR, powering a modern React application. |
| **Styling** | **Tailwind CSS** | Utility-first CSS framework for rapid, consistent, and responsive UI development. |
| **3D Graphics** | **Three.js (R3F)** | Implements the interactive 3D DNA double-helix visualization using `@react-three/fiber`. |
| **Data Viz** | **Recharts** | React-based composable charting library used for the Research page visualizations. |
| **Hi-C Browser** | **D3.js + HTML5 Canvas** | Custom-built genome browser for visualizing chromatin loops and gene regulation using `d3-scale` and Canvas API for high performance. |
| **Backend** | **Node.js + Socket.io** | Custom server handling real-time bidirectional communication for the chat feature. |
| **Database** | **MongoDB** | NoSQL database used for storing Tech and Bio posts and user interactions (likes, views). |

## ☁️ Infrastructure & Deployment

The application employs a decoupled architecture for optimal performance and cost-efficiency.

### 1. Frontend Hosting: [Vercel](https://vercel.com)
- **Role**: Hosts the static assets and React application.
- **Domain**: `distilledchild.space`
- **Why Vercel**: Optimized for React/Vite, providing global CDN distribution and automatic deployments via GitHub integration.

### 2. Backend Hosting: [Railway](https://railway.app)
- **Role**: Hosts the persistent Node.js server for Socket.io.
- **Why Railway**: Unlike serverless functions (which sleep), Railway provides a persistent environment required for maintaining active WebSocket connections for the real-time chat queue system.

## 🎨 Design System

- **Core**: Built on **Tailwind CSS** with a custom color palette (`pastel-green`, `pastel-blue`, etc.) to match the brand identity.
- **Animations**:
  - **Native CSS Keyframes**: Used for lightweight, performant animations (e.g., blinking text, modal transitions) instead of heavy libraries like Framer Motion.
  - **Glassmorphism**: Applied semi-transparent, blurred backgrounds to UI elements like the chat interface and cards.
- **Icons**: **Lucide React** for clean, consistent, and lightweight SVG icons.

## 🏃 Strava OAuth 2.0 Integration

The application integrates with Strava's API to fetch and display workout activities. The OAuth 2.0 flow follows these steps:

### Authorization Flow

1. **Initiate Authorization**
   - User clicks "Test Strava Connection" button
   - Frontend requests authorization URL from backend (`GET /api/strava/auth`)
   - User is redirected to Strava's authorization page:
     ```
     https://www.strava.com/oauth/authorize?
       client_id={CLIENT_ID}&
       response_type=code&
       redirect_uri=http://localhost:3000/strava/callback&
       approval_prompt=force&
       scope=read,activity:read_all,profile:read_all,read_all
     ```

2. **User Grants Permission**
   - User reviews and approves the requested permissions on Strava's page
   - Strava redirects back to the application with an authorization code:
     ```
     http://localhost:3000/strava/callback?code={AUTHORIZATION_CODE}&scope=...
     ```

3. **Exchange Code for Access Token**
   - Callback page extracts the authorization code from URL parameters
   - Sends code to backend (`POST /api/strava/exchange_token`)
   - Backend exchanges code for access token via Strava's token endpoint:
     ```
     POST https://www.strava.com/oauth/token
     {
       client_id: {CLIENT_ID},
       client_secret: {CLIENT_SECRET},
       code: {AUTHORIZATION_CODE},
       grant_type: "authorization_code"
     }
     ```
   - Response includes `access_token`, `refresh_token`, and athlete profile

4. **Fetch Activity Data**
   - Using the access token, request athlete's activities:
     ```
     GET https://www.strava.com/api/v3/athlete/activities?access_token={ACCESS_TOKEN}
     ```
   - Activities are stored in localStorage for persistence
   - User is redirected to the Interests page where activities are displayed

### Data Display Features

- **Monthly Statistics**: Bar chart showing total distance by activity type (Walk, Bike, Run)
- **Activity Counters**: Circular badges displaying monthly activity counts
- **Paginated Table**: Activity details with 5 rows per page
- **Activity Types**: Color-coded badges for different sport types

### Security Note

**Why automatic OAuth approval is not possible:**
- Strava's authorization page is hosted on a different domain
- Browser's Same-Origin Policy prevents cross-domain JavaScript execution
- OAuth 2.0 security model requires explicit user consent
- Attempting to automate this would violate security principles and is technically blocked by browsers

---
*This project demonstrates a blend of domain expertise in 3D Genomics (Data Visualization) with modern Web Engineering (3D Graphics, Real-time Systems, OAuth Integration).*
