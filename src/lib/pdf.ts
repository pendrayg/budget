import type { TextItem } from './statement'

/**
 * Les morceaux de texte d'un PDF, avec leur position, lus DANS le navigateur : le relevé ne quitte
 * pas le téléphone, seules les opérations qu'on en tire sont gardées. pdf.js est lourd : il n'est
 * chargé qu'au premier import, dans un fichier à part, et son lecteur tourne dans un worker.
 */
export async function pdfTextItems(file: Blob): Promise<TextItem[]> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const items: TextItem[] = []
  try {
    for (let page = 1; page <= document.numPages; page++) {
      const content = await (await document.getPage(page)).getTextContent()
      for (const item of content.items) {
        if (!('str' in item)) continue
        const x = item.transform[4]
        items.push({ page, str: item.str, x, xEnd: x + item.width, y: item.transform[5] })
      }
    }
  } finally {
    await document.destroy()
  }
  return items
}
