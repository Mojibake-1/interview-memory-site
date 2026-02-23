const STORAGE_KEYS = {
  memory: "interview_memory_v2",
  atoms: "interview_atom_checks_v2",
  quiz: "interview_quiz_v2",
  readingLines: "interview_reading_lines_v1",
};

const CODE_READING_TARGET = 20000;

const HIDDEN_CATEGORIES = new Set([
  "面试表达与控场",
  "岗位与目标",
  "交付物与证据",
  "学习方法与风险控制",
]);

const STATUS_OPTIONS = [
  { key: "ALL", label: "全部" },
  { key: "NEW", label: "新概念" },
  { key: "LEARNING", label: "学习中" },
  { key: "MASTERED", label: "已掌握" },
  { key: "DUE", label: "到期复习" },
];

const state = {
  concepts: [],
  conceptById: new Map(),
  conceptsByCategory: new Map(),
  selectedId: null,
  filters: {
    search: "",
    categories: new Set(),
    status: "ALL",
  },
  memory: loadJSON(STORAGE_KEYS.memory, {}),
  atomChecks: loadJSON(STORAGE_KEYS.atoms, {}),
  quizState: loadJSON(STORAGE_KEYS.quiz, { score: 0, total: 0 }),
  readingLines: loadReadLines(),
  tab: "atoms",
  drill: {
    deck: [],
    index: 0,
    revealed: false,
    source: "到期队列",
  },
  quiz: {
    question: null,
  },
  _allCards: [],
  hiddenUnlocked: sessionStorage.getItem("hidden_unlocked") === "1",
};

const el = {
  statConcepts: document.querySelector("#statConcepts"),
  statAtoms: document.querySelector("#statAtoms"),
  statAtomsDone: document.querySelector("#statAtomsDone"),
  statDue: document.querySelector("#statDue"),
  statMastered: document.querySelector("#statMastered"),
  statGenerated: document.querySelector("#statGenerated"),
  searchInput: document.querySelector("#searchInput"),
  statusFilters: document.querySelector("#statusFilters"),
  resetStatusBtn: document.querySelector("#resetStatusBtn"),
  categoryFilters: document.querySelector("#categoryFilters"),
  clearCategoryBtn: document.querySelector("#clearCategoryBtn"),
  readingInput: document.querySelector("#readingInput"),
  readingProgressFill: document.querySelector("#readingProgressFill"),
  readingSummary: document.querySelector("#readingSummary"),
  tabButtons: document.querySelectorAll(".tab-btn"),
  tabAtoms: document.querySelector("#tab-atoms"),
  tabDrill: document.querySelector("#tab-drill"),
  tabQuiz: document.querySelector("#tab-quiz"),
  atomSummary: document.querySelector("#atomSummary"),
  atomGrid: document.querySelector("#atomGrid"),
  detailPane: document.querySelector("#detailPane"),
  drillSummary: document.querySelector("#drillSummary"),
  drillCard: document.querySelector("#drillCard"),
  buildDueDeckBtn: document.querySelector("#buildDueDeckBtn"),
  buildFilterDeckBtn: document.querySelector("#buildFilterDeckBtn"),
  revealAnswerBtn: document.querySelector("#revealAnswerBtn"),
  gradeButtons: document.querySelectorAll(".grade-btn"),
  quizSummary: document.querySelector("#quizSummary"),
  quizCard: document.querySelector("#quizCard"),
  nextQuizBtn: document.querySelector("#nextQuizBtn"),
};

init().catch((error) => {
  console.error(error);
  if (el.atomGrid) {
    el.atomGrid.innerHTML = `<p class="muted">加载失败：${escapeHtml(error.message || String(error))}</p>`;
  }
});

async function init() {
  const cards = await fetchCards();
  state._allCards = cards;
  hydrateConcepts(cards);
  bindEvents();
  renderAll();
  buildDrillDeckByDue();
  renderDrill();
  buildQuizQuestion();
  renderQuiz();
}

async function fetchCards() {
  const response = await fetch("/api/cards", {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`请求卡片失败：${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("卡片数据格式错误：不是数组");
  }

  return data;
}

function hydrateConcepts(cards) {
  state.concepts = cards
    .map((card) => normalizeCard(card))
    .filter(Boolean)
    .filter((c) => state.hiddenUnlocked || !HIDDEN_CATEGORIES.has(c.category))
    .sort((a, b) => a.term.localeCompare(b.term, "zh-Hans-CN"));

  state.conceptById.clear();
  state.conceptsByCategory.clear();

  state.concepts.forEach((concept) => {
    state.conceptById.set(concept.id, concept);

    if (!state.conceptsByCategory.has(concept.category)) {
      state.conceptsByCategory.set(concept.category, []);
    }
    state.conceptsByCategory.get(concept.category).push(concept.id);
  });

  state.selectedId = state.concepts[0]?.id ?? null;
}

function normalizeCard(card) {
  if (!card || typeof card !== "object") return null;

  const id = String(card.id || "").trim();
  const term = String(card.term || "").trim();
  const category = String(card.category || "").trim();
  const core = String(card.core || "").trim();
  const boundary = String(card.boundary || "").trim();
  const signal = String(card.signal || "").trim();
  const action = String(card.action || "").trim();
  const aliases = Array.isArray(card.aliases)
    ? card.aliases.map((item) => String(item).trim()).filter(Boolean)
    : [];

  if (!id || !term || !category || !core || !boundary || !signal || !action) {
    return null;
  }

  const atoms = [
    `定义：${core}`,
    `边界：${boundary}`,
    `识别信号：${signal}`,
    `落地动作：${action}`,
    `自测问题：你能在 20 秒内解释“${term}”并给出一个可执行动作吗？`,
  ];

  return {
    id,
    term,
    category,
    core,
    boundary,
    signal,
    action,
    aliases,
    atoms,
    searchPool: [
      term.toLowerCase(),
      category.toLowerCase(),
      core.toLowerCase(),
      boundary.toLowerCase(),
      signal.toLowerCase(),
      action.toLowerCase(),
      ...aliases.map((item) => item.toLowerCase()),
    ].join(" "),
  };
}

function bindEvents() {
  el.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    renderAll();
    buildDrillDeckByFiltered();
    renderDrill();
    buildQuizQuestion();
    renderQuiz();
  });

  el.resetStatusBtn.addEventListener("click", () => {
    state.filters.status = "ALL";
    renderAll();
  });

  el.clearCategoryBtn.addEventListener("click", () => {
    state.filters.categories.clear();
    renderAll();
  });

  el.statusFilters.addEventListener("click", (event) => {
    const target = event.target.closest(".status-chip");
    if (!target) return;
    const status = target.dataset.status;
    if (!status) return;
    state.filters.status = status;
    renderAll();
  });

  el.categoryFilters.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const category = target.dataset.category;
    if (!category) return;

    if (target.checked) {
      state.filters.categories.add(category);
    } else {
      state.filters.categories.delete(category);
    }
    renderAll();
  });

  if (el.readingInput) {
    el.readingInput.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      state.readingLines = sanitizeNonNegativeInt(target.value);
      saveJSON(STORAGE_KEYS.readingLines, state.readingLines);
      renderReadingProgress();
    });

    el.readingInput.addEventListener("blur", () => {
      el.readingInput.value = String(state.readingLines);
    });
  }

  el.atomGrid.addEventListener("click", (event) => {
    const jump = event.target.closest("[data-jump-id]");
    if (jump) {
      const id = jump.dataset.jumpId;
      if (!id) return;
      selectConcept(id);
      return;
    }

    const card = event.target.closest(".atom-card");
    if (!card) return;
    const id = card.dataset.id;
    if (!id) return;
    selectConcept(id);
  });

  el.detailPane.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-link-id]");
    if (!chip) return;
    const id = chip.dataset.linkId;
    if (!id) return;
    selectConcept(id);
  });

  el.detailPane.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.dataset.kind !== "atom-check") return;

    const id = input.dataset.id;
    const index = Number(input.dataset.index);
    if (!id || Number.isNaN(index)) return;

    const record = state.atomChecks[id] ?? {};
    record[index] = input.checked;
    state.atomChecks[id] = record;
    saveJSON(STORAGE_KEYS.atoms, state.atomChecks);
    renderMeta();
    renderAtomGrid();
  });

  el.tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      if (!tab) return;
      setTab(tab);
    });
  });

  el.buildDueDeckBtn.addEventListener("click", () => {
    buildDrillDeckByDue();
    renderDrill();
  });

  el.buildFilterDeckBtn.addEventListener("click", () => {
    buildDrillDeckByFiltered();
    renderDrill();
  });

  el.revealAnswerBtn.addEventListener("click", () => {
    if (!state.drill.deck.length) return;
    state.drill.revealed = !state.drill.revealed;
    renderDrill();
  });

  el.gradeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const grade = btn.dataset.grade;
      if (!grade) return;
      gradeDrill(grade);
    });
  });

  el.quizCard.addEventListener("click", (event) => {
    const option = event.target.closest(".quiz-option");
    if (!option) return;
    const picked = option.dataset.id;
    if (!picked) return;
    answerQuiz(picked);
  });

  el.nextQuizBtn.addEventListener("click", () => {
    buildQuizQuestion();
    renderQuiz();
  });

  /* ---- Easter egg: 5 clicks on h1 to unlock hidden categories ---- */
  const heroTitle = document.querySelector(".hero h1");
  if (heroTitle) {
    let clickCount = 0;
    let clickTimer = null;

    heroTitle.addEventListener("click", () => {
      if (state.hiddenUnlocked) return;

      clickCount += 1;
      clearTimeout(clickTimer);

      clickTimer = setTimeout(() => {
        clickCount = 0;
      }, 2000);

      if (clickCount >= 5) {
        clickCount = 0;
        clearTimeout(clickTimer);
        state.hiddenUnlocked = true;
        sessionStorage.setItem("hidden_unlocked", "1");

        heroTitle.style.transition = "color 0.3s";
        heroTitle.style.color = "#d4a017";
        setTimeout(() => { heroTitle.style.color = ""; }, 800);

        hydrateConcepts(state._allCards);
        renderAll();
        buildDrillDeckByDue();
        renderDrill();
        buildQuizQuestion();
        renderQuiz();
      }
    });
  }
}

function setTab(tab) {
  state.tab = tab;

  el.tabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  el.tabAtoms.classList.toggle("active", tab === "atoms");
  el.tabDrill.classList.toggle("active", tab === "drill");
  el.tabQuiz.classList.toggle("active", tab === "quiz");
}

function renderAll() {
  renderMeta();
  renderReadingProgress();
  renderStatusFilters();
  renderCategoryFilters();
  renderAtomGrid();
  renderDetail();
}

function renderMeta() {
  const totalConcepts = state.concepts.length;
  const totalAtoms = state.concepts.reduce((sum, c) => sum + c.atoms.length, 0);
  const doneAtoms = countDoneAtoms();
  const dueCount = getDueConcepts().length;
  const masteredCount = state.concepts.filter((c) => getStatus(c.id) === "MASTERED").length;

  el.statConcepts.textContent = String(totalConcepts);
  el.statAtoms.textContent = String(totalAtoms);
  el.statAtomsDone.textContent = `${doneAtoms}/${totalAtoms}`;
  el.statDue.textContent = String(dueCount);
  el.statMastered.textContent = String(masteredCount);
  el.statGenerated.textContent = new Date().toLocaleDateString("zh-CN");
}

function renderReadingProgress() {
  if (!el.readingSummary || !el.readingProgressFill || !el.readingInput) return;

  const progress = state.readingLines;
  const percentRaw = CODE_READING_TARGET ? (progress / CODE_READING_TARGET) * 100 : 0;
  const percent = Math.max(0, percentRaw);

  el.readingSummary.textContent = `${formatNumber(progress)} / ${formatNumber(CODE_READING_TARGET)}（${percent.toFixed(1)}%）`;
  el.readingProgressFill.style.width = `${Math.min(percent, 100)}%`;
  el.readingProgressFill.classList.toggle("done", progress >= CODE_READING_TARGET);

  if (document.activeElement !== el.readingInput) {
    el.readingInput.value = String(progress);
  }
}

function renderStatusFilters() {
  const filtered = getFilteredConcepts({ ignoreStatus: true });
  const html = STATUS_OPTIONS.map((option) => {
    let count = filtered.length;
    if (option.key !== "ALL") {
      count = filtered.filter((concept) => getStatus(concept.id) === option.key).length;
    }
    const active = state.filters.status === option.key ? "active" : "";
    return `<button class="status-chip ${active}" data-status="${option.key}" type="button">${escapeHtml(option.label)} (${count})</button>`;
  }).join("");
  el.statusFilters.innerHTML = html;
}

function renderCategoryFilters() {
  const categoryList = [...state.conceptsByCategory.keys()].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

  const html = categoryList
    .map((category) => {
      const count = state.conceptsByCategory.get(category)?.length ?? 0;
      const checked = state.filters.categories.has(category) ? "checked" : "";
      return `
        <label class="category-item">
          <input type="checkbox" data-category="${escapeHtml(category)}" ${checked}>
          <span>${escapeHtml(category)}</span>
          <strong>${count}</strong>
        </label>
      `;
    })
    .join("");

  el.categoryFilters.innerHTML = html;
}

function renderAtomGrid() {
  const list = getFilteredConcepts();
  el.atomSummary.textContent = `已筛选 ${list.length} 个概念，点击卡片或“进入详情”可逐条勾选原子点。`;

  if (!list.length) {
    el.atomGrid.innerHTML = '<p class="muted">当前筛选下没有概念。</p>';
    return;
  }

  const html = list
    .map((concept) => {
      const status = getStatus(concept.id);
      const done = countDoneAtomsFor(concept.id);
      const tags = [concept.category, statusLabel(status)]
        .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
        .join("");
      const active = concept.id === state.selectedId ? "active" : "";

      return `
        <article class="atom-card ${active}" data-id="${concept.id}">
          <div class="atom-card-head">
            <h3>${escapeHtml(concept.term)}</h3>
            <span class="dot ${statusClass(status)}"></span>
          </div>
          <div class="tag-row">${tags}</div>
          <p class="atom-snippet">${escapeHtml(concept.atoms[0])}</p>
          <div class="atom-foot">
            <span>完成原子 ${done}/${concept.atoms.length}</span>
            <button type="button" class="jump-btn" data-jump-id="${concept.id}">进入详情</button>
          </div>
        </article>
      `;
    })
    .join("");

  el.atomGrid.innerHTML = html;
}

function renderDetail() {
  const concept = state.conceptById.get(state.selectedId);
  if (!concept) {
    el.detailPane.innerHTML = '<p class="empty">选择一个概念，查看原子拆解。</p>';
    return;
  }

  const status = getStatus(concept.id);
  const memory = ensureMemory(concept.id);
  const related = getRelatedConceptIds(concept.id)
    .map((id) => state.conceptById.get(id))
    .filter(Boolean);

  const atomHtml = concept.atoms
    .map((line, index) => {
      const checked = isAtomChecked(concept.id, index) ? "checked" : "";
      return `
        <label class="atom-item">
          <input type="checkbox" data-kind="atom-check" data-id="${concept.id}" data-index="${index}" ${checked}>
          <p>${escapeHtml(line)}</p>
        </label>
      `;
    })
    .join("");

  const relatedHtml = related.length
    ? related
      .map((item) => `<button type="button" class="link-chip" data-link-id="${item.id}">${escapeHtml(item.term)}</button>`)
      .join("")
    : '<span class="muted">暂无关联概念</span>';

  const dueText = memory.dueAt
    ? new Date(memory.dueAt).toLocaleString("zh-CN", { hour12: false })
    : "未安排";

  el.detailPane.innerHTML = `
    <article class="detail-card">
      <h3 class="detail-title">${escapeHtml(concept.term)}</h3>
      <p class="detail-sub">${escapeHtml(concept.category)}</p>
      <div class="detail-row">
        <span class="status-pill ${statusClass(status)}">${statusLabel(status)}</span>
        <span class="status-pill">复习 ${memory.reviews ?? 0} 次</span>
        <span class="status-pill">连击 ${memory.streak ?? 0}</span>
      </div>
    </article>

    <article class="detail-card">
      <h4>原子点（逐条记忆）</h4>
      <div class="atom-list">${atomHtml}</div>
    </article>

    <article class="detail-card">
      <h4>关联概念</h4>
      <div class="links">${relatedHtml}</div>
    </article>

    <article class="detail-card">
      <h4>复习状态</h4>
      <p class="detail-sub">下一次到期：${escapeHtml(dueText)}</p>
      <p class="detail-sub">间隔：${memory.intervalHours ? `${memory.intervalHours.toFixed(2)}h` : "未开始"}</p>
      <p class="detail-sub">最近评分：${memory.lastGrade ? gradeLabel(memory.lastGrade) : "无"}</p>
    </article>
  `;
}

function buildDrillDeckByDue() {
  const due = getDueConcepts();
  state.drill.deck = due.map((item) => item.id);
  state.drill.index = 0;
  state.drill.revealed = false;
  state.drill.source = "到期队列";
}

function buildDrillDeckByFiltered() {
  const list = getFilteredConcepts();
  state.drill.deck = list.map((item) => item.id);
  state.drill.index = 0;
  state.drill.revealed = false;
  state.drill.source = "当前筛选";
}

function renderDrill() {
  const total = state.drill.deck.length;
  const position = total ? state.drill.index + 1 : 0;
  el.drillSummary.textContent = `来源：${state.drill.source} · ${position}/${total}`;

  if (!total) {
    el.drillCard.innerHTML = '<p class="muted">当前没有可复习概念，先切换筛选或去做测验。</p>';
    el.revealAnswerBtn.textContent = "显示答案";
    return;
  }

  const id = state.drill.deck[state.drill.index];
  const concept = state.conceptById.get(id);
  const status = getStatus(id);

  if (!concept) {
    el.drillCard.innerHTML = '<p class="muted">概念不存在，请重建队列。</p>';
    return;
  }

  const answerList = concept.atoms.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  const answerClass = state.drill.revealed ? "answer-box" : "answer-box hidden";

  el.drillCard.innerHTML = `
    <h3 class="drill-title">${escapeHtml(concept.term)}</h3>
    <p class="drill-sub">分类：${escapeHtml(concept.category)} · 状态：${escapeHtml(statusLabel(status))}</p>
    <p class="recall-prompt">先口述：请你用 20 秒说明它“是什么、有什么边界、如何落地”。</p>
    <section class="${answerClass}">
      <ol>${answerList}</ol>
    </section>
  `;

  el.revealAnswerBtn.textContent = state.drill.revealed ? "隐藏答案" : "显示答案";
}

function gradeDrill(grade) {
  const total = state.drill.deck.length;
  if (!total) return;

  const id = state.drill.deck[state.drill.index];
  applyGrade(id, grade);

  state.drill.index += 1;
  if (state.drill.index >= total) {
    state.drill.index = 0;
  }
  state.drill.revealed = false;

  renderAll();
  renderDrill();
  renderQuizSummary();
}

function applyGrade(id, grade) {
  const memory = ensureMemory(id);
  const now = Date.now();
  const previous = memory.intervalHours ?? 0;

  const rules = {
    again: { base: 0.17, mult: 0.5, streak: -memory.streak, mastered: false },
    hard: { base: 8, mult: 1.35, streak: 0, mastered: false },
    good: { base: 24, mult: 2.1, streak: 1, mastered: null },
    easy: { base: 72, mult: 2.8, streak: 2, mastered: true },
  };

  const rule = rules[grade];
  if (!rule) return;

  let nextHours;
  if (grade === "again") {
    nextHours = rule.base;
  } else if (previous <= 0) {
    nextHours = rule.base;
  } else {
    nextHours = Math.max(rule.base, previous * rule.mult);
  }

  memory.intervalHours = Number(nextHours.toFixed(2));
  memory.dueAt = now + nextHours * 3600 * 1000;
  memory.reviews = (memory.reviews ?? 0) + 1;
  memory.lastReviewedAt = now;
  memory.lastGrade = grade;

  if (grade === "again") {
    memory.streak = 0;
    memory.lapses = (memory.lapses ?? 0) + 1;
    memory.mastered = false;
  } else {
    memory.streak = Math.max(0, (memory.streak ?? 0) + rule.streak);
    if (rule.mastered === true) {
      memory.mastered = true;
    } else if (rule.mastered === false) {
      memory.mastered = false;
    } else if (memory.streak >= 5 || memory.intervalHours >= 168) {
      memory.mastered = true;
    }
  }

  state.memory[id] = memory;
  saveJSON(STORAGE_KEYS.memory, state.memory);
}

function buildQuizQuestion() {
  const pool = getFilteredConcepts();
  const source = pool.length >= 4 ? pool : state.concepts;

  if (source.length < 4) {
    state.quiz.question = null;
    renderQuiz();
    return;
  }

  const target = pickRandom(source);
  const others = shuffle(source.filter((c) => c.id !== target.id)).slice(0, 3);
  const options = shuffle([target, ...others]);

  state.quiz.question = {
    targetId: target.id,
    prompt: target.atoms[1],
    options: options.map((item) => item.id),
    answered: false,
    selectedId: null,
  };
}

function renderQuiz() {
  const q = state.quiz.question;
  renderQuizSummary();

  if (!q) {
    el.quizCard.innerHTML = '<p class="muted">概念数量不足，无法生成测验。</p>';
    return;
  }

  const target = state.conceptById.get(q.targetId);
  if (!target) {
    el.quizCard.innerHTML = '<p class="muted">测验题加载失败，请下一题重试。</p>';
    return;
  }

  const optionsHtml = q.options
    .map((id) => {
      const concept = state.conceptById.get(id);
      if (!concept) return "";

      let cls = "quiz-option";
      if (q.answered) {
        if (id === q.targetId) cls += " correct";
        else if (id === q.selectedId && id !== q.targetId) cls += " wrong";
      }

      return `<button type="button" class="${cls}" data-id="${id}">${escapeHtml(concept.term)}</button>`;
    })
    .join("");

  let feedback = '<p class="quiz-feedback">请选择一个概念。</p>';
  if (q.answered) {
    const isCorrect = q.selectedId === q.targetId;
    feedback = `
      <p class="quiz-feedback">
        ${isCorrect ? "回答正确。" : "回答错误。"}
        正确答案：<strong>${escapeHtml(target.term)}</strong>
      </p>
      <p class="quiz-feedback">记忆提示：${escapeHtml(target.atoms[0])}</p>
    `;
  }

  el.quizCard.innerHTML = `
    <h3 class="quiz-title">这个原子描述对应哪个概念？</h3>
    <p class="quiz-sub">${escapeHtml(q.prompt)}</p>
    <div class="quiz-options">${optionsHtml}</div>
    ${feedback}
  `;
}

function answerQuiz(pickedId) {
  const q = state.quiz.question;
  if (!q || q.answered) return;

  q.answered = true;
  q.selectedId = pickedId;

  state.quizState.total = (state.quizState.total ?? 0) + 1;
  if (pickedId === q.targetId) {
    state.quizState.score = (state.quizState.score ?? 0) + 1;
  }
  saveJSON(STORAGE_KEYS.quiz, state.quizState);

  renderQuiz();
}

function renderQuizSummary() {
  const score = state.quizState.score ?? 0;
  const total = state.quizState.total ?? 0;
  const rate = total === 0 ? 0 : Math.round((score / total) * 100);
  el.quizSummary.textContent = `累计正确 ${score}/${total} · 正确率 ${rate}%`;
}

function selectConcept(id) {
  if (!state.conceptById.has(id)) return;
  state.selectedId = id;
  renderAtomGrid();
  renderDetail();
}

function getFilteredConcepts(options = {}) {
  const ignoreStatus = Boolean(options.ignoreStatus);
  const search = state.filters.search;

  let list = state.concepts.filter((concept) => {
    if (search && !concept.searchPool.includes(search)) {
      return false;
    }

    if (state.filters.categories.size && !state.filters.categories.has(concept.category)) {
      return false;
    }

    if (!ignoreStatus && state.filters.status !== "ALL") {
      const status = getStatus(concept.id);
      if (status !== state.filters.status) return false;
    }

    return true;
  });

  list = list.sort((a, b) => {
    const sa = statusSortValue(getStatus(a.id));
    const sb = statusSortValue(getStatus(b.id));
    if (sa !== sb) return sa - sb;
    return a.term.localeCompare(b.term, "zh-Hans-CN");
  });

  if (list.length && !list.some((item) => item.id === state.selectedId)) {
    state.selectedId = list[0].id;
  }

  return list;
}

function getDueConcepts() {
  const now = Date.now();
  return state.concepts
    .filter((concept) => {
      const memory = state.memory[concept.id];
      if (!memory || !memory.reviews) return true;
      return Boolean(memory.dueAt && memory.dueAt <= now);
    })
    .sort((a, b) => {
      const ma = state.memory[a.id];
      const mb = state.memory[b.id];
      const da = ma?.dueAt ?? 0;
      const db = mb?.dueAt ?? 0;
      return da - db;
    });
}

function getStatus(id) {
  const memory = state.memory[id];
  const now = Date.now();

  if (!memory || !memory.reviews) {
    return "NEW";
  }
  if (memory.dueAt && memory.dueAt <= now) {
    return "DUE";
  }
  if (memory.mastered) {
    return "MASTERED";
  }
  return "LEARNING";
}

function statusSortValue(status) {
  const mapping = {
    DUE: 0,
    LEARNING: 1,
    NEW: 2,
    MASTERED: 3,
  };
  return mapping[status] ?? 99;
}

function statusLabel(status) {
  const labels = {
    NEW: "新概念",
    LEARNING: "学习中",
    MASTERED: "已掌握",
    DUE: "到期复习",
  };
  return labels[status] ?? "未知";
}

function statusClass(status) {
  const cls = {
    NEW: "new",
    LEARNING: "learning",
    MASTERED: "mastered",
    DUE: "due",
  };
  return cls[status] ?? "new";
}

function ensureMemory(id) {
  if (!state.memory[id]) {
    state.memory[id] = {
      reviews: 0,
      streak: 0,
      lapses: 0,
      intervalHours: 0,
      dueAt: 0,
      mastered: false,
      lastGrade: "",
      lastReviewedAt: 0,
    };
  }
  return state.memory[id];
}

function countDoneAtoms() {
  return state.concepts.reduce((sum, concept) => sum + countDoneAtomsFor(concept.id), 0);
}

function countDoneAtomsFor(id) {
  const checks = state.atomChecks[id] ?? {};
  return Object.values(checks).filter(Boolean).length;
}

function isAtomChecked(id, index) {
  return Boolean(state.atomChecks[id]?.[index]);
}

function getRelatedConceptIds(id) {
  const concept = state.conceptById.get(id);
  if (!concept) return [];

  const sameCategory = state.conceptsByCategory.get(concept.category) ?? [];
  return sameCategory.filter((itemId) => itemId !== id).slice(0, 6);
}

function gradeLabel(grade) {
  const labels = {
    again: "没记住",
    hard: "模糊",
    good: "记住了",
    easy: "非常熟",
  };
  return labels[grade] ?? grade;
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
  localStorage.setItem(key, JSON.stringify(value));
}

function loadReadLines() {
  const raw = loadJSON(STORAGE_KEYS.readingLines, 0);
  if (typeof raw === "object" && raw !== null && "lines" in raw) {
    return sanitizeNonNegativeInt(raw.lines);
  }
  return sanitizeNonNegativeInt(raw);
}

function sanitizeNonNegativeInt(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function formatNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString("zh-CN");
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
