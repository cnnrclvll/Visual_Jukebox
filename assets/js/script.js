// Wait for the DOM content to load
document.addEventListener('DOMContentLoaded', function() {
    // Get the audio element
    const audio = document.getElementById('audio');
    
    // Set the initial volume level (between 0 and 1)
    audio.volume = 0.1; // Example volume level (30% of maximum volume)
});

const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Spotify API endpoints
const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/api/token';
const REDIRECT_URI = 'http://localhost:3000/callback'; // Change for production

// Endpoint to authenticate with Spotify
app.get('/login', (req, res) => {
    const scopes = 'streaming user-read-email user-read-private';
    const authURL = `https://accounts.spotify.com/authorize?response_type=code&client_id=${process.env.SPOTIFY_CLIENT_ID}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    res.redirect(authURL);
});

// Callback to exchange code for tokens
app.get('/callback', async (req, res) => {
    const code = req.query.code || null;
    try {
        const response = await axios.post(SPOTIFY_AUTH_URL, new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
            client_id: process.env.SPOTIFY_CLIENT_ID,
            client_secret: process.env.SPOTIFY_CLIENT_SECRET,
        }).toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        const { access_token, refresh_token } = response.data;
        res.json({ access_token, refresh_token });
    } catch (error) {
        console.error('Error fetching tokens:', error.response?.data || error.message);
        res.status(500).send('Authentication failed');
    }
});

// Endpoint to refresh the access token
app.get('/refresh_token', async (req, res) => {
    const refreshToken = req.query.refresh_token;
    try {
        const response = await axios.post(SPOTIFY_AUTH_URL, new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: process.env.SPOTIFY_CLIENT_ID,
            client_secret: process.env.SPOTIFY_CLIENT_SECRET,
        }).toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        const { access_token } = response.data;
        res.json({ access_token });
    } catch (error) {
        console.error('Error refreshing token:', error.response?.data || error.message);
        res.status(500).send('Failed to refresh token');
    }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));


// Display Results Function
function displayResults(tracks) {
    console.log("Tracks to display:", tracks);
    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = '';

    if (tracks.length === 0) {
        resultsContainer.innerHTML = '<p>No results found</p>';
        return;
    }

    const ul = document.createElement('ul');
    ul.classList.add('song-results-list');
    ul.setAttribute('id', 'song-results');
    let count = 0;

    tracks.forEach(track => {
        if (count < 5) {
            if (!track.preview_url) return;

            const li = document.createElement('li');
            li.textContent = `${track.name} - ${track.artists[0].name}`;
            li.onclick = function () {
                handleTrackSelection(track);
            };
            ul.appendChild(li);
            count++;
        } else {
            return;
        }
    });

    resultsContainer.appendChild(ul);
}

// Handle Track Selection
function handleTrackSelection(track) {
    const volumeSlider = document.getElementById('volume-slider');
    volumeSlider.style.display = 'block';

    // Update audio element
    const audio = document.getElementById('audio');
    audio.src = track.preview_url;
    audio.play();

    // Update Now Playing information
    document.getElementById('np-artist').textContent = track.artists[0].name;
    document.getElementById('np-song').textContent = track.name;

    // Fetch lyrics for the selected track
    fetchLyrics(track.artists[0].name, track.name);
}

// Fetch Lyrics
function fetchLyrics(artist, title) {
    const lyricsElement = document.getElementById('lyrics');
    lyricsElement.innerHTML = 'Loading lyrics...';

    fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`)
        .then(response => response.json())
        .then(data => {
            if (data.lyrics) {
                const stanzas = data.lyrics.split('\n\n');
                lyricsElement.innerHTML = '';
                stanzas.forEach((stanza, index) => {
                    const stanzaElement = document.createElement('p');
                    stanzaElement.textContent = stanza;
                    stanzaElement.style.display = index === 0 ? 'block' : 'none'; // Show the first stanza, hide others
                    stanzaElement.onclick = () => showNextStanza(index); // Set onclick handler to show the next stanza
                    lyricsElement.appendChild(stanzaElement);
                });
            } else {
                lyricsElement.textContent = 'Lyrics not found.';
            }
        })
        .catch(error => {
            console.error('Error fetching lyrics:', error);
            lyricsElement.textContent = 'Error fetching lyrics.';
        });
}

// Show Next Stanza
function showNextStanza(index) {
    const lyricsElement = document.getElementById('lyrics');
    const stanzas = lyricsElement.querySelectorAll('p');
    const totalStanzas = stanzas.length;

    if (index < totalStanzas - 1) {
        stanzas[index].style.display = 'none';
        stanzas[index + 1].style.display = 'block';
    } else {
        stanzas[index].style.display = 'none';
        stanzas[0].style.display = 'block';
    }
}

var API_KEY = '43005631-c2ca87ba477823d6f27abd8e4';


function fetchBgs() {
    const searchInputBg = document.getElementById('search-bgs').value.trim();
    var URL = "https://pixabay.com/api/videos/?key="+API_KEY+"&q="+searchInputBg;

    $.getJSON(URL, function(data) {
        if (parseInt(data.totalHits) > 0) {
            const bgList = document.getElementById('results-bgs');
            const hits = data.hits;
            const shuffledHits = shuffleArray(hits);
            const ul = document.createElement('ul');
            ul.setAttribute('id', 'list-bgs');
            const maxItems = Math.min(shuffledHits.length, 6); // Maximum of 5 list items

            for (let i = 0; i < maxItems; i++) {
                const hit = shuffledHits[i];
                const li = document.createElement('li');
                const img = document.createElement('img');
                img.src = hit.videos.tiny.thumbnail;
                img.alt = hit.tags;
                img.setAttribute('data-video-url', hit.videos.large.url); // Set data attribute for video URL
                img.onclick = function() { // Add onclick event handler
                    document.getElementById('search-bgs').value = '';
                    ul.remove(); // Remove the <ul> element from the DOM
                    const videoUrl = this.getAttribute('data-video-url');
                    $('#bg-fill').css('background-image', 'none');
                    $('#bg-fill').html('<video autoplay muted loop><source src="' + videoUrl + '" type="video/mp4"></video>');
                    
                    // Make the video fill the viewport
                    $('#bg-fill video').css({
                        'position': 'fixed',
                        'top': 0,
                        'left': 0,
                        'width': '100%',
                        'height': '100%',
                        'object-fit': 'cover'
                    });
                };
                li.appendChild(img);
                ul.appendChild(li);
            }
            bgList.innerHTML = ''; // Clear previous content
            bgList.appendChild(ul); // Append the <ul> element to the #results-bgs div
        } else {
            console.log('No hits');
        }
    });
}

// Function to shuffle an array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

let volume = document.getElementById('volume-slider');
volume.addEventListener("change", function(e) {
    audio.volume = e.currentTarget.value / 100;
})

// Saving Selections
document.querySelector('#save-visualizers').addEventListener('submit', saveVisualizer);

// Trigger saveVisualizer function when the button is clicked
document.getElementById('save-visualizers-btn').addEventListener('click', saveVisualizer);

function saveVisualizer(event) {
    event.preventDefault(); // Prevent the default form submission
    const visualizerName = document.getElementById('save-vis-name').value;
    if (!visualizerName) {
        return;
    }

    // Get relevant data to save (e.g., selected song, artist, background video URL, audio URL)
    const selectedSong = document.getElementById('np-song').textContent;
    const selectedArtist = document.getElementById('np-artist').textContent;
    const selectedLyrics = document.getElementById('lyrics').innerHTML;
    const selectedVideoUrl = document.querySelector('#bg-fill video source').getAttribute('src');
    const selectedAudioUrl = document.getElementById('audio').getAttribute('src');

    // Construct an object containing the data to save
    const visualizerData = {
        name: visualizerName,
        song: selectedSong,
        artist: selectedArtist,
        lyrics: selectedLyrics,
        videoUrl: selectedVideoUrl,
        audioUrl: selectedAudioUrl // Include audio URL in the saved data
    };

    // Save the data to localStorage
    localStorage.setItem(visualizerName, JSON.stringify(visualizerData));

    // Update the list of saved selections in the first modal
    updateSavedVisualizersList();
}


// Loading Selections
document.querySelector('.saved-visualizers-list').addEventListener('click', function(event) {
    if (event.target.tagName === 'LI') {
        const visualizerName = event.target.textContent;

        // Retrieve the data from localStorage
        const visualizerData = JSON.parse(localStorage.getItem(visualizerName));

        if (visualizerData) {
            // Populate the application with the retrieved data
            document.getElementById('np-song').textContent = visualizerData.song;
            document.getElementById('np-artist').textContent = visualizerData.artist;
            const bgFill = document.getElementById('bg-fill');
            bgFill.innerHTML = `<video autoplay muted loop><source src="${visualizerData.videoUrl}" type="video/mp4"></video>`;

            $('#bg-fill video').css({
                'position': 'fixed',
                'top': 0,
                'left': 0,
                'width': '100%',
                'height': '100%',
                'object-fit': 'cover'
            });

            // Update the audio element
            const audio = document.getElementById('audio');
            audio.setAttribute('src', visualizerData.audioUrl);
            audio.play(); // Start playing the audio
            var volumeSlider = document.getElementById('volume-slider');
            volumeSlider.style.display = 'block';


            const selectedLyrics = document.getElementById('lyrics');
            selectedLyrics.innerHTML = visualizerData.lyrics;
            const lyricsParagraphs = selectedLyrics.querySelectorAll('p');
            lyricsParagraphs.forEach((paragraph, index) => {
                paragraph.onclick = () => showNextStanza(index);
            });

            // Update the list of saved selections in the first modal
            updateSavedVisualizersList();
        } else {
            return;
        }
    }
});

// Function to update the list of saved selections in the first modal
function updateSavedVisualizersList() {
    const savedVisualizersList = document.querySelector('.saved-visualizers-list');
    savedVisualizersList.innerHTML = '';

    // Iterate over localStorage keys to populate the list
    for (let i = 0; i < localStorage.length; i++) {
        const visualizerName = localStorage.key(i);
        const listItem = document.createElement('li');
        listItem.textContent = visualizerName;
        savedVisualizersList.appendChild(listItem);
    }
}

// Call updateSavedVisualizersList once when the script loads
updateSavedVisualizersList();

audio.addEventListener('canplaythrough', function() {
    audio.play();
});