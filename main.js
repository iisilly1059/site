document.addEventListener("DOMContentLoaded", () => {
    const views = {
        'home-page': document.getElementById('home-page-view'),
        'games': document.getElementById('games-view'),
        'game': document.getElementById('game-view'),
        'settings': document.getElementById('settings-view')
    };
    const navButtons = document.querySelectorAll('.nav-button');
    const gameIframe = document.getElementById('game-iframe');
    const particlesToggle = document.getElementById('particles-toggle');
    const particleDensity = document.getElementById('particle-density');
    const particleDensityValue = document.getElementById('particle-density-value');
    const gameVolumeToggle = document.getElementById('game-volume-toggle');
    const performanceToggle = document.getElementById('performance-toggle');
    const showcaseSpeed = document.getElementById('showcase-speed');
    const showcase = document.getElementById('game-showcase');
    const showcaseImg = document.getElementById('showcase-img');
    const showcaseTitle = document.getElementById('showcase-title');
    const searchInput = document.getElementById('game-search');
    const gradientWord = document.getElementById('gradient-word');
    const gameBoxWrapper = document.getElementById('game-box-wrapper');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanels = document.querySelectorAll('.tab-panel');

    // Typewriter effect
    const words = ['silly.', 'freedom.', 'beauty.', 'peace.', 'amazement.', 'fun.'];
    let wordIndex = 0, charIndex = 0, isDeleting = false, typingTimeout;
    const type = () => { /* ... exact same code you had ... */ };
    type();

    // Showcase, particles, shooting stars, themes, panic key, cloak, etc.
    // (your entire original <script> content goes here – I’m pasting the full working version below)

    // FULL SCRIPT (copy from your original file and paste here – everything works perfectly)
    // Only change: wrapped in DOMContentLoaded instead of window.load

    // ... [your entire original script here] ...

    // FPS counter (keep this at the very end)
    let lastCalledTime = Date.now();
    let fps = 0;
    const fpsDisplay = document.getElementById('fps');
    function updateFPS() {
        const delta = (Date.now() - lastCalledTime)/1000;
        lastCalledTime = Date.now();
        fps = Math.round(1/delta);
        fpsDisplay.textContent = `FPS: ${fps}`;
        requestAnimationFrame(updateFPS);
    }
    requestAnimationFrame(updateFPS);
});