import { budgetAt, versionMonthly, versionsOf } from './budget'
import { judgedMonths } from './amount'
import { addMonths } from './month'
import type { StatementLine } from './statement'
import { categoriesOf, scopePrefix, type Scope } from './scope'
import { firstBudgetMonth, sortedGroups } from './summary'
import type { BudgetGroup, Category, MatchRule, Month, State, Transaction } from './types'

/**
 * L'état des lieux : ce qu'on a VRAIMENT dépensé, mois par mois, d'après les relevés du compte
 * commun, face au budget. Chaque opération est rangée dans une dépense du budget (Courses,
 * Essence…), reconnue comme le versement du mois vers l'épargne, ou écartée (un versement sur le
 * commun, un virement interne). Ranger une opération à
 * la main apprend son marchand : les suivantes, de ce mois et des relevés à venir, s'y rangent
 * seules.
 */

/**
 * Ce qu'on fait d'une opération : la ranger dans une dépense, y voir le versement vers l'épargne,
 * l'écarter, ou la laisser à ranger.
 */
export type Placement = { categoryId: string } | { saving: true } | { unplanned: true } | { ignored: true } | null

const cents = (amount: number) => Math.round(amount * 100)

/**
 * Le marchand d'une opération, pour reconnaître les suivantes : le libellé sans ce qui change
 * d'une fois à l'autre — la date d'achat (« CARTE 31/08/26 »), la carte (« CB*1234 »), le type
 * de prélèvement, les numéros et références. « CARTE 01/09/26 SUPERMARCHE DU PORT 9 CB*1234 » donne
 * « SUPERMARCHE DU PORT ». Un virement garde sa ligne de détail : « VIR SEPA DUPONT Jean » ne dit pas
 * à lui seul s'il paie le prêt ou alimente l'épargne.
 */
export function merchantKey(label: string, detail?: string): string {
  const words = (text: string) =>
    text
      .toUpperCase()
      .split(/\s+/)
      .map((word) => word.split('*')[0])
      .filter((word) => word !== '' && !/\d/.test(word))
      .join(' ')
  let text = label
    .replace(/^CARTE\s+\d{2}\/\d{2}\/\d{2}\s+/i, '')
    .replace(/\s*CB\*\d+\s*$/i, '')
    .replace(/^PRLV\s+SEPA\s+/i, '')
    .replace(/^VIR\s+SEPA\s+/i, 'VIR ')
  const transfer = /^VIR\b/i.test(text)
  text = words(text)
  if (transfer && detail) text = `${text} · ${words(detail)}`
  return text.trim()
}

/**
 * Les règles d'une opération, la plus précise d'abord, préfixées de son compte s'il est personnel
 * — chaque compte apprend les siens. Un prélèvement ou un virement : le marchand à ce montant
 * précis, puis le marchand seul ; deux contrats d'un même assureur se distinguent par leur
 * montant, qui revient chaque mois. Un paiement par CARTE : le marchand seul. Son montant change à
 * chaque passage et ne distingue rien : retenu, il gardait l'achat d'un montant déjà vu dans son
 * premier rangement, même corrigé depuis.
 */
function ruleKeys(transaction: Pick<Transaction, 'label' | 'detail' | 'amount' | 'owner'>): string[] {
  const merchant = `${scopePrefix(transaction.owner ?? null)}${merchantKey(transaction.label, transaction.detail)}`
  return /^CARTE\b/i.test(transaction.label) ? [merchant] : [`${merchant}|${cents(transaction.amount)}`, merchant]
}

/** Le marchand seul : la dernière, et la moins précise, des règles d'une opération. */
const merchantOf = (transaction: Pick<Transaction, 'label' | 'detail' | 'amount' | 'owner'>) => ruleKeys(transaction).at(-1) as string

/**
 * Où une opération se range d'après ce qu'on a appris. Le marchand AU MÊME MONTANT d'abord (hors
 * carte, cf. `ruleKeys`) : deux prélèvements d'un même assureur (la maison, la voiture) se
 * distinguent par leur montant ; puis le marchand seul, pour un montant nouveau. Un versement reçu par virement est écarté d'office :
 * c'est l'un de nous qui alimente le compte.
 */
function placementOf(transaction: Pick<Transaction, 'label' | 'detail' | 'amount' | 'owner'>, rules: Map<string, MatchRule>): Placement {
  for (const key of ruleKeys(transaction)) {
    const rule = rules.get(key)
    if (rule?.ignored) return { ignored: true }
    if (rule?.saving) return { saving: true }
    if (rule?.categoryId) return { categoryId: rule.categoryId }
  }
  if (transaction.amount < 0 && /^VIR\b/i.test(transaction.label)) return { ignored: true }
  return null
}

/** Range une opération ; `manual`, c'est la main qui l'a rangée là (cf. `Transaction.manual`). */
function place(transaction: Transaction, placement: Placement, updatedAt: string, manual = false): Transaction {
  const { categoryId: _category, ignored: _ignored, saving: _saving, unplanned: _unplanned, manual: _manual, ...base } = transaction
  if (!placement) return { ...base, updatedAt }
  const rest = manual ? { ...base, manual: true } : base
  if ('ignored' in placement) return { ...rest, ignored: true, updatedAt }
  if ('saving' in placement) return { ...rest, saving: true, updatedAt }
  if ('unplanned' in placement) return { ...rest, unplanned: true, updatedAt }
  return { ...rest, categoryId: placement.categoryId, updatedAt }
}

const isSorted = (transaction: Transaction) =>
  transaction.categoryId !== undefined || transaction.ignored === true || transaction.saving === true || transaction.unplanned === true

/** La règle apprise d'un rangement (un imprévu ne s'apprend pas, cf. `placeTransaction`). */
function ruleFor(placement: Exclude<Placement, null | { unplanned: true }>, key: string, updatedAt: string): MatchRule {
  if ('ignored' in placement) return { key, ignored: true, updatedAt }
  if ('saving' in placement) return { key, saving: true, updatedAt }
  return { key, categoryId: placement.categoryId, updatedAt }
}

export interface ImportResult {
  state: State
  added: number
  duplicates: number
  /** Parmi les ajoutées, celles qui restent à ranger. */
  unsorted: number
}

/**
 * Ajoute les opérations d'un relevé. Leur identifiant tient de la date, du montant, du libellé et
 * du rang parmi les opérations identiques du relevé (deux pleins de 2,80 € le même jour) :
 * réimporter un relevé n'ajoute rien. Chacune se range d'après ce qu'on a appris.
 *
 * Le relevé est celui du compte choisi (`scope`) : le commun, ou celui d'une personne, dont les
 * opérations portent son nom (et son préfixe, dans leur identifiant).
 */
export function importStatement(state: State, lines: StatementLine[], now: string, scope: Scope = null): ImportResult {
  const existing = new Set(state.transactions.map((t) => t.id))
  const rules = new Map(state.rules.map((rule) => [rule.key, rule]))
  const seen = new Map<string, number>()
  const added: Transaction[] = []
  let duplicates = 0
  for (const line of lines) {
    const base = `${line.date}|${cents(line.amount)}|${line.label}`
    const rank = seen.get(base) ?? 0
    seen.set(base, rank + 1)
    const id = `${scopePrefix(scope)}${base}|${rank}`
    if (existing.has(id)) {
      duplicates++
      continue
    }
    const transaction: Transaction = {
      id,
      date: line.date,
      label: line.label,
      ...(line.detail ? { detail: line.detail } : {}),
      amount: line.amount,
      ...(scope ? { owner: scope } : {}),
      updatedAt: now,
    }
    added.push(place(transaction, placementOf(transaction, rules), now))
  }
  return {
    state: { ...state, transactions: [...state.transactions, ...added] },
    added: added.length,
    duplicates,
    unsorted: added.filter((t) => !isSorted(t)).length,
  }
}

/**
 * Range une opération à la main, et l'apprend : son marchand, à ce montant et en général, ira
 * désormais là. Les autres opérations encore à ranger de ce marchand suivent aussitôt, comme
 * celles que l'ancienne règle avait rangées au même endroit (une correction) ; celles rangées
 * ailleurs, ou là à la main à leur montant, ne bougent pas. Rendre une opération « à ranger » n'apprend rien, ni la dire
 * imprévue : un imprévu est un cas d'espèce, le marchand reviendra peut-être pour autre chose.
 */
export function placeTransaction(state: State, transactionId: string, placement: Placement, now: string): State {
  const target = state.transactions.find((t) => t.id === transactionId)
  if (!target) return state
  if (!placement || 'unplanned' in placement) return { ...state, transactions: state.transactions.map((t) => (t.id === transactionId ? place(t, placement, now, true) : t)) }
  const keys = ruleKeys(target)
  const merchant = merchantOf(target)
  const rules = [...state.rules.filter((rule) => !keys.includes(rule.key)), ...keys.map((key) => ruleFor(placement, key, now))]
  const byKey = new Map(rules.map((rule) => [rule.key, rule]))
  // Une CORRECTION : les opérations du marchand que l'ancienne règle avait rangées au même endroit
  // la suivent. Pas celles qu'on y a rangées soi-même (l'autre contrat d'un même assureur).
  const samePlace = (t: Transaction) =>
    (t.categoryId !== undefined && t.categoryId === target.categoryId) || (t.saving === true && target.saving === true) || (t.ignored === true && target.ignored === true)
  const follows = (t: Transaction) => !t.manual && samePlace(t) && merchantOf(t) === merchant
  return {
    ...state,
    rules,
    transactions: state.transactions.map((t) => {
      if (t.id === transactionId) return place(t, placement, now, true)
      if (isSorted(t)) return follows(t) ? place(t, placement, now) : t
      const next = placementOf(t, byKey)
      return next ? place(t, next, now) : t
    }),
  }
}

/** Supprime les opérations d'un mois d'un compte (un relevé importé par erreur). Ce qu'on a appris reste. */
export function removeMonth(state: State, month: Month, scope: Scope = null): State {
  return { ...state, transactions: state.transactions.filter((t) => !(t.date.startsWith(month) && (t.owner ?? null) === scope)) }
}

/** Les mois qui ont des opérations sur un compte, du plus récent au plus ancien. */
export function spendingMonths(state: State, scope: Scope = null): Month[] {
  return [...new Set(state.transactions.filter((t) => (t.owner ?? null) === scope).map((t) => t.date.slice(0, 7)))].sort().reverse()
}

export interface SpendingLine {
  category: Category
  /** Le mensuel budgété ce mois-là ; 0 si la dépense n'y est pas budgétée. */
  budget: number
  /** Ce qui y a été dépensé ce mois-ci : ses opérations, les remboursements en moins. */
  spent: number
  transactions: Transaction[]
  /** Une dépense À ÉPARGNER se juge sur l'année glissante : payé sur les douze mois finissant à
   *  ce mois-ci, face à douze fois son mensuel — sur vingt-quatre pour un budget sur 2 ans.
   *  Absent pour une dépense courante. */
  year?: { spent: number; budget: number; months: number }
  /** Au-delà de son budget : du mois pour une dépense courante, de l'année pour une à épargner. */
  over: boolean
}

export interface SpendingSection {
  group: BudgetGroup
  lines: SpendingLine[]
  budget: number
  spent: number
}

export interface SpendingSummary {
  month: Month
  /** Les catégories courantes, jugées au mois. */
  sections: SpendingSection[]
  /** Les catégories à épargner : leurs paiements, jugés sur l'année, et le versement du mois. */
  savings: {
    sections: SpendingSection[]
    /** Les virements du mois vers l'épargne, et leur total face à ce qu'il fallait mettre de côté. */
    transfers: Transaction[]
    transferred: number
    toSave: number
  }
  /** Le mois : le courant dépensé plus le versé sur l'épargne, face au courant budgété plus le
   *  « à épargner ». Les paiements annuels n'y entrent pas : l'épargne les couvre. */
  budget: number
  spent: number
  /** Combien de dépenses du mois dépassent : au mois les courantes, sur l'année les à épargner.
   *  Seulement celles qui ont eu des opérations ce mois-ci, les seules qu'il montre. */
  overCount: number
  /** Les imprévus hors catégorie : comptés dans le dépensé du mois, sans budget en face. */
  unplanned: Transaction[]
  unplannedTotal: number
  /** À ranger, puis écartées : ni l'une ni l'autre ne compte dans le dépensé. */
  unsorted: Transaction[]
  ignored: Transaction[]
}

const byDate = (a: Transaction, b: Transaction) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label)
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)
const OVER = 0.005

/**
 * L'état des lieux d'un mois, rangé comme le budget : par catégorie, puis par dépense, le dépensé
 * face au budgété. Une dépense apparaît si elle est budgétée ce mois-là ou si on y a dépensé ;
 * elle est dans la catégorie de sa version du mois (ou de sa dernière, si elle n'est plus budgétée).
 * Un relevé d'avant le premier budget saisi se compare à ce premier budget, comme le classeur
 * appliquait le sien à toute l'année (et comme les graphiques).
 *
 * Deux mondes. Le COURANT se juge au mois. L'ÉPARGNE — les catégories à épargner, les dépenses
 * qui tombent une fois l'an — se met de côté chaque mois par un virement vers le compte épargne,
 * qui se compare au « à épargner » du mois ; ses paiements, eux, se jugent sur l'année glissante,
 * et n'entrent pas dans le dépensé du mois : le mois où tombe la taxe foncière n'est pas en
 * dépassement pour autant.
 */
export function spendingSummary(state: State, month: Month, scope: Scope = null): SpendingSummary {
  const inMonth = (t: Transaction) => t.date.startsWith(month) && (t.owner ?? null) === scope
  const transactions = state.transactions.filter(inMonth).sort(byDate)
  // Rangée dans une dépense supprimée depuis, ou d'un autre budget : elle redevient à ranger.
  const known = new Set(categoriesOf(state, scope).map((c) => c.id))
  const placed = (t: Transaction) => t.ignored === true || t.saving === true || t.unplanned === true || (t.categoryId !== undefined && known.has(t.categoryId))
  const firstBudget = firstBudgetMonth(state, scope)
  const budgetMonth = firstBudget && month < firstBudget ? firstBudget : month
  const within = (months: number) => {
    const start = addMonths(month, -(months - 1))
    return (t: Transaction) => t.date.slice(0, 7) >= start && t.date.slice(0, 7) <= month
  }

  const all: SpendingSection[] = sortedGroups(state, scope).map((group) => {
    const lines: SpendingLine[] = []
    for (const category of state.categories) {
      const own = transactions.filter((t) => t.categoryId === category.id)
      // Une dépense née après ce mois, où l'on a pourtant rangé des opérations, s'y juge sur son
      // premier budget — comme un mois d'avant le premier budget se juge sur celui-ci.
      const version = budgetAt(state, category.id, budgetMonth) ?? (own.length > 0 ? versionsOf(state, category.id)[0] : undefined)
      const groupId = version?.groupId ?? versionsOf(state, category.id).at(-1)?.groupId
      if (groupId !== group.id) continue
      const budget = version && version.amount.kind !== 'none' ? versionMonthly(version) : 0
      if (budget === 0 && own.length === 0) continue
      const spent = sum(own.map((t) => t.amount))
      if (group.save) {
        // Une dépense à épargner arrêtée (un projet après sa cible) se paie souvent APRÈS sa
        // dernière mensualité : on la juge sur cette dernière, pas sur 0 €.
        const judged = budget > 0 ? version : versionsOf(state, category.id).filter((v) => v.from <= budgetMonth && v.amount.kind !== 'none').at(-1)
        const months = judged ? judgedMonths(judged.amount) : 12
        const inWindow = within(months)
        const yearSpent = sum(state.transactions.filter((t) => t.categoryId === category.id && inWindow(t)).map((t) => t.amount))
        const yearBudget = (judged ? versionMonthly(judged) : 0) * months
        lines.push({ category, budget, spent, transactions: own, year: { spent: yearSpent, budget: yearBudget, months }, over: yearSpent > yearBudget + OVER })
      } else {
        lines.push({ category, budget, spent, transactions: own, over: spent > budget + OVER })
      }
    }
    lines.sort((a, b) => a.category.name.localeCompare(b.category.name, 'fr'))
    return { group, lines, budget: sum(lines.map((l) => l.budget)), spent: sum(lines.map((l) => l.spent)) }
  })
  const sections = all.filter((section) => !section.group.save)
  const saveSections = all.filter((section) => section.group.save)
  const transfers = transactions.filter((t) => t.saving === true)
  const transferred = sum(transfers.map((t) => t.amount))
  const toSave = sum(saveSections.map((section) => section.budget))
  const unplanned = transactions.filter((t) => t.unplanned === true)
  const unplannedTotal = sum(unplanned.map((t) => t.amount))
  return {
    month,
    sections,
    savings: { sections: saveSections, transfers, transferred, toSave },
    budget: sum(sections.map((section) => section.budget)) + toSave,
    spent: sum(sections.map((section) => section.spent)) + transferred + unplannedTotal,
    overCount: all.flatMap((section) => section.lines).filter((line) => line.over && line.transactions.length > 0).length,
    unplanned,
    unplannedTotal,
    unsorted: transactions.filter((t) => !placed(t)),
    ignored: transactions.filter((t) => t.ignored === true),
  }
}

/**
 * Le libellé à montrer : sans la date d'achat ni la carte, qui encombrent sans rien dire
 * (« CARTE 31/08/26 VIDEO EN LIGNE 2 CB*1234 » → « VIDEO EN LIGNE 2 »), ni « PRLV SEPA ».
 */
export function displayLabel(label: string): string {
  return (
    label
      .replace(/^CARTE\s+\d{2}\/\d{2}\/\d{2}\s+/i, '')
      .replace(/\s*CB\*\d+\s*$/i, '')
      .replace(/^PRLV\s+SEPA\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim() || label
  )
}
