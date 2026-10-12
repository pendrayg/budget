import seed from '../../seed/couts.json'
import { sanitizeState } from './state'
import type { State } from './types'

/** La graine : un foyer FICTIF (Alice et Bruno), douze mois d'octobre 2025 à septembre 2026, vingt-deux dépenses. */
export function seedState(): State {
  return sanitizeState((seed as { state: unknown }).state)
}
