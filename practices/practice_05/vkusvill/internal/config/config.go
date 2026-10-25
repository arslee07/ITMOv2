package config

import (
	"os"
	"strconv"
)

// Config holds runtime configuration settings.
type Config struct {
	Port         string
	MCPURL       string
	WarmMaxPages int
}

// Load reads configuration from environment variables or applies sensible defaults.
func Load() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mcpURL := os.Getenv("MCP_URL")
	if mcpURL == "" {
		mcpURL = "https://mcp.vkusvill.ru/mcp"
	}

	// WARM_MAX_PAGES caps the background catalog sweep; 0 means "all pages".
	warmMaxPages := 0
	if raw := os.Getenv("WARM_MAX_PAGES"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			warmMaxPages = n
		}
	}

	return &Config{
		Port:         port,
		MCPURL:       mcpURL,
		WarmMaxPages: warmMaxPages,
	}
}
