import { describe, expect, it } from 'vitest'
import { seedState } from './fixtures'
import { defaultState, exportPayload, parseEnvelope, parseImport, sanitizeState } from './state'

describe('sanitizeState', () => {
  it('rend l’état par défaut pour ce qui n’est pas un objet', () => {
    const strip = (state: ReturnType<typeof defaultState>) => ({
      ...state,
      people: state.people.map((p) => ({ ...p, updatedAt: '' })),
      splitKeys: state.splitKeys.map((k) => (k.kind === 'fixed' ? { ...k, updatedAt: '' } : k)),
      groups: state.groups.map((g) => ({ ...g, updatedAt: '' })),
    })
    expect(strip(sanitizeState(undefined))).toEqual(strip(defaultState()))
    expect(strip(sanitizeState('x'))).toEqual(strip(defaultState()))
  })

  it('ne garde que la clé prorata pour un objet sans clés', () => {
    const clean = sanitizeState({ schema: 1 })
    expect(clean.splitKeys).toEqual([{ id: 'prorata', kind: 'prorata' }])
    expect(clean.people.map((p) => p.name)).toEqual(['Personne 1', 'Personne 2'])
  })

  it('garde une graine valide telle quelle', () => {
    const seed = seedState()
    expect(sanitizeState(seed)).toEqual(seed)
    expect(seed.categories).toHaveLength(22)
    expect(seed.incomes).toHaveLength(24)
  })

  it('écarte ce qui est douteux sans planter', () => {
    const seed = seedState() as unknown as Record<string, unknown>
    const dirty = {
      ...seed,
      incomes: [...(seed.incomes as unknown[]), { month: '2026-1', personId: 'p1', components: [] }, { month: '2026-01', personId: 'p9', components: [] }, 'x'],
      budgets: [...(seed.budgets as unknown[]), { categoryId: 'inconnue', from: '2026-01', amount: { kind: 'monthly', value: 1 } }, { categoryId: 'c01', from: '2026-01', amount: { kind: 'bizarre' } }],
      splitKeys: [...(seed.splitKeys as unknown[]), { id: 'k2', kind: 'fixed', name: 'faux', shares: [{ from: '2026-01', byPerson: { p1: 0.5, p2: 0.7 } }] }],
      settings: { prorataWindowMonths: 999 },
    }
    const clean = sanitizeState(dirty)
    expect(clean.incomes).toHaveLength(24)
    expect(clean.budgets).toHaveLength(22)
    expect(clean.splitKeys.map((k) => k.id)).toEqual(['prorata', 'k-40-60'])
    expect(clean.settings.prorataWindowMonths).toBe(60)
  })

  it('ramène une version sur une clé disparue au prorata, et retire une catégorie sans version', () => {
    const seed = seedState()
    const clean = sanitizeState({ ...seed, splitKeys: [], categories: [...seed.categories, { id: 'vide', name: 'Vide', updatedAt: 't' }] })
    expect(clean.budgets.every((v) => v.splitKeyId === 'prorata')).toBe(true)
    expect(clean.categories.some((c) => c.id === 'vide')).toBe(false)
  })
})

describe('import / export', () => {
  it('relit son propre export et la graine', () => {
    const seed = seedState()
    expect(parseImport(exportPayload(seed))).toEqual(seed)
  })

  it('refuse un fichier étranger', () => {
    expect(() => parseImport('{"operations":[]}')).toThrow(/Format non reconnu/)
  })

  it('lit une enveloppe du Worker', () => {
    expect(parseEnvelope({ version: 3, savedAt: '2026-01-01T00:00:00Z', state: seedState() })?.version).toBe(3)
    expect(parseEnvelope({ state: {} })).toBeNull()
  })
})

describe('icône d’une catégorie', () => {
  it('garde une icône valable et écarte une icône douteuse', () => {
    const seed = seedState()
    const [first, second] = seed.categories
    const clean = sanitizeState({
      ...seed,
      categories: [{ ...first, icon: { name: 'md-home', code: 'F02DC' } }, { ...second, icon: { name: 'x', code: '<script>' } }, ...seed.categories.slice(2)],
    })
    expect(clean.categories[0].icon).toEqual({ name: 'md-home', code: 'f02dc' })
    expect(clean.categories[1].icon).toBeUndefined()
  })
})


describe('périodicités', () => {
  it('ramène au mois une ancienne version « 4 mois », sous ses deux noms', () => {
    const seed = seedState()
    const [first, second] = seed.budgets
    const clean = sanitizeState({
      ...seed,
      budgets: [{ ...first, amount: { kind: 'months4', value: 3000 } }, { ...second, amount: { kind: 'weekly4', value: 1000 } }, ...seed.budgets.slice(2)],
    })
    expect(clean.budgets[0].amount).toEqual({ kind: 'monthly', value: 750 })
    expect(clean.budgets[1].amount).toEqual({ kind: 'monthly', value: 250 })
  })

  it('garde la périodicité d’un item, et la tait quand elle est mensuelle ou inconnue', () => {
    const seed = seedState()
    const [version] = seed.budgets
    const items = [
      { label: 'Prime', amount: 70, period: 'annual' },
      { label: 'Abonnement', amount: 10, period: 'monthly' },
      { label: 'Douteux', amount: 5, period: 'hebdo' },
      { label: 'Ancien', amount: 400, period: 'months4' },
    ]
    const clean = sanitizeState({ ...seed, budgets: [{ ...version, amount: { kind: 'items', items } }, ...seed.budgets.slice(1)] })
    expect(clean.budgets[0].amount).toEqual({
      kind: 'items',
      items: [
        { label: 'Prime', amount: 70, period: 'annual' },
        { label: 'Abonnement', amount: 10 },
        { label: 'Douteux', amount: 5 },
        { label: 'Ancien', amount: 100 },
      ],
    })
  })
})

describe('couleur des personnes', () => {
  it('garde une couleur connue, écarte une couleur inconnue', () => {
    const seed = seedState()
    const [a, b] = seed.people
    const clean = sanitizeState({ ...seed, people: [{ ...a, color: 'violet' }, { ...b, color: '#ff00ff' }] })
    expect(clean.people[0].color).toBe('violet')
    expect(clean.people[1].color).toBeUndefined()
  })

  it('laisse deux personnes choisir des couleurs proches, ou la même', () => {
    const seed = seedState()
    const [a, b] = seed.people
    const clean = sanitizeState({ ...seed, people: [{ ...a, color: 'orange' }, { ...b, color: 'orange' }] })
    expect(clean.people.map((p) => p.color)).toEqual(['orange', 'orange'])
  })
})

describe('catégories', () => {
  it('range un document d’avant les catégories dans les trois de l’écran, sous des identifiants fixes', () => {
    const seed = seedState()
    // Le document tel qu'une app d'avant les catégories l'écrit : ni `groups`, ni `groupId`.
    const legacy = { ...seed, groups: undefined, budgets: seed.budgets.map(({ groupId: _g, ...rest }) => rest) }
    const clean = sanitizeState(legacy)
    expect(clean.groups.map((g) => [g.id, g.name, g.save])).toEqual([
      ['g-k-40-60', 'Ratio', false],
      ['g-prorata-save', 'Prorata épargné', true],
      ['g-prorata-monthly', 'Prorata mensuel', false],
    ])
    expect(clean.budgets.find((v) => v.categoryId === 'c01')?.groupId).toBe('g-k-40-60')
    // Relu ailleurs, il donne la même chose.
    expect(sanitizeState(legacy)).toEqual(clean)
  })

  it('range une version écrite par une app d’avant les catégories dans la catégorie de sa clé', () => {
    const seed = seedState()
    const { groupId: _g, ...legacy } = { ...seed.budgets[0], categoryId: seed.budgets[0].categoryId, from: '2027-01', splitKeyId: 'prorata', save: true }
    const clean = sanitizeState({ ...seed, budgets: [...seed.budgets, legacy] })
    expect(clean.budgets.find((v) => v.from === '2027-01')?.groupId).toBe('g-prorata-save')
    expect(clean.groups).toHaveLength(3)
  })

  it('recopie dans chaque version la répartition et l’épargne de sa catégorie', () => {
    const seed = seedState()
    const clean = sanitizeState({ ...seed, groups: seed.groups.map((g) => (g.id === 'g-prorata-monthly' ? { ...g, save: true } : g)) })
    expect(clean.budgets.filter((v) => v.groupId === 'g-prorata-monthly').every((v) => v.save && v.splitKeyId === 'prorata')).toBe(true)
  })

  it('part de trois catégories vides, et garde une liste vidée', () => {
    expect(sanitizeState({ schema: 1, splitKeys: [{ id: 'k-50-50', kind: 'fixed', name: '50 / 50', shares: [{ from: '2000-01', byPerson: { p1: 0.5, p2: 0.5 } }] }] }).groups.map((g) => g.name)).toEqual([
      'Ratio',
      'Prorata épargné',
      'Prorata mensuel',
    ])
    expect(sanitizeState({ schema: 1, groups: [] }).groups).toEqual([])
  })
})

describe('budget semestriel', () => {
  it('garde une périodicité semestrielle, en tout ou pour un item', () => {
    const seed = seedState()
    const [first, second] = seed.budgets
    const clean = sanitizeState({
      ...seed,
      budgets: [{ ...first, amount: { kind: 'semiannual', value: 600 } }, { ...second, amount: { kind: 'items', items: [{ label: 'Chaudière', amount: 90, period: 'semiannual' }] } }, ...seed.budgets.slice(2)],
    })
    expect(clean.budgets[0].amount).toEqual({ kind: 'semiannual', value: 600 })
    expect(clean.budgets[1].amount).toEqual({ kind: 'items', items: [{ label: 'Chaudière', amount: 90, period: 'semiannual' }] })
  })
})

describe('budget sur 2 ans', () => {
  it('garde une périodicité sur 2 ans, en tout ou pour un item', () => {
    const seed = seedState()
    const [first, second] = seed.budgets
    const clean = sanitizeState({
      ...seed,
      budgets: [{ ...first, amount: { kind: 'biennial', value: 960 } }, { ...second, amount: { kind: 'items', items: [{ label: 'CT', amount: 96, period: 'biennial' }] } }, ...seed.budgets.slice(2)],
    })
    expect(clean.budgets[0].amount).toEqual({ kind: 'biennial', value: 960 })
    expect(clean.budgets[1].amount).toEqual({ kind: 'items', items: [{ label: 'CT', amount: 96, period: 'biennial' }] })
  })
})

describe('de une à quatre personnes', () => {
  const T = '2026-10-12T08:00:00.000Z'
  const person = (id: string, name: string) => ({ id, name, updatedAt: T })

  it('accepte une seule personne, et lui donne tout', () => {
    const seed = seedState()
    const clean = sanitizeState({ ...seed, people: [person('p1', 'Alice')] })
    expect(clean.people).toHaveLength(1)
    expect(clean.groups.every((g) => g.owner === 'p1')).toBe(true)
    expect(clean.incomes.some((i) => i.personId === 'p2')).toBe(false)
  })

  it('accepte trois personnes et complète les clés fixes à 0 pour la nouvelle', () => {
    const seed = seedState()
    const clean = sanitizeState({ ...seed, people: [...seed.people, person('p3', 'Paul')] })
    expect(clean.people.map((p) => p.name)).toEqual(['Alice', 'Bruno', 'Paul'])
    const key = clean.splitKeys.find((k) => k.kind === 'fixed')!
    expect(key.shares[0].byPerson).toEqual({ p1: 0.4, p2: 0.6, p3: 0 })
  })

  it('ramène à 1 les parts d’une clé dont une personne a disparu', () => {
    const seed = seedState()
    const key = seed.splitKeys.find((k) => k.kind === 'fixed')!
    const clean = sanitizeState({ ...seed, people: [seed.people[0], person('p3', 'Paul')], splitKeys: [seed.splitKeys[0], { ...key, shares: [{ from: '2000-01', byPerson: { p1: 0.3, p2: 0.7 } }] }] })
    expect(clean.splitKeys.find((k) => k.kind === 'fixed')!.shares[0].byPerson).toEqual({ p1: 1, p3: 0 })
  })

  it('retombe sur les deux de départ sans personne, à cinq, ou avec deux identifiants pareils', () => {
    const seed = seedState()
    for (const people of [[], Array.from({ length: 5 }, (_, i) => person(`q${i}`, 'X')), [person('a', 'A'), person('a', 'B')]]) {
      expect(sanitizeState({ ...seed, people }).people.map((p) => p.name)).toEqual(['Personne 1', 'Personne 2'])
    }
  })
})
