package audit

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestAuditDirRules(t *testing.T) {
	tests := []struct {
		name         string
		files        map[string]string
		wantErrors   int
		wantWarnings int
		wantRules    map[string]int
	}{
		{
			name:  "clean markup has no violations",
			files: map[string]string{"clean.html": `<button aria-label="Найти"><svg aria-hidden="true"></svg></button>`},
		},
		{
			name:         "svg without aria-hidden is a warning",
			files:        map[string]string{"a.html": `<svg class="w-4 h-4" viewBox="0 0 24 24"></svg>`},
			wantWarnings: 1,
			wantRules:    map[string]int{"svg-missing-aria-hidden": 1},
		},
		{
			name:  "svg with role img is allowed",
			files: map[string]string{"a.html": `<svg role="img" aria-label="Логотип"></svg>`},
		},
		{
			name:       "icon-only button without label is an error",
			files:      map[string]string{"a.html": `<button type="button"><svg aria-hidden="true"></svg></button>`},
			wantErrors: 1,
			wantRules:  map[string]int{"icon-button-missing-label": 1},
		},
		{
			name:  "icon button with aria-label is allowed",
			files: map[string]string{"a.html": `<button aria-label="Рядом со мной"><svg aria-hidden="true"></svg></button>`},
		},
		{
			name:  "button with visible text is allowed",
			files: map[string]string{"a.html": `<button>Все точки</button>`},
		},
		{
			name:         "raw emoji is a warning",
			files:        map[string]string{"a.html": `<span>☕ Кафе</span>`},
			wantWarnings: 1,
			wantRules:    map[string]int{"raw-emoji": 1},
		},
		{
			name: "violations aggregate across files and keep line numbers",
			files: map[string]string{
				"index.html":   "<html>\n<svg></svg>\n</html>\n",
				"partial.html": "<div>\n<button><svg aria-hidden=\"true\"></svg></button>\n</div>\n",
			},
			wantErrors:   1,
			wantWarnings: 1,
			wantRules: map[string]int{
				"svg-missing-aria-hidden":   1,
				"icon-button-missing-label": 1,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			for name, content := range tt.files {
				path := filepath.Join(dir, name)
				if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
					t.Fatalf("write fixture %s: %v", name, err)
				}
			}

			report, err := AuditDir(dir)
			if err != nil {
				t.Fatalf("AuditDir() error = %v", err)
			}
			if report.Errors != tt.wantErrors {
				t.Errorf("Errors = %d, want %d", report.Errors, tt.wantErrors)
			}
			if report.Warnings != tt.wantWarnings {
				t.Errorf("Warnings = %d, want %d", report.Warnings, tt.wantWarnings)
			}
			if report.FilesScanned != len(tt.files) {
				t.Errorf("FilesScanned = %d, want %d", report.FilesScanned, len(tt.files))
			}

			got := map[string]int{}
			for _, v := range report.Violations {
				got[v.Rule]++
			}
			if len(got) != len(tt.wantRules) {
				t.Fatalf("rule set = %v, want %v", got, tt.wantRules)
			}
			for rule, count := range tt.wantRules {
				if got[rule] != count {
					t.Errorf("rule %q = %d, want %d", rule, got[rule], count)
				}
			}
		})
	}
}

func TestAuditDirLineNumbers(t *testing.T) {
	dir := t.TempDir()
	content := "<html>\n  <body>\n    <svg></svg>\n  </body>\n</html>\n"
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}

	report, err := AuditDir(dir)
	if err != nil {
		t.Fatalf("AuditDir() error = %v", err)
	}
	if len(report.Violations) != 1 {
		t.Fatalf("len(Violations) = %d, want 1", len(report.Violations))
	}
	if got := report.Violations[0].Line; got != 3 {
		t.Errorf("Line = %d, want 3", got)
	}
}

func TestAuditDirInvalidInput(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "does-not-exist")
	if _, err := AuditDir(missing); err == nil {
		t.Fatal("AuditDir(missing) error = nil, want error")
	} else if !errors.Is(err, os.ErrNotExist) {
		t.Errorf("error = %v, want to wrap os.ErrNotExist", err)
	}

	file := filepath.Join(t.TempDir(), "plain.html")
	if err := os.WriteFile(file, []byte("<svg></svg>"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := AuditDir(file); err == nil {
		t.Fatal("AuditDir(file) error = nil, want error")
	}
}
