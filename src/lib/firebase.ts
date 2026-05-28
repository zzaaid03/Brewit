// Firebase initialization and simple helpers using Realtime Database
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, set, get, push, remove } from 'firebase/database'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyDsLDEeLdyIoUktDmCd6flqz7Xj9UpHOXE',
  authDomain: 'brewit-9cfda.firebaseapp.com',
  // Realtime Database lives in europe-west1 for this project — set the URL so the SDK uses the correct region
  databaseURL: 'https://brewit-9cfda-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'brewit-9cfda',
  storageBucket: 'brewit-9cfda.firebasestorage.app',
  messagingSenderId: '985102948555',
  appId: '1:985102948555:web:f54536dfed0da16078634e',
  measurementId: 'G-TQB7C5QHQG',
}

const app = initializeApp(firebaseConfig)
const db = getDatabase(app)
const auth = getAuth(app)

onAuthStateChanged(auth, (user) => {
  console.debug('[firebase] auth state changed ->', user ? user.uid : null)
})

export async function ensureAnonymousSignIn(): Promise<string> {
  if (auth.currentUser) return auth.currentUser.uid
  try {
    const cred = await signInAnonymously(auth)
    console.debug('[firebase] signInAnonymously ->', cred.user.uid)
    return cred.user.uid
  } catch (e) {
    console.error('[firebase] signInAnonymously failed', e)
    throw e
  }
}

export async function saveProfile(userId: string, profile: unknown): Promise<void> {
  const profileRef = ref(db, `profiles/${userId}`)
  console.debug('[firebase] saveProfile ->', userId, profile)
  await set(profileRef, { profile, updatedAt: new Date().toISOString() })
  console.debug('[firebase] saveProfile success ->', userId)
}

export async function loadProfile(userId: string): Promise<unknown | null> {
  const profileRef = ref(db, `profiles/${userId}`)
  console.debug('[firebase] loadProfile ->', userId)
  const snap = await get(profileRef)
  if (!snap.exists()) return null
  const val = snap.val()
  console.debug('[firebase] loadProfile success ->', userId, val)
  return val
}

// Recipes: store multiple saved recipes per user under `users/{userId}/recipes`
export interface SavedRecipeRecord {
  recipe: unknown
  name?: string | null
  updatedAt?: string
}

export async function saveRecipe(userId: string, recipe: unknown, name?: string | null, recipeId?: string): Promise<string> {
  const now = new Date().toISOString()
  const baseRef = ref(db, `users/${userId}/recipes`)
  if (recipeId) {
    const rRef = ref(db, `users/${userId}/recipes/${recipeId}`)
    await set(rRef, { recipe, name: name ?? null, updatedAt: now })
    console.debug('[firebase] saveRecipe updated ->', userId, recipeId)
    return recipeId
  }
  const p = push(baseRef)
  await set(p, { recipe, name: name ?? null, updatedAt: now })
  console.debug('[firebase] saveRecipe created ->', userId, p.key)
  return p.key as string
}

export async function listRecipes(userId: string): Promise<Array<{ id: string; record: SavedRecipeRecord }>> {
  const r = ref(db, `users/${userId}/recipes`)
  console.debug('[firebase] listRecipes ->', userId)
  const snap = await get(r)
  if (!snap.exists()) return []
  const val = snap.val()
  return Object.entries(val).map(([id, rec]) => ({ id, record: rec as SavedRecipeRecord }))
}

export async function loadRecipeById(userId: string, recipeId: string): Promise<SavedRecipeRecord | null> {
  const r = ref(db, `users/${userId}/recipes/${recipeId}`)
  const snap = await get(r)
  if (!snap.exists()) return null
  return snap.val() as SavedRecipeRecord
}

export async function deleteRecipe(userId: string, recipeId: string): Promise<void> {
  const r = ref(db, `users/${userId}/recipes/${recipeId}`)
  await remove(r)
  console.debug('[firebase] deleteRecipe ->', userId, recipeId)
}

export default app
