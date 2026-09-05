/**
 * NutriFit - Assistente Virtual (Alimentação • Treino • Resultados) - Front-end
 * Comunicação com a API Node.js/Express via Fetch API.
 *
 * Contrato da API:
 *   POST /chat           -> entrada { mensagem } / saída { response }
 *   POST /nova-conversa  -> reinicia o histórico no servidor
 */

document.addEventListener('DOMContentLoaded', () => {
  // ⚙️ URL da API do back-end.
  // - Deixe vazio ('') para detectar automaticamente (recomendado em desenvolvimento).
  // - Ao hospedar o back-end em outro endereço, coloque a URL aqui.
  //   Ex.: 'https://minha-api.onrender.com'
  const API_URL_CONFIG = '';

  const PORT_API = 3000; // porta do servidor Node/Express

  // Detecta automaticamente onde a API está rodando:
  // - Servido pelo próprio Express (mesma porta) -> usa a origem atual.
  // - Aberto via arquivo ou LiveServer (ex.: porta 5500) -> aponta para localhost:PORT_API.
  function resolveApiBaseUrl() {
    if (API_URL_CONFIG) return API_URL_CONFIG.replace(/\/$/, '');

    const { protocol, hostname, port, origin } = window.location;

    // Aberto direto do arquivo (file://)
    if (protocol === 'file:') return `http://localhost:${PORT_API}`;

    // Ambiente local (localhost/127.0.0.1) em porta diferente da API (ex.: LiveServer)
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    if (isLocal && port !== String(PORT_API)) {
      return `${protocol}//${hostname}:${PORT_API}`;
    }

    // Caso padrão: front-end e API na mesma origem
    return origin;
  }

  const API_BASE_URL = resolveApiBaseUrl();

  const STORAGE_KEY = 'nutrifit_chat_v1';
  const THEME_KEY = 'nutrifit_theme';

  // Mensagem de boas-vindas exibida no início e após "Nova Conversa"
  const WELCOME = {
    role: 'assistant',
    content: 'Fala, campeão(ã)! Bora pra cima! 💪\nBem-vindo(a) à **NutriFit** — mais saúde, mais energia, mais vida! Posso montar sua **rotina diária**, seu treino ou sua dieta. Me conta seu objetivo (ganhar massa, emagrecer ou saúde) que eu já organizo o seu dia!',
    time: 'Agora',
  };

  // Histórico da conversa (mantido durante toda a sessão)
  let messages = [];
  let isSending = false;

  // Elementos do DOM
  const chatMessages = document.getElementById('chatMessages');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const btnSend = document.getElementById('btnSendMessage');
  const btnNewChat = document.getElementById('btnNewChat');
  const btnToggleTheme = document.getElementById('btnToggleTheme');
  const typingIndicator = document.getElementById('typingIndicator');
  const msgCounter = document.getElementById('msgCounter');
  const chipButtons = document.querySelectorAll('.chip-btn');
  const iconMoon = document.querySelector('.icon-moon');
  const iconSun = document.querySelector('.icon-sun');

  // ========================================================
  // Utilidades
  // ========================================================
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Markdown simples: **negrito**, *itálico*, bullets e quebras de linha
  function formatMessage(text) {
    let out = escapeHtml(text);
    out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, '$1<em>$2</em>');
    out = out.replace(/\n- /g, '<br>• ');
    out = out.replace(/\n• /g, '<br>• ');
    out = out.replace(/\n/g, '<br>');
    return out;
  }

  function nowTime() {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function scrollToBottom() {
    if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function updateCounter() {
    if (!msgCounter) return;
    const n = messages.filter(m => m.role !== 'system').length;
    msgCounter.textContent = `${n} ${n === 1 ? 'msg' : 'msgs'}`;
  }

  // ========================================================
  // Persistência (LocalStorage - bônus)
  // ========================================================
  function saveHistory() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.warn('Não foi possível salvar no localStorage:', e);
    }
  }

  function loadHistory() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (e) {
      console.warn('Não foi possível ler o localStorage:', e);
    }
    return [{ ...WELCOME }];
  }

  // ========================================================
  // Renderização das mensagens
  // ========================================================
  function renderMessage(msg) {
    const isUser = msg.role === 'user';
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${isUser ? 'message-user' : 'message-coach'}`;

    const copyBtn = isUser
      ? ''
      : `<button class="btn-copy" title="Copiar resposta" aria-label="Copiar resposta">
           <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
             <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
           </svg>
         </button>`;

    const avatar = isUser
      ? '🧑'
      : '<img src="logo-icon.png" alt="NutriFit" class="msg-logo" onerror="this.replaceWith(document.createTextNode(\'💪\'))">';

    wrapper.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-bubble">
        <div class="message-content">${isUser ? escapeHtml(msg.content) : formatMessage(msg.content)}</div>
        <div class="message-meta">
          <span class="message-time">${msg.time || nowTime()}</span>
          ${copyBtn}
        </div>
      </div>
    `;

    // Botão copiar (bônus)
    const btnCopy = wrapper.querySelector('.btn-copy');
    if (btnCopy) {
      btnCopy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(msg.content);
          btnCopy.classList.add('copied');
          setTimeout(() => btnCopy.classList.remove('copied'), 1200);
        } catch (e) {
          console.warn('Falha ao copiar:', e);
        }
      });
    }

    chatMessages.appendChild(wrapper);
  }

  function renderAll() {
    if (!chatMessages) return;
    chatMessages.innerHTML = '';
    messages.forEach(renderMessage);
    updateCounter();
    scrollToBottom();
  }

  // ========================================================
  // Envio de mensagem (Fetch)
  // ========================================================
  async function handleSendMessage(messageText) {
    const text = (messageText || '').trim();
    if (!text || isSending) return;

    // 1. Exibe e armazena a mensagem do usuário
    const userMsg = { role: 'user', content: text, time: nowTime() };
    messages.push(userMsg);
    renderMessage(userMsg);
    updateCounter();
    saveHistory();
    scrollToBottom();

    if (chatInput) chatInput.value = '';

    // 2. Indicador de carregamento
    isSending = true;
    if (btnSend) btnSend.disabled = true;
    if (typingIndicator) typingIndicator.style.display = 'flex';
    scrollToBottom();

    try {
      // 3. Envia para a API via Fetch (contrato: { mensagem } -> { response })
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: text }),
      });

      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const reply = data.response || 'Não consegui responder agora, guerreiro. Tenta de novo em instantes!';

      // 4. Exibe e armazena a resposta da IA
      const botMsg = { role: 'assistant', content: reply, time: nowTime() };
      messages.push(botMsg);
      renderMessage(botMsg);
    } catch (error) {
      // 6. Tratamento de erros - mensagem amigável
      console.error('Erro ao conectar com a API:', error);
      const errMsg = {
        role: 'assistant',
        content: '⚠️ Ops! Não consegui falar com o servidor da NutriFit. Verifique se o backend está rodando (`npm start` na pasta `src`) e tente novamente.',
        time: nowTime(),
      };
      messages.push(errMsg);
      renderMessage(errMsg);
    } finally {
      isSending = false;
      if (btnSend) btnSend.disabled = false;
      if (typingIndicator) typingIndicator.style.display = 'none';
      updateCounter();
      saveHistory();
      scrollToBottom();
      if (chatInput) chatInput.focus();
    }
  }

  // ========================================================
  // Nova Conversa (limpa mensagens e reinicia histórico)
  // ========================================================
  async function newConversation() {
    if (!confirm('Deseja iniciar uma nova conversa com a NutriFit?')) return;

    try {
      await fetch(`${API_BASE_URL}/nova-conversa`, { method: 'POST' });
    } catch (err) {
      console.warn('Erro ao reiniciar histórico no servidor:', err);
    }

    messages = [{ ...WELCOME, time: 'Agora' }];
    saveHistory();
    renderAll();
    if (chatInput) chatInput.focus();
  }

  // ========================================================
  // Tema Claro / Escuro (bônus)
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
  // Eventos
  // ========================================================
  if (chatForm) {
    // Enviar com o botão (submit do formulário)
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (chatInput) handleSendMessage(chatInput.value);
    });
  }

  // Enviar com Enter (Shift+Enter não envia)
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage(chatInput.value);
      }
    });
  }

  chipButtons.forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.dataset.prompt;
      if (prompt) handleSendMessage(prompt);
    });
  });

  if (btnNewChat) btnNewChat.addEventListener('click', newConversation);
  if (btnToggleTheme) btnToggleTheme.addEventListener('click', toggleTheme);

  // ========================================================
  // Inicialização
  // ========================================================
  (function init() {
    // Tema salvo
    let theme = 'light';
    try { theme = localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { /* ignora */ }
    applyTheme(theme);

    // Histórico salvo
    messages = loadHistory();
    renderAll();

    if (chatInput) chatInput.focus();
  })();
});
