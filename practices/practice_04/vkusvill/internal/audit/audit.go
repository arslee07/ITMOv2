// Package audit implements a static accessibility audit of Go html/template
// markup against the UI rules declared in AGENTS.md §4.
//
// The audit is intentionally line/regex based and stdlib-only: it is a fast
// heuristic gate for agents, not a full HTML parser. Rules:
//
//   - svg-missing-aria-hidden: a <svg> element without aria-hidden="true",
//     unless it is exposed as an image via role="img" or aria-label.
//   - icon-button-missing-label: a <button> whose accessible name is empty,
//     i.e. it has no aria-label/title and no visible text (only an icon).
//   - raw-emoji: an emoji character used anywhere in the template.
package audit

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

// Severity classifies how strongly a violation should block the work.
type Severity string

// Supported severities.
const (
	SeverityError   Severity = "error"
	SeverityWarning Severity = "warning"
)

// Violation is a single rule break found in a template file.
type Violation struct {
	File     string   `json:"file"`
	Line     int      `json:"line"`
	Rule     string   `json:"rule"`
	Severity Severity `json:"severity"`
	Snippet  string   `json:"snippet"`
}

// Report is the machine-readable result of auditing a directory.
type Report struct {
	Dir          string      `json:"dir"`
	FilesScanned int         `json:"files_scanned"`
	Errors       int         `json:"errors"`
	Warnings     int         `json:"warnings"`
	Violations   []Violation `json:"violations"`
}

var (
	reSVGOpen    = regexp.MustCompile(`(?is)<svg\b[^>]*>`)
	reButtonOpen = regexp.MustCompile(`(?is)<button\b`)
	reTag        = regexp.MustCompile(`(?s)<[^>]*>`)
	reAriaLabel  = regexp.MustCompile(`(?is)\baria-label\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))`)
	reAriaHidden = regexp.MustCompile(`(?is)\baria-hidden\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))`)
	reTitle      = regexp.MustCompile(`(?is)\btitle\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))`)
	reRole       = regexp.MustCompile(`(?is)\brole\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))`)
	reEmoji      = regexp.MustCompile(`[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}\x{2190}-\x{21FF}\x{FE0F}]`)
)

// AuditDir scans every *.html file under dir and returns the aggregated report.
func AuditDir(dir string) (*Report, error) {
	if strings.TrimSpace(dir) == "" {
		dir = "."
	}

	info, err := os.Stat(dir)
	if err != nil {
		return nil, fmt.Errorf("audit dir %q: %w", dir, err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("audit dir %q: not a directory", dir)
	}

	var files []string
	err = filepath.WalkDir(dir, func(path string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			return nil
		}
		if strings.EqualFold(filepath.Ext(path), ".html") {
			files = append(files, path)
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("walk %q: %w", dir, err)
	}
	sort.Strings(files)

	report := &Report{Dir: dir, Violations: []Violation{}}
	for _, path := range files {
		content, readErr := os.ReadFile(path)
		if readErr != nil {
			return nil, fmt.Errorf("read %q: %w", path, readErr)
		}
		report.FilesScanned++
		report.Violations = append(report.Violations, auditFile(path, string(content))...)
	}

	sort.SliceStable(report.Violations, func(i, j int) bool {
		if report.Violations[i].File != report.Violations[j].File {
			return report.Violations[i].File < report.Violations[j].File
		}
		if report.Violations[i].Line != report.Violations[j].Line {
			return report.Violations[i].Line < report.Violations[j].Line
		}
		return report.Violations[i].Rule < report.Violations[j].Rule
	})
	for _, v := range report.Violations {
		if v.Severity == SeverityError {
			report.Errors++
		} else {
			report.Warnings++
		}
	}
	return report, nil
}

func auditFile(path, content string) []Violation {
	var out []Violation

	for _, m := range reSVGOpen.FindAllStringIndex(content, -1) {
		tag := content[m[0]:m[1]]
		if hasAttributeValue(tag, reAriaHidden, "true") {
			continue
		}
		if hasAttribute(tag, reRole) || hasAttribute(tag, reAriaLabel) {
			continue
		}
		out = append(out, Violation{
			File:     path,
			Line:     lineAt(content, m[0]),
			Rule:     "svg-missing-aria-hidden",
			Severity: SeverityWarning,
			Snippet:  compact(tag),
		})
	}

	for _, btn := range scanButtons(content) {
		name := accessibleName(btn.openTag, btn.inner)
		if name == "" {
			out = append(out, Violation{
				File:     path,
				Line:     lineAt(content, btn.offset),
				Rule:     "icon-button-missing-label",
				Severity: SeverityError,
				Snippet:  compact(btn.openTag),
			})
		}
	}

	for _, m := range reEmoji.FindAllStringIndex(content, -1) {
		out = append(out, Violation{
			File:     path,
			Line:     lineAt(content, m[0]),
			Rule:     "raw-emoji",
			Severity: SeverityWarning,
			Snippet:  compact(content[m[0]:m[1]]),
		})
	}

	return out
}

type buttonElem struct {
	openTag string
	inner   string
	offset  int
}

// scanButtons finds <button> elements without assuming well-formed nesting,
// which is enough for the flat markup used by this project's templates.
func scanButtons(content string) []buttonElem {
	var out []buttonElem
	for _, m := range reButtonOpen.FindAllStringIndex(content, -1) {
		start := m[0]
		gt := strings.IndexByte(content[start:], '>')
		if gt < 0 {
			break
		}
		openEnd := start + gt + 1
		openTag := content[start:openEnd]

		closeIdx := strings.Index(strings.ToLower(content[openEnd:]), "</button>")
		inner := ""
		if closeIdx >= 0 {
			inner = content[openEnd : openEnd+closeIdx]
		}
		out = append(out, buttonElem{openTag: openTag, inner: inner, offset: start})
	}
	return out
}

// accessibleName returns a non-empty name when the button is labelled either by
// an attribute or by visible text. Go template actions are treated as text
// because they render to text.
func accessibleName(openTag, inner string) string {
	if v, ok := attributeValue(openTag, reAriaLabel); ok && strings.TrimSpace(v) != "" {
		return v
	}
	if v, ok := attributeValue(openTag, reTitle); ok && strings.TrimSpace(v) != "" {
		return v
	}
	text := reTag.ReplaceAllString(inner, "")
	return strings.TrimSpace(text)
}

func hasAttribute(tag string, re *regexp.Regexp) bool {
	_, ok := attributeValue(tag, re)
	return ok
}

func hasAttributeValue(tag string, re *regexp.Regexp, want string) bool {
	v, ok := attributeValue(tag, re)
	return ok && strings.EqualFold(strings.TrimSpace(v), want)
}

func attributeValue(tag string, re *regexp.Regexp) (string, bool) {
	m := re.FindStringSubmatch(tag)
	if m == nil {
		return "", false
	}
	switch {
	case m[2] != "":
		return m[2], true
	case m[3] != "":
		return m[3], true
	default:
		return m[4], true
	}
}

func lineAt(content string, offset int) int {
	if offset > len(content) {
		offset = len(content)
	}
	return strings.Count(content[:offset], "\n") + 1
}

func compact(s string) string {
	s = strings.Join(strings.Fields(s), " ")
	const max = 120
	if len(s) > max {
		s = s[:max] + "…"
	}
	return s
}
