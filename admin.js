const state = {
  cards: [],
  search: "",
  selectedId: "",
};

const el = {
  searchInput: document.querySelector("#searchInput"),
  refreshBtn: document.querySelector("#refreshBtn"),
  newBtn: document.querySelector("#newBtn"),
  cardList: document.querySelector("#cardList"),
  countText: document.querySelector("#countText"),
  formTitle: document.querySelector("#formTitle"),
  statusText: document.querySelector("#statusText"),
  cardForm: document.querySelector("#cardForm"),
  idInput: document.querySelector("#idInput"),
  termInput: document.querySelector("#termInput"),
  categoryInput: document.querySelector("#categoryInput"),
  coreInput: document.querySelector("#coreInput"),
  boundaryInput: document.querySelector("#boundaryInput"),
  signalInput: document.querySelector("#signalInput"),
  actionInput: document.querySelector("#actionInput"),
  aliasesInput: document.querySelector("#aliasesInput"),
  saveBtn: document.querySelector("#saveBtn"),
  deleteBtn: document.querySelector("#deleteBtn"),
  resetBtn: document.querySelector("#resetBtn"),
};

init().catch((error) => {
  console.error(error);
  setStatus(`初始化失败：${error.message || String(error)}`, true);
});

async function init() {
  bindEvents();
  await loadCards();
  clearForm();
}

function bindEvents() {
  el.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    renderList();
  });

  el.refreshBtn.addEventListener("click", async () => {
    await loadCards();
    setStatus("已刷新", false);
  });

  el.newBtn.addEventListener("click", () => {
    clearForm();
    setStatus("已切换到新增模式", false);
  });

  el.cardList.addEventListener("click", (event) => {
    const item = event.target.closest(".card-item");
    if (!item) return;
    const id = item.dataset.id;
    if (!id) return;
    selectCard(id);
  });

  el.cardForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveCard();
  });

  el.deleteBtn.addEventListener("click", async () => {
    const id = state.selectedId;
    if (!id) return;

    const card = state.cards.find((item) => item.id === id);
    if (!card) return;

    const ok = window.confirm(`确认删除卡片：${card.term} ?`);
    if (!ok) return;

    await deleteCard(id);
  });

  el.resetBtn.addEventListener("click", () => {
    if (state.selectedId) {
      selectCard(state.selectedId);
      setStatus("已恢复为当前卡片内容", false);
    } else {
      clearForm();
      setStatus("已清空", false);
    }
  });
}

async function loadCards() {
  const response = await fetch("/api/cards", { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`加载卡片失败：${response.status}`);
  }

  const cards = await response.json();
  if (!Array.isArray(cards)) {
    throw new Error("卡片数据格式错误");
  }

  state.cards = cards.sort((a, b) => {
    const catCmp = String(a.category || "").localeCompare(String(b.category || ""), "zh-Hans-CN");
    if (catCmp !== 0) return catCmp;
    return String(a.term || "").localeCompare(String(b.term || ""), "zh-Hans-CN");
  });

  if (state.selectedId && !state.cards.some((item) => item.id === state.selectedId)) {
    state.selectedId = "";
  }

  renderList();

  if (state.selectedId) {
    selectCard(state.selectedId);
  }
}

function renderList() {
  const list = getFilteredCards();
  el.countText.textContent = `共 ${state.cards.length} 张，当前显示 ${list.length} 张`;

  if (!list.length) {
    el.cardList.innerHTML = '<p class="muted">没有匹配卡片</p>';
    return;
  }

  el.cardList.innerHTML = list
    .map((card) => {
      const active = card.id === state.selectedId ? "active" : "";
      return `
        <article class="card-item ${active}" data-id="${escapeHtml(card.id)}">
          <h3 class="card-title">${escapeHtml(card.term)}</h3>
          <p class="card-meta">${escapeHtml(card.category)} · id: ${escapeHtml(card.id)}</p>
        </article>
      `;
    })
    .join("");
}

function getFilteredCards() {
  const q = state.search;
  if (!q) return state.cards;

  return state.cards.filter((card) => {
    const aliases = Array.isArray(card.aliases) ? card.aliases.join(" ") : "";
    const pool = [card.id, card.term, card.category, card.core, card.boundary, card.signal, card.action, aliases]
      .map((v) => String(v || "").toLowerCase())
      .join(" ");
    return pool.includes(q);
  });
}

function selectCard(id) {
  const card = state.cards.find((item) => item.id === id);
  if (!card) return;

  state.selectedId = id;
  renderList();

  el.formTitle.textContent = `编辑卡片：${card.term}`;
  el.idInput.value = card.id || "";
  el.termInput.value = card.term || "";
  el.categoryInput.value = card.category || "";
  el.coreInput.value = card.core || "";
  el.boundaryInput.value = card.boundary || "";
  el.signalInput.value = card.signal || "";
  el.actionInput.value = card.action || "";
  el.aliasesInput.value = Array.isArray(card.aliases) ? card.aliases.join(", ") : "";

  el.deleteBtn.disabled = false;
  setStatus(`正在编辑 id=${card.id}`, false);
}

function clearForm() {
  state.selectedId = "";
  renderList();

  el.formTitle.textContent = "新增卡片";
  el.idInput.value = "";
  el.termInput.value = "";
  el.categoryInput.value = "";
  el.coreInput.value = "";
  el.boundaryInput.value = "";
  el.signalInput.value = "";
  el.actionInput.value = "";
  el.aliasesInput.value = "";
  el.deleteBtn.disabled = true;
}

async function saveCard() {
  const payload = {
    id: el.idInput.value.trim(),
    term: el.termInput.value.trim(),
    category: el.categoryInput.value.trim(),
    core: el.coreInput.value.trim(),
    boundary: el.boundaryInput.value.trim(),
    signal: el.signalInput.value.trim(),
    action: el.actionInput.value.trim(),
    aliases: parseAliases(el.aliasesInput.value),
  };

  if (!payload.term || !payload.category || !payload.core || !payload.boundary || !payload.signal || !payload.action) {
    setStatus("保存失败：term/category/core/boundary/signal/action 都是必填", true);
    return;
  }

  const editingId = state.selectedId;
  const isEdit = Boolean(editingId);
  const url = isEdit ? `/api/cards/${encodeURIComponent(editingId)}` : "/api/cards";
  const method = isEdit ? "PUT" : "POST";

  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    setStatus(`保存失败：${data.error || response.status}`, true);
    return;
  }

  await loadCards();
  selectCard(data.id);
  setStatus(isEdit ? "更新成功" : "新增成功", false);
}

async function deleteCard(id) {
  const response = await fetch(`/api/cards/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    setStatus(`删除失败：${data.error || response.status}`, true);
    return;
  }

  await loadCards();
  clearForm();
  setStatus("删除成功", false);
}

function parseAliases(raw) {
  return String(raw || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function setStatus(text, isError) {
  el.statusText.textContent = text;
  el.statusText.style.color = isError ? "#b34545" : "#2a8a78";
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
