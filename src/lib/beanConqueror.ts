import type { BrewInput, GeneratedRecipe } from './brewEngine'

export interface BCBrew {
  name: string
  method: string
  totalWaterGrams: number
  ratio: number
  waterTempC: number
  targetDrawdown: string
  pours: unknown[]
  notes: string[]
  input?: BrewInput
  exportedAt: string
}

export interface BCExportPackage {
  version: string
  source: string
  exportedAt: string
  brews: BCBrew[]
}

export function formatRecipeForBeanConqueror(
  recipe: GeneratedRecipe,
  input: BrewInput,
  name?: string,
): BCBrew {
  return {
    name: name ?? recipe.title,
    method: recipe.method,
    totalWaterGrams: recipe.totalWaterGrams,
    ratio: recipe.ratio,
    waterTempC: recipe.waterTempC,
    targetDrawdown: recipe.targetDrawdown,
    pours: recipe.pours,
    notes: recipe.notes,
    input: input,
    exportedAt: new Date().toISOString(),
  }
}

export function buildBCExportPackage(
  recipe: GeneratedRecipe,
  input: BrewInput,
  name?: string,
): BCExportPackage {
  return {
    version: 'brewit-1',
    source: 'Brewit',
    exportedAt: new Date().toISOString(),
    brews: [formatRecipeForBeanConqueror(recipe, input, name)],
  }
}

export function downloadBeanConquerorExport(
  recipe: GeneratedRecipe,
  input: BrewInput,
  name?: string,
): void {
  const pkg = buildBCExportPackage(recipe, input, name)
  const json = JSON.stringify(pkg, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const safeName = (name ?? recipe.title ?? 'export')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-\.]/g, '')
  const filename = `beanconqueror_brew_${safeName}_${Date.now()}.json`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function shareBeanConquerorExport(
  recipe: GeneratedRecipe,
  input: BrewInput,
  name?: string,
): Promise<boolean> {
  const pkg = buildBCExportPackage(recipe, input, name)
  const json = JSON.stringify(pkg, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const safeName = (name ?? recipe.title ?? 'export')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-\.]/g, '')
  const filename = `beanconqueror_brew_${safeName}_${Date.now()}.json`

  try {
    // Create a File and try Web Share API (files)
    // @ts-ignore - File exists in browser env
    const f = new File([blob], filename, { type: 'application/json' })
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null
    if (nav && typeof nav.canShare === 'function' && nav.canShare({ files: [f] })) {
      await nav.share({ files: [f], title: 'BeanConqueror import', text: 'Import brew into BeanConqueror' })
      return true
    }
  } catch (e) {
    // sharing failed; fall through to download fallback
    console.debug('[beanConqueror] share failed', e)
  }

  // Fallback to download if share isn't available
  downloadBeanConquerorExport(recipe, input, name)
  return false
}

export async function buildBCZipExportBlob(
  recipe: GeneratedRecipe,
  input: BrewInput,
  name?: string,
): Promise<Blob> {
  const pkg = buildBCExportPackage(recipe, input, name)
  // dynamic import JSZip so projects that don't install it still work for JSON export
  let JSZipMod: any
  try {
    JSZipMod = await import('jszip')
  } catch (e) {
    // If import fails, fall back to JSON blob
    return new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' })
  }
  const JSZip = JSZipMod.default ?? JSZipMod
  const zip = new JSZip()
  // Put files under a top-level folder similar to BeanConqueror export
  const folderName = `Beanconqueror_export_${Date.now()}`
  const basePath = `${folderName}/`
  zip.file(`${basePath}brews.json`, JSON.stringify(pkg, null, 2))
  zip.file(`${basePath}metadata.json`, JSON.stringify({ source: 'Brewit', exportedAt: new Date().toISOString(), version: 'brewit-1' }))
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  return blob
}

export async function shareBeanConquerorZip(
  recipe: GeneratedRecipe,
  input: BrewInput,
  name?: string,
): Promise<boolean> {
  try {
    const blob = await buildBCZipExportBlob(recipe, input, name)
    // Create a File for sharing
    // @ts-ignore
    const filename = `Beanconqueror_export_${(name ?? 'brew').replace(/\s+/g, '_')}_${Date.now()}.zip`
    // @ts-ignore
    const file = new File([blob], filename, { type: 'application/zip' })
    const nav: any = typeof navigator !== 'undefined' ? navigator : null
    if (nav && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], title: 'BeanConqueror import', text: 'Import brew into BeanConqueror (zip)' })
      return true
    }
    // Fallback to download
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    return false
  } catch (e) {
    console.debug('[beanConqueror] share zip failed', e)
    return false
  }
}

export default { formatRecipeForBeanConqueror, buildBCExportPackage, downloadBeanConquerorExport }
