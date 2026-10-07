import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

// Tools whose result changes files. After any of these edits a Go file we run
// the project checks and append the outcome to the tool result, so the agent
// sees broken code immediately instead of at commit time.
const EDIT_TOOLS = new Set(["edit", "write", "patch"])

type Check = {
  label: string
  command: string
  args: string[]
}

const CHECKS: Check[] = [
  { label: "gofmt -l .", command: "gofmt", args: ["-l", "."] },
  { label: "go vet ./...", command: "go", args: ["vet", "./..."] },
  { label: "go test ./...", command: "go", args: ["test", "./..."] },
]

const MAX_OUTPUT = 1500

async function capture(dir: string, check: Check): Promise<{ ok: boolean; output: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(check.command, check.args, {
      cwd: dir,
      timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024,
    })
    return { ok: true, output: `${stdout ?? ""}${stderr ?? ""}`.trim() }
  } catch (error: any) {
    const output = `${error?.stdout ?? ""}${error?.stderr ?? ""}${error?.message ?? ""}`.trim()
    return { ok: false, output }
  }
}

function truncate(text: string): string {
  return text.length > MAX_OUTPUT ? `${text.slice(0, MAX_OUTPUT)}\n… (truncated)` : text
}

function editedPath(input: any): string | undefined {
  return (
    input?.filePath ??
    input?.file_path ??
    input?.filepath ??
    input?.path ??
    input?.file ??
    input?.filename
  )
}

function isGoFile(path: string | undefined): boolean {
  // When the path is unknown we still run the checks: this project is Go-only.
  return path === undefined || path.toLowerCase().endsWith(".go")
}

export default {
  id: "vv-checks",
  async setup(ctx: any) {
    await ctx.tool.hook("execute.after", async (event: any) => {
      if (!EDIT_TOOLS.has(event?.tool)) return
      if (event?.status !== "completed") return

      const path = editedPath(event?.input)
      if (!isGoFile(path)) return

      const dir: string = ctx.location.directory
      const results = []
      let failed = false
      for (const check of CHECKS) {
        const result = await capture(dir, check)
        if (!result.ok) failed = true
        const prefix = result.ok ? "✅" : "❌"
        results.push(`${prefix} ${check.label}${result.output ? `\n${truncate(result.output)}` : ""}`)
      }

      const target = path ?? "проект"
      const message = [
        `[vv-checks] Автопроверка после правки ${target}`,
        failed ? "Итог: есть проблемы." : "Итог: всё чисто.",
        ...results,
      ].join("\n")

      const result: any = event.result ?? {}
      const content = Array.isArray(result.content) ? result.content : []
      event.result = {
        ...result,
        content: [...content, { type: "text", text: message }],
        metadata: { ...(result.metadata ?? {}), vvChecks: failed ? "failed" : "passed" },
      }
    })
  },
}
