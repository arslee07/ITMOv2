import fs from 'node:fs'
import path from 'node:path'

export function resetTickets() {
  const file = path.join(process.cwd(), 'var', 'tickets.json')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, '[]\n', 'utf8')
}
