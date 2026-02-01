document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.getElementById('hamburger');
    const sidebar = document.getElementById('sidebar');
    const sidebarClose = document.getElementById('sidebarClose');
    const overlay = document.getElementById('sidebarOverlay');

    function openSidebar() {
        sidebar.classList.add('open');
        hamburger.classList.add('hidden');
        overlay.classList.add('active');
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        hamburger.classList.remove('hidden');
        overlay.classList.remove('active');
    }

    if (hamburger) hamburger.addEventListener('click', openSidebar);
    if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
    if (overlay) overlay.addEventListener('click', closeSidebar);
});

const API_URL = '/api/chat';

let chats = JSON.parse(localStorage.getItem('chats')) || [];
let currentChatId = localStorage.getItem('currentChatId') || null;
let settings = JSON.parse(localStorage.getItem('settings')) || {
    model: 'llama-3.3-70b-versatile',
    thinkingMode: false,
    temperature: 0.7
};

const elements = {
    chatList: document.getElementById('chatList'),
    chatMessages: document.getElementById('chatMessages'),
    chatInput: document.getElementById('chatInput'),
    sendBtn: document.getElementById('sendBtn'),
    newChatBtn: document.getElementById('newChatBtn'),
    currentModelBadge: document.getElementById('currentModelBadge')
};

init();
createParticles();
updateStats();

function createParticles() {
    const particlesContainer = document.createElement('div');
    particlesContainer.className = 'particles';
    document.body.appendChild(particlesContainer);
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 20 + 's';
        particle.style.animationDuration = (15 + Math.random() * 10) + 's';
        particlesContainer.appendChild(particle);
    }
}

function updateStats() {
    const totalChats = chats.length;
    const totalMessages = chats.reduce((sum, chat) => sum + chat.messages.length, 0);
    const statsHTML = `
        <div class="footer-stats">
            <div class="stat-item">
                <span class="stat-value">${totalChats}</span>
                <span>Chats</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${totalMessages}</span>
                <span>Messages</span>
            </div>
        </div>
    `;
    const footer = document.querySelector('.sidebar-footer');
    if (footer) {
        footer.innerHTML = statsHTML;
    }
}

function init() {
    if (chats.length === 0) {
        createNewChat();
    } else {
        if (!currentChatId || !chats.find(c => c.id === currentChatId)) {
            currentChatId = chats[0].id;
        }
        renderChatList();
        renderMessages();
    }
    setupListeners();
}

function setupListeners() {
    elements.sendBtn.addEventListener('click', sendMessage);
    elements.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    elements.chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
    elements.newChatBtn.addEventListener('click', createNewChat);

    const attachBtn = document.querySelector('.attach-btn');
    if (attachBtn) {
        attachBtn.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*,.pdf,.doc,.docx,.txt';
            input.onchange = handleFileUpload;
            input.click();
        });
    }
}

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
        const base64 = event.target.result;
        if (file.type.startsWith('image/')) {
            elements.chatInput.value = elements.chatInput.value || 'What do you see in this image?';
            elements.chatInput.dataset.image = base64;
            const preview = document.createElement('div');
            preview.className = 'image-preview';
            preview.innerHTML = `
                <img src="${base64}" style="max-width: 100px; border-radius: 8px;">
                <button onclick="this.parentElement.remove(); delete elements.chatInput.dataset.image;" style="background: #ff4444; border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer;">×</button>
            `;
            const inputContainer = document.querySelector('.input-container');
            inputContainer.insertBefore(preview, inputContainer.firstChild);
        } else {
            elements.chatInput.value = `Analyze this ${file.type} file: ${file.name}`;
        }
    };
    reader.readAsDataURL(file);
}

function createNewChat() {
    const chat = {
        id: Date.now().toString(),
        title: 'New chat',
        messages: [],
        createdAt: Date.now()
    };
    chats.unshift(chat);
    currentChatId = chat.id;
    saveChats();
    renderChatList();
    renderMessages();
    updateStats();
    elements.chatInput.focus();
}

function renderChatList() {
    elements.chatList.innerHTML = chats.map(chat => `
        <div class="chat-item ${chat.id === currentChatId ? 'active' : ''}" onclick="switchChat('${chat.id}')">
            <span class="chat-item-text">${chat.title}</span>
            <span class="chat-delete" onclick="event.stopPropagation(); deleteChat('${chat.id}')">×</span>
        </div>
    `).join('');
}

function switchChat(chatId) {
    currentChatId = chatId;
    localStorage.setItem('currentChatId', chatId);
    renderChatList();
    renderMessages();
}

function deleteChat(chatId) {
    if (chats.length === 1) {
        if (!confirm('Delete your only chat? A new one will be created.')) return;
    }
    chats = chats.filter(c => c.id !== chatId);
    if (currentChatId === chatId) {
        if (chats.length > 0) {
            currentChatId = chats[0].id;
        } else {
            createNewChat();
            return;
        }
        localStorage.setItem('currentChatId', currentChatId);
    }
    saveChats();
    renderChatList();
    renderMessages();
    updateStats();
}

function getCurrentChat() {
    return chats.find(c => c.id === currentChatId);
}

function renderMessages() {
    const chat = getCurrentChat();
    if (!chat || chat.messages.length === 0) {
        elements.chatMessages.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle-icon lucide-message-circle"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg></div>
                <div class="empty-title">What can I help you with?</div>
                <div class="empty-text">Choose a suggestion or ask anything</div>
                <div class="suggestions">
                    <div class="suggestion-card" onclick="fillPrompt('Help me organize my calendar')">
                        <div class="suggestion-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar-icon lucide-calendar"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg></div>
                        <div class="suggestion-text">Help me organize my calendar</div>
                    </div>
                    <div class="suggestion-card" onclick="fillPrompt('Write a creative story about time travel')">
                        <div class="suggestion-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-text-icon lucide-book-text"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/><path d="M8 11h8"/><path d="M8 7h6"/></svg></div>
                        <div class="suggestion-text">Write a creative story about time travel</div>
                    </div>
                    <div class="suggestion-card" onclick="fillPrompt('Plan a workout routine for beginners')">
                        <div class="suggestion-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-biceps-flexed-icon lucide-biceps-flexed"><path d="M12.409 13.017A5 5 0 0 1 22 15c0 3.866-4 7-9 7-4.077 0-8.153-.82-10.371-2.462-.426-.316-.631-.832-.62-1.362C2.118 12.723 2.627 2 10 2a3 3 0 0 1 3 3 2 2 0 0 1-2 2c-1.105 0-1.64-.444-2-1"/><path d="M15 14a5 5 0 0 0-7.584 2"/><path d="M9.964 6.825C8.019 7.977 9.5 13 8 15"/></svg></div>
                        <div class="suggestion-text">Plan a workout routine for beginners</div>
                    </div>
                </div>
            </div>
        `;
        return;
    }
    const messagesHtml = chat.messages.map((msg) => `
        <div class="message-wrapper ${msg.role}">
            <div class="message-bubble">${formatText(msg.content)}</div>
        </div>
    `).join('');
    elements.chatMessages.innerHTML = `<div class="message-container">${messagesHtml}</div>`;
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function formatText(text) {
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    const paragraphs = text.split('\n\n');
    return paragraphs.map(p => {
        if (p.startsWith('<pre>')) return p;
        return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('');
}

function addMessage(role, content) {
    const chat = getCurrentChat();
    chat.messages.push({ role, content, timestamp: Date.now() });
    if (chat.messages.length === 2 && role === 'user') {
        chat.title = content.substring(0, 35) + (content.length > 35 ? '...' : '');
        renderChatList();
    }
    saveChats();
    updateStats();
}

function showThinking() {
    const thinkingHtml = `
        <div class="message-wrapper assistant" id="thinking-msg">
            <div class="message-bubble">
                ${settings.thinkingMode ? '<div class="thinking-indicator"><div class="thinking-spinner"></div>Thinking...</div>' : ''}
                <div class="typing-dots"><span></span><span></span><span></span></div>
            </div>
        </div>
    `;
    const container = elements.chatMessages.querySelector('.message-container') || document.createElement('div');
    container.className = 'message-container';
    container.innerHTML += thinkingHtml;
    if (!elements.chatMessages.querySelector('.message-container')) {
        elements.chatMessages.appendChild(container);
    }
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function hideThinking() {
    const thinking = document.getElementById('thinking-msg');
    if (thinking) thinking.remove();
}

async function sendMessage() {
    const text = elements.chatInput.value.trim();
    if (!text) return;
    const image = elements.chatInput.dataset.image;
    
    const currentChat = getCurrentChat();
    addMessage('user', text);
    renderMessages();
    
    elements.chatInput.value = '';
    elements.chatInput.style.height = 'auto';
    delete elements.chatInput.dataset.image;
    const preview = document.querySelector('.image-preview');
    if (preview) preview.remove();
    elements.sendBtn.disabled = true;
    showThinking();
    
    try {
        // MEMORY INTEGRATION: Send the history so the AI remembers context
        const history = currentChat.messages.slice(-10).map(m => {
            return `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`;
        }).join('\n\n');

        const body = { message: history };
        if (image) body.image = image;
        
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        hideThinking();
        if (data.response) {
            addMessage('assistant', data.response);
            renderMessages();
        } else {
            addMessage('assistant', 'Something went wrong. Please try again.');
            renderMessages();
        }
    } catch (err) {
        hideThinking();
        addMessage('assistant', 'Connection error. Please check your connection.');
        renderMessages();
    }
    elements.sendBtn.disabled = false;
    elements.chatInput.focus();
}

function saveChats() {
    localStorage.setItem('chats', JSON.stringify(chats));
}

function saveSettings() {
    localStorage.setItem('settings', JSON.stringify(settings));
}

window.fillPrompt = function(text) {
    elements.chatInput.value = text;
    elements.chatInput.focus();
};

window.clearAllChats = function() {
    if (confirm('Delete all conversations? This cannot be undone.')) {
        chats = [];
        currentChatId = null;
        localStorage.removeItem('chats');
        localStorage.removeItem('currentChatId');
        createNewChat();
    }
};