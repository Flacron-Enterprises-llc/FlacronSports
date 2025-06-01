# FlacronSport Daily

A modern sports platform built with Next.js, featuring live scores and sports blog content.

## Features

### 🏈 Live Sports Data
- **Free API Integration**: Uses TheSportsDB public API (no API key required)
- **Today's Matches**: Real-time match data
- **Yesterday's Results**: Completed match results
- **Multiple Sports**: Football, Basketball, Tennis, Ice Hockey, and more
- **Filtering**: Filter by sport, league, or date

### 📝 Blog System
- **Dynamic Articles**: SEO-optimized blog posts
- **Responsive Design**: Mobile-first approach
- **Search & Filter**: Find articles by topic or date

### 🔥 Firebase Integration
- **Data Storage**: Automatic match data storage in Firestore
- **Real-time Updates**: Live data synchronization
- **Scalable**: Cloud-based data management

## Tech Stack

- **Frontend**: Next.js 14, TailwindCSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: Firebase Firestore
- **Sports API**: TheSportsDB (free public API)
- **Deployment**: Vercel

## Getting Started

### Prerequisites
- Node.js 18+
- Firebase project
- Vercel account (for deployment)

### Installation

1. Clone the repository:
\`\`\`bash
git clone <your-repo-url>
cd flacron-sport-daily
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Set up environment variables:
\`\`\`bash
cp .env.example .env.local
\`\`\`

4. Configure Firebase:
- Create a Firebase project
- Enable Firestore
- Create a service account
- Add the credentials to your `.env.local`

5. Run the development server:
\`\`\`bash
npm run dev
\`\`\`

6. Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

\`\`\`env
# Firebase Configuration
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your_service_account_email@project.iam.gserviceaccount.com
\`\`\`

## API Endpoints

### Sports Data
- `GET /api/matches/today` - Today's matches
- `GET /api/matches/yesterday` - Yesterday's results
- `GET /api/matches/live` - Live matches
- `GET /api/matches/date/[date]` - Matches for specific date

### Health Check
- `GET /api/health` - System health status

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically

### Manual Deployment

\`\`\`bash
npm run build
npm start
\`\`\`

## Features Overview

### ✅ Implemented
- Next.js with TailwindCSS
- Two main pages: Live Scores and Blog
- Routing for dynamic blog articles
- Filtering by sport, league, or date
- TheSportsDB integration
- Fetch today's matches
- Fetch yesterday's results
- Store match data in Firebase Firestore

### 🎯 Core Benefits
- **100% Free**: No API costs with TheSportsDB
- **Real-time Data**: Live sports scores and results
- **Scalable**: Firebase backend handles growth
- **SEO Optimized**: Blog system for content marketing
- **Mobile Ready**: Responsive design for all devices

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details
