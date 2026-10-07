#!/usr/bin/env bash
set -u
cd "$(dirname "$0")"                 # lab/
BASE=/tmp/p3
FILES=(Makefile README.md service.py test_service.py)
mkdir -p answers
mapfile -t Q < <(sed -n '2,6p' QUESTIONS.md | sed 's/^[0-9]\+\. //')

for n in "$@"; do
  q="${Q[$((n-1))]}"
  dir="$BASE/q$n"
  echo "=== Q$n: $q"
  rm -rf "$dir"; mkdir -p "$dir"; cp -r demo/. "$dir"/
  : > "$dir/context.txt"
  for f in "${FILES[@]}"; do
    printf '### file: %s\n' "$f" >> "$dir/context.txt"
    cat "$dir/$f" >> "$dir/context.txt"
    printf '\n' >> "$dir/context.txt"
  done
  start=$(date +%s)
  ( cd "$dir" && OPENCODE_CONFIG="$dir/opencode.json" \
      timeout 1800 opencode run --agent local-guide --format json \
      -f context.txt "$q" ) > "answers/q$n.jsonl" 2> "answers/q$n.err"
  rc=$?
  end=$(date +%s)
  { echo "pwd: $dir"
    echo "вопрос: $q"
    echo "команда: cd $dir && OPENCODE_CONFIG=$dir/opencode.json opencode run --agent local-guide --format json -f context.txt \"$q\""
    echo "вложение: context.txt (Makefile, README.md, service.py, test_service.py)"
    echo "сумма_байт_вложения: $(wc -c < "$dir/context.txt")"
    echo "exit_code: $rc"
    echo "время_сек: $((end-start))"
    echo "--- ollama ps ---"; ollama ps
    echo "--- repo-system.txt в копии ---"; cat "$dir/repo-system.txt"
  } > "answers/q$n.meta.txt"
  echo "=== Q$n готово: rc=$rc, $((end-start)) с"
done
echo "ВСЁ ГОТОВО"
