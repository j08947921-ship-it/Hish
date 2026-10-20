const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const STORE_KEY = 'kollis-flow.sessions.v1';
const MAX_SESSIONS = 12;
let mode = 'chat';
let busy = false;
let configured = false;
let sessions = readSessions();
let activeId = null;
let toastTimer;

function readSessions() {
  try {
    const value = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}
function persistSessions() {
  const safe = sessions.slice(0, MAX_SESSIONS).map((s) => ({
    id: s.id, title: s.title, updatedAt: s.updatedAt,
    items: (s.items || []).map(({ role, content, kind }) => ({ role, content, kind: kind || 'text' })),
    apiMessages: (s.apiMessages || []).slice(-30)
  }));
  try { localStorage.setItem(STORE_KEY, JSON.stringify(safe)); } catch { showToast('Browser storage is full. Old conversation history may not be saved.'); }
}
function newSession() {
  const session = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), title: 'New conversation', updatedAt: Date.now(), items: [], apiMessages: [] };
  sessions.unshift(session); sessions = sessions.slice(0, MAX_SESSIONS); activeId = session.id;
  persistSessions(); renderHistory(); renderConversation(); closeSidebar(); return session;
}
function activeSession() { return sessions.find((s) => s.id === activeId); }
function activateSession(id) {
  activeId = id; const session = activeSession();
  if (!session) return;
  renderHistory(); renderConversation(); closeSidebar(); scrollToBottom();
}
function renderHistory() {
  const holder = $('#history'); holder.replaceChildren();
  if (!sessions.length) {
    const empty = document.createElement('div'); empty.className = 'history-empty'; empty.textContent = 'Your chats will appear here.'; holder.append(empty); return;
  }
  sessions.forEach((session) => {
    const button = document.createElement('button'); button.className = 'history-item' + (session.id === activeId ? ' active' : '');
    button.textContent = session.title || 'New conversation'; button.title = session.title || '';
    button.addEventListener('click', () => activateSession(session.id)); holder.append(button);
  });
}
function renderConversation() {
  const welcome = $('#welcome'), convo = $('#conversation'), session = activeSession();
  const items = session?.items || [];
  welcome.classList.toggle('hidden', items.length > 0);
  convo.classList.toggle('hidden', items.length === 0);
  convo.replaceChildren();
  items.forEach((item) => convo.append(createMessageElement(item)));
  scrollToBottom();
}
function iconFor(role) {
  return role === 'user'
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="1.6"/><path d="M5.5 20c.4-3.5 2.8-5.5 6.5-5.5s6.1 2 6.5 5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
    : '<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M12 2.5 14.7 9.3 21.5 12 14.7 14.7 12 21.5 9.3 14.7 2.5 12 9.3 9.3 12 2.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
}
function createMessageElement(item) {
  const message = document.createElement('article'); message.className = 'message ' + item.role;
  const avatar = document.createElement('div'); avatar.className = 'avatar'; avatar.innerHTML = iconFor(item.role);
  const body = document.createElement('div'); body.className = 'message-body';
  const label = document.createElement('div'); label.className = 'message-label'; label.textContent = item.role === 'user' ? 'You' : "Kolli's Flow"; body.append(label);
  const text = document.createElement('div'); text.className = 'message-text';
  if (item.role === 'user') text.textContent = item.content;
  else text.innerHTML = renderMarkdown(item.content || '');
  body.append(text);
  if (item.kind === 'image') {
    if (item.imageData) {
      const img = document.createElement('img'); img.className = 'generated-image'; img.src = item.imageData; img.alt = item.prompt || 'AI-generated image'; img.loading = 'lazy'; body.append(img);
      const actions = document.createElement('div'); actions.className = 'img-tools';
      const link = document.createElement('a'); link.className = 'img-link'; link.href = item.imageData; link.download = 'kollis-flow-image.png'; link.textContent = '↓ Download image'; actions.append(link);
      const open = document.createElement('a'); open.className = 'img-link'; open.href = item.imageData; open.target = '_blank'; open.rel = 'noopener'; open.textContent = '↗ Open full size'; actions.append(open); body.append(actions);
    } else {
      const note = document.createElement('div'); note.className = 'error-box'; note.textContent = 'The image was shown in the original session but is not stored in browser history. Switch to Create image and submit this prompt again.'; body.append(note);
    }
  }
  if (item.role === 'assistant' && item.kind !== 'image') {
    const tools = document.createElement('div'); tools.className = 'message-tools';
    const copy = document.createElement('button'); copy.className = 'mini-btn'; copy.textContent = 'Copy answer';
    copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(item.content || ''); showToast('Answer copied'); } catch { showToast('Copy is not available in this browser.'); } });
    tools.append(copy); body.append(tools);
  }
  message.append(avatar, body); return message;
}
function renderMarkdown(input) {
  // Minimal markdown rendering after escaping HTML; this is intentionally not a full Markdown parser.
  let text = escapeHtml(input || '');
  text = text.replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_m, lang, code) => `<pre><code>${code.trim()}</code></pre>`);
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(^|\n)\* (.+)/g, '$1• $2');
  text = text.replace(/\n/g, '<br>');
  return text;
}
function escapeHtml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
function scrollToBottom() { requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })); }
function showToast(message) {
  const toast = $('#toast'); toast.textContent = message; toast.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.add('hidden'), 2600);
}
function setMode(nextMode) {
  mode = nextMode === 'image' ? 'image' : 'chat';
  $$('.mode-btn').forEach((button) => { const active = button.dataset.mode === mode; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); });
  $('#modeTool').classList.toggle('selected', mode === 'image');
  $('#modeTool span').textContent = mode === 'image' ? 'Image mode on' : 'Image mode';
  $('#prompt').placeholder = mode === 'image' ? 'Describe the image you want to create…' : "Ask Kolli's Flow anything…";
  $('#sendLabel').textContent = mode === 'image' ? 'Create' : 'Send';
  $('#welcomeLead').textContent = mode === 'image' ? 'Describe what you imagine. Kolli’s Flow will turn your words into a brand-new image.' : "Ask anything, explore an idea, or turn a few words into an image. Let's make something great.";
  $('#prompt').focus();
}
function addItem(item) {
  let session = activeSession(); if (!session) session = newSession();
  session.items.push(item); session.updatedAt = Date.now();
  if (session.title === 'New conversation' && item.role === 'user') session.title = item.content.slice(0, 38) || 'New conversation';
  persistSessions(); renderHistory(); renderConversation();
}
function showTyping() {
  removeTyping();
  const convo = $('#conversation'); convo.classList.remove('hidden'); $('#welcome').classList.add('hidden');
  const wrapper = document.createElement('article'); wrapper.className = 'message'; wrapper.id = 'typing';
  const avatar = document.createElement('div'); avatar.className = 'avatar'; avatar.innerHTML = iconFor('assistant');
  const body = document.createElement('div'); body.className = 'message-body';
  const label = document.createElement('div'); label.className = 'message-label'; label.textContent = mode === 'image' ? 'Creating your image' : "Kolli's Flow is thinking";
  const dots = document.createElement('div'); dots.className = 'typing'; dots.innerHTML = '<span></span><span></span><span></span>';
  body.append(label, dots); wrapper.append(avatar, body); convo.append(wrapper); scrollToBottom();
}
function removeTyping() { $('#typing')?.remove(); }
function showError(message) {
  removeTyping(); const convo = $('#conversation'); convo.classList.remove('hidden'); $('#welcome').classList.add('hidden');
  const box = document.createElement('div'); box.className = 'error-box'; box.textContent = message; convo.append(box); scrollToBottom();
}
async function checkStatus(showMessage = false) {
  try {
    const response = await fetch('/api/status'); const data = await response.json(); configured = Boolean(data.configured);
    $('#statusDot').classList.toggle('ready', configured);
    $('#statusText').textContent = configured ? 'AI connected' : 'Setup needed';
    $('#keyHint').textContent = configured ? (mode === 'image' ? 'Ready to create' : 'Ready to chat') : 'Connect an API token to begin';
    $('#setupStatusText').textContent = configured
      ? `Connected. Chat model: ${data.chatModel}. Image model: ${data.imageModel}. Available model/provider credits may be required.`
      : 'No server API token is configured yet. Follow the steps above, then check connection again.';
    if (showMessage) showToast(configured ? 'AI connection is ready' : 'Still waiting for a server token — see the setup guide');
  } catch {
    configured = false; $('#statusDot').classList.remove('ready'); $('#statusText').textContent = 'Server offline';
    $('#keyHint').textContent = 'Start the app server first';
    $('#setupStatusText').textContent = 'Could not reach the app server. Run npm start and refresh this page.';
    if (showMessage) showToast('The app server is not reachable.');
  }
}
function openSetup() { $('#setupModal').classList.remove('hidden'); checkStatus(); }
function closeSetup() { $('#setupModal').classList.add('hidden'); }
function openSidebar() { $('#sidebar').classList.add('open'); $('#overlay').classList.add('show'); }
function closeSidebar() { $('#sidebar').classList.remove('open'); $('#overlay').classList.remove('show'); }
async function sendPrompt() {
  if (busy) return;
  const input = $('#prompt'); const content = input.value.trim(); if (!content) return;
  input.value = ''; resizeInput(); const sendingMode = mode; busy = true; $('#sendBtn').disabled = true;
  addItem({ role: 'user', content, kind: 'text' }); showTyping();
  try {
    if (sendingMode === 'image') {
      const response = await fetch('/api/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: content }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Image generation failed.');
      removeTyping(); addItem({ role: 'assistant', kind: 'image', content: `Image created from: ${content}`, prompt: content, imageData: data.image });
    } else {
      const session = activeSession();
      session.apiMessages.push({ role: 'user', content });
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: session.apiMessages.slice(-30) }) });
      const data = await response.json(); if (!response.ok) { session.apiMessages.pop(); persistSessions(); throw new Error(data.error || 'Chat request failed.'); }
      session.apiMessages.push({ role: 'assistant', content: data.answer });
      removeTyping(); addItem({ role: 'assistant', content: data.answer, kind: 'text' });
    }
    persistSessions(); scrollToBottom();
  } catch (error) {
    showError(error?.message || 'Something went wrong. Please try again.');
    if (!configured) $('#setupStatusText').textContent = 'No server API token is configured yet. Follow the setup steps, then check the connection again.';
  } finally { busy = false; $('#sendBtn').disabled = false; input.focus(); }
}
function resizeInput() { const input = $('#prompt'); input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 180) + 'px'; }

$('#composerForm').addEventListener('submit', (event) => { event.preventDefault(); sendPrompt(); });
$('#prompt').addEventListener('input', resizeInput);
$('#prompt').addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendPrompt(); } });
$('#modeTool').addEventListener('click', () => setMode(mode === 'chat' ? 'image' : 'chat'));
$$('.mode-btn').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
$$('.idea-card').forEach((card) => card.addEventListener('click', () => { setMode(card.dataset.mode); $('#prompt').value = card.dataset.prompt || ''; resizeInput(); $('#prompt').focus(); }));
$('#newChat').addEventListener('click', () => { newSession(); setMode('chat'); $('#prompt').value = ''; });
$('#clearHistory').addEventListener('click', () => {
  if (!confirm('Clear all saved Kolli’s Flow conversations from this browser?')) return;
  sessions = []; activeId = null; localStorage.removeItem(STORE_KEY); renderHistory(); renderConversation(); closeSidebar(); showToast('Conversation history cleared');
});
$('#clearInput').addEventListener('click', () => { $('#prompt').value = ''; resizeInput(); $('#prompt').focus(); });
$('#setupBtn').addEventListener('click', openSetup); $('#helpBtn').addEventListener('click', openSetup);
$('#closeModal').addEventListener('click', closeSetup); $('#gotIt').addEventListener('click', closeSetup);
$('#setupModal').addEventListener('click', (event) => { if (event.target === $('#setupModal')) closeSetup(); });
$('#refreshStatus').addEventListener('click', () => checkStatus(true));
$('#menuBtn').addEventListener('click', openSidebar); $('#overlay').addEventListener('click', closeSidebar);

if (sessions.length) { activeId = sessions[0].id; } else { newSession(); }
renderHistory(); renderConversation(); checkStatus();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js').catch(() => {}));
