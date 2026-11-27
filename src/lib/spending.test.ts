import { describe, expect, it } from 'vitest'
import { addCategory } from './budget'
import { seedState } from './fixtures'
import { displayLabel, importStatement, merchantKey, placeTransaction, removeMonth, spendingMonths, spendingSummary } from './spending'
import type { StatementLine } from './statement'
import { sanitizeState } from './state'

const releve: StatementLine[] = [
  { date: '2026-09-01', label: 'CARTE 30/08/26 SUPERMARCHE A CB*1234', amount: 38.4 },
  { date: '2026-09-02', label: 'VIR Virement depuis Compte perso', detail: 'DUPONT JEAN', amount: -2000 },
  { date: '2026-09-03', label: 'CARTE 02/09/26 SUPERMARCHE A CB*1234', amount: 22.9 },
  { date: '2026-09-07', label: 'PRLV SEPA ASSUREUR', amount: 95.2 },
  { date: '2026-09-07', label: 'PRLV SEPA ASSUREUR', amount: 42.1 },
  { date: '2026-09-08', label: 'CARTE 07/09/26 STATION CB*1234', amount: 2.8 },
  { date: '2026-09-08', label: 'CARTE 07/09/26 STATION CB*1234', amount: 2.8 },
]

const idOf = (name: string) => seedState().categories.find((c) => c.name === name)!.id

describe('marchand d’une opération', () => {
  it('oublie la date d’achat, la carte, le type de prélèvement et les numéros', () => {
    expect(merchantKey('CARTE 01/09/26 SUPERMARCHE DU PORT 9 CB*1234')).toBe('SUPERMARCHE DU PORT')
    expect(merchantKey('CARTE 27/09/26 Boutique.fr*X12AB3C CB*1234')).toBe('BOUTIQUE.FR')
    expect(merchantKey('PRLV SEPA OPERATEUR MOBILE')).toBe('OPERATEUR MOBILE')
  })

  it('garde le détail d’un virement, qui seul dit à quoi il sert', () => {
    expect(merchantKey('VIR SEPA DUPONT Jean', 'Pret immobilier maison')).toBe('VIR DUPONT JEAN · PRET IMMOBILIER MAISON')
  })

  it('montre un libellé sans date d’achat ni carte', () => {
    expect(displayLabel('CARTE 31/08/26 VIDEO EN LIGNE 2 CB*1234')).toBe('VIDEO EN LIGNE 2')
    expect(displayLabel('PRLV SEPA OPERATEUR MOBILE')).toBe('OPERATEUR MOBILE')
  })
})

describe('import d’un relevé', () => {
  it('ajoute les opérations, écarte les versements reçus, et n’ajoute rien au second import', () => {
    const first = importStatement(seedState(), releve, 't')
    expect(first.added).toBe(7)
    expect(first.duplicates).toBe(0)
    expect(first.unsorted).toBe(6)
    expect(first.state.transactions.find((t) => t.amount === -2000)?.ignored).toBe(true)
    // Deux pleins identiques le même jour restent deux opérations.
    expect(first.state.transactions.filter((t) => t.amount === 2.8)).toHaveLength(2)
    const second = importStatement(first.state, releve, 't2')
    expect(second.added).toBe(0)
    expect(second.duplicates).toBe(7)
    expect(spendingMonths(second.state)).toEqual(['2026-09'])
  })

  it('apprend le marchand d’une opération rangée, et range les suivantes, ce mois-ci et aux relevés suivants', () => {
    let state = importStatement(seedState(), releve, 't').state
    const courses = idOf('Courses')
    const first = state.transactions.find((t) => t.amount === 38.4)!
    state = placeTransaction(state, first.id, { categoryId: courses }, 't2')
    expect(state.transactions.find((t) => t.amount === 22.9)?.categoryId).toBe(courses)
    const october = importStatement(state, [{ date: '2026-10-02', label: 'CARTE 01/10/26 SUPERMARCHE A CB*1234', amount: 55 }], 't3')
    expect(october.unsorted).toBe(0)
    expect(october.state.transactions.find((t) => t.date === '2026-10-02')?.categoryId).toBe(courses)
  })

  it('distingue deux prélèvements d’un même marchand par leur montant', () => {
    let state = importStatement(seedState(), releve, 't').state
    const [maison, auto] = [idOf('Assurance habitation'), idOf('Assurance voiture')]
    state = placeTransaction(state, state.transactions.find((t) => t.amount === 95.2)!.id, { categoryId: maison }, 't2')
    state = placeTransaction(state, state.transactions.find((t) => t.amount === 42.1)!.id, { categoryId: auto }, 't3')
    const next = importStatement(
      state,
      [
        { date: '2026-10-07', label: 'PRLV SEPA ASSUREUR', amount: 95.2 },
        { date: '2026-10-07', label: 'PRLV SEPA ASSUREUR', amount: 42.1 },
      ],
      't4',
    ).state
    expect(next.transactions.find((t) => t.date === '2026-10-07' && t.amount === 95.2)?.categoryId).toBe(maison)
    expect(next.transactions.find((t) => t.date === '2026-10-07' && t.amount === 42.1)?.categoryId).toBe(auto)
  })

  it('ne déplace pas une opération déjà rangée en apprenant une autre', () => {
    let state = importStatement(seedState(), releve, 't').state
    const [a, b] = state.transactions.filter((t) => t.amount === 2.8)
    state = placeTransaction(state, a.id, { categoryId: idOf('Essence') }, 't2')
    expect(state.transactions.find((t) => t.id === b.id)?.categoryId).toBe(idOf('Essence'))
    state = placeTransaction(state, b.id, { ignored: true }, 't3')
    expect(state.transactions.find((t) => t.id === a.id)?.categoryId).toBe(idOf('Essence'))
  })
})

describe('état des lieux d’un mois', () => {
  it('range le dépensé comme le budget, par catégorie et par dépense, face au budgété', () => {
    let state = importStatement(seedState(), releve, 't').state
    const courses = idOf('Courses')
    state = placeTransaction(state, state.transactions.find((t) => t.amount === 38.4)!.id, { categoryId: courses }, 't2')
    const summary = spendingSummary(state, '2026-09')
    const monthly = summary.sections.find((s) => s.group.name === 'Prorata mensuel')!
    const line = monthly.lines.find((l) => l.category.id === courses)!
    expect(line.spent).toBeCloseTo(61.3, 2)
    // Septembre précède le premier budget (octobre) : c'est lui qui s'applique.
    expect(line.budget).toBeCloseTo(650, 2)
    expect(summary.budget).toBeCloseTo(3374, 2)
    expect(summary.spent).toBeCloseTo(61.3, 2)
    expect(summary.unsorted).toHaveLength(4)
    expect(summary.ignored).toHaveLength(1)
  })

  it('remet à ranger une opération dont la dépense a disparu, et supprime un mois importé', () => {
    let state = importStatement(seedState(), releve, 't').state
    state = placeTransaction(state, state.transactions[0].id, { categoryId: idOf('Courses') }, 't2')
    state = { ...state, categories: state.categories.filter((c) => c.name !== 'Courses') }
    expect(spendingSummary(state, '2026-09').unsorted.some((t) => t.id === state.transactions[0].id)).toBe(true)
    expect(removeMonth(state, '2026-09').transactions).toEqual([])
  })

  it('survit à l’assainissement : opérations et règles gardées, rangement vers une dépense disparue oublié', () => {
    let state = importStatement(seedState(), releve, '2026-10-01T08:00:00.000Z').state
    state = placeTransaction(state, state.transactions[0].id, { categoryId: idOf('Courses') }, '2026-10-01T08:01:00.000Z')
    expect(sanitizeState(state).transactions).toEqual(state.transactions)
    expect(sanitizeState(state).rules).toEqual(state.rules)
    const orphan = { ...state, transactions: state.transactions.map((t) => ({ ...t, categoryId: t.categoryId ? 'disparue' : undefined })) }
    expect(sanitizeState(orphan).transactions.some((t) => t.categoryId === 'disparue')).toBe(false)
  })
})

describe('réapprendre un marchand', () => {
  const station: StatementLine[] = [
    { date: '2026-08-02', label: 'CARTE 01/08/26 STATION DU PORT CB*1234', amount: 128.4 },
    { date: '2026-08-09', label: 'CARTE 08/08/26 STATION DU PORT CB*1234', amount: 60.1 },
    { date: '2026-08-16', label: 'CARTE 15/08/26 STATION DU PORT CB*1234', amount: 72.4 },
    { date: '2026-08-23', label: 'CARTE 22/08/26 STATION DU PORT CB*1234', amount: 15.17 },
  ]
  const at = (state: ReturnType<typeof seedState>, amount: number) => state.transactions.find((t) => t.amount === amount)!

  it('entraîne, à la correction, les opérations que l’ancienne règle avait rangées, et les relevés suivants', () => {
    let state = importStatement(seedState(), station.slice(0, 1), 't').state
    state = placeTransaction(state, at(state, 128.4).id, { categoryId: idOf('Courses') }, 't1')
    // Le relevé suivant se range tout seul en Courses ; c'était surtout de l'essence.
    state = importStatement(state, station.slice(1), 't2').state
    expect(state.transactions.map((t) => t.categoryId)).toEqual(Array(4).fill(idOf('Courses')))
    state = placeTransaction(state, at(state, 60.1).id, { categoryId: idOf('Essence') }, 't3')
    // Les deux autres suivent ; celle rangée à la main en Courses, à son montant, reste.
    expect(state.transactions.map((t) => t.categoryId)).toEqual([idOf('Courses'), idOf('Essence'), idOf('Essence'), idOf('Essence')])
    // Au relevé suivant, toute la station va en Essence — même au montant du tout premier achat :
    // un paiement par carte n'a pas de montant à lui.
    const next = importStatement(
      state,
      [
        { date: '2026-09-06', label: 'CARTE 05/09/26 STATION DU PORT CB*1234', amount: 80 },
        { date: '2026-09-13', label: 'CARTE 12/09/26 STATION DU PORT CB*1234', amount: 128.4 },
      ],
      't4',
    ).state
    expect(next.transactions.slice(-2).map((t) => t.categoryId)).toEqual([idOf('Essence'), idOf('Essence')])
  })

  it('oublie le montant des anciennes règles d’un paiement par carte', () => {
    // Une règle apprise avant : la station à 128,40 € en Courses ; le marchand, depuis, en Essence.
    const state = {
      ...seedState(),
      rules: [
        { key: 'STATION DU PORT|13475', categoryId: idOf('Courses'), updatedAt: 't1' },
        { key: 'STATION DU PORT', categoryId: idOf('Essence'), updatedAt: 't2' },
      ],
    }
    const next = importStatement(state, [{ date: '2026-09-13', label: 'CARTE 12/09/26 STATION DU PORT CB*1234', amount: 128.4 }], 't3').state
    expect(next.transactions[0].categoryId).toBe(idOf('Essence'))
  })

  it('ne touche pas aux montants rangés ailleurs à la main : deux contrats d’un même assureur', () => {
    let state = importStatement(seedState(), releve, 't').state
    const assureur = (amount: number) => state.transactions.find((t) => t.label === 'PRLV SEPA ASSUREUR' && t.amount === amount)!
    state = placeTransaction(state, assureur(95.2).id, { categoryId: idOf('Mutuelle') }, 't1')
    // Le second prélèvement a suivi en Mutuelle ; c'est l'autre contrat.
    state = placeTransaction(state, assureur(42.1).id, { categoryId: idOf('Assurance voiture') }, 't2')
    expect([assureur(95.2).categoryId, assureur(42.1).categoryId]).toEqual([idOf('Mutuelle'), idOf('Assurance voiture')])
    const next = importStatement(state, [{ date: '2026-10-07', label: 'PRLV SEPA ASSUREUR', amount: 95.2 }, { date: '2026-10-07', label: 'PRLV SEPA ASSUREUR', amount: 42.1 }], 't3').state
    expect(next.transactions.slice(-2).map((t) => t.categoryId)).toEqual([idOf('Mutuelle'), idOf('Assurance voiture')])
  })
})

describe('dépenses annuelles et épargne', () => {
  const taxe = () => idOf('Taxe foncière')

  it('un paiement annuel ne fait pas dépasser le mois : il se juge sur douze mois, hors du dépensé du mois', () => {
    // La taxe foncière de la graine : 1 200 € par an, 100 € par mois.
    let state = importStatement(seedState(), [{ date: '2026-10-15', label: 'PRLV SEPA DGFIP IMPOT FONCIER', amount: 1200 }], 't').state
    state = placeTransaction(state, state.transactions[0].id, { categoryId: taxe() }, 't2')
    const summary = spendingSummary(state, '2026-10')
    const line = summary.savings.sections.flatMap((s) => s.lines).find((l) => l.category.id === taxe())!
    expect(line.spent).toBe(1200)
    expect(line.year?.spent).toBe(1200)
    expect(line.year?.budget).toBeCloseTo(1200, 6)
    expect(line.over).toBe(false)
    expect(summary.spent).toBe(0)
    expect(summary.overCount).toBe(0)
    expect(summary.sections.some((s) => s.group.save)).toBe(false)
  })

  it('juge sur son premier budget une dépense née après le mois de ses opérations', () => {
    // La taxe foncière n'existe qu'à partir d'octobre 2026 ; un paiement de septembre y est rangé.
    let state = seedState()
    state = { ...state, budgets: state.budgets.map((v) => (v.categoryId === taxe() ? { ...v, from: '2026-10' } : v)) }
    state = { ...state, budgets: [...state.budgets, { ...state.budgets.find((v) => v.categoryId === idOf('Courses'))!, from: '2026-01' }] }
    state = importStatement(state, [{ date: '2026-09-15', label: 'PRLV SEPA DGFIP IMPOT FONCIER', amount: 600 }], 't').state
    state = placeTransaction(state, state.transactions[0].id, { categoryId: taxe() }, 't2')
    const line = spendingSummary(state, '2026-09').savings.sections.flatMap((s) => s.lines).find((l) => l.category.id === taxe())!
    expect(line.year?.budget).toBeCloseTo(1200, 6)
    expect(line.over).toBe(false)
  })

  it('signale une dépense annuelle payée au-delà de son budget sur l’année glissante', () => {
    let state = importStatement(
      seedState(),
      [
        { date: '2026-01-15', label: 'PRLV SEPA DGFIP IMPOT FONCIER', amount: 800 },
        { date: '2026-10-15', label: 'PRLV SEPA DGFIP IMPOT FONCIER', amount: 700 },
      ],
      't',
    ).state
    state = placeTransaction(state, state.transactions[0].id, { categoryId: taxe() }, 't2')
    const line = spendingSummary(state, '2026-10').savings.sections.flatMap((s) => s.lines).find((l) => l.category.id === taxe())!
    expect(line.year?.spent).toBe(1500)
    expect(line.over).toBe(true)
    expect(spendingSummary(state, '2026-10').overCount).toBe(1)
    // Le mois suivant, sans paiement : la dépense dépasse encore sur l'année, mais le mois ne la montre pas.
    expect(spendingSummary(state, '2026-11').savings.sections.flatMap((s) => s.lines).find((l) => l.category.id === taxe())?.over).toBe(true)
    expect(spendingSummary(state, '2026-11').overCount).toBe(0)
    // Treize mois plus tard, le paiement de janvier 2026 est sorti de l'année.
    expect(spendingSummary(state, '2027-02').savings.sections.flatMap((s) => s.lines).find((l) => l.category.id === taxe())?.over).toBe(false)
  })

  it('compte le versement du mois vers l’épargne face au « à épargner », et l’apprend', () => {
    const virement = { date: '2026-10-10', label: 'VIR Mensualisation frais annuels', detail: 'Commun épargne', amount: 160 }
    let state = importStatement(seedState(), [virement], 't').state
    state = placeTransaction(state, state.transactions[0].id, { saving: true }, 't2')
    const summary = spendingSummary(state, '2026-10')
    expect(summary.savings.transferred).toBeCloseTo(160, 2)
    expect(summary.savings.toSave).toBeCloseTo(425, 2)
    expect(summary.spent).toBeCloseTo(160, 2)
    expect(summary.budget).toBeCloseTo(3374, 2)
    const november = importStatement(state, [{ ...virement, date: '2026-11-10' }], 't3')
    expect(november.unsorted).toBe(0)
    expect(november.state.transactions.find((t) => t.date === '2026-11-10')?.saving).toBe(true)
    expect(sanitizeState({ ...november.state, transactions: november.state.transactions.map((t) => ({ ...t, updatedAt: '2026-10-01T00:00:00.000Z' })) }).transactions.filter((t) => t.saving)).toHaveLength(2)
    expect(sanitizeState(november.state).rules.some((r) => r.saving)).toBe(true)
  })
})

describe('imprévus hors catégorie', () => {
  it('comptent dans le dépensé du mois sans budget en face, et ne s’apprennent pas', () => {
    const lignes = [
      { date: '2026-10-05', label: 'CARTE 04/10/26 GARAGE CB*1234', amount: 350 },
      { date: '2026-10-20', label: 'CARTE 19/10/26 GARAGE CB*1234', amount: 40 },
    ]
    let state = importStatement(seedState(), lignes, 't').state
    state = placeTransaction(state, state.transactions[0].id, { unplanned: true }, 't2')
    const summary = spendingSummary(state, '2026-10')
    expect(summary.unplanned.map((t) => t.amount)).toEqual([350])
    expect(summary.unplannedTotal).toBe(350)
    expect(summary.spent).toBe(350)
    expect(summary.budget).toBeCloseTo(3374, 2)
    // Le second passage au garage reste à ranger : un imprévu est un cas d'espèce.
    expect(summary.unsorted.map((t) => t.amount)).toEqual([40])
    expect(state.rules).toEqual([])
    expect(sanitizeState({ ...state, transactions: state.transactions.map((t) => ({ ...t, updatedAt: '2026-10-01T00:00:00.000Z' })) }).transactions[0].unplanned).toBe(true)
  })
})

describe('dépense à épargner sur 2 ans', () => {
  it('se juge sur vingt-quatre mois : le paiement de l’année où elle tombe ne dépasse pas', () => {
    const base = seedState()
    const taxe = base.categories.find((c) => c.name === 'Taxe foncière')!.id
    // La taxe foncière passe à 960 € tous les 2 ans (40 € par mois), à partir d'octobre 2026.
    const version = base.budgets.find((v) => v.categoryId === taxe)!
    let state = { ...base, budgets: [...base.budgets.filter((v) => v.categoryId !== taxe), { ...version, amount: { kind: 'biennial' as const, value: 960 } }] }
    state = importStatement(state, [{ date: '2026-10-15', label: 'PRLV SEPA DGFIP IMPOT FONCIER', amount: 960 }], 't').state
    state = placeTransaction(state, state.transactions[0].id, { categoryId: taxe }, 't2')
    const line = spendingSummary(state, '2026-10').savings.sections.flatMap((s) => s.lines).find((l) => l.category.id === taxe)!
    expect(line.year).toEqual({ spent: 960, budget: 960, months: 24 })
    expect(line.over).toBe(false)
  })
})

describe('opérations d’une capture d’écran', () => {
  const capture = [
    { date: '2026-11-20', label: 'Amazon', amount: 16.97 },
    { date: '2026-11-19', label: 'Intermarché', amount: 190.76 },
  ]

  it('s’ajoutent provisoires, une seule fois', () => {
    const first = importStatement(seedState(), capture, 't', null, true)
    expect(first.added).toBe(2)
    expect(first.state.transactions.every((t) => t.provisional)).toBe(true)
    expect(importStatement(first.state, capture, 't2', null, true).added).toBe(0)
  })

  it('cèdent la place au relevé, qui garde leur rangement', () => {
    let state = importStatement(seedState(), capture, 't', null, true).state
    const amazon = state.transactions.find((t) => t.label === 'Amazon')!
    const category = state.categories[0].id
    state = placeTransaction(state, amazon.id, { categoryId: category }, 't')
    const statement = importStatement(
      state,
      [
        { date: '2026-11-18', label: 'CARTE 18/11/26 AMAZON PAYMENTS CB*1234', amount: 16.97 },
        { date: '2026-11-19', label: 'CARTE 19/11/26 INTERMARCHE CB*1234', amount: 190.76 },
        { date: '2026-11-21', label: 'CARTE 21/11/26 BOULANGERIE CB*1234', amount: 7 },
      ],
      't3',
    )
    expect(statement.confirmed).toBe(2)
    expect(statement.added).toBe(1)
    const transactions = statement.state.transactions
    expect(transactions.some((t) => t.provisional)).toBe(false)
    expect(transactions.find((t) => t.label.includes('AMAZON'))?.categoryId).toBe(category)
    expect(transactions.filter((t) => t.date >= '2026-11-18')).toHaveLength(3)
  })

  it('n’ajoutent pas ce que le relevé a déjà', () => {
    const state = importStatement(seedState(), [{ date: '2026-11-18', label: 'CARTE 18/11/26 AMAZON PAYMENTS CB*1234', amount: 16.97 }], 't').state
    const again = importStatement(state, capture, 't2', null, true)
    expect(again.duplicates).toBe(1)
    expect(again.added).toBe(1)
  })
})

describe('un relevé perso qui porte une dépense du foyer', () => {
  it('compte l’opération au foyer, et plus à ranger sur le compte perso', () => {
    const person = seedState().people[0].id
    let state = importStatement(seedState(), [{ date: '2026-11-04', label: 'CARTE 04/11/26 SUPERMARCHE CB*1234', amount: 41 }], 't', person).state
    const courses = state.categories.find((c) => c.name === 'Courses')!.id
    state = placeTransaction(state, state.transactions[0].id, { categoryId: courses }, 't2')
    expect(spendingSummary(state, '2026-11', person).unsorted).toHaveLength(0)
    expect(spendingSummary(state, '2026-11', person).elsewhere.map((t) => t.categoryId)).toEqual([courses])
    const line = spendingSummary(state, '2026-11').sections.flatMap((s) => s.lines).find((l) => l.category.id === courses)
    expect(line?.transactions.map((t) => t.owner)).toEqual([person])
    // Le marchand appris sur ce compte y range les suivantes, au foyer.
    state = importStatement(state, [{ date: '2026-11-12', label: 'CARTE 12/11/26 SUPERMARCHE CB*1234', amount: 23 }], 't3', person).state
    expect(state.transactions.at(-1)!.categoryId).toBe(courses)
  })
})

describe('une dépense à épargner périodique', () => {
  // Un trajet en Bretagne, 120 € par semestre : 240 € par an.
  function bretagne() {
    const group = seedState().groups.find((g) => g.save)!
    return addCategory(seedState(), { id: 'bzh', name: 'Bretagne', updatedAt: 't' }, { categoryId: 'bzh', from: '2026-01', groupId: group.id, splitKeyId: group.splitKeyId, amount: { kind: 'semiannual', value: 120 }, save: true, updatedAt: 't' })
  }
  const trip = (state: ReturnType<typeof bretagne>, date: string, amount: number) => {
    const next = importStatement(state, [{ date, label: `CARTE TRAIN ${date}`, amount }], 't').state
    return placeTransaction(next, next.transactions.at(-1)!.id, { categoryId: 'bzh' }, 't')
  }
  const line = (state: ReturnType<typeof bretagne>, month: string) => spendingSummary(state, month).savings.sections.flatMap((s) => s.lines).find((l) => l.category.id === 'bzh')!

  it('se juge sur l’année : deux trajets à 140 € et 120 € dépassent de 20 €', () => {
    const state = trip(trip(bretagne(), '2026-03-10', 140), '2026-09-10', 120)
    expect(line(state, '2026-09').year).toMatchObject({ months: 12, spent: 260, budget: 240 })
    expect(line(state, '2026-09').over).toBe(true)
  })

  it('un troisième trajet dans l’année dépasse', () => {
    const state = trip(trip(trip(bretagne(), '2026-02-10', 120), '2026-06-10', 120), '2026-10-10', 120)
    expect(line(state, '2026-10').over).toBe(true)
    expect(line(trip(trip(bretagne(), '2026-02-10', 120), '2026-06-10', 120), '2026-06').over).toBe(false)
  })
})
