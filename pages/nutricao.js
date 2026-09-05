/**
 * NutriFit - Assistente Virtual (Alimentação • Treino • Resultados) - Front-end
 * Chat com painel lateral de conversas (projetos), estilo Claude.
 *
 * Contrato da API:
 *   POST /chat           -> { mensagem, conversaId? } / saída { response }
 *   POST /nova-conversa  -> { conversaId? } reinicia o histórico no servidor
 */

document.addEventListener('DOMContentLoaded', () => {
  // URL da API do back-end (detecção automática em desenvolvimento)
  const API_URL_CONFIG = '';
  const PORT_API = 3000;

  function resolveApiBaseUrl() {
    if (API_URL_CONFIG) return API_URL_CONFIG.replace(/\/$/, '');
    const { protocol, hostname, port, origin } = window.location;
    if (protocol === 'file:') return `http://localhost:${PORT_API}`;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    if (isLocal && port !== String(PORT_API)) return `${protocol}//${hostname}:${PORT_API}`;
    return origin;
  }
  const API_BASE_URL = resolveApiBaseUrl();

  const STORE_KEY = 'nutrifit_store_v1';
  const THEME_KEY = 'nutrifit_theme';

  const WELCOME = {
    role: 'assistant',
    content: 'Fala, campeão(ã)! Bora pra cima! 💪\nBem-vindo(a) à **NutriFit** — mais saúde, mais energia, mais vida! Posso montar sua **rotina diária**, seu treino ou sua dieta. Me conta seu objetivo (ganhar massa, emagrecer ou saúde) que eu já organizo o seu dia!',
    time: 'Agora',
  };

  // Estado: várias conversas (projetos), cada uma com seu histórico
  let store = { conversas: [], activeId: null };
  let isSending = false;

  // ---------- Elementos ----------
  const chatMessages = document.getElementById('chatMessages');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const btnSend = document.getElementById('btnSendMessage');
  const typingIndicator = document.getElementById('typingIndicator');
  const msgCounter = document.getElementById('msgCounter');
  const chipButtons = document.querySelectorAll('.chip-btn');
  const btnToggleTheme = document.getElementById('btnToggleTheme');
  const iconMoon = document.querySelector('.icon-moon');
  const iconSun = document.querySelector('.icon-sun');
  // Sidebar
  const appShell = document.querySelector('.app-shell');
  const listaConversas = document.getElementById('listaConversas');
  const btnNovaConversa = document.getElementById('btnNovaConversa');
  const btnNewChat = document.getElementById('btnNewChat');
  const searchConversas = document.getElementById('searchConversas');
  const btnToggleSidebar = document.getElementById('btnToggleSidebar');
  const btnCloseSidebar = document.getElementById('btnCloseSidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  let filtroBusca = '';

  // ========================================================
  // Utilidades
  // ========================================================
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function formatMessage(text) {
    let out = escapeHtml(text);
    out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, '$1<em>$2</em>');
    out = out.replace(/\n- /g, '<br>• ');
    out = out.replace(/\n• /g, '<br>• ');
    out = out.replace(/\n/g, '<br>');
    return out;
  }

  const nowTime = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const scrollToBottom = () => { if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight; };
  const genId = () => `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // ========================================================
  // Persistência do estado (LocalStorage)
  // ========================================================
  function novaConversaObj() {
    return { id: genId(), title: 'Nova conversa', messages: [{ ...WELCOME, time: 'Agora' }], updatedAt: Date.now() };
  }

  function saveStore() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
    catch (e) { console.warn('Falha ao salvar:', e); }
  }

  function loadStore() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (saved && Array.isArray(saved.conversas) && saved.conversas.length) {
        store = saved;
        if (!store.conversas.find(c => c.id === store.activeId)) store.activeId = store.conversas[0].id;
        return;
      }
    } catch (e) { console.warn('Falha ao ler estado:', e); }
    const c = novaConversaObj();
    store = { conversas: [c], activeId: c.id };
    saveStore();
  }

  const getActive = () => store.conversas.find(c => c.id === store.activeId);

  function tituloDaConversa(conv) {
    const primeiraUser = conv.messages.find(m => m.role === 'user');
    if (primeiraUser) {
      const t = primeiraUser.content.trim().replace(/\s+/g, ' ');
      return t.length > 34 ? t.slice(0, 34) + '…' : t;
    }
    return 'Nova conversa';
  }

  // ========================================================
  // Renderização das mensagens
  // ========================================================
  function renderMessage(msg) {
    const isUser = msg.role === 'user';
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${isUser ? 'message-user' : 'message-coach'}`;

    const copyBtn = isUser ? '' :
      `<button class="btn-copy" title="Copiar resposta" aria-label="Copiar resposta">
         <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
           <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
           <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
         </svg>
       </button>`;

    const avatar = isUser ? '🧑'
      : '<img src="logo-icon.png" alt="NutriFit" class="msg-logo" onerror="this.replaceWith(document.createTextNode(\'💪\'))">';

    wrapper.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-bubble">
        <div class="message-content">${isUser ? escapeHtml(msg.content) : formatMessage(msg.content)}</div>
        <div class="message-meta">
          <span class="message-time">${msg.time || nowTime()}</span>
          ${copyBtn}
        </div>
      </div>`;

    const btnCopy = wrapper.querySelector('.btn-copy');
    if (btnCopy) {
      btnCopy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(msg.content);
          btnCopy.classList.add('copied');
          setTimeout(() => btnCopy.classList.remove('copied'), 1200);
        } catch (e) { console.warn('Falha ao copiar:', e); }
      });
    }
    chatMessages.appendChild(wrapper);
  }

  function renderActive() {
    if (!chatMessages) return;
    chatMessages.innerHTML = '';
    const conv = getActive();
    if (conv) conv.messages.forEach(renderMessage);
    updateCounter();
    scrollToBottom();
  }

  function updateCounter() {
    if (!msgCounter) return;
    const conv = getActive();
    const n = conv ? conv.messages.length : 0;
    msgCounter.textContent = `${n} ${n === 1 ? 'msg' : 'msgs'}`;
  }

  // ========================================================
  // Painel lateral (lista de conversas)
  // ========================================================
  function renderSidebar() {
    if (!listaConversas) return;
    listaConversas.innerHTML = '';

    const ordenadas = [...store.conversas].sort((a, b) => b.updatedAt - a.updatedAt);
    const termo = filtroBusca.trim().toLowerCase();
    const filtradas = !termo ? ordenadas : ordenadas.filter(c =>
      tituloDaConversa(c).toLowerCase().includes(termo) ||
      c.messages.some(m => (m.content || '').toLowerCase().includes(termo))
    );

    if (!filtradas.length) {
      listaConversas.innerHTML = `<div class="lista-vazia">${termo ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa ainda.'}</div>`;
      return;
    }

    filtradas.forEach(conv => {
      const item = document.createElement('div');
      item.className = `conversa-item ${conv.id === store.activeId ? 'active' : ''}`;
      item.dataset.id = conv.id;
      item.innerHTML = `
        <span class="conversa-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </span>
        <span class="conversa-titulo">${escapeHtml(tituloDaConversa(conv))}</span>
        <button class="conversa-del" title="Excluir conversa" aria-label="Excluir conversa">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>`;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.conversa-del')) return;
        switchConversation(conv.id);
      });
      item.querySelector('.conversa-del').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteConversation(conv.id);
      });

      listaConversas.appendChild(item);
    });
  }

  function switchConversation(id) {
    if (id === store.activeId) { closeSidebar(); return; }
    store.activeId = id;
    saveStore();
    renderActive();
    renderSidebar();
    closeSidebar();
    if (chatInput) chatInput.focus();
  }

  function newConversation() {
    const c = novaConversaObj();
    store.conversas.unshift(c);
    store.activeId = c.id;
    saveStore();
    renderActive();
    renderSidebar();
    closeSidebar();
    if (chatInput) chatInput.focus();
  }

  async function deleteConversation(id) {
    const conv = store.conversas.find(c => c.id === id);
    if (!conv) return;
    if (!confirm(`Excluir a conversa "${tituloDaConversa(conv)}"?`)) return;

    // Limpa o histórico dessa conversa no servidor
    try {
      await fetch(`${API_BASE_URL}/nova-conversa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversaId: id }),
      });
    } catch (err) { console.warn('Erro ao limpar no servidor:', err); }

    store.conversas = store.conversas.filter(c => c.id !== id);
    if (!store.conversas.length) {
      const c = novaConversaObj();
      store.conversas.push(c);
      store.activeId = c.id;
    } else if (store.activeId === id) {
      store.activeId = store.conversas[0].id;
    }
    saveStore();
    renderActive();
    renderSidebar();
  }

  // ========================================================
  // Envio de mensagem
  // ========================================================
  async function handleSendMessage(messageText) {
    const text = (messageText || '').trim();
    if (!text || isSending) return;
    const conv = getActive();
    if (!conv) return;

    const userMsg = { role: 'user', content: text, time: nowTime() };
    conv.messages.push(userMsg);
    conv.updatedAt = Date.now();
    renderMessage(userMsg);
    updateCounter();
    if (chatInput) chatInput.value = '';
    renderSidebar(); // atualiza título/ordem
    saveStore();
    scrollToBottom();

    isSending = true;
    if (btnSend) btnSend.disabled = true;
    if (typingIndicator) typingIndicator.style.display = 'flex';
    scrollToBottom();

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: text, conversaId: conv.id }),
      });
      if (!response.ok) throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);

      const data = await response.json();
      const reply = data.response || 'Não consegui responder agora, guerreiro. Tenta de novo em instantes!';
      const botMsg = { role: 'assistant', content: reply, time: nowTime() };
      conv.messages.push(botMsg);
      conv.updatedAt = Date.now();
      renderMessage(botMsg);
    } catch (error) {
      console.error('Erro ao conectar com a API:', error);
      const errMsg = {
        role: 'assistant',
        content: '⚠️ Ops! Não consegui falar com o servidor da NutriFit. Verifique se o backend está rodando (`npm start` na pasta `src`) e tente novamente.',
        time: nowTime(),
      };
      conv.messages.push(errMsg);
      renderMessage(errMsg);
    } finally {
      isSending = false;
      if (btnSend) btnSend.disabled = false;
      if (typingIndicator) typingIndicator.style.display = 'none';
      updateCounter();
      saveStore();
      scrollToBottom();
      if (chatInput) chatInput.focus();
    }
  }

  // ========================================================
  // Tema Claro / Escuro
  // ========================================================
  function applyTheme(theme) {
    const dark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    if (iconMoon) iconMoon.style.display = dark ? 'none' : 'block';
    if (iconSun) iconSun.style.display = dark ? 'block' : 'none';
  }
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignora */ }
  }

  // ========================================================
  // Sidebar (abrir/fechar no celular)
  // ========================================================
  function openSidebar() {
    if (appShell) appShell.classList.add('sidebar-open');
    if (sidebarOverlay) sidebarOverlay.hidden = false;
  }
  function closeSidebar() {
    if (appShell) appShell.classList.remove('sidebar-open');
    if (sidebarOverlay) sidebarOverlay.hidden = true;
  }

  // ========================================================
  // Eventos
  // ========================================================
  if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (chatInput) handleSendMessage(chatInput.value);
    });
  }
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(chatInput.value); }
    });
  }
  chipButtons.forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.dataset.prompt;
      if (prompt) handleSendMessage(prompt);
    });
  });

  if (btnNovaConversa) btnNovaConversa.addEventListener('click', newConversation);
  if (btnNewChat) btnNewChat.addEventListener('click', newConversation);
  if (btnToggleTheme) btnToggleTheme.addEventListener('click', toggleTheme);
  if (btnToggleSidebar) btnToggleSidebar.addEventListener('click', openSidebar);
  if (btnCloseSidebar) btnCloseSidebar.addEventListener('click', closeSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);
  if (searchConversas) searchConversas.addEventListener('input', (e) => {
    filtroBusca = e.target.value || '';
    renderSidebar();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSidebar();
  });

  // ========================================================
  // Inicialização
  // ========================================================
  (function init() {
    let theme = 'light';
    try { theme = localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { /* ignora */ }
    applyTheme(theme);

    loadStore();
    renderActive();
    renderSidebar();
    if (chatInput) chatInput.focus();
  })();
});
