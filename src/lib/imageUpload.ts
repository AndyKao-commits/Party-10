/** Compress an image file to a JPEG data URL suitable for party-night storage. */
export async function fileToDataUrl(file: File, maxWidth = 1200, quality = 0.82): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('請選擇圖片檔')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxWidth / bitmap.width)
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('無法處理圖片')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  // ~700KB ceiling keeps Supabase text rows usable on party night
  if (dataUrl.length > 950_000) {
    throw new Error('圖片太大，請換一張較小的或再壓縮後上傳')
  }
  return dataUrl
}
