import type { Line } from 'tesseract.js'
import { CAPTURE_COLUMNS, type CaptureRead, type OcrLine } from './capture'

/**
 * Lit une capture d'écran DANS le navigateur (Tesseract.js) : l'image ne quitte pas le téléphone.
 * Tesseract est lourd — son moteur WebAssembly, ~4 Mo, et le français, ~0,7 Mo — : il n'est chargé
 * qu'à la première capture, depuis l'app elle-même (pas de CDN), et tourne dans un worker.
 *
 * L'image passe en gris, agrandie et contrastée, puis se lit en trois bandes (cf. capture.ts) :
 * les jours, les libellés sans les logos, les montants — ceux-là en chiffres seulement, ce qui les
 * lit sans faute.
 */
export async function readCapture(file: Blob, onProgress?: (share: number) => void): Promise<CaptureRead> {
  const [{ createWorker, OEM }, worker, core] = await Promise.all([
    import('tesseract.js'),
    import('tesseract.js/dist/worker.min.js?url'),
    import('tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url'),
  ])
  const image = await prepare(file)
  // Le français est servi par l'app, à `/tessdata/` (cf. vite.config.ts).
  const langPath = new URL('tessdata', new URL(import.meta.env.BASE_URL, location.href)).href
  const tesseract = await createWorker('fra', OEM.LSTM_ONLY, { workerPath: worker.default, corePath: core.default, langPath, cacheMethod: 'none' })
  try {
    const read = async (band: readonly [number, number], whitelist: string, text: (line: Line) => string = (line) => line.text): Promise<OcrLine[]> => {
      await tesseract.setParameters({ tessedit_char_whitelist: whitelist })
      const { data } = await tesseract.recognize(crop(image, band), {}, { blocks: true })
      return (data.blocks ?? []).flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines.map((line) => ({ text: text(line).trim(), top: line.bbox.y0, bottom: line.bbox.y1 }))))
    }
    onProgress?.(0.1)
    const days = await read(CAPTURE_COLUMNS.days, '')
    onProgress?.(0.45)
    const labels = await read(CAPTURE_COLUMNS.labels, '')
    onProgress?.(0.8)
    const amounts = await read(CAPTURE_COLUMNS.amounts, '0123456789,.+-€ ', rightmostRun)
    onProgress?.(1)
    return { days, labels, amounts }
  } finally {
    await tesseract.terminate()
  }
}

/** L'image en gris, agrandie jusqu'à ~2 400 px de large et contrastée : Tesseract lit mieux un texte gros et net. */
async function prepare(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(3, Math.max(1, 2400 / bitmap.width))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('canvas')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  const { data } = pixels
  // Gris, puis niveaux : sous 20 % tout noir, au-dessus de 85 % tout blanc.
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    const level = Math.max(0, Math.min(255, ((gray - 51) / (217 - 51)) * 255))
    data[i] = data[i + 1] = data[i + 2] = level
  }
  context.putImageData(pixels, 0, 0)
  return canvas
}

/** Une bande verticale de l'image, de toute sa hauteur : les hauteurs lues restent celles de l'image. */
function crop(image: HTMLCanvasElement, [from, to]: readonly [number, number]): HTMLCanvasElement {
  const x = Math.round(image.width * from)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.width * to) - x
  canvas.height = image.height
  canvas.getContext('2d')?.drawImage(image, x, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * Le montant d'une ligne de la bande des montants : le dernier groupe de caractères qui se
 * touchent. Un libellé long déborde parfois dans la bande — le « u » de « Pain Au » s'y lit « 1 » —,
 * à gauche du montant, ou glissé dedans en un caractère trop haut : il est laissé de côté.
 */
function rightmostRun(line: Line): string {
  const all = line.words.flatMap((word) => word.symbols).filter((symbol) => symbol.text.trim() !== '')
  if (all.length === 0) return line.text
  // La hauteur d'un caractère (la médiane : la ligne, elle, peut englober le débord). Un caractère
  // bien plus haut que les autres est un fantôme, à cheval sur le débord et le montant.
  const height = all.map((symbol) => symbol.bbox.y1 - symbol.bbox.y0).sort((a, b) => a - b)[Math.floor(all.length / 2)]
  const symbols = all.filter((symbol) => symbol.bbox.y1 - symbol.bbox.y0 <= 1.5 * height).sort((a, b) => a.bbox.x0 - b.bbox.x0)
  if (symbols.length === 0) return line.text
  let start = 0
  for (let i = 1; i < symbols.length; i++) if (symbols[i].bbox.x0 - symbols[i - 1].bbox.x1 > height) start = i
  return symbols
    .slice(start)
    .map((symbol, i, run) => (i > 0 && symbol.bbox.x0 - run[i - 1].bbox.x1 > height / 4 ? ` ${symbol.text}` : symbol.text))
    .join('')
}
