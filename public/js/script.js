window.addEventListener('load', () => {
    const views = {
        'home-page': document.getElementById('home-page-view'),
        'gs': document.getElementById('gs-view'),
        'g': document.getElementById('g-view'),
        's': document.getElementById('s-view'),
        'e': document.getElementById('e-view'),
        'p': document.getElementById('p-view'),
        'ai': document.getElementById('ai-view'),
        'm': document.getElementById('m-view'),
    };

    const navButtons = document.querySelectorAll('.nav-button');
    const gameIframe = document.getElementById('game-iframe');
    const gameLoader = document.getElementById('game-loader');
    const searchInput = document.getElementById('g-search');
    const showcaseImg = document.getElementById('showcase-img');
    const showcaseTitle = document.getElementById('showcase-title');
    const showcaseSpeed = document.getElementById('showcase-speed');
    const gradientWord = document.getElementById('gradient-word');
    const particleCanvas = document.getElementById('particle-canvas');
    const ctx = particleCanvas.getContext('2d');

    const particlesToggle = document.getElementById('particles-toggle');
    const particleDensity = document.getElementById('particle-density');
    const particleDensityValue = document.getElementById('particle-density-value');
    const gameVolumeToggle = document.getElementById('game-volume-toggle');
    const performanceToggle = document.getElementById('performance-toggle');
    const panicToggle = document.getElementById('panic-toggle');
    const panicOptions = document.getElementById('panic-options');
    const panicKeyInput = document.getElementById('panic-key-input');
    const panicUrl = document.getElementById('panic-url');
    const savePanicBtn = document.getElementById('save-panic-btn');
    const panicStatus = document.getElementById('panic-status');
    const siteTitleInput = document.getElementById('site-title-input');
    const siteLogoInput = document.getElementById('site-logo-input');
    const currentLogo = document.getElementById('current-logo');

    const body = document.body;

    let allGames = [];
    let particles = [];
    let animationFrameId = null;
    let showcaseInterval = null;
    let currentShowcaseIndex = 0;
    let hasAboutBlankRun = false;
    let activeGameUrl = null;

    const resizeCanvas = () => {
        particleCanvas.width = window.innerWidth;
        particleCanvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const loadGamesFromJSON = async () => {
        const CACHE_KEY = 'games_data_cache';
        const cachedData = localStorage.getItem(CACHE_KEY);
        const processData = (data) => data.map(game => ({
            ...game,
            searchString: `${game.title.toLowerCase()} ${game.category.toLowerCase()}`
        }));
        
        if (cachedData) {
            allGames = processData(JSON.parse(cachedData));
            renderAllGames();
            startShowcase();
        }

        try {
            const response = await fetch('g.json');
            if (!response.ok) throw new Error('Failed to load g.json');

            const freshData = await response.json();
            if (JSON.stringify(freshData) !== cachedData) {
                allGames = processData(freshData);
                localStorage.setItem(CACHE_KEY, JSON.stringify(freshData));
                renderAllGames();
                if (!cachedData) startShowcase();
            }
        } catch (err) {
            console.error('Error loading games:', err);
            if (!allGames.length) {
                document.getElementById('game-box-wrapper').innerHTML = 
                    '<p class="text-center text-xl py-20">Failed to load games. Try refreshing the page.</p>';
            }
        }
    };

const renderAllGames = (gamesToRender = allGames, category = 'all') => {
        const wrapper = document.getElementById('game-box-wrapper');
        wrapper.innerHTML = '';

        let filtered = gamesToRender;

        if (category !== 'all') {
            filtered = gamesToRender.filter(game => game.category === category);
        }

        filtered.sort((a, b) => {
            const titleA = a.title.toLowerCase();
            const titleB = b.title.toLowerCase();
            return titleA.localeCompare(titleB);
        });

        if (filtered.length === 0) {
            wrapper.innerHTML = '<p class="text-center text-xl py-20">No games found.</p>';
            return;
        }

        for (let i = 0; i < filtered.length; i += 5) {
            const row = document.createElement('div');
            row.className = 'five-box-row';

            filtered.slice(i, i + 5).forEach(game => {
                const box = document.createElement('div');
                box.className = 'game-box';
                box.dataset.url = game.url;
                box.dataset.title = game.title;
                box.dataset.img = game.img || 'games/img/placeholder.png';

                box.innerHTML = `
                    <img data-src="${box.dataset.img}" alt="${game.title}" class="lazy-game-img">
                    <div class="game-title">${game.title}</div>
                `;

                row.appendChild(box);
            });

            wrapper.appendChild(row);
        }

        bindAllGameBoxes();
        observeImages();
    };

    const showView = (name) => {
        if (name !== 'g') {
            try {
                gameIframe.contentWindow.document.write('');
                gameIframe.contentWindow.close();
            } catch (e) {
            }
            gameIframe.src = 'about:blank';
            activeGameUrl = null;
            gameLoader.classList.remove('active');
        }

        Object.values(views).forEach(v => v?.classList.add('hidden-view'));
        views[name]?.classList.remove('hidden-view');

        navButtons.forEach(btn => {
            btn.classList.remove('bg-purple-600', 'text-white');
            btn.classList.add('text-gray-300');
            if (btn.dataset.view === name) {
                btn.classList.add('bg-purple-600', 'text-white');
                btn.classList.remove('text-gray-300');
            }
        });

        document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`.sidebar-btn[data-view="${name}"]`)?.classList.add('active');

        if (name === 'home-page') startShowcase();
        else clearInterval(showcaseInterval);

        if (name === 'gs') {
            searchInput.value = '';
            searchInput.focus();
            renderAllGames();
        }
        if (name === 'e') setTimeout(bindExtraCards, 100);

        setTimeout(bindAllGameBoxes, 100);
    };

    window.showView = showView;

    const bindAllGameBoxes = () => {
        document.querySelectorAll('.game-box[data-url]:not([data-bound])').forEach(box => {
            box.dataset.bound = 'true';

            const game = {
                url: box.dataset.url,
                title: box.dataset.title || 'Content',
                img: box.dataset.img || ''
            };

            box.addEventListener('click', (e) => {

                activeGameUrl = game.url;
                gameIframe.src = game.url;
                gameLoader.classList.add('active');
                gameLoader.querySelector('.main-message').textContent = `Loading ${game.title}...`;

                showView('g');

                gameIframe.onload = () => gameLoader.classList.remove('active');

                if (gameVolumeToggle.checked) {
                    setTimeout(() => {
                        try { gameIframe.contentWindow?.postMessage({type: 'mute', value: true}, '*'); } catch {} 
                    }, 1500);
                }
            });
        });
    };

    const bindExtraCards = () => {
        document.querySelectorAll('.e-card[data-url]:not([data-bound])').forEach(card => {
            card.dataset.bound = 'true';
            const content = { url: card.dataset.url, title: card.dataset.title || 'Content' };
            card.addEventListener('click', () => {
                activeGameUrl = content.url;
                gameIframe.src = content.url;
                gameLoader.classList.add('active');
                gameLoader.querySelector('.main-message').textContent = `Loading ${content.title}...`;
                showView('g');
                gameIframe.onload = () => gameLoader.classList.remove('active');
            });
        });
    };
    bindExtraCards();

let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const query = searchInput.value.toLowerCase().trim();
            const filtered = allGames.filter(g => g.title.toLowerCase().includes(query));
            const currentCategoryText = document.getElementById('category-current-text')?.textContent.trim() || 'All Gxmes';
            const currentCategory = Array.from(document.querySelectorAll('.category-option'))
                .find(o => o.textContent.trim() === currentCategoryText)
                ?.dataset.category || 'all';
            renderAllGames(filtered, currentCategory);
            document.getElementById('gs-view').scrollTo({ top: 0 });
        }, 150);
    });

    const categoryToggle = document.getElementById('category-dropdown-toggle');
    const categoryMenu = document.getElementById('category-dropdown-menu');
    const categoryCurrentText = document.getElementById('category-current-text');
    const dropdownArrow = document.getElementById('dropdown-arrow');
    const categoryOptions = document.querySelectorAll('.category-option');

    if (categoryToggle) {
        categoryToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            categoryMenu.classList.toggle('hidden');
            dropdownArrow.classList.toggle('rotate-180');
        });

        document.addEventListener('click', (e) => {
            if (!categoryToggle.contains(e.target) && !categoryMenu.contains(e.target)) {
                categoryMenu.classList.add('hidden');
                dropdownArrow.classList.remove('rotate-180');
            }
        });

        categoryOptions.forEach(option => {
            option.addEventListener('click', () => {
                const category = option.dataset.category;
                categoryCurrentText.textContent = option.textContent.trim();
                categoryOptions.forEach(opt => opt.classList.remove('bg-purple-600/50'));
                option.classList.add('bg-purple-600/50');
                renderAllGames(allGames, category);
                categoryMenu.classList.add('hidden');
                dropdownArrow.classList.remove('rotate-180');
            });
        });
    }

    const updateShowcase = () => {
        if (allGames.length === 0) {
            showcaseImg.src = 'games/img/placeholder.png';
            showcaseTitle.textContent = 'Loading games...';
            document.getElementById('game-showcase').onclick = null;
            return;
        }

        let attempts = 0;
        let game;
        do {
            game = allGames[currentShowcaseIndex];
            currentShowcaseIndex = (currentShowcaseIndex + 1) % allGames.length;
            attempts++;
        } while (attempts < allGames.length && (!game.img || game.img.includes('placeholder')));

        if (!game || !game.img || game.img.includes('placeholder')) {
            game = allGames.find(g => g.img && !g.img.includes('placeholder')) || allGames[0] || {};
        }

        showcaseImg.src = game.img || 'games/img/placeholder.png';
        showcaseImg.alt = game.title || 'Game';
        showcaseTitle.textContent = game.title || 'Untitled Game';

        document.getElementById('game-showcase').onclick = () => {
            if (!game.url) return;

            activeGameUrl = game.url;
            gameIframe.src = game.url;
            gameLoader.classList.add('active');
            gameLoader.querySelector('.main-message').textContent = `Loading ${game.title || 'game'}...`;
            showView('g');

            gameIframe.onload = () => gameLoader.classList.remove('active');

            if (gameVolumeToggle.checked) {
                setTimeout(() => {
                    try { gameIframe.contentWindow?.postMessage({type: 'mute', value: true}, '*'); } catch {}
                }, 1500);
            }
        };
    };

    const startShowcase = () => {
        clearInterval(showcaseInterval);
        updateShowcase();
        const speed = parseInt(showcaseSpeed.value) || 2000;
        showcaseInterval = setInterval(updateShowcase, speed);
    };

    const words = ['Freedom.', 'Beauty.', 'Peace.', 'Wonder.', 'Abundance.', 'Creativity.', 'Success.', 'Purpose.', 'Prosperity.'];
    let wordIndex = 0, charIndex = 0, isDeleting = false;

    const type = () => {
        const currentWord = words[wordIndex];
        gradientWord.textContent = isDeleting
            ? currentWord.substring(0, charIndex - 1)
            : currentWord.substring(0, charIndex + 1);

        charIndex += isDeleting ? -1 : 1;

        let typeSpeed = 120;
        if (!isDeleting && charIndex === currentWord.length) {
            typeSpeed = 2500;
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            wordIndex = (wordIndex + 1) % words.length;
            typeSpeed = 500;
        } else if (isDeleting) {
            typeSpeed /= 2;
        }

        setTimeout(type, typeSpeed);
    };
    type();

    class Particle {
        constructor() {
            this.x = Math.random() * particleCanvas.width;
            this.y = Math.random() * particleCanvas.height;
            this.radius = Math.random() * 1.5 + 0.5;
            this.velocity = {
                x: (Math.random() - 0.5) * 0.2,
                y: (Math.random() - 0.5) * 0.2
            };
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
        }
        update() {
            this.x += this.velocity.x;
            this.y += this.velocity.y;
            if (this.x < 0 || this.x > particleCanvas.width) this.velocity.x = -this.velocity.x;
            if (this.y < 0 || this.y > particleCanvas.height) this.velocity.y = -this.velocity.y;
        }
    }

    const initParticles = (count) => {
        particles = [];
        for (let i = 0; i < count; i++) particles.push(new Particle());
    };

const animateParticles = () => {
        if (document.hidden) {
            animationFrameId = requestAnimationFrame(animateParticles);
            return;
        }

        ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        particles.forEach((p1, i) => {
            particles.slice(i + 1).forEach(p2 => {
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 100) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(255, 255, 255, ${1 - dist / 100})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
            });
        });
        animationFrameId = requestAnimationFrame(animateParticles);
    };

    const toggleParticles = (enabled, count = 50) => {
        if (enabled) {
            particleCanvas.style.display = 'block';
            initParticles(count);
            animateParticles();
        } else {
            particleCanvas.style.display = 'none';
            cancelAnimationFrame(animationFrameId);
            particles = [];
        }
    };

    const applyTheme = (theme) => {
        body.setAttribute('data-theme', theme);
        localStorage.setItem('selectedTheme', theme);
        document.querySelectorAll('.theme-option').forEach(opt =>
            opt.classList.toggle('active', opt.dataset.theme === theme)
        );
    };

    const applyCloaking = () => {
        const title = localStorage.getItem('cloakTitle') || document.title;
        document.title = title;
        siteTitleInput.value = title;

        const favicon = localStorage.getItem('cloakFavicon');
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        if (favicon) {
            link.href = favicon;
            currentLogo.textContent = 'Custom';
        } else {
            currentLogo.textContent = 'Default';
        }
    };

    const loadSettings = () => {
        applyTheme(localStorage.getItem('selectedTheme') || 'dark');

        const particlesEnabled = localStorage.getItem('particlesEnabled') !== 'false';
        const particleCount = parseInt(localStorage.getItem('particleCount')) || 50;
        particlesToggle.checked = particlesEnabled;
        particleDensity.value = particleCount;
        particleDensityValue.textContent = particleCount;
        toggleParticles(particlesEnabled, particleCount);

        performanceToggle.checked = localStorage.getItem('performanceMode') === 'true';
        showcaseSpeed.value = localStorage.getItem('showcaseSpeed') || '2000';
        gameVolumeToggle.checked = localStorage.getItem('muteGameAudio') === 'true';

        panicToggle.checked = localStorage.getItem('panicEnabled') === 'true';
        panicOptions.classList.toggle('hidden', !panicToggle.checked);
        panicKeyInput.value = localStorage.getItem('panicKey') || '';
        panicUrl.value = localStorage.getItem('panicUrl') || 'https://docs.google.com';

        applyCloaking();
    };
    loadSettings();

    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', () => applyTheme(option.dataset.theme));
    });

    siteTitleInput.addEventListener('input', () => {
        const newTitle = siteTitleInput.value.trim() || 'Study Snap';
        document.title = newTitle;
        localStorage.setItem('cloakTitle', newTitle);
    });

    siteLogoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target.result;
            let link = document.querySelector("link[rel~='icon']") || document.createElement('link');
            link.rel = 'icon';
            link.href = dataUrl;
            document.head.appendChild(link);
            localStorage.setItem('cloakFavicon', dataUrl);
            currentLogo.textContent = 'Custom';
        };
        reader.readAsDataURL(file);
    });

    particlesToggle.addEventListener('change', () => {
        const enabled = particlesToggle.checked;
        toggleParticles(enabled, parseInt(particleDensity.value));
        localStorage.setItem('particlesEnabled', enabled);
    });

    particleDensity.addEventListener('input', (e) => {
        particleDensityValue.textContent = e.target.value;
        localStorage.setItem('particleCount', e.target.value);
        if (particlesToggle.checked) toggleParticles(true, parseInt(e.target.value));
    });

    performanceToggle.addEventListener('change', () => {
        const enabled = performanceToggle.checked;
        localStorage.setItem('performanceMode', enabled);
        if (enabled) {
            toggleParticles(false);
            body.classList.add('perf-mode');
        } else {
            body.classList.remove('perf-mode');
            const particlesOn = localStorage.getItem('particlesEnabled') !== 'false';
            const count = parseInt(localStorage.getItem('particleCount')) || 50;
            if (particlesOn) toggleParticles(true, count);
        }
    });

    showcaseSpeed.addEventListener('change', () => {
        localStorage.setItem('showcaseSpeed', showcaseSpeed.value);
        if (!views['home-page'].classList.contains('hidden-view')) startShowcase();
    });

    gameVolumeToggle.addEventListener('change', () => {
        localStorage.setItem('muteGameAudio', gameVolumeToggle.checked);
    });

    panicToggle.addEventListener('change', () => {
        panicOptions.classList.toggle('hidden', !panicToggle.checked);
        localStorage.setItem('panicEnabled', panicToggle.checked);
    });

    panicKeyInput.addEventListener('keydown', (e) => {
        if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
            panicKeyInput.value = e.key.toUpperCase();
            e.preventDefault();
        }
    });

    savePanicBtn.addEventListener('click', () => {
        const key = panicKeyInput.value.toUpperCase();
        if (key.match(/^[A-Z]$/)) {
            localStorage.setItem('panicKey', key);
            localStorage.setItem('panicUrl', panicUrl.value);
            panicStatus.classList.remove('hidden');
            setTimeout(() => panicStatus.classList.add('hidden'), 3000);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (localStorage.getItem('panicEnabled') === 'true') {
            const key = localStorage.getItem('panicKey');
            if (key && e.key.toUpperCase() === key) {
                window.location.href = localStorage.getItem('panicUrl') || 'https://docs.google.com';
            }
        }
    });

    const themeSelect = document.getElementById('theme-select');

    if (themeSelect) {
        const savedTheme = localStorage.getItem('selectedTheme') || 'dark';
        themeSelect.value = savedTheme;

        themeSelect.addEventListener('change', () => {
            const selectedTheme = themeSelect.value;
            applyTheme(selectedTheme);
        });
    }

    const openInAboutBlank = (sourceUrl) => {
        if (hasAboutBlankRun) return;
        hasAboutBlankRun = true;

        const title = document.title;
        const faviconLink = document.querySelector("link[rel*='icon']");
        const faviconHref = faviconLink ? faviconLink.href : '';

        const cloakedWindow = window.open('', '_blank');
        if (!cloakedWindow) {
            hasAboutBlankRun = false;
            alert('Popups are blocked! Please allow popups for this site.');
            return;
        }

        cloakedWindow.location.href = 'about:blank';
        cloakedWindow.document.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                ${faviconHref ? `<link rel="icon" href="${faviconHref}">` : ''}
                <style>body, html { margin:0; padding:0; height:100%; overflow:hidden; }</style>
            </head>
            <body>
                <iframe src="${sourceUrl}" frameborder="0" allowfullscreen
                    style="position:absolute; top:0; left:0; width:100%; height:100%; border:none;">
                </iframe>
            </body>
            </html>
        `);
        cloakedWindow.document.close();

        setTimeout(() => window.location.replace('https://clever.com/'), 10);
    };

    document.getElementById('home-about-blank-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        openInAboutBlank(window.location.href);
    });

    document.getElementById('export-settings-btn')?.addEventListener('click', () => {
        const data = { localStorage: { ...localStorage } };
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `studythemes-backup-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById('import-settings-input')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (!data.localStorage) throw new Error();
                localStorage.clear();
                Object.entries(data.localStorage).forEach(([k, v]) => localStorage.setItem(k, v));
                alert('Imported successfully! Reloading...');
                setTimeout(() => location.reload(), 1000);
            } catch {
                alert('Invalid file');
            }
        };
        reader.readAsText(file);
    });

    document.getElementById('reset-all-data-btn')?.addEventListener('click', () => {
        if (confirm('This will delete ALL saved data. Continue?')) {
            localStorage.clear();
            setTimeout(() => location.reload(), 500);
        }
    });

    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(button.dataset.tab + '-tab').classList.add('active');
        });
    });

    navButtons.forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));

    loadGamesFromJSON();

    showView('home-page');

    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menu-toggle');
    const menuClose = document.getElementById('menu-close');
    const mainContent = document.getElementById('main-content');

    menuToggle.addEventListener('click', () => {
        sidebar.classList.remove('-translate-x-full');
        sidebar.classList.add('translate-x-0');
        mainContent.classList.add('lg:ml-0');
    });

    menuClose.addEventListener('click', () => {
        sidebar.classList.remove('translate-x-0');
        sidebar.classList.add('-translate-x-full');
    });

    document.addEventListener('click', (e) => {
        if (window.innerWidth < 1024) {
            if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('translate-x-0');
                sidebar.classList.add('-translate-x-full');
            }
        }
    });
});
const overlay = document.getElementById('socialPopup'); 
const closeBtn = document.querySelector('.close-btn');

function closePopup() {
    if (!overlay) return;
    overlay.style.transition = "opacity 0.3s ease, visibility 0.3s";
    overlay.style.opacity = "0";
    overlay.style.visibility = "hidden";
    const content = overlay.querySelector('.popup-content');
    if (content) {
        content.style.transition = "transform 0.3s ease";
        content.style.transform = "scale(0.95)";
    }
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 300);
}
if (closeBtn) {
    closeBtn.onclick = closePopup;
}
window.onclick = (e) => {
    if (e.target === overlay) {
        closePopup();
    }
};
document.getElementById('g-view').addEventListener('hidden', () => {
    const iframe = document.getElementById('game-iframe');
    iframe.dataset.src = iframe.src;
    iframe.src = 'about:blank';
});

document.getElementById('g-view').addEventListener('show', () => {
    const iframe = document.getElementById('game-iframe');
    if (iframe.dataset.src) {
        iframe.src = iframe.dataset.src;
    }
});
const observerOptions = {
        root: null,
        rootMargin: '100px',
        threshold: 0.1
    };

    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.classList.add('loaded');
                    observer.unobserve(img);
                }
            }
        });
    }, observerOptions);

    function observeImages() {
        document.querySelectorAll('.lazy-game-img').forEach(img => imageObserver.observe(img));
    }