// Génère src/lib/nerd-icons.json depuis glyphnames.json de Nerd Fonts (même version que la police
// Symbols Nerd Font du design system, v3.4.0) : une liste compacte [nom, point de code], triée.
//   curl -sSL -o glyphnames.json https://raw.githubusercontent.com/ryanoasis/nerd-fonts/v3.4.0/glyphnames.json
//   node scripts/nerd-icons.mjs glyphnames.json
import { readFileSync, writeFileSync } from 'node:fs'

const source = JSON.parse(readFileSync(process.argv[2] ?? 'glyphnames.json', 'utf8'))
const icons = Object.entries(source)
  .filter(([name, glyph]) => name !== 'METADATA' && typeof glyph?.code === 'string')
  .map(([name, glyph]) => [name, glyph.code.toLowerCase()])
  .sort(([a], [b]) => a.localeCompare(b))
writeFileSync(new URL('../src/lib/nerd-icons.json', import.meta.url), JSON.stringify(icons))
console.log(`${icons.length} icônes`)
