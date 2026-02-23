import type { Card } from "./types";

/* ────────── State ────────── */

interface AdminState {
    cards: Card[];
    search: string;
    selectedId: string;
}

const state: AdminState = {
    cards: [],
    search: "",
    selectedId: "",
};

/* ────────── DOM cache ────────── */

const el = {
    searchInput: document.querySelector<HTMLInputElement>("#searchInput")!,
    refreshBtn: document.querySelector<HTMLButtonElement>("#refreshBtn")!,
    newBtn: document.querySelector<HTMLButtonElement>("#newBtn")!,
    cardList: document.querySelector<HTMLElement>("#cardList")!,
    countText: document.querySelector<HTMLElement>("#countText")!,
    formTitle: document.querySelector<HTMLElement>("#formTitle")!,
    statusText: document.querySelector<HTMLElement>("#statusText")!,
    cardForm: document.querySelector<HTMLFormElement>("#cardForm")!,
    idInput: document.querySelector<HTMLInputElement>("#idInput")!,
    termInput: document.querySelector<HTMLInputElement>("#termInput")!,
    categoryInput: document.querySelector<HTMLInputElement>("#categoryInput")!,
    coreInput: document.querySelector<HTMLTextAreaElement>("#coreInput")!,
    boundaryInput: document.querySelector<HTMLTextAreaElement>("#boundaryInput")!,
    signalInput: document.querySelector<HTMLTextAreaElement>("#signalInput")!,
    actionInput: document.querySelector<HTMLTextAreaElement>("#actionInput")!,
    aliasesInput: document.querySelector<HTMLInputElement>("#aliasesInput")!,
    saveBtn: document.querySelector<HTMLButtonElement>("#saveBtn")!,
    deleteBtn: document.querySelector<HTMLButtonElement>("#deleteBtn")!,
    resetBtn: document.querySelector<HTMLButtonElement>("#resetBtn")!,
};

/* ────────── Init ────────── */

init().catch((error: unknown) => {
    console.error(error);
    const msg = error instanceof Error ? error.message : String(error);
    setStatus(`初始化失败：${msg}`, true);
});

async function init(): Promise<void> {
    bindEvents();
    await loadCards();
    clearForm();
}

/* ────────── Events ────────── */

function bindEvents(): void {
    el.searchInput.addEventListener("input", () => {
        state.search = el.searchInput.value.trim().toLowerCase();
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

    el.cardList.addEventListener("click", (event: Event) => {
        const item = (event.target as HTMLElement).closest<HTMLElement>(".card-item");
        if (!item) return;
        const id = item.dataset.id;
        if (!id) return;
        selectCard(id);
    });

    el.cardForm.addEventListener("submit", async (event: Event) => {
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

/* ────────── Data ────────── */

async function loadCards(): Promise<void> {
    const response = await fetch("/api/cards", { headers: { Accept: "application/json" } });
    if (!response.ok) {
        throw new Error(`加载卡片失败：${response.status}`);
    }

    const cards: unknown = await response.json();
    if (!Array.isArray(cards)) {
        throw new Error("卡片数据格式错误");
    }

    state.cards = (cards as Card[]).sort((a, b) => {
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

/* ────────── Rendering ────────── */

function renderList(): void {
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

function getFilteredCards(): Card[] {
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

/* ────────── Selection / Form ────────── */

function selectCard(id: string): void {
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

function clearForm(): void {
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

/* ────────── CRUD ────────── */

async function saveCard(): Promise<void> {
    const payload: Partial<Card> = {
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

    const data = await response.json().catch(() => ({} as Record<string, unknown>));
    if (!response.ok) {
        setStatus(`保存失败：${(data as { error?: string }).error || response.status}`, true);
        return;
    }

    await loadCards();
    selectCard((data as Card).id);
    setStatus(isEdit ? "更新成功" : "新增成功", false);
}

async function deleteCard(id: string): Promise<void> {
    const response = await fetch(`/api/cards/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
    });

    const data = await response.json().catch(() => ({} as Record<string, unknown>));
    if (!response.ok) {
        setStatus(`删除失败：${(data as { error?: string }).error || response.status}`, true);
        return;
    }

    await loadCards();
    clearForm();
    setStatus("删除成功", false);
}

/* ────────── Utilities ────────── */

function parseAliases(raw: string): string[] {
    return String(raw || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function setStatus(text: string, isError: boolean): void {
    el.statusText.textContent = text;
    el.statusText.style.color = isError ? "#b34545" : "#2a8a78";
}

function escapeHtml(text: string): string {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
