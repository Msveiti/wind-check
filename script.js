// DOM Elements
const locationElement = document.getElementById('locationName');
const verdictElement = document.getElementById('verdict');
const detailsElement = document.getElementById('details');
const refreshBtn = document.getElementById('refreshBtn');
const shareBtn = document.getElementById('shareBtn');
const errorMessage = document.getElementById('error-message');
const loadingSpinner = document.getElementById('loading-spinner');

// Open-Meteo API endpoint
const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast';

// Reverse geocode coordinates to a city/neighborhood name
async function getLocationName(lat, lon) {
    try {
        // Nominatim requires a User-Agent header identifying your app
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
        const response = await fetch(url, {
            headers: { 
                'User-Agent': 'WindChecker/1.0 (your-email@example.com)' // Replace with real email
            }
        });
        
        if (!response.ok) {
            console.warn('Nominatim API error:', response.status);
            return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
        }
        
        const data = await response.json();
        
        // Extract city, town, village, county, or state
        const address = data.address || {};
        const locationName = address.city || 
                            address.town || 
                            address.village || 
                            address.hamlet ||
                            address.suburb ||
                            address.county || 
                            address.state || 
                            `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
        
        // Add state/country for context if it's a smaller location
        if (address.state && locationName !== address.state) {
            const countryCode = address.country_code?.toUpperCase();
            if (countryCode === 'US' && address.state) {
                // For US, show "City, ST" format
                const stateAbbr = getStateAbbreviation(address.state);
                return stateAbbr ? `${locationName}, ${stateAbbr}` : `${locationName}, ${address.state}`;
            } else {
                return `${locationName}, ${address.state}`;
            }
        }
        
        return locationName;
    } catch (e) {
        console.error('Reverse geocoding error:', e);
        return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
    }
}

// Helper function to get US state abbreviations
function getStateAbbreviation(stateName) {
    const stateMap = {
        'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
        'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
        'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
        'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
        'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
        'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
        'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
        'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
        'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
        'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
    };
    return stateMap[stateName] || null;
}

// Fetch wind data from Open-Meteo
async function fetchWindData(lat, lon) {
    const params = new URLSearchParams({
        latitude: lat,
        longitude: lon,
        current: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m',
        timezone: 'auto',
        forecast_days: 1
    });
    
    const response = await fetch(`${WEATHER_API_URL}?${params}`);
    
    if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
    }
    
    return await response.json();
}

// Geocode location name to coordinates using Nominatim
async function geocodeLocation(locationName) {
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}&limit=1`;
        const response = await fetch(url, {
            headers: { 
                'User-Agent': 'WindChecker/1.0 (your-email@example.com)' // Replace with real email
            }
        });
        
        if (!response.ok) {
            throw new Error('Geocoding failed');
        }
        
        const data = await response.json();
        
        if (data.length === 0) {
            throw new Error('Location not found');
        }
        
        return {
            lat: parseFloat(data[0].lat),
            lon: parseFloat(data[0].lon),
            displayName: data[0].display_name
        };
    } catch (e) {
        console.error('Geocoding error:', e);
        throw e;
    }
}

// Get human-readable wind description
function getFeelsLikeDescription(windSpeedMph) {
    if (windSpeedMph < 1) return 'Smoke rises vertically.';
    if (windSpeedMph < 4) return 'Wind felt on face.';
    if (windSpeedMph < 7) return 'Leaves rustle.';
    if (windSpeedMph < 11) return 'Small branches move.';
    if (windSpeedMph < 15) return 'Hair gets messy.';
    if (windSpeedMph < 20) return 'Whole trees sway.';
    if (windSpeedMph < 25) return 'Difficult to hold umbrella.';
    if (windSpeedMph < 31) return 'Walking is difficult.';
    if (windSpeedMph < 39) return 'Walking is a struggle.';
    return 'Stay indoors if possible.';
}

// Update the UI with wind data
async function updateWindDisplay(lat, lon, locationName = null) {
    try {
        // Hide error message
        errorMessage.classList.add('hidden');
        
        // Get location name if not provided
        if (!locationName) {
            locationName = await getLocationName(lat, lon);
        }
        
        // Fetch weather data
        const data = await fetchWindData(lat, lon);
        const current = data.current;
        
        // Update location
        locationElement.textContent = locationName;
        
        // Update wind speed (convert from km/h to mph)
        const windSpeedKmh = current.wind_speed_10m;
        const windSpeedMph = windSpeedKmh * 0.621371;
        const windSpeedRounded = Math.round(windSpeedMph);
        
        // Update wind direction
        const windDir = current.wind_direction_10m;
        const cardinalDirection = getCardinalDirection(windDir);
        
        // Get human-readable feels like description
        const feelsLike = getFeelsLikeDescription(windSpeedMph);
        
        // Determine verdict based on wind speed
        let verdict = '';
        let verdictColor = '';
        if (windSpeedMph < 5) {
            verdict = 'CALM';
            verdictColor = '#8ba38b';
        } else if (windSpeedMph < 12) {
            verdict = 'GOOD';
            verdictColor = '#6b9e6b';
        } else if (windSpeedMph < 20) {
            verdict = 'WINDY';
            verdictColor = '#c9a84c';
        } else {
            verdict = 'STAY IN';
            verdictColor = '#c45a5a';
        }
        
        // Update verdict display
        verdictElement.textContent = verdict;
        verdictElement.style.color = verdictColor;
        
        // Update details display with feels like description
        const gustsKmh = current.wind_gusts_10m;
        const gustsMph = (gustsKmh * 0.621371).toFixed(1);
        const tempC = current.temperature_2m;
        const tempF = (tempC * 9/5 + 32).toFixed(0);
        
        detailsElement.innerHTML = `
            <div>💨 ${windSpeedRounded} mph ${cardinalDirection}</div>
            <div>🌬️ Gusts: ${gustsMph} mph</div>
            <div>🌡️ ${tempF}°F</div>
            <div class="feels-like">"${feelsLike}"</div>
            <div class="extra-info">Wind direction: ${windDir}°</div>
        `;
        
        // Rotate compass arrow
        if (windDir !== undefined) {
            const arrow = document.getElementById('compassArrow');
            if (arrow) {
                // Wind direction is where the wind is COMING FROM.
                // The arrow points INTO the wind, so we rotate accordingly.
                arrow.style.transform = `rotate(${windDir}deg)`;
            }
        }
        
    } catch (error) {
        console.error('Error updating wind display:', error);
        errorMessage.textContent = 'Unable to fetch weather data. Please try again.';
        errorMessage.classList.remove('hidden');
    } finally {
        loadingSpinner.classList.add('hidden');
    }
}

// Convert degrees to cardinal direction
function getCardinalDirection(degrees) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                       'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
}

// Get user's current location
function getLocationAndFetch() {
    loadingSpinner.classList.remove('hidden');
    verdictElement.textContent = '—';
    verdictElement.style.color = '#ffffff';
    
    if (!navigator.geolocation) {
        errorMessage.textContent = 'Geolocation is not supported by your browser';
        errorMessage.classList.remove('hidden');
        loadingSpinner.classList.add('hidden');
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            const locationName = await getLocationName(lat, lon);
            await updateWindDisplay(lat, lon, locationName);
        },
        (error) => {
            console.error('Geolocation error:', error);
            let errorText = 'Unable to get your location. ';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorText += 'Please enable location access.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorText += 'Location information is unavailable.';
                    break;
                case error.TIMEOUT:
                    errorText += 'Location request timed out.';
                    break;
                default:
                    errorText += 'An unknown error occurred.';
            }
            
            errorMessage.textContent = errorText;
            errorMessage.classList.remove('hidden');
            loadingSpinner.classList.add('hidden');
            
            // Default to San Francisco
            updateWindDisplay(37.7749, -122.4194, 'San Francisco, CA');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// Handle share button click
function handleShare() {
    const location = locationElement.textContent;
    const verdict = verdictElement.textContent;
    
    // Extract just the wind speed line from details
    const detailsText = detailsElement.innerText;
    const windLine = detailsText.split('\n')[0] || '';
    
    const message = `🌬️ Wind Check: ${location} — ${verdict}. ${windLine}`;
    
    navigator.clipboard.writeText(message).then(() => {
        // Show temporary success message
        const originalText = shareBtn.textContent;
        shareBtn.textContent = '✓ Copied!';
        shareBtn.style.background = '#2a4a2a';
        
        setTimeout(() => {
            shareBtn.textContent = originalText;
            shareBtn.style.background = '';
        }, 2000);
    }).catch(() => {
        // Fallback for older browsers
        prompt('Copy this status manually:', message);
    });
}

// Event listeners
refreshBtn.addEventListener('click', () => {
    getLocationAndFetch();
});

shareBtn.addEventListener('click', handleShare);

// Initialize app - get user's location on load
document.addEventListener('DOMContentLoaded', () => {
    getLocationAndFetch();
});