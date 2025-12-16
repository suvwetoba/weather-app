// ==============================================
// 1. STATE VARIABLES
// ==============================================
let currentLat = 52.52; // Default: Berlin
let currentLon = 13.41;
let storedWeatherData = null; 
let unitSettings = {
    temperature: 'celsius', 
    wind: 'kmh',            
    precipitation: 'mm'     
};
let searchTimeout = null;

// ==============================================
// 2. SELECT DOM ELEMENTS
// ==============================================
const searchBtn = document.getElementById('search-btn');
const cityInput = document.getElementById('city-input');
const suggestionsList = document.getElementById('suggestions-list');
const locationBtn = document.getElementById('location-btn'); // NEW: Location Button

// Header & Units
const unitsToggle = document.getElementById('units-toggle');
const unitsMenu = document.getElementById('units-menu');
const unitOptions = document.querySelectorAll('.toggle-option');

// Current Weather
const locationDisplay = document.getElementById('location-display');
const currentTemp = document.getElementById('current-temp');
const weatherIcon = document.getElementById('current-weather-icon');
const dateDisplay = document.getElementById('date-display');

// Highlights
const feelsLike = document.getElementById('feels-like');
const humidity = document.getElementById('humidity');
const windSpeed = document.getElementById('wind-speed');
const windUnitDisplay = document.querySelector('.unit-wind');
const precipitation = document.getElementById('precipitation');
const precipUnitDisplay = document.querySelector('.unit-precip');

// Forecast Containers
const dailyGrid = document.getElementById('daily-grid');
const hourlyList = document.getElementById('hourly-list');
const hourlyDaySelect = document.getElementById('hourly-day-select'); 

// ==============================================
// 3. EVENT LISTENERS
// ==============================================

searchBtn.addEventListener('click', () => {
    const city = cityInput.value.trim();
    if (city) getCityCoordinates(city);
});

cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        suggestionsList.classList.add('hidden'); 
        const city = cityInput.value.trim();
        if (city) getCityCoordinates(city);
    }
});

// --- NEW: Handle Current Location Button ---
locationBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
        // Show loading state (optional: verify console)
        console.log("Locating user...");
        navigator.geolocation.getCurrentPosition(onLocationSuccess, onLocationError);
    } else {
        alert("Geolocation is not supported by this browser.");
    }
});

// --- Handle Typing for Autosuggest ---
cityInput.addEventListener('input', () => {
    const query = cityInput.value.trim();
    
    if (searchTimeout) clearTimeout(searchTimeout);
    
    if (query.length < 3) {
        suggestionsList.classList.add('hidden'); 
        return;
    }

    searchTimeout = setTimeout(() => {
        fetchCitySuggestions(query);
    }, 300);
});

// --- Close dropdown if clicking outside ---
document.addEventListener('click', (e) => {
    if (!unitsToggle.contains(e.target) && !unitsMenu.contains(e.target)) {
        unitsMenu.classList.add('hidden');
    }
    if (!cityInput.contains(e.target) && !suggestionsList.contains(e.target)) {
        suggestionsList.classList.add('hidden');
    }
});

unitsToggle.addEventListener('click', (e) => {
    e.stopPropagation(); 
    unitsMenu.classList.toggle('hidden');
});

unitOptions.forEach(option => {
    option.addEventListener('click', () => {
        const type = option.getAttribute('data-unit'); 
        updateUnits(type, option);
    });
});

hourlyDaySelect.addEventListener('change', () => {
    if (storedWeatherData) {
        updateHourlyForecast(storedWeatherData);
        updateMainCard(parseInt(hourlyDaySelect.value));
    }
});


// ==============================================
// 4. CORE FUNCTIONS
// ==============================================

// --- NEW: Handle Geolocation Success ---
async function onLocationSuccess(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;

    currentLat = lat;
    currentLon = lon;

    // 1. Get City Name from Coordinates (Reverse Geocoding)
    try {
        const reverseGeoUrl = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&count=1&language=en&format=json`;
        const response = await fetch(reverseGeoUrl);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const city = data.results[0];
            // Construct name: "City, State, Country"
            let locationParts = [city.name];
            if (city.admin1 && city.admin1 !== city.name) locationParts.push(city.admin1);
            if (city.country) locationParts.push(city.country);
            
            locationDisplay.textContent = locationParts.join(', ');
        } else {
            locationDisplay.textContent = `Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)}`;
        }
    } catch (error) {
        console.error("Error finding city name:", error);
        locationDisplay.textContent = "Current Location";
    }

    // 2. Fetch Weather
    getWeatherData();
}

function onLocationError(error) {
    console.error("Geolocation error:", error);
    alert("Unable to retrieve your location. Please check your browser permissions.");
}

// ==============================================
// UPDATE THIS FUNCTION IN APP.JS
// ==============================================

async function getCityCoordinates(cityName) {
    // 1. CLEAN THE SEARCH TERM
    // If input is "Warri, Delta, Nigeria", we only want to search for "Warri"
    // The API often fails if you send the full "City, State, Country" string.
    const searchTerm = cityName.split(',')[0].trim(); 

    try {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${searchTerm}&count=1&language=en&format=json`;
        const geoResponse = await fetch(geoUrl);
        const geoData = await geoResponse.json();

        if (!geoData.results) {
            alert("City not found!");
            return;
        }

        // 2. SUCCESS
        const { latitude, longitude, name, country, admin1 } = geoData.results[0];
        currentLat = latitude;
        currentLon = longitude;
        
        // Display full details nicely
        const displayLocation = admin1 ? `${name}, ${admin1}, ${country}` : `${name}, ${country}`;
        locationDisplay.textContent = displayLocation;
        
        // Update Search Box to match what we found (Optional, keeps it clean)
        cityInput.value = displayLocation;
        
        getWeatherData();

    } catch (error) {
        console.error("Error fetching coordinates:", error);
    }
}

async function fetchCitySuggestions(query) {
    try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=10&language=en&format=json`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.results) {
            suggestionsList.classList.add('hidden');
            return;
        }

        showSuggestions(data.results);
    } catch (error) {
        console.error("Error fetching suggestions:", error);
    }
}

function showSuggestions(cities) {
    suggestionsList.innerHTML = ''; 
    suggestionsList.classList.remove('hidden');

    cities.forEach(city => {
        const li = document.createElement('li');
        
        let locationParts = [city.name];
        if (city.admin1 && city.admin1 !== city.name) locationParts.push(city.admin1); 
        if (city.country) locationParts.push(city.country);

        const locationText = locationParts.join(', ');
        li.textContent = locationText; 

        li.addEventListener('click', () => {
            selectCity(city);
        });

        suggestionsList.appendChild(li);
    });
}

function selectCity(cityData) {
    let locationParts = [cityData.name];
    if (cityData.admin1 && cityData.admin1 !== cityData.name) locationParts.push(cityData.admin1);
    if (cityData.country) locationParts.push(cityData.country);
    
    const fullLocationName = locationParts.join(', ');

    cityInput.value = fullLocationName;
    suggestionsList.classList.add('hidden');

    currentLat = cityData.latitude;
    currentLon = cityData.longitude;
    locationDisplay.textContent = fullLocationName;
    
    getWeatherData();
}

async function getWeatherData() {
    let url = `https://api.open-meteo.com/v1/forecast?latitude=${currentLat}&longitude=${currentLon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,wind_speed_10m_max,precipitation_sum&timezone=auto`;

    if (unitSettings.temperature === 'fahrenheit') url += '&temperature_unit=fahrenheit';
    if (unitSettings.wind === 'mph') url += '&wind_speed_unit=mph';
    if (unitSettings.precipitation === 'inch') url += '&precipitation_unit=inch';

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        storedWeatherData = data; 
        updateUI(data);

    } catch (error) {
        console.error("Weather API Error:", error);
    }
}

function updateUnits(type, clickedOption) {
    if (type === 'celsius' || type === 'fahrenheit') {
        unitSettings.temperature = type;
        updateActiveOption('celsius', 'fahrenheit', type);
    } 
    else if (type === 'kmh' || type === 'mph') {
        unitSettings.wind = type;
        updateActiveOption('kmh', 'mph', type);
    } 
    else if (type === 'mm' || type === 'in') {
        unitSettings.precipitation = (type === 'in') ? 'inch' : 'mm';
        updateActiveOption('mm', 'in', type);
    }
    
    unitsMenu.classList.add('hidden');
    getWeatherData();
}

function updateActiveOption(opt1, opt2, selected) {
    const options = document.querySelectorAll('.toggle-option');
    options.forEach(opt => {
        const val = opt.getAttribute('data-unit');
        if (val === opt1 || val === opt2) {
            if (val === selected) opt.classList.add('selected');
            else opt.classList.remove('selected');
        }
    });
}

// ==============================================
// 5. UI UPDATE FUNCTIONS
// ==============================================

function updateUI(data) {
    updateDaySelect(data.daily);
    updateMainCard(0); 
    updateHourlyForecast(data);

    const daily = data.daily;
    dailyGrid.innerHTML = ''; 
    for (let i = 0; i < 7; i++) {
        const date = new Date(daily.time[i]);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const maxTemp = Math.round(daily.temperature_2m_max[i]);
        const minTemp = Math.round(daily.temperature_2m_min[i]);
        const dayIcon = getWeatherIconName(daily.weather_code[i]);

        const cardHTML = `
            <div class="day-card">
                <p>${dayName}</p>
                <img src="./assets/images/${dayIcon}" alt="icon">
                <p class="day-temp">${maxTemp}° <span>${minTemp}°</span></p>
            </div>
        `;
        dailyGrid.innerHTML += cardHTML;
    }
}

function updateMainCard(index) {
    const data = storedWeatherData;
    const current = data.current;
    const daily = data.daily;

    let temp, icon, feels, wind, precip, dateStr;
    
    if (index === 0) {
        temp = Math.round(current.temperature_2m);
        icon = getWeatherIconName(current.weather_code);
        feels = Math.round(current.apparent_temperature);
        wind = Math.round(current.wind_speed_10m);
        precip = current.precipitation;
        
        const now = new Date();
        dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
        humidity.textContent = current.relative_humidity_2m;
    } else {
        temp = Math.round(daily.temperature_2m_max[index]); 
        icon = getWeatherIconName(daily.weather_code[index]);
        feels = Math.round(daily.apparent_temperature_max[index]);
        wind = Math.round(daily.wind_speed_10m_max[index]);
        precip = daily.precipitation_sum[index];
        
        const dateObj = new Date(daily.time[index]);
        dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
        humidity.textContent = "--"; 
    }

    currentTemp.textContent = temp;
    weatherIcon.src = `./assets/images/${icon}`;
    dateDisplay.textContent = dateStr;
    feelsLike.textContent = feels;
    windSpeed.textContent = wind;
    precipitation.textContent = precip;

    if(windUnitDisplay) windUnitDisplay.textContent = (unitSettings.wind === 'mph') ? 'mph' : 'km/h';
    if(precipUnitDisplay) precipUnitDisplay.textContent = (unitSettings.precipitation === 'inch') ? 'in' : 'mm';
}

function updateDaySelect(daily) {
    hourlyDaySelect.innerHTML = '';
    for (let i = 0; i < 7; i++) {
        const date = new Date(daily.time[i]);
        const fullDayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        
        const option = document.createElement('option');
        option.value = i; 
        option.textContent = (i === 0) ? `Today` : fullDayName; 
        
        hourlyDaySelect.appendChild(option);
    }
}

function updateHourlyForecast(data) {
    const hourly = data.hourly;
    hourlyList.innerHTML = ''; 
    
    const dayIndex = parseInt(hourlyDaySelect.value); 
    let startIndex = dayIndex * 24; 
    let endIndex = startIndex + 24;

    const currentHour = new Date().getHours();
    if (dayIndex === 0) {
        startIndex += currentHour; 
    }

    for (let i = startIndex; i < endIndex; i++) {
        if (!hourly.time[i]) break; 

        const timeStr = hourly.time[i];
        const dateObj = new Date(timeStr);
        const hourLabel = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
        const temp = Math.round(hourly.temperature_2m[i]);
        const icon = getWeatherIconName(hourly.weather_code[i]);

        const rowHTML = `
            <div class="hourly-item">
                <p class="hour">${hourLabel}</p>
                <img src="./assets/images/${icon}" alt="icon" class="small-icon">
                <p class="temp">${temp}°</p>
            </div>
        `;
        hourlyList.innerHTML += rowHTML;
    }
}

function getWeatherIconName(code) {
    if (code === 0) return "icon-sunny.webp"; 
    if (code === 1 || code === 2) return "icon-partly-cloudy.webp";
    if (code === 3) return "icon-overcast.webp";
    if (code === 45 || code === 48) return "icon-fog.webp";
    if (code >= 51 && code <= 55) return "icon-drizzle.webp";
    if (code >= 61 && code <= 67) return "icon-rain.webp";
    if (code >= 71 && code <= 77) return "icon-snow.webp";
    if (code >= 80 && code <= 82) return "icon-rain.webp";
    if (code >= 95 && code <= 99) return "icon-storm.webp";
    return "icon-sunny.webp"; 
}


// ==============================================
// 6. INITIALIZATION (Auto-Detect Location)
// ==============================================

function initApp() {
    if (navigator.geolocation) {
        // Try to get user's location
        navigator.geolocation.getCurrentPosition(
            (position) => {
                // Success: Use their location
                onLocationSuccess(position);
            },
            (error) => {
                // Error/Denied: Fallback to default city
                console.log("Location access denied or error. Defaulting to Berlin.");
                getCityCoordinates("Berlin");
            }
        );
    } else {
        // Browser doesn't support geolocation: Default to Berlin
        getCityCoordinates("Berlin");
    }
}

// Run the initialization
initApp();