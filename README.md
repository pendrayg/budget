# Budget

Le budget d'un foyer — seul, en couple, jusqu'à quatre —, sorti de son classeur Excel : les revenus de chacun mois par mois, le
prorata qui en découle, les dépenses par catégorie et la part de chacun, une calculatrice de
répartition, et les projets ponctuels. Une web app pour Safari sur iPhone, ajoutée à l'écran
d'accueil, bâtie sur le design system néomorphique partagé
(`@pendrayg/neomorphism-design-system`) et déployée sur Cloudflare Workers. Tous les
téléphones voient le même document, gardé dans un espace KV.

## Ce que fait l'application

### Le budget

La feuille `Mensuels` du classeur : **un seul budget**, celui en vigueur ce mois-ci — on ne
navigue pas de mois en mois. En tête, ce que chacun **verse sur le commun**, et sous chaque
montant sa part du total. Puis les **catégories**, par ordre alphabétique, chacune une section
dépliante — celles de départ : **Prorata épargné**, **Prorata mensuel** et **Ratio** (un prêt
immo à 40 / 60, par exemple), et toutes celles qu'on crée. Une catégorie dit **comment on partage** ses dépenses — au **prorata**
des revenus, ou à un **ratio** fixe qu'on lui donne (la part de chacun sauf le dernier, qui a le
reste) — et si elles sont **à épargner**. À deux, son intitulé tient en trois colonnes, comme la
synthèse : en haut le montant de chacun de part et d'autre du nom, dessous la répartition de
chacun (30 % / 70 %, ou le prorata) de part et d'autre du total de la catégorie ; à trois et
plus, le nom et le total, puis la part de chacun en dessous. Dépliée, elle
montre d'abord ses réglages (nom, ratio, épargne, suppression avec ses dépenses), puis ses
**dépenses** (Prêt immo, Courses…), chacune avec son seul mensuel, et le bouton **Ajouter une
dépense**.
« Ajouter une catégorie », en bas de l'écran, en crée une : nom, prorata ou ratio, épargne.

Entre les deux, sans titre ni ordonnée et à la largeur du contenu, une **courbe de l'évolution du
total** : un escalier, puisque le total ne bouge qu'aux modifications, avec un point à chaque
changement et, au toucher, le budget du mois, les revenus et la variation. Le total ne dépend que
des budgets, pas du prorata, qui ne fait que le répartir. En pointillé gris, face à lui, le **revenu du
foyer mois par mois** (tous les revenus ; un mois incomplet laisse un trou) : la courbe commence au
premier mois saisi, revenu ou budget, et avant le premier budget c'est ce premier budget qui
s'applique, comme le classeur appliquait le sien à toute l'année. L'échelle part de zéro : la
hauteur de la ligne dit le total, et un budget ajouté la fait monter vers les revenus. Pas de
légende : l'infobulle nomme les deux lignes.

Une dépense se saisit comme on la connaît : 540 € **par an**, 150 € **par trimestre**, 180 € **par semestre**,
960 € **tous les 2 ans** (÷ 24),
ou une **somme d’items** (Films + Musique). Chaque item a sa propre périodicité, choisie
par un bouton à plusieurs valeurs : chaque appui passe à la suivante (Mois → Trim. → Sem. → An → 2 ans). L'application ramène au mois ; le classeur
faisait la division dans la cellule.

### L'historique des changements

Modifier une dépense pose une **version** à partir du mois en cours : le montant, la
catégorie. Le budget d'avant ne bouge pas ; plusieurs modifications dans le même mois n'en font
qu'une, la dernière. La fiche de la dépense montre son historique, et la courbe du total en fait
la somme. Supprimer une dépense efface aussi son historique. Le ratio d'une catégorie se change
de la même façon, dans ses réglages, sans date à donner : un 30 / 70 renégocié en 40 / 60 vaut à
partir du mois en cours, les mois d'avant gardent le leur. Sa nature (prorata ou ratio) se
choisit à la création et ne change plus, ce serait réécrire le partage de tous ses mois.

### Les revenus et le prorata

La feuille `Salaire`. Chaque mois, le revenu de chacun en **composantes** — salaire,
allocations, autre —, comme la formule du classeur (`2050 + 45`), chaque terme
nommé si on veut. Le **prorata** est la part de chacun dans la somme des revenus moyens, sur
**un an glissant** : le budget d'un mois se répartit selon les revenus des **douze mois qui le
précèdent**, lui exclu — l'argent reçu paie l'argent dépensé. Le budget d'octobre 2026 repose
sur les revenus d'octobre 2025 à septembre 2026. Dans cette année, seuls les mois **complets**
(tous les revenus saisis) sont moyennés ; l'écran n'affiche pas lesquels, mais le message rouge
signale ceux qui manquent. Un revenu de plus d'un an
ne compte plus, même si rien n'a été saisi depuis. La durée se règle (douze mois par défaut).

Le prorata n'est jamais stocké : il se déduit des revenus. L'écran Revenus montre en tête le
prorata, les revenus moyens, le **taux d'effort** ((à verser au commun + budget personnel) / revenu moyen) et le **reste à vivre**
de chacun ; puis le **graphique des revenus saisis** : une ligne pleine par personne, à sa
couleur, et en pointillé de la même couleur son reste à vivre du mois — son revenu du mois moins
sa part à verser ; avant le premier budget saisi, c'est ce premier budget qui s'applique. Le
zéro y est marqué, et un reste à vivre **négatif** passe dessous, en rouge (dans l'infobulle
aussi). Pas de
légende à part : dans la synthèse, le revenu moyen de chacun est souligné d'un trait plein de sa
couleur, son reste à vivre d'un pointillé. La couleur de chacun se choisit dans Réglages →
Personnes, parmi les huit de la palette (bleu, orange, aqua, jaune, rose, vert, violet, rouge),
toutes ouvertes à chacun, même proches l'une de l'autre. Dessous,
chaque mois saisi : à deux, en trois colonnes comme la synthèse (le revenu de la première
personne, le mois, le revenu de la seconde) ; seul, le mois et son revenu ; à trois et plus, le
mois et le total du foyer, chacun en indice. À trois et plus, la synthèse aussi passe en lignes,
une par personne.

### Le rappel de saisie

Un mois échu sans revenus saisis est réclamé en tête de chaque écran, avec le bouton qui ouvre
la saisie du mois manquant le plus ancien. Sans aucune saisie, seul le mois dernier est réclamé.

Sur l'écran Budget, un **message rouge** dit en plus quand le prorata du mois affiché repose sur
une année incomplète : des mois de son année glissante n'ont pas leurs revenus (« le prorata de
décembre 2025 se calcule sur 3 mois au lieu de 12 »). Les montants affichés en dépendent ; un
bouton ouvre la saisie du premier mois manquant. Les mois à venir comptent aussi : le budget d'un
mois futur repose sur un prorata qui ne connaît pas encore leurs revenus. Le mois en cours, lui,
n'entre jamais dans son propre prorata.

### La calculatrice

La feuille `Calculatrice` : une somme, une clé (prorata ou parts fixes), la part de chacun. La
part de chacun en haut ; la clé et la somme en bas de l'écran, au-dessus de la barre de menu, à
portée de pouce — la somme au plus bas, juste au-dessus du clavier quand il s'ouvre.

### Les dépenses : l'état des lieux

Ce qu'on a **vraiment dépensé**, face au budget. En début de mois, « Importer un relevé » prend le
relevé PDF du compte commun (BoursoBank) : il est lu **dans le téléphone** (pdf.js, chargé au
premier import seulement), et seules ses opérations sont gardées — date, libellé, montant ;
jamais le PDF, ni le RIB. Les montants se lisent au débit ou au crédit d'après leur colonne.
Au-dessus, un graphique du **remplissage du budget** mois par mois : pour chaque mois, le budget
en piste claire et le dépensé qui la remplit jusqu'au budget ; au-delà, seul le **dépassement**
s'empile en rouge. Au toucher, le dépensé, le budget, le pourcentage rempli et le dépassement. Chaque mois est ensuite une ligne, comme les
revenus : son **écart au budget** (négatif en vert, surdépense en rouge), le nombre de dépenses en **dépassement**, le montant des **imprévus** et ce qui reste à ranger. Déplié, il montre d'abord les opérations **à ranger** — un appui ouvre la liste des
dépenses, chacune avec son icône (le sélecteur natif de l'iPhone ne montre que du texte), sous
une **recherche** active dès l'ouverture, clavier levé (accents ignorés ; Entrée prend la
première) —, puis
chaque **catégorie en bouton section** — seulement celles où il y a eu des opérations ce mois-ci, et dedans seulement ces dépenses-là : repliée, une ligne, son écart au budget (en vert
en deçà, en rouge au-delà, « = » pile dessus) et son nombre de dépenses en dépassement ; dépliée, ses dépenses, chacune un bouton section qui déplie ses opérations. Une
catégorie ouverte à la fois. Les imprévus, les catégories à épargner (jugées sur douze mois) et ce
qui n'est **pas une dépense** (versements sur le commun, virements internes ; un versement reçu
par virement l'est d'office) suivent le même modèle.

Ranger une opération dans une dépense **apprend son marchand** — le libellé sans la date
d'achat, la carte ni les numéros (« SUPERMARCHE DU PORT », « OPERATEUR MOBILE ») ; un virement garde sa
ligne de détail (« Prêt immobilier maison ») — : les autres opérations à ranger du même marchand
suivent aussitôt, et celles des relevés suivants se rangent seules. Deux prélèvements d'un même
marchand se distinguent par leur montant (l'assurance de la maison, celle de la voiture) ; un
paiement par carte, dont le montant change à chaque passage, ne s'apprend qu'au marchand.
**Corriger** un rangement réapprend le marchand : ses opérations que l'ancienne règle avait
rangées au même endroit suivent la correction, sauf celles qu'on y a rangées soi-même (l'autre
contrat d'un même assureur), et les relevés suivants vont au nouvel endroit.
Réimporter un relevé n'ajoute rien : une opération est reconnue à sa date, son montant, son
libellé et son rang parmi les identiques. Un relevé d'avant le premier budget saisi se compare à
ce premier budget. Un mois importé par erreur se supprime au bas de son dépli.

**Les dépenses annuelles** (taxe foncière, lotissement, assurances…) sont celles des catégories
**à épargner** : le budget les montre mensualisées ; le total d'une telle catégorie est ce qu'il
faut **mettre de côté chaque mois** (et la part de chacun), à virer sur le compte épargne. Dans un mois, le bloc
**Épargne** compare le virement du mois vers l'épargne — rangé en « Versement épargne », appris
comme le reste — à cette somme. Le paiement annuel, lui, sort du compte commun le mois où il tombe :
il ne compte **pas** dans le dépensé du mois (l'épargne le couvre), et se juge sur l'**année
glissante** — les paiements des douze derniers mois face à douze fois son mensuel (vingt-quatre
pour un budget sur 2 ans) ; seul un dépassement sur cette période passe en rouge. L'en-tête d'un mois compare donc le courant dépensé plus
le versé sur l'épargne au courant budgété plus le « à mettre de côté ».

Une dépense qui n'entre dans aucune dépense du budget se range en **« Imprévu hors catégorie »** :
elle compte dans le dépensé du mois, sans budget en face, dans son propre bloc. C'est un cas
d'espèce : contrairement aux autres rangements, il ne s'apprend pas, et la prochaine opération du
même marchand reste à ranger.

### Les personnes : de une à quatre

Réglages → Personnes : chacun son nom et sa couleur, **« Ajouter une personne »** (quatre au
plus) et, par personne, de quoi la **retirer**. Une personne qui arrive ne reçoit rien des
ratios fixes (0 %, à régler dans chaque catégorie) et n'a pas encore de revenus : tant qu'elle
n'en a pas, aucun mois n'est complet et le prorata retombe à parts égales. Retirer quelqu'un
**rapatrie** ses données : ses catégories, opérations et marchands appris vont au commun — ou,
s'il ne reste qu'une personne, à elle, avec tout le commun — ; ses revenus sont supprimés ; les
ratios se ramènent aux parts des autres.

**Seul**, il n'y a pas de commun : le budget est le sien, sans prorata ni ratio (les catégories
n'ont que « À épargner »), sans sous-menu, et sans calculatrice au menu. Le reste à vivre est
le revenu moyen moins ce budget.

### Les budgets et comptes personnels

Sur le budget et les dépenses, un sous-menu **Commun / Alice / Bruno** (une pastille par
personne, sur deux lignes à partir de trois), en bas au-dessus du menu, choisit le budget :
le commun, ou celui de l'une des personnes. Le choix vaut pour les deux écrans, et ce
téléphone le retient. Un budget personnel a ses propres catégories et dépenses, que sa personne
paie seule : pas de répartition (ni prorata, ni ratio), seulement « À épargner ». Sa synthèse
dit son total, la part du revenu qu'il prend, et le **reste à vivre** une fois versée sa part du
commun et payé son budget. Son graphique le suit face à son seul revenu. Le budget commun et ses
parts n'en tiennent pas compte ; le **reste à vivre** de l'écran Revenus, si : synthèse et courbe
retirent du revenu la part du commun ET le budget personnel (avant le premier budget personnel,
c'est lui qui vaut, comme pour le commun).

Aux dépenses, le relevé s'**importe dans le compte choisi** : ses opérations sont à cette
personne, sans avoir à le dire pour chacune, et se rangent dans les dépenses de son budget.
Chaque compte apprend ses propres marchands, et un même relevé importé dans deux comptes y fait
deux jeux d'opérations distincts.

### Les projets

La feuille `Projets` : des achats ponctuels en lignes, avec leur total. Rien à répartir.

Un projet peut avoir une **date cible** et s'**épargner dans le budget** : on choisit une
catégorie à épargner (du commun ou d'un budget perso), où il devient une dépense comme une autre,
avec la répartition de sa catégorie. Sa mensualité est le reste à épargner divisé par les mois
jusqu'à la cible (le mois en cours compris) ; elle se recalcule à chaque modification du projet,
à partir du mois en cours, et s'arrête après la cible. On peut arrêter puis reprendre ; supprimer
un projet épargné arrête sa dépense, dont l'histoire reste au budget. Sa ligne montre sa
**complétion** : l'épargne réellement versée — chaque mois importé, sa mensualité au prorata du
« Versement épargne » de ce mois face au « à épargner » (plafonné à 100 %) ; un mois non importé
ne compte pas. Payé après sa cible, l'achat se juge sur sa dernière mensualité, pas en dépassement
(`src/lib/projects.ts`).

## Interface

- **Le design system** vient du paquet partagé avec Investment, Follow et weather-ahead : jetons,
  deux thèmes (sombre par défaut, clair si l'appareil le règle), règle de relief, boutons,
  champs, sélecteurs, sections dépliantes, barre de menu, écrans qui glissent. Les sections du
  budget sont des sections dépliantes ordinaires : elles ne s'enfoncent pas.
- **Chaque ligne est un bouton section dépliante** (`DisclosureButton`) : une catégorie, un mois
  de revenus, un projet, un groupe de réglages. L'en-tête dit la ligne (nom et montant ; pour un
  mois, le revenu de chacun) ; un appui l'enfonce et déplie son
  formulaire dedans — ce qu'ouvrait autrefois la roue dentée de la ligne. Une seule ligne ouverte
  à la fois par écran ; supprimer la replie.
- **Pas de bouton Enregistrer** : une catégorie, un mois de revenus ou un projet s'enregistre au
  fil de la saisie, dès que ce qui est saisi est valable (une catégorie a un nom et un montant).
  L'en-tête de la ligne suit aussitôt. Seule la création attend « Créer », pour qu'une catégorie ou
  un projet ne naisse pas à la première lettre tapée.
- **Six destinations** dans la barre de menu : Budget, Revenus, Dépenses, Calcul, Projets, Réglages. Ce
  qui n'a pas encore de ligne — une nouvelle catégorie, un mois à saisir, un nouveau projet —
  s'ouvre en feuille (`<dialog>` natif), pas en destination.
- **Pas de zones** : comme Investment, les sections sont des blocs nus séparés par le blanc, le
  contenu va d'un bord à l'autre.
- **Supprimer se fait en deux appuis**, avec le bouton de suppression du DS (`DeleteButton`) :
  une ligne d'un montant ou d'un revenu, une version de l'historique, une dépense, une catégorie
  ou un projet (au bas de sa fiche, avec son libellé) et « Tout effacer » (avec son libellé). Le premier appui arme la poubelle, qui passe au rouge ; le second
  supprime. Pas de boîte de confirmation.
- **Un sous-menu, c'est `FlatSelector`** : la périodicité d'un montant, la personne dont on
  saisit le revenu, la clé de la calculatrice.
- **Une icône par catégorie**, devant son nom dans la ligne : n'importe laquelle des 10 764
  icônes de Nerd Fonts (la police Symbols Nerd Font que sert le design system). Le sélecteur
  cherche en anglais, ou en français pour les mots du budget (« maison », « voiture »,
  « électricité »…), et propose sans recherche une sélection d'icônes de ménage. La liste des
  icônes (`src/lib/nerd-icons.json`, générée par `scripts/nerd-icons.mjs` depuis `glyphnames.json`
  de Nerd Fonts v3.4.0) n'est chargée qu'à la première ouverture du sélecteur. Ce que Nerd Fonts
  n'a pas, l'app le dessine (`APP_ICONS` dans `src/lib/icons.ts`, un tracé à la couleur du texte) :
  le drapeau breton et le triskel, en tête des suggestions, trouvés par « bretagne », « breizh »,
  « drapeau », « triskel », « celtique »…
- **Les formulaires tiennent sur un téléphone** : la fiche d'une dépense montre le nom, l'icône, le
  montant et la catégorie, puis la note et l'historique, et la suppression ; les réglages d'une
  catégorie, le nom, la répartition et l'épargne — un choix de la sélection du DS, le bloc qui
  s'enfonce avec son bouton à bascule. La saisie des revenus montre une personne à la fois.
- **L'icône** : quatre coins de viseur gris, nets, qui cadrent un euro géométrique au bleu de
  l'app — l'argent tenu dans ses limites, sobrement. Safari ne prend pas de SVG pour l'écran d'accueil : `apple-touch-icon.png`
  (180 px, carré plein, iOS arrondit lui-même). Une icône déjà sur l'écran d'accueil ne change
  qu'en supprimant puis en rajoutant l'app.
- Dessiné et vérifié à 440 × 956 (iPhone 17 Pro), dans les deux thèmes.

## Données et synchronisation

Un seul document JSON — l'état entier — gardé par le Worker dans un espace KV sous une clé. Le
front en garde un **miroir local** (`localStorage`) pour s'ouvrir tout de suite et marcher hors
ligne ; le serveur fait foi.

- À l'ouverture et au retour au premier plan, le téléphone lit le serveur. Plus récent, il
  l'adopte — fusionné avec ses propres changements non envoyés, s'il en a.
- Une modification part après une demi-seconde de calme (`PUT /api/state` avec la version
  attendue). Le Worker refuse une version périmée (409) et rend le document courant : le
  téléphone **fusionne par entité** (le plus récent gagne, revenu par revenu, version par
  version) et renvoie. Deux téléphones ne s'écrasent pas.
- KV est à cohérence finale : après une écriture, le téléphone relit deux secondes plus tard
  pour vérifier que c'est bien sa version. Les versions remplacées sont gardées trente jours
  (`state:prev:<n>`, `GET /api/versions`) en filet.
- Hors ligne, les changements restent sur le téléphone, marqués « à envoyer », et partent au
  prochain geste ou retour au premier plan. Un onglet quitté envoie ce qui attend
  (`keepalive`).
- Sauvegarde (« Télécharger ») et restauration (« Restaurer ») JSON dans les réglages. Une
  restauration garde les dates de la sauvegarde.

L'accès passe par **Cloudflare Access**, posé devant le Worker avec une règle par domaine
d'e-mail : la page Cloudflare demande l'adresse, envoie un code, et ne laisse passer que les
adresses autorisées. Aucun compte Cloudflare n'est nécessaire, et l'app n'a pas d'écran de
connexion à elle.

- Quand `ACCESS_TEAM_DOMAIN` et `ACCESS_AUD` sont renseignés, le Worker vérifie **en plus** le
  jeton qu'Access joint à chaque requête (`worker/access.ts`) : signature RS256 contre les clés
  de l'équipe, audience, émetteur, expiration. Une requête qui n'est pas passée par Access est
  refusée (401). Sans ces deux variables, le Worker fait confiance à ce qui l'atteint, et Access
  doit couvrir toutes ses adresses.
- Une session Access expirée renvoie l'API vers la page de connexion Cloudflare. Le front la
  reconnaît (`redirect: 'manual'`) et recharge la page pour repasser par la connexion, au lieu
  d'afficher « serveur injoignable ». Les changements non envoyés attendent dans le miroir local.

## Modèle

```ts
people: Person[]                          // de une à quatre : { id, name, color?, updatedAt } ; la liste la plus récente gagne à la fusion
splitKeys: SplitKey[]                     // { id: 'prorata' } | { kind: 'fixed', name, shares: { from, byPerson }[] }
incomes: Income[]                         // { month: 'AAAA-MM', personId, components: { label?, amount }[] }
groups: BudgetGroup[]                     // les CATÉGORIES de l'écran : { id, name, splitKeyId, save, owner? }
categories: Category[]                    // les DÉPENSES (ancien nom gardé) : { id, name, icon? }
budgets: BudgetVersion[]                  // { categoryId, from, groupId, amount, note?, splitKeyId, save }
  amount: { kind: 'monthly'|'quarterly'|'semiannual'|'annual'|'biennial', value } | { kind: 'items', items } | { kind: 'none' }
    items: { label, amount, period? }[]   // period absente : mensuelle ; un ancien « 4 mois » (months4, weekly4) se lit mensuel ÷ 4
projects: Project[]                       // { id, name, items: { id, label, amount }[], target?, budget?: { categoryId } }
transactions: Transaction[]               // les opérations des relevés : { id, date, label, detail?, amount, owner?, categoryId? | saving? | unplanned? | ignored?, manual? }
rules: MatchRule[]                        // ce qu'on a appris : { key: '[p2:]MARCHAND' ou '[p2:]MARCHAND|centimes', categoryId? | saving? | ignored? }
settings: { prorataWindowMonths: 12 }
```

Tout ce qui entre — miroir local, Worker, fichier importé — passe par `sanitizeState`
(`src/lib/state.ts`), partagé par le front et le Worker : une entrée douteuse est écartée,
jamais plantée.

Les dépenses gardent leur ancien nom de stockage (`categories`, `budgets`) : les catégories de
l'écran sont arrivées après, sous `groups`, sans migrer les sauvegardes. Une catégorie au ratio a
sa propre clé fixe (`k-<id>`). Un document d'avant les catégories est rangé à la lecture dans
les trois de l'écran, sous des identifiants fixes (`g-<clé>` pour un ratio, `g-prorata-save`,
`g-prorata-monthly`), d'après la clé et l'épargne de chaque version ; chaque version garde une
copie de la répartition et de l'épargne de sa catégorie (`splitKeyId`, `save`), pour qu'une app
d'avant les catégories, encore ouverte ailleurs, lise et réécrive le document sans rien perdre.

Le propriétaire d'une catégorie ou d'une opération personnelle (`owner`, l'identifiant de sa
personne ; absent pour le commun) est aussi le **préfixe de son identifiant** (`p2:…`), comme
celui des règles apprises sur son compte : une app d'avant, qui ne connaît pas le champ et le perd
en réécrivant l'entité, garde l'identifiant, où l'assainissement le retrouve (`src/lib/scope.ts`).

## Développement

```bash
npm install
cp .dev.vars.example .dev.vars   # variables Access vides : pas de vérification en local
npm run build
npm run worker:dev   # http://127.0.0.1:8787 : le Worker, un KV local, et dist/ en statique
npm run dev          # http://localhost:5173, l'API relayée vers 8787
npm test             # vitest : domaine (prorata, versions, synthèse, fusion) et Worker
```

Les tests de synthèse s'appuient sur `seed/couts.json`, un foyer **fictif** (Alice et Bruno, revenus
et budget inventés) : avec ses revenus d'octobre 2025 à septembre 2026 et ses vingt-deux
dépenses, l'application retrouve 1 378,36 € et 1 995,64 € à verser, 425 € à épargner, un prorata
de 41,32 % / 58,68 % pour octobre 2026.

## Déploiement sur Cloudflare

1. L'espace KV : le créer (tableau de bord ou `npx wrangler kv namespace create BUDGET_KV`) et le
   lier au Worker sous le nom de binding **`BUDGET_KV`**. `wrangler.jsonc` ne porte pas d'`id` :
   `wrangler deploy` hérite du lien posé sur le Worker. Pour figer l'espace dans le code, y
   ajouter `"id": "<identifiant>"`.
2. Cloudflare Access : une application Access sur l'adresse du Worker, avec une règle « Emails
   ending in » votre domaine, et une durée de session longue (un mois). Puis, dans les
   variables du Worker (Paramètres → Variables et secrets), `ACCESS_TEAM_DOMAIN`
   (`equipe.cloudflareaccess.com`, dans Zero Trust → Paramètres) et `ACCESS_AUD` (l'étiquette
   d'audience, dans Zero Trust → Access → Applications → l'application). Ce ne sont pas des
   secrets. `wrangler.jsonc` porte `keep_vars` : un déploiement ne les efface pas.
3. Le design system est public sur npm : le build Cloudflare l'installe sans rien configurer.
   Commande de build `npm run build`, de déploiement `npx wrangler deploy` ; ou à la
   main, `npm run deploy`.
4. Sur l'iPhone : ouvrir l'URL dans Safari, Partager → Sur l'écran d'accueil, puis se connecter
   à Access depuis l'app installée (elle ne partage pas la session de Safari).

## Structure

```
index.html, public/            coquille, manifeste, icône : `icon.svg` (un cadre de viseur autour de
                               l'euro), et ses PNG pleins (180, 192, 512) rendus depuis elle
src/main.tsx, App.tsx          entrée, les cinq écrans, les rappels, la feuille des revenus
src/lib/                       le domaine, pur et testé : month, amount, prorata, budget, summary,
                               missing, merge, state (défaut, assainissement, import/export), api
src/hooks/                     useSharedState (miroir, envoi, fusion), useOpenLine (une ligne ouverte)
src/components/                écrans ; formulaires (CategoryForm, IncomeForm, ProjectForm), dans les
                               lignes et dans les feuilles de création ; Sheet, NumberField, MonthField
worker/index.ts                GET/PUT /api/state, versions précédentes, statique
worker/access.ts               vérification du jeton Cloudflare Access
seed/couts.json                un foyer fictif en données de test et d'exemple (revenus oct. 2025 – sept. 2026, dépenses, projets)
```
