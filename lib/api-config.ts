// API Configuration for FlacronSport Daily
// This file contains the configuration for various APIs used in the application

export const API_CONFIG = {
  // Sports APIs
  sports: {
    // API-Football (RapidAPI)
    football: {
      baseUrl: "https://api-football-v1.p.rapidapi.com/v3",
      headers: {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY || "",
        "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
      },
      endpoints: {
        fixtures: "/fixtures",
        standings: "/standings",
        teams: "/teams",
        players: "/players",
      },
    },

    // TheSportsDB (Free tier available)
    sportsdb: {
      baseUrl: "https://www.thesportsdb.com/api/v1/json",
      endpoints: {
        leagues: "/all_leagues.php",
        teams: "/search_all_teams.php",
        events: "/eventsday.php",
      },
    },
  },

  // AI Services
  ai: {
    // Google Gemini
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || "",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-1.5-pro-latest",
    },
  },

  // Email Services
  email: {
    // Resend
    resend: {
      apiKey: process.env.RESEND_API_KEY || "",
      fromEmail: "noreply@flacronsport.com",
    },

    // ConvertKit
    convertkit: {
      apiKey: process.env.CONVERTKIT_API_KEY || "",
      apiSecret: process.env.CONVERTKIT_API_SECRET || "",
      baseUrl: "https://api.convertkit.com/v3",
    },
  },

  // Payment Processing
  payments: {
    stripe: {
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
      secretKey: process.env.STRIPE_SECRET_KEY || "",
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    },
  },

  // Database
  database: {
    firebase: {
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || "",
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY || "",
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || "",
    },
  },
}

// Rate limiting configuration
export const RATE_LIMITS = {
  sportsApi: {
    requestsPerMinute: 100,
    requestsPerDay: 1000,
  },
  geminiApi: {
    requestsPerMinute: 60,
    requestsPerDay: 1500,
  },
}

// Automation schedule configuration
export const AUTOMATION_SCHEDULE = {
  // Daily content generation at 5:30 AM UTC
  contentGeneration: "30 5 * * *",

  // Newsletter sending at 6:00 AM UTC
  newsletterSending: "0 6 * * *",

  // Live scores update every 5 minutes
  scoresUpdate: "*/5 * * * *",

  // Daily match results fetch at 5:00 AM UTC
  resultsUpdate: "0 5 * * *",
}
