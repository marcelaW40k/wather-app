/**
 * ARCHIVO: script.js (Versión 2 - Open-Meteo Integrado)
 * DESCRIPCIÓN: Controlador meteorológico sin dependencias.
 * Consume de forma combinada la API de Geolocalización y Clima de Open-Meteo.
 */

// Configuración Global de las APIs de código abierto (Sin necesidad de Keys)
const API_CONFIG = {
    GEOCODE_BASE: 'https://geocoding-api.open-meteo.com/v1',
    WEATHER_BASE: 'https://api.open-meteo.com/v1',
    CACHE_EXPIRY: 15 * 60 * 1000 // Caché de datos por 15 minutos
};

// Selectores del DOM centralizados
const DOM = {
    searchForm: document.getElementById('search-form'),
    searchInput: document.getElementById('search-input'),
    geoBtn: document.getElementById('geo-btn'),
    loader: document.getElementById('loader'),
    errorContainer: document.getElementById('error-container'),
    errorMessage: document.getElementById('error-message'),
    errorTitle: document.getElementById('error-title'),
    weatherContent: document.getElementById('weather-content'),
    historyContainer: document.getElementById('history-container'),
    
    // Nodos de Renderizado de Datos
    city: document.getElementById('weather-city'),
    country: document.getElementById('weather-country'),
    date: document.getElementById('weather-date'),
    icon: document.getElementById('weather-icon'),
    temp: document.getElementById('weather-temp'),
    desc: document.getElementById('weather-desc'),
    feels: document.getElementById('metric-feels'),
    humidity: document.getElementById('metric-humidity'),
    wind: document.getElementById('metric-wind'),
    uv: document.getElementById('metric-uv'),
    forecast: document.getElementById('forecast-timeline')
};

// Estado de la Aplicación
let appState = {
    recentSearches: JSON.parse(localStorage.getItem('skyline_history')) || ['Madrid', 'New York', 'Tokyo']
};

/**
 * Sanitiza inputs para prevenir ataques XSS reflejados en el DOM.
 */
function sanitizeInput(str) {
    return str.replace(/[&<>"']/g, function(match) {
        const escape = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
        return escape[match];
    });
}

/**
 * Mapeo e interpretación de códigos climáticos WMO (World Meteorological Organization)
 * Utilizados de forma estándar por Open-Meteo para asignar íconos y fondos.
 */
function interpretWMOCode(code) {
    const mapping = {
        0: { text: "Cielo Despejado", icon: "sun", bg: "sunny" },
        1: { text: "Principalmente Despejado", icon: "cloud-sun", bg: "sunny" },
        2: { text: "Parcialmente Nublado", icon: "cloud-sun", bg: "cloudy" },
        3: { text: "Nublado", icon: "cloud", bg: "cloudy" },
        45: { text: "Niebla", icon: "smog", bg: "cloudy" },
        48: { text: "Niebla de Rima Depositaria", icon: "smog", bg: "cloudy" },
        51: { text: "Llovizna Ligera", icon: "cloud-rain", bg: "rainy" },
        53: { text: "Llovizna Moderada", icon: "cloud-rain", bg: "rainy" },
        55: { text: "Llovizna Densa", icon: "cloud-showers-heavy", bg: "rainy" },
        61: { text: "Lluvia Ligera", icon: "cloud-rain", bg: "rainy" },
        63: { text: "Lluvia Moderada", icon: "cloud-rain", bg: "rainy" },
        65: { text: "Lluvia Fuerte", icon: "cloud-showers-heavy", bg: "rainy" },
        71: { text: "Nevada Ligera", icon: "snowflake", bg: "snowy" },
        73: { text: "Nevada Moderada", icon: "snowflake", bg: "snowy" },
        75: { text: "Nevada Intensa", icon: "snowflake", bg: "snowy" },
        77: { text: "Granizo", icon: "snowflake", bg: "snowy" },
        80: { text: "Chubascos Ligeros", icon: "cloud-sun-rain", bg: "rainy" },
        81: { text: "Chubascos Moderados", icon: "cloud-sun-rain", bg: "rainy" },
        82: { text: "Chubascos Violentos", icon: "cloud-showers-heavy", bg: "rainy" },
        95: { text: "Tormenta Eléctrica", icon: "cloud-bolt", bg: "rainy" }
    };
    return mapping[code] || { text: "Condiciones Variables", icon: "cloud", bg: "default" };
}

/* ==========================================================================
   SISTEMA DE CACHÉ
   ========================================================================== */
function getCachedWeather(key) {
    const cached = localStorage.getItem(`openmeteo_cache_${key.toLowerCase()}`);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp > API_CONFIG.CACHE_EXPIRY) {
        localStorage.removeItem(`openmeteo_cache_${key.toLowerCase()}`);
        return null;
    }
    return parsed.data;
}

function setCacheWeather(key, data) {
    const cacheData = { timestamp: Date.now(), data: data };
    localStorage.setItem(`openmeteo_cache_${key.toLowerCase()}`, JSON.stringify(cacheData));
}

/* ==========================================================================
   FLUJO DE CONSUMO DE ASYNC / AWAIT (PROCESO EN 2 PASOS)
   ========================================================================== */

/**
 * Busca las coordenadas de una ciudad mediante texto plano
 */
async function handleSearch(cityName) {
    if (!cityName || cityName.trim() === "") return;
    const cleanCity = sanitizeInput(cityName.trim());

    // Intentar leer desde el caché primero
    const cached = getCachedWeather(cleanCity);
    if (cached) {
        renderWeather(cached);
        updateHistoryUI(cached.customLocation.name);
        return;
    }

    showLoader(true);
    hideError();

    try {
        // PASO 1: Consumir API de Geocodificación para transformar texto a Lat/Lon
        const geoResponse = await fetch(`${API_CONFIG.GEOCODE_BASE}/search?name=${encodeURIComponent(cleanCity)}&count=1&language=es&format=json`);
        if (!geoResponse.ok) throw new Error("Error en el servidor de geolocalización.");
        
        const geoData = await geoResponse.json();
        if (!geoData.results || geoData.results.length === 0) {
            throw new Error("No se encontró la ciudad especificada. Revisa la ortografía.");
        }

        const location = geoData.results[0];
        const locationMeta = {
            name: location.name,
            country: location.country || ''
        };

        // Pasar al paso 2 usando las coordenadas obtenidas
        await fetchWeatherByCoordinates(location.latitude, location.longitude, locationMeta, cleanCity);

    } catch (error) {
        showError("Búsqueda Fallida", error.message);
        showLoader(false);
    }
}

/**
 * PASO 2: Solicitar métricas meteorológicas y pronóstico extendido usando coordenadas
 */
async function fetchWeatherByCoordinates(lat, lon, locationMeta, cacheKey = null) {
    showLoader(true);
    hideError();

    try {
        // Construcción de query con parámetros requeridos (Clima actual, variables secundarias y pronóstico de 3 días)
        const weatherUrl = `${API_CONFIG.WEATHER_BASE}/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max&timezone=auto&forecast_days=3`;
        
        const response = await fetch(weatherUrl);
        if (!response.ok) throw new Error("No se pudieron obtener los datos meteorológicos.");
        
        const weatherData = await response.json();
        
        // Empaquetar metadatos geográficos junto con los datos climáticos en un solo estado observable
        const completeData = {
            customLocation: locationMeta,
            weather: weatherData
        };

        if (cacheKey) setCacheWeather(cacheKey, completeData);
        
        renderWeather(completeData);
        updateHistoryUI(locationMeta.name);

    } catch (error) {
        showError("Error de Conexión", error.message);
    } finally {
        showLoader(false);
    }
}

/* ==========================================================================
   RENDERIZADO DE COMPONENTES EN EL DOM
   ========================================================================== */
function renderWeather(payload) {
    DOM.weatherContent.classList.remove('hidden');
    
    const { customLocation, weather } = payload;
    const currentClima = interpretWMOCode(weather.current.weather_code);

    // Renderizar Cabecera de Ubicación
    DOM.city.textContent = customLocation.name;
    DOM.country.textContent = customLocation.country;
    
    const localDate = new Date();
    DOM.date.textContent = localDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    // Bloque Principal
    DOM.temp.textContent = Math.round(weather.current.temperature_2m);
    DOM.desc.textContent = currentClima.text;
    
    // Inyección dinámica de íconos tipográficos vectoriales (FontAwesome) en vez de imágenes PNG de baja resolución
    DOM.icon.outerHTML = `<i id="weather-icon" class="fa-solid fa-${currentClima.icon} main-icon-fa"></i>`;
    // Re-asociar la referencia del nuevo nodo al objeto DOM global
    DOM.icon = document.getElementById('weather-icon');

    // Métricas
    DOM.feels.textContent = Math.round(weather.current.apparent_temperature);
    DOM.humidity.textContent = weather.current.relative_humidity_2m;
    DOM.wind.textContent = Math.round(weather.current.wind_speed_10m);
    DOM.uv.textContent = weather.daily.uv_index_max[0] || 'N/A';

    // Actualizar Fondo Dinámico
    document.body.className = '';
    document.body.classList.add(`weather-bg-${currentClima.bg}`);

    // Renderizado del Pronóstico de 3 Días alternos
    DOM.forecast.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        // Corrección de huso horario para strings de fechas ISO
        const rawDate = new Date(weather.daily.time[i] + 'T00:00:00');
        const dayName = rawDate.toLocaleDateString('es-ES', { weekday: 'long' });
        const dayClima = interpretWMOCode(weather.daily.weather_code[i]);

        const forecastRow = document.createElement('div');
        forecastRow.classList.add('forecast-day');
        forecastRow.innerHTML = `
            <p>${dayName.charAt(0).toUpperCase() + dayName.slice(1)}</p>
            <i class="fa-solid fa-${dayClima.icon} fc-icon-fa" title="${dayClima.text}"></i>
            <span class="fc-temps">
                ${Math.round(weather.daily.temperature_2m_max[i])}° / <span class="min-t">${Math.round(weather.daily.temperature_2m_min[i])}°C</span>
            </span>
        `;
        DOM.forecast.appendChild(forecastRow);
    }
}

/* ==========================================================================
   UTILIDADES ADICIONALES Y GESTIÓN DEL COMPORTAMIENTO
   ========================================================================== */
function showLoader(visible) {
    if (visible) {
        DOM.loader.classList.remove('hidden');
        DOM.weatherContent.classList.add('hidden');
    } else {
        DOM.loader.classList.add('hidden');
    }
}

function showError(title, msg) {
    DOM.errorTitle.textContent = title;
    DOM.errorMessage.textContent = msg;
    DOM.errorContainer.classList.remove('hidden');
    DOM.weatherContent.classList.add('hidden');
}

function hideError() { DOM.errorContainer.classList.add('hidden'); }

function updateHistoryUI(cityName) {
    appState.recentSearches = appState.recentSearches.filter(c => c.toLowerCase() !== cityName.toLowerCase());
    appState.recentSearches.unshift(cityName);
    if (appState.recentSearches.length > 5) appState.recentSearches.pop();
    localStorage.setItem('skyline_history', JSON.stringify(appState.recentSearches));
    renderHistoryTags();
}

function renderHistoryTags() {
    DOM.historyContainer.innerHTML = '';
    appState.recentSearches.forEach(city => {
        const tag = document.createElement('div');
        tag.classList.add('history-tag');
        tag.innerHTML = `<span>${city}</span> <i class="fa-solid fa-xmark close-tag"></i>`;
        
        tag.addEventListener('click', (e) => {
            if (e.target.classList.contains('close-tag')) {
                e.stopPropagation();
                appState.recentSearches = appState.recentSearches.filter(c => c !== city);
                localStorage.setItem('skyline_history', JSON.stringify(appState.recentSearches));
                renderHistoryTags();
            } else {
                DOM.searchInput.value = city;
                handleSearch(city);
            }
        });
        DOM.historyContainer.appendChild(tag);
    });
}

function getUserLocation() {
    if (navigator.geolocation) {
        showLoader(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const meta = { name: "Mi ubicación", country: "Local" };
                fetchWeatherByCoordinates(position.coords.latitude, position.coords.longitude, meta);
            },
            () => {
                handleSearch(appState.recentSearches[0] || 'Madrid');
            }
        );
    } else {
        handleSearch(appState.recentSearches[0] || 'Madrid');
    }
}

// Listeners
DOM.searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSearch(DOM.searchInput.value);
});
DOM.geoBtn.addEventListener('click', getUserLocation);

document.addEventListener("DOMContentLoaded", () => {
    renderHistoryTags();
    getUserLocation();
    setTimeout(runDiagnostics, 1500); // Diagnóstico pasivo en consola
});

/* ==========================================================================
   PRUEBAS UNITARIAS MANUALES / AUTOMATIZADAS INTEGRADAS
   ========================================================================== */
function runDiagnostics() {
    console.group("%c Skyline Diagnósticos (Open-Meteo Engine)", "color: #00A3FF; font-weight: bold;");
    
    // Test 1: Comprobación del parseador WMO
    const sampleInterpreter = interpretWMOCode(95);
    console.log(sampleInterpreter.bg === "rainy" ? "✅ TEST WMO: Éxito mapeando códigos de tormentas." : "❌ TEST WMO: Fallido.");

    // Test 2: Control anti-XSS
    const secureOutput = sanitizeInput("<svg onload=alert(1)>");
    console.log(!secureOutput.includes("<svg") ? "✅ TEST SEGURIDAD: Sanitizador activo de etiquetas maliciosas." : "❌ TEST SEGURIDAD: Vulnerable.");
    
    console.groupEnd();
}