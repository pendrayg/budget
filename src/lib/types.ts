/**
 * Le modèle du budget d'un foyer, de une à quatre personnes : ce que le classeur Excel tenait en
 * quatre feuilles.
 *
 * UN SEUL mécanisme d'historique, « à partir de tel mois » : les versions d'un budget (montant,
 * clé de répartition, épargne), les parts d'une clé fixe (un 30/70 renégocié en 40/60 sans
 * réécrire le passé) et l'archivage d'une catégorie (`amount.kind === 'none'`). Les revenus,
 * eux, sont naturellement datés : un par personne et par mois.
 *
 * DEUX NIVEAUX, et un mot piège. À l'écran, une CATÉGORIE (« Prorata mensuel », « Ratio »…) dit
 * comment on partage — au prorata des revenus, ou à un ratio fixe — et si c'est à épargner ; elle
 * contient des DÉPENSES (« Courses », « Prêt immo »…), chacune avec son montant. Dans le document
 * stocké, les dépenses gardent leur ancien nom : `categories` et `budgets` ; les catégories de
 * l'écran sont les `groups`. Renommer le stockage aurait demandé de migrer chaque sauvegarde.
 *
 * Le prorata n'est JAMAIS stocké : il se déduit des revenus, et son historique est celui des
 * revenus. Stocker le résultat inviterait la dérive entre le chiffre gardé et ce qui le fonde.
 */

/** `AAAA-MM`, zéro-complété : le tri des chaînes est l'ordre chronologique. */
export type Month = string

/** La couleur d'une personne dans les graphiques (cf. `src/lib/colors.ts`). */
export type PersonColor = 'blue' | 'orange' | 'aqua' | 'yellow' | 'pink' | 'green' | 'violet' | 'red'

export interface Person {
  id: string
  name: string
  /** Absente : celle de son rang (cf. `DEFAULT_COLORS`). */
  color?: PersonColor
  updatedAt: string
}

/** Parts de chacun, par identifiant de personne. La somme fait 1. */
export type Shares = Record<string, number>

/** Parts d'une clé fixe, valables à partir d'un mois. */
export interface SharesVersion {
  from: Month
  byPerson: Shares
}

export type SplitKey =
  | { id: 'prorata'; kind: 'prorata' }
  | { id: string; kind: 'fixed'; name: string; shares: SharesVersion[]; updatedAt: string }

export const PRORATA_KEY_ID = 'prorata'

export interface IncomeComponent {
  label?: string
  amount: number
}

/** Le revenu d'une personne pour un mois, en composantes (salaire, allocations…). */
export interface Income {
  month: Month
  personId: string
  components: IncomeComponent[]
  updatedAt: string
}

/** Une icône Nerd Font : son nom (« md-home ») et son point de code hexadécimal (« f02dc »). */
export interface CategoryIcon {
  name: string
  code: string
}

/**
 * Une catégorie de l'écran : un nom, une répartition et l'épargne, pour toutes ses dépenses.
 * La répartition est une clé : le prorata, ou un ratio fixe propre à la catégorie, dont les parts
 * changent « à partir d'un mois » sans réécrire le passé.
 */
export interface BudgetGroup {
  id: string
  name: string
  /** `prorata`, ou l'identifiant de la clé fixe de la catégorie. */
  splitKeyId: string
  /** Payé à l'année ou de loin en loin : la part mensuelle est à mettre de côté. */
  save: boolean
  /** Absent : une catégorie du commun. Sinon, la personne dont c'est le budget à elle, qu'elle
   *  paie seule (sa répartition est ignorée) ; son identifiant porte le même préfixe (cf. scope.ts). */
  owner?: string
  updatedAt: string
}

/** Une DÉPENSE (cf. plus haut : le stockage l'appelle encore catégorie). */
export interface Category {
  id: string
  name: string
  /** Affichée devant le nom, dans la ligne de la dépense. */
  icon?: CategoryIcon
  updatedAt: string
}

export interface AmountItem {
  label: string
  amount: number
  /** Absente : mensuelle (les items d'avant la périodicité par item). */
  period?: Period
}

export type Period = 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'biennial'

export type Amount =
  /** Un montant et sa périodicité, ramené au mois. */
  | { kind: Period; value: number }
  /** Une somme d'items (« Films + Musique »), chacun à sa périodicité (mensuelle si absente). */
  | { kind: 'items'; items: AmountItem[] }
  /** Plus budgété à partir de ce mois : l'archivage. */
  | { kind: 'none' }

/** Ce qu'une dépense coûte et dans quelle catégorie elle est, à partir d'un mois. */
export interface BudgetVersion {
  categoryId: string
  from: Month
  /** La catégorie de l'écran : c'est elle qui dit la répartition et l'épargne. */
  groupId: string
  /** Copies de la répartition et de l'épargne de la catégorie au moment de l'écriture : seules
   *  les versions d'avant les catégories les lisent (et les reconstruisent à partir d'elles). */
  splitKeyId: string
  amount: Amount
  save: boolean
  note?: string
  updatedAt: string
}

/**
 * Une opération du compte commun (ou d'un compte personnel), importée d'un relevé : ce qu'on a VRAIMENT dépensé, à comparer
 * au budget. Rangée dans une dépense du budget, ou écartée (un versement, un virement interne).
 */
export interface Transaction {
  /** Stable d'un import à l'autre : réimporter un relevé n'ajoute rien. */
  id: string
  /** Date d'opération, `AAAA-MM-JJ` ; son mois est celui de l'état des lieux. */
  date: string
  label: string
  /** Une ligne utile sous le libellé (le nom d'un virement…). */
  detail?: string
  /** Positif : un débit, une dépense. Négatif : un crédit (remboursement, versement). */
  amount: number
  /** La dépense du budget où elle compte. */
  categoryId?: string
  /** Pas une dépense : un versement sur le commun, un virement interne. */
  ignored?: boolean
  /** Le virement du mois vers le compte épargne : ce qu'on met de côté pour les dépenses annuelles. */
  saving?: boolean
  /** Une dépense imprévue, hors de toute dépense du budget : comptée dans le mois, sans budget. */
  unplanned?: boolean
  /** Absent : une opération du compte commun. Sinon, du compte de cette personne (cf. scope.ts). */
  owner?: string
  /** Rangée à la main, pas par une règle apprise : corriger le marchand ailleurs ne la déplace pas. */
  manual?: boolean
  updatedAt: string
}

/** Ce qu'on a appris d'une opération rangée à la main : les suivantes du même marchand suivent. */
export interface MatchRule {
  /** Le marchand, tiré du libellé (cf. `merchantKey`), préfixé du compte s'il est personnel. */
  key: string
  categoryId?: string
  ignored?: boolean
  saving?: boolean
  updatedAt: string
}

export interface ProjectItem {
  id: string
  label: string
  amount: number
}

/**
 * Un achat ponctuel, en lignes, du commun ou d'une personne. Avec une date cible, il peut
 * s'épargner dans le budget : il y devient une dépense d'une catégorie à épargner de son
 * périmètre (`budget`), dont la mensualité mène son total à la cible (cf. `src/lib/projects.ts`).
 */
export interface Project {
  id: string
  name: string
  items: ProjectItem[]
  /** Le mois visé pour l'achat. */
  target?: Month
  /** La dépense du budget qui l'épargne, tant qu'on l'épargne. */
  budget?: { categoryId: string }
  /** Absent : un projet du commun. Sinon, la personne dont c'est le projet ; son identifiant porte
   *  le même préfixe (cf. scope.ts). */
  owner?: string
  updatedAt: string
}

export interface Settings {
  /** Nombre de mois complets pris dans la moyenne du prorata. */
  prorataWindowMonths: number
}

export interface State {
  schema: 1
  /** De une à quatre (`MAX_PEOPLE`). Seule, une personne n'a pas de commun (cf. `people.ts`). */
  people: Person[]
  splitKeys: SplitKey[]
  incomes: Income[]
  /** Les catégories de l'écran, dans leur ordre d'affichage. */
  groups: BudgetGroup[]
  /** Les dépenses. */
  categories: Category[]
  budgets: BudgetVersion[]
  projects: Project[]
  /** Les opérations importées des relevés, et ce qu'on a appris pour les ranger. */
  transactions: Transaction[]
  rules: MatchRule[]
  settings: Settings
}

/** Le document tel que le Worker le garde et le rend : l'état et sa version. */
export interface Envelope {
  version: number
  savedAt: string
  state: State
}
