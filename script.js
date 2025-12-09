// Global variables
let organizationsData = [];
let isIframeMode = false;
let isDataLoaded = false;
let organizationsWithCoords = [];
let zipCoordinatesData = null;
let cityCoordinatesData = null;

// Map variables
let map = null;
let heatLayer = null;
let markerCluster = null;
let currentMarkers = [];
let currentResults = [];
let showHeatMap = true;

// Check if running in iframe
if (window.self !== window.top) {
    isIframeMode = true;
    document.body.classList.add('iframe-mode');
}

// DOM elements
const zipInput = document.getElementById('zipInput');
const stateSelect = document.getElementById('stateSelect');
const housingTypeSelect = document.getElementById('housingTypeSelect');
const proximityServiceType = document.getElementById('proximityServiceType');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const searchWithFiltersBtn = document.getElementById('searchWithFiltersBtn');
const proximitySearchBtn = document.getElementById('proximitySearchBtn');
const resultsSection = document.getElementById('resultsSection');
const noResults = document.getElementById('noResults');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const resultsContainer = document.getElementById('resultsContainer');
const resultCount = document.getElementById('resultCount');
const newSearchBtn = document.getElementById('newSearchBtn');
const tryAgainBtn = document.getElementById('tryAgainBtn');
const expandSearchBtn = document.getElementById('expandSearchBtn');
const retryBtn = document.getElementById('retryBtn');
const listTabBtn = document.getElementById('listTabBtn');
const mapTabBtn = document.getElementById('mapTabBtn');
const listView = document.getElementById('listView');
const mapView = document.getElementById('mapView');
const mapContainer = document.getElementById('mapContainer');
const mapViewToggle = document.getElementById('mapViewToggle');
const fitBoundsBtn = document.getElementById('fitBoundsBtn');

// URLs from your GitHub repository
const CSV_URL = 'https://raw.githubusercontent.com/jwalith/Test_github_pages/main/01_master_all_states.csv';
const ZIP_COORDINATES_URL = 'https://raw.githubusercontent.com/jwalith/Test_github_pages/main/zip_coordinates.json';
const CITY_COORDINATES_URL = 'https://raw.githubusercontent.com/jwalith/Test_github_pages/main/city_coordinates.json';

// Event listeners
zipInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        handleSearchWithFilters();
    }
});
clearFiltersBtn.addEventListener('click', clearFilters);
searchWithFiltersBtn.addEventListener('click', handleSearchWithFilters);
proximitySearchBtn.addEventListener('click', handleProximitySearch);
newSearchBtn.addEventListener('click', resetToSearch);
tryAgainBtn.addEventListener('click', resetToSearch);
expandSearchBtn.addEventListener('click', expandSearch);
retryBtn.addEventListener('click', retryLoadData);

// Tab switching
if (listTabBtn) {
    listTabBtn.addEventListener('click', () => switchView('list'));
}
if (mapTabBtn) {
    mapTabBtn.addEventListener('click', () => switchView('map'));
}
if (mapViewToggle) {
    mapViewToggle.addEventListener('change', toggleHeatMap);
}
if (fitBoundsBtn) {
    fitBoundsBtn.addEventListener('click', fitMapToResults);
}

// Instructions toggle
const instructionsToggle = document.getElementById('instructionsToggle');
const instructionsContent = document.getElementById('instructionsContent');

if (instructionsToggle && instructionsContent) {
    instructionsToggle.addEventListener('click', function() {
        const isExpanded = instructionsToggle.getAttribute('aria-expanded') === 'true';
        instructionsContent.style.display = isExpanded ? 'none' : 'block';
        instructionsToggle.setAttribute('aria-expanded', !isExpanded);
    });
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Setup event delegation for action buttons (once on page load)
    setupActionButtons();
    
    // Load data from CSV
    loadDataFromCSV();
});

async function loadDataFromCSV() {
    showLoading();
    
    try {
        const response = await fetch(CSV_URL);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        organizationsData = parseCSV(csvText);
        
        // Populate dropdowns with unique values
        populateStateDropdown();
        populateHousingTypeDropdown();
        
        // Load coordinates from JSON file (instant)
        await loadCoordinatesFromJSON();
        
        isDataLoaded = true;
        hideLoading();
        
        // If in iframe, notify parent window
        if (isIframeMode) {
            window.parent.postMessage({
                type: 'search-system-ready',
                message: 'Search system is ready',
                dataCount: organizationsData.length
            }, '*');
        }
        
    } catch (err) {
        console.error('Error loading CSV data:', err);
        hideLoading();
        showError();
    }
}

// Proper CSV parser that handles quoted fields with commas
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let insideQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                // Escaped quote
                current += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote state
                insideQuotes = !insideQuotes;
            }
        } else if (char === ',' && !insideQuotes) {
            // Field separator
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    // Add last field
    values.push(current.trim());
    
    return values;
}

function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const organizations = [];
    
    if (lines.length < 2) {
        console.warn('CSV file appears to be empty or invalid');
        return organizations;
    }
    
    // Get headers (first line) - use proper CSV parsing
    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
    
    // Process data lines
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines
        
        // Use proper CSV parser to handle quoted fields
        const values = parseCSVLine(line).map(v => v.replace(/^"|"$/g, '')); // Remove quotes
        
        if (values.length >= headers.length) {
            const org = {};
            
            // Map values to headers
            headers.forEach((header, index) => {
                org[header] = values[index] || '';
            });
            
            // Ensure we have required fields - include all records regardless of zip code
            organizations.push({
                name: org.name || org.organization || org['org name'] || 'Unknown',
                type: org.housing_type || org.type || org.category || org['org type'] || 'Unknown',
                zip: String(org.zip || org['zip code'] || org.zipcode || ''),
                city: org.city || 'Unknown',
                state: org.state || org['state code'] || 'Unknown',
                phone: org.phone || '',
                email: org.email || '',
                address: org.address || ''
            });
        }
    }
    
    return organizations;
}

// Helper functions
function validateZipCode(zipCode) {
    return /^\d{5}(-\d{4})?$/.test(zipCode);
}

function checkDataLoaded() {
    if (!isDataLoaded) {
        showUserMessage('Data is still loading. Please wait a moment and try again.', 'warning');
        return false;
    }
    return true;
}

function getRadiusSelect() {
    const radiusSelect = document.getElementById('radiusSelect');
    if (!radiusSelect) {
        console.error('Radius select element not found');
        showUserMessage('Error: Search radius selector not found', 'error');
        return null;
    }
    return radiusSelect;
}

// Removed handleSearch function - now using unified handleSearchWithFilters

function searchByZipCode(zipCode) {
    // Normalize zip code (remove dashes and extra spaces)
    const normalizedZip = zipCode.replace(/\D/g, '');
    
    return organizationsData.filter(org => {
        const orgZip = org.zip.replace(/\D/g, '');
        return orgZip === normalizedZip;
    });
}

function searchWithFilters() {
    const zipCode = zipInput.value.trim();
    const selectedState = stateSelect.value;
    const selectedHousingType = housingTypeSelect.value;
    
    // Use organizationsWithCoords to include coordinates for map visualization
    // Fallback to organizationsData if coordinates haven't loaded yet
    let results = (organizationsWithCoords && organizationsWithCoords.length > 0) 
        ? organizationsWithCoords 
        : organizationsData;
    
    // Filter by zip code if provided
    if (zipCode) {
        const normalizedZip = zipCode.replace(/\D/g, '');
        results = results.filter(org => {
            const orgZip = org.zip.replace(/\D/g, '');
            return orgZip === normalizedZip;
        });
    }
    
    // Filter by state if selected
    if (selectedState) {
        results = results.filter(org => org.state === selectedState);
    }
    
    // Filter by housing type if selected
    if (selectedHousingType) {
        results = results.filter(org => org.type === selectedHousingType);
    }
    
    return results;
}

function populateStateDropdown() {
    const states = [...new Set(organizationsData.map(org => org.state))].sort();
    
    states.forEach(state => {
        if (state && state.length === 2) { // Only add valid state codes
            const option = document.createElement('option');
            option.value = state;
            option.textContent = state;
            stateSelect.appendChild(option);
        }
    });
}

function populateHousingTypeDropdown() {
    const housingTypes = [...new Set(organizationsData.map(org => org.type))].sort();
    
    housingTypes.forEach(type => {
        if (type && type !== 'Unknown') {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            housingTypeSelect.appendChild(option);
            
            // Also populate the proximity service type dropdown
            const proximityOption = document.createElement('option');
            proximityOption.value = type;
            proximityOption.textContent = type;
            proximityServiceType.appendChild(proximityOption);
        }
    });
}

function clearFilters() {
    zipInput.value = '';
    stateSelect.value = '';
    housingTypeSelect.value = '';
    proximityServiceType.value = '';
    hideAllSections();
}

// New helper functions for better UX
function resetToSearch() {
    hideAllSections();
    zipInput.focus();
}

function expandSearch() {
    // Increase search radius and try again
    const radiusSelect = getRadiusSelect();
    if (radiusSelect) {
        const currentRadius = parseInt(radiusSelect.value);
        const newRadius = Math.min(currentRadius * 2, 50);
        radiusSelect.value = newRadius;
        
        // Try the last search again with expanded radius
        if (zipInput.value.trim()) {
            handleSearch();
        } else {
            handleProximitySearch();
        }
    }
}

function retryLoadData() {
    hideAllSections();
    loadDataFromCSV();
}

function showUserMessage(message, type = 'info') {
    // Create a more user-friendly message system
    const messageDiv = document.createElement('div');
    messageDiv.className = `user-message ${type}`;
    messageDiv.innerHTML = `
        <div class="message-content">
            <span class="message-icon">${type === 'error' ? '⚠️' : type === 'warning' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'}</span>
            <span class="message-text">${message}</span>
            <button class="message-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    // Add styles if not already added
    if (!document.getElementById('message-styles')) {
        const style = document.createElement('style');
        style.id = 'message-styles';
        style.textContent = `
            .user-message {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 1000;
                max-width: 400px;
                animation: slideIn 0.3s ease;
            }
            .user-message.error { border-left: 4px solid #ef4444; }
            .user-message.warning { border-left: 4px solid #f59e0b; }
            .user-message.success { border-left: 4px solid #10b981; }
            .user-message.info { border-left: 4px solid #3b82f6; }
            .message-content {
                display: flex;
                align-items: center;
                padding: 12px 16px;
                gap: 8px;
            }
            .message-icon { font-size: 18px; }
            .message-text { flex: 1; font-size: 14px; }
            .message-close {
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #6b7280;
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(messageDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentElement) {
            messageDiv.remove();
        }
    }, 5000);
}

function handleSearchWithFilters() {
    if (!checkDataLoaded()) return;
    
    const zipCode = zipInput.value.trim();
    const selectedState = stateSelect.value;
    const selectedHousingType = housingTypeSelect.value;
    
    // Check if at least one search criteria is provided
    if (!zipCode && !selectedState && !selectedHousingType) {
        showUserMessage('⚠️ Please select at least one search option: Enter a zip code, select a state, or choose a service type. You cannot search for all services in all states at once.', 'warning');
        return;
    }
    
    // Validate zip code if provided
    if (zipCode && !validateZipCode(zipCode)) {
        showUserMessage('Please enter a valid zip code (e.g., 12345)', 'warning');
        return;
    }
    
    // Perform search with filters
    const results = searchWithFilters();
    displayResults(results, {
        zipCode: zipCode,
        state: selectedState,
        housingType: selectedHousingType,
        searchType: zipCode ? 'zip' : 'filters'
    });
}

// Handle proximity search using current location
async function handleProximitySearch() {
    if (!checkDataLoaded()) return;
    
    const radiusSelect = getRadiusSelect();
    if (!radiusSelect) return;
    
    const selectedHousingType = proximityServiceType.value;
    const radiusMiles = parseInt(radiusSelect.value);
    
    if (isNaN(radiusMiles) || radiusMiles <= 0) {
        showUserMessage('Please select a valid search radius', 'warning');
        return;
    }
    
    try {
        showLoading();
        
        // Show a more specific loading message for location
        const loadingElement = document.querySelector('.loading-content p');
        if (loadingElement) {
            loadingElement.textContent = 'Getting your location...';
        }
        
        const location = await getCurrentLocation();
        
        // Update loading message
        if (loadingElement) {
            loadingElement.textContent = 'Searching for nearby services...';
        }
        
        const results = searchByProximityWithFilters(location.latitude, location.longitude, radiusMiles, selectedHousingType);
        
        displayResults(results, {
            housingType: selectedHousingType,
            radius: radiusMiles,
            searchType: 'proximity'
        });
    } catch (error) {
        console.error('Error getting location:', error);
        hideLoading();
        
        // Provide more specific error messages based on the error type
        let errorMessage = 'Unable to get your location. ';
        
        if (error.code === 1) {
            errorMessage += 'Location access was denied. Please allow location access and try again.';
        } else if (error.code === 2) {
            errorMessage += 'Location is unavailable. Please check your internet connection and try again.';
        } else if (error.code === 3) {
            errorMessage += 'Location request timed out. Please try again.';
        } else {
            errorMessage += 'Please check your browser permissions or try searching by zip code instead.';
        }
        
        showUserMessage(errorMessage, 'error');
    }
}

// Handle proximity search using zip code - REMOVED since we simplified to only have direct zip search and current location search

function displayResults(results, searchContext = {}) {
    hideAllSections();
    
    if (results.length === 0) {
        noResults.style.display = 'block';
        
        // Generate specific "no results" message based on search context
        const message = generateNoResultsMessage(searchContext);
        const messageDiv = noResults.querySelector('.no-results-message');
        messageDiv.innerHTML = `<p>${message}</p>`;
        
        // Scroll to no results section
        setTimeout(() => {
            noResults.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 100);
        return;
    }
    
    resultsSection.style.display = 'block';
    resultCount.textContent = `${results.length} service${results.length !== 1 ? 's' : ''} found`;
    
    resultsContainer.innerHTML = '';
    
    results.forEach(org => {
        const resultCard = createResultCard(org);
        resultsContainer.appendChild(resultCard);
    });
    
    // Scroll to results section
    setTimeout(() => {
        resultsSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }, 100);
    
    // Store current results for map
    currentResults = results;
    
    // Update map with results if map is already initialized
    // (Map will be initialized when user switches to map view)
    if (map) {
        updateMapWithResults(results);
    }
}

// Setup event delegation for action buttons (called once on page load)
function setupActionButtons() {
    // Wait for resultsContainer to be available
    if (!resultsContainer) {
        setTimeout(setupActionButtons, 100);
        return;
    }
    
    // Event delegation - handles clicks on dynamically added buttons
    resultsContainer.addEventListener('click', function(e) {
        const button = e.target.closest('.action-btn');
        if (!button) return;
        
        const action = button.getAttribute('data-action');
        const text = button.getAttribute('data-text');
        const message = button.getAttribute('data-message');
        
        if (action === 'copy') {
            copyToClipboard(text, message || 'Copied to clipboard!');
        } else if (action === 'search') {
            searchOnGoogle(text);
        } else if (action === 'directions') {
            getDirections(text);
        }
    });
}

function generateNoResultsMessage(searchContext) {
    const { zipCode, state, housingType, radius, searchType } = searchContext;
    
    let message = "No services found";
    
    // Build the message based on applied filters
    const filters = [];
    
    if (housingType) {
        filters.push(`"${housingType}"`);
    }
    
    if (searchType === 'proximity') {
        if (radius) {
            filters.push(`within ${radius} miles`);
        }
        if (zipCode) {
            filters.push(`of zip code ${zipCode}`);
        } else {
            filters.push(`near your location`);
        }
    } else if (zipCode) {
        filters.push(`in zip code ${zipCode}`);
    } else if (state) {
        filters.push(`in ${state}`);
    }
    
    if (state && zipCode) {
        filters.push(`in ${state}`);
    }
    
    if (filters.length > 0) {
        message += ` ${filters.join(' ')}`;
    }
    
    return message + ". Try expanding your search or checking nearby areas.";
}

function createResultCard(org) {
    const card = document.createElement('div');
    card.className = 'result-card';
    
    // Add distance info if available
    const distanceInfo = org.distance ? `
        <div class="detail-item distance-item">
            <span class="detail-label">Distance</span>
            <span class="detail-value distance-value">${org.distance} miles away</span>
        </div>
    ` : '';
    
    card.innerHTML = `
        <h3>${org.name}</h3>
        <div class="result-details">
            ${distanceInfo}
            <div class="detail-item">
                <span class="detail-label">Service Type</span>
                <span class="detail-value">${org.type}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Location</span>
                <span class="detail-value">${org.city}, ${org.state} ${org.zip || ''}</span>
            </div>
            ${org.address ? `
            <div class="detail-item">
                <span class="detail-label">Address</span>
                <span class="detail-value">${org.address}</span>
            </div>
            ` : ''}
            ${org.phone ? `
            <div class="detail-item contact-item">
                <span class="detail-label">📞 Phone</span>
                <span class="detail-value">
                    <a href="tel:${org.phone}" class="contact-link phone-link" title="Click to call">
                        ${org.phone}
                    </a>
                </span>
            </div>
            ` : ''}
            ${org.email ? `
            <div class="detail-item contact-item">
                <span class="detail-label">✉️ Email</span>
                <span class="detail-value">
                    <a href="mailto:${org.email}" class="contact-link email-link" title="Click to send email">
                        ${org.email}
                    </a>
                </span>
            </div>
            ` : ''}
        </div>
        <div class="card-actions">
            <button class="action-btn copy-name-btn" data-action="copy" data-text="${escapeHtml(org.name)}" data-message="Organization name copied!" title="Copy organization name">
                <span class="btn-icon">📋</span>
                <span class="btn-text">Copy Name</span>
            </button>
            <button class="action-btn search-btn" data-action="search" data-text="${escapeHtml(org.name)}" title="Search on Google">
                <span class="btn-icon">🔍</span>
                <span class="btn-text">Search Web</span>
            </button>
            ${org.address ? `
            <button class="action-btn directions-btn" data-action="directions" data-text="${escapeHtml(org.address)}" title="Get directions">
                <span class="btn-icon">📍</span>
                <span class="btn-text">Directions</span>
            </button>
            ` : ''}
        </div>
    `;
    
    return card;
}

// Escape HTML to prevent XSS issues
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Copy to clipboard helper function
function copyToClipboard(text, message) {
    // Remove HTML tags if any
    const cleanText = text.replace(/<[^>]*>/g, '');
    
    navigator.clipboard.writeText(cleanText).then(() => {
        showUserMessage(message || 'Copied to clipboard!', 'success');
    }).catch(() => {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = cleanText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showUserMessage(message || 'Copied to clipboard!', 'success');
        } catch (err) {
            showUserMessage('Unable to copy. Please select and copy manually.', 'warning');
        }
        document.body.removeChild(textarea);
    });
}

// Search on Google helper function
function searchOnGoogle(searchTerm) {
    const query = encodeURIComponent(searchTerm.trim());
    window.open(`https://www.google.com/search?q=${query}`, '_blank', 'noopener,noreferrer');
}

// Get directions helper function
function getDirections(address) {
    const query = encodeURIComponent(address.trim());
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank', 'noopener,noreferrer');
}

function showLoading() {
    hideAllSections();
    loading.style.display = 'block';
}

function hideLoading() {
    loading.style.display = 'none';
}

function showError() {
    hideAllSections();
    error.style.display = 'block';
}

function hideAllSections() {
    resultsSection.style.display = 'none';
    noResults.style.display = 'none';
    loading.style.display = 'none';
    error.style.display = 'none';
}

// Listen for messages from parent window (if in iframe)
window.addEventListener('message', function(event) {
    if (event.data.type === 'search-by-zip') {
        zipInput.value = event.data.zipCode;
        handleSearch();
    }
});

// Geolocation and Distance Functions
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by this browser'));
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
            },
            (error) => {
                reject(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 15000, // Increased timeout to 15 seconds
                maximumAge: 300000 // 5 minutes
            }
        );
    });
}

// Get coordinates for a zip code from the loaded JSON data
function getCoordinatesFromZip(zipCode) {
    // Access the globally stored zip coordinates data
    if (!window.zipCoordinatesData) {
        throw new Error('Zip coordinates data not loaded yet');
    }
    
    const coords = window.zipCoordinatesData.coordinates[zipCode];
    
    if (coords && coords.latitude && coords.longitude) {
        return {
            latitude: coords.latitude,
            longitude: coords.longitude
        };
    }
    
    // If not found in our data, throw an error
    throw new Error(`No coordinates found for zip code ${zipCode}`);
}

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in miles
}

// Load coordinates from JSON files (instant)
async function loadCoordinatesFromJSON() {
    organizationsWithCoords = [];
    
    try {
        // Load both zip and city coordinates
        const [zipResponse, cityResponse] = await Promise.all([
            fetch(ZIP_COORDINATES_URL),
            fetch(CITY_COORDINATES_URL)
        ]);
        
        if (!zipResponse.ok) {
            throw new Error(`HTTP error loading zip coordinates! status: ${zipResponse.status}`);
        }
        
        const zipCoordinatesData = await zipResponse.json();
        let cityCoordinatesData = null;
        
        // Store globally for access by other functions
        window.zipCoordinatesData = zipCoordinatesData;
        window.cityCoordinatesData = cityCoordinatesData;
        
        // City coordinates are optional (may not exist yet)
        if (cityResponse.ok) {
            cityCoordinatesData = await cityResponse.json();
            window.cityCoordinatesData = cityCoordinatesData;
        } else {
            console.log('City coordinates file not found - will only use zip coordinates');
        }
        
        // Add coordinates to organizations
        organizationsData.forEach(org => {
            let latitude = null;
            let longitude = null;
            let coordinateSource = 'none';
            
            // Try zip coordinates first (but skip empty zip codes)
            if (org.zip && org.zip.trim() !== '' && zipCoordinatesData.coordinates[org.zip]) {
                const coords = zipCoordinatesData.coordinates[org.zip];
                latitude = coords.latitude;
                longitude = coords.longitude;
                coordinateSource = 'zip';
            }
            // Fall back to city coordinates if zip not available
            else if (cityCoordinatesData && org.city && org.state) {
                const cityKey = `${org.city}, ${org.state}`;
                const cityCoords = cityCoordinatesData.city_coordinates[cityKey];
                if (cityCoords) {
                    latitude = cityCoords.latitude;
                    longitude = cityCoords.longitude;
                    coordinateSource = 'city';
                }
            }
            
            organizationsWithCoords.push({
                ...org,
                latitude: latitude,
                longitude: longitude,
                coordinateSource: coordinateSource
            });
        });
        
        // Log basic statistics
        const zipCount = organizationsWithCoords.filter(org => org.coordinateSource === 'zip').length;
        const cityCount = organizationsWithCoords.filter(org => org.coordinateSource === 'city').length;
        const noCoordsCount = organizationsWithCoords.filter(org => org.coordinateSource === 'none').length;
        
        console.log(`Coordinates loaded: ${zipCount} zip-based, ${cityCount} city-based, ${noCoordsCount} no coordinates`);
        
    } catch (error) {
        console.error('Error loading coordinates from JSON:', error);
        showUserMessage('Error loading coordinates. Please check if coordinate files exist on GitHub.', 'error');
        throw error; // Stop execution instead of falling back
    }
}


// Search organizations within a certain radius with housing type filter
function searchByProximityWithFilters(userLat, userLon, radiusMiles, housingType = '') {
    return organizationsWithCoords.filter(org => {
        // Filter by housing type first (if specified)
        if (housingType && org.type !== housingType) {
            return false;
        }
        
        // Then filter by distance
        if (!org.latitude || !org.longitude) return false;
        
        const distance = calculateDistance(userLat, userLon, org.latitude, org.longitude);
        return distance <= radiusMiles;
    }).map(org => {
        const distance = calculateDistance(userLat, userLon, org.latitude, org.longitude);
        return {
            ...org,
            distance: Math.round(distance * 10) / 10 // Round to 1 decimal place
        };
    }).sort((a, b) => a.distance - b.distance); // Sort by distance
}

// ==================== MAP FUNCTIONALITY ====================

// Initialize Leaflet map
function initializeMap() {
    if (!mapContainer) {
        console.error('Map container not found');
        return;
    }
    
    // Check if Leaflet is loaded
    if (typeof L === 'undefined') {
        console.error('Leaflet library not loaded');
        return;
    }
    
    console.log('Initializing map...');
    
    // Create map centered on USA
    map = L.map('mapContainer', {
        center: [39.8283, -98.5795], // Geographic center of USA
        zoom: 4,
        zoomControl: true,
        attributionControl: true
    });
    
    // Add OpenStreetMap tiles (free, no API key required)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Check if heat plugin is available
    if (typeof L.heatLayer !== 'undefined') {
        console.log('Heat map plugin loaded successfully');
    } else {
        console.warn('Heat map plugin not loaded - will use markers only');
    }
    
    // Check if marker cluster is available
    if (typeof L.markerClusterGroup !== 'undefined') {
        // Initialize marker cluster group
        markerCluster = L.markerClusterGroup({
            chunkedLoading: true,
            chunkInterval: 200,
            chunkDelay: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true
        });
        console.log('Marker cluster initialized');
    } else {
        console.warn('Marker cluster plugin not loaded');
    }
    
    // Add event listeners for viewport changes
    let updateTimeout;
    map.on('moveend', () => {
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(() => {
            if (showHeatMap && currentResults.length > 0) {
                updateHeatMap();
            }
        }, 300); // Debounce updates
    });
    
    map.on('zoomend', () => {
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(() => {
            if (showHeatMap && currentResults.length > 0) {
                updateHeatMap();
            }
        }, 300);
    });
}

// Switch between List and Map views
function switchView(view) {
    if (view === 'list') {
        listTabBtn.classList.add('active');
        mapTabBtn.classList.remove('active');
        listView.style.display = 'block';
        mapView.style.display = 'none';
    } else if (view === 'map') {
        listTabBtn.classList.remove('active');
        mapTabBtn.classList.add('active');
        listView.style.display = 'none';
        mapView.style.display = 'block';
        
        // Initialize map if not already done
        if (!map && mapContainer) {
            // Small delay to ensure container is visible
            setTimeout(() => {
                initializeMap();
                // Update map with current results after initialization
                if (map && currentResults.length > 0) {
                    updateMapWithResults(currentResults);
                }
            }, 100);
        } else if (map) {
            // Map already exists, just update it
            map.invalidateSize(); // Ensure map renders correctly
            if (currentResults.length > 0) {
                updateMapWithResults(currentResults);
            }
        }
    }
}

// Toggle between heat map and markers
function toggleHeatMap() {
    showHeatMap = mapViewToggle.checked;
    if (map && currentResults.length > 0) {
        updateMapWithResults(currentResults);
    }
}

// Update map with search results
function updateMapWithResults(results) {
    if (!map) {
        console.error('Map not initialized when trying to update with results');
        return;
    }
    
    console.log(`Updating map with ${results.length} results`);
    
    // Clear existing layers
    clearMapLayers();
    
    // Filter results to only those with coordinates
    const resultsWithCoords = results.filter(org => 
        org.latitude && org.longitude && 
        !isNaN(org.latitude) && !isNaN(org.longitude)
    );
    
    console.log(`Results with coordinates: ${resultsWithCoords.length}`);
    
    if (resultsWithCoords.length === 0) {
        console.warn('No results with coordinates to display on map');
        return;
    }
    
    if (showHeatMap && typeof L.heatLayer !== 'undefined') {
        // Show heat map for overview
        addHeatMapLayer(resultsWithCoords);
        
        // Always show markers when zoomed in (zoom level > 6) for better visibility
        // This helps users see individual locations even with heat map
        if (map.getZoom() > 6) {
            addMarkers(resultsWithCoords);
        }
    } else {
        // Show only markers (fallback if heat plugin not available or disabled)
        console.log('Using markers instead of heat map');
        addMarkers(resultsWithCoords);
    }
    
    // Fit map to bounds if there are results
    if (resultsWithCoords.length > 0) {
        fitMapToResults();
    }
}

// Add heat map layer with viewport filtering
function addHeatMapLayer(results) {
    if (!map) {
        console.error('Map not initialized');
        return;
    }
    
    // Check if heat plugin is loaded
    if (typeof L.heatLayer === 'undefined') {
        console.error('Leaflet heat plugin not loaded. Using markers instead.');
        // Fallback to markers if heat plugin not available
        addMarkers(results);
        return;
    }
    
    // For initial display or when zoomed out, show all results
    // For performance, limit to 5000 points max
    const maxPoints = 5000;
    const limitedResults = results.length > maxPoints ? results.slice(0, maxPoints) : results;
    
    // Get current map bounds for viewport filtering (only when zoomed in)
    const zoom = map.getZoom();
    let visibleResults = limitedResults;
    
    // Only filter by viewport when zoomed in (zoom > 6) for better performance
    if (zoom > 6) {
        const bounds = map.getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        
        // Filter results to visible area (with some padding)
        const padding = 0.1; // 10% padding
        const latRange = ne.lat - sw.lat;
        const lngRange = ne.lng - sw.lng;
        
        visibleResults = limitedResults.filter(org => {
            return org.latitude >= (sw.lat - latRange * padding) &&
                   org.latitude <= (ne.lat + latRange * padding) &&
                   org.longitude >= (sw.lng - lngRange * padding) &&
                   org.longitude <= (ne.lng + lngRange * padding);
        });
    }
    
    // Create heat map data points with higher intensity for better visibility
    const heatData = visibleResults.map(org => [
        org.latitude,
        org.longitude,
        1.0 // Intensity (0-1) - using max intensity for better visibility
    ]);
    
    if (heatData.length > 0) {
        heatLayer = L.heatLayer(heatData, {
            radius: 35, // Increased radius for better visibility
            blur: 20,   // Increased blur for smoother appearance
            maxZoom: 17,
            max: 1.0,
            minOpacity: 0.3, // Minimum opacity to ensure visibility
            gradient: {
                0.0: 'rgba(0, 0, 255, 0.4)',    // Blue with opacity
                0.3: 'rgba(0, 255, 0, 0.6)',    // Green with opacity
                0.6: 'rgba(255, 255, 0, 0.8)',  // Yellow with opacity
                0.9: 'rgba(255, 165, 0, 0.9)',  // Orange with opacity
                1.0: 'rgba(255, 0, 0, 1.0)'     // Red with full opacity
            }
        }).addTo(map);
        
        console.log(`Heat map added with ${heatData.length} points`);
    } else {
        console.warn('No heat map data points to display');
    }
}

// Add markers with clustering
function addMarkers(results) {
    if (!map) {
        console.error('Map not initialized for markers');
        return;
    }
    
    console.log(`Adding markers for ${results.length} results`);
    
    // Get current map bounds for viewport filtering (only when zoomed in)
    const zoom = map.getZoom();
    let visibleResults = results;
    
    // Only filter by viewport when zoomed in (zoom > 6) for better performance
    if (zoom > 6) {
        const bounds = map.getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        
        // Filter to visible area
        visibleResults = results.filter(org => {
            return org.latitude >= sw.lat &&
                   org.latitude <= ne.lat &&
                   org.longitude >= sw.lng &&
                   org.longitude <= ne.lng;
        });
    }
    
    // Limit markers for performance (max 2000 at a time)
    const limitedResults = visibleResults.slice(0, 2000);
    
    console.log(`Displaying ${limitedResults.length} markers (filtered from ${results.length})`);
    
    // Clear existing markers
    if (markerCluster) {
        markerCluster.clearLayers();
    }
    currentMarkers = [];
    
    // Create markers with custom icons for better visibility
    const defaultIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });
    
    // Create markers
    limitedResults.forEach(org => {
        try {
            const marker = L.marker([org.latitude, org.longitude], {
                title: org.name,
                icon: defaultIcon
            });
            
            // Create popup content
            const popupContent = createMarkerPopup(org);
            marker.bindPopup(popupContent, {
                maxWidth: 300,
                className: 'custom-popup'
            });
            
            if (markerCluster) {
                markerCluster.addLayer(marker);
            } else {
                // Fallback: add directly to map if clustering not available
                marker.addTo(map);
            }
            
            currentMarkers.push(marker);
        } catch (error) {
            console.error(`Error creating marker for ${org.name}:`, error);
        }
    });
    
    // Add cluster group to map if available
    if (markerCluster && currentMarkers.length > 0) {
        map.addLayer(markerCluster);
        console.log(`Added ${currentMarkers.length} markers to map`);
    }
}

// Create popup content for markers
function createMarkerPopup(org) {
    const distanceInfo = org.distance ? `<p><strong>Distance:</strong> ${org.distance} miles</p>` : '';
    const phoneLink = org.phone ? `<p><strong>Phone:</strong> <a href="tel:${org.phone}">${org.phone}</a></p>` : '';
    const emailLink = org.email ? `<p><strong>Email:</strong> <a href="mailto:${org.email}">${org.email}</a></p>` : '';
    
    return `
        <div class="marker-popup">
            <h4>${escapeHtml(org.name)}</h4>
            <p><strong>Type:</strong> ${escapeHtml(org.type)}</p>
            <p><strong>Location:</strong> ${escapeHtml(org.city)}, ${escapeHtml(org.state)} ${escapeHtml(org.zip || '')}</p>
            ${org.address ? `<p><strong>Address:</strong> ${escapeHtml(org.address)}</p>` : ''}
            ${distanceInfo}
            ${phoneLink}
            ${emailLink}
        </div>
    `;
}

// Clear all map layers
function clearMapLayers() {
    if (heatLayer) {
        map.removeLayer(heatLayer);
        heatLayer = null;
    }
    
    if (markerCluster) {
        markerCluster.clearLayers();
    }
    
    currentMarkers = [];
}

// Fit map bounds to show all results
function fitMapToResults() {
    if (!map || currentResults.length === 0) return;
    
    const resultsWithCoords = currentResults.filter(org => 
        org.latitude && org.longitude && 
        !isNaN(org.latitude) && !isNaN(org.longitude)
    );
    
    if (resultsWithCoords.length === 0) return;
    
    // Create bounds from all results
    const bounds = L.latLngBounds(
        resultsWithCoords.map(org => [org.latitude, org.longitude])
    );
    
    // Fit map to bounds with padding
    map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 12
    });
}

// Update heat map when viewport changes (called by map event listeners)
function updateHeatMap() {
    if (!showHeatMap || !map || currentResults.length === 0) return;
    
    // Remove old heat layer
    if (heatLayer) {
        map.removeLayer(heatLayer);
        heatLayer = null;
    }
    
    // Add new heat layer with filtered data
    const resultsWithCoords = currentResults.filter(org => 
        org.latitude && org.longitude && 
        !isNaN(org.latitude) && !isNaN(org.longitude)
    );
    
    if (resultsWithCoords.length > 0) {
        addHeatMapLayer(resultsWithCoords);
    }
}