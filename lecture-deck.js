const DECK_FILE = document.body?.dataset.deckFile || "/data/lecture0-cards.json";
const STORAGE_KEY = document.body?.dataset.storageKey || `lecture_progress_${encodeURIComponent(DECK_FILE)}`;

const state = {
  deck: {
    deckId: "",
    title: "",
    subtitle: "",
    updatedAt: "",
    cards: [],
  },
  index: 0,
  revealed: false,
  navDirection: 0,
  progress: loadJSON(STORAGE_KEY, {}),
};

const el = {
  deckTitle: document.querySelector("#deckTitle"),
  deckSubtitle: document.querySelector("#deckSubtitle"),
  deckList: document.querySelector("#deckList"),
  cardFront: document.querySelector("#cardFront"),
  cardBack: document.querySelector("#cardBack"),
  flashcard: document.querySelector("#flashcard"),
  toggleBtn: document.querySelector("#toggleBtn"),
  prevBtn: document.querySelector("#prevBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  randomBtn: document.querySelector("#randomBtn"),
  positionLabel: document.querySelector("#positionLabel"),
  gradeButtons: document.querySelectorAll(".grade-btn"),
  statTotal: document.querySelector("#statTotal"),
  statMastered: document.querySelector("#statMastered"),
  statReviews: document.querySelector("#statReviews"),
  statUpdated: document.querySelector("#statUpdated"),
};

init().catch((error) => {
  console.error(error);
  el.cardFront.innerHTML = `<p>加载失败：${escapeHtml(error.message || String(error))}</p>`;
  el.cardBack.innerHTML = "";
});

async function init() {
  const rawDeck = await fetchDeck();
  state.deck = normalizeDeck(rawDeck);
  bindEvents();
  renderAll();
}

async function fetchDeck() {
  const response = await fetch(DECK_FILE, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`请求卡片失败：${response.status}`);
  }

  const data = await response.json();
  if (!data || typeof data !== "object" || !Array.isArray(data.cards)) {
    throw new Error("卡片数据格式错误");
  }
  return data;
}

function normalizeDeck(raw) {
  const cards = raw.cards
    .map((item) => normalizeCard(item))
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);

  return {
    deckId: String(raw.deckId || "").trim(),
    title: String(raw.title || "CS50P 卡组").trim(),
    subtitle: String(raw.subtitle || "").trim(),
    updatedAt: String(raw.updatedAt || "").trim(),
    cards,
  };
}

function normalizeCard(card) {
  if (!card || typeof card !== "object") return null;

  const id = String(card.id || "").trim();
  const order = Number(card.order);
  const section = String(card.section || "").trim();
  const sectionEn = String(card.sectionEn || "").trim();
  const core = String(card.core || "").trim();
  const question = String(card.question || "").trim();
  const quote = String(card.quote || "").trim();
  const quoteTime = String(card.quoteTime || "").trim();
  const quoteUrl = String(card.quoteUrl || "").trim();
  const expandedAnswer = String(card.expandedAnswer || "").trim();
  const keyPoints = Array.isArray(card.keyPoints)
    ? card.keyPoints.map((item) => String(item).trim()).filter(Boolean)
    : [];

  if (!id || !order || !section || !core || !question || !quote || !expandedAnswer) {
    return null;
  }

  return {
    id,
    order,
    section,
    sectionEn,
    core,
    question,
    quote,
    quoteTime,
    quoteUrl,
    expandedAnswer,
    keyPoints,
  };
}

function bindEvents() {
  el.toggleBtn.addEventListener("click", () => {
    state.revealed = !state.revealed;
    renderCard();
  });

  el.prevBtn.addEventListener("click", () => {
    moveBy(-1);
  });

  el.nextBtn.addEventListener("click", () => {
    moveBy(1);
  });

  el.randomBtn.addEventListener("click", () => {
    const len = state.deck.cards.length;
    if (!len) return;
    if (len === 1) {
      state.revealed = false;
      renderCard();
      return;
    }

    let next = state.index;
    while (next === state.index) {
      next = Math.floor(Math.random() * len);
    }

    state.navDirection = next > state.index ? 1 : -1;
    state.index = next;
    state.revealed = false;
    renderAll();
  });

  el.deckList.addEventListener("click", (event) => {
    const target = event.target.closest("[data-id]");
    if (!target) return;
    const id = target.dataset.id;
    if (!id) return;
    const index = state.deck.cards.findIndex((card) => card.id === id);
    if (index < 0) return;

    state.navDirection = index > state.index ? 1 : index < state.index ? -1 : 0;
    state.index = index;
    state.revealed = false;
    renderAll();
  });

  el.gradeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const grade = button.dataset.grade;
      if (!grade) return;
      applyGrade(grade);
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const target = event.target;
    if (target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
      return;
    }

    if (event.key === " ") {
      event.preventDefault();
      state.revealed = !state.revealed;
      renderCard();
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveBy(-1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveBy(1);
      return;
    }

    if (event.key === "1") {
      applyGrade("again");
      return;
    }

    if (event.key === "2") {
      applyGrade("hard");
      return;
    }

    if (event.key === "3") {
      applyGrade("good");
    }
  });
}

function moveBy(delta) {
  const len = state.deck.cards.length;
  if (!len) return;

  state.navDirection = delta;
  state.index = (state.index + delta + len) % len;
  state.revealed = false;
  renderAll();
}

function applyGrade(grade) {
  const card = getCurrentCard();
  if (!card) return;

  const current = state.progress[card.id] || { level: "new", reviews: 0, lastReviewedAt: 0 };
  const nextLevel = gradeToLevel(grade);

  state.progress[card.id] = {
    level: nextLevel,
    reviews: Number(current.reviews || 0) + 1,
    lastReviewedAt: Date.now(),
  };

  saveJSON(STORAGE_KEY, state.progress);
  renderMeta();
  renderDeckList();

  moveBy(1);
}

function gradeToLevel(grade) {
  if (grade === "good") return "good";
  if (grade === "hard") return "hard";
  if (grade === "again") return "again";
  return "new";
}

function getLevel(id) {
  return state.progress[id]?.level || "new";
}

function getCurrentCard() {
  return state.deck.cards[state.index] || null;
}

function renderAll() {
  renderMeta();
  renderDeckInfo();
  renderDeckList();
  renderCard();
  syncViewportFocus();
}

function syncViewportFocus() {
  const active = el.deckList.querySelector(".deck-item.active");
  if (active) {
    const block = state.navDirection > 0 ? "end" : state.navDirection < 0 ? "start" : "nearest";
    active.scrollIntoView({
      block,
      inline: "nearest",
      behavior: state.navDirection === 0 ? "auto" : "smooth",
    });
  }

  // User requested: "操作后，固定视角拉到页面底部，以经可能显示卡片窗体完整"
  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: "smooth"
  });

  state.navDirection = 0;
}

function renderDeckInfo() {
  el.deckTitle.textContent = state.deck.title || "卡组";
  el.deckSubtitle.textContent = state.deck.subtitle || "";
}

function renderMeta() {
  const cards = state.deck.cards;
  const total = cards.length;

  let mastered = 0;
  let reviews = 0;

  cards.forEach((card) => {
    const record = state.progress[card.id];
    if (!record) return;
    if (record.level === "good") mastered += 1;
    reviews += Number(record.reviews || 0);
  });

  el.statTotal.textContent = String(total);
  el.statMastered.textContent = `${mastered}/${total || 0}`;
  el.statReviews.textContent = String(reviews);
  el.statUpdated.textContent = formatDate(state.deck.updatedAt);
}

function renderDeckList() {
  if (!state.deck.cards.length) {
    el.deckList.innerHTML = '<p class="muted">暂无卡片</p>';
    return;
  }

  el.deckList.innerHTML = state.deck.cards
    .map((card, index) => {
      const active = index === state.index ? "active" : "";
      const level = getLevel(card.id);
      return `
        <button type="button" class="deck-item ${active}" data-id="${escapeHtml(card.id)}">
          <div class="deck-item-head">
            <span class="order-pill">${card.order}</span>
            <span class="status-dot ${level}"></span>
          </div>
          <h3>${escapeHtml(card.section)}</h3>
        </button>
      `;
    })
    .join("");
}

function renderCard() {
  const card = getCurrentCard();
  const total = state.deck.cards.length;

  if (!card) {
    el.cardFront.innerHTML = '<p class="muted">当前没有可学习卡片。</p>';
    el.cardBack.innerHTML = "";
    el.positionLabel.textContent = "0/0";
    el.flashcard.classList.remove("revealed");
    el.toggleBtn.textContent = "显示答案";
    return;
  }

  el.cardFront.innerHTML = `
    <span class="section-tag">第 ${card.order} 节</span>
    <h2 class="card-title">${escapeHtml(card.section)}</h2>
    <p class="card-sub">${escapeHtml(card.sectionEn)}</p>

    <section class="block">
      <h4>核心概括</h4>
      <p>${escapeHtml(card.core)}</p>
    </section>

    <section class="block">
      <h4>深度问题</h4>
      <p class="question">${escapeHtml(card.question)}</p>
    </section>

    <p class="prompt">先口述你的答案，再点“显示答案”。</p>
  `;

  const quoteLink = card.quoteUrl
    ? `<a class="quote-link" href="${escapeAttribute(card.quoteUrl)}" target="_blank" rel="noopener noreferrer">时间戳 ${escapeHtml(card.quoteTime || "查看原视频")}</a>`
    : "";

  const keyList = card.keyPoints.length
    ? `<ul class="key-list">${card.keyPoints.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";

  el.cardBack.innerHTML = `
    <span class="section-tag">答案 · 第 ${card.order} 节</span>
    <h2 class="card-title">${escapeHtml(card.section)}</h2>

    <section class="block">
      <div class="quote-head">
        <h4>教授原话（提炼）</h4>
        ${quoteLink}
      </div>
      <p class="quote-box">${escapeHtml(card.quote)}</p>
    </section>

    <section class="block answer">
      <h4>补全解释（可直接背诵）</h4>
      <p>${escapeHtml(card.expandedAnswer)}</p>
      ${keyList}
    </section>
  `;

  el.flashcard.classList.toggle("revealed", state.revealed);
  el.toggleBtn.textContent = state.revealed ? "回到问题" : "显示答案";
  el.positionLabel.textContent = `${state.index + 1}/${total}`;
}

function formatDate(value) {
  const timestamp = Date.parse(value);
  if (!Number.isNaN(timestamp)) {
    return new Date(timestamp).toLocaleDateString("zh-CN");
  }
  if (value) return value;
  return "-";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore localStorage errors
  }
}
