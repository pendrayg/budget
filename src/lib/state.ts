import { isPersonColor } from './colors'
import { isMonth } from './month'
import { MAX_PEOPLE } from './people'
import { categoryScope, ownerFromId } from './scope'
import type {
  Amount,
  BudgetGroup,
  BudgetVersion,
  Category,
  CategoryIcon,
  Envelope,
  Income,
  IncomeComponent,
  MatchRule,
  Period,
  Person,
  Project,
  Settings,
  SharesVersion,
  SplitKey,
  State,
  Transaction,
} from './types'

/**
 * L'état par défaut et son assainissement. Tout ce qui entre — stockage local, Worker, fichier
 * importé — passe par `sanitizeState` : une entrée douteuse est écartée, jamais plantée, et un
 * champ manquant reprend sa valeur par défaut. Le Worker et le front partagent ce fichier, si
 * bien qu'un document accepté d'un côté l'est de l'autre.
 */

export const DEFAULT_WINDOW_MONTHS = 12

export const PEOPLE_IDS = ['p1', 'p2'] as const

/**
 * Les catégories d'avant les catégories : les trois sections que l'écran déduisait de la clé et de
 * l'épargne de chaque dépense. Leurs identifiants sont FIXES : un document d'avant les catégories,
 * relu n'importe où (l'autre téléphone, le Worker, un import), les retrouve toujours les mêmes.
 */
export const LEGACY_GROUP_SAVE = 'g-prorata-save'
export const LEGACY_GROUP_MONTHLY = 'g-prorata-monthly'
export const legacyRatioGroupId = (keyId: string) => `g-${keyId}`

export function defaultState(now: string = new Date().toISOString()): State {
  return {
    schema: 1,
    people: [
      { id: PEOPLE_IDS[0], name: 'Personne 1', updatedAt: now },
      { id: PEOPLE_IDS[1], name: 'Personne 2', updatedAt: now },
    ],
    splitKeys: [
      { id: 'prorata', kind: 'prorata' },
      {
        id: 'k-50-50',
        kind: 'fixed',
        name: '50 / 50',
        shares: [{ from: '2000-01', byPerson: { [PEOPLE_IDS[0]]: 0.5, [PEOPLE_IDS[1]]: 0.5 } }],
        updatedAt: now,
      },
    ],
    incomes: [],
    groups: [
      { id: legacyRatioGroupId('k-50-50'), name: 'Ratio', splitKeyId: 'k-50-50', save: false, updatedAt: now },
      { id: LEGACY_GROUP_SAVE, name: 'Prorata épargné', splitKeyId: 'prorata', save: true, updatedAt: now },
      { id: LEGACY_GROUP_MONTHLY, name: 'Prorata mensuel', splitKeyId: 'prorata', save: false, updatedAt: now },
    ],
    categories: [],
    budgets: [],
    projects: [],
    transactions: [],
    rules: [],
    settings: { prorataWindowMonths: DEFAULT_WINDOW_MONTHS },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function stamp(value: unknown): string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : '1970-01-01T00:00:00.000Z'
}

/** De une à quatre personnes, aux identifiants distincts ; sinon les deux de départ. */
function people(value: unknown, fallback: Person[]): Person[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_PEOPLE) return fallback
  const parsed = value.map((item, index) =>
    isRecord(item) && typeof item.id === 'string' && item.id !== ''
      ? { id: item.id, name: text(item.name, fallback[index]?.name ?? `Personne ${index + 1}`), ...(isPersonColor(item.color) ? { color: item.color } : {}), updatedAt: stamp(item.updatedAt) }
      : null,
  )
  if (parsed.some((item) => item === null)) return fallback
  const persons = parsed as Person[]
  return new Set(persons.map((person) => person.id)).size === persons.length ? persons : fallback
}

/**
 * Les parts d'une clé fixe, sur les personnes d'aujourd'hui : une personne arrivée depuis n'y a
 * rien (0), une partie n'y est plus, et les parts restantes sont ramenées à 1. Une part douteuse, plus
 * de 1 en tout, ou rien à partager, rend la version malformée.
 */
function shares(value: unknown, ids: string[]): Record<string, number> | null {
  if (!isRecord(value)) return null
  const result: Record<string, number> = {}
  let sum = 0
  for (const id of ids) {
    const share = id in value ? value[id] : 0
    if (!finite(share) || share < 0 || share > 1) return null
    result[id] = share
    sum += share
  }
  // Plus de 1 : la clé est malformée. Moins de 1 : une personne est partie avec sa part.
  if (sum <= 0 || sum > 1.001) return null
  if (sum < 0.999) for (const id of ids) result[id] /= sum
  return result
}

function sharesVersions(value: unknown, ids: string[]): SharesVersion[] {
  if (!Array.isArray(value)) return []
  const versions: SharesVersion[] = []
  for (const item of value) {
    if (!isRecord(item) || !isMonth(item.from)) continue
    const byPerson = shares(item.byPerson, ids)
    if (byPerson) versions.push({ from: item.from, byPerson })
  }
  return versions.sort((a, b) => a.from.localeCompare(b.from))
}

function splitKeys(value: unknown, ids: string[]): SplitKey[] {
  const keys: SplitKey[] = [{ id: 'prorata', kind: 'prorata' }]
  if (!Array.isArray(value)) return keys
  for (const item of value) {
    if (!isRecord(item) || item.kind !== 'fixed' || typeof item.id !== 'string' || item.id === '' || item.id === 'prorata') continue
    if (keys.some((key) => key.id === item.id)) continue
    const versions = sharesVersions(item.shares, ids)
    if (versions.length === 0) continue
    keys.push({ id: item.id, kind: 'fixed', name: text(item.name, 'Clé'), shares: versions, updatedAt: stamp(item.updatedAt) })
  }
  return keys
}

function components(value: unknown): IncomeComponent[] {
  if (!Array.isArray(value)) return []
  const result: IncomeComponent[] = []
  for (const item of value) {
    if (!isRecord(item) || !finite(item.amount)) continue
    const component: IncomeComponent = { amount: item.amount }
    if (typeof item.label === 'string' && item.label !== '') component.label = item.label
    result.push(component)
  }
  return result
}

function incomes(value: unknown, ids: string[]): Income[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: Income[] = []
  for (const item of value) {
    if (!isRecord(item) || !isMonth(item.month) || typeof item.personId !== 'string' || !ids.includes(item.personId)) continue
    const key = `${item.month}|${item.personId}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ month: item.month, personId: item.personId, components: components(item.components), updatedAt: stamp(item.updatedAt) })
  }
  return result
}

function amount(value: unknown): Amount | null {
  if (!isRecord(value)) return null
  if (value.kind === 'none') return { kind: 'none' }
  if (value.kind === 'items') {
    if (!Array.isArray(value.items)) return null
    const items = value.items
      .filter((item): item is Record<string, unknown> => isRecord(item) && finite(item.amount))
      .map((item) => {
        const montant = item.amount as number
        // Un ancien item « 4 mois » devient mensuel, ramené au mois : le total ne bouge pas.
        if (fourMonths(item.period)) return { label: text(item.label), amount: montant / 4 }
        const itemPeriod = period(item.period)
        return { label: text(item.label), amount: montant, ...(itemPeriod && itemPeriod !== 'monthly' ? { period: itemPeriod } : {}) }
      })
    return { kind: 'items', items }
  }
  if (!finite(value.value)) return null
  // Une ancienne version « 4 mois » devient mensuelle, ramenée au mois : l'historique garde ses montants.
  if (fourMonths(value.kind)) return { kind: 'monthly', value: value.value / 4 }
  const kind = period(value.kind)
  return kind ? { kind, value: value.value } : null
}

function period(value: unknown): Period | null {
  return value === 'monthly' || value === 'quarterly' || value === 'semiannual' || value === 'annual' || value === 'biennial' ? value : null
}

/** La périodicité « 4 mois » (`months4`, d'abord nommée `weekly4`) n'existe plus. */
const fourMonths = (value: unknown) => value === 'months4' || value === 'weekly4'

/** Une icône douteuse est écartée : la catégorie reste, sans icône. */
function categoryIcon(value: unknown): CategoryIcon | null {
  if (!isRecord(value) || typeof value.name !== 'string' || value.name === '' || typeof value.code !== 'string') return null
  if (!/^[0-9a-f]{4,6}$/i.test(value.code)) return null
  return { name: value.name.slice(0, 80), code: value.code.toLowerCase() }
}

function categories(value: unknown): Category[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: Category[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || item.id === '' || seen.has(item.id)) continue
    seen.add(item.id)
    const icon = categoryIcon(item.icon)
    result.push({ id: item.id, name: text(item.name, 'Sans nom'), ...(icon ? { icon } : {}), updatedAt: stamp(item.updatedAt) })
  }
  return result
}

/**
 * Le propriétaire d'une catégorie ou d'une opération personnelle : son champ, sinon le préfixe de
 * son identifiant (qu'une app d'avant, qui perd le champ, garde toujours).
 */
function owner(item: Record<string, unknown>, id: string, personIds: string[]): string | null {
  return typeof item.owner === 'string' && personIds.includes(item.owner) ? item.owner : ownerFromId(id, personIds)
}

/** Les catégories de l'écran ; une clé disparue retombe sur le prorata. */
function groups(value: unknown, keyIds: Set<string>, personIds: string[]): BudgetGroup[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: BudgetGroup[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || item.id === '' || seen.has(item.id)) continue
    seen.add(item.id)
    const personal = owner(item, item.id, personIds)
    result.push({
      id: item.id,
      name: text(item.name, 'Sans nom'),
      splitKeyId: typeof item.splitKeyId === 'string' && keyIds.has(item.splitKeyId) ? item.splitKeyId : 'prorata',
      save: item.save === true,
      ...(personal ? { owner: personal } : {}),
      updatedAt: stamp(item.updatedAt),
    })
  }
  return result
}

/**
 * Range chaque version dans sa catégorie. Une version sans catégorie connue — un document d'avant
 * les catégories, ou écrit par une app qui ne les connaît pas encore — va dans celle que l'écran
 * lui donnait : sa clé fixe (« Ratio »), sinon le prorata, épargné ou mensuel ; la catégorie est
 * créée au besoin, sous son identifiant fixe. Chaque version reprend enfin la répartition et
 * l'épargne de sa catégorie, que les apps d'avant les catégories lisent encore.
 */
function placeVersions(versions: BudgetVersion[], known: BudgetGroup[], keys: SplitKey[]): { groups: BudgetGroup[]; budgets: BudgetVersion[] } {
  const byId = new Map(known.map((group) => [group.id, group]))
  const legacyOf = (version: BudgetVersion) =>
    version.splitKeyId !== 'prorata' ? legacyRatioGroupId(version.splitKeyId) : version.save ? LEGACY_GROUP_SAVE : LEGACY_GROUP_MONTHLY
  // Les catégories à créer, dans l'ordre des anciennes sections : les ratios, puis le prorata.
  const needed = new Set(versions.filter((version) => !byId.has(version.groupId)).map(legacyOf))
  const created: BudgetGroup[] = []
  const fixedKeys = keys.filter((key) => key.kind === 'fixed')
  const usedFixed = fixedKeys.filter((key) => needed.has(legacyRatioGroupId(key.id)))
  for (const key of usedFixed) {
    const id = legacyRatioGroupId(key.id)
    if (byId.has(id)) continue
    // Une seule clé fixe : c'était « Ratio ». Plusieurs : chacune son nom.
    created.push({ id, name: usedFixed.length === 1 ? 'Ratio' : key.name, splitKeyId: key.id, save: false, updatedAt: '1970-01-01T00:00:00.000Z' })
  }
  if (needed.has(LEGACY_GROUP_SAVE) && !byId.has(LEGACY_GROUP_SAVE)) {
    created.push({ id: LEGACY_GROUP_SAVE, name: 'Prorata épargné', splitKeyId: 'prorata', save: true, updatedAt: '1970-01-01T00:00:00.000Z' })
  }
  if (needed.has(LEGACY_GROUP_MONTHLY) && !byId.has(LEGACY_GROUP_MONTHLY)) {
    created.push({ id: LEGACY_GROUP_MONTHLY, name: 'Prorata mensuel', splitKeyId: 'prorata', save: false, updatedAt: '1970-01-01T00:00:00.000Z' })
  }
  const all = [...known, ...created]
  const final = new Map(all.map((group) => [group.id, group]))
  const budgets = versions.map((version) => {
    const group = final.get(byId.has(version.groupId) ? version.groupId : legacyOf(version)) as BudgetGroup
    return { ...version, groupId: group.id, splitKeyId: group.splitKeyId, save: group.save }
  })
  return { groups: all, budgets }
}

function budgets(value: unknown, categoryIds: Set<string>, keyIds: Set<string>): BudgetVersion[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: BudgetVersion[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.categoryId !== 'string' || !categoryIds.has(item.categoryId) || !isMonth(item.from)) continue
    const key = `${item.categoryId}|${item.from}`
    if (seen.has(key)) continue
    const parsed = amount(item.amount)
    if (!parsed) continue
    seen.add(key)
    const version: BudgetVersion = {
      categoryId: item.categoryId,
      from: item.from,
      // Rangée ou non : `placeVersions` la range.
      groupId: typeof item.groupId === 'string' ? item.groupId : '',
      // Une clé disparue retombe sur le prorata plutôt que de faire disparaître la dépense.
      splitKeyId: typeof item.splitKeyId === 'string' && keyIds.has(item.splitKeyId) ? item.splitKeyId : 'prorata',
      amount: parsed,
      save: item.save === true,
      updatedAt: stamp(item.updatedAt),
    }
    if (typeof item.note === 'string' && item.note !== '') version.note = item.note
    result.push(version)
  }
  return result
}

/** Les projets ; un lien vers une dépense disparue est oublié. */
function projects(value: unknown, categoryIds: Set<string>, personIds: string[]): Project[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: Project[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || item.id === '' || seen.has(item.id)) continue
    seen.add(item.id)
    const items = Array.isArray(item.items)
      ? item.items
          .filter((line): line is Record<string, unknown> => isRecord(line) && typeof line.id === 'string' && finite(line.amount))
          .map((line) => ({ id: line.id as string, label: text(line.label), amount: line.amount as number }))
      : []
    const project: Project = { id: item.id, name: text(item.name, 'Sans nom'), items, updatedAt: stamp(item.updatedAt) }
    if (isMonth(item.target)) project.target = item.target
    const icon = categoryIcon(item.icon)
    if (icon) project.icon = icon
    if (isRecord(item.budget) && typeof item.budget.categoryId === 'string' && categoryIds.has(item.budget.categoryId)) project.budget = { categoryId: item.budget.categoryId }
    const personal = owner(item, item.id, personIds)
    if (personal) project.owner = personal
    result.push(project)
  }
  return result
}

/** Les opérations importées ; un rangement vers une dépense disparue est oublié. */
function transactions(value: unknown, categoryIds: Set<string>, personIds: string[]): Transaction[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: Transaction[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || item.id === '' || seen.has(item.id)) continue
    if (typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !finite(item.amount)) continue
    seen.add(item.id)
    const transaction: Transaction = { id: item.id, date: item.date, label: text(item.label).slice(0, 200), amount: item.amount, updatedAt: stamp(item.updatedAt) }
    if (typeof item.detail === 'string' && item.detail !== '') transaction.detail = item.detail.slice(0, 200)
    const personal = owner(item, item.id, personIds)
    if (personal) transaction.owner = personal
    if (item.ignored === true) transaction.ignored = true
    else if (item.saving === true) transaction.saving = true
    else if (item.unplanned === true) transaction.unplanned = true
    else if (typeof item.categoryId === 'string' && categoryIds.has(item.categoryId)) transaction.categoryId = item.categoryId
    if (item.manual === true && (transaction.ignored || transaction.saving || transaction.unplanned || transaction.categoryId)) transaction.manual = true
    result.push(transaction)
  }
  return result
}

function rules(value: unknown, categoryIds: Set<string>): MatchRule[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: MatchRule[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.key !== 'string' || item.key === '' || seen.has(item.key)) continue
    if (item.ignored === true) result.push({ key: item.key, ignored: true, updatedAt: stamp(item.updatedAt) })
    else if (item.saving === true) result.push({ key: item.key, saving: true, updatedAt: stamp(item.updatedAt) })
    else if (typeof item.categoryId === 'string' && categoryIds.has(item.categoryId)) result.push({ key: item.key, categoryId: item.categoryId, updatedAt: stamp(item.updatedAt) })
    else continue
    seen.add(item.key)
  }
  return result
}

function settings(value: unknown): Settings {
  const window = isRecord(value) && finite(value.prorataWindowMonths) ? Math.round(value.prorataWindowMonths) : DEFAULT_WINDOW_MONTHS
  return { prorataWindowMonths: Math.min(60, Math.max(1, window)) }
}

/** Un état propre, quoi qu'on lui donne. */
export function sanitizeState(value: unknown): State {
  const base = defaultState()
  if (!isRecord(value)) return base
  const persons = people(value.people, base.people)
  const ids = persons.map((person) => person.id)
  const keys = splitKeys(value.splitKeys, ids)
  const keyIds = new Set(keys.map((k) => k.id))
  const cats = categories(value.categories)
  const raw = budgets(value.budgets, new Set(cats.map((c) => c.id)), keyIds)
  // Un document d'avant les catégories (pas de liste) sans aucune dépense : les trois de départ,
  // celles dont la clé existe.
  const known = Array.isArray(value.groups) ? groups(value.groups, keyIds, ids) : raw.length === 0 ? base.groups.filter((group) => keyIds.has(group.splitKeyId)) : []
  const placed = placeVersions(raw, known, keys)
  // Une dépense sans version n'existe pas : elle ne pourrait s'afficher nulle part.
  const withVersions = cats.filter((c) => placed.budgets.some((v) => v.categoryId === c.id))
  const state: State = {
    schema: 1,
    people: persons,
    splitKeys: keys,
    incomes: incomes(value.incomes, ids),
    groups: placed.groups,
    categories: withVersions,
    budgets: placed.budgets,
    projects: projects(value.projects, new Set(withVersions.map((c) => c.id)), ids),
    transactions: transactions(value.transactions, new Set(withVersions.map((c) => c.id)), ids),
    rules: rules(value.rules, new Set(withVersions.map((c) => c.id))),
    settings: settings(value.settings),
  }
  // Les projets d'avant les projets personnels : épargné dans un budget perso, c'est le sien.
  state.projects = state.projects.map((project) => {
    const scope = !project.owner && project.budget ? categoryScope(state, project.budget.categoryId) : null
    return scope ? { ...project, owner: scope } : project
  })
  // Seule, une personne n'a pas de commun : tout est à elle.
  return persons.length === 1 ? ownEverything(state, persons[0].id) : state
}

function ownEverything(state: State, owner: string): State {
  return {
    ...state,
    groups: state.groups.map((group) => (group.owner === owner ? group : { ...group, owner })),
    transactions: state.transactions.map((t) => (t.owner === owner ? t : { ...t, owner })),
    projects: state.projects.map((p) => (p.owner === owner ? p : { ...p, owner })),
  }
}

/** Un document du Worker ou du miroir local ; `null` s'il n'a pas la forme attendue. */
export function parseEnvelope(value: unknown): Envelope | null {
  if (!isRecord(value) || !finite(value.version) || value.version < 0) return null
  return { version: Math.floor(value.version), savedAt: stamp(value.savedAt), state: sanitizeState(value.state) }
}

/** Le fichier de sauvegarde proposé au téléchargement. */
export function exportPayload(state: State): string {
  return JSON.stringify({ app: 'budget', schema: 1, exportedAt: new Date().toISOString(), state }, null, 2)
}

/** Lit un fichier de sauvegarde ou une graine : l'état enveloppé ou nu. */
export function parseImport(raw: string): State {
  const data: unknown = JSON.parse(raw)
  const candidate = isRecord(data) && isRecord(data.state) ? data.state : data
  if (!isRecord(candidate) || candidate.schema !== 1) throw new Error('Format non reconnu : ce fichier n’est pas une sauvegarde du budget.')
  return sanitizeState(candidate)
}

