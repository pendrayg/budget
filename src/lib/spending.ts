import { budgetAt, versionMonthly, versionsOf } from './budget'
import { judgedMonths, periodAllowance } from './amount'
import { addMonths, monthsBetween } from './month'
import type { StatementLine } from './statement'
import { categoryScope, scopePrefix, type Scope } from './scope'
import { firstBudgetMonth, sortedGroups } from './summary'
import type { BudgetGroup, BudgetVersion, Category, MatchRule, Month, Project, State, Transaction } from './types'

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
 * Une dépense où ranger une opération de ce jour-là : pas une dépense arrêtée ce mois-là (« plus
 * budgété »), comme celle d'un projet supprimé. Avant sa première version, elle l'accepte : une
 * dépense créée ce mois-ci range aussi le relevé du mois dernier.
 */
export function placeableAt(state: State, categoryId: string, date: string): boolean {
  return budgetAt(state, categoryId, date.slice(0, 7))?.amount.kind !== 'none'
}

/**
 * Où une opération se range d'après ce qu'on a appris. Une règle vers une dépense qui n'est plus
 * budgétée ce mois-là ne range rien. Le marchand AU MÊME MONTANT d'abord (hors
 * carte, cf. `ruleKeys`) : deux prélèvements d'un même assureur (la maison, la voiture) se
 * distinguent par leur montant ; puis le marchand seul, pour un montant nouveau. Un versement reçu par virement est écarté d'office :
 * c'est l'un de nous qui alimente le compte.
 */
function placementOf(state: State, transaction: Pick<Transaction, 'date' | 'label' | 'detail' | 'amount' | 'owner'>, rules: Map<string, MatchRule>): Placement {
  for (const key of ruleKeys(transaction)) {
    const rule = rules.get(key)
    if (rule?.ignored) return { ignored: true }
    if (rule?.saving) return { saving: true }
    if (rule?.categoryId) return placeableAt(state, rule.categoryId, transaction.date) ? { categoryId: rule.categoryId } : null
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
  /** Les opérations d'une capture que le relevé a remplacées (cf. `importStatement`). */
  confirmed: number
}

/** Les jours d'écart tolérés entre une opération lue sur une capture et la même au relevé (date de carte, date de débit). */
const CAPTURE_DAYS = 4

const daysBetween = (a: string, b: string) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000

/** Parmi `candidates`, l'opération du même montant la plus proche en date, à `CAPTURE_DAYS` jours au plus. */
function sameOperation(candidates: Transaction[], line: StatementLine): Transaction | undefined {
  return candidates
    .filter((t) => cents(t.amount) === cents(line.amount) && daysBetween(t.date, line.date) <= CAPTURE_DAYS)
    .sort((a, b) => daysBetween(a.date, line.date) - daysBetween(b.date, line.date))[0]
}

/**
 * Ajoute les opérations d'un relevé. Leur identifiant tient de la date, du montant, du libellé et
 * du rang parmi les opérations identiques du relevé (deux pleins de 2,80 € le même jour) :
 * réimporter un relevé n'ajoute rien. Chacune se range d'après ce qu'on a appris.
 *
 * Le relevé est celui du compte choisi (`scope`) : le commun, ou celui d'une personne, dont les
 * opérations portent son nom (et son préfixe, dans leur identifiant).
 *
 * Une CAPTURE d'écran (`provisional`) s'importe de même, ses opérations marquées provisoires —
 * sauf celles déjà au relevé (même montant, à quelques jours près). Le relevé, ensuite, REMPLACE
 * chaque opération provisoire qu'il contient : la sienne prend sa place, et son rangement.
 */
export function importStatement(state: State, lines: StatementLine[], now: string, scope: Scope = null, provisional = false): ImportResult {
  const existing = new Set(state.transactions.map((t) => t.id))
  const rules = new Map(state.rules.map((rule) => [rule.key, rule]))
  const seen = new Map<string, number>()
  const added: Transaction[] = []
  const account = state.transactions.filter((t) => (t.owner ?? null) === scope)
  // Ce à quoi une ligne peut correspondre, chaque opération une seule fois : au relevé, les
  // provisoires ; sur une capture, celles du relevé.
  const pool = account.filter((t) => (t.provisional === true) !== provisional)
  const replaced = new Set<string>()
  let duplicates = 0
  for (const line of lines) {
    const base = `${line.date}|${cents(line.amount)}|${line.label}`
    const rank = seen.get(base) ?? 0
    seen.set(base, rank + 1)
    const id = `${scopePrefix(scope)}${provisional ? 'capture|' : ''}${base}|${rank}`
    if (existing.has(id)) {
      duplicates++
      continue
    }
    const match = sameOperation(
      pool.filter((t) => !replaced.has(t.id)),
      line,
    )
    if (match && provisional) {
      replaced.add(match.id)
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
      ...(provisional ? { provisional: true } : {}),
      updatedAt: now,
    }
    if (match) {
      // L'opération du relevé prend la place de la provisoire, et son rangement s'il y en a un.
      replaced.add(match.id)
      const kept = isSorted(match)
      const { id: _id, date: _date, label: _label, detail: _detail, amount: _amount, owner: _owner, provisional: _provisional, updatedAt: _updated, ...placement } = match
      added.push(kept ? { ...transaction, ...placement } : place(transaction, placementOf(state, transaction, rules), now))
      continue
    }
    added.push(place(transaction, placementOf(state, transaction, rules), now))
  }
  const confirmed = provisional ? 0 : replaced.size
  return {
    state: { ...state, transactions: [...state.transactions.filter((t) => provisional || !replaced.has(t.id)), ...added] },
    added: added.length - confirmed,
    duplicates,
    unsorted: added.filter((t) => !isSorted(t)).length,
    confirmed,
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
      const next = placementOf(state, t, byKey)
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

/** Les mois à montrer pour un budget : ceux de son compte, et ceux où une opération d'un autre compte est rangée dans l'une de ses dépenses. */
export function budgetSpendingMonths(state: State, scope: Scope = null): Month[] {
  const placedHere = state.transactions.filter((t) => t.categoryId !== undefined && (t.owner ?? null) !== scope && categoryScope(state, t.categoryId) === scope)
  return [...new Set([...spendingMonths(state, scope), ...placedHere.map((t) => t.date.slice(0, 7))])].sort().reverse()
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
  /** Du compte, rangées dans une dépense d'un autre budget (le foyer, une personne) : elles comptent là-bas. */
  elsewhere: Transaction[]
}

const byDate = (a: Transaction, b: Transaction) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label)
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)
const OVER = 0.005

/**
 * Une dépense PÉRIODIQUE à épargner (trimestrielle, annuelle, en items…) se juge en ENVELOPPE :
 * chacune de ses périodes y apporte son montant, chaque paiement en retire ; elle dépasse quand
 * l'enveloppe passe sous zéro. Un trajet semestriel de 120 € : 140 € puis 120 € le semestre
 * suivant dépassent de 20 € — le dépassement reste —, un troisième trajet dans l'année dépasse.
 * L'enveloppe part de la première version de la dépense, ou du premier relevé du compte s'il est
 * plus tard : avant, on ne sait pas ce qui a été payé. Un paiement rangé là d'avant la première
 * version la fait partir de lui, sur ce premier budget.
 */
function judgedAsEnvelope(state: State, categoryId: string, month: Month, scope: Scope) {
  const first = versionsOf(state, categoryId).find((version) => version.amount.kind !== 'none')
  if (!first) return { months: 1, spent: 0, budget: 0 }
  const paid = state.transactions.filter((t) => t.categoryId === categoryId)
  const firstPaid = paid.map((t) => t.date.slice(0, 7)).sort()[0]
  const firstStatement = spendingMonths(state, scope).at(-1)
  const start = firstPaid && firstPaid < first.from ? firstPaid : firstStatement && firstStatement > first.from ? firstStatement : first.from
  // Les périodes partent du début de l'enveloppe, ou du mois où la dépense a changé de rythme
  // (de 50 € par mois à des items trimestriels) : un simple changement de montant ne les relance pas.
  const versions = versionsOf(state, categoryId)
  const rhythm = (index: number) => judgedMonths(versions[index].amount)
  const anchorOf = (version: BudgetVersion) => {
    let index = versions.indexOf(version)
    while (index > 0 && rhythm(index - 1) === rhythm(index)) index -= 1
    // Le rythme de la première version part du début de l'enveloppe, même s'il la précède (un
    // paiement d'avant elle) ou la suit (le premier relevé).
    return index === 0 || versions[index].from < start ? start : versions[index].from
  }
  let budget = 0
  let months = 0
  for (let at = start; at <= month; at = addMonths(at, 1)) {
    const version = budgetAt(state, categoryId, at) ?? (at < first.from ? first : undefined)
    // Avant sa première version (un paiement d'avant), la dépense compte depuis le début de l'enveloppe.
    const anchor = version ? anchorOf(version) : start
    if (version) budget += periodAllowance(version.amount, monthsBetween(anchor > at ? start : anchor, at) - 1, at)
    months += 1
  }
  const spent = sum(paid.filter((t) => t.date.slice(0, 7) >= start && t.date.slice(0, 7) <= month).map((t) => t.amount))
  return { months: Math.max(1, months), spent, budget }
}

/**
 * La dépense d'un PROJET se juge sur le projet : tout ce qui a été payé jusqu'au mois face à son
 * total. L'écart est ce qu'il reste à payer (en vert), ou ce qui le dépasse (en rouge) — et non la
 * somme de ses mensualités, qui ne tombe pas sur le total dès qu'elles ont été recalculées.
 */
function judgedAgainstProject(state: State, categoryId: string, project: Project, month: Month) {
  const first = versionsOf(state, categoryId)[0]?.from ?? month
  const spent = sum(state.transactions.filter((t) => t.categoryId === categoryId && t.date.slice(0, 7) <= month).map((t) => t.amount))
  const budget = sum(project.items.map((item) => item.amount))
  return { months: Math.max(1, monthsBetween(first, month)), spent, budget }
}

/**
 * Une dépense à épargner AU MOIS — l'épargne d'un projet, une régularisation d'impôts — se juge sur
 * sa durée : de sa première mensualité à la dernière (la cible d'un projet), ou jusqu'au mois si
 * elle n'a pas de fin. Le payé de toute cette durée face à ses mensualités, chacune à son mois : un
 * projet payé en plusieurs fois, ou d'un coup à la fin, se juge sur son total.
 */
function judgedOverLife(state: State, categoryId: string, month: Month) {
  const versions = versionsOf(state, categoryId)
  const first = versions.find((version) => version.amount.kind !== 'none')
  if (!first) return { months: 1, spent: 0, budget: 0 }
  // La fin : la veille d'un arrêt (« plus budgété ») après le mois, sinon le mois lui-même.
  const stop = versions.find((version) => version.from > first.from && version.amount.kind === 'none' && !versions.some((later) => later.from > version.from && later.amount.kind !== 'none'))
  const end = stop ? addMonths(stop.from, -1) : month
  const last = end > month ? end : month
  let budget = 0
  let months = 0
  for (let at = first.from; at <= end; at = addMonths(at, 1)) {
    const version = budgetAt(state, categoryId, at)
    budget += version ? versionMonthly(version, at) : 0
    months += 1
  }
  const spent = sum(state.transactions.filter((t) => t.categoryId === categoryId && t.date.slice(0, 7) >= first.from && t.date.slice(0, 7) <= last).map((t) => t.amount))
  return { months, spent, budget }
}

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
  // Les opérations du COMPTE (à ranger, épargne, imprévus, pas des dépenses) ; et, pour chaque
  // dépense de ce budget, celles rangées dedans, de quelque compte qu'elles viennent : un relevé
  // perso porte aussi des dépenses du foyer, et l'inverse.
  const transactions = state.transactions.filter((t) => t.date.startsWith(month) && (t.owner ?? null) === scope).sort(byDate)
  const placedThisMonth = state.transactions.filter((t) => t.date.startsWith(month) && t.categoryId !== undefined).sort(byDate)
  const firstBudget = firstBudgetMonth(state, scope)
  const budgetMonth = firstBudget && month < firstBudget ? firstBudget : month

  const all: SpendingSection[] = sortedGroups(state, scope).map((group) => {
    const lines: SpendingLine[] = []
    for (const category of state.categories) {
      const own = placedThisMonth.filter((t) => t.categoryId === category.id)
      // Une dépense née après ce mois, où l'on a pourtant rangé des opérations, s'y juge sur son
      // premier budget — comme un mois d'avant le premier budget se juge sur celui-ci.
      const version = budgetAt(state, category.id, budgetMonth) ?? (own.length > 0 ? versionsOf(state, category.id)[0] : undefined)
      const groupId = version?.groupId ?? versionsOf(state, category.id).at(-1)?.groupId
      if (groupId !== group.id) continue
      const budget = version && version.amount.kind !== 'none' ? versionMonthly(version, budgetMonth) : 0
      if (budget === 0 && own.length === 0) continue
      const spent = sum(own.map((t) => t.amount))
      if (group.save) {
        // Une dépense à épargner arrêtée (un projet après sa cible) se paie souvent APRÈS sa
        // dernière mensualité : on la juge sur cette dernière, pas sur 0 €.
        const judged = budget > 0 ? version : versionsOf(state, category.id).filter((v) => v.from <= budgetMonth && v.amount.kind !== 'none').at(-1)
        const period = judged ? judgedMonths(judged.amount) : 12
        const life = period === null
        const project = state.projects.find((p) => p.budget?.categoryId === category.id)
        const { months, spent: yearSpent, budget: yearBudget } = project
          ? judgedAgainstProject(state, category.id, project, month)
          : life
            ? judgedOverLife(state, category.id, budgetMonth)
            : judgedAsEnvelope(state, category.id, month, scope)
        // Sur sa durée, chaque mensualité arrondie au centime peut manquer d'un centime au total.
        const slack = OVER + (life ? 0.01 * months : 0)
        lines.push({ category, budget, spent, transactions: own, year: { spent: yearSpent, budget: yearBudget, months }, over: yearSpent > yearBudget + slack })
      } else {
        lines.push({ category, budget, spent, transactions: own, over: spent > budget + OVER })
      }
    }
    lines.sort((a, b) => a.category.name.localeCompare(b.category.name, 'fr'))
    return { group, lines, budget: sum(lines.map((l) => l.budget)), spent: sum(lines.map((l) => l.spent)) }
  })
  // Rangée dans une dépense supprimée depuis : elle redevient à ranger. Rangée dans celle d'un
  // autre budget, elle compte là-bas.
  const versioned = new Set(state.budgets.map((version) => version.categoryId))
  const known = new Set(state.categories.filter((category) => versioned.has(category.id)).map((category) => category.id))
  const here = new Set(all.flatMap((section) => section.lines.map((line) => line.category.id)))
  const placed = (t: Transaction) => t.ignored === true || t.saving === true || t.unplanned === true || (t.categoryId !== undefined && known.has(t.categoryId))
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
    elsewhere: transactions.filter((t) => t.categoryId !== undefined && known.has(t.categoryId) && !here.has(t.categoryId)),
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
