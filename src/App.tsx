import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { generateRecipe } from './lib/brewEngine'
import type {
  BrewInput,
  BrewMethod,
  CupIssue,
  GeneratedRecipe,
  ProcessType,
  RoastLevel,
  TasteGoal,
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
  waterTempC: 93,
}

const methodOptions: BrewMethod[] = ['V60', 'Kalita Wave', 'Chemex']
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
  const [inspirations, setInspirations] = useState<MealDbMeal[]>([])
  const [isLoadingInspirations, setIsLoadingInspirations] =
    useState<boolean>(true)
  const [inspirationError, setInspirationError] = useState<string>('')

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

  const updateNumber =
    (field: 'doseGrams' | 'ratio' | 'waterTempC') =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value)
      if (Number.isNaN(value)) {
        return
      }
      setInput((previous) => ({ ...previous, [field]: value }))
    }

  const updateOrigin = (event: React.ChangeEvent<HTMLInputElement>): void => {
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

  const troubleshootingIssues = Object.entries(recipe.troubleshooting) as Array<
    [CupIssue, string]
  >

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
              <input
                type="text"
                value={input.origin}
                onChange={updateOrigin}
                placeholder="e.g. Colombia Huila"
              />
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
              <span>Dose (g)</span>
              <input
                type="number"
                min={10}
                max={40}
                step={0.5}
                value={input.doseGrams}
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
                value={input.ratio}
                onChange={updateNumber('ratio')}
              />
            </label>

            <label className="field">
              <span>Water Temp (°C)</span>
              <input
                type="number"
                min={88}
                max={97}
                step={1}
                value={input.waterTempC}
                onChange={updateNumber('waterTempC')}
              />
            </label>

            <button type="submit" className="generate-button">
              Generate Recipe
            </button>
          </form>
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
    </div>
  )
}

export default App
