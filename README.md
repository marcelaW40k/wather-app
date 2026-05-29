# 🌤️ Skyline Weather - Open-Meteo Engine (V2)

Skyline es un panel meteorológico sofisticado, responsivo y de alto rendimiento que consume datos en tiempo real de código abierto utilizando la infraestructura pública de **Open-Meteo APIs**. El diseño está fuertemente inspirado en la estética limpia de interfaces de gama alta como *Apple Weather*, utilizando componentes visuales basados en Glassmorphism, tipografías delgadas y capas dinámicas reactivas al estado climatológico de la zona.

A diferencia de las arquitecturas tradicionales, esta aplicación está optimizada para entornos modernos: **no requiere claves privadas (`API Keys`)**, eliminando configuraciones complejas en entornos de desarrollo y portafolios públicos.

---

## 📋 Resumen del Proyecto

El objetivo principal de Skyline es ofrecer una interfaz intuitiva para conocer el estado del tiempo sin fricciones. Transforma las búsquedas de texto de los usuarios en coordenadas geográficas exactas para luego renderizar métricas clave como temperatura, viento y humedad, manteniendo al mismo tiempo un registro de auditoría local (logs) y un control estricto de la memoria del cliente.

---

## 🛠️ Arquitectura de Consumo en Dos Pasos

Dado que Open-Meteo opera exclusivamente mediante coordenadas geográficas, esta aplicación implementa un patrón asíncrono secuencial mediante `async/await` en JavaScript Vanilla:

1.  **Conversión Geográfica (Forward Geocoding):** Al buscar una localización, la aplicación consulta `https://geocoding-api.open-meteo.com/v1/search` para convertir la cadena de texto en valores decimales exactos de latitud y longitud.
2.  **Mapeo del Clima Extendido:** Con las coordenadas resueltas, se realiza una petición paralela a `https://api.open-meteo.com/v1/forecast` abstrayendo métricas del tiempo actual, variables secundarias y el pronóstico de los próximos 3 días.

---

## ✨ Funcionalidades Implementadas

* 🔍 **Búsqueda Global Inteligente:** Encuentra cualquier ciudad del mundo mediante coincidencia de texto.
* 📊 **Métricas Clave en Tiempo Real:** Muestra de forma destacada:
    * Temperatura actual (°C) y Sensación Térmica.
    * Velocidad del viento (km/h).
    * Porcentaje de humedad (%) e Índice UV Máximo.
* 📍 **Geolocalización Inmediata:** Consume las coordenadas directas del navegador web (previo consentimiento seguro SSL) mapeando tu entorno al instante.
* 🎨 **Motor de Clima Dinámico:** Cambia de forma interactiva el color base y gradiente de todo el cuerpo del documento adaptándolo al contexto (soleado, lluvia, nublado, nieve o modo noche).
* ⏱️ **Caché con Clave Única:** Almacena objetos estructurados directamente indexados por el nombre de la ciudad buscada en `localStorage` por 15 minutos para no sobrecargar el ancho de banda del usuario.
* 🕒 **Historial Reciente:** Gestión persistente de tus últimas 5 ciudades navegadas permitiendo un re-acceso inmediato mediante *tags* interactivos eliminables.
* 📝 **Sistema de Logs de Auditoría:** Registra de manera automática las respuestas y consultas exitosas en un archivo local para diagnóstico del sistema.

---

## 🚀 Tecnologías Utilizadas

* **HTML5 Estructurado:** Uso semántico completo para posicionamiento SEO y accesibilidad mejorada.
* **CSS3 Avanzado (Glassmorphism):** Diseño responsivo móvil/escritorio mediante Flexbox y Grid, variables nativas, filtros transparentes `backdrop-filter` y animaciones fluidas no bloqueantes.
* **JavaScript Vanilla (ES6+):** Código nativo estructurado, modularizado bajo el patrón de diseño de objetos de control sin sobrecargar el DOM con frameworks pesados.
* **Fetch API con Async/Await:** Gestión asíncrona de comunicación de red para prevenir congelamiento de hilos de ejecución.

---

## 🔧 Instalación y Configuración

Sigue estos pasos para clonar y ejecutar el proyecto en tu entorno local:

1.  **Clona el repositorio:**
    ```bash
    git clone [https://github.com/tu-usuario/skyline-weather.git](https://github.com/tu-usuario/skyline-weather.git)
    cd skyline-weather
    ```

2.  **Estructura del Proyecto:** Asegúrate de mantener la jerarquía exacta de directorios:
    ```text
    /project
    │── index.html
    │── style.css
    │── script.js
    │── README.md
    ```

3.  **Ejecuta la aplicación:**
    Debido a que la geolocalización nativa y las peticiones `Fetch` exigen seguridad perimetral en los navegadores actuales, se aconseja inicializar el entorno mediante un servidor local:
    * Si usas **VS Code**, haz clic derecho sobre `index.html` y selecciona **Open with Live Server**.
    * Alternativamente, puedes usar Python desde tu terminal dentro del directorio del proyecto: 
      ```bash
      python -m http.server 8000
      ```

---

## 📖 Guía de Uso

1.  Al abrir la aplicación por primera vez, concede permisos de ubicación si deseas ver el clima local de inmediato.
2.  Para buscar otra ubicación, escribe el nombre de la ciudad en la barra superior (ej. *Tokio*, *Bogotá*, *Madrid*) y presiona `Enter`.
3.  La interfaz se actualizará con transiciones suaves mostrando el nuevo gradiente climático y las métricas detalladas.
4.  Usa los *tags* del historial de la barra inferior para alternar rápidamente entre tus ciudades favoritas o haz clic en la `X` para eliminarlas del registro.

---

## 📊 Ejemplo de Resultados

### Interfaz de Usuario (Caso de Éxito)
Al procesar una ciudad válida como **"Bogotá"**, la aplicación mapea y renderiza las variables en sus respectivas tarjetas:

| Variable | Componente Visual | Valor Renderizado |
| :--- | :--- | :--- |
| **📍 Ubicación** | Cabecera Principal | Bogotá, Colombia |
| **🌡️ Temperatura** | Bloque de Estado | 19°C *(Sensación: 18°C)* |
| **💨 Viento** | Módulo Lateral | 12 km/h |
| **💧 Humedad** | Módulo Lateral | 72% |
| **🎨 Fondo** | Capa del Body | Gradiente Azul Profundo (Lluvia Ligera) |

### Registro en Archivo de Logs (`weather.log`)
Cada ciclo de consulta añade una línea estructurada al histórico para su análisis técnico:
```text
[2026-05-28 13:00:15] SUCCESS: Ciudad 'Bogota' procesada correctamente. Temp: 19°C, Viento: 12km/h, Humedad: 72%
[2026-05-28 13:02:40] ERROR: Búsqueda fallida. Ciudad 'InventadaCity' no encontrada en GEOCODE_BASE.