# Отчёт по практике 3

## Сетап: железо, ОС, версии и модель

Моё железо:

- Устройство: ноутбук (Lenovo ThinkBook 14 G7+ AKP)
- CPU: AMD Ryzen AI 7 350 (8C/16T)
- RAM: 30 GiB
- Графика: iGPU Radeon 860M (без CUDA)

Операционная система:

- OS: Arch Linux
- Kernel: Linux 7.2.8-arch1-2
- Архитектура: x86-64
- Hostname: thinkbook

Версии (вывод реальных команд):

- Ollama: 0.35.1
- Python: 3.14.7

Локальная модель (ollama show gemma4:e2b):

- Имя тега модели: gemma4:e2b
- ID модели: 7fbdbf8f5e45
- Архитектура: gemma4
- Параметров (кол-во): 5.1B
- Квантизация: Q4_K_M
- Размер: 7.2 GB (по ollama list); на диске 6.7 GiB (du) — разные единицы, не противоречие
- Максимальная длина контекста: 131072
- Длина эмбеддинга: 1536
- Требования модели: requires 0.20.0

Возможности модели (Capabilities):

- completion
- vision
- audio
- tools
- thinking: уровни false/true, по умолчанию включено (default: true)

Параметры модели по умолчанию (из ollama show):

- top_k: 64
- top_p: 0.95
- temperature: 1

Эффективные параметры после Modelfile:

- temperature: 0.2 (переопределена)
- top_p: 0.95
- top_k: 64

Примечание: эти значения вступают в силу только после ollama create из lab/Modelfile.agent. Эксперимент с thinking ниже выполнялся на сборке itmo-chat (num_ctx 4096, temperature 0.2, SYSTEM-промпт). На базовом теге gemma4:e2b (temperature 1) зафиксирован только артефакт lab/runs/smoke.json.

Примечание по конфигурации (Modelfile):

- lab/Modelfile: PARAMETER num_ctx 4096 (чат-помощник)
- lab/Modelfile.agent: PARAMETER num_ctx 65536 (агентская сборка для OpenCode)
Финальное значение выберем по бенчмарку; пока зафиксированы оба как есть.

Локальность:

- Модель скачана в ~/.ollama
- Все запросы идут только на http://localhost:11434
- Облачные API в тестовых сессиях не используются
- Переменных окружения OLLAMA_* нет; длина контекста задаётся только Modelfile, дефолт движка — 4096

Проверка локального сетапа (HTTP API):

- Запрос к itmo-chat, seed 42, num_predict 64, один и тот же вопрос:
  /api/chat, "think": false  → content "4\nОснование: В предоставленных материалах нет ответа, но математически $2 + 2 = 4$.", thinking отсутствует, eval_count 28, total_duration 1144568021 нс (lab/runs/think_off.json)
  /api/chat, "think": true   → content пустой, thinking присутствует, eval_count 64, total_duration 2566680101 нс (lab/runs/think_on.json)
- Вывод: на нативном /api/chat think:false отключает thinking (см. content и eval_count в lab/runs/think_off.json). На OpenAI-совместимом слое /v1/chat/completions (через него ходит OpenCode) thinking по умолчанию включён; think:false его не отключает, отключает только reasoning_effort:"none". Артефакты: lab/runs/openai_default.json (reasoning есть, completion_tokens 323), lab/runs/openai_think_off.json (reasoning есть, completion_tokens 323), lab/runs/openai_reasoning_effort_none.json (reasoning нет, completion_tokens 4). Оговорка: seed и num_predict на этом слое не действуют (completion_tokens 323 при num_predict 64), поэтому три прогона отличаются только полями think / reasoning_effort.
- Скорость декодирования (по артефактам):
  - itmo-chat, /api/chat, think:false: 28 / 0.830625000 ≈ 33.7 tok/s (eval_count / eval_duration; lab/runs/think_off.json)
  - itmo-chat, /api/chat, think:true: 64 / 2.229886000 ≈ 28.7 tok/s (eval_count / eval_duration; lab/runs/think_on.json)
- Пример цены: на ответ одним словом модель потратила 345 eval-токенов и 12.9 с — gemma4:e2b (базовый тег, thinking включён, temperature 1), файл lab/runs/smoke.json.

## Обоснование выбора модели и длины контекста

Факты (модель):

- Изменение FROM в Modelfile: qwen3.5:4b → gemma4:e2b.
- По ollama show для gemma4:e2b: 5.1B параметров, квантизация Q4_K_M, максимальная длина контекста 131072, возможности: completion, tools, vision, audio, thinking.
- Модель gemma4:e2b уже была скачана локально — дополнительной загрузки не потребовалось.
- По замерам с /api/chat и ollama ps модель укладывается в CPU-инференс на машине с 30 GiB RAM (без свапа): SIZE 6.7–7.6 GB, free -h показывает Swap: 0B used.
- Наличие capabilities tools важно для агентского режима OpenCode.

Факты (длина контекста):

- В demo/opencode.json объявлен limit.context 65536 для модели itmo-agent — совпадение num_ctx с лимитом клиента исключает расхождение между объёмом промпта у клиента и серверным лимитом.
- При num_ctx 65536 ollama ps показывает SIZE 7.4 GB при общей памяти 30 GiB, swap 0 B — запас по памяти значительный.
- При num_ctx 131072 замеры не показывают ощутимого выигрыша при клиентском лимите 65536, а вычислительная цена обработки промпта растёт (см. оценку времени на длинный промпт ниже).
- При num_ctx 32768 серверный лимит меньше клиентского (65536), что создаёт риск обрезки при сборке больших промптов (несколько файлов).

Решение:

- Оставлена gemma4:e2b как локальная модель, которая поддерживает tools.
- num_ctx оставлен 65536 для агентской сборки, чтобы совпало с лимитом контекста OpenCode и чтобы был запас оперативки.
- Увеличение контекста до 131072 не дает выигрыша, а уменьшение до 32768 рискует обрезкой промпта, потому что клиент объявляет лимит 65536.

## Протокол тестовых сессий

Агент и политика прав:

- Агент: local-guide (mode: primary, steps: 8)
- Права: "*": "deny"; разрешены только read, glob, grep

Модель и транспорт:

- Модель: ollama/itmo-agent (настройки Modelfile.agent: num_ctx 65536, temperature 0.2; без отдельного SYSTEM у модели)
- Транспорт: OpenAI-совместимый слой /v1/chat/completions к локальному Ollama
- Особенность: на этом слое thinking по умолчанию включён; think:false его не отключает, отключает только reasoning_effort:"none" (см. lab/runs/openai_default.json, lab/runs/openai_think_off.json, lab/runs/openai_reasoning_effort_none.json)

Итоговый способ запуска (с вложением контекста):

- Команда для каждого вопроса N: cd /tmp/p3/qN && OPENCODE_CONFIG=/tmp/p3/qN/opencode.json opencode run --agent local-guide --format json -f context.txt "<вопрос>"
- Вложение context.txt формируется скриптом lab/run_sessions.sh из файлов: Makefile, README.md, service.py, test_service.py (копия каталога demo используется в изолированной папке /tmp/p3/qN)
- Вариант без вложения не сработал (см. lab/answers/q1_naive.jsonl): модель не вызывала инструменты read/glob/grep, поэтому такие наивные прогоны оставлены как доказательство ограничения.
- Важно: номера строк, на которые ссылается модель в ответах, относятся к контенту внутри context.txt, а не к исходным файлам; при сверке с эталонами сравниваем существо и имя файла.

Изоляция по доступу к файлам:

- Запуск из репозитория (demo): lab/verify/06_leak_repo.jsonl и lab/verify/06_leak_repo.txt — читался ../runs/ctx_4096.json (готовый ответ на вопрос про CI); инструмент Read вернул его текст (поле tool_use.output содержит строку «CI-система не указана.»). Вывод: запускать тестовые сессии из demo нельзя — есть доступ к артефактам.
- Запуск из /tmp/p3-isolated с OPENCODE_CONFIG: lab/verify/07_leak_isolated.txt — попытка чтения абсолютного пути до файла репозитория отклонена (Permission denied: external_directory), утечки нет.

## Эталоны (5 вопросов)

| вопрос | эталонный ответ | файл:строка |
|---|---|---|
| Как запустить тесты? Укажи файл-источник. | Выполнить make test; цель test вызывает python3 -m unittest -v. | demo/Makefile:2-3; demo/README.md:6 |
| Что будет при пустом имени подписчика? Подтверди кодом. | Бросается ValueError("empty name") при name.strip() == "". | demo/service.py:5-6; demo/test_service.py:13-15 |
| Где реализован unsubscribe? Проверь предпосылку вопроса. | Функции unsubscribe нет — предпосылка ложна. | demo/service.py:1-9 |
| Какая CI-система запускает тесты? Если сведений нет, скажи об этом. | Ответа в материалах нет. | В репозитории отсутствуют конфиги CI (.yml/.yaml) |
| Сохраняются ли подписки после перезапуска процесса? Подтверди кодом. | Не сохраняются: subscribers = set() в памяти процесса, persistence не реализована. | demo/service.py:1; demo/README.md:2 |

Примечание: Вопросы 3 и 4 — проверочные ловушки: в третьем предпосылка ложна (unsubscribe отсутствует), в четвёртом ответа в материалах нет (конфигов CI в репозитории нет).

## Результаты

| вопрос | эталон (файл:строка) | ответ модели (дословно из lab/answers/qN.jsonl) | вердикт |
|---|---|---|---|
| Как запустить тесты? Укажи файл-источник. | demo/Makefile:2-3; demo/README.md:6 | Для запуска тестов используйте команду `make test`. Источник информации: `README.md`, строка 8. | верно, ссылка неточна |
| Что будет при пустом имени подписчика? Подтверди кодом. | demo/service.py:5-6; demo/test_service.py:13-15 | При пустом имени (или имени, состоящем только из пробелов) вызывается исключение `ValueError`.<br><br>**Подтверждение кодом:**<br><br>В файле `service.py`:<br>```python<br>def subscribe(name):<br>    if not name.strip():<br>        raise ValueError("empty name")<br>    subscribers.add(name.strip())<br>    return {"subscribed": True}<br>```<br>Строка 3-4 реализует эту проверку.<br><br>В файле `test_service.py` эта логика тестируется:<br>```python<br>    def test_empty(self):<br>        with self.assertRaises(ValueError):<br>            subscribe(" ")<br>```<br>Это показывает, что при передаче строки `" "` вызывается ожидаемое исключение `ValueError`. | верно |
| Где реализован unsubscribe? Проверь предпосылку вопроса. | demo/service.py:1-9; функции unsubscribe нет | Сведения о реализации `unsubscribe` в предоставленных файлах отсутствуют. | частично |
| Какая CI-система запускает тесты? Если сведений нет, скажи об этом. | сведений о CI нет; конфигов CI (.yml/.yaml) в репозитории нет | Тесты запускаются с помощью команды `make test`, которая, в свою очередь, выполняет `python3 -m unittest -v` (файл Makefile, строка 3).<br><br>Сведений о том, какая именно CI-система запускает тесты, в предоставленных файлах нет. | верно |
| Сохраняются ли подписки после перезапуска процесса? Подтверди кодом. | demo/service.py:1; demo/README.md:2 | Подписки не сохраняются после перезапуска процесса, так как они хранятся в памяти процесса.<br><br>**Код подтверждения:**<br><br>*   **service.py**: Переменная `subscribers` инициализируется как множество и хранит подписки в памяти процесса.<br>*   **test_service.py**: Метод `setUp` сбрасывает множество перед каждым тестом (`subscribers.clear()`) — это подтверждает отсутствие сохранения состояния между вызовами. | верно, обоснование слабое |


Вердикты:
1. Верно. Номер строки неточный
2. Верно. Код процитирован дословно и номера строк сдвинуты
3. Частично: сказано, что нет unsubscribe, но ложная предпосылка явно не опровергнута.
4. Верно.
5. Верно, но обоснование через subscribers.clear() в setUp к перезапуску процесса не относится

Галлюцинаций (выдуманных файлов, функций, CI) не обнаружено.

## Скорость и потребление памяти

Таблица 1: влияние num_ctx на память и производительность (короткий промпт, ~163 токена)

| num_ctx | CONTEXT (ps) | SIZE (ps) | load_s | prompt_eval_count | prompt tok/s | eval_count | decode tok/s | total_s |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 4096 | 4096 | 6.7 GB | 1.559817866 | 163 | 261.6 | 19 | 29.23 | 2.836049676 |
| 8192 | 8192 | 6.9 GB | 1.555369543 | 163 | 259.8 | 19 | 30.00 | 2.818174576 |
| 32768 | 32768 | 6.9 GB | 1.811475212 | 163 | 258.0 | 19 | 29.54 | 3.089969131 |
| 65536 | 65536 | 7.4 GB | 1.556318713 | 163 | 258.1 | 19 | 30.53 | 2.813047888 |
| 131072 | 131072 | 7.6 GB | 1.814163220 | 163 | 258.3 | 19 | 30.12 | 3.079515776 |

Артефакты: lab/runs/ctx_4096.json, lab/runs/ctx_4096.ps.txt; lab/runs/ctx_8192.json, lab/runs/ctx_8192.ps.txt; lab/runs/ctx_32768.json, lab/runs/ctx_32768.ps.txt; lab/runs/ctx_65536.json, lab/runs/ctx_65536.ps.txt; lab/runs/ctx_131072.json, lab/runs/ctx_131072.ps.txt.

Таблица 2: цена длинного промпта при num_ctx 65536

| контекст | байт | prompt_eval_count | prompt_eval_duration | prompt tok/s | eval_count | decode tok/s | total_s |
|---|---:|---:|---:|---:|---:|---:|---:|
| small | 15638 | 3851 | 17244882000 нс | 223.3 | 29 | 25.12 | 20.231439675 |
| medium | 21920 | 4073 | 18334251000 нс | 222.2 | 10 | 26.63 | 20.543497194 |
| large | 65760 | 12043 | 64329616000 нс | 187.2 | 16 | 20.91 | 66.732736661 |

Артефакты: lab/runs/ctx_65536_small.json; lab/runs/ctx_65536_medium.json; lab/runs/ctx_65536_large.json.

Наблюдения и ограничения метода:

- Все замеры холодные: перед каждым прогоном выполнялось ollama stop; prompt_eval_cached_count = 0 во всех артефактах.
- SIZE в ollama ps вырос с 6.7 до 7.6 GB, при этом у 8192 и 32768 одинаковое значение 6.9 GB — вывод ps слишком грубый для точной оценки цены KV-кэша на токен; это ограничение метода.
- На 131072 зафиксировано: занято 9.9 GiB из 30, swap 0 B (см. lab/runs/ctx_131072.ps.txt) — по памяти ограничения на этой машине нет.
- prompt tok/s падает с ростом промпта: ~261.6 (короткий) → 223.3 (small) → 222.2 (medium) → 187.2 (large).
- decode tok/s: на коротком промпте ~29–30 tok/s; на длинном 20.9–26.6 tok/s.
- Экстраполяция (оценка, не замер): полная обработка промпта в 65536 токенов при 187.2 prompt tok/s займёт примерно 65536 / 187.2 ≈ 350 с (~5 мин 50 с).
- Деградация качества на большом контексте: при 12043 токенах модель вернула фразу из контекста вместо ответа на вопрос — «Рабочий OpenCode должен иметь возможность сохранять ответы и редактировать документы» (см. lab/runs/ctx_65536_large.json).
- Важно для интерпретации: experiment.py всегда шлёт "think": false, тогда как сессии OpenCode идут через OpenAI-совместимый слой с включённым thinking; реальные сессии будут медленнее, чем эти цифры.

## Ограничения и выводы

1. Модель вызывает тулзы только при явном указании файла. Артефакт: lab/answers/q1_naive.jsonl
2. Скорости:
  - prompt: 187-223 tok/s
  - decode: 21-30 tok/s
  - холодная обработка 65536 токенов: примерно 350с
  Артефакты: таблица, lab/runs/ctx_65536_[small|medium|large].json и расчёт в тексте
3. Память - не помеха: 131072 -> 7.6 GB, swap 0 B. Артефакт: lab/runs/ctx_131072.ps.txt
4. При 12043 токенах модель вернула фразу из контекста вместо ответа. Артефакт: lab/runs/ctx_65536_large.json
5. Качество: 3/5 полностью верно. Q3 частично и Q5 со слабым вторым обоснованием. Галлюцинаций нет. Артефакты: lab/answers/summary.md и раздел "Результаты"
6. thinking на слое /v1 включён всегда, отключается только reasoning_effort:"none". Артефакты: lab/runs/openai_default.json, lab/runs/openai_think_off.json, lab/runs/openai_reasoning_effort_none.json.
7. Из demo сессия читает артефакты репозитория (06), поэтому прогоны из копии вне репозитория (05, 07). Артефакты: lab/verify/06_leak_repo.jsonl, lab/verify/06_leak_repo.txt, lab/verify/07_leak_isolated.txt.
8. Вложение сдвигает нумерацию строк - сверяем содержание и имя файла. Артефакты: lab/answers/q1.jsonl, lab/answers/q2.jsonl и комментарии в "Протоколе".
9. ollama ps слишком грубый для оценки стоимости KV-кэша (8192 и 32768 совпали). Артефакты: таблица бенчмарков, lab/runs/*_ps.txt.
10. Сравнение с qwen3.5:4b не проводилось.

## Как воспроизвести

Точное воспроизведение по запущенным командам и скриптам:

- Сборка локальных тегов модели Ollama:
  - ollama create itmo-chat -f lab/Modelfile
  - ollama create itmo-agent -f lab/Modelfile.agent

- Проверка тестов из demo через make:
  - make -C practices/practice_03/lab test

- Бенчмарк скорости/памяти (примеры, исполнялись с разными num-ctx):
  - python3 lab/experiment.py --mode system --model gemma4:e2b --num-ctx 4096   --num-predict 256 --seed 42 --temperature 0.2 --output lab/runs/ctx_4096.json
  - python3 lab/experiment.py --mode system --model gemma4:e2b --num-ctx 8192   --num-predict 256 --seed 42 --temperature 0.2 --output lab/runs/ctx_8192.json
  - python3 lab/experiment.py --mode system --model gemma4:e2b --num-ctx 32768  --num-predict 256 --seed 42 --temperature 0.2 --output lab/runs/ctx_32768.json
  - python3 lab/experiment.py --mode system --model gemma4:e2b --num-ctx 65536  --num-predict 256 --seed 42 --temperature 0.2 --output lab/runs/ctx_65536.json
  - python3 lab/experiment.py --mode system --model gemma4:e2b --num-ctx 131072 --num-predict 256 --seed 42 --temperature 0.2 --output lab/runs/ctx_131072.json

- Прогоны Q1–Q5 с вложением контекста (копии в /tmp/p3/qN):
  - bash lab/run_sessions.sh 1 2 3 4 5

- Где смотреть результаты:
  - lab/runs/ — артефакты замеров скорости/контекста и экспериментов с thinking
  - lab/answers/ — ответы модели, метаданные и сводка по пяти вопросам
  - lab/verify/ — проверки конфигурации, изоляции и утечек

## Приложение: сырые выводы команд

```
$ uname -srmo
Linux 7.2.8-arch1-2 x86_64 GNU/Linux
```

```
$ hostnamectl
  Static hostname: thinkbook
 Operating System: Arch Linux
           Kernel: Linux 7.2.8-arch1-2
     Architecture: x86-64
  Hardware Vendor: Lenovo
   Hardware Model: ThinkBook 14 G7+ AKP
```

```
$ python3 --version
Python 3.14.7
```

```
$ ollama --version
ollama version is 0.35.1
```

```
$ ollama list
NAME          ID              SIZE      MODIFIED   
gemma4:e2b    7fbdbf8f5e45    7.2 GB    9 days ago    
```

```
$ ollama show gemma4:e2b
  Model
    architecture        gemma4    
    parameters          5.1B      
    context length      131072    
    embedding length    1536      
    quantization        Q4_K_M    
    requires            0.20.0    

  Capabilities
    completion     
    vision         
    audio          
    tools          
    thinking       
        levels     false, true    
        default    true           

  Parameters
    top_k          64      
    top_p          0.95    
    temperature    1       
```

```
$ du -sh ~/.ollama/models
6.7G	/home/ars/.ollama/models
```

```
$ free -h
               total        used        free      shared  buff/cache   available
Mem:            30Gi       5.5Gi        20Gi       165Mi       3.9Gi        25Gi
Swap:           31Gi          0B        31Gi
```

```
$ ollama show itmo-agent
  Model
    architecture        gemma4    
    parameters          5.1B      
    context length      131072    
    embedding length    1536      
    quantization        Q4_K_M    
    requires            0.20.0    

  Capabilities
    completion     
    vision         
    audio          
    tools          
    thinking       
        levels     false, true    
        default    true           

  Parameters
    top_p          0.95     
    num_ctx        65536    
    temperature    0.2      
    top_k          64       
```
