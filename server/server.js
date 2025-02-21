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

        // Store both tokens in HTTP-only cookies
        res.cookie('access_token', access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Secure in production
            sameSite: 'lax',
        });

        res.cookie('refresh_token', refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
        });

        // Redirect to frontend without leaking tokens in the URL
        res.redirect(`${FRONTEND_URI}`);
    } catch (error) {
        console.error('Error exchanging code for tokens:', error.response?.data || error.message);
        res.status(500).send('Authentication failed.');
    }
});

app.get('/token', (req, res) => {
    const access_token = req.cookies.access_token;
    if (!access_token) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({ access_token });
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

app.post("/search-songs", async (req, res) => {
    const query = req.body.query;
    const accessToken = req.cookies.access_token; // Ensure access token is stored in cookies

    if (!accessToken) {
        return res.status(401).send('Unauthorized: Access token missing');
    }

    try {
        // Make a request to Spotify API for song search
        const response = await axios.get("https://api.spotify.com/v1/search", {
            params: {
                q: query,
                type: "track",
                limit: 10, // Adjust the number of results
            },
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        // Extract relevant song details
        const songs = response.data.tracks.items.map((track) => ({
            name: track.name,
            artist: track.artists.map(artist => artist.name).join(", "), // Join multiple artists if applicable
            album: track.album.name,
            preview_url: track.preview_url, // Optional: Add song preview if needed
        }));

        // Send the song data to the frontend
        res.json(songs);
    } catch (error) {
        console.error("Error searching songs:", error);
        res.status(500).send("Error searching Spotify");
    }
});


// Serve static files
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "assets", "index.html"));
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port http://localhost:${PORT}`));