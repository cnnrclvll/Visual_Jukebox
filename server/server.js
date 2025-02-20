require("dotenv").config();
const express = require("express"); // server routing
const rateLimit = require("express-rate-limit"); // rate-limiting
const morgan = require("morgan") // logging HTTP requests
const cors = require("cors"); // handling requests from a different domain/port
const path = require("path"); // path resolution
const axios = require('axios'); // API requests
const cookieParser = require("cookie-parser");
const querystring = require("querystring"); // encoding URL params

const app = express();
const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/callback';
const FRONTEND_URI = process.env.FRONTEND_URI || 'http://localhost:3000';
const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/api/token';

app.use(cors({ origin: FRONTEND_URI, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "..", "assets")));

// Rate limiting setup
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: "Too many requests, please try again later.",
});
app.use(limiter);
app.use(morgan("dev"));

// Login route (for OAuth)
app.get("/login", (req, res) => {
  const scopes = "streaming user-read-email user-read-private";
  const authURL = `https://accounts.spotify.com/authorize?response_type=code&client_id=${CLIENT_ID}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  res.redirect(authURL);
});

// Callback route to exchange authorization code for tokens
app.get('/callback', async (req, res) => {
    const code = req.query.code || null;
    if (!code) {
        return res.status(400).send('Authorization code not found.');
    }
    try {
        const response = await axios.post(SPOTIFY_AUTH_URL, new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
        }).toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        const { access_token, refresh_token } = response.data;
        res.cookie('refresh_token', refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Secure only in production
            sameSite: 'lax'
        });        
        res.redirect(`${FRONTEND_URI}/?access_token=${access_token}`);
    } catch (error) {
        console.error('Error exchanging code for tokens:', error.response?.data || error.message);
        res.status(500).send('Authentication failed.');
    }
});

// Refresh token endpoint
app.get('/refresh_token', async (req, res) => {
    const refreshToken = req.cookies.refresh_token;
    if (!refreshToken) {
        return res.status(400).send('No refresh token found.');
    }
    try {
        const response = await axios.post(SPOTIFY_AUTH_URL, new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
        }).toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        const { access_token } = response.data;
        res.json({ access_token });
    } catch (error) {
        console.error('Error refreshing token:', error.response?.data || error.message);
        res.status(500).send('Failed to refresh token.');
    }
});

// Serve static files
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "assets", "index.html"));
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port http://localhost:${PORT}`));