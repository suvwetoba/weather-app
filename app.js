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

// ==============================================
// 2. SELECT DOM ELEMENTS
// ==============================================
const searchBtn = document.getElementById('search-btn');
const cityInput = document.getElementById('city-input');

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
        const city = cityInput.value.trim();
        if (city) getCityCoordinates(city);
    }
});

unitsToggle.addEventListener('click', (e) => {
    e.stopPropagation(); 
    unitsMenu.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
    if (!unitsToggle.contains(e.target) && !unitsMenu.contains(e.target)) {
        unitsMenu.classList.add('hidden');
    }
});

unitOptions.forEach(option => {
    option.addEventListener('click', () => {
        const type = option.getAttribute('data-unit'); 
        updateUnits(type, option);
    });
});

// --- UPDATED LISTENER: Handle Day Change ---
hourlyDaySelect.addEventListener('change', () => {
    if (storedWeatherData) {
        // 1. Update the list on the right/bottom
        updateHourlyForecast(storedWeatherData);
        // 2. Update the Big Blue Card to match the selected day
        updateMainCard(parseInt(hourlyDaySelect.value));
    }
});


// ==============================================
// 4. CORE FUNCTIONS
// ==============================================

async function getCityCoordinates(cityName) {
    try {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${cityName}&count=1&language=en&format=json`;
        const geoResponse = await fetch(geoUrl);
        const geoData = await geoResponse.json();

        if (!geoData.results) {
            alert("City not found!");
            return;
        }

        const { latitude, longitude, name, country } = geoData.results[0];
        currentLat = latitude;
        currentLon = longitude;
        locationDisplay.textContent = `${name}, ${country}`;
        
        getWeatherData();

    } catch (error) {
        console.error("Error fetching coordinates:", error);
    }
}

async function getWeatherData() {
    // Note: Added 'apparent_temperature_max' and 'wind_speed_10m_max' to daily for better future data
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
    // 1. Populate Dropdown first
    updateDaySelect(data.daily);

    // 2. Default to showing "Today" (Index 0)
    updateMainCard(0);
    
    // 3. Update Hourly
    updateHourlyForecast(data);

    // 4. Update Daily Grid (7 Days)
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

// --- NEW FUNCTION: Updates Main Card & Highlights based on selection ---
function updateMainCard(index) {
    const data = storedWeatherData;
    const current = data.current;
    const daily = data.daily;

    // Determine if we should show "Live" data or "Forecast" data
    let temp, icon, feels, wind, precip, dateStr;
    
    if (index === 0) {
        // CASE: TODAY -> Use Current Object (More accurate for "Now")
        temp = Math.round(current.temperature_2m);
        icon = getWeatherIconName(current.weather_code);
        feels = Math.round(current.apparent_temperature);
        wind = Math.round(current.wind_speed_10m);
        precip = current.precipitation;
        
        const now = new Date();
        dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
        
        // Use live humidity
        humidity.textContent = current.relative_humidity_2m;
    } else {
        // CASE: FUTURE DAY -> Use Daily Object
        temp = Math.round(daily.temperature_2m_max[index]); // Show High Temp
        icon = getWeatherIconName(daily.weather_code[index]);
        feels = Math.round(daily.apparent_temperature_max[index]);
        wind = Math.round(daily.wind_speed_10m_max[index]);
        precip = daily.precipitation_sum[index];
        
        const dateObj = new Date(daily.time[index]);
        dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });

        // Daily API doesn't give Avg Humidity easily, so we show "--" or estimate
        humidity.textContent = "--"; 
    }

    // Update DOM
    currentTemp.textContent = temp;
    weatherIcon.src = `./assets/images/${icon}`;
    dateDisplay.textContent = dateStr;
    
    feelsLike.textContent = feels;
    windSpeed.textContent = wind;
    precipitation.textContent = precip;

    // Update Units Text
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
        option.textContent = (i === 0) ? `Today` : fullDayName; // Keep "Today" for clarity
        
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

// Start App
getCityCoordinates("Berlin");