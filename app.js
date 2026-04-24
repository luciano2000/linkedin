'use strict';

/* ── State ─────────────────────────────────────────────── */
const state = {
  positive: [],   // string[]
  mustHave: [],   // string[][] — array of synonym-groups
  negative: [],   // string[]
};

let currentQuery = '';

/* ── Bootstrap ─────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  setupTagField('positiveInput', 'positiveField', 'positive');
  setupTagField('negativeInput', 'negativeField', 'negative');
  updateQuery();
});

/* ── Tag field wiring ───────────────────────────────────── */
function setupTagField(inputId, fieldId, type, gIdx = null) {
  const input = document.getElementById(inputId);
  if (!input) return;

  if (fieldId) {
    const field = document.getElementById(fieldId);
    field?.addEventListener('click', () => input.focus());
  }

  input.addEventListener('keydown', e => {
    const val = input.value.trim();
    if ((e.key === 'Enter' || e.key === ',') && val) {
      e.preventDefault();
      addTag(type, val, gIdx);
      input.value = '';
    } else if (e.key === 'Backspace' && !input.value) {
      e.preventDefault();
      removeLastTag(type, gIdx);
    }
  });

  input.addEventListener('paste', e => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    text.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
        .forEach(v => addTag(type, v, gIdx));
    input.value = '';
  });
}

/* ── Tag CRUD ───────────────────────────────────────────── */
function getArr(type, gIdx) {
  if (type === 'positive') return state.positive;
  if (type === 'negative') return state.negative;
  return state.mustHave[gIdx];
}

function addTag(type, value, gIdx = null) {
  const arr = getArr(type, gIdx);
  if (arr && !arr.includes(value)) {
    arr.push(value);
    renderTags(type, gIdx);
    updateQuery();
  }
}

function removeTag(type, idx, gIdx = null) {
  const arr = getArr(type, gIdx);
  if (arr) { arr.splice(idx, 1); renderTags(type, gIdx); updateQuery(); }
}

function removeLastTag(type, gIdx = null) {
  const arr = getArr(type, gIdx);
  if (arr?.length) { arr.pop(); renderTags(type, gIdx); updateQuery(); }
}

/* ── Tag rendering ──────────────────────────────────────── */
function renderTags(type, gIdx = null) {
  const id  = type === 'positive' ? 'positiveTags'
            : type === 'negative' ? 'negativeTags'
            : `gTags-${gIdx}`;
  const cls = type === 'positive' ? 'tag-or'
            : type === 'negative' ? 'tag-not'
            : 'tag-and';
  const arr = getArr(type, gIdx) ?? [];
  const container = document.getElementById(id);
  if (!container) return;

  container.innerHTML = '';
  arr.forEach((val, i) => {
    const tag = document.createElement('span');
    tag.className = `tag ${cls}`;

    const lbl = document.createElement('span');
    lbl.textContent = val;

    const btn = document.createElement('button');
    btn.className = 'tag-x';
    btn.innerHTML = '&times;';
    btn.title = 'Remover';
    btn.addEventListener('click', e => { e.stopPropagation(); removeTag(type, i, gIdx); });

    tag.append(lbl, btn);
    container.appendChild(tag);
  });
}

/* ── AND groups ─────────────────────────────────────────── */
function addGroup() {
  state.mustHave.push([]);
  renderAllGroups();
  document.getElementById(`gInput-${state.mustHave.length - 1}`)?.focus();
}

function removeGroup(gIdx) {
  state.mustHave.splice(gIdx, 1);
  renderAllGroups();
  updateQuery();
}

function renderAllGroups() {
  const container = document.getElementById('andGroups');
  container.innerHTML = '';

  state.mustHave.forEach((_, gIdx) => {
    const row = document.createElement('div');
    row.className = 'group-row';
    row.innerHTML = `
      <div class="group-num">${gIdx + 1}</div>
      <div class="group-field" id="gField-${gIdx}">
        <div class="tag-list" id="gTags-${gIdx}"></div>
        <input class="tag-input" id="gInput-${gIdx}" type="text"
               placeholder="Sinônimos — Enter ↵" autocomplete="off">
      </div>
      <button class="group-del" title="Remover conceito">&times;</button>
    `;
    container.appendChild(row);

    row.querySelector('.group-del').addEventListener('click', () => removeGroup(gIdx));
    document.getElementById(`gField-${gIdx}`)
            .addEventListener('click', () => document.getElementById(`gInput-${gIdx}`)?.focus());

    setupTagField(`gInput-${gIdx}`, null, 'must', gIdx);
    renderTags('must', gIdx);
  });
}

/* ── Query generation ───────────────────────────────────── */
function fmt(t) { return t.includes(' ') ? `"${t}"` : t; }

function updateQuery() {
  const posParts  = state.positive.map(fmt);
  const mustParts = state.mustHave
    .filter(g => g.length > 0)
    .map(g => { const ts = g.map(fmt); return ts.length > 1 ? `(${ts.join(' OR ')})` : ts[0]; });
  const negParts  = state.negative.map(t => `NOT ${fmt(t)}`);

  const blocks = [];
  if (posParts.length) blocks.push(posParts.length > 1 ? `(${posParts.join(' OR ')})` : posParts[0]);
  mustParts.forEach(b => blocks.push(b));

  let q = blocks.join(' AND ');
  if (negParts.length) q += (q ? ' ' : '') + negParts.join(' ');

  currentQuery = q;

  const out     = document.getElementById('queryOutput');
  const countEl = document.getElementById('charCount');
  const searchBtn = document.getElementById('searchBtn');

  if (!q) {
    out.innerHTML = '<span class="code-empty">Sua query aparecerá aqui conforme você adiciona palavras-chave...</span>';
    countEl.textContent = '';
    searchBtn.disabled = true;
    return;
  }

  searchBtn.disabled = false;
  countEl.textContent = `${q.length} car.`;
  out.innerHTML = highlight(q);
}

/* ── Syntax highlighting ────────────────────────────────── */
function highlight(q) {
  return tokenize(q).map(t => {
    if (t.type === 'AND')    return `<span class="hl-and">AND</span>`;
    if (t.type === 'OR')     return `<span class="hl-or">OR</span>`;
    if (t.type === 'NOT')    return `<span class="hl-not">NOT</span>`;
    if (t.type === 'phrase') return `<span class="hl-phrase">${esc(t.v)}</span>`;
    if (t.type === 'paren')  return `<span class="hl-paren">${esc(t.v)}</span>`;
    return esc(t.v);
  }).join('');
}

function tokenize(q) {
  const tokens = [];
  let i = 0;
  while (i < q.length) {
    const ch = q[i];

    if (ch === '"') {
      let j = i + 1;
      while (j < q.length && q[j] !== '"') j++;
      tokens.push({ type: 'phrase', v: q.slice(i, j + 1) });
      i = j + 1; continue;
    }

    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', v: ch });
      i++; continue;
    }

    const prevOk = i === 0 || /[^a-zA-Z0-9]/.test(q[i - 1]);
    if (prevOk) {
      const tail = q.slice(i);
      const m = tail.match(/^(AND|OR|NOT)(?=[^a-zA-Z0-9]|$)/);
      if (m) {
        tokens.push({ type: m[1], v: m[1] });
        i += m[1].length; continue;
      }
    }

    if (tokens.length && tokens[tokens.length - 1].type === 'text') {
      tokens[tokens.length - 1].v += ch;
    } else {
      tokens.push({ type: 'text', v: ch });
    }
    i++;
  }
  return tokens;
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ── Copy ───────────────────────────────────────────────── */
async function copyQuery() {
  if (!currentQuery) return;
  const btn = document.getElementById('copyBtn');

  try {
    await navigator.clipboard.writeText(currentQuery);
  } catch {
    const ta = Object.assign(document.createElement('textarea'),
      { value: currentQuery, style: 'position:fixed;opacity:0' });
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  btn.classList.add('copied');
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copiado!`;
  setTimeout(() => {
    btn.classList.remove('copied');
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar`;
  }, 2200);
}

/* ── Open LinkedIn ──────────────────────────────────────── */
function openLinkedIn() {
  if (!currentQuery) return;
  window.open(
    `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(currentQuery)}`,
    '_blank', 'noopener,noreferrer'
  );
}
