import fs from 'node:fs'
import path from 'node:path'

export default function globalSetup() {
  const file = path.join(process.cwd(), 'var', 'tickets.json')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, '[]\n', 'utf8')
  console.log('e2e: очередь очищена перед прогоном')
}
