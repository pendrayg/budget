/**
 * Génère src/lib/school-holidays.json : les vacances scolaires de la France métropolitaine, zone
 * par zone, en périodes [premier jour, dernier jour] (dates ISO, bornes comprises).
 *
 * Source : le fichier `data.csv` du paquet Python `vacances-scolaires-france` (Antoine Augusti,
 * licence MIT), tiré du calendrier officiel de l'Éducation nationale — un jour par ligne, et pour
 * chaque zone s'il est en vacances. Le paquet se met à jour à chaque calendrier publié : pour
 * prolonger celui de l'app, télécharger sa dernière roue (pypi.org/project/vacances-scolaires-france),
 * en extraire `vacances_scolaires_france/data/data.csv`, puis :
 *
 *   node scripts/school-holidays.mjs chemin/vers/data.csv 0.12.0
 *
 * `until` est le dernier jour des dernières grandes vacances connues : au-delà, le calendrier n'est
 * pas publié, et l'app le dit au lieu de compter des jours d'école qu'elle ne connaît pas.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [, , file, version = '?'] = process.argv
if (!file) {
  console.error('Usage : node scripts/school-holidays.mjs data.csv [version du paquet]')
  process.exit(1)
}

/** Depuis la rentrée 2015 : assez loin pour l'historique d'un budget, sans traîner trente ans. */
const SINCE = '2015-09-01'

const [header, ...lines] = readFileSync(file, 'utf8').trim().split('\n')
const columns = header.split(',')
const at = (name) => columns.indexOf(name)
const zones = { A: [], B: [], C: [] }
let until = ''
const open = { A: null, B: null, C: null }
for (const line of lines) {
  const cells = line.split(',')
  const date = cells[at('date')]
  if (date < SINCE) continue
  if (cells[at('nom_vacances')] === "Vacances d'été") until = date
  for (const zone of Object.keys(zones)) {
    const on = cells[at(`vacances_zone_${zone.toLowerCase()}`)] === 'True'
    if (on && !open[zone]) open[zone] = [date, date]
    else if (on) open[zone][1] = date
    else if (open[zone]) {
      zones[zone].push(open[zone])
      open[zone] = null
    }
  }
}
for (const zone of Object.keys(zones)) if (open[zone]) zones[zone].push(open[zone])

const out = { source: `vacances-scolaires-france ${version} (MIT, Antoine Augusti), calendrier de l'Éducation nationale`, until, zones }
writeFileSync(new URL('../src/lib/school-holidays.json', import.meta.url), `${JSON.stringify(out)}\n`)
console.log(`${Object.values(zones).reduce((n, z) => n + z.length, 0)} périodes, connues jusqu'au ${until}`)
