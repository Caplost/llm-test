package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// Version will be set during build
var Version = "development"

// Response represents a standard API response
type Response struct {
	Status  string      `json:"status"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

// Configuration from environment variables
func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

// setupLogging configures the logger
func setupLogging() {
	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)
	log.Println("Server starting... Version:", Version)
}

// corsMiddleware adds CORS headers to all responses
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// loggingMiddleware logs all requests
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.RequestURI, time.Since(start))
	})
}

// healthHandler provides a simple health check endpoint
func healthHandler(w http.ResponseWriter, r *http.Request) {
	resp := Response{
		Status:  "success",
		Message: "Service is healthy",
		Data: map[string]string{
			"version": Version,
			"time":    time.Now().Format(time.RFC3339),
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// staticFileHandler serves static files
func staticFileHandler(dir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Get the path from the URL
		path := r.URL.Path

		// Default to index.html for the root path
		if path == "/" {
			path = "/index.html"
		}

		// Build the file path
		filePath := filepath.Join(dir, path)

		// Check if file exists
		_, err := os.Stat(filePath)
		if os.IsNotExist(err) {
			// If the file doesn't exist, serve index.html (for SPA routing)
			filePath = filepath.Join(dir, "index.html")
		}

		http.ServeFile(w, r, filePath)
	}
}

func main() {
	setupLogging()

	// Get configuration from environment variables
	port := getEnv("PORT", "8080")
	staticDir := getEnv("STATIC_DIR", "./llm-streaming-tester")
	version := getEnv("VERSION", Version)

	// Update Version if set via environment
	if version != Version {
		Version = version
		log.Println("Version updated from environment:", Version)
	}

	// Create a new servemux with the new Go 1.22 features
	mux := http.NewServeMux()

	// Register API routes
	mux.HandleFunc("GET /api/health", healthHandler)

	// Serve static files for all other routes
	mux.HandleFunc("/{$}", staticFileHandler(staticDir))

	// Apply middleware
	var handler http.Handler = mux
	handler = loggingMiddleware(handler)
	handler = corsMiddleware(handler)

	// Start the server
	addr := fmt.Sprintf(":%s", port)
	log.Printf("Server listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, handler))
}
