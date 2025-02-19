const express = require("express"); // server routing
const rateLimit = require("express-rate-limit"); // rate-limiting
const morgan = require("morgan") // logging HTTP requests
const cors = require("cors"); // handling requests from a different domain/port
const path = require("path"); // path resolution
const axios = require('axios'); // API requests
const fetch = require("node-fetch"); // API requests
const querystring = require("querystring"); // encoding URL params
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting setup
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: "Too many requests, please try again later.",
});

// Enable CORS for frontend domain
app.use(cors({ 
    origin: ["https://cnnrclvll.github.io/musicVisualizer/", "http://localhost:3000"]
}));

// Apply rate-limiting to all routes
app.use(limiter);

// Use morgan to log HTTP requests
app.use(morgan("dev"));

// Spotify API endpoints
const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/api/token";
const REDIRECT_URI = "http://localhost:3000/callback"; // Change for production

// Login route (for OAuth)
app.get("/login", (req, res) => {
  const scopes = "streaming user-read-email user-read-private";
  const authURL = `https://accounts.spotify.com/authorize?response_type=code&client_id=${process.env.SPOTIFY_CLIENT_ID}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  res.redirect(authURL);
});

// Callback route to exchange code for access token
app.get("/callback", async (req, res) => {
    const code = req.query.code || null;
    try {
      const response = await axios.post(SPOTIFY_AUTH_URL, new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: REDIRECT_URI,
        client_id: process.env.SPOTIFY_CLIENT_ID,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET,
      }).toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
  
      const { access_token, refresh_token } = response.data;
      res.json({ access_token, refresh_token });
    } catch (error) {
      console.error("Error fetching tokens:", error.response?.data || error.message);
      res.status(500).send("Authentication failed");
    }
  });
  
  // Endpoint to refresh access token
  app.get("/refresh_token", async (req, res) => {
    const refreshToken = req.query.refresh_token;
    try {
      const response = await axios.post(SPOTIFY_AUTH_URL, new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: process.env.SPOTIFY_CLIENT_ID,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET,
      }).toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
  
      const { access_token } = response.data;
      res.json({ access_token });
    } catch (error) {
      console.error("Error refreshing token:", error.response?.data || error.message);
      res.status(500).send("Failed to refresh token");
    }
  });

// Serve static assets
app.use(express.static(path.join(__dirname, "../")));

// Serve an index.html file for the root route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../index.html"));
});

// Gain Access Token
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

let accessToken = null;
let tokenExpirationTime = null;

// Function to fetch a new access token/
async function fetchAccessToken() {
    try {
        const response = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
            },
            body: querystring.stringify({
                grant_type: "client_credentials",
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Failed to fetch access token:", errorText);
            throw new Error("Failed to fetch access token");
        }

        const data = await response.json();
        accessToken = data.access_token;
        tokenExpirationTime = Date.now() + data.expires_in * 1000; // Set expiration time here

        console.log("New access token fetched:", accessToken);
    } catch (error) {
        console.error("Error fetching access token:", error);
    }
}

// Middleware to ensure a valid token exists
async function ensureValidToken(req, res, next) {
    try {
        if (!accessToken || Date.now() >= tokenExpirationTime) {
            await fetchAccessToken();
        }
        next();
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch Spotify access token" });
    }
}

// Apply token middleware to API routes
app.use("/api", ensureValidToken);

// Spotify API Proxy Route
app.get("/api/spotify-data", async (req, res) => {
    const query = req.query.q; // Extract query from request

    if (!query) {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    const SPOTIFY_API_URL = `https://api.spotify.com/v1/search?${querystring.stringify({
        q: query,
        type: "track",
        limit: 10, // Adjust limit as needed
    })}`;

    try {
        const response = await fetch(SPOTIFY_API_URL, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Spotify API Error:", errorText);
            return res.status(response.status).json({ error: "Failed to fetch data from Spotify API" });
        }

        const data = await response.json();
        console.log("Spotify API data:", data);
        res.json(data);
    } catch (error) {
        console.error("Error fetching Spotify API data:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));