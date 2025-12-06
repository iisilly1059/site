window.addEventListener('load', () => {
    const views = {
        'home-page': document.getElementById('home-page-view'),
        'games': document.getElementById('games-view'),
        'game': document.getElementById('game-view'),
        'settings': document.getElementById('settings-view')
    };
    
    // --- THIS BLOCK IS NOW FIXED ---
    const navButtons = document.querySelectorAll('.nav-button');
    const gameIframe = document.getElementById('game-iframe');
    const gameLoader = document.getElementById('game-loader'); // This was the line we were trying to add
    const particlesToggle = document.getElementById('particles-toggle');
    // --- END OF FIX ---
    
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
    const fpsDisplay = document.getElementById('fps'); // Moved this here
    
    const words = ['silly.', 'freedom.', 'beauty.', 'peace.', 'amazement.', 'fun.'];
    let wordIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typingTimeout;
    
    const type = () => {
        const currentWord = words[wordIndex];
        if (isDeleting) {
            gradientWord.textContent = currentWord.substring(0, charIndex - 1);
            charIndex--;
        } else {
            gradientWord.textContent = currentWord.substring(0, charIndex + 1);
            charIndex++;
        }
        let typeSpeed = 120;
        if (isDeleting) typeSpeed /= 2;
        if (!isDeleting && charIndex === currentWord.length) {
            typeSpeed = 2500;
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            wordIndex = (wordIndex + 1) % words.length;
            typeSpeed = 500;
        }
        typingTimeout = setTimeout(type, typeSpeed);
    };
    type();
    
    const gameBoxes = document.querySelectorAll('.game-box[data-url]');
    let currentShowcaseIndex = 0;
    let showcaseInterval = null;
    
    const updateShowcase = () => {
        const box = gameBoxes[currentShowcaseIndex];
        const url = box.dataset.url;
        const title = box.dataset.title;
        const img = box.dataset.img;
        showcaseImg.src = img;
        showcaseTitle.textContent = title;
        showcase.onclick = () => {
            box.click();
        };
        currentShowcaseIndex = (currentShowcaseIndex + 1) % gameBoxes.length;
    };
    
    const startShowcase = () => {
        updateShowcase();
        showcaseInterval = setInterval(updateShowcase, parseInt(showcaseSpeed.value));
    };
    
    let shootingStarInterval = null;
    
    const createShootingStar = () => {
        if (views['home-page'].classList.contains('hidden-view')) return;
        const star = document.createElement('div');
        star.className = 'shooting-star';
        const startX = Math.random() * window.innerWidth * 0.6;
        const startY = Math.random() * window.innerHeight * 0.4;
        star.style.left = `${startX}px`;
        star.style.top = `${startY}px`;
        document.body.appendChild(star);
        let moveX = 0;
        let moveY = 0;
        const moveStar = () => {
            moveX += 5;
            moveY += 3.5;
            star.style.transform = `translate(${moveX}px, ${moveY}px)`;
            if (moveX < 350 && moveY < 250) {
                requestAnimationFrame(moveStar);
            } else {
                star.remove();
            }
        };
        moveStar();
    };
    
    const startShootingStars = () => {
        if (shootingStarInterval) clearInterval(shootingStarInterval);
        createShootingStar();
        shootingStarInterval = setInterval(createShootingStar, 5000);
    };
    
    const stopShootingStars = () => {
        if (shootingStarInterval) clearInterval(shootingStarInterval);
        document.querySelectorAll('.shooting-star').forEach(s => s.remove());
    };
    
    window.showView = function(name) {
        for (let view in views) {
            views[view].classList.add('hidden-view');
        }
        views[name].classList.remove('hidden-view');
        navButtons.forEach(btn => {
            btn.classList.remove('bg-purple-600', 'text-white');
            btn.classList.add('text-gray-300', 'hover:bg-gray-700', 'hover:text-white');
            if (btn.dataset.view === name || (name === 'game' && btn.dataset.view === 'games')) {
                btn.classList.add('bg-purple-600', 'text-white');
                btn.classList.remove('text-gray-300', 'hover:bg-gray-700', 'hover:text-white');
            }
        });
        if (name === 'home-page' || name === 'game') {
            startShootingStars();
        } else {
            stopShootingStars();
        }
        if (name === 'home-page') {
            startShowcase();
        } else {
            clearInterval(showcaseInterval);
        }
        if (name === 'games') {
            searchInput.value = '';
            filterGames('');
        }
    };
    
    const canvas = document.getElementById('particle-canvas');
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationFrameId;
    
    const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    
    class Particle {
        constructor(x, y) {
            this.x = x || Math.random() * canvas.width;
            this.y = y || Math.random() * canvas.height;
            this.radius = Math.random() * 1.5 + 0.5;
            this.color = 'rgba(255, 255, 255, 0.8)';
            this.velocity = {
                x: (Math.random() - 0.5) * 0.2,
                y: (Math.random() - 0.5) * 0.2
            };
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.closePath();
        }
        update() {
            this.x += this.velocity.x;
            this.y += this.velocity.y;
            if (this.x < 0 || this.x > canvas.width) this.velocity.x = -this.velocity.x;
            if (this.y < 0 || this.y > canvas.height) this.velocity.y = -this.velocity.y;
        }
    }
    
    const initParticles = (count) => {
        particles = [];
        for (let i = 0; i < count; i++) {
            particles.push(new Particle());
        }
    };
    
    const animateParticles = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 100) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(139, 92, 246, ${1 - distance / 100})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                    ctx.closePath();
                }
            }
        }
        animationFrameId = requestAnimationFrame(animateParticles);
    };
    
    const toggleParticles = (enabled, count) => {
        if (enabled) {
            canvas.style.display = 'block';
            initParticles(count);
            animateParticles();
        } else {
            canvas.style.display = 'none';
            cancelAnimationFrame(animationFrameId);
        }
        localStorage.setItem('particlesEnabled', enabled ? 'true' : 'false');
        localStorage.setItem('particleCount', count);
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    const savedParticles = localStorage.getItem('particlesEnabled');
    const savedParticleCount = parseInt(localStorage.getItem('particleCount')) || 50;
    const particlesEnabled = savedParticles ? savedParticles === 'true' : true;
    particlesToggle.checked = particlesEnabled;
    particleDensity.value = savedParticleCount;
    particleDensityValue.textContent = savedParticleCount;
    toggleParticles(particlesEnabled, savedParticleCount);
    
    particleDensity.addEventListener('input', (e) => {
        particleDensityValue.textContent = e.target.value;
        if (particlesToggle.checked) {
            toggleParticles(true, parseInt(e.target.value));
        }
    });
    
    particlesToggle.addEventListener('change', (e) => {
        toggleParticles(e.target.checked, parseInt(particleDensity.value));
    });
    
    const savedVolume = localStorage.getItem('gameVolumeMuted') === 'true';
    gameVolumeToggle.checked = savedVolume;
    gameIframe.volume = savedVolume ? 0 : 1;
    
    gameVolumeToggle.addEventListener('change', (e) => {
        gameIframe.volume = e.target.checked ? 0 : 1;
        localStorage.setItem('gameVolumeMuted', e.target.checked ? 'true' : 'false');
    });
    
    const savedPerformance = localStorage.getItem('performanceMode') === 'true';
    performanceToggle.checked = savedPerformance;
    if (savedPerformance) {
        toggleParticles(false, 10);
        stopShootingStars();
        showcaseSpeed.value = '5000';
        clearInterval(showcaseInterval);
        if (views['home-page'] && !views['home-page'].classList.contains('hidden-view')) {
            startShowcase();
        }
    }
    
    performanceToggle.addEventListener('change', (e) => {
        localStorage.setItem('performanceMode', e.target.checked ? 'true' : 'false');
        if (e.target.checked) {
            toggleParticles(false, 10);
            stopShootingStars();
            showcaseSpeed.value = '5000';
            clearInterval(showcaseInterval);
            if (views['home-page'] && !views['home-page'].classList.contains('hidden-view')) {
                startShowcase();
            }
        } else {
            toggleParticles(particlesToggle.checked, parseInt(particleDensity.value));
            if (views['home-page'] && !views['home-page'].classList.contains('hidden-view')) {
                startShootingStars();
            }
        }
    });
    
    const savedShowcaseSpeed = localStorage.getItem('showcaseSpeed') || '2000';
    showcaseSpeed.value = savedShowcaseSpeed;
    
    showcaseSpeed.addEventListener('change', (e) => {
        clearInterval(showcaseInterval);
        if (views['home-page'] && !views['home-page'].classList.contains('hidden-view')) {
            startShowcase();
        }
        localStorage.setItem('showcaseSpeed', e.target.value);
    });
    
    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const targetView = e.target.dataset.view;
            showView(targetView);
        });
    });
    
    // --- THIS IS THE CLICK HANDLER LOGIC ---
    const handleGameClick = (url) => {
        if (!url) return;
        
        // If it's a link to your own github.io page, load it in the iframe
        if (url.startsWith('https://iisilly1059.github.io') || !url.startsWith('http')) {
            
            // Show the loader
            gameLoader.classList.add('active');
            gameIframe.src = url;
            showView('game');
            
            // --- Hide the loader after 5 seconds (5000ms) ---
            setTimeout(() => {
                gameLoader.classList.remove('active');
            }, 5000); // 5seconds
            
        } else {
            // For external links (like krunker.io), open in a new tab
            window.open(url, '_blank');
        }
    };
    
    // --- THIS IS THE CLICK EVENT LISTENER ---
    gameBoxes.forEach(box => {
        box.addEventListener('click', () => {
            handleGameClick(box.dataset.url);
        });
    });
    // --- END OF CLICK LOGIC ---
    
    
    // --- FULLSCREEN BUTTON ---
    document.getElementById('fullscreen-btn-game').addEventListener('click', () => {
        if (gameIframe.requestFullscreen) {
            gameIframe.requestFullscreen();
        } else if (gameIframe.mozRequestFullScreen) { // Firefox
            gameIframe.mozRequestFullScreen();
        } else if (gameIframe.webkitRequestFullscreen) { // Chrome, Safari, Opera
            gameIframe.webkitRequestFullscreen();
        } else if (gameIframe.msRequestFullscreen) { // IE/Edge
            gameIframe.msRequestFullscreen();
        }
    });
    // --- END OF FULLSCREEN BUTTON ---
    
    const themeOptions = document.querySelectorAll('.theme-option');
    const body = document.body;
    
    const applyTheme = (theme) => {
        body.setAttribute('data-theme', theme);
        localStorage.setItem('selectedTheme', theme);
        themeOptions.forEach(opt => {
            opt.classList.toggle('active', opt.dataset.theme === theme);
        });
        if (views['home-page'] && !views['home-page'].classList.contains('hidden-view') && (theme === 'galaxy' || theme === 'dark')) {
            stopShootingStars();
            startShootingStars();
        }
    };
    
    themeOptions.forEach(option => {
        option.addEventListener('click', () => {
            applyTheme(option.dataset.theme);
        });
    });
    
    const savedTheme = localStorage.getItem('selectedTheme') || 'dark';
    applyTheme(savedTheme);
    
    const filterGames = (searchTerm) => {
        const lowerCaseSearch = searchTerm.toLowerCase();
        gameBoxWrapper.innerHTML = '';
        let currentRow = null;
        let boxCount = 0;
        gameBoxes.forEach(box => {
            const title = box.dataset.title.toLowerCase();
            if (!lowerCaseSearch || title.includes(lowerCaseSearch)) {
                if (boxCount % 5 === 0) {
                    currentRow = document.createElement('div');
                    currentRow.className = 'five-box-row';
                    gameBoxWrapper.appendChild(currentRow);
                }
                const clonedBox = box.cloneNode(true);
                
                // --- THIS IS THE CLICK HANDLER FOR SEARCH RESULTS ---
                clonedBox.addEventListener('click', () => {
                    handleGameClick(clonedBox.dataset.url);
                });
                // --- END OF CLICK HANDLER ---
                
                currentRow.appendChild(clonedBox);
                boxCount++;
            }
        });
    };
    
    searchInput.addEventListener('input', (e) => {
        filterGames(e.target.value);
    });
    
    const panicToggle = document.getElementById('panic-toggle');
    const panicOptions = document.getElementById('panic-options');
    const panicKeyInput = document.getElementById('panic-key-input');
    const panicUrlInput = document.getElementById('panic-url');
    const savePanicBtn = document.getElementById('save-panic-btn');
    const panicStatus = document.getElementById('panic-status');
    const siteTitleInput = document.getElementById('site-title-input');
    const siteLogoInput = document.getElementById('site-logo-input');
    const currentLogoSpan = document.getElementById('current-logo');
    const openAboutBlankBtn = document.getElementById('open-about-blank-btn');
    const homeAboutBlankBtn = document.getElementById('home-about-blank-btn');
    const resetSettingsBtn = document.getElementById('reset-settings');
    
    let panicKey = null;
    let panicURL = 'https://docs.google.com';
    
    const panicHandler = (event) => {
        if (panicToggle.checked && panicKey && event.key.toUpperCase() === panicKey) {
            window.location.replace(panicURL);
        }
    };
    document.addEventListener('keydown', panicHandler);
    
    const loadSettings = () => {
        const savedPanicEnabled = localStorage.getItem('panicEnabled') === 'true';
        panicToggle.checked = savedPanicEnabled;
        panicOptions.classList.toggle('hidden', !savedPanicEnabled);
        
        const savedPanicKey = localStorage.getItem('panicKey');
        if (savedPanicKey) {
            panicKey = savedPanicKey;
            panicKeyInput.value = `Key: ${savedPanicKey}`;
        } else {
            panicKeyInput.value = '';
        }
        
        const savedPanicUrl = localStorage.getItem('panicURL');
        if (savedPanicUrl) {
            panicURL = savedPanicUrl;
            panicUrlInput.value = savedPanicUrl;
        } else {
            panicUrlInput.value = panicURL;
        }
        
        const savedTitle = localStorage.getItem('siteTitle');
        if (savedTitle) {
            document.title = savedTitle;
            siteTitleInput.value = savedTitle;
        }
        
        const savedFavicon = localStorage.getItem('siteFavicon');
        if (savedFavicon) {
            const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
            link.type = 'image/x-icon';
            link.rel = 'shortcut icon';
            link.href = savedFavicon;
            document.getElementsByTagName('head')[0].appendChild(link);
            currentLogoSpan.textContent = 'Custom';
        } else {
            currentLogoSpan.textContent = 'none';
        }
    };
    
    const saveSettings = () => {
        localStorage.setItem('panicEnabled', panicToggle.checked);
        if (panicKey) {
            localStorage.setItem('panicKey', panicKey);
            localStorage.setItem('panicURL', panicUrlInput.value || 'https://docs.google.com');
            panicURL = panicUrlInput.value || 'https://docs.google.com';
            panicStatus.textContent = 'Saved!';
            panicStatus.classList.remove('hidden');
            setTimeout(() => panicStatus.classList.add('hidden'), 2000);
        }
        
        const newTitle = siteTitleInput.value.trim();
        if (newTitle) {
            document.title = newTitle;
            localStorage.setItem('siteTitle', newTitle);
        } else {
            document.title = "Silly funness";
            localStorage.removeItem('siteTitle');
        }
    };
    
    // --- FIXED 'about:blank' logic ---
    const openAboutBlank = () => {
        const newWindow = window.open('about:blank', '_blank');
        if (newWindow) {
            try {
                newWindow.document.write(`<html><head><title>${document.title}</title><link rel="shortcut icon" href="${document.querySelector("link[rel*='icon']") ? document.querySelector("link[rel*='icon']").href : 'none'}" type="image/x-icon"></head><body><iframe style="position:fixed; top:0; left:0; bottom:0; right:0; width:100%; height:100%; border:none; margin:0; padding:0; overflow:hidden; z-index:999999;" src="${window.location.href}"></iframe></body></html>`);
                // window.close(); // This line might be too aggressive
            } catch (e) {
                newWindow.close();
                alert("Could not open in about:blank. This might be blocked by your browser's security settings.");
            }
        } else {
            alert("Pop-up blocked! Please allow pop-ups for this site to use the about:blank feature.");
        }
    };
    // --- END OF 'about:blank' FIX ---
    
    const handlePanicKeydown = (event) => {
        event.preventDefault();
        const key = event.key.toUpperCase();
        if (key.length === 1 && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
            panicKey = key;
            panicKeyInput.value = `Key: ${key}`;
            panicKeyInput.blur();
        } else if (key === 'BACKSPACE' || key === 'DELETE') {
            panicKey = null;
            panicKeyInput.value = '';
        }
    };
    
    panicToggle.addEventListener('change', (e) => {
        panicOptions.classList.toggle('hidden', !e.target.checked);
        localStorage.setItem('panicEnabled', e.target.checked);
    });
    
    panicKeyInput.addEventListener('focus', () => {
        panicKeyInput.value = 'Press a key (A-Z)...';
        panicKeyInput.addEventListener('keydown', handlePanicKeydown, { once: true });
    });
    
    panicKeyInput.addEventListener('blur', () => {
        panicKeyInput.removeEventListener('keydown', handlePanicKeydown);
        if (panicKey) {
            panicKeyInput.value = `Key: ${panicKey}`;
        } else {
            panicKeyInput.value = '';
        }
    });
    
    savePanicBtn.addEventListener('click', saveSettings);
    siteTitleInput.addEventListener('input', saveSettings);
    
    siteLogoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const faviconBase64 = event.target.result;
                localStorage.setItem('siteFavicon', faviconBase64);
                loadSettings();
            };
            reader.readAsDataURL(file);
        }
    });
    
    openAboutBlankBtn.addEventListener('click', openAboutBlank);
    homeAboutBlankBtn.addEventListener('click', openAboutBlank);
    
    resetSettingsBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all settings?')) {
            localStorage.removeItem('panicEnabled');
            localStorage.removeItem('panicKey');
            localStorage.removeItem('panicURL');
            localStorage.removeItem('siteTitle');
            localStorage.removeItem('siteFavicon');
            localStorage.removeItem('selectedTheme');
            localStorage.removeItem('particlesEnabled');
            localStorage.removeItem('particleCount');
            localStorage.removeItem('gameVolumeMuted');
            localStorage.removeItem('showcaseSpeed');
            localStorage.removeItem('performanceMode');
            window.location.reload();
        }
    });
    
    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            tabButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            tabPanels.forEach(p => p.classList.remove('active'));
            document.getElementById(e.target.dataset.tab + '-tab').classList.add('active');
        });
    });
    
    loadSettings();
    showView('home-page');
    
    // --- FPS COUNTER LOGIC (MOVED TO A SAFER PLACE) ---
    let lastCalledTime = Date.now();
    let fps = 0;
    
    function updateFPS() {
        const delta = (Date.now() - lastCalledTime) / 1000;
        lastCalledTime = Date.now();
        fps = Math.round(1 / delta);
        if (fpsDisplay) { // Check if fpsDisplay exists
            fpsDisplay.textContent = `FPS: ${fps}`;
        }
        requestAnimationFrame(updateFPS);
    }
    requestAnimationFrame(updateFPS);
    // --- END FPS COUNTER ---
});
// ————— SMOOTH FADE-IN WHEN SCROLLING TO GAMES —————
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll('li, .game-item').forEach(item => {
  item.style.opacity = '0';
  item.style.transform = 'translateY(25px)';
  item.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
  observer.observe(item);
});

// ————— SMOOTH FADE WHEN SWITCHING TABS —————
function openTab(tabName) {
  const tabs = document.querySelectorAll('.tab-content');
  
  // Fade out all tabs first
  tabs.forEach(tab => {
    tab.style.opacity = '0';
    tab.style.transition = 'opacity 0.4s ease';
  });

  setTimeout(() => {
    // Hide all + show the clicked one
    tabs.forEach(tab => tab.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');

    // Fade in the new tab
    document.getElementById(tabName).style.opacity = '1';

    // Update button highlight
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
  }, 400);
}
// ————— NEW: ENSURE PAGE FADES ON LOAD —————
function initPageFade() {
  document.body.style.opacity = '1'; // In case CSS didn't trigger
}

// Run everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initScrollFades();
  initPageFade();
  // Call your original init if any (e.g., load active tab)
  openTab('games', {target: document.querySelector('.tab-button[onclick*="games"]')}); // Default to games tab
});