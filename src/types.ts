/* ── Shared type definitions for the interview memory site ── */

/** A single flashcard as stored in cards.json and returned by the API. */
export interface Card {
    id: string;
    term: string;
    category: string;
    core: string;
    boundary: string;
    signal: string;
    action: string;
    aliases: string[];
}

/** A Card enriched with derived fields used only on the client side. */
export interface Concept extends Card {
    atoms: string[];
    searchPool: string;
}

/** Spaced‑repetition state persisted per concept in localStorage. */
export interface MemoryRecord {
    reviews: number;
    streak: number;
    lapses: number;
    intervalHours: number;
    dueAt: number;
    mastered: boolean;
    lastGrade: Grade | "";
    lastReviewedAt: number;
}

/** Possible grades for a drill card. */
export type Grade = "again" | "hard" | "good" | "easy";

/** Status derived from a concept's MemoryRecord. */
export type ConceptStatus = "NEW" | "LEARNING" | "MASTERED" | "DUE";

/** Status filter option shown in the UI. */
export interface StatusOption {
    key: string;   // "ALL" | ConceptStatus
    label: string;
}

/** Quiz question state. */
export interface QuizQuestion {
    targetId: string;
    prompt: string;
    options: string[];
    answered: boolean;
    selectedId: string | null;
}

/** Cumulative quiz score persisted in localStorage. */
export interface QuizState {
    score: number;
    total: number;
}

/* ── Lecture deck types ── */

export interface LectureCard {
    id: string;
    front: string;
    back: string;
    hint: string;
    tags: string[];
}

export interface LectureDeck {
    deckId: string;
    title: string;
    description: string;
    cards: LectureCard[];
    updatedAt: string;
}

export interface LectureProgress {
    [cardId: string]: number; // level 0‑3
}
