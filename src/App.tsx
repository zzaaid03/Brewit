import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { generateRecipe } from './lib/brewEngine'
import {
  saveProfile,
  loadProfile,
  ensureAnonymousSignIn,
  saveRecipe,
  listRecipes,
  loadRecipeById,
  deleteRecipe,
} from './lib/firebase'
import { downloadBeanConquerorExport, shareBeanConquerorExport, shareBeanConquerorZip, buildBCExportPackage } from './lib/beanConqueror'
import type {
  BrewInput,
  BrewMethod,
  CupIssue,
  GeneratedRecipe,
  ProcessType,
  RoastLevel,
  TasteGoal,
  Experience,
} from './lib/brewEngine'

interface MealDbMeal {
  idMeal: string
  strMeal: string
  strCategory: string
  strArea: string
  strInstructions: string
  strMealThumb: string
  strYoutube: string
}

interface MealDbResponse {
  meals: MealDbMeal[] | null
}

const defaultInput: BrewInput = {
  method: 'V60',
  origin: 'Ethiopia',
  process: 'washed',
  roastLevel: 'light',
  tasteGoal: 'balanced',
  doseGrams: 20,
  ratio: 16,
  experience: 'amateur',
}

const methodOptions: BrewMethod[] = ['V60', 'Kalita Wave', 'Chemex']
const originOptions: string[] = [
  'Ethiopia',
  'Colombia',
  'Brazil',
  'Kenya',
  'Guatemala',
  'Costa Rica',
  'Honduras',
  'Panama',
  'Indonesia',
  'Rwanda',
  'Tanzania',
  'Nicaragua',
  'Peru',
  'El Salvador',
  'Burundi',
  'Yemen',
]
const roastOptions: RoastLevel[] = ['light', 'medium', 'dark']
const processOptions: ProcessType[] = [
  'washed',
  'natural',
  'honey',
  'anaerobic',
  'other',
]
const tasteOptions: TasteGoal[] = ['balanced', 'bright', 'sweet', 'bold']

const issueLabels: Record<CupIssue, string> = {
  sour: 'Sour / Sharp',
  bitter: 'Bitter / Harsh',
  weak: 'Weak / Watery',
  dry: 'Dry / Astringent',
}

function truncate(text: string, length: number): string {
  if (text.length <= length) {
    return text
  }
  return `${text.slice(0, length).trim()}...`
}

function App() {
  const [input, setInput] = useState<BrewInput>(defaultInput)
  const [recipe, setRecipe] = useState<GeneratedRecipe>(() =>
    generateRecipe(defaultInput),
  )
  const [experienceSelected, setExperienceSelected] =
    useState<Experience | null>(null)
  const [inspirations, setInspirations] = useState<MealDbMeal[]>([])
  const [isLoadingInspirations, setIsLoadingInspirations] =
    useState<boolean>(true)
  const [inspirationError, setInspirationError] = useState<string>('')
  const [clientId, setClientId] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedRecipes, setSavedRecipes] = useState<Array<{ id: string; record: any }>>([])
  const [recipesLoading, setRecipesLoading] = useState<boolean>(false)
  const [showSaveDialog, setShowSaveDialog] = useState<boolean>(false)
  const [newRecipeName, setNewRecipeName] = useState<string>('')
  const [pendingReset, setPendingReset] = useState<boolean>(false)
  const [exportFallbackJson, setExportFallbackJson] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function fetchCoffeeIdeas(): Promise<void> {
      try {
        const response = await fetch(
          'https://www.themealdb.com/api/json/v1/1/search.php?s=coffee',
        )
        if (!response.ok) {
          throw new Error('Request failed')
        }
        const data = (await response.json()) as MealDbResponse
        if (!isActive) {
          return
        }
        setInspirations((data.meals ?? []).slice(0, 4))
      } catch {
        if (!isActive) {
          return
        }
        setInspirationError(
          'Could not load public coffee ideas right now. Your generator still works offline.',
        )
      } finally {
        if (isActive) {
          setIsLoadingInspirations(false)
        }
      }
    }

    void fetchCoffeeIdeas()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('brewit.experience')
      if (stored === 'beginner' || stored === 'amateur' || stored === 'expert') {
        setExperienceSelected(stored as Experience)
        setInput((prev) => ({ ...prev, experience: stored as Experience }))
      }
    } catch {
      // ignore (no localStorage available)
    }
  }, [])

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const uid = await ensureAnonymousSignIn()
        if (!active) return
        setClientId(uid)
      } catch (e) {
        console.debug('Anonymous sign-in failed, falling back to local id', e)
        try {
          let id = localStorage.getItem('brewit.clientId')
          if (!id) {
            id = `u_${Math.random().toString(36).slice(2, 9)}`
            localStorage.setItem('brewit.clientId', id)
          }
          if (active) setClientId(id)
        } catch {
          // ignore
        }
      }
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!clientId) return
    let active = true
    void (async () => {
      try {
        const data = await loadProfile(clientId)
        if (!active) return
        if (data && (data as any).profile) {
          setInput((prev) => ({ ...prev, ...(data as any).profile }))
        }
        if (data && (data as any).updatedAt) {
          setSavedAt((data as any).updatedAt)
        }
      } catch (e) {
        // ignore
      }

      // load user's saved recipes list
      try {
        setRecipesLoading(true)
        const items = await listRecipes(clientId)
        if (!active) return
        setSavedRecipes(items)
      } catch (e) {
        // ignore
      } finally {
        if (active) setRecipesLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [clientId])

  function selectExperience(exp: Experience) {
    setExperienceSelected(exp)
    setInput((prev) => ({ ...prev, experience: exp }))
    try {
      localStorage.setItem('brewit.experience', exp)
    } catch {
      /* ignore */
    }
  }

  function resetExperience() {
    // Ask the user whether they'd like to save the current recipe before changing experience.
    // We don't immediately clear the experience — instead open the save dialog and mark a pending reset.
    try {
      setPendingReset(true)
      setShowSaveDialog(true)
    } catch {
      /* ignore */
    }
  }

  function doResetExperience() {
    try {
      setPendingReset(false)
      setShowSaveDialog(false)
      setNewRecipeName('')
    } catch {
      /* ignore */
    }
    try {
      setExperienceSelected(null)
      setInput((prev) => ({ ...prev, experience: undefined }))
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem('brewit.experience')
    } catch {
      /* ignore */
    }
  }


  const updateNumber =
    (field: 'doseGrams' | 'ratio') =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value)
      if (Number.isNaN(value)) {
        return
      }
      setInput((previous) => ({ ...previous, [field]: value }))
    }

  const updateOrigin = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    setInput((previous) => ({ ...previous, origin: event.target.value }))
  }

  const updateMethod = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    setInput((previous) => ({
      ...previous,
      method: event.target.value as BrewMethod,
    }))
  }

  const updateRoast = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    setInput((previous) => ({
      ...previous,
      roastLevel: event.target.value as RoastLevel,
    }))
  }

  const updateProcess = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    setInput((previous) => ({
      ...previous,
      process: event.target.value as ProcessType,
    }))
  }

  const updateTaste = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    setInput((previous) => ({
      ...previous,
      tasteGoal: event.target.value as TasteGoal,
    }))
  }

  const handleGenerate = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    setRecipe(generateRecipe(input))
  }

  async function handleSaveProfile(): Promise<void> {
    setSaveStatus('saving')
    setSaveError(null)
    if (!clientId) {
      setSaveStatus('error')
      setSaveError('no-client-id')
      return
    }
    try {
      console.debug('Saving profile for', clientId)
      await saveProfile(clientId, {
        method: input.method,
        origin: input.origin,
        process: input.process,
        roastLevel: input.roastLevel,
        tasteGoal: input.tasteGoal,
        doseGrams: input.doseGrams,
        ratio: input.ratio,
        experience: input.experience,
      })
      const now = new Date().toISOString()
      setSavedAt(now)
      setSaveStatus('saved')
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('saveProfile failed', e)
      setSaveStatus('error')
      setSaveError(String(e))
    }
  }

  async function handleSaveAsRecipeConfirm(): Promise<void> {
    if (!clientId) {
      alert('No client id available to save recipe')
      return
    }
    const name = newRecipeName?.trim()
    if (!name) return
    try {
      setSaveStatus('saving')
      const payload = { input, recipe }
      await saveRecipe(clientId, payload, name)
      // refresh list
      const items = await listRecipes(clientId)
      setSavedRecipes(items)
      setSaveStatus('saved')
      if (pendingReset) {
        doResetExperience()
      } else {
        setShowSaveDialog(false)
        setNewRecipeName('')
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('saveRecipe failed', e)
      setSaveStatus('error')
      setSaveError(String(e))
    }
  }

  async function handleLoadRecipe(id: string): Promise<void> {
    if (!clientId) return
    try {
      const rec = await loadRecipeById(clientId, id)
      if (rec && rec.recipe && (rec.recipe as any).input) {
        setInput((prev) => ({ ...prev, ...(rec.recipe as any).input }))
        setRecipe((rec.recipe as any).recipe)
      }
    } catch (e) {
      console.error('loadRecipe failed', e)
    }
  }

  async function handleDeleteRecipe(id: string): Promise<void> {
    if (!clientId) return
    if (!window.confirm('Delete this saved recipe?')) return
    try {
      await deleteRecipe(clientId, id)
      const items = await listRecipes(clientId)
      setSavedRecipes(items)
    } catch (e) {
      console.error('deleteRecipe failed', e)
    }
  }

  async function handleExportSavedRecipe(id: string): Promise<void> {
    if (!clientId) {
      alert('No client id available to locate saved recipe for export')
      return
    }
    try {
      const rec = await loadRecipeById(clientId, id)
      if (!rec || !(rec as any).recipe) {
        alert('Saved recipe not found')
        return
      }
      const payload = (rec as any).recipe
      const inpt = (payload as any).input as BrewInput | undefined
      const recp = (payload as any).recipe as GeneratedRecipe
      const title = (rec as any).name ?? (rec as any).record?.name ?? undefined
      // Try sharing a zip (preferred); fallback to JSON fallback modal if sharing/download failed
      const sharedZip = await shareBeanConquerorZip(recp, inpt ?? ({} as BrewInput), title)
      if (!sharedZip) {
        try {
          const pkg = buildBCExportPackage(recp, inpt ?? ({} as BrewInput), title)
          setExportFallbackJson(JSON.stringify(pkg, null, 2))
        } catch (e) {
          console.debug('failed to build fallback JSON', e)
        }
      }
    } catch (e) {
      console.error('exportSavedRecipe failed', e)
      alert('Export failed')
    }
  }

  function handleExportCurrentRecipe(): void {
    void (async () => {
      try {
        const sharedZip = await shareBeanConquerorZip(recipe, input, recipe.title)
        if (!sharedZip) {
          try {
            const pkg = buildBCExportPackage(recipe, input, recipe.title)
            setExportFallbackJson(JSON.stringify(pkg, null, 2))
          } catch (e) {
            console.debug('failed to build fallback JSON', e)
          }
        }
      } catch (e) {
        console.error('exportCurrent failed', e)
        alert('Export failed')
      }
    })()
  }

  const troubleshootingIssues = Object.entries(recipe.troubleshooting) as Array<
    [CupIssue, string]
  >

  if (!experienceSelected) {
    return (
      <div className="app-shell onboarding-shell">
        <header className="hero">
          <p className="eyebrow">Brewit</p>
          <h1>Welcome — choose your experience</h1>
          <p className="hero-copy">Tell us your experience to tailor the app.</p>
        </header>

        <main className="layout">
          <section className="panel onboarding-panel">
            <h2>What's your experience?</h2>
            <div className="experience-choices">
              <button onClick={() => selectExperience('beginner')} className="choice beginner">Beginner</button>
              <button onClick={() => selectExperience('amateur')} className="choice amateur">Amateur</button>
              <button onClick={() => selectExperience('expert')} className="choice expert">Expert</button>
            </div>
            <p style={{ marginTop: 16 }}>
              You can change this later from the main screen.
            </p>
          </section>
        </main>

          {showSaveDialog ? (
            <div className="modal-overlay" role="dialog" aria-modal="true">
              <div className="modal">
                <h3>Save recipe</h3>
                <input
                  autoFocus
                  placeholder="Recipe name"
                  value={newRecipeName}
                  onChange={(e) => setNewRecipeName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSaveAsRecipeConfirm()
                  }}
                />
                <div className="modal-actions">
                          <button type="button" className="generate-button" onClick={() => void handleSaveAsRecipeConfirm()}>
                            Save
                          </button>
                          <button type="button" className="secondary-button" onClick={() => { if (pendingReset) { doResetExperience() } else { setShowSaveDialog(false); setNewRecipeName('') } }}>
                            {pendingReset ? "Don't Save" : 'Cancel'}
                          </button>
                </div>
              </div>
            </div>
          ) : null}
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <p className="eyebrow">Brewit</p>
        <h1>Recipe Generator for Better Manual Brews</h1>
        <p className="hero-copy">
          Tune your brew from bean origin, roast level, and taste goal. Generate
          a practical recipe in one click.
        </p>
      </header>

      <main className="layout">
        <section className="panel">
          <h2>Input</h2>
          <form className="form-grid" onSubmit={handleGenerate}>
            <label className="field">
              <span>Brew Method</span>
              <select value={input.method} onChange={updateMethod}>
                {methodOptions.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Bean Origin</span>
              <select value={input.origin} onChange={updateOrigin}>
                {originOptions.map((origin) => (
                  <option key={origin} value={origin}>
                    {origin}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Process</span>
              <select value={input.process} onChange={updateProcess}>
                {processOptions.map((process) => (
                  <option key={process} value={process}>
                    {process}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Roast Level</span>
              <select value={input.roastLevel} onChange={updateRoast}>
                {roastOptions.map((roast) => (
                  <option key={roast} value={roast}>
                    {roast}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Taste Goal</span>
              <select value={input.tasteGoal} onChange={updateTaste}>
                {tasteOptions.map((taste) => (
                  <option key={taste} value={taste}>
                    {taste}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Experience</span>
              <div className="experience-badge">
                <strong style={{ textTransform: 'capitalize' }}>{experienceSelected}</strong>
                <button type="button" onClick={resetExperience} style={{ marginLeft: 8 }}>
                  Change
                </button>
              </div>
            </label>

            {experienceSelected !== 'beginner' ? (
              <>
                <label className="field">
                  <span>Dose (g)</span>
                  <input
                    type="number"
                    min={10}
                    max={40}
                    step={0.5}
                    value={input.doseGrams ?? 20}
                    onChange={updateNumber('doseGrams')}
                  />
                </label>

                <label className="field">
                  <span>Ratio</span>
                  <input
                    type="number"
                    min={14}
                    max={18}
                    step={0.1}
                    value={input.ratio ?? 16}
                    onChange={updateNumber('ratio')}
                  />
                </label>
              </>
            ) : null}

            <button type="submit" className="generate-button">
              Generate Recipe
            </button>
            <button type="button" className="secondary-button" onClick={handleSaveProfile} disabled={saveStatus === 'saving'}>
              {saveStatus === 'saving' ? 'Saving...' : 'Save Profile'}
            </button>
            {/* Client ID and last saved removed from UI per user request */}
            {saveStatus === 'error' ? (
              <div style={{ color: '#ff6b6b', marginTop: 6 }}>Save failed: {saveError ?? 'unknown'}</div>
            ) : null}
          </form>
        </section>

        <section className="panel saved-panel">
          <h2>Saved Recipes</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <button type="button" className="secondary-button" onClick={() => setShowSaveDialog(true)}>
              Save As New Recipe
            </button>
            <button type="button" className="secondary-button" onClick={() => handleExportCurrentRecipe()}>
              Export / Share to BeanConqueror
            </button>
            {recipesLoading ? <div style={{ color: 'var(--muted)' }}>Loading...</div> : null}
          </div>

          {savedRecipes.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No saved recipes yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {savedRecipes.map((item) => (
                <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.record.name ?? 'Untitled'}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{item.record.updatedAt}</div>
                  </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="secondary-button" onClick={() => handleLoadRecipe(item.id)}>Load</button>
                    <button type="button" className="secondary-button" onClick={() => handleExportSavedRecipe(item.id)}>Export</button>
                    <button type="button" className="secondary-button" onClick={() => handleDeleteRecipe(item.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>{recipe.title}</h2>
          <div className="stats-grid">
            <article>
              <p className="stat-label">Total Water</p>
              <p className="stat-value">{recipe.totalWaterGrams} g</p>
            </article>
            <article>
              <p className="stat-label">Ratio</p>
              <p className="stat-value">1:{recipe.ratio.toFixed(1)}</p>
            </article>
            <article>
              <p className="stat-label">Temperature</p>
              <p className="stat-value">{recipe.waterTempC} °C</p>
            </article>
            <article>
              <p className="stat-label">Target Time</p>
              <p className="stat-value">{recipe.targetDrawdown}</p>
            </article>
          </div>

          <h3>Pour Plan</h3>
          <ol className="step-list">
            {recipe.pours.map((step) => (
              <li key={`${step.label}-${step.time}`}>
                <p className="step-head">
                  {step.time} | {step.label} | +{step.waterGrams} g
                </p>
                <p>{step.detail}</p>
              </li>
            ))}
          </ol>

          <h3>Brew Notes</h3>
          <ul className="notes-list">
            {recipe.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      </main>

      <section className="panel issue-panel">
        <h2>Taste Troubleshooter</h2>
        <div className="issues-grid">
          {troubleshootingIssues.map(([issue, fix]) => (
            <article key={issue} className="issue-card">
              <h3>{issueLabels[issue]}</h3>
              <p>{fix}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel inspiration-panel">
        <h2>Public Coffee Recipe Inspiration</h2>
        {isLoadingInspirations ? <p>Loading ideas from TheMealDB...</p> : null}
        {!isLoadingInspirations && inspirationError ? (
          <p>{inspirationError}</p>
        ) : null}
        <div className="inspiration-grid">
          {inspirations.map((meal) => (
            <article key={meal.idMeal} className="meal-card">
              <img src={meal.strMealThumb} alt={meal.strMeal} loading="lazy" />
              <div className="meal-content">
                <h3>{meal.strMeal}</h3>
                <p className="tags">
                  {meal.strCategory} | {meal.strArea}
                </p>
                <p>{truncate(meal.strInstructions, 130)}</p>
                {meal.strYoutube ? (
                  <a href={meal.strYoutube} target="_blank" rel="noreferrer">
                    Watch prep
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
      {showSaveDialog ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>Save recipe</h3>
            <input
              autoFocus
              placeholder="Recipe name"
              value={newRecipeName}
              onChange={(e) => setNewRecipeName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveAsRecipeConfirm()
              }}
            />
            <div className="modal-actions">
              <button type="button" className="generate-button" onClick={() => void handleSaveAsRecipeConfirm()}>
                Save
              </button>
              <button type="button" className="secondary-button" onClick={() => { if (pendingReset) { doResetExperience() } else { setShowSaveDialog(false); setNewRecipeName('') } }}>
                {pendingReset ? "Don't Save" : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {exportFallbackJson ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>Share not available on this browser</h3>
            <p>
              Your device/browser didn't allow handing the file to other apps. The export
              was downloaded instead. To import into BeanConqueror: open your device's
              Downloads, tap the exported JSON file, and choose "Open with" → BeanConqueror.
            </p>
            <p style={{ marginTop: 8 }}>
              Alternatively copy the JSON below and transfer it to your phone if needed.
            </p>
            <textarea readOnly value={exportFallbackJson} style={{ width: '100%', height: 220, marginTop: 8, fontFamily: 'monospace', fontSize: 12 }} />
            <div className="modal-actions">
              <button type="button" className="generate-button" onClick={async () => {
                try {
                  await navigator.clipboard.writeText(exportFallbackJson)
                  // lightweight confirmation
                  // eslint-disable-next-line no-alert
                  alert('Export JSON copied to clipboard')
                } catch (e) {
                  // eslint-disable-next-line no-alert
                  alert('Copy failed — use your Downloads folder to open the file')
                }
              }}>
                Copy JSON
              </button>
              <button type="button" className="secondary-button" onClick={() => setExportFallbackJson(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
