package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

// ────────── Configuration ──────────

var (
	rootDir  string
	distDir  string // Vite build output, used in production
	dataDir  string
	dataFile string
	port     string
)

func init() {
	exe, err := os.Executable()
	if err != nil {
		log.Fatal("cannot detect executable path:", err)
	}
	rootDir = filepath.Dir(exe)

	// In development, use the current working directory.
	if cwd, err := os.Getwd(); err == nil {
		rootDir = cwd
	}

	distDir = filepath.Join(rootDir, "dist")
	dataDir = filepath.Join(rootDir, "data")
	dataFile = filepath.Join(dataDir, "cards.json")
	port = os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
}

// ────────── Card model ──────────

type Card struct {
	ID       string   `json:"id"`
	Term     string   `json:"term"`
	Category string   `json:"category"`
	Core     string   `json:"core"`
	Boundary string   `json:"boundary"`
	Signal   string   `json:"signal"`
	Action   string   `json:"action"`
	Aliases  []string `json:"aliases"`
}

// ────────── Thread‑safe JSON file store ──────────

var mu sync.Mutex

func ensureDataFile() {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		log.Fatal("cannot create data dir:", err)
	}
	if _, err := os.Stat(dataFile); os.IsNotExist(err) {
		if err := os.WriteFile(dataFile, []byte("[]"), 0o644); err != nil {
			log.Fatal("cannot create data file:", err)
		}
	}
}

func readCards() ([]Card, error) {
	mu.Lock()
	defer mu.Unlock()
	ensureDataFile()

	raw, err := os.ReadFile(dataFile)
	if err != nil {
		return nil, err
	}
	var cards []Card
	if err := json.Unmarshal(raw, &cards); err != nil {
		return nil, err
	}
	return cards, nil
}

func writeCards(cards []Card) error {
	data, err := json.MarshalIndent(cards, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(dataFile, data, 0o644)
}

// ────────── Validation ──────────

var slugRe = regexp.MustCompile(`[^a-z0-9\x{4e00}-\x{9fa5}]+`)

func slugify(text string) string {
	lower := strings.ToLower(text)
	slug := slugRe.ReplaceAllString(lower, "-")
	slug = strings.Trim(slug, "-")
	if utf8.RuneCountInString(slug) > 80 {
		runes := []rune(slug)
		slug = string(runes[:80])
	}
	return slug
}

func validateCard(input Card, cards []Card, existingID string) (Card, error) {
	term := strings.TrimSpace(input.Term)
	category := strings.TrimSpace(input.Category)
	core := strings.TrimSpace(input.Core)
	boundary := strings.TrimSpace(input.Boundary)
	signal := strings.TrimSpace(input.Signal)
	action := strings.TrimSpace(input.Action)

	if term == "" || category == "" || core == "" || boundary == "" || signal == "" || action == "" {
		return Card{}, fmt.Errorf("term/category/core/boundary/signal/action 均为必填")
	}

	aliases := make([]string, 0)
	for _, a := range input.Aliases {
		a = strings.TrimSpace(a)
		if a != "" {
			aliases = append(aliases, a)
		}
	}

	id := strings.TrimSpace(input.ID)
	if id == "" {
		id = slugify(term)
	}
	if id == "" {
		id = fmt.Sprintf("card-%d", time.Now().UnixMilli())
	}

	for _, c := range cards {
		if c.ID == id && c.ID != existingID {
			return Card{}, fmt.Errorf("卡片 id 已存在: %s", id)
		}
	}

	return Card{
		ID:       id,
		Term:     term,
		Category: category,
		Core:     core,
		Boundary: boundary,
		Signal:   signal,
		Action:   action,
		Aliases:  aliases,
	}, nil
}

// ────────── HTTP helpers ──────────

func jsonResponse(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func readBody(r *http.Request) (Card, error) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1024*1024))
	if err != nil {
		return Card{}, err
	}
	defer r.Body.Close()

	if len(strings.TrimSpace(string(body))) == 0 {
		return Card{}, nil
	}

	var card Card
	if err := json.Unmarshal(body, &card); err != nil {
		return Card{}, fmt.Errorf("请求体不是合法 JSON")
	}
	return card, nil
}

// ────────── API handlers ──────────

func handleAPICards(w http.ResponseWriter, r *http.Request) {
	// Extract the ID segment from the path, if any.
	// Path formats: /api/cards  or  /api/cards/{id}
	trimmed := strings.TrimPrefix(r.URL.Path, "/api/cards")
	trimmed = strings.TrimPrefix(trimmed, "/")
	id := strings.TrimSpace(trimmed)

	if id == "" {
		handleCardsCollection(w, r)
	} else {
		handleCardByID(w, r, id)
	}
}

func handleCardsCollection(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		cards, err := readCards()
		if err != nil {
			jsonResponse(w, 500, map[string]string{"error": "读取卡片失败", "detail": err.Error()})
			return
		}
		jsonResponse(w, 200, cards)

	case http.MethodPost:
		input, err := readBody(r)
		if err != nil {
			jsonResponse(w, 400, map[string]string{"error": err.Error()})
			return
		}
		mu.Lock()
		defer mu.Unlock()
		ensureDataFile()
		raw, _ := os.ReadFile(dataFile)
		var cards []Card
		json.Unmarshal(raw, &cards)

		validated, err := validateCard(input, cards, "")
		if err != nil {
			jsonResponse(w, 400, map[string]string{"error": err.Error()})
			return
		}
		cards = append(cards, validated)
		if err := writeCards(cards); err != nil {
			jsonResponse(w, 500, map[string]string{"error": "写入失败"})
			return
		}
		jsonResponse(w, 201, validated)

	default:
		jsonResponse(w, 405, map[string]string{"error": "Method Not Allowed"})
	}
}

func handleCardByID(w http.ResponseWriter, r *http.Request, id string) {
	mu.Lock()
	defer mu.Unlock()
	ensureDataFile()

	raw, _ := os.ReadFile(dataFile)
	var cards []Card
	json.Unmarshal(raw, &cards)

	index := -1
	for i, c := range cards {
		if c.ID == id {
			index = i
			break
		}
	}

	switch r.Method {
	case http.MethodGet:
		if index == -1 {
			jsonResponse(w, 404, map[string]string{"error": "卡片不存在"})
			return
		}
		jsonResponse(w, 200, cards[index])

	case http.MethodPut:
		if index == -1 {
			jsonResponse(w, 404, map[string]string{"error": "卡片不存在"})
			return
		}
		input, err := readBody(r)
		if err != nil {
			jsonResponse(w, 400, map[string]string{"error": err.Error()})
			return
		}
		input.ID = id
		validated, err := validateCard(input, cards, id)
		if err != nil {
			jsonResponse(w, 400, map[string]string{"error": err.Error()})
			return
		}
		cards[index] = validated
		if err := writeCards(cards); err != nil {
			jsonResponse(w, 500, map[string]string{"error": "写入失败"})
			return
		}
		jsonResponse(w, 200, validated)

	case http.MethodDelete:
		if index == -1 {
			jsonResponse(w, 404, map[string]string{"error": "卡片不存在"})
			return
		}
		removed := cards[index]
		cards = append(cards[:index], cards[index+1:]...)
		if err := writeCards(cards); err != nil {
			jsonResponse(w, 500, map[string]string{"error": "写入失败"})
			return
		}
		jsonResponse(w, 200, map[string]any{"ok": true, "removed": removed})

	default:
		jsonResponse(w, 405, map[string]string{"error": "Method Not Allowed"})
	}
}

// ────────── MIME types ──────────

var mimeTypes = map[string]string{
	".css":   "text/css; charset=utf-8",
	".html":  "text/html; charset=utf-8",
	".js":    "text/javascript; charset=utf-8",
	".ts":    "text/javascript; charset=utf-8",
	".json":  "application/json; charset=utf-8",
	".png":   "image/png",
	".svg":   "image/svg+xml",
	".txt":   "text/plain; charset=utf-8",
	".webp":  "image/webp",
	".mp4":   "video/mp4",
	".ico":   "image/x-icon",
	".woff":  "font/woff",
	".woff2": "font/woff2",
}

// ────────── Static file routes ──────────

var routeAliases = map[string]string{
	"/":         "/index.html",
	"/admin":    "/admin.html",
	"/roadmap":  "/roadmap.html",
	"/lecture0": "/lecture0.html",
	"/lecture1": "/lecture1.html",
	"/lecture2": "/lecture2.html",
	"/lecture3": "/lecture3.html",
	"/lecture4": "/lecture4.html",
	"/lecture5": "/lecture5.html",
	"/lecture6": "/lecture6.html",
}

func serveStatic(w http.ResponseWriter, r *http.Request) {
	urlPath := r.URL.Path

	// Apply route aliases
	if alias, ok := routeAliases[urlPath]; ok {
		urlPath = alias
	}

	// Prevent directory traversal
	cleaned := filepath.Clean(urlPath)

	// Try dist/ first (production build), then rootDir (dev fallback)
	var absPath string
	distPath := filepath.Join(distDir, cleaned)
	rootPath := filepath.Join(rootDir, cleaned)

	if _, err := os.Stat(distPath); err == nil && strings.HasPrefix(distPath, distDir) {
		absPath = distPath
	} else if strings.HasPrefix(rootPath, rootDir) {
		absPath = rootPath
	} else {
		jsonResponse(w, 403, map[string]string{"error": "禁止访问"})
		return
	}

	content, err := os.ReadFile(absPath)
	if err != nil {
		if os.IsNotExist(err) {
			http.Error(w, "Not Found", 404)
		} else {
			http.Error(w, "Internal Error", 500)
		}
		return
	}

	ext := strings.ToLower(filepath.Ext(absPath))
	contentType := mimeTypes[ext]
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Content-Type", contentType)
	w.WriteHeader(200)
	w.Write(content)
}

// ────────── Main ──────────

func main() {
	ensureDataFile()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/cards", handleAPICards)
	mux.HandleFunc("/api/cards/", handleAPICards)
	mux.HandleFunc("/", serveStatic)

	addr := ":" + port
	if _, err := os.Stat(distDir); err == nil {
		log.Printf("Serving production build from dist/")
	} else {
		log.Printf("dist/ not found — serving from project root (dev mode)")
	}
	log.Printf("Go server running at http://127.0.0.1%s\n", addr)

	server := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Server failed: %v\n", err)
	}
}
