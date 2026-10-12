import type { CategoryIcon } from './types'
import { normalize } from './search'

/** Une icône Nerd Font de la liste : son nom (« md-home ») et son point de code hexadécimal. */
export type NerdIcon = [name: string, code: string]

/**
 * Les icônes que Nerd Fonts n'a pas, dessinées par l'app : un tracé à la couleur du texte, comme un
 * glyphe, plein ou en trait. Leur nom commence par `app-` ; leur point de code (f0000, puis f1b00
 * et suivants, hors des plages de Nerd Fonts) ne sert qu'à garder la forme de toutes les icônes
 * enregistrées.
 */
export interface AppIcon {
  name: string
  code: string
  /** Le nom accessible, à la place du nom technique. */
  label: string
  /** Ce qu'on peut chercher pour la trouver, en minuscules sans accents. */
  keywords: string
  path: string
  /** La boîte du tracé : 24 × 24 par défaut ; plus large que haute pour un drapeau. */
  viewBox?: string
  /** Un tracé en trait, de cette épaisseur, plutôt que plein. */
  stroke?: number
}

export const APP_ICONS: AppIcon[] = [
  {
    // Le Gwenn-ha-du : neuf bandes (cinq noires), et un quartier d'hermines, ici cinq.
    name: 'app-gwenn_ha_du',
    code: 'f0000',
    label: 'Drapeau breton (Gwenn-ha-du)',
    keywords: 'drapeau flag bretagne breton bretonne breizh brittany gwenn ha du hermine ermine',
    viewBox: '0 2 24 20',
    path: 'M11 4.8H23V6.4H11ZM11 8H23V9.6H11ZM11 11.2H23V12.8H11ZM1 14.4H23V16H1ZM1 17.6H23V19.2H1ZM2.90 6.01 3.26 7.24 3.96 8.47 3.24 8.14 2.90 8.81 2.56 8.14 1.84 8.47 2.54 7.24ZM2.43 5.34a0.47 0.47 0 1 0 0.94 0a0.47 0.47 0 1 0 -0.94 0ZM1.74 5.90a0.40 0.40 0 1 0 0.81 0a0.40 0.40 0 1 0 -0.81 0ZM3.26 5.90a0.40 0.40 0 1 0 0.81 0a0.40 0.40 0 1 0 -0.81 0ZM6.00 6.01 6.36 7.24 7.06 8.47 6.34 8.14 6.00 8.81 5.66 8.14 4.94 8.47 5.64 7.24ZM5.53 5.34a0.47 0.47 0 1 0 0.94 0a0.47 0.47 0 1 0 -0.94 0ZM4.84 5.90a0.40 0.40 0 1 0 0.81 0a0.40 0.40 0 1 0 -0.81 0ZM6.36 5.90a0.40 0.40 0 1 0 0.81 0a0.40 0.40 0 1 0 -0.81 0ZM9.10 6.01 9.46 7.24 10.16 8.47 9.44 8.14 9.10 8.81 8.76 8.14 8.04 8.47 8.74 7.24ZM8.63 5.34a0.47 0.47 0 1 0 0.94 0a0.47 0.47 0 1 0 -0.94 0ZM7.94 5.90a0.40 0.40 0 1 0 0.81 0a0.40 0.40 0 1 0 -0.81 0ZM9.46 5.90a0.40 0.40 0 1 0 0.81 0a0.40 0.40 0 1 0 -0.81 0ZM4.45 9.71 4.81 10.94 5.51 12.17 4.79 11.84 4.45 12.51 4.11 11.84 3.39 12.17 4.09 10.94ZM3.98 9.04a0.47 0.47 0 1 0 0.94 0a0.47 0.47 0 1 0 -0.94 0ZM3.29 9.60a0.40 0.40 0 1 0 0.81 0a0.40 0.40 0 1 0 -0.81 0ZM4.81 9.60a0.40 0.40 0 1 0 0.81 0a0.40 0.40 0 1 0 -0.81 0ZM7.55 9.71 7.91 10.94 8.61 12.17 7.89 11.84 7.55 12.51 7.21 11.84 6.49 12.17 7.19 10.94ZM7.08 9.04a0.47 0.47 0 1 0 0.94 0a0.47 0.47 0 1 0 -0.94 0ZM6.39 9.60a0.40 0.40 0 1 0 0.81 0a0.40 0.40 0 1 0 -0.81 0ZM7.91 9.60a0.40 0.40 0 1 0 0.81 0a0.40 0.40 0 1 0 -0.81 0Z',
  },
  {
    // Le triskel : trois spirales nées du même centre, à un tiers de tour l'une de l'autre.
    name: 'app-triskel',
    code: 'f1b00',
    label: 'Triskel',
    keywords: 'triskel triskele triskelion bretagne breton bretonne breizh celte celtique celtic spirale spiral',
    stroke: 2.2,
    path: 'M11.63 13.16 10.45 12.88 9.38 12.38 8.46 11.69 7.72 10.87 7.16 9.94 6.82 8.95 6.68 7.94 6.74 6.96 6.99 6.03 7.40 5.20 7.95 4.50 8.61 3.93 9.34 3.52 10.11 3.28 10.88 3.19 11.63 3.26 12.32 3.47 12.94 3.80 13.45 4.23 13.86 4.73 14.14 5.28 14.30 5.85 14.34 6.42 14.27 6.95 14.10 7.45 13.85 7.87 13.53 8.23 13.17 8.49 12.78 8.67 12.38 8.76 11.99 8.77 11.63 8.71 11.31 8.58 11.03 8.40 10.81 8.18 10.65 7.93 10.55 7.67 10.51 7.42 10.51 7.18 10.56 6.95 10.65 6.76 10.77 6.60 10.90 6.47 11.05 6.37 11.20 6.31 11.35 6.27 11.49 6.26 11.63 6.26M11.63 13.16 11.97 14.33 12.07 15.50 11.94 16.64 11.60 17.70 11.07 18.65 10.38 19.44 9.58 20.07 8.70 20.50 7.77 20.75 6.85 20.81 5.96 20.69 5.15 20.40 4.43 19.97 3.83 19.43 3.37 18.80 3.05 18.12 2.89 17.41 2.86 16.72 2.98 16.06 3.21 15.45 3.54 14.93 3.96 14.51 4.43 14.19 4.93 13.98 5.44 13.88 5.94 13.89 6.40 13.99 6.81 14.17 7.17 14.42 7.44 14.72 7.65 15.05 7.77 15.39 7.82 15.74 7.80 16.07 7.72 16.37 7.58 16.63 7.41 16.84 7.22 17.01 7.00 17.13 6.78 17.19 6.57 17.21 6.37 17.20 6.19 17.14 6.04 17.06 5.91 16.97 5.80 16.85 5.72 16.74 5.65 16.61M11.63 13.16 12.47 12.29 13.44 11.61 14.49 11.16 15.58 10.92 16.66 10.91 17.69 11.11 18.63 11.49 19.45 12.04 20.13 12.71 20.64 13.48 20.98 14.31 21.14 15.16 21.13 16.00 20.95 16.79 20.64 17.50 20.21 18.12 19.68 18.61 19.09 18.98 18.46 19.21 17.82 19.31 17.21 19.28 16.63 19.14 16.12 18.89 15.69 18.56 15.35 18.17 15.10 17.73 14.96 17.28 14.91 16.83 14.95 16.41 15.07 16.01 15.25 15.67 15.49 15.39 15.76 15.18 16.06 15.03 16.36 14.95 16.65 14.94 16.92 14.98 17.17 15.07 17.37 15.19 17.54 15.35 17.67 15.52 17.75 15.70 17.79 15.88 17.80 16.06 17.78 16.22 17.74 16.37 17.68 16.50 17.61 16.62',
  },
]

const appIcon = (name: string) => APP_ICONS.find((icon) => icon.name === name)

/** L'icône dessinée par l'app sous ce nom ; `undefined` pour une icône Nerd Font. */
export const appIconOf = (icon: CategoryIcon): AppIcon | undefined => appIcon(icon.name)

/** Le nom accessible d'une icône : son libellé si l'app la dessine, son nom sinon. */
export const iconLabel = (name: string): string => appIcon(name)?.label ?? name

/** Les icônes de l'app, à joindre à la liste de Nerd Fonts. */
export const APP_ICON_LIST: NerdIcon[] = APP_ICONS.map((icon) => [icon.name, icon.code])

/** Le caractère d'une icône, dans la police Symbols Nerd Font que le design system sert. */
export function glyph(icon: CategoryIcon): string {
  return String.fromCodePoint(parseInt(icon.code, 16))
}

/** Ce qu'on propose avant toute recherche : les icônes de l'app, puis celles d'un budget de ménage. */
export const SUGGESTED = [
  ...APP_ICONS.map((icon) => icon.name),
  ...[
  'home', 'home_city', 'bank', 'cash', 'credit_card', 'piggy_bank', 'receipt', 'shield_home', 'shield_check',
  'flash', 'water', 'fire', 'radiator', 'wifi', 'cellphone', 'television', 'cart', 'basket', 'food',
  'silverware_fork_knife', 'bread_slice', 'pizza', 'coffee', 'glass_wine', 'car', 'gas_station', 'parking',
  'scooter', 'motorbike', 'bicycle', 'bus', 'train', 'airplane', 'beach', 'island', 'bag_suitcase',
  'hospital_box', 'medical_bag', 'pill', 'stethoscope', 'tooth', 'glasses', 'baby_carriage', 'school', 'paw',
  'dog', 'cat', 'dumbbell', 'run', 'music', 'movie_open', 'ticket', 'gamepad_variant', 'book_open_variant',
  'gift', 'tshirt_crew', 'hanger', 'content_cut', 'hammer_wrench', 'tools', 'sofa', 'washing_machine', 'fridge',
  'broom', 'flower', 'tree', 'trash_can', 'lightbulb', 'calendar_month', 'refresh', 'heart', 'account_group',
  'umbrella', 'lock',
  ].map((name) => `md-${name}`),
]

/** Quelques mots du budget, en français, vers les mots anglais des noms d'icônes. */
const SYNONYMS: Record<string, string[]> = {
  maison: ['home', 'house'], logement: ['home', 'house'], loyer: ['home', 'key'], pret: ['bank', 'cash'], banque: ['bank'],
  credit: ['credit', 'bank'], argent: ['cash', 'currency', 'wallet'], epargne: ['piggy'], impot: ['bank', 'receipt', 'cash'],
  taxe: ['receipt', 'bank'], facture: ['receipt', 'invoice'], abonnement: ['calendar', 'refresh'], assurance: ['shield'],
  electricite: ['flash', 'lightning', 'power'], lumiere: ['lightbulb'], eau: ['water'], gaz: ['fire', 'gas'],
  chauffage: ['radiator', 'fire', 'heat'], internet: ['wifi', 'web', 'router'], telephone: ['phone', 'cellphone'],
  tele: ['television'], television: ['television'], courses: ['cart', 'basket'], nourriture: ['food'], repas: ['food', 'silverware'],
  restaurant: ['silverware', 'food'], pain: ['bread'], cafe: ['coffee'], vin: ['wine', 'glass'], voiture: ['car'],
  auto: ['car'], essence: ['gas'], carburant: ['gas', 'fuel'], parking: ['parking'], moto: ['motorbike'], velo: ['bicycle', 'bike'],
  scooter: ['scooter'], train: ['train'], bus: ['bus'], avion: ['airplane'], vacances: ['beach', 'airplane', 'island', 'palm'],
  voyage: ['airplane', 'suitcase', 'map'], sante: ['medical', 'hospital', 'heart'], medecin: ['doctor', 'stethoscope'],
  pharmacie: ['pill', 'pharmacy'], dentiste: ['tooth'], lunettes: ['glasses'], enfant: ['baby', 'child', 'human_child'],
  bebe: ['baby'], ecole: ['school'], animal: ['paw'], chien: ['dog'], chat: ['cat'], sport: ['dumbbell', 'run', 'soccer'],
  musique: ['music'], film: ['movie'], cinema: ['movie', 'ticket'], jeu: ['gamepad', 'dice'], livre: ['book'], cadeau: ['gift'],
  vetement: ['tshirt', 'hanger'], coiffeur: ['content_cut', 'hair'], travaux: ['hammer', 'tools'], bricolage: ['hammer', 'tools'],
  drapeau: ['flag'], jardin: ['flower', 'tree', 'sprout'], meuble: ['sofa'], linge: ['washing'], menage: ['broom'], poubelle: ['trash'],
}

/**
 * Les icônes dont le nom contient chaque mot cherché — en anglais, ou en français pour les mots du
 * budget (« maison », « voiture »…). Celles de l'app d'abord (cherchées aussi dans leurs mots-clés),
 * puis celles de Material Design (md-), puis les autres.
 */
export function searchIcons(icons: NerdIcon[], query: string, limit = 150): NerdIcon[] {
  const words = normalize(query).split(/[\s,]+/).filter(Boolean)
  if (words.length === 0) {
    const byName = new Map(icons)
    return SUGGESTED.filter((name) => byName.has(name)).map((name) => [name, byName.get(name) as string])
  }
  const alternatives = words.map((word) => [word, ...(SYNONYMS[word] ?? [])])
  const found: NerdIcon[] = []
  for (const icon of icons) {
    const name = icon[0]
    const text = `${name} ${appIcon(name)?.keywords ?? ''}`
    if (alternatives.every((options) => options.some((option) => text.includes(option)))) found.push(icon)
  }
  const rank = (name: string) => (name.startsWith('app-') ? 0 : name.startsWith('md-') ? 1 : 2)
  return found.sort((x, y) => rank(x[0]) - rank(y[0])).slice(0, limit)
}
