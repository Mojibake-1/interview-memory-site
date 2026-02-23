/* ────────── Lecture Deck — TypeScript ────────── */

/* ────────── Types ────────── */

interface LectureCard {
    id: string;
    order: number;
    section: string;
    sectionEn: string;
    core: string;
    question: string;
    quote: string;
    quoteTime: string;
    quoteUrl: string;
    expandedAnswer: string;
    keyPoints: string[];
}

interface NormalizedDeck {
    deckId: string;
    title: string;
    subtitle: string;
    updatedAt: string;
    cards: LectureCard[];
}

interface ProgressRecord {
    level: string;
    reviews: number;
    lastReviewedAt: number;
}

/* ────────── Constants ────────── */

const DECK_FILE: string = document.body?.dataset.deckFile || "/data/lecture0-cards.json";
const STORAGE_KEY: string = document.body?.dataset.storageKey || `lecture_progress_${encodeURIComponent(DECK_FILE)}`;

/* ────────── State ────────── */

interface DeckState {
    deck: NormalizedDeck;
    index: number;
    revealed: boolean;
    navDirection: number;
    progress: Record<string, ProgressRecord>;
}

const state: DeckState = {
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
    progress: loadJSON<Record<string, ProgressRecord>>(STORAGE_KEY, {}),
};

/* ────────── DOM cache ────────── */

const el = {
    deckTitle: document.querySelector<HTMLElement>("#deckTitle")!,
    deckSubtitle: document.querySelector<HTMLElement>("#deckSubtitle")!,
    deckList: document.querySelector<HTMLElement>("#deckList")!,
    cardFront: document.querySelector<HTMLElement>("#cardFront")!,
    cardBack: document.querySelector<HTMLElement>("#cardBack")!,
    flashcard: document.querySelector<HTMLElement>("#flashcard")!,
    toggleBtn: document.querySelector<HTMLButtonElement>("#toggleBtn")!,
    prevBtn: document.querySelector<HTMLButtonElement>("#prevBtn")!,
    nextBtn: document.querySelector<HTMLButtonElement>("#nextBtn")!,
    randomBtn: document.querySelector<HTMLButtonElement>("#randomBtn")!,
    positionLabel: document.querySelector<HTMLElement>("#positionLabel")!,
    gradeButtons: document.querySelectorAll<HTMLButtonElement>(".grade-btn"),
    statTotal: document.querySelector<HTMLElement>("#statTotal")!,
    statMastered: document.querySelector<HTMLElement>("#statMastered")!,
    statReviews: document.querySelector<HTMLElement>("#statReviews")!,
    statUpdated: document.querySelector<HTMLElement>("#statUpdated")!,
};

/* ────────── Init ────────── */

init().catch((error: unknown) => {
    console.error(error);
    const msg = error instanceof Error ? error.message : String(error);
    el.cardFront.innerHTML = `<p>加载失败：${escapeHtml(msg)}</p>`;
    el.cardBack.innerHTML = "";
});

async function init(): Promise<void> {
    const rawDeck = await fetchDeck();
    state.deck = normalizeDeck(rawDeck);
    bindEvents();
    renderAll();
}

/* ────────── Data ────────── */

async function fetchDeck(): Promise<unknown> {
    const response = await fetch(DECK_FILE, {
        headers: { Accept: "application/json" },
    });

    if (!response.ok) {
        throw new Error(`请求卡片失败：${response.status}`);
    }

    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !Array.isArray((data as Record<string, unknown>).cards)) {
        throw new Error("卡片数据格式错误");
    }
    return data;
}

function normalizeDeck(raw: unknown): NormalizedDeck {
    const r = raw as Record<string, unknown>;
    const rawCards = r.cards as unknown[];
    const cards = rawCards
        .map((item) => normalizeCard(item))
        .filter((c): c is LectureCard => c !== null)
        .sort((a, b) => a.order - b.order);

    return {
        deckId: String(r.deckId || "").trim(),
        title: String(r.title || "CS50P 卡组").trim(),
        subtitle: String(r.subtitle || "").trim(),
        updatedAt: String(r.updatedAt || "").trim(),
        cards,
    };
}

function normalizeCard(card: unknown): LectureCard | null {
    if (!card || typeof card !== "object") return null;
    const c = card as Record<string, unknown>;

    const id = String(c.id || "").trim();
    const order = Number(c.order);
    const section = String(c.section || "").trim();
    const sectionEn = String(c.sectionEn || "").trim();
    const core = String(c.core || "").trim();
    const question = String(c.question || "").trim();
    const quote = String(c.quote || "").trim();
    const quoteTime = String(c.quoteTime || "").trim();
    const quoteUrl = String(c.quoteUrl || "").trim();
    const expandedAnswer = String(c.expandedAnswer || "").trim();
    const keyPoints: string[] = Array.isArray(c.keyPoints)
        ? (c.keyPoints as unknown[]).map((item) => String(item).trim()).filter(Boolean)
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

/* ────────── Events ────────── */

function bindEvents(): void {
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

    el.deckList.addEventListener("click", (event: Event) => {
        const target = (event.target as HTMLElement).closest<HTMLElement>("[data-id]");
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

    window.addEventListener("keydown", (event: KeyboardEvent) => {
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

/* ────────── Navigation ────────── */

function moveBy(delta: number): void {
    const len = state.deck.cards.length;
    if (!len) return;

    state.navDirection = delta;
    state.index = (state.index + delta + len) % len;
    state.revealed = false;
    renderAll();
}

/* ────────── Grading ────────── */

function applyGrade(grade: string): void {
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

function gradeToLevel(grade: string): string {
    if (grade === "good") return "good";
    if (grade === "hard") return "hard";
    if (grade === "again") return "again";
    return "new";
}

function getLevel(id: string): string {
    return state.progress[id]?.level || "new";
}

function getCurrentCard(): LectureCard | null {
    return state.deck.cards[state.index] || null;
}

/* ────────── Rendering ────────── */

function renderAll(): void {
    renderMeta();
    renderDeckInfo();
    renderDeckList();
    renderCard();
    syncViewportFocus();
}

function syncViewportFocus(): void {
    const active = el.deckList.querySelector<HTMLElement>(".deck-item.active");
    if (active) {
        const block: ScrollLogicalPosition = state.navDirection > 0 ? "end" : state.navDirection < 0 ? "start" : "nearest";
        active.scrollIntoView({
            block,
            inline: "nearest",
            behavior: state.navDirection === 0 ? "auto" : "smooth",
        });
    }

    // User requested: "操作后，固定视角拉到页面底部，以经可能显示卡片窗体完整"
    window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth",
    });

    state.navDirection = 0;
}

function renderDeckInfo(): void {
    el.deckTitle.textContent = state.deck.title || "卡组";
    el.deckSubtitle.textContent = state.deck.subtitle || "";
}

function renderMeta(): void {
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

function renderDeckList(): void {
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

function renderCard(): void {
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

    <p class="prompt">先口述你的答案，再点"显示答案"。</p>
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

/* ────────── Utilities ────────── */

function formatDate(value: string): string {
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) {
        return new Date(timestamp).toLocaleDateString("zh-CN");
    }
    if (value) return value;
    return "-";
}

function escapeHtml(value: string | number): string {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
    return escapeHtml(value).replaceAll("`", "&#96;");
}

function loadJSON<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

function saveJSON(key: string, value: unknown): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // ignore localStorage errors
    }
}
