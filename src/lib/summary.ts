import { budgetAt, versionMonthly } from './budget'
import { addMonths, monthRange } from './month'
import { incomeOf, incomeTotal, prorataAt, sharesAt, split, type Prorata } from './prorata'
import { groupsOf, type Scope } from './scope'
import type { BudgetGroup, BudgetVersion, Category, Month, Shares, State } from './types'

export interface CategoryLine {
  category: Category
  version: BudgetVersion
  monthly: number
  shares: Record<string, number>
}

/** Une catégorie de l'écran pour un mois : ses parts du mois, ses dépenses actives, ses totaux. */
export interface BudgetSection {
  group: BudgetGroup
  shares: Shares
  lines: CategoryLine[]
  total: number
  totals: Record<string, number>
}

export interface MonthSummary {
  month: Month
  prorata: Prorata
  /** Les catégories, par ordre alphabétique, même vides ; chacune ses dépenses du mois. */
  sections: BudgetSection[]
  /** Ce que chacun verse sur le commun : la somme de ses parts. */
  due: Record<string, number>
  total: number
  /** La part de chacun dans le total versé : le ratio effectif, toutes clés confondues. */
  effective: Shares
  /** Dont à mettre de côté, par personne : les catégories à épargner. */
  toSave: Record<string, number>
  toSaveTotal: number
  /** (À verser au commun + budget personnel) / revenu moyen ; `null` sans revenu. */
  effort: Record<string, number | null>
  /** Au commun, le total du budget personnel de chacun ; à zéro pour le budget d'une personne. */
  personal: Record<string, number>
  /** Revenu moyen − à verser au commun − budget personnel ; `null` sans revenu. */
  remaining: Record<string, number | null>
}

/** Les catégories de l'écran d'un périmètre (le commun par défaut), par ordre alphabétique, partout où on les liste. */
export function sortedGroups(state: State, scope: Scope = null): BudgetGroup[] {
  return groupsOf(state, scope).sort((x, y) => x.name.localeCompare(y.name, 'fr', { sensitivity: 'base' }))
}

/**
 * La feuille `Mensuels`, pour un mois : les dépenses rangées par catégorie, la part de chacun
 * selon la répartition de leur catégorie, et les totaux. UN SEUL ratio par mois pour tous les
 * chiffres : le prorata du mois sert aussi bien aux parts qu'au taux d'effort, dont le
 * dénominateur est le revenu moyen de la même fenêtre.
 *
 * Le budget d'une personne (`scope`) se lit de même, sans répartition : elle paie tout, et son
 * « à verser » est le total de son budget.
 */
export function monthSummary(state: State, month: Month, scope: Scope = null): MonthSummary {
  const prorata = prorataAt(state, month)
  const zero = () => Object.fromEntries(state.people.map((person) => [person.id, 0])) as Record<string, number>

  // Les catégories par ordre alphabétique, comme les dépenses qu'elles contiennent.
  const sections: BudgetSection[] = sortedGroups(state, scope).map((group) => {
    const shares = group.owner ? Object.fromEntries(state.people.map((person) => [person.id, person.id === group.owner ? 1 : 0])) : sharesAt(state, group.splitKeyId, month)
    const lines: CategoryLine[] = []
    for (const category of state.categories) {
      const version = budgetAt(state, category.id, month)
      if (!version || version.amount.kind === 'none' || version.groupId !== group.id) continue
      const monthly = versionMonthly(version)
      lines.push({ category, version, monthly, shares: split(monthly, shares) })
    }
    lines.sort((a, b) => a.category.name.localeCompare(b.category.name, 'fr'))
    const totals = zero()
    for (const line of lines) for (const [personId, part] of Object.entries(line.shares)) totals[personId] += part
    return { group, shares, lines, total: lines.reduce((sum, line) => sum + line.monthly, 0), totals }
  })

  const due = zero()
  const toSave = zero()
  for (const section of sections) {
    for (const [personId, part] of Object.entries(section.totals)) {
      due[personId] += part
      if (section.group.save) toSave[personId] += part
    }
  }
  const total = Object.values(due).reduce((a, b) => a + b, 0)
  const effective: Shares = {}
  const effort: Record<string, number | null> = {}
  const remaining: Record<string, number | null> = {}
  // Le taux d'effort et le reste à vivre se comptent après le commun ET le budget de chacun
  // (que le commun ne lit pas) : les deux disent la même chose, l'un en part, l'autre en euros.
  const personal = zero()
  for (const person of state.people) {
    effective[person.id] = total > 0 ? due[person.id] / total : 1 / state.people.length
    const average = prorata.averages[person.id]
    if (scope === null) personal[person.id] = personalTotal(state, month, person.id)
    effort[person.id] = average > 0 ? (due[person.id] + personal[person.id]) / average : null
    remaining[person.id] = average > 0 ? average - due[person.id] - personal[person.id] : null
  }

  return {
    month,
    prorata,
    sections,
    due,
    total,
    effective,
    toSave,
    toSaveTotal: Object.values(toSave).reduce((a, b) => a + b, 0),
    effort,
    personal,
    remaining,
  }
}

/**
 * Le total du budget d'une personne à un mois. Avant son premier budget, c'est ce premier budget
 * qui vaut, comme pour le commun : le reste à vivre des mois passés ne l'ignore pas.
 */
export function personalTotal(state: State, month: Month, personId: string): number {
  const first = firstBudgetMonth(state, personId)
  if (!first) return 0
  return monthSummary(state, month < first ? first : month, personId).total
}

/** Le mois du premier budget d'un périmètre (le commun par défaut) : avant lui, c'est lui qui vaut. */
export function firstBudgetMonth(state: State, scope: Scope = null): Month | undefined {
  const groupIds = new Set(groupsOf(state, scope).map((group) => group.id))
  return state.budgets
    .filter((version) => groupIds.has(version.groupId))
    .map((version) => version.from)
    .sort()[0]
}

export interface BudgetPoint {
  month: Month
  /** Le total du budget ce mois-là (du commun, ou d'une personne), toutes catégories. */
  total: number
  /** Le total a changé ce mois-là : une catégorie a été créée, modifiée ou retirée. */
  changed: boolean
  /** Le revenu du foyer ce mois-là (tous les revenus), ou de la personne pour son budget ; `null` s'il en manque un. */
  income: number | null
}

/**
 * L'évolution du total du budget, mois par mois, face au revenu du foyer, du premier mois saisi
 * (budget ou revenu) au mois donné.
 *
 * Le total ne dépend que des budgets — pas du prorata, qui ne fait que le répartir. Il ne bouge
 * donc qu'aux changements, et la courbe est un escalier : chaque marche est une modification.
 * Les revenus remontent souvent plus loin que les budgets, qui commencent au mois où on les a
 * saisis : avant le premier budget, c'est ce premier budget qui compte, comme le classeur
 * appliquait le sien à toute l'année (et comme le reste à vivre de l'écran Revenus).
 */
export function budgetHistory(state: State, upTo: Month, scope: Scope = null): BudgetPoint[] {
  const groupIds = new Set(groupsOf(state, scope).map((group) => group.id))
  const firstBudget = firstBudgetMonth(state, scope)
  if (!firstBudget || firstBudget > upTo) return []
  // Face au commun, le revenu du foyer ; face au budget d'une personne, le sien.
  const people = scope ? state.people.filter((person) => person.id === scope) : state.people
  const firstIncome = state.incomes
    .filter((income) => incomeTotal(income) > 0 && people.some((person) => person.id === income.personId))
    .map((income) => income.month)
    .sort()[0]
  const start = firstIncome && firstIncome < firstBudget ? firstIncome : firstBudget
  const totalAt = (month: Month) =>
    state.categories.reduce((sum, category) => {
      const version = budgetAt(state, category.id, month)
      return version && groupIds.has(version.groupId) ? sum + versionMonthly(version) : sum
    }, 0)
  const points: BudgetPoint[] = []
  for (let month = start; month <= upTo; month = addMonths(month, 1)) {
    const total = totalAt(month < firstBudget ? firstBudget : month)
    const incomes = people.map((person) => incomeTotal(incomeOf(state, month, person.id)))
    const previous = points[points.length - 1]
    points.push({
      month,
      total,
      changed: !previous || Math.abs(previous.total - total) > 0.005,
      income: incomes.every((value) => value > 0) ? incomes.reduce((sum, value) => sum + value, 0) : null,
    })
  }
  return points
}

export interface IncomePoint {
  month: Month
  /** Le revenu saisi de chacun ce mois-là ; `null` s'il manque. */
  income: Record<string, number | null>
  /** Ce qui lui reste ce mois-là : son revenu du mois moins sa part à verser et son budget à lui ; `null` sans revenu. */
  remaining: Record<string, number | null>
}

/**
 * Les revenus saisis, mois par mois, du premier au dernier mois saisi, et le reste à vivre de
 * chacun : le revenu DU MOIS moins ce qu'il verse au commun et son budget personnel ce mois-là. (La synthèse, elle, part du revenu
 * MOYEN : son reste à vivre est celui de l'année glissante, pas celui d'un mois.) Un mois sans
 * revenu pour une personne laisse un trou dans ses deux courbes.
 *
 * Les revenus remontent souvent plus loin que les budgets, qui commencent au mois où on les a
 * saisis. Avant le premier budget, on applique ce premier budget, comme le classeur appliquait
 * le sien à toute l'année : sans quoi le reste à vivre y égalerait le revenu.
 */
export function incomeHistory(state: State): IncomePoint[] {
  const months = state.incomes.filter((income) => incomeTotal(income) > 0).map((income) => income.month).sort()
  if (months.length === 0) return []
  const firstBudget = firstBudgetMonth(state)
  return monthRange(months[0], months[months.length - 1]).map((month) => {
    const due = monthSummary(state, firstBudget && month < firstBudget ? firstBudget : month).due
    const income: Record<string, number | null> = {}
    const remaining: Record<string, number | null> = {}
    for (const person of state.people) {
      const total = incomeTotal(incomeOf(state, month, person.id))
      income[person.id] = total > 0 ? total : null
      remaining[person.id] = total > 0 ? total - (due[person.id] ?? 0) - personalTotal(state, month, person.id) : null
    }
    return { month, income, remaining }
  })
}
