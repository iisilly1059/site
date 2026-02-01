const API_BASE_URL = '/music-api';

let currentTrack = null;
let playlist = [];
let originalPlaylist = [];
let currentIndex = 0;
let isPlaying = false;
let isShuffle = false;
let repeatMode = 'off';
let favorites = loadFromStorage('favorites') || [];
let playlists = loadFromStorage('playlists') || [];
let currentPlaylistId = null;
let currentAlbumId = null;
let currentArtistId = null;
let playHistory = loadFromStorage('playHistory') || [];
let queue = [];
let recentlyPlayed = loadFromStorage('recentlyPlayed') || [];
let volume = parseInt(loadFromStorage('volume')) || 70;
let player = null;
let progressInterval = null;
let contextMenuTrack = null;
let currentLyrics = null;
let audioContext = null;
let currentSource = null;
let nextSource = null;
let gainNode = null;
let analyserNode = null;
let crossfadeDuration = 5;
let gaplessEnabled = true;
let visualizerEnabled = true;
let currentAudioBuffer = null;
let nextAudioBuffer = null;
let startTime = 0;
let pauseTime = 0;
let isTransitioning = false;

// Lyrics syncing variables
let currentLyricsData = null;
let lyricsInterval = null;
let currentLyricsTrackId = null;

let searchState = {
    query: '',
    tracksOffset: 0,
    albumsOffset: 0,
    artistsOffset: 0,
    loading: false,
    hasMoreTracks: true,
    hasMoreAlbums: true,
    hasMoreArtists: true
};

const audio = document.getElementById('audioElement');

const popularArtists = [
    'The Weeknd', 'Drake', 
    'Post Malone', 'Dua Lipa', 'Ed Sheeran', 'Ariana Grande',
    'Travis Scott', 'Olivia Rodrigo', 'Bad Bunny', 'SZA'
];

// Enhanced fetch lyrics with time sync
async function fetchLyricsWithSync(artist, title) {
    try {
        const response = await fetch(
            `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`
        );
        
        if (!response.ok) {
            const fallbackResponse = await fetch(
                `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
            );
            const data = await fallbackResponse.json();
            return {
                syncedLyrics: null,
                plainLyrics: data.lyrics || 'Lyrics not found',
                duration: 0
            };
        }
        
        const data = await response.json();
        return {
            syncedLyrics: data.syncedLyrics || null,
            plainLyrics: data.plainLyrics || data.lyrics || 'Lyrics not found',
            duration: data.duration || 0
        };
    } catch (error) {
        console.error('Lyrics fetch error:', error);
        return {
            syncedLyrics: null,
            plainLyrics: 'Failed to load lyrics',
            duration: 0
        };
    }
}

// Parse synced lyrics (LRC format)
function parseSyncedLyrics(syncedLyrics) {
    if (!syncedLyrics) return null;
    
    const lines = syncedLyrics.split('\n');
    const parsed = [];
    
    for (const line of lines) {
        const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
        if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            const centiseconds = parseInt(match[3].padEnd(3, '0'));
            const text = match[4].trim();
            
            const timeInSeconds = minutes * 60 + seconds + centiseconds / 1000;
            parsed.push({ time: timeInSeconds, text: text });
        }
    }
    
    return parsed.sort((a, b) => a.time - b.time);
}

// Display lyrics with sync
function displayLyrics(lyricsData) {
    const content = document.getElementById('lyricsContent');
    if (!content) return;
    
    if (lyricsData.syncedLyrics) {
        const parsed = parseSyncedLyrics(lyricsData.syncedLyrics);
        if (parsed && parsed.length > 0) {
            currentLyricsData = parsed;
            renderSyncedLyrics(parsed);
            startLyricsSync();
            return;
        }
    }
    
    currentLyricsData = null;
    content.innerHTML = `<div class="lyrics-container"><pre class="lyrics-text">${escapeHtml(lyricsData.plainLyrics)}</pre></div>`;
}

// Render synced lyrics
function renderSyncedLyrics(parsedLyrics) {
    const content = document.getElementById('lyricsContent');
    if (!content) return;
    
    const container = document.createElement('div');
    container.className = 'lyrics-container';
    
    parsedLyrics.forEach((line, index) => {
        const lineDiv = document.createElement('div');
        lineDiv.className = 'lyrics-line';
        lineDiv.dataset.time = line.time;
        lineDiv.dataset.index = index;
        lineDiv.textContent = line.text || '♪';
        container.appendChild(lineDiv);
    });
    
    content.innerHTML = '';
    content.appendChild(container);
}

// Start lyrics synchronization
function startLyricsSync() {
    stopLyricsSync();
    
    lyricsInterval = setInterval(() => {
        if (!player || typeof player.getCurrentTime !== 'function' || !currentLyricsData) {
            return;
        }
        
        const currentTime = player.getCurrentTime();
        updateActiveLyric(currentTime);
    }, 100);
}

// Stop lyrics synchronization
function stopLyricsSync() {
    if (lyricsInterval) {
        clearInterval(lyricsInterval);
        lyricsInterval = null;
    }
}

// Update active lyric based on time
function updateActiveLyric(currentTime) {
    const lines = document.querySelectorAll('.lyrics-line');
    if (!lines.length || !currentLyricsData) return;
    
    let activeIndex = -1;
    
    for (let i = 0; i < currentLyricsData.length; i++) {
        if (currentTime >= currentLyricsData[i].time) {
            activeIndex = i;
        } else {
            break;
        }
    }
    
    lines.forEach((line, index) => {
        line.classList.remove('active', 'passed');
        
        if (index === activeIndex) {
            line.classList.add('active');
            line.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (index < activeIndex) {
            line.classList.add('passed');
        }
    });
}

// Enhanced showLyrics function
async function showLyrics(track) {
    const panel = document.getElementById('lyricsPanel');
    const content = document.getElementById('lyricsContent');
    
    if (!panel || !content) return;
    
    stopLyricsSync();
    currentLyricsTrackId = track.id;
    
    content.innerHTML = '<p class="lyrics-loading">Loading lyrics...</p>';
    panel.classList.add('open');
    
    const lyricsData = await fetchLyricsWithSync(track.artist_name, track.title);
    
    if (currentLyricsTrackId === track.id) {
        displayLyrics(lyricsData);
    }
}

function toggleLyrics() {
    if (currentTrack) {
        showLyrics(currentTrack);
    } else {
        alert('No track is currently playing');
    }
}

function closeLyrics() {
    const panel = document.getElementById('lyricsPanel');
    if (panel) panel.classList.remove('open');
    stopLyricsSync();
}

let suggestionTimeout;

async function showSearchSuggestions(query) {
    if (!query || query.trim() === '' || query.length < 2) {
        hideSearchSuggestions();
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/suggestions?q=${encodeURIComponent(query)}`);
        if (!response.ok) return;
        
        const data = await response.json();
        const suggestions = data.suggestions || [];
        
        if (suggestions.length === 0) {
            hideSearchSuggestions();
            return;
        }
        
        let suggestionsEl = document.getElementById('searchSuggestions');
        if (!suggestionsEl) {
            suggestionsEl = document.createElement('div');
            suggestionsEl.id = 'searchSuggestions';
            suggestionsEl.className = 'search-suggestions';
            const searchBox = document.querySelector('.search-box-large');
            if (searchBox) {
                searchBox.appendChild(suggestionsEl);
            }
        }
        
        suggestionsEl.innerHTML = suggestions.map(s => `
            <div class="suggestion-item" data-query="${escapeHtml(s.name)}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                </svg>
                <span>${escapeHtml(s.name)}</span>
                <span class="suggestion-type">${s.type}</span>
            </div>
        `).join('');
        
        suggestionsEl.style.display = 'block';
        
        suggestionsEl.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const query = item.dataset.query;
                document.getElementById('searchInput').value = query;
                handleSearch(query);
                hideSearchSuggestions();
            });
        });
    } catch (error) {
        console.error('Suggestions error:', error);
    }
}

function hideSearchSuggestions() {
    const suggestionsEl = document.getElementById('searchSuggestions');
    if (suggestionsEl) {
        suggestionsEl.style.display = 'none';
    }
}

function setupInfiniteScroll() {
    const mainView = document.querySelector('.main-view');
    
    if (!mainView) return;
    
    mainView.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } = mainView;
        
        if (scrollTop + clientHeight >= scrollHeight - 500) {
            if (searchState.query && !searchState.loading) {
                const activeTab = document.querySelector('.search-tab.active');
                if (!activeTab) return;
                
                const tabName = activeTab.dataset.tab;
                
                let hasMore = false;
                if (tabName === 'tracks') hasMore = searchState.hasMoreTracks;
                else if (tabName === 'albums') hasMore = searchState.hasMoreAlbums;
                else if (tabName === 'artists') hasMore = searchState.hasMoreArtists;
                
                if (hasMore) {
                    console.log('Loading more', tabName);
                    handleSearch(searchState.query, true);
                }
            }
        }
    });
}

function appendTracks(tracks, container) {
    if (!container) return;
    
    tracks.forEach((track) => {
        const card = createTrackCard(track, playlist.length);
        playlist.push(track);
        originalPlaylist.push(track);
        container.appendChild(card);
    });
}

function appendAlbums(albums, container) {
    if (!container) return;
    
    albums.forEach(album => {
        const card = createAlbumCard(album);
        container.appendChild(card);
    });
}

function appendArtists(artists, container) {
    if (!container) return;
    
    artists.forEach(artist => {
        const card = createArtistCard(artist);
        container.appendChild(card);
    });
}

function addToQueue(track) {
    if (!track) return;
    queue.push(track);
    saveToStorage('queue', queue);
    console.log('Added to queue:', track.title);
}

function removeFromQueue(index) {
    queue.splice(index, 1);
    saveToStorage('queue', queue);
}

function clearQueue() {
    queue = [];
    saveToStorage('queue', queue);
}

function loadFromStorage(key) {
    try {
        const value = localStorage.getItem(`impMusic_${key}`);
        return value ? JSON.parse(value) : null;
    } catch (e) {
        return null;
    }
}

function saveToStorage(key, value) {
    try {
        localStorage.setItem(`impMusic_${key}`, JSON.stringify(value));
    } catch (e) {
        console.error('Storage error:', e);
    }
}

function setGreeting() {
    const hour = new Date().getHours();
    let greeting = 'Good evening';
    
    if (hour >= 5 && hour < 12) greeting = 'Good morning';
    else if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
    else if (hour >= 17 && hour < 22) greeting = 'Good evening';
    else greeting = 'Good night';
    
    const greetingEl = document.getElementById('greetingText');
    if (greetingEl) greetingEl.textContent = greeting;
}

function switchView(viewName, id = null) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.playlist-item').forEach(n => n.classList.remove('active'));
    
    const targetView = document.getElementById(viewName + 'View');
    
    if (targetView) {
        targetView.classList.add('active');
    }
    
    const navItem = document.querySelector(`.nav-item[data-view="${viewName}"]`);
    if (navItem) {
        navItem.classList.add('active');
    }
    
    if (viewName === 'favorites') {
        renderFavorites();
    } else if (viewName === 'home') {
        loadPopularTracks();
    } else if (viewName === 'library') {
        renderLibrary();
    } else if (viewName === 'playlist' && id) {
        currentPlaylistId = id;
        renderPlaylist(id);
        const playlistItem = document.querySelector(`.playlist-item[data-id="${id}"]`);
        if (playlistItem) playlistItem.classList.add('active');
    } else if (viewName === 'album' && id) {
        currentAlbumId = id;
        loadAlbumDetails(id);
    } else if (viewName === 'artist' && id) {
        currentArtistId = id;
        loadArtistDetails(id);
    }
}

async function loadPopularTracks() {
    const grid = document.getElementById('popularTracks');
    if (!grid) return;
    
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-secondary); font-size: 15px;">Loading tracks...</div>';
    
    try {
        const randomArtist = popularArtists[Math.floor(Math.random() * popularArtists.length)];
        const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(randomArtist)}`);
        
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        
        console.log('API Response:', data);
        
        const tracks = data.tracks || data.collection || [];
        
        if (tracks && tracks.length > 0) {
            renderTracks(tracks.slice(0, 6), grid);
        } else {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-secondary); font-size: 15px;">No tracks found</div>';
        }
    } catch (error) {
        console.error('Error loading popular tracks:', error);
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-secondary); font-size: 15px;">Failed to load tracks. Please try again.</div>';
    }
}

let searchTimeout;

async function handleSearch(query, append = false) {
    const resultsDiv = document.getElementById('searchResults');
    const tracksGrid = document.getElementById('searchGrid');
    const albumsGrid = document.getElementById('albumsGrid');
    const artistsGrid = document.getElementById('artistsGrid');
    const categories = document.querySelector('.browse-categories');
    
    console.log('Search containers:', { tracksGrid, albumsGrid, artistsGrid });
    
    if (!query || query.trim() === '') {
        if (resultsDiv) resultsDiv.style.display = 'none';
        if (categories) categories.style.display = 'block';
        searchState.query = '';
        return;
    }
    
    if (!append || query !== searchState.query) {
        searchState = {
            query: query,
            tracksOffset: 0,
            albumsOffset: 0,
            artistsOffset: 0,
            loading: false,
            hasMoreTracks: true,
            hasMoreAlbums: true,
            hasMoreArtists: true
        };
    }
    
    if (searchState.loading) return;
    searchState.loading = true;
    
    if (categories) categories.style.display = 'none';
    if (resultsDiv) resultsDiv.style.display = 'block';
    
    if (!append) {
        if (tracksGrid) tracksGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-secondary); font-size: 15px;">Searching...</div>';
        if (albumsGrid) albumsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-secondary); font-size: 15px;">Searching...</div>';
        if (artistsGrid) artistsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-secondary); font-size: 15px;">Searching...</div>';
    }
    
    try {
        const activeTab = document.querySelector('.search-tab.active').dataset.tab;
        let offset = 0;
        
        if (activeTab === 'tracks') offset = searchState.tracksOffset;
        else if (activeTab === 'albums') offset = searchState.albumsOffset;
        else if (activeTab === 'artists') offset = searchState.artistsOffset;
        
        const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}&offset=${offset}`);
        
        if (!response.ok) throw new Error('Search failed');
        
        const data = await response.json();
        
        console.log('Search results:', data);
        
        const tracks = data.tracks || data.collection || [];
        const albums = data.albums || [];
        const artists = data.artists || [];
        
        console.log('Parsed results:', { 
            tracksCount: tracks.length, 
            albumsCount: albums.length, 
            artistsCount: artists.length 
        });
        
        if (tracks.length < 20) searchState.hasMoreTracks = false;
        if (albums.length < 20) searchState.hasMoreAlbums = false;
        if (artists.length < 20) searchState.hasMoreArtists = false;
        
        if (tracks && tracks.length > 0) {
            console.log('Rendering', tracks.length, 'tracks');
            if (append && activeTab === 'tracks') {
                appendTracks(tracks, tracksGrid);
            } else {
                renderTracks(tracks, tracksGrid);
            }
            searchState.tracksOffset += tracks.length;
        } else if (!append) {
            if (tracksGrid) tracksGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-secondary); font-size: 15px;">No tracks found</div>';
        }
        
        if (albums && albums.length > 0) {
            console.log('Rendering', albums.length, 'albums');
            if (append && activeTab === 'albums') {
                appendAlbums(albums, albumsGrid);
            } else {
                renderAlbums(albums, albumsGrid);
            }
            searchState.albumsOffset += albums.length;
        } else if (!append) {
            console.log('No albums to render');
            if (albumsGrid) albumsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-secondary); font-size: 15px;">No albums found</div>';
        }
        
        if (artists && artists.length > 0) {
            console.log('Rendering', artists.length, 'artists');
            if (append && activeTab === 'artists') {
                appendArtists(artists, artistsGrid);
            } else {
                renderArtists(artists, artistsGrid);
            }
            searchState.artistsOffset += artists.length;
        } else if (!append) {
            console.log('No artists to render');
            if (artistsGrid) artistsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-secondary); font-size: 15px;">No artists found</div>';
        }
        
    } catch (error) {
        console.error('Search error:', error);
        if (!append) {
            if (tracksGrid) tracksGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-secondary); font-size: 15px;">Search failed. Please try again.</div>';
            if (albumsGrid) albumsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-secondary); font-size: 15px;">Search failed. Please try again.</div>';
            if (artistsGrid) artistsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-secondary); font-size: 15px;">Search failed. Please try again.</div>';
        }
    } finally {
        searchState.loading = false;
    }
}

function createTrackCard(track, index) {
    const card = document.createElement('div');
    card.className = 'track-card';
    
    const artworkUrl = track.artwork_url || track.album?.artwork_url || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23282828%22 width=%22200%22 height=%22200%22/%3E%3C/svg%3E';
    
    card.innerHTML = `
        <img src="${artworkUrl}" alt="${escapeHtml(track.title)}" class="track-artwork" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23282828%22 width=%22200%22 height=%22200%22/%3E%3C/svg%3E'">
        <div class="track-details">
            <div class="track-title">${escapeHtml(track.title)}</div>
            <div class="track-artist clickable" data-artist-id="${track.artist_id || ''}">${escapeHtml(track.artist_name || track.user?.username || 'Unknown Artist')}</div>
        </div>
        <button class="track-card-options" title="More options">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="1"/>
                <circle cx="12" cy="5" r="1"/>
                <circle cx="12" cy="19" r="1"/>
            </svg>
        </button>
        <button class="track-play-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="6 3 20 12 6 21 6 3"/>
            </svg>
        </button>
    `;
    
    const artistEl = card.querySelector('.track-artist');
    if (artistEl && track.artist_id) {
        artistEl.addEventListener('click', (e) => {
            e.stopPropagation();
            switchView('artist', track.artist_id);
        });
    }
    
    const optionsBtn = card.querySelector('.track-card-options');
    optionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showContextMenu(e, track);
    });
    
    card.querySelector('.track-play-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        playTrack(index);
    });
    
    card.addEventListener('click', () => playTrack(index));
    
    return card;
}

function createAlbumCard(album) {
    const card = document.createElement('div');
    card.className = 'track-card';
    
    const artworkUrl = album.artwork_url || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23282828%22 width=%22200%22 height=%22200%22/%3E%3C/svg%3E';
    
    card.innerHTML = `
        <img src="${artworkUrl}" alt="${escapeHtml(album.name)}" class="track-artwork" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23282828%22 width=%22200%22 height=%22200%22/%3E%3C/svg%3E'">
        <div class="track-details">
            <div class="track-title">${escapeHtml(album.name)}</div>
            <div class="track-artist">${album.release_year || ''} • ${escapeHtml(album.artist_name || 'Unknown Artist')}</div>
        </div>
        <button class="track-play-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="6 3 20 12 6 21 6 3"/>
            </svg>
        </button>
    `;
    
    card.addEventListener('click', () => switchView('album', album.id));
    
    card.querySelector('.track-play-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
            const response = await fetch(`${API_BASE_URL}/album/${album.id}`);
            const data = await response.json();
            if (data.tracks && data.tracks.length > 0) {
                playlist = data.tracks;
                originalPlaylist = [...data.tracks];
                playTrack(0);
            }
        } catch (error) {
            console.error('Error loading album tracks:', error);
        }
    });
    
    return card;
}

function createArtistCard(artist) {
    const card = document.createElement('div');
    card.className = 'artist-card';
    
    const imageUrl = artist.image_url || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23282828%22 width=%22200%22 height=%22200%22/%3E%3C/svg%3E';
    
    card.innerHTML = `
        <img src="${imageUrl}" alt="${escapeHtml(artist.name)}" class="artist-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23282828%22 width=%22200%22 height=%22200%22/%3E%3C/svg%3E'">
        <div class="artist-card-info">
            <div class="artist-card-name">${escapeHtml(artist.name)}</div>
            <div class="artist-card-type">Artist</div>
        </div>
    `;
    
    card.addEventListener('click', () => switchView('artist', artist.id));
    
    return card;
}

function renderTracks(tracks, container) {
    if (!container) return;
    
    container.innerHTML = '';
    playlist = tracks;
    originalPlaylist = [...tracks];
    
    tracks.forEach((track, index) => {
        const card = document.createElement('div');
        card.className = 'track-card';
        
        const artworkUrl = track.artwork_url || track.album?.artwork_url || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23282828%22 width=%22200%22 height=%22200%22/%3E%3C/svg%3E';
        
        card.innerHTML = `
            <img src="${artworkUrl}" alt="${escapeHtml(track.title)}" class="track-artwork" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23282828%22 width=%22200%22 height=%22200%22/%3E%3C/svg%3E'">
            <div class="track-details">
                <div class="track-title">${escapeHtml(track.title)}</div>
                <div class="track-artist clickable" data-artist-id="${track.artist_id || ''}">${escapeHtml(track.artist_name || track.user?.username || 'Unknown Artist')}</div>
            </div>
            <button class="track-card-options" title="More options">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="1"/>
                    <circle cx="12" cy="5" r="1"/>
                    <circle cx="12" cy="19" r="1"/>
                </svg>
            </button>
            <button class="track-play-btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="6 3 20 12 6 21 6 3"/>
                </svg>
            </button>
        `;
        
        const artistEl = card.querySelector('.track-artist');
        if (artistEl && track.artist_id) {
            artistEl.addEventListener('click', (e) => {
                e.stopPropagation();
                switchView('artist', track.artist_id);
            });
        }
        
        const optionsBtn = card.querySelector('.track-card-options');
        optionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showContextMenu(e, track);
        });
        
        card.querySelector('.track-play-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            playTrack(index);
        });
        
        card.addEventListener('click', () => playTrack(index));
        
        container.appendChild(card);
    });
}

function renderAlbums(albums, container) {
    if (!container) return;
    
    console.log('renderAlbums called with:', albums.length, 'albums');
    
    container.innerHTML = '';
    
    albums.forEach(album => {
        const card = document.createElement('div');
        card.className = 'track-card';
        
        const artworkUrl = album.artwork_url || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23282828%22 width=%22200%22 height=%22200%22/%3E%3C/svg%3E';
        
        card.innerHTML = `
            <img src="${artworkUrl}" alt="${escapeHtml(album.name)}" class="track-artwork" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23282828%22 width=%22200%22 height=%22200%22/%3E%3C/svg%3E'">
            <div class="track-details">
                <div class="track-title">${escapeHtml(album.name)}</div>
                <div class="track-artist">${album.release_year || ''} • ${escapeHtml(album.artist_name || 'Unknown Artist')}</div>
            </div>
            <button class="track-play-btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="6 3 20 12 6 21 6 3"/>
                </svg>
            </button>
        `;
        
        card.addEventListener('click', () => switchView('album', album.id));
        
        card.querySelector('.track-play-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                const response = await fetch(`${API_BASE_URL}/album/${album.id}`);
                const data = await response.json();
                if (data.tracks && data.tracks.length > 0) {
                    playlist = data.tracks;
                    originalPlaylist = [...data.tracks];
                    playTrack(0);
                }
            } catch (error) {
                console.error('Error loading album tracks:', error);
            }
        });
        
        container.appendChild(card);
    });
    
    console.log('Albums rendered successfully');
}

function renderArtists(artists, container) {
    if (!container) return;
    
    console.log('renderArtists called with:', artists.length, 'artists');
    
    container.innerHTML = '';
    
    artists.forEach(artist => {
        const card = document.createElement('div');
        card.className = 'artist-card';
        
        const imageUrl = artist.image_url || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23282828%22 width=%22200%22 height=%22200%22/%3E%3C/svg%3E';
        
        card.innerHTML = `
            <img src="${imageUrl}" alt="${escapeHtml(artist.name)}" class="artist-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23282828%22 width=%22200%22 height=%22200%22/%3E%3C/svg%3E'">
            <div class="artist-card-info">
                <div class="artist-card-name">${escapeHtml(artist.name)}</div>
                <div class="artist-card-type">Artist</div>
            </div>
        `;
        
        card.addEventListener('click', () => switchView('artist', artist.id));
        
        container.appendChild(card);
    });
    
    console.log('Artists rendered successfully');
}

async function loadAlbumDetails(albumId) {
    const nameEl = document.getElementById('albumName');
    const artistsEl = document.getElementById('albumArtists');
    const infoEl = document.getElementById('albumInfo');
    const coverEl = document.getElementById('albumCover');
    const trackList = document.getElementById('albumTracks');
    
    if (trackList) trackList.innerHTML = '<div class="empty-message">Loading album...</div>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/album/${albumId}`);
        if (!response.ok) throw new Error('Failed to load album');
        
        const data = await response.json();
        
        if (nameEl) nameEl.textContent = data.name;
        
        if (artistsEl) {
            artistsEl.innerHTML = data.artists.map(artist => 
                `<span class="artist-link clickable" data-artist-id="${artist.id}">${escapeHtml(artist.name)}</span>`
            ).join(', ');
            
            artistsEl.querySelectorAll('.artist-link').forEach(link => {
                link.addEventListener('click', () => {
                    switchView('artist', link.dataset.artistId);
                });
            });
        }
        
        if (infoEl) {
            const year = data.release_year || '';
            const trackCount = data.total_tracks || data.tracks?.length || 0;
            infoEl.textContent = `${year} • ${trackCount} song${trackCount !== 1 ? 's' : ''}`;
        }
        
        if (coverEl && data.artwork_url) {
            coverEl.innerHTML = `<img src="${data.artwork_url}" alt="${escapeHtml(data.name)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">`;
        }
        
        if (data.tracks && data.tracks.length > 0) {
            renderAlbumTracks(data.tracks, trackList);
        } else {
            if (trackList) trackList.innerHTML = '<div class="empty-message">No tracks found</div>';
        }
        
    } catch (error) {
        console.error('Error loading album:', error);
        if (trackList) trackList.innerHTML = '<div class="empty-message">Failed to load album</div>';
    }
}

function renderAlbumTracks(tracks, container) {
    if (!container) return;
    
    container.innerHTML = '';
    
    tracks.forEach((track, index) => {
        const item = document.createElement('div');
        item.className = 'track-list-item';
        
        item.innerHTML = `
            <div class="track-number">${index + 1}</div>
            <div class="track-info-column">
                <div class="track-text">
                    <div class="track-name">${escapeHtml(track.title)}</div>
                    <div class="track-artist-name clickable" data-artist-id="${track.artist_id || ''}">${escapeHtml(track.artist_name || 'Unknown Artist')}</div>
                </div>
            </div>
            <div class="track-duration">${formatDuration(track.duration)}</div>
        `;
        
        const artistEl = item.querySelector('.track-artist-name');
        if (artistEl && track.artist_id) {
            artistEl.addEventListener('click', (e) => {
                e.stopPropagation();
                switchView('artist', track.artist_id);
            });
        }
        
        item.addEventListener('click', () => {
            playlist = [...tracks];
            originalPlaylist = [...tracks];
            playTrack(index);
        });
        
        container.appendChild(item);
    });
}

async function loadArtistDetails(artistId) {
    const nameEl = document.getElementById('artistName');
    const followersEl = document.getElementById('artistFollowers');
    const coverEl = document.getElementById('artistCover');
    const topTracksEl = document.getElementById('artistTopTracks');
    const albumsEl = document.getElementById('artistAlbums');
    
    if (topTracksEl) topTracksEl.innerHTML = '<div class="empty-message">Loading artist...</div>';
    if (albumsEl) albumsEl.innerHTML = '<div class="empty-message">Loading albums...</div>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/artist/${artistId}`);
        if (!response.ok) throw new Error('Failed to load artist');
        
        const data = await response.json();
        
        if (nameEl) nameEl.textContent = data.name;
        if (followersEl) followersEl.textContent = `${formatNumber(data.followers || 0)} followers`;
        
        if (coverEl && data.image_url) {
            coverEl.innerHTML = `<img src="${data.image_url}" alt="${escapeHtml(data.name)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        }
        
        if (data.top_tracks && data.top_tracks.length > 0) {
            renderArtistTopTracks(data.top_tracks.slice(0, 5), topTracksEl);
        } else {
            if (topTracksEl) topTracksEl.innerHTML = '<div class="empty-message">No top tracks found</div>';
        }
        
        if (data.albums && data.albums.length > 0) {
            renderAlbums(data.albums, albumsEl);
        } else {
            if (albumsEl) albumsEl.innerHTML = '<div class="empty-message">No albums found</div>';
        }
        
    } catch (error) {
        console.error('Error loading artist:', error);
        if (topTracksEl) topTracksEl.innerHTML = '<div class="empty-message">Failed to load artist</div>';
        if (albumsEl) albumsEl.innerHTML = '<div class="empty-message">Failed to load albums</div>';
    }
}

function renderArtistTopTracks(tracks, container) {
    if (!container) return;
    
    container.innerHTML = '';
    
    tracks.forEach((track, index) => {
        const item = document.createElement('div');
        item.className = 'track-list-item';
        
        const artworkUrl = track.artwork_url || track.album?.artwork_url || '';
        
        item.innerHTML = `
            <div class="track-number">${index + 1}</div>
            <div class="track-info-column">
                ${artworkUrl ? `<img src="${artworkUrl}" alt="${escapeHtml(track.title)}" class="track-thumbnail" onerror="this.style.display='none'">` : '<div class="track-thumbnail"></div>'}
                <div class="track-text">
                    <div class="track-name">${escapeHtml(track.title)}</div>
                    <div class="track-artist-name">${escapeHtml(track.artist_name || 'Unknown Artist')}</div>
                </div>
            </div>
            <div class="track-duration">${formatDuration(track.duration)}</div>
        `;
        
        item.addEventListener('click', () => {
            playlist = [...tracks];
            originalPlaylist = [...tracks];
            playTrack(index);
        });
        
        container.appendChild(item);
    });
}

function showContextMenu(e, track) {
    contextMenuTrack = track;
    const menu = document.getElementById('contextMenu');
    if (!menu) return;
    
    menu.style.display = 'block';
    
    const x = e.pageX || e.clientX;
    const y = e.pageY || e.clientY;
    
    const menuWidth = 220;
    const menuHeight = 110;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    let left = x;
    let top = y;
    
    if (left + menuWidth > windowWidth) {
        left = windowWidth - menuWidth - 10;
    }
    
    if (top + menuHeight > windowHeight) {
        top = y - menuHeight - 10;
    }
    
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    
    const handleClickOutside = (event) => {
        if (!menu.contains(event.target)) {
            menu.style.display = 'none';
            document.removeEventListener('click', handleClickOutside);
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
    }, 10);
}

function showPlaylistSelectMenu(e) {
    const menu = document.getElementById('playlistSelectMenu');
    if (!menu) return;
    
    menu.innerHTML = '';
    
    if (playlists.length === 0) {
        menu.innerHTML = '<div class="context-menu-item" style="color: var(--text-muted); cursor: default;">No playlists yet</div>';
    } else {
        playlists.forEach(playlistData => {
            const item = document.createElement('div');
            item.className = 'context-menu-item';
            item.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
                </svg>
                <span>${escapeHtml(playlistData.name)}</span>
            `;
            
            item.addEventListener('click', () => {
                if (contextMenuTrack) {
                    addToPlaylist(playlistData.id, contextMenuTrack);
                }
                menu.style.display = 'none';
                document.getElementById('contextMenu').style.display = 'none';
            });
            
            menu.appendChild(item);
        });
    }
    
    menu.style.display = 'block';
    const contextMenu = document.getElementById('contextMenu');
    const rect = contextMenu.getBoundingClientRect();
    menu.style.left = (rect.right + 5) + 'px';
    menu.style.top = rect.top + 'px';
    
    const handleClickOutside = (event) => {
        if (!menu.contains(event.target) && event.target.id !== 'addToPlaylistMenu') {
            menu.style.display = 'none';
            document.removeEventListener('click', handleClickOutside);
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
    }, 10);
}

function renderFavorites() {
    const list = document.getElementById('favoritesList');
    const count = document.getElementById('likedSongsCount');
    
    if (!list || !count) return;
    
    count.textContent = `${favorites.length} song${favorites.length !== 1 ? 's' : ''}`;
    
    if (favorites.length === 0) {
        list.innerHTML = '<div class="empty-message">Songs you like will appear here</div>';
        return;
    }
    
    list.innerHTML = '';
    favorites.forEach((track, index) => {
        const item = document.createElement('div');
        item.className = 'track-list-item';
        
        const artworkUrl = track.artwork_url || '';
        
        item.innerHTML = `
            <div class="track-number">${index + 1}</div>
            <div class="track-info-column">
                ${artworkUrl ? `<img src="${artworkUrl}" alt="${escapeHtml(track.title)}" class="track-thumbnail" onerror="this.style.display='none'">` : '<div class="track-thumbnail"></div>'}
                <div class="track-text">
                    <div class="track-name">${escapeHtml(track.title)}</div>
                    <div class="track-artist-name clickable" data-artist-id="${track.artist_id || ''}">${escapeHtml(track.artist_name || track.user?.username || 'Unknown Artist')}</div>
                </div>
            </div>
            <div class="track-duration">${formatDuration(track.duration)}</div>
        `;
        
        const artistEl = item.querySelector('.track-artist-name');
        if (artistEl && track.artist_id) {
            artistEl.addEventListener('click', (e) => {
                e.stopPropagation();
                switchView('artist', track.artist_id);
            });
        }
        
        item.addEventListener('click', () => {
            playlist = [...favorites];
            originalPlaylist = [...favorites];
            playTrack(index);
        });
        
        list.appendChild(item);
    });
}

function renderLibrary() {
    const content = document.querySelector('.library-content');
    if (!content) return;
    
    if (playlists.length === 0) {
        content.innerHTML = '<p class="empty-message" style="grid-column: 1/-1;">Your library is empty. Create a playlist to get started!</p>';
        return;
    }
    
    content.innerHTML = '';
    playlists.forEach(playlist => {
        const card = document.createElement('div');
        card.className = 'library-playlist-card';
        
        card.innerHTML = `
            <div class="library-playlist-cover">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
                </svg>
            </div>
            <div class="library-playlist-name">${escapeHtml(playlist.name)}</div>
            <div class="library-playlist-count">${playlist.tracks.length} song${playlist.tracks.length !== 1 ? 's' : ''}</div>
        `;
        
        card.addEventListener('click', () => switchView('playlist', playlist.id));
        content.appendChild(card);
    });
}

function renderPlaylist(playlistId) {
    const playlistData = playlists.find(p => p.id === playlistId);
    if (!playlistData) return;
    
    const nameEl = document.getElementById('playlistName');
    const descEl = document.getElementById('playlistDescription');
    const countEl = document.getElementById('playlistCount');
    const trackList = document.getElementById('playlistTracks');
    
    if (nameEl) nameEl.textContent = playlistData.name;
    if (descEl) descEl.textContent = playlistData.description || '';
    if (countEl) countEl.textContent = `${playlistData.tracks.length} song${playlistData.tracks.length !== 1 ? 's' : ''}`;
    
    if (!trackList) return;
    
    if (playlistData.tracks.length === 0) {
        trackList.innerHTML = '<div class="empty-message">This playlist is empty. Add some songs!</div>';
        return;
    }
    
    trackList.innerHTML = '';
    playlistData.tracks.forEach((track, index) => {
        const item = document.createElement('div');
        item.className = 'track-list-item';
        
        const artworkUrl = track.artwork_url || '';
        
        item.innerHTML = `
            <div class="track-number">${index + 1}</div>
            <div class="track-info-column">
                ${artworkUrl ? `<img src="${artworkUrl}" alt="${escapeHtml(track.title)}" class="track-thumbnail" onerror="this.style.display='none'">` : '<div class="track-thumbnail"></div>'}
                <div class="track-text">
                    <div class="track-name">${escapeHtml(track.title)}</div>
                    <div class="track-artist-name">${escapeHtml(track.user?.username || 'Unknown Artist')}</div>
                </div>
            </div>
            <div class="track-duration">${formatDuration(track.duration)}</div>
        `;
        
        item.addEventListener('click', () => {
            playlist = [...playlistData.tracks];
            originalPlaylist = [...playlistData.tracks];
            playTrack(index);
        });
        
        trackList.appendChild(item);
    });
}

function renderSavedPlaylists() {
    const container = document.getElementById('savedPlaylists');
    if (!container) return;
    
    container.innerHTML = '';
    
    playlists.forEach(playlistData => {
        const item = document.createElement('div');
        item.className = 'playlist-item';
        item.dataset.id = playlistData.id;
        
        item.innerHTML = `
            <div class="playlist-item-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15V6"/>
                    <path d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/>
                    <path d="M12 12H3"/>
                    <path d="M16 6H3"/>
                    <path d="M12 18H3"/>
                </svg>
            </div>
            <div class="playlist-item-info">
                <div class="playlist-item-name">${escapeHtml(playlistData.name)}</div>
                <div class="playlist-item-count">${playlistData.tracks.length} songs</div>
            </div>
        `;
        
        item.addEventListener('click', () => switchView('playlist', playlistData.id));
        container.appendChild(item);
    });
}

function createPlaylist(name, description = '') {
    const newPlaylist = {
        id: Date.now().toString(),
        name: name || 'My Playlist',
        description: description,
        tracks: [],
        createdAt: new Date().toISOString()
    };
    
    playlists.push(newPlaylist);
    saveToStorage('playlists', playlists);
    renderSavedPlaylists();
    renderLibrary();
    
    return newPlaylist.id;
}

function addToPlaylist(playlistId, track) {
    const playlistData = playlists.find(p => p.id === playlistId);
    if (!playlistData) return false;
    
    if (!playlistData.tracks.find(t => t.id === track.id)) {
        playlistData.tracks.push(track);
        saveToStorage('playlists', playlists);
        renderSavedPlaylists();
        if (currentPlaylistId === playlistId) {
            renderPlaylist(playlistId);
        }
        return true;
    }
    return false;
}

function showCreatePlaylistModal() {
    const modal = document.getElementById('createPlaylistModal');
    if (modal) {
        modal.style.display = 'flex';
        const input = document.getElementById('playlistNameInput');
        if (input) {
            input.value = '';
            input.focus();
        }
        const textarea = document.getElementById('playlistDescInput');
        if (textarea) textarea.value = '';
    }
}

function hideCreatePlaylistModal() {
    const modal = document.getElementById('createPlaylistModal');
    if (modal) modal.style.display = 'none';
}

async function playTrack(index) {
    console.log('playTrack called with index:', index);
    console.log('Current playlist:', playlist);
    console.log('Playlist length:', playlist.length);
    
    if (!playlist || playlist.length === 0) {
        console.error('No playlist available!');
        return;
    }
    
    currentIndex = Math.max(0, Math.min(index, playlist.length - 1));
    currentTrack = playlist[currentIndex];
    
    console.log('Playing track:', currentTrack.title, 'by', currentTrack.artist_name);
    
    if (!playHistory.find(t => t.id === currentTrack.id)) {
        playHistory.unshift(currentTrack);
        if (playHistory.length > 50) playHistory.pop();
    }
    
    const trackNameEl = document.getElementById('currentTrackName');
    const artistNameEl = document.getElementById('currentArtistName');
    
    if (trackNameEl) trackNameEl.textContent = currentTrack.title;
    if (artistNameEl) {
        artistNameEl.textContent = currentTrack.artist_name || currentTrack.user?.username || 'Unknown Artist';
        artistNameEl.classList.add('clickable');
        artistNameEl.dataset.artistId = currentTrack.artist_id || '';
        
        artistNameEl.onclick = () => {
            if (currentTrack.artist_id) {
                switchView('artist', currentTrack.artist_id);
            }
        };
    }
    
    const artwork = document.getElementById('currentArtwork');
    if (artwork && currentTrack.artwork_url) {
        artwork.innerHTML = `<img src="${currentTrack.artwork_url}" alt="${escapeHtml(currentTrack.title)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;" onerror="this.style.display='none'">`;
    }
    
    updateLikeButton();
    
    // Auto-update lyrics if panel is open
    const panel = document.getElementById('lyricsPanel');
    if (panel && panel.classList.contains('open')) {
        setTimeout(() => {
            showLyrics(currentTrack);
        }, 500);
    }
    
    let videoId = currentTrack.youtube_id || null;
    
    if (!videoId || videoId.length > 22) {
        const query = currentTrack.youtube_query || `${currentTrack.title} ${currentTrack.artist_name || ''}`;
        try {
            const response = await fetch(`${API_BASE_URL}/youtube-search?q=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('YouTube search failed');
            
            const data = await response.json();
            if (data.videoId) {
                videoId = data.videoId;
                currentTrack.youtube_id = videoId;
            }
        } catch (error) {
            console.error('Failed to get YouTube video ID:', error);
            return;
        }
    }
    
    if (!videoId) {
        console.error('Could not find YouTube video');
        return;
    }
    
    if (window.YT && window.YT.Player) {
        loadYouTubePlayer(videoId);
    } else {
        loadYouTubeAPI(videoId);
    }
}

function loadYouTubeAPI(videoId) {
    if (document.querySelector('script[src*="youtube.com/iframe_api"]')) return;
    
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    
    window.onYouTubeIframeAPIReady = () => loadYouTubePlayer(videoId);
}

function loadYouTubePlayer(videoId) {
    if (player && typeof player.loadVideoById === 'function') {
        player.loadVideoById(videoId);
        player.playVideo();
        player.setVolume(volume);
    } else {
        player = new YT.Player('audioElement', {
            height: '0',
            width: '0',
            videoId: videoId,
            playerVars: {
                autoplay: 1,
                controls: 0,
                disablekb: 1,
                fs: 0,
                modestbranding: 1
            },
            events: {
                onReady: (event) => {
                    event.target.playVideo();
                    event.target.setVolume(volume);
                    updatePlayPauseButton(true);
                },
                onStateChange: (event) => {
                    if (event.data === YT.PlayerState.PLAYING) {
                        updatePlayPauseButton(true);
                        startProgressUpdate();
                    } else if (event.data === YT.PlayerState.PAUSED) {
                        updatePlayPauseButton(false);
                    } else if (event.data === YT.PlayerState.ENDED) {
                        handleTrackEnd();
                    }
                },
                onError: (event) => {
                    console.error('YouTube player error:', event.data);
                    playNext();
                }
            }
        });
    }
}

function startProgressUpdate() {
    if (progressInterval) clearInterval(progressInterval);
    
    progressInterval = setInterval(() => {
        if (player && typeof player.getCurrentTime === 'function') {
            const currentTime = player.getCurrentTime();
            const duration = player.getDuration();
            
            if (duration > 0) {
                const progress = (currentTime / duration) * 100;
                const progressBar = document.getElementById('progressBarFill');
                const currentTimeLabel = document.getElementById('currentTimeLabel');
                const durationLabel = document.getElementById('durationLabel');
                
                if (progressBar) progressBar.style.width = progress + '%';
                if (currentTimeLabel) currentTimeLabel.textContent = formatTime(currentTime);
                if (durationLabel) durationLabel.textContent = formatTime(duration);
            }
        }
    }, 1000);
}

function handleTrackEnd() {
    stopLyricsSync();
    
    if (repeatMode === 'one') {
        playTrack(currentIndex);
    } else if (repeatMode === 'all') {
        playNext();
    } else {
        if (currentIndex < playlist.length - 1) {
            playNext();
        } else {
            updatePlayPauseButton(false);
            if (progressInterval) clearInterval(progressInterval);
        }
    }
}

function playNext() {
    if (playlist.length === 0) return;
    
    if (isShuffle) {
        let attempts = 0;
        let newIndex;
        do {
            newIndex = Math.floor(Math.random() * playlist.length);
            attempts++;
        } while (newIndex === currentIndex && attempts < 10 && playlist.length > 1);
        currentIndex = newIndex;
    } else {
        currentIndex = (currentIndex + 1) % playlist.length;
    }
    playTrack(currentIndex);
}

function playPrev() {
    if (playlist.length === 0) return;
    
    if (player && typeof player.getCurrentTime === 'function' && player.getCurrentTime() > 3) {
        player.seekTo(0);
        return;
    }
    
    if (isShuffle) {
        let attempts = 0;
        let newIndex;
        do {
            newIndex = Math.floor(Math.random() * playlist.length);
            attempts++;
        } while (newIndex === currentIndex && attempts < 10 && playlist.length > 1);
        currentIndex = newIndex;
    } else {
        currentIndex = currentIndex > 0 ? currentIndex - 1 : playlist.length - 1;
    }
    playTrack(currentIndex);
}

function togglePlayPause() {
    if (!player || typeof player.getPlayerState !== 'function') return;
    
    const state = player.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
        player.pauseVideo();
        updatePlayPauseButton(false);
    } else {
        player.playVideo();
        updatePlayPauseButton(true);
    }
}

function updatePlayPauseButton(playing) {
    isPlaying = playing;
    const playIcon = document.getElementById('playIconMain');
    const pauseIcon = document.getElementById('pauseIconMain');
    
    if (playIcon) playIcon.style.display = playing ? 'none' : 'block';
    if (pauseIcon) pauseIcon.style.display = playing ? 'block' : 'none';
}

function toggleShuffle() {
    isShuffle = !isShuffle;
    const shuffleBtn = document.getElementById('shuffleButton');
    if (shuffleBtn) shuffleBtn.classList.toggle('active', isShuffle);
    
    if (isShuffle && playlist.length > 1) {
        const currentTrackData = playlist[currentIndex];
        const remaining = playlist.filter((_, i) => i !== currentIndex);
        
        for (let i = remaining.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
        }
        
        playlist = [currentTrackData, ...remaining];
        currentIndex = 0;
    } else {
        playlist = [...originalPlaylist];
        currentIndex = playlist.findIndex(t => t.id === currentTrack?.id);
        if (currentIndex === -1) currentIndex = 0;
    }
}

function cycleRepeat() {
    const modes = ['off', 'all', 'one'];
    const currentModeIndex = modes.indexOf(repeatMode);
    repeatMode = modes[(currentModeIndex + 1) % modes.length];
    
    const btn = document.getElementById('repeatButton');
    if (!btn) return;
    
    btn.classList.toggle('active', repeatMode !== 'off');
    btn.classList.toggle('repeat-one', repeatMode === 'one');
}

function toggleLike() {
    if (!currentTrack) {
        console.log('No track currently playing');
        return;
    }
    
    const index = favorites.findIndex(t => t.id === currentTrack.id);
    
    if (index > -1) {
        favorites.splice(index, 1);
        console.log('Removed from favorites:', currentTrack.title);
    } else {
        favorites.push(currentTrack);
        console.log('Added to favorites:', currentTrack.title);
    }
    
    saveToStorage('favorites', favorites);
    updateLikeButton();
    
    if (document.querySelector('.favorites-view.active')) {
        renderFavorites();
    }
}

function updateLikeButton() {
    const btn = document.getElementById('likeButton');
    if (!btn) return;
    
    if (!currentTrack) {
        btn.classList.remove('active');
        btn.disabled = false;
        return;
    }
    
    const isLiked = favorites.some(t => t.id === currentTrack.id);
    btn.classList.toggle('active', isLiked);
    btn.disabled = false;
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDuration(ms) {
    if (!ms || isNaN(ms)) return '0:00';
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function initProgressBar() {
    const track = document.getElementById('progressTrack');
    if (!track) return;
    
    track.addEventListener('click', (e) => {
        if (!player || typeof player.getDuration !== 'function') return;
        
        const rect = track.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const duration = player.getDuration();
        if (duration > 0) {
            player.seekTo(duration * percent);
        }
    });
}

function initVolumeSlider() {
    const slider = document.getElementById('volumeSlider');
    if (!slider) return;
    
    slider.value = volume;
    
    slider.addEventListener('input', (e) => {
        volume = parseInt(e.target.value);
        if (player && typeof player.setVolume === 'function') {
            player.setVolume(volume);
        }
        saveToStorage('volume', volume);
        updateVolumeIcon();
    });
}

function updateVolumeIcon() {
    const btn = document.getElementById('volumeButton');
    if (!btn) return;
    
    let icon;
    if (volume === 0) {
        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/></svg>';
    } else if (volume < 50) {
        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/></svg>';
    } else {
        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/></svg>';
    }
    btn.innerHTML = icon;
}

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        togglePlayPause();
    }
    
    if (e.code === 'ArrowUp') {
        e.preventDefault();
        const slider = document.getElementById('volumeSlider');
        if (slider) {
            volume = Math.min(100, volume + 5);
            slider.value = volume;
            if (player) player.setVolume(volume);
            saveToStorage('volume', volume);
            updateVolumeIcon();
        }
    }
    
    if (e.code === 'ArrowDown') {
        e.preventDefault();
        const slider = document.getElementById('volumeSlider');
        if (slider) {
            volume = Math.max(0, volume - 5);
            slider.value = volume;
            if (player) player.setVolume(volume);
            saveToStorage('volume', volume);
            updateVolumeIcon();
        }
    }
    
    if (e.code === 'ArrowLeft') {
        e.preventDefault();
        playPrev();
    }
    
    if (e.code === 'ArrowRight') {
        e.preventDefault();
        playNext();
    }
});

const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        clearTimeout(suggestionTimeout);
        
        const query = e.target.value;
        
        suggestionTimeout = setTimeout(() => {
            showSearchSuggestions(query);
        }, 300);
        
        searchTimeout = setTimeout(() => handleSearch(query), 500);
    });
    
    searchInput.addEventListener('focus', () => {
        if (searchInput.value) {
            showSearchSuggestions(searchInput.value);
        }
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box-large')) {
            hideSearchSuggestions();
        }
    });
}

document.querySelectorAll('.search-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.search-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.search-tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        const tabName = tab.dataset.tab;
        document.getElementById(tabName + 'Tab').classList.add('active');
    });
});

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.getAttribute('data-view');
        if (view) switchView(view);
    });
});

document.querySelectorAll('.favorites-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('favorites');
    });
});

document.querySelectorAll('.quick-access-card').forEach(card => {
    const playBtn = card.querySelector('.quick-play-btn');
    if (playBtn) {
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (favorites.length > 0) {
                playlist = [...favorites];
                originalPlaylist = [...favorites];
                playTrack(0);
            }
        });
    }
    
    card.addEventListener('click', () => {
        const view = card.getAttribute('data-view');
        if (view) switchView(view);
    });
});

document.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => {
        const genre = card.getAttribute('data-genre');
        if (genre) {
            switchView('search');
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = genre;
                handleSearch(genre);
            }
        }
    });
});

const playPauseBtn = document.getElementById('playPauseButton');
if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);

const prevBtn = document.getElementById('prevButton');
if (prevBtn) prevBtn.addEventListener('click', playPrev);

const nextBtn = document.getElementById('nextButton');
if (nextBtn) nextBtn.addEventListener('click', playNext);

const shuffleBtn = document.getElementById('shuffleButton');
if (shuffleBtn) shuffleBtn.addEventListener('click', toggleShuffle);

const repeatBtn = document.getElementById('repeatButton');
if (repeatBtn) repeatBtn.addEventListener('click', cycleRepeat);

const likeBtn = document.getElementById('likeButton');
if (likeBtn) {
    likeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('Like button clicked, current track:', currentTrack);
        toggleLike();
    });
}

const playAllBtn = document.querySelector('.play-all-btn');
if (playAllBtn) {
    playAllBtn.addEventListener('click', () => {
        if (favorites.length > 0) {
            playlist = [...favorites];
            originalPlaylist = [...favorites];
            playTrack(0);
        }
    });
}

const playPlaylistBtn = document.getElementById('playPlaylistBtn');
if (playPlaylistBtn) {
    playPlaylistBtn.addEventListener('click', () => {
        const playlistData = playlists.find(p => p.id === currentPlaylistId);
        if (playlistData && playlistData.tracks.length > 0) {
            playlist = [...playlistData.tracks];
            originalPlaylist = [...playlistData.tracks];
            playTrack(0);
        }
    });
}

const playAlbumBtn = document.getElementById('playAlbumBtn');
if (playAlbumBtn) {
    playAlbumBtn.addEventListener('click', async () => {
        if (currentAlbumId) {
            try {
                const response = await fetch(`${API_BASE_URL}/album/${currentAlbumId}`);
                const data = await response.json();
                if (data.tracks && data.tracks.length > 0) {
                    playlist = data.tracks;
                    originalPlaylist = [...data.tracks];
                    playTrack(0);
                }
            } catch (error) {
                console.error('Error loading album tracks:', error);
            }
        }
    });
}

const createPlaylistBtnSidebar = document.querySelector('.create-playlist-btn');
if (createPlaylistBtnSidebar) {
    createPlaylistBtnSidebar.addEventListener('click', showCreatePlaylistModal);
}

const createPlaylistBtnModal = document.getElementById('createPlaylistBtn');
if (createPlaylistBtnModal) {
    createPlaylistBtnModal.addEventListener('click', () => {
        const nameInput = document.getElementById('playlistNameInput');
        const descInput = document.getElementById('playlistDescInput');
        
        if (nameInput && nameInput.value.trim()) {
            const playlistId = createPlaylist(nameInput.value.trim(), descInput?.value.trim() || '');
            hideCreatePlaylistModal();
            switchView('playlist', playlistId);
        }
    });
}

const cancelPlaylistBtn = document.getElementById('cancelPlaylistBtn');
if (cancelPlaylistBtn) {
    cancelPlaylistBtn.addEventListener('click', hideCreatePlaylistModal);
}

const modal = document.getElementById('createPlaylistModal');
if (modal) {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideCreatePlaylistModal();
        }
    });
}

const playlistNameInput = document.getElementById('playlistNameInput');
if (playlistNameInput) {
    playlistNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const createBtn = document.getElementById('createPlaylistBtn');
            if (createBtn) createBtn.click();
        }
    });
}

const addToPlaylistMenuItem = document.getElementById('addToPlaylistMenu');
if (addToPlaylistMenuItem) {
    addToPlaylistMenuItem.addEventListener('click', (e) => {
        e.stopPropagation();
        showPlaylistSelectMenu(e);
    });
}

const addToQueueMenuItem = document.getElementById('addToQueueMenu');
if (addToQueueMenuItem) {
    addToQueueMenuItem.addEventListener('click', (e) => {
        e.stopPropagation();
        if (contextMenuTrack) {
            addToQueue(contextMenuTrack);
        }
        document.getElementById('contextMenu').style.display = 'none';
    });
}

function initVisualizer() {
    const canvas = document.getElementById('visualizerCanvas');
    if (!canvas) {
        console.log('Canvas not found');
        return;
    }
    
    const canvasCtx = canvas.getContext('2d');
    const audioElement = document.getElementById('audioElement');
    
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaElementSource(audioElement);
            analyserNode = audioContext.createAnalyser();
            analyserNode.fftSize = 256;
            
            source.connect(analyserNode);
            analyserNode.connect(audioContext.destination);
            
            console.log('✓ Visualizer audio context initialized');
        } catch (error) {
            console.error('Error initializing visualizer:', error);
            return;
        }
    }
    
    function draw() {
        requestAnimationFrame(draw);
        
        if (!visualizerEnabled || !analyserNode || !isPlaying) {
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }
        
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteFrequencyData(dataArray);
        
        canvas.width = window.innerWidth;
        canvas.height = 150;
        
        canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;
        
        const accentColor = '#ffffff';
        
        for (let i = 0; i < bufferLength; i++) {
            barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
            
            const gradient = canvasCtx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
            gradient.addColorStop(0, accentColor);
            gradient.addColorStop(1, accentColor + '33');
            
            canvasCtx.fillStyle = gradient;
            canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            
            x += barWidth + 1;
        }
    }
    
    draw();
    console.log('✓ Visualizer started');
}

// Data Management Functions
document.getElementById('export-settings-btn')?.addEventListener('click', () => {
    const data = { localStorage: { ...localStorage } };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `impmusic-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById('import-settings-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            if (!data.localStorage) throw new Error('Invalid format');
            localStorage.clear();
            Object.entries(data.localStorage).forEach(([k, v]) => localStorage.setItem(k, v));
            alert('Imported successfully! Reloading...');
            setTimeout(() => location.reload(), 1000);
        } catch (err) {
            alert('Invalid file format. Please select a valid backup file.');
        }
    };
    reader.readAsText(file);
});

document.getElementById('reset-all-data-btn')?.addEventListener('click', () => {
    if (confirm('This will delete ALL saved data including playlists, liked songs, and settings. This cannot be undone. Continue?')) {
        localStorage.clear();
        alert('All data cleared!');
        setTimeout(() => location.reload(), 500);
    }
});

document.getElementById('closeDataManagementBtn')?.addEventListener('click', () => {
    document.getElementById('dataManagementModal').style.display = 'none';
});

// Data Management Functions
document.getElementById('export-settings-btn')?.addEventListener('click', () => {
    const data = { localStorage: { ...localStorage } };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `impmusic-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById('import-settings-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            if (!data.localStorage) throw new Error('Invalid format');
            localStorage.clear();
            Object.entries(data.localStorage).forEach(([k, v]) => localStorage.setItem(k, v));
            alert('Imported successfully! Reloading...');
            setTimeout(() => location.reload(), 1000);
        } catch (err) {
            alert('Invalid file format. Please select a valid backup file.');
        }
    };
    reader.readAsText(file);
});

document.getElementById('reset-all-data-btn')?.addEventListener('click', () => {
    if (confirm('This will delete ALL saved data including playlists, liked songs, and settings. This cannot be undone. Continue?')) {
        localStorage.clear();
        alert('All data cleared!');
        setTimeout(() => location.reload(), 500);
    }
});

document.getElementById('closeDataManagementBtn')?.addEventListener('click', () => {
    document.getElementById('dataManagementModal').style.display = 'none';
});

window.addEventListener('load', () => {
    setGreeting();
    loadPopularTracks();
    initProgressBar();
    initVolumeSlider();
    updateVolumeIcon();
    renderSavedPlaylists();
    setupInfiniteScroll();
    initVisualizer();
    
    const currentTrackOptionsBtn = document.getElementById('currentTrackOptions');
    if (currentTrackOptionsBtn) {
        currentTrackOptionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentTrack) {
                showContextMenu(e, currentTrack);
            }
        });
    }
});