/**
 * Client-side image compression using Canvas API.
 * Resizes images to max dimensions and converts to JPEG.
 * Turns 6MB phone photos into ~200KB compressed images.
 */

export interface CompressedImage {
  base64: string       // raw base64 (no data: prefix)
  mimeType: string     // always 'image/jpeg'
  sizeKB: number       // approximate size in KB
}

export interface CompressOptions {
  maxWidth?: number    // default 1024
  maxHeight?: number   // default 1024
  quality?: number     // 0-1, default 0.7
}

export function compressImage(
  file: File,
  opts: CompressOptions = {},
): Promise<CompressedImage> {
  const { maxWidth = 1024, maxHeight = 1024, quality = 0.7 } = opts

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      // Calculate resize dimensions maintaining aspect ratio
      let { width, height } = img
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      // Draw to offscreen canvas
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas not supported')); return }
      ctx.drawImage(img, 0, 0, width, height)

      // Export as JPEG blob
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Compression failed')); return }
          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = reader.result as string
            const base64 = dataUrl.split(',')[1]
            resolve({
              base64,
              mimeType: 'image/jpeg',
              sizeKB: Math.round(blob.size / 1024),
            })
          }
          reader.onerror = () => reject(new Error('Failed to read compressed image'))
          reader.readAsDataURL(blob)
        },
        'image/jpeg',
        quality,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

/**
 * Compress a base64 image string (for paste/drop where we already have base64)
 */
export function compressBase64Image(
  base64: string,
  mimeType: string,
  opts: CompressOptions = {},
): Promise<CompressedImage> {
  const { maxWidth = 1024, maxHeight = 1024, quality = 0.7 } = opts

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas not supported')); return }
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Compression failed')); return }
          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = reader.result as string
            resolve({
              base64: dataUrl.split(',')[1],
              mimeType: 'image/jpeg',
              sizeKB: Math.round(blob.size / 1024),
            })
          }
          reader.readAsDataURL(blob)
        },
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => reject(new Error('Failed to load image for compression'))
    img.src = `data:${mimeType};base64,${base64}`
  })
}

/**
 * Generate a tiny thumbnail for question list display
 */
export function generateThumbnail(base64: string, mimeType: string): Promise<string> {
  return compressBase64Image(base64, mimeType, { maxWidth: 100, maxHeight: 100, quality: 0.5 })
    .then(r => r.base64)
}
