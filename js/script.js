window.addEventListener('load', () => {
    const views = {
        'home-page': document.getElementById('home-page-view'),
        'games': document.getElementById('games-view'),
        'game': document.getElementById('game-view'),
        'settings': document.getElementById('settings-view'),
        'favorites': document.getElementById('favorites-view'),
        'recent': document.getElementById('recent-view')
    };

    const navButtons = document.querySelectorAll('.nav-button');
    const gameIframe = document.getElementById('game-iframe');
    const gameLoader = document.getElementById('game-loader');
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
        showcaseImg.src = box.dataset.img;
        showcaseTitle.textContent = box.dataset.title;
        showcase.onclick = () => box.click();
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
        for (let view in views) views[view].classList.add('hidden-view');
        views[name].classList.remove('hidden-view');
        navButtons.forEach(btn => {
            btn.classList.remove('bg-purple-600', 'text-white');
            btn.classList.add('text-gray-300', 'hover:bg-gray-700', 'hover:text-white');
            if (btn.dataset.view === name || (name === 'game' && btn.dataset.view === 'games')) {
                btn.classList.add('bg-purple-600', 'text-white');
                btn.classList.remove('text-gray-300', 'hover:bg-gray-700', 'hover:text-white');
            }
        });
        if (name === 'home-page' || name === 'game') startShootingStars();
        else stopShootingStars();
        if (name === 'home-page') startShowcase();
        else clearInterval(showcaseInterval);
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
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.radius = Math.random() * 1.5 + 0.5;
            this.color = 'rgba(255, 255, 255, 0.8)';
            this.velocity = { x: (Math.random() - 0.5) * 0.2, y: (Math.random() - 0.5) * 0.2 };
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
        }
        update() {
            this.x += this.velocity.x;
            this.y += this.velocity.y;
            if (this.x < 0 || this.x > canvas.width) this.velocity.x = -this.velocity.x;
            if (this.y < 0 || this.y > canvas.height) this.velocity.y = -this.velocity.y;
        }
    }

    const initParticles = count => {
        particles = [];
        for (let i = 0; i < count; i++) particles.push(new Particle());
    };

    const animateParticles = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.update();
            p.draw();
            particles.forEach(q => {
                if (p === q) return;
                const dx = p.x - q.x;
                const dy = p.y - q.y;
                const dist = Math.hypot(dx, dy);
                if (dist < 100) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(139, 92, 246, ${1 - dist / 100})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(q.x, q.y);
                    ctx.stroke();
                }
            });
        });
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
        localStorage.setItem('particlesEnabled', enabled);
        localStorage.setItem('particleCount', count);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const savedParticles = localStorage.getItem('particlesEnabled') !== 'false';
    const savedCount = parseInt(localStorage.getItem('particleCount')) || 50;
    particlesToggle.checked = savedParticles;
    particleDensity.value = savedCount;
    particleDensityValue.textContent = savedCount;
    toggleParticles(savedParticles, savedCount);

    particleDensity.addEventListener('input', e => {
        particleDensityValue.textContent = e.target.value;
        if (particlesToggle.checked) toggleParticles(true, e.target.value);
    });

    particlesToggle.addEventListener('change', e => toggleParticles(e.target.checked, particleDensity.value));

    const savedVolume = localStorage.getItem('gameVolumeMuted') === 'true';
    gameVolumeToggle.checked = savedVolume;
    gameIframe.volume = savedVolume ? 0 : 1;
    gameVolumeToggle.addEventListener('change', e => {
        gameIframe.volume = e.target.checked ? 0 : 1;
        localStorage.setItem('gameVolumeMuted', e.target.checked);
    });

    const savedPerf = localStorage.getItem('performanceMode') === 'true';
    performanceToggle.checked = savedPerf;
    if (savedPerf) {
        toggleParticles(false, 10);
        stopShootingStars();
        showcaseSpeed.value = '5000';
    }
    performanceToggle.addEventListener('change', e => {
        localStorage.setItem('performanceMode', e.target.checked);
        if (e.target.checked) {
            toggleParticles(false, 10);
            stopShootingStars();
            showcaseSpeed.value = '5000';
        } else {
            toggleParticles(particlesToggle.checked, particleDensity.value);
            if (!views['home-page'].classList.contains('hidden-view')) startShootingStars();
        }
    });

    const savedSpeed = localStorage.getItem('showcaseSpeed') || '2000';
    showcaseSpeed.value = savedSpeed;
    showcaseSpeed.addEventListener('change', e => {
        clearInterval(showcaseInterval);
        if (!views['home-page'].classList.contains('hidden-view')) startShowcase();
        localStorage.setItem('showcaseSpeed', e.target.value);
    });

    navButtons.forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));

    const favoritesKey = 'impGamesFavs';
    const recentKey = 'impGamesRecent';
    let favorites = JSON.parse(localStorage.getItem(favoritesKey)) || [];
    let recent = JSON.parse(localStorage.getItem(recentKey)) || [];

    const saveFavs = () => localStorage.setItem(favoritesKey, JSON.stringify(favorites));
    const saveRecent = () => localStorage.setItem(recentKey, JSON.stringify(recent.slice(0,50)));

    const isFavorited = url => favorites.includes(url);

    const toggleFavorite = (url, btn) => {
        const i = favorites.indexOf(url);
        if (i === -1) {
            favorites.push(url);
            btn.classList.add('favorited');
            btn.innerHTML = '<i class="fas fa-heart"></i>';
        } else {
            favorites.splice(i, 1);
            btn.classList.remove('favorited');
            btn.innerHTML = '<i class="far fa-heart"></i>';
        }
        saveFavs();
        if (!views['favorites'].classList.contains('hidden-view')) renderFavorites();
    };

    const addRecent = (url, title, img) => {
        recent = recent.filter(g => g.url !== url);
        recent.unshift({url, title, img});
        saveRecent();
        if (!views['recent'].classList.contains('hidden-view')) renderRecent();
    };

    const createGameBox = game => {
        const box = document.createElement('div');
        box.className = 'game-box';
        box.dataset.url = game.url;
        box.dataset.title = game.title;
        box.dataset.img = game.img;
        box.innerHTML = `
            <img src="${game.img}" loading="lazy">
            <div class="game-title">${game.title}</div>
            <div class="favorite-btn"><i class="${isFavorited(game.url)?'fas':'far'} fa-heart"></i></div>
        `;
        const favBtn = box.querySelector('.favorite-btn');
        favBtn.onclick = e => {
            e.stopPropagation();
            toggleFavorite(game.url, favBtn);
        };
        box.onclick = e => {
            if (e.target.closest('.favorite-btn')) return;
            handleGameClick(game.url);
            addRecent(game.url, game.title, game.img);
        };
        return box;
    };

    const renderFavorites = () => {
        const wrapper = document.getElementById('favorites-wrapper');
        wrapper.innerHTML = '';
        const favGames = [...document.querySelectorAll('.game-box')].filter(b => favorites.includes(b.dataset.url));
        if (!favGames.length) {
            wrapper.innerHTML = '<p class="text-center text-gray-400 py-8">No favorites yet</p>';
            return;
        }
        let row;
        favGames.forEach((orig, i) => {
            if (i % 5 === 0) {
                row = document.createElement('div');
                row.className = 'five-box-row';
                wrapper.appendChild(row);
            }
            const data = {url: orig.dataset.url, title: orig.dataset.title, img: orig.dataset.img};
            row.appendChild(createGameBox(data));
        });
    };

    const renderRecent = () => {
        const wrapper = document.getElementById('recent-wrapper');
        wrapper.innerHTML = '';
        if (!recent.length) {
            wrapper.innerHTML = '<p class="text-center text-gray-400 py-8">No recently played games</p>';
            return;
        }
        let row;
        recent.forEach((game, i) => {
            if (i % 5 === 0) {
                row = document.createElement('div');
                row.className = 'five-box-row';
                wrapper.appendChild(row);
            }
            row.appendChild(createGameBox(game));
        });
    };

    const handleGameClick = url => {
        if (!url) return;
        if (url.startsWith('https://iisilly1059.github.io') || !url.startsWith('http')) {
            gameLoader.classList.add('active');
            gameIframe.src = url;
            showView('game');
            setTimeout(() => gameLoader.classList.remove('active'), 10000);
        } else {
            window.open(url, '_blank');
        }
    };

    document.querySelectorAll('.game-box').forEach(box => {
        const favBtn = box.querySelector('.favorite-btn');
        if (!favBtn) {
            const btn = document.createElement('div');
            btn.className = 'favorite-btn';
            btn.innerHTML = `<i class="${isFavorited(box.dataset.url)?'fas':'far'} fa-heart"></i>`;
            if (isFavorited(box.dataset.url)) btn.classList.add('favorited');
            btn.onclick = e => {
                e.stopPropagation();
                toggleFavorite(box.dataset.url, btn);
            };
            box.appendChild(btn);
        } else {
            favBtn.onclick = e => {
                e.stopPropagation();
                toggleFavorite(box.dataset.url, favBtn);
            };
            if (isFavorited(box.dataset.url)) favBtn.classList.add('favorited');
        }
        box.onclick = e => {
            if (e.target.closest('.favorite-btn')) return;
            handleGameClick(box.dataset.url);
            addRecent(box.dataset.url, box.dataset.title, box.dataset.img);
        };
    });

    document.getElementById('fullscreen-btn-game').addEventListener('click', () => {
        if (gameIframe.requestFullscreen) gameIframe.requestFullscreen();
        else if (gameIframe.webkitRequestFullscreen) gameIframe.webkitRequestFullscreen();
        else if (gameIframe.msRequestFullscreen) gameIframe.msRequestFullscreen();
    });

    const themeOptions = document.querySelectorAll('.theme-option');
    const applyTheme = theme => {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('selectedTheme', theme);
        themeOptions.forEach(o => o.classList.toggle('active', o.dataset.theme === theme));
    };
    themeOptions.forEach(o => o.addEventListener('click', () => applyTheme(o.dataset.theme)));
    applyTheme(localStorage.getItem('selectedTheme') || 'dark');

    const filterGames = term => {
        const lower = term.toLowerCase();
        gameBoxWrapper.innerHTML = '';
        let row = null;
        let count = 0;
        gameBoxes.forEach(box => {
            if (!term || box.dataset.title.toLowerCase().includes(lower)) {
                if (count % 5 === 0) {
                    row = document.createElement('div');
                    row.className = 'five-box-row';
                    gameBoxWrapper.appendChild(row);
                }
                const clone = box.cloneNode(true);
                clone.onclick = e => {
                    if (e.target.closest('.favorite-btn')) return;
                    handleGameClick(clone.dataset.url);
                    addRecent(clone.dataset.url, clone.dataset.title, clone.dataset.img);
                };
                clone.querySelector('.favorite-btn')?.addEventListener('click', ev => {
                    ev.stopPropagation();
                    toggleFavorite(clone.dataset.url, ev.target.closest('.favorite-btn'));
                });
                row.appendChild(clone);
                count++;
            }
        });
    };
    searchInput.addEventListener('input', e => filterGames(e.target.value));

    document.querySelectorAll('[data-view="favorites"], [data-view="recent"]').forEach(b => {
        b.addEventListener('click', () => {
            showView(b.dataset.view === 'favorites' ? 'favorites' : 'recent');
            if (b.dataset.view === 'favorites') renderFavorites();
            if (b.dataset.view === 'recent') renderRecent();
        });
    });

    document.getElementById('favorites-search')?.addEventListener('input', e => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('#favorites-wrapper .game-box').forEach(b => {
            b.style.display = b.dataset.title.toLowerCase().includes(term) ? '' : 'none';
        });
    });

    document.getElementById('recent-search')?.addEventListener('input', e => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('#recent-wrapper .game-box').forEach(b => {
            b.style.display = b.dataset.title.toLowerCase().includes(term) ? '' : 'none';
        });
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

    document.addEventListener('keydown', e => {
        if (panicToggle?.checked && panicKey && e.key.toUpperCase() === panicKey) {
            window.location.replace(panicURL);
        }
    });

    const loadSettings = () => {
        panicToggle.checked = localStorage.getItem('panicEnabled') === 'true';
        panicOptions.classList.toggle('hidden', !panicToggle.checked);
        panicKey = localStorage.getItem('panicKey') || null;
        panicKeyInput.value = panicKey ? `Key: ${panicKey}` : '';
        panicURL = localStorage.getItem('panicURL') || 'https://docs.google.com';
        panicUrlInput.value = panicURL;

        const title = localStorage.getItem('siteTitle');
        if (title) {
            document.title = title;
            siteTitleInput.value = title;
        }

        const favicon = localStorage.getItem('siteFavicon');
        if (favicon) {
            let link = document.querySelector("link[rel*='icon']") || document.createElement('link');
            link.rel = 'shortcut icon';
            link.href = favicon;
            document.head.appendChild(link);
            currentLogoSpan.textContent = 'Custom';
        }
    };

    const saveSettings = () => {
        localStorage.setItem('panicEnabled', panicToggle.checked);
        if (panicKey) {
            localStorage.setItem('panicKey', panicKey);
            localStorage.setItem('panicURL', panicUrlInput.value || 'https://docs.google.com');
            panicURL = panicUrlInput.value || 'https://docs.google.com';
        }
        const title = siteTitleInput.value.trim();
        if (title) {
            document.title = title;
            localStorage.setItem('siteTitle', title);
        } else {
            document.title = "Imp Games";
            localStorage.removeItem('siteTitle');
        }
        panicStatus.classList.remove('hidden');
        setTimeout(() => panicStatus.classList.add('hidden'), 2000);
    };

    const openAboutBlank = () => {
        const win = window.open('about:blank', '_blank');
        if (win) {
            const favicon = document.querySelector("link[rel*='icon']")?.href || '';
            win.document.write(`
                <html>
                    <head><title>${document.title}</title><link rel="icon" href="${favicon}"></head>
                    <body style="margin:0">
                        <iframe style="position:fixed;top:0;left:0;width:100%;height:100%;border:none" src="${location.href}"></iframe>
                    </body>
                </html>
            `);
        }
    };

    panicToggle.addEventListener('change', e => {
        panicOptions.classList.toggle('hidden', !e.target.checked);
        localStorage.setItem('panicEnabled', e.target.checked);
    });

    panicKeyInput.addEventListener('focus', () => {
        panicKeyInput.value = 'Press key...';
        const handler = e => {
            e.preventDefault();
            if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
                panicKey = e.key.toUpperCase();
                panicKeyInput.value = `Key: ${panicKey}`;
            }
            panicKeyInput.removeEventListener('keydown', handler);
        };
        panicKeyInput.addEventListener('keydown', handler);
    });

    savePanicBtn.addEventListener('click', saveSettings);
    siteTitleInput.addEventListener('input', saveSettings);

    siteLogoInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = ev => {
                localStorage.setItem('siteFavicon', ev.target.result);
                loadSettings();
            };
            reader.readAsDataURL(file);
        }
    });

    openAboutBlankBtn.addEventListener('click', openAboutBlank);
    homeAboutBlankBtn.addEventListener('click', openAboutBlank);

    resetSettingsBtn.addEventListener('click', () => {
        if (confirm('Reset all settings?')) {
            localStorage.clear();
            location.reload();
        }
    });

    tabButtons.forEach(btn => btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab + '-tab').classList.add('active');
    }));

    loadSettings();
    showView('home-page');
    renderFavorites();
    renderRecent();
});
