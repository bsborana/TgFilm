// API Configuration
const API_CONFIG = {
    sheetDB: {
        sheet1: 'https://sheetdb.io/api/v1/o7r3xo681m8xn',
        sheet2: 'https://sheetdb.io/api/v1/8gisuluuwy7j1'
    },
    doodstream: {
        apiKey: '540740qkir3ys7ao8obt2l',
        listEndpoint: 'https://doodapi.co/api/file/list',
        embedBase: 'https://doodstream.com/e/'
    },
    tmdb: {
        apiKey: '83cc5358fefe8b5ffb79b0ba491fd1a3',
        searchEndpoint: 'https://api.themoviedb.org/3/search/movie',
        imageBase: 'https://image.tmdb.org/t/p/w500'
    },
    telegram: {
        botToken: '8089655173:AAEezz7roNy3PDfcgSAYbWAn7IQjXnUCKss',
        channelId: '-1003142437900'
    }
};

// Global State
let appState = {
    allMovies: [],
    searchResults: [],
    currentVideo: null,
    carouselIndex: 0
};

// DOM Elements
const elements = {
    searchInput: document.getElementById('searchInput'),
    searchButton: document.getElementById('searchButton'),
    moviePlayer: document.getElementById('movie-player'),
    videoFrame: document.getElementById('video-frame'),
    playerTitle: document.getElementById('player-title'),
    movieYear: document.getElementById('movie-year'),
    movieGenre: document.getElementById('movie-genre'),
    movieRating: document.getElementById('movie-rating'),
    closePlayer: document.getElementById('close-player'),
    adsSection: document.getElementById('ads-section'),
    newMoviesGrid: document.getElementById('new-movies-grid'),
    recommendedGrid: document.getElementById('recommended-movies-grid'),
    searchResultsSection: document.getElementById('search-results'),
    searchResultsGrid: document.getElementById('search-results-grid'),
    popupModal: document.getElementById('popup-modal'),
    carouselTrack: document.querySelector('.carousel-track'),
    carouselPrev: document.querySelector('.carousel-prev'),
    carouselNext: document.querySelector('.carousel-next')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    try {
        // Load all movie data
        await loadAllMovies();
        
        // Initialize carousel
        initializeCarousel();
        
        // Set up event listeners
        setupEventListeners();
        
        // Show popup modal (once per day)
        showPopupIfNeeded();
        
    } catch (error) {
        console.error('Error initializing app:', error);
        showError('Failed to load movie data. Please refresh the page.');
    }
}

// Load data from all APIs
async function loadAllMovies() {
    try {
        const [sheetData, doodstreamData, telegramData] = await Promise.all([
            fetchSheetDBMovies(),
            fetchDoodstreamMovies(),
            fetchTelegramMovies()
        ]);

        // Merge all data
        appState.allMovies = [
            ...sheetData,
            ...doodstreamData,
            ...telegramData
        ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Render sections
        renderHeroCarousel(appState.allMovies.slice(0, 10));
        renderNewMovies(appState.allMovies.slice(0, 5));
        renderRecommendedMovies(appState.allMovies.slice(5));

    } catch (error) {
        console.error('Error loading movies:', error);
        throw error;
    }
}

// SheetDB API Integration
async function fetchSheetDBMovies() {
    try {
        const [response1, response2] = await Promise.all([
            fetch(API_CONFIG.sheetDB.sheet1),
            fetch(API_CONFIG.sheetDB.sheet2)
        ]);
        
        const [data1, data2] = await Promise.all([
            response1.json(),
            response2.json()
        ]);
        
        return [...data1, ...data2].map(item => ({
            id: `sheet-${item.id}`,
            title: item.title,
            year: item.year,
            poster: item.poster,
            source: 'sheetdb',
            timestamp: item.timestamp,
            videoUrl: item.videoUrl
        }));
    } catch (error) {
        console.error('Error fetching SheetDB data:', error);
        return [];
    }
}

// Doodstream API Integration :cite[3]
async function fetchDoodstreamMovies() {
    try {
        const response = await fetch(
            `${API_CONFIG.doodstream.listEndpoint}?key=${API_CONFIG.doodstream.apiKey}`
        );
        const data = await response.json();
        
        if (data.result && data.result.files) {
            return data.result.files.map(file => ({
                id: `dood-${file.file_code}`,
                title: file.title,
                poster: file.single_img,
                source: 'doodstream',
                fileCode: file.file_code,
                timestamp: file.uploaded
            }));
        }
        return [];
    } catch (error) {
        console.error('Error fetching Doodstream data:', error);
        return [];
    }
}

// Telegram API Integration :cite[4]
async function fetchTelegramMovies() {
    try {
        // Note: This requires CORS proxy or backend in production
        const response = await fetch(
            `https://api.telegram.org/bot${API_CONFIG.telegram.botToken}/getUpdates`
        );
        const data = await response.json();
        
        // Filter and process channel messages
        const movies = data.result
            .filter(update => update.channel_post && update.channel_post.chat.id == API_CONFIG.telegram.channelId)
            .map(update => {
                const post = update.channel_post;
                return {
                    id: `telegram-${post.message_id}`,
                    title: post.caption || 'Telegram Video',
                    source: 'telegram',
                    timestamp: post.date * 1000,
                    fileId: post.video ? post.video.file_id : null
                };
            });
        
        return movies;
    } catch (error) {
        console.error('Error fetching Telegram data:', error);
        return [];
    }
}

// TMDb API Integration for enhanced movie data
async function fetchTMDBData(movieTitle) {
    try {
        const response = await fetch(
            `${API_CONFIG.tmdb.searchEndpoint}?api_key=${API_CONFIG.tmdb.apiKey}&query=${encodeURIComponent(movieTitle)}`
        );
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const movie = data.results[0];
            return {
                poster: movie.poster_path ? API_CONFIG.tmdb.imageBase + movie.poster_path : null,
                year: movie.release_date ? movie.release_date.split('-')[0] : 'N/A',
                rating: movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A',
                genre: 'Movie' // Would need genre API call for details
            };
        }
        return null;
    } catch (error) {
        console.error('Error fetching TMDb data:', error);
        return null;
    }
}

// Render Functions
function renderHeroCarousel(movies) {
    elements.carouselTrack.innerHTML = '';
    
    movies.forEach((movie, index) => {
        const heroItem = document.createElement('div');
        heroItem.className = 'hero-item';
        heroItem.innerHTML = `
            <img src="${movie.poster || 'default-poster.jpg'}" alt="${movie.title}">
            <div class="hero-content">
                <h2>${movie.title}</h2>
                <p>${movie.year || ''}</p>
                <button class="play-button" onclick="playMovie(${JSON.stringify(movie).replace(/"/g, '&quot;')})">
                    Play Now
                </button>
            </div>
        `;
        elements.carouselTrack.appendChild(heroItem);
    });
}

function renderNewMovies(movies) {
    renderMoviesGrid(elements.newMoviesGrid, movies);
}

function renderRecommendedMovies(movies) {
    renderMoviesGrid(elements.recommendedGrid, movies);
}

function renderMoviesGrid(container, movies) {
    // Clear skeleton loaders
    container.innerHTML = '';
    
    movies.forEach(movie => {
        const movieCard = createMovieCard(movie);
        container.appendChild(movieCard);
    });
}

function createMovieCard(movie) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.innerHTML = `
        <img src="${movie.poster || 'default-poster.jpg'}" alt="${movie.title}" class="movie-poster" 
             onerror="this.src='default-poster.jpg'">
        <div class="movie-info">
            <h3 class="movie-title">${movie.title}</h3>
            <span class="movie-year">${movie.year || ''}</span>
        </div>
        <button class="play-button" onclick="playMovie(${JSON.stringify(movie).replace(/"/g, '&quot;')})"></button>
    `;
    return card;
}

// Carousel Functionality
function initializeCarousel() {
    let currentIndex = 0;
    const items = document.querySelectorAll('.hero-item');
    
    function showSlide(index) {
        if (items.length === 0) return;
        
        currentIndex = (index + items.length) % items.length;
        elements.carouselTrack.style.transform = `translateX(-${currentIndex * 100}%)`;
    }
    
    elements.carouselPrev.addEventListener('click', () => showSlide(currentIndex - 1));
    elements.carouselNext.addEventListener('click', () => showSlide(currentIndex + 1));
    
    // Auto-advance carousel
    setInterval(() => showSlide(currentIndex + 1), 5000);
}

// Play Movie Functionality
async function playMovie(movie) {
    try {
        // Smooth scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Set movie metadata
        elements.playerTitle.textContent = movie.title;
        elements.movieYear.textContent = movie.year || 'N/A';
        elements.movieGenre.textContent = movie.genre || 'Movie';
        elements.movieRating.textContent = movie.rating ? `⭐ ${movie.rating}` : 'N/A';
        
        // Determine video URL based on source
        let videoUrl;
        switch (movie.source) {
            case 'doodstream':
                videoUrl = `${API_CONFIG.doodstream.embedBase}${movie.fileCode}`;
                break;
            case 'telegram':
                videoUrl = await getTelegramVideoUrl(movie.fileId);
                break;
            default:
                videoUrl = movie.videoUrl;
        }
        
        // Set video source
        elements.videoFrame.src = videoUrl;
        
        // Show player and ads
        elements.moviePlayer.classList.remove('hidden');
        elements.adsSection.classList.remove('hidden');
        
        // Fetch enhanced data from TMDb
        const enhancedData = await fetchTMDBData(movie.title);
        if (enhancedData) {
            if (enhancedData.year) elements.movieYear.textContent = enhancedData.year;
            if (enhancedData.rating) elements.movieRating.textContent = `⭐ ${enhancedData.rating}`;
        }
        
    } catch (error) {
        console.error('Error playing movie:', error);
        showError('Failed to play video. Please try another movie.');
    }
}

async function getTelegramVideoUrl(fileId) {
    try {
        const fileResponse = await fetch(
            `https://api.telegram.org/bot${API_CONFIG.telegram.botToken}/getFile?file_id=${fileId}`
        );
        const fileData = await fileResponse.json();
        
        if (fileData.ok) {
            return `https://api.telegram.org/file/bot${API_CONFIG.telegram.botToken}/${fileData.result.file_path}`;
        }
        throw new Error('Failed to get file path');
    } catch (error) {
        console.error('Error getting Telegram video URL:', error);
        throw error;
    }
}

// Search Functionality
async function performSearch(query) {
    if (!query.trim()) {
        elements.searchResultsSection.classList.add('hidden');
        return;
    }
    
    try {
        // Search in local movies
        const localResults = appState.allMovies.filter(movie =>
            movie.title.toLowerCase().includes(query.toLowerCase())
        );
        
        // Search TMDb for additional results
        const tmdbResults = await searchTMDB(query);
        
        // Combine results
        const allResults = [...localResults, ...tmdbResults];
        appState.searchResults = allResults;
        
        // Display results
        renderMoviesGrid(elements.searchResultsGrid, allResults);
        elements.searchResultsSection.classList.remove('hidden');
        
        // Scroll to results
        elements.searchResultsSection.scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('Error performing search:', error);
        showError('Search failed. Please try again.');
    }
}

async function searchTMDB(query) {
    try {
        const response = await fetch(
            `${API_CONFIG.tmdb.searchEndpoint}?api_key=${API_CONFIG.tmdb.apiKey}&query=${encodeURIComponent(query)}`
        );
        const data = await response.json();
        
        return data.results.map(movie => ({
            id: `tmdb-${movie.id}`,
            title: movie.title,
            year: movie.release_date ? movie.release_date.split('-')[0] : 'N/A',
            poster: movie.poster_path ? API_CONFIG.tmdb.imageBase + movie.poster_path : null,
            rating: movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A',
            source: 'tmdb'
        }));
    } catch (error) {
        console.error('Error searching TMDb:', error);
        return [];
    }
}

// Popup Modal Functionality
function showPopupIfNeeded() {
    const lastPopup = localStorage.getItem('lastPopup');
    const today = new Date().toDateString();
    
    if (!lastPopup || lastPopup !== today) {
        setTimeout(() => {
            elements.popupModal.classList.remove('hidden');
            localStorage.setItem('lastPopup', today);
        }, 3000);
        
        // Auto-close after 10 seconds
        setTimeout(() => {
            elements.popupModal.classList.add('hidden');
        }, 10000);
    }
}

// Event Listeners Setup
function setupEventListeners() {
    // Search functionality
    elements.searchButton.addEventListener('click', () => 
        performSearch(elements.searchInput.value.trim())
    );
    
    elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch(elements.searchInput.value.trim());
        }
    });
    
    // Close player
    elements.closePlayer.addEventListener('click', () => {
        elements.moviePlayer.classList.add('hidden');
        elements.adsSection.classList.add('hidden');
        elements.videoFrame.src = '';
    });
    
    // Modal buttons
    document.getElementById('add-to-home').addEventListener('click', () => {
        // PWA installation logic would go here
        alert('To add to home screen, use your browser\'s menu and select "Add to Home Screen"');
        elements.popupModal.classList.add('hidden');
    });
    
    document.getElementById('add-bookmark').addEventListener('click', () => {
        window.location.href = '#';
        alert('Use Ctrl+D (Cmd+D on Mac) to bookmark this page!');
        elements.popupModal.classList.add('hidden');
    });
    
    document.getElementById('close-modal').addEventListener('click', () => {
        elements.popupModal.classList.add('hidden');
    });
    
    // Error handling for images
    document.addEventListener('error', function(e) {
        if (e.target.tagName === 'IMG') {
            e.target.src = 'default-poster.jpg';
        }
    }, true);
}

// Utility Functions
function showError(message) {
    // Simple error notification
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff4444;
        color: white;
        padding: 1rem;
        border-radius: 8px;
        z-index: 3000;
        max-width: 300px;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        document.body.removeChild(errorDiv);
    }, 5000);
}

// Export for global access (if needed)
window.playMovie = playMovie;
window.performSearch = performSearch;
