// ── Paketspåraren – app.js ──────────────────────────────

const API_BASE = '../api'; // relativ sökväg till PHP-proxyn

// Status-mappning från 17tracks kod till läsbar text + CSS-klass
const STATUS_MAP = {
  0:  { label: 'Okänd',         cls: 'unknown'    },
  10: { label: 'Inväntar info', cls: 'pending'    },
  20: { label: 'Registrerat',   cls: 'pending'    },
  30: { label: 'Under transport',cls: 'in-transit'},
  35: { label: 'Under transport',cls: 'in-transit'},
  40: { label: 'Utleverans',    cls: 'in-transit' },
  41: { label: 'Missad lev.',   cls: 'exception'  },
  42: { label: 'Hämtas',        cls: 'pending'    },
  50: { label: 'Levererat',     cls: 'delivered'  },
  60: { label: 'Retur',         cls: 'exception'  },
  70: { label: 'Undantag',      cls: 'exception'  },
};

function getStatus(code) {
  return STATUS_MAP[code] ?? { label: 'Okänd', cls: 'unknown' };
}

// ── LocalStorage helpers ────────────────────────────────
function loadPackages() {
  try { return JSON.parse(localStorage.getItem('packages') || '[]'); }
  catch { return []; }
}

function savePackages(pkgs) {
  localStorage.setItem('packages', JSON.stringify(pkgs));
}

// ── DOM references ──────────────────────────────────────
const inputNumber  = document.getElementById('input-number');
const inputName    = document.getElementById('input-name');
const inputCarrier = document.getElementById('input-carrier');
const btnAdd       = document.getElementById('btn-add');
const addMsg       = document.getElementById('add-msg');
const pkgList      = document.getElementById('pkg-list');
const btnRefresh   = document.getElementById('btn-refresh');
const refreshSpinner = document.getElementById('refresh-spinner');

// ── Airmee helpers ───────────────────────────────────────
function isAirmee(pkg) { return pkg.carrier === 'airmee'; }
function airmeeUrl(number) {
  return `https://tracking.airmee.com/sv/#/track/${encodeURIComponent(number)}`;
}

// ── Add package ─────────────────────────────────────────
btnAdd.addEventListener('click', addPackage);
inputNumber.addEventListener('keydown', e => { if (e.key === 'Enter') addPackage(); });

async function addPackage() {
  const number  = inputNumber.value.trim();
  const name    = inputName.value.trim() || number;
  const carrier = inputCarrier.value;

  if (!number) { showMsg('Ange ett spårningsnummer.', 'error'); return; }

  // ── Airmee: spara direkt utan 17track ──
  if (carrier === 'airmee') {
    const pkgs = loadPackages();
    if (pkgs.find(p => p.number === number)) {
      showMsg('Det spårningsnumret finns redan.', 'error');
      return;
    }
    pkgs.unshift({ number, name, carrier: 'airmee', status: null, events: [], addedAt: Date.now() });
    savePackages(pkgs);
    inputNumber.value = '';
    inputName.value   = '';
    showMsg('Airmee-paket tillagt!', 'ok');
    setTimeout(() => showMsg('', ''), 3000);
    renderList();
    return;
  }

  btnAdd.disabled = true;
  showMsg('Registrerar...', '');

  try {
    const res = await fetch(`${API_BASE}/register.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number, carrier: carrier || null }),
    });
    const data = await res.json();

    const accepted = data?.data?.accepted ?? [];
    const rejected = data?.data?.rejected ?? [];

    if (accepted.length > 0 || rejected.length === 0) {
      const pkgs = loadPackages();
      if (pkgs.find(p => p.number === number)) {
        showMsg('Det spårningsnumret finns redan.', 'error');
      } else {
        pkgs.unshift({ number, name, carrier: carrier || null, status: 10, events: [], addedAt: Date.now() });
        savePackages(pkgs);
        inputNumber.value = '';
        inputName.value   = '';
        showMsg('Paket tillagt! Hämtar status...', 'ok');
        renderList();
        await refreshAll();
        showMsg('', '');
      }
    } else {
      const reason = rejected[0]?.error?.message ?? 'Okänt fel';
      showMsg(`Kunde inte lägga till: ${reason}`, 'error');
    }
  } catch (err) {
    showMsg('Nätverksfel – försök igen.', 'error');
    console.error(err);
  } finally {
    btnAdd.disabled = false;
  }
}

// ── Refresh all ─────────────────────────────────────────
btnRefresh.addEventListener('click', async () => {
  refreshSpinner.hidden = false;
  btnRefresh.disabled = true;
  await refreshAll();
  refreshSpinner.hidden = true;
  btnRefresh.disabled = false;
});

async function refreshAll() {
  const pkgs = loadPackages();
  if (pkgs.length === 0) return;

  // Airmee-paket hanteras inte via 17track
  const numbers = pkgs.filter(p => !isAirmee(p)).map(p => p.number);

  try {
    const res = await fetch(`${API_BASE}/track.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numbers }),
    });
    const data = await res.json();
    const accepted = data?.data?.accepted ?? [];

    accepted.forEach(item => {
      const pkg = pkgs.find(p => p.number === item.number);
      if (!pkg) return;
      const info = item.track ?? {};
      pkg.status = info.e ?? 0;
      pkg.carrier = info.c1 ?? pkg.carrier;
      pkg.events  = (info.z0 ?? []).map(ev => ({
        time: ev.a,
        desc: ev.z,
        loc:  ev.c ?? '',
      }));
    });

    savePackages(pkgs);
    renderList();
  } catch (err) {
    console.error('Refresh failed', err);
  }
}

// ── Render ───────────────────────────────────────────────
function renderList() {
  const pkgs = loadPackages();
  pkgList.innerHTML = '';

  if (pkgs.length === 0) {
    pkgList.innerHTML = `
      <div class="empty-state">
        <div class="icon">📦</div>
        Inga paket ännu.<br>Lägg till ett spårningsnummer ovan.
      </div>`;
    return;
  }

  pkgs.forEach((pkg, idx) => {
    const card = document.createElement('div');
    card.className = 'pkg-card';
    card.dataset.idx = idx;

    // ── Airmee-kort ──
    if (isAirmee(pkg)) {
      card.innerHTML = `
        <div class="pkg-top">
          <div>
            <div class="pkg-name">${escHtml(pkg.name)}</div>
            <div class="pkg-number">${escHtml(pkg.number)} · Airmee</div>
          </div>
          <div class="pkg-actions">
            <button class="btn-icon delete" title="Ta bort" data-action="delete" data-idx="${idx}">🗑</button>
          </div>
        </div>
        <div style="margin-top:10px;">
          <a href="${airmeeUrl(pkg.number)}" target="_blank" rel="noopener"
             style="font-size:.85rem; color:var(--accent); text-decoration:none; display:inline-flex; align-items:center; gap:5px;">
            Spåra på Airmee →
          </a>
        </div>`;
      pkgList.appendChild(card);
      return;
    }

    // ── Vanligt 17track-kort ──
    const st = getStatus(pkg.status);
    const latestEvent = pkg.events?.[0];

    card.innerHTML = `
      <div class="pkg-top">
        <div>
          <div class="pkg-name">${escHtml(pkg.name)}</div>
          <div class="pkg-number">${escHtml(pkg.number)}</div>
        </div>
        <div class="pkg-actions">
          <span class="badge ${st.cls}">${st.label}</span>
          <button class="btn-icon delete" title="Ta bort" data-action="delete" data-idx="${idx}">🗑</button>
        </div>
      </div>
      ${latestEvent ? `
        <div style="margin-top:10px; font-size:.82rem; color:var(--muted);">
          ${escHtml(latestEvent.desc)}${latestEvent.loc ? ' · ' + escHtml(latestEvent.loc) : ''}
        </div>` : ''}
      ${pkg.events?.length > 0 ? `
        <button class="toggle-events" data-action="toggle" data-idx="${idx}">
          Visa alla händelser (${pkg.events.length})
        </button>
        <div class="pkg-events">
          ${pkg.events.map(ev => `
            <div class="event">
              <div class="event-time">${escHtml(ev.time ?? '')}</div>
              <div class="event-desc">${escHtml(ev.desc ?? '')}${ev.loc ? '<br><span style="color:var(--muted)">'+escHtml(ev.loc)+'</span>' : ''}</div>
            </div>`).join('')}
        </div>` : ''}
    `;

    pkgList.appendChild(card);
  });

  // Event delegation
  pkgList.addEventListener('click', handleListClick);
}

function handleListClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const idx = parseInt(btn.dataset.idx, 10);
  const pkgs = loadPackages();

  if (btn.dataset.action === 'delete') {
    if (confirm(`Ta bort "${pkgs[idx].name}"?`)) {
      pkgs.splice(idx, 1);
      savePackages(pkgs);
      renderList();
    }
  }

  if (btn.dataset.action === 'toggle') {
    const card = btn.closest('.pkg-card');
    card.classList.toggle('expanded');
    btn.textContent = card.classList.contains('expanded')
      ? `Dölj händelser`
      : `Visa alla händelser (${pkgs[idx].events.length})`;
  }
}

// ── Helpers ──────────────────────────────────────────────
function showMsg(text, type) {
  addMsg.textContent = text;
  addMsg.className = `msg ${type}`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ─────────────────────────────────────────────────
renderList();

// Auto-refresh var 5:e minut
setInterval(async () => {
  await refreshAll();
}, 5 * 60 * 1000);
