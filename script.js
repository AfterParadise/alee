// Configuración inicial
const canvas = document.getElementById('galaxyCanvas');
const ctx = canvas.getContext('2d', { alpha: false }); // Desactivar alpha para mejor rendimiento
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Configuración de rendimiento
const USE_OFFSCREEN_CANVAS = typeof OffscreenCanvas !== 'undefined';
let offscreenCtx;
let offscreenCanvas;

if (USE_OFFSCREEN_CANVAS) {
    offscreenCanvas = new OffscreenCanvas(canvas.width, canvas.height);
    offscreenCtx = offscreenCanvas.getContext('2d');
}

// Configuración de partículas
const MAX_STARS = 300;
const MAX_SHOOTING_STARS = 3;
const PHRASE_COUNT = 5;
const MAX_IMAGES = 10; // Máximo número de imágenes a mostrar
const COLORS = ['#ff3366', '#33ccff', '#ffcc33', '#99ff33', '#cc33ff'];
const IMAGE_PATHS = []; // Se llenará con las rutas de las imágenes

// Precargar imágenes
const images = [];
let imagesLoaded = 0;
let totalImagesToLoad = 0;
let allImagesLoaded = false;

// Función para cargar imágenes
function loadImages() {
    return new Promise((resolve, reject) => {
        try {
            // Intentar cargar imágenes de la carpeta img
            const imageFiles = [];
            
            // Crear un array con las rutas de las imágenes
            // Usar rutas relativas a la carpeta img
            for (let i = 1; i <= 9; i++) {
                imageFiles.push(`img/img${i}.jpg`);
            }
            
            totalImagesToLoad = imageFiles.length;
            let loadedCount = 0;
            let hasAnyImage = false;
            
            if (totalImagesToLoad === 0) {
                console.log('No hay imágenes para cargar');
                resolve();
                return;
            }
            
            console.log(`Iniciando carga de ${totalImagesToLoad} imágenes...`);
            
            // Función para verificar si debemos resolver la promesa
            const checkCompletion = () => {
                if (loadedCount >= totalImagesToLoad) {
                    if (!hasAnyImage) {
                        console.warn('No se pudo cargar ninguna imagen. Se mostrarán solo las frases de texto.');
                    } else {
                        console.log(`Se cargaron ${images.length} imágenes correctamente`);
                    }
                    allImagesLoaded = hasAnyImage;
                    resolve();
                }
            };
            
            // Función para manejar la carga exitosa de una imagen
            const onImageLoad = (img, src) => {
                try {
                    if (img.width > 0 && img.height > 0) {
                        images.push({ element: img, src });
                        hasAnyImage = true;
                        console.log(`Imagen cargada correctamente: ${src} (${loadedCount + 1}/${totalImagesToLoad})`);
                    }
                    
                    loadedCount++;
                    if (typeof window.updateLoadingProgress === 'function') {
                        window.updateLoadingProgress((loadedCount / totalImagesToLoad) * 100);
                    }
                    checkCompletion();
                } catch (error) {
                    console.error('Error en onImageLoad:', error);
                    loadedCount++;
                    checkCompletion();
                }
            };
            
            // Función para manejar errores de carga
            const onImageError = (src, error) => {
                console.warn(`No se pudo cargar la imagen: ${src}`, error);
                loadedCount++;
                if (typeof window.updateLoadingProgress === 'function') {
                    window.updateLoadingProgress((loadedCount / totalImagesToLoad) * 100);
                }
                checkCompletion();
            };
            
            // Intentar cargar cada imagen
            imageFiles.forEach((src) => {
                try {
                    const img = new Image();
                    
                    // Configurar manejadores de eventos primero
                    img.onload = () => onImageLoad(img, src);
                    img.onerror = (e) => onImageError(src, e);
                    
                    // Configurar CORS
                    img.crossOrigin = 'anonymous';
                    
                    // Configurar timeout
                    const loadTimeout = setTimeout(() => {
                        if (!img.complete) {
                            onImageError(src, new Error('Tiempo de espera agotado'));
                        }
                    }, 5000);
                    
                    // Actualizar manejadores para limpiar el timeout
                    const originalOnLoad = img.onload;
                    const originalOnError = img.onerror;
                    
                    img.onload = function() {
                        clearTimeout(loadTimeout);
                        originalOnLoad.call(this);
                    };
                    
                    img.onerror = function(e) {
                        clearTimeout(loadTimeout);
                        originalOnError.call(this, e);
                    };
                    
                    // Iniciar la carga
                    img.src = src;
                } catch (error) {
                    console.error(`Error al cargar la imagen ${src}:`, error);
                    loadedCount++;
                    checkCompletion();
                }
            });
            
        } catch (error) {
            console.error('Error en loadImages:', error);
            reject(error);
        }
    });
}

// Código de carga de imágenes duplicado eliminado

// Frases y configuración
const phrases = [
    "Te Amo", "My Love", "Eres preciosa",
    "Me encantas", "Amor de mi vida",
    "Por siempre juntos", "Eres mi todo",
    "Mi razón de ser", "Eres increíble",
    "Mi vida eres tú",
    "Universo en tus ojos", "Estrellas vivas",
    "Océanos claros", "Luz que hipnotiza",
    "Espejo de mi alma", "Te amo",
    "Eres mi todo", "Mi razón",
    "Siempre tú", "Mi vida",
    "Mi sol", "Amor eterno",
    "Contigo siempre", "Te pienso",
    "Mi corazón", "Te extraño",
    "Mi destino", "Eres magia",
    "Mi refugio", "Te siento",
    "Eres luz", "Sueño contigo",
    "Mi cielo", "Nuestro amor"
];

// Pool de objetos para mejor rendimiento
const objectPool = {
    stars: [],
    shootingStars: [],
    floatingPhrases: []
};

// Configuración de cámara
const camera = {
    x: 0,
    y: 0,
    z: 0,
    speed: 2,
    autoMove: true, // Modo de viaje automático
    fov: 200 // Campo de visión para calcular la perspectiva
};

// Inicializar estrellas con diferentes capas de profundidad
function initStars() {
    stars = [];
    for (let i = 0; i < MAX_STARS; i++) {
        createStar();
    }
    
    // Añadir más estrellas pequeñas para mayor realismo
    for (let i = 0; i < MAX_STARS / 2; i++) {
        createStar(0.5); // Estrellas más pequeñas
    }
}

// Crear una nueva estrella
function createStar(sizeMultiplier = 1) {
    const layer = Math.floor(Math.random() * 5) + 1;
    const speed = (Math.random() * 0.05 + 0.02) * (layer / 5);
    
    stars.push({
        x: (Math.random() - 0.5) * 4000, // Área más amplia para evitar bordes visibles
        y: (Math.random() - 0.5) * 4000,
        z: Math.random() * 3000,
        size: (Math.random() * 1.5 + 0.5) * sizeMultiplier,
        speed: speed,
        layer: layer,
        opacity: Math.random() * 0.7 + 0.3, // Variar opacidad
        hue: 200 + Math.random() * 40 // Ligeramente azulado
    });
}

// Estrellas fugaces (shooting stars)
const shootingStars = [];

function createShootingStar() {
    // Posición inicial en los bordes de la pantalla
    let x, y;
    if (Math.random() > 0.5) {
        x = Math.random() > 0.5 ? -50 : canvas.width + 50;
        y = Math.random() * canvas.height;
    } else {
        x = Math.random() * canvas.width;
        y = Math.random() > 0.5 ? -50 : canvas.height + 50;
    }
    
    // Dirección hacia el centro con variación
    const targetX = canvas.width * 0.5 + (Math.random() - 0.5) * canvas.width * 0.5;
    const targetY = canvas.height * 0.5 + (Math.random() - 0.5) * canvas.height * 0.5;
    const dx = targetX - x;
    const dy = targetY - y;
    const angle = Math.atan2(dy, dx);
    
    shootingStars.push({
        x: x,
        y: y,
        size: Math.random() * 1.5 + 0.5,
        speed: Math.random() * 2 + 3, // Velocidad reducida (antes era 5+10)
        angle: angle,
        length: Math.random() * 150 + 150, // Estela más larga para compensar la menor velocidad
        opacity: 1,
        fadeSpeed: Math.random() * 0.005 + 0.002, // Desvanecimiento más lento
        hue: 200 + Math.random() * 40, // Tono azulado
        trail: [] // Para el rastro de la estrella fugaz
    });
}

// Dibujar frases flotantes
const floatingPhrases = [];
phrases.forEach((phrase, index) => {
    floatingPhrases.push({
        text: phrase,
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        z: Math.random() * 1000, // Profundidad (para efecto 3D)
        size: Math.random() * 10 + 10
    });
});

// Actualizar lógica
function update() {
    updateCamera();
    updateStars();
    updateShootingStars();
    updateFloatingPhrases();
}

// Dibujar en el canvas
function draw() {
    // Limpiar completamente ambos canvas para evitar imágenes residuales
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (USE_OFFSCREEN_CANVAS && offscreenCtx) {
        offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    }
    
    const renderCtx = USE_OFFSCREEN_CANVAS ? offscreenCtx : ctx;
    
    // Limpiar el canvas con un degradado sutil para el espacio
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(5, 10, 20, 1)');
    gradient.addColorStop(1, 'rgba(2, 5, 15, 1)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Añadir un ligero ruido para dar textura al espacio (menos frecuente)
    if (Math.random() > 0.9) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.01)';
        for (let i = 0; i < 10; i++) {
            ctx.fillRect(
                Math.random() * canvas.width,
                Math.random() * canvas.height,
                1, 1
            );
        }
    }
    
    // Actualizar lógica
    update();
    
    // Dibujar elementos
    drawStars(renderCtx);
    drawShootingStars(renderCtx);
    drawFloatingPhrases(renderCtx);

    // Si estamos usando OffscreenCanvas, dibujar el buffer en el canvas principal
    if (USE_OFFSCREEN_CANVAS && offscreenCanvas) {
        ctx.drawImage(offscreenCanvas, 0, 0);
    }
    
    // Añadir un ligero viñeteado para mayor realismo
    const vignette = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.height * 0.4,
        canvas.width / 2, canvas.height / 2, canvas.height * 0.8
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
    
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Bucle de animación principal
function animate() {
    update();
    draw();
    requestAnimationFrame(animate);
}

// Inicializar frases flotantes
function initFloatingPhrases() {
    // Inicializar frases
    for (let i = 0; i < PHRASE_COUNT; i++) {
        createFloatingPhrase();
    }
    
    // Inicializar imágenes si hay imágenes cargadas (máximo 3)
    if (images.length > 0) {
        // Limitar a 3 imágenes flotantes como solicitó el usuario
        const MAX_FLOATING_IMAGES = 3;
        for (let i = 0; i < Math.min(MAX_FLOATING_IMAGES, images.length); i++) {
            createFloatingImage();
        }
    }
}

// Crear una frase flotante
function createFloatingPhrase() {
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    floatingPhrases.push({
        text: phrase,
        x: (Math.random() - 0.5) * 2000,
        y: (Math.random() - 0.5) * 2000,
        z: Math.random() * 2000 + 1000,
        size: Math.random() * 10 + 10,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]
    });
}

// Crear una imagen flotante
function createFloatingImage() {
    if (images.length === 0) return null;
    
    const loadedImages = images.filter(img => img.element && img.element.complete);
    if (loadedImages.length === 0) return null;
    
    const randomImage = loadedImages[Math.floor(Math.random() * loadedImages.length)].element;
    const size = 100 + Math.random() * 100;
    const aspectRatio = randomImage.height / randomImage.width;
    
    const floatingImage = {
        type: 'image',
        image: randomImage,
        width: size,
        height: size * aspectRatio,
        x: (Math.random() - 0.5) * 3000,
        y: (Math.random() - 0.5) * 2000,
        z: Math.random() * 2000 + 1000,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.01,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: 0 // Iniciar con alpha 0 para fade in suave
    };
    
    // Añadir la imagen al array de frases flotantes
    floatingPhrases.push(floatingImage);
    
    return floatingImage;
}

// Inicialización
function init() {
    // Inicializar estrellas y configuración básica
    initStars();
    setupEventListeners();
    handleResize();
    
    // Función para iniciar la animación
    const startAnimation = () => {
        initFloatingPhrases();
        animate();
        
        // Ocultar pantalla de carga después de un tiempo
        if (window.hideLoadingScreen) {
            setTimeout(window.hideLoadingScreen, 1000);
        } else {
            console.warn('hideLoadingScreen function not found');
        }
    };
    
    // Intentar cargar imágenes
    try {
        loadImages().then(() => {
            console.log('Imágenes cargadas correctamente');
            startAnimation();
        }).catch(error => {
            console.error('Error al cargar imágenes:', error);
            // Iniciar de todos modos
            startAnimation();
        });
    } catch (error) {
        console.error('Error en la inicialización:', error);
        startAnimation();
    }
}

// Iniciar todo cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    // DOM ya está listo
    init();
}

// Ajustar canvas al redimensionar
function handleResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (USE_OFFSCREEN_CANVAS) {
        offscreenCanvas.width = canvas.width;
        offscreenCanvas.height = canvas.height;
    }
}

// Configuración de eventos
function setupEventListeners() {
    window.addEventListener('resize', handleResize);
    
    // Deshabilitar el menú contextual del botón derecho
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    });
    
    // Control de velocidad con la rueda del ratón
    window.addEventListener('wheel', (e) => {
        camera.speed = Math.max(0.5, Math.min(5, camera.speed - e.deltaY * 0.001));
    }, { passive: true });
}

// Funciones de actualización
function updateCamera() {
    // Movimiento automático hacia adelante
    if (camera.autoMove) {
        camera.z += camera.speed;
    }
}

function updateStars() {
    stars.forEach(star => {
        // Mover estrellas basado en la perspectiva 3D
        star.z -= star.speed * 10;
        
        // Si la estrella sale de la vista, reiniciarla al fondo
        if (star.z < 0) {
            star.x = (Math.random() - 0.5) * 4000;
            star.y = (Math.random() - 0.5) * 4000;
            star.z = 3000;
            star.size = Math.random() * 1.5 + 0.5;
            star.opacity = Math.random() * 0.7 + 0.3;
        }
    });
}

function updateShootingStars() {
    if (Math.random() < 0.02) createShootingStar();
    shootingStars.forEach((star, index) => {
        star.x += Math.cos(star.angle) * star.speed;
        star.y += Math.sin(star.angle) * star.speed;
        star.opacity -= star.fadeSpeed;
        if (star.opacity <= 0) shootingStars.splice(index, 1);
        
        // Actualizar el rastro
        star.trail.push({ x: star.x, y: star.y });
        if (star.trail.length > star.length) star.trail.shift();
    });
}

function updateFloatingPhrases() {
    floatingPhrases.forEach(phrase => {
        // Mover hacia la cámara con velocidad ajustada según tipo
        if (phrase.type === 'image') {
            // Velocidad para imágenes: +0.005 como solicitado
            phrase.z -= camera.speed * 0.505; // 0.5 + 0.005
            
            // Rotar las imágenes más lentamente
            phrase.rotation += phrase.rotationSpeed * 0.5; // Reducir velocidad de rotación
        } else {
            // Velocidad para textos: x1.12 como solicitado (aplicado al valor anterior de 0.507)
            phrase.z -= camera.speed * 0.507 * 1.12; // (0.5 + 0.007) * 1.12
        }
        
        // Calcular la distancia de la cámara (valor absoluto para simplificar)
        const distanceFromCamera = Math.abs(phrase.z);
        
        // Resetear posición cuando pasa completamente a través de la cámara
        // Permitir que continúe moviéndose hasta estar bien detrás de la cámara
        if (phrase.z < -300) { // Valor negativo mayor para que desaparezca detrás de nosotros
            // Colocar la imagen más lejos para dar tiempo a la transición
            phrase.z = Math.random() * 1500 + 1000; // Rango de distancia más controlado
            phrase.x = (Math.random() - 0.5) * 1500; // Rango horizontal más estrecho
            phrase.y = (Math.random() - 0.5) * 1000; // Rango vertical más estrecho
            
            // Si es una imagen, cambiar a una imagen aleatoria para mantener la variedad
            if (phrase.type === 'image' && images.length > 0) {
                phrase.image = images[Math.floor(Math.random() * images.length)].element;
            }
            
            // Iniciar con opacidad baja para una transición más suave
            phrase.alpha = 0;
        } 
        // Gestión de opacidad basada en la distancia
        else if (distanceFromCamera < 300) {
            // Aumentar gradualmente la opacidad cuando se acerca mucho (simulando colisión)
            phrase.alpha = Math.min(1, (300 - distanceFromCamera) / 200);
            
            // Escalar ligeramente para efecto de aproximación
            phrase.scale = Math.min(1.5, 1 + (300 - distanceFromCamera) / 300);
            
            // Si está detrás de la cámara (z negativo), reducir opacidad gradualmente
            if (phrase.z < 0) {
                // Reducir opacidad a medida que se aleja detrás de la cámara
                phrase.alpha = Math.max(0, 1 - Math.abs(phrase.z) / 300);
            }
        } 
        else if (distanceFromCamera < 500) {
            // Opacidad completa en la zona media-cercana
            phrase.alpha = 1;
            phrase.scale = 1;
        } 
        else if (distanceFromCamera > 1500) {
            // Disminuir gradualmente la opacidad cuando está muy lejos
            phrase.alpha = Math.max(0, 1 - (distanceFromCamera - 1500) / 500);
            phrase.scale = 1;
        } 
        else {
            // Opacidad completa en la zona media
            phrase.alpha = 1;
            phrase.scale = 1;
        }
    });
}

// Funciones de dibujo
function drawStars(renderCtx) {
    // Ordenar estrellas por profundidad para dibujar correctamente la superposición
    const sortedStars = [...stars].sort((a, b) => b.z - a.z);
    
    sortedStars.forEach(star => {
        // Calcular posición en pantalla con perspectiva
        const scale = camera.fov / (camera.fov + star.z);
        const x = (star.x - camera.x) * scale + canvas.width / 2;
        const y = (star.y - camera.y) * scale + canvas.height / 2;
        const size = star.size * scale * 2;
        
        // Sólo dibujar si está dentro de la pantalla
        if (x >= -size && x <= canvas.width + size && y >= -size && y <= canvas.height + size) {
            const alpha = star.opacity * Math.min(1, star.z / 1000);
            const color = `hsla(${star.hue}, 100%, 80%, ${alpha})`;
            
            renderCtx.fillStyle = color;
            
            // Dibujar un círculo con brillo
            const gradient = renderCtx.createRadialGradient(
                x, y, 0,
                x, y, size * 1.5
            );
            gradient.addColorStop(0, color);
            gradient.addColorStop(0.5, `hsla(${star.hue}, 100%, 70%, ${alpha * 0.7})`);
            gradient.addColorStop(1, `hsla(${star.hue}, 100%, 50%, 0)`);
            
            renderCtx.save();
            renderCtx.globalCompositeOperation = 'lighter';
            renderCtx.fillStyle = gradient;
            
            renderCtx.beginPath();
            renderCtx.arc(x, y, size * 1.5, 0, Math.PI * 2);
            renderCtx.fill();
            
            // Punto central más brillante
            renderCtx.fillStyle = 'white';
            renderCtx.globalAlpha = alpha * 0.8;
            renderCtx.beginPath();
            renderCtx.arc(x, y, size * 0.5, 0, Math.PI * 2);
            renderCtx.fill();
            
            renderCtx.restore();
        }
    });
}

function drawShootingStars(renderCtx) {
    renderCtx.save();
    
    shootingStars.forEach((star, index) => {
        // Dibujar el rastro
        if (star.trail.length > 1) {
            renderCtx.beginPath();
            renderCtx.moveTo(star.trail[0].x, star.trail[0].y);
            
            for (let i = 1; i < star.trail.length; i++) {
                const t = star.trail[i];
                const alpha = (i / star.trail.length) * star.opacity * 0.7;
                const color = `hsla(${star.hue}, 100%, 85%, ${alpha})`;
                
                renderCtx.strokeStyle = color;
                renderCtx.lineWidth = star.size * 0.7 * (i / star.trail.length);
                renderCtx.lineTo(t.x, t.y);
                renderCtx.stroke();
                renderCtx.beginPath();
                renderCtx.moveTo(t.x, t.y);
            }
        }
        
        // Dibujar la cabeza de la estrella fugaz
        const gradient = renderCtx.createRadialGradient(
            star.x, star.y, 0,
            star.x, star.y, star.size * 3
        );
        gradient.addColorStop(0, `hsla(${star.hue}, 100%, 100%, ${star.opacity})`);
        gradient.addColorStop(0.5, `hsla(${star.hue}, 100%, 80%, ${star.opacity * 0.7})`);
        gradient.addColorStop(1, `hsla(${star.hue}, 100%, 60%, 0)`);
        
        renderCtx.fillStyle = gradient;
        renderCtx.beginPath();
        renderCtx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
        renderCtx.fill();
        
        // Punto central más brillante
        renderCtx.fillStyle = 'white';
        renderCtx.globalAlpha = star.opacity * 0.9;
        renderCtx.beginPath();
        renderCtx.arc(star.x, star.y, star.size * 0.7, 0, Math.PI * 2);
        renderCtx.fill();
    });
    
    renderCtx.restore();
}

function drawFloatingPhrases(renderCtx) {
    // Contador para depuración
    let imageCount = 0;
    let textCount = 0;
    
    // Ordenar por profundidad para renderizado correcto (más lejanos primero)
    const sortedPhrases = [...floatingPhrases].sort((a, b) => b.z - a.z);
    
    sortedPhrases.forEach((phrase, index) => {
        if (!phrase) return; // Saltar si la frase es nula o indefinida
        
        try {
            // Calcular escala basada en la distancia
            const scale = Math.min(1.5, 1 / (Math.max(1, phrase.z) / 500));
            
            // Aplicar escala adicional si existe (para efecto de aproximación)
            const finalScale = scale * (phrase.scale || 1);
            
            // Usar el alpha calculado en updateFloatingPhrases, con un mínimo para evitar parpadeos
            const alpha = Math.max(0.05, Math.min(1, (phrase.alpha || 0) * 0.9));
            
            // Posición en la pantalla con suavizado
            const x = (phrase.x - camera.x) * finalScale + canvas.width / 2;
            const y = (phrase.y - camera.y) * finalScale + canvas.height / 2;
            
            // Si está fuera de la pantalla, no dibujar
            const margin = 200; // Margen más grande para evitar cortes bruscos
            if (x < -margin || x > canvas.width + margin || y < -margin || y > canvas.height + margin) {
                return;
            }
            
            // Si es una imagen
            if (phrase.type === 'image' && phrase.image && phrase.image.complete && phrase.image.naturalWidth > 0) {
                try {
                    renderCtx.save();
                    
                    // Aplicar transparencia global
                    renderCtx.globalAlpha = alpha;
                    
                    // Mover el contexto al centro de la imagen
                    renderCtx.translate(x, y);
                    
                    // Aplicar rotación si existe
                    if (phrase.rotation) {
                        renderCtx.rotate(phrase.rotation);
                    }
                    
                    // Calcular dimensiones con escala suavizada
                    const imgScale = finalScale * 0.8; // Reducir ligeramente el tamaño
                    const width = phrase.width * imgScale;
                    const height = phrase.height * imgScale;
                    
                    // Aplicar sombra sutil para mejor legibilidad
                    renderCtx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                    renderCtx.shadowBlur = 10 * finalScale;
                    
                    // Crear un gradiente radial para suavizar los bordes
                    const borderGradient = renderCtx.createRadialGradient(
                        0, 0, Math.min(width, height) * 0.4, // Centro y radio interno
                        0, 0, Math.max(width, height) * 0.7  // Centro y radio externo
                    );
                    borderGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
                    borderGradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.9)');
                    borderGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                    
                    // Guardar el estado antes de aplicar el recorte
                    renderCtx.save();
                    
                    // Crear un recorte circular para la imagen
                    renderCtx.beginPath();
                    renderCtx.arc(0, 0, Math.min(width, height) * 0.5, 0, Math.PI * 2);
                    renderCtx.closePath();
                    renderCtx.clip();
                    
                    // Dibujar la imagen centrada
                    renderCtx.drawImage(
                        phrase.image, 
                        -width / 2, 
                        -height / 2,
                        width,
                        height
                    );
                    
                    // Restaurar para quitar el recorte
                    renderCtx.restore();
                    
                    // Dibujar un borde suave
                    renderCtx.globalCompositeOperation = 'destination-over';
                    renderCtx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                    renderCtx.beginPath();
                    renderCtx.arc(0, 0, Math.min(width, height) * 0.55, 0, Math.PI * 2);
                    renderCtx.fill();
                    
                    // Restaurar configuración del contexto
                    renderCtx.shadowBlur = 0;
                    renderCtx.restore();
                    
                    imageCount++;
                } catch (e) {
                    console.error('Error al dibujar imagen:', e);
                }
            } 
            // Si es texto
            else if (phrase.text) {
                renderCtx.save();
                
                // Configurar estilo de texto con sombra para mejor legibilidad
                const fontSize = Math.max(12, phrase.size * finalScale * 0.8); // Tamaño de fuente reducido
                renderCtx.font = `bold ${fontSize}px 'Orbitron', sans-serif`;
                renderCtx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                renderCtx.textAlign = 'center';
                renderCtx.textBaseline = 'middle';
                
                // Sombra de texto para mejor legibilidad
                renderCtx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                renderCtx.shadowBlur = 5;
                
                renderCtx.fillText(phrase.text, x, y);
                
                // Restaurar configuración
                renderCtx.shadowBlur = 0;
                renderCtx.restore();
                
                textCount++;
            }
        } catch (e) {
            console.error('Error al procesar elemento flotante:', e);
        }
    });
    
    // Solo mostrar el contador de depuración ocasionalmente para no saturar la consola
    if (Math.random() < 0.01) {
        console.log(`Elementos dibujados: ${imageCount} imágenes, ${textCount} textos`);
    }
}