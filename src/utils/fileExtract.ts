import type { AttachedFile } from '../types'
import { compressImage } from './imageCompress'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

export class FileExtractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FileExtractError'
  }
}

export async function extractFileContent(file: File): Promise<AttachedFile> {
  if (file.size > MAX_BYTES) {
    throw new FileExtractError(`File "${file.name}" exceeds 10 MB limit`)
  }

  if (IMAGE_TYPES.includes(file.type)) {
    return extractImage(file)
  }
  if (file.type === 'application/pdf') {
    return extractPdf(file)
  }
  return extractText(file)
}

async function extractImage(file: File): Promise<AttachedFile> {
  // compressImage returns { base64, mimeType, sizeKB } — not a data URL
  const compressed = await compressImage(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.85 })
  return {
    name: file.name,
    type: 'image',
    content: `data:${compressed.mimeType};base64,${compressed.base64}`,
    mimeType: compressed.mimeType,
    sizeBytes: file.size,
  }
}

async function extractPdf(file: File): Promise<AttachedFile> {
  const arrayBuffer = await file.arrayBuffer()
  // Dynamic import keeps pdfjs out of the main bundle
  const pdfjsLib = await import('pdfjs-dist')
  // Point worker to bundled worker (Vite will handle this)
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => item.str ?? '')
      .join(' ')
    pages.push(`[Page ${i}]\n${pageText}`)
  }

  return {
    name: file.name,
    type: 'pdf',
    content: pages.join('\n\n'),
    mimeType: 'application/pdf',
    sizeBytes: file.size,
  }
}

async function extractText(file: File): Promise<AttachedFile> {
  const content = await file.text()
  return {
    name: file.name,
    type: 'text',
    content,
    mimeType: file.type || 'text/plain',
    sizeBytes: file.size,
  }
}
