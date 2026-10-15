# Budget

Le budget d'un foyer — seul, en couple, jusqu'à quatre —, sorti de son classeur Excel : les revenus de chacun mois par mois, le
prorata qui en découle, les dépenses par catégorie et la part de chacun, une calculatrice de
répartition, et les projets ponctuels. Une web app pour Safari sur iPhone, ajoutée à l'écran
d'accueil, bâtie sur le design system néomorphique partagé
(`@pendrayg/neomorphism-design-system`) — ou, au choix des Réglages, sur son jumeau Star Wars
(`@pendrayg/star-wars-design-system`) — et déployée sur Cloudflare Workers. Tous les
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

Le prorata n'est jamais stocké : il se déduit des revenus. L'écran **Mois** le montre en tête,
en lignes — le libellé à gauche, la valeur à droite —, selon le compte choisi dans le sous-menu
du bas. Sur le **commun** : la part de chacun, puis le **revenu moyen du foyer** (la somme de ceux
de chacun), son **taux d'effort** ((à verser au commun + budgets personnels) / revenu moyen) et
son **reste à vivre** (la somme de ceux de chacun). Sur le compte d'une **personne** : sa part,
son revenu moyen, son effort et son reste. Effort et reste n'apparaissent qu'une fois un budget
saisi. La couleur de chacun, pour les graphiques du budget, se choisit dans Réglages →
Personnes, parmi les huit de la palette (bleu, orange, aqua, jaune, rose, vert, violet, rouge),
toutes ouvertes à chacun, même proches l'une de l'autre.

### Les mois : revenus et dépenses

Revenus et dépenses partagent un écran, **Mois** : ce qui est entré et ce qui est sorti. Sous la
synthèse du prorata, un graphique, **une barre par mois** : les **revenus** en sont la barre
principale, un contour pointillé à l'encre discrète du DS ; dedans, le **budget** est la barre à
remplir, un contour pointillé à la teinte du total, que le **dépensé** remplit — au-delà du budget,
seul le **dépassement** passe au rouge. Chaque mois qui a un revenu ou un relevé y a sa barre : un
mois sans relevé n'a que ses revenus ; un mois où il manque le revenu de quelqu'un (sur le commun)
n'a que son budget et son dépensé. Au toucher,
l'infobulle donne les revenus, le dépensé, le budget, le pourcentage rempli, le dépassement et le
**reste à vivre** du mois — le revenu du mois moins ce qu'on verse au commun et son budget
personnel (avant le premier budget saisi, c'est ce premier budget qui s'applique), en rouge s'il
est négatif. Revenus et reste à vivre sont ceux du compte choisi : du foyer, ou d'une personne.
Dessous, chaque mois, saisi ou importé, est un bouton section dépliante. Sa première ligne dit le
mois et ses **revenus** ; sa **seconde ligne**, ses dépenses : le nombre de dépenses en
**dépassement**, en rouge, et, calé à droite, le nombre d'opérations **à ranger**. Déplié, ses
revenus, puis ses **dépenses**, l'état des lieux de son relevé.

Tout suit le sous-menu du bas. Sur le **commun**, les revenus sont ceux du foyer : la ligne en
donne la somme, « à compléter » tant qu'il manque celui de quelqu'un, et le dépli les détaille,
personne par personne, sans les saisir ; les dépenses sont celles du compte commun. Sur le compte
d'une **personne**, ses revenus à elle, qui se saisissent dans le dépli — sans sélecteur de
personne, le sous-menu l'a déjà choisie —, et ses dépenses, face à son budget. Au pied de l'écran,
« Saisir un mois » (pour la personne choisie ; sur le commun, la feuille propose chacun) et
« Importer un relevé » (dans le compte choisi). Un rappel de saisie ouvre toujours la feuille sur
chacun : le revenu qui manque peut être celui de n'importe qui.

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

Ce qu'on a **vraiment dépensé**, face au budget, dans l'écran Mois. En début de mois, « Importer un relevé » prend le
relevé PDF du compte commun (BoursoBank) : il est lu **dans le téléphone** (pdf.js, chargé au
premier import seulement), et seules ses opérations sont gardées — date, libellé, montant ;
jamais le PDF, ni le RIB. Les montants se lisent au débit ou au crédit d'après leur colonne.
En tête de l'écran Mois, le graphique dit, mois par mois, le dépensé dans son budget, et en rouge
ce qui le dépasse (cf. plus haut). Dans
un mois déplié, sous ses revenus, ses dépenses montrent d'abord les opérations **à ranger** — un appui ouvre la liste des
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

Sur le budget, les mois (pour leurs dépenses) et les projets, un sous-menu **Commun / Alice / Bruno** (une pastille
par personne, sur deux lignes à partir de trois), en bas au-dessus du menu, choisit le budget :
le commun, ou celui de l'une des personnes. Le choix vaut pour les trois écrans, et ce
téléphone le retient. Un budget personnel a ses propres catégories et dépenses, que sa personne
paie seule : pas de répartition (ni prorata, ni ratio), seulement « À épargner ». Sa synthèse
dit son total, la part du revenu qu'il prend, et le **reste à vivre** une fois versée sa part du
commun et payé son budget. Son graphique le suit face à son seul revenu. Le budget commun et ses
parts n'en tiennent pas compte ; le **reste à vivre** de l'écran Mois, si : synthèse et infobulle
retirent du revenu la part du commun ET le budget personnel (avant le premier budget personnel,
c'est lui qui vaut, comme pour le commun).

À plusieurs, une **dépense passe d'un budget à l'autre** (du commun à une personne, d'une personne
à une autre, ou au commun) par le sélecteur « Budget » de son formulaire, à partir du mois en
cours : les mois d'avant restent dans l'ancien budget, avec leurs opérations rangées. Elle va dans
une catégorie du même type (à épargner ou non) du budget choisi, ou dans une catégorie qui naît
pour elle (`moveCategory`). Pas la dépense d'un projet, qui reste dans le budget du projet.

Aux dépenses, le relevé s'**importe dans le compte choisi** : ses opérations sont à cette
personne, sans avoir à le dire pour chacune, et se rangent dans les dépenses de son budget.
Chaque compte apprend ses propres marchands, et un même relevé importé dans deux comptes y fait
deux jeux d'opérations distincts.

### Les projets

La feuille `Projets` : des achats ponctuels en lignes, avec leur total. Rien à répartir. Comme
le budget et les dépenses, les projets sont **du commun ou d'une personne** : le même sous-menu
choisit le périmètre, et un nouveau projet naît dans celui qui est choisi. Retirer une personne
rapatrie ses projets avec le reste. Chaque projet porte la **brique** des projets devant son nom,
puis l'icône qu'on lui choisit (le même sélecteur que les dépenses) ; sa dépense au budget, s'il
s'épargne, reprend les deux.

Un projet peut avoir une **date cible** et s'**épargner dans le budget** : on choisit une
catégorie à épargner **de son périmètre** (du commun pour un projet commun, du budget de la
personne pour le sien), où il devient une dépense comme une autre,
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
  champs, sélecteurs, sections dépliantes, barre de menu, écrans qui glissent (ou clignotent, sous
  Star Wars). Les sections du budget sont des sections dépliantes ordinaires : elles ne
  s'enfoncent pas.
- **Deux design systems, au choix des Réglages** (Apparence) : le néomorphique, par défaut, ou
  son jumeau [`@pendrayg/star-wars-design-system`](https://www.npmjs.com/package/@pendrayg/star-wars-design-system)
  — mêmes composants, mêmes props, mêmes classes `.ds-*` et mêmes jetons, mais plus une ombre : un
  tube néon, les polices du générique, le grain d'un écran cathodique. Le choix est un réglage de
  l'appareil (`src/lib/design-system.ts`, clé `budget:design-system`), comme le budget choisi
  dans le sous-menu : il ne part ni au serveur ni dans la sauvegarde. Leurs feuilles ne pouvant
  pas cohabiter, Budget n'importe jamais un paquet directement : tout passe par l'**adaptateur**
  `src/ds/`, qui lit le choix, importe le paquet élu — le module attend ce chargement (`await` de
  premier niveau, d'où la cible `es2022` du build) avant que l'application ne rende quoi que ce
  soit — et re-exporte les seuls composants que Budget utilise, à la signature commune aux deux.
  Chaque paquet vient avec sa feuille, `src/ds/neomorphism.css` ou `src/ds/star-wars.css`, qui
  importe les styles du DS **puis** `index.css` : l'ordre est fixé dans un seul fichier CSS, pas
  dans celui où le navigateur reçoit les chunks. L'adaptateur pose `data-ds` sur `<html>` ;
  `index.css` s'en sert pour le peu qui n'a de sens que sous Star Wars (ce qui se creusait
  s'allume, et le bleu y étant réservé à ce qui est actif, le total du budget et l'avancée d'un
  projet passent à l'ambre des données, les barres du remplissage deviennent des marques pleines
  cernées de néon).
- **Les transitions sont celles du DS.** Les écrans sont les `Slides` du paquet élu : sous le
  néomorphique, la vue **glisse** dans le sens de la barre de menu ; sous Star Wars, rien ne
  glisse, la vue **clignote** sous le voile du DS (`.ds-screen-blink`) — la pastille du menu
  s'éteint sur l'ancienne destination dès l'appui et se rallume sur la nouvelle, la vue change
  voile plein. L'application ne fait que dire où l'on va ; les sections dépliantes, les
  sélecteurs et les champs apportent aussi les leurs.
- **Changer de DS est un saut en hyperespace**, celui du DS Star Wars (`HyperspaceJump`), dans les
  deux sens. La page devant se recharger, le saut est coupé en deux, au seul instant où l'écran
  est entièrement couvert, l'entrée en croisière (`src/lib/hyperspace.ts`) : la page quittée
  joue l'accélération, puis écrit le choix, laisse une marque d'arrivée dans `sessionStorage` et
  se recharge ; la page d'arrivée reprend en croisière et décélère sur le nouveau DS.
  `index.html` lit la marque avant tout chargement et peint la page en noir, pour que le
  rechargement ne laisse rien entrevoir entre les deux moitiés. La boîte du saut est reprise dans
  `index.css` : sous le néomorphique, la feuille du DS Star Wars n'est pas là. Sous
  `prefers-reduced-motion`, pas de saut : le choix s'écrit et la page se recharge aussitôt.
- **Chaque ligne est un bouton section dépliante** (`DisclosureButton`) : une catégorie, un mois
  de revenus, un projet, un groupe de réglages. L'en-tête dit la ligne (nom et montant ; pour un
  mois, le revenu de chacun) ; un appui l'enfonce et déplie son
  formulaire dedans — ce qu'ouvrait autrefois la roue dentée de la ligne. Une seule ligne ouverte
  à la fois par écran ; supprimer la replie.
- **Pas de bouton Enregistrer** : une catégorie, un mois de revenus ou un projet s'enregistre au
  fil de la saisie, dès que ce qui est saisi est valable (une catégorie a un nom et un montant).
  L'en-tête de la ligne suit aussitôt. Seule la création attend « Créer », pour qu'une catégorie ou
  un projet ne naisse pas à la première lettre tapée.
- **Cinq destinations** dans la barre de menu : Budget, Mois, Calcul, Projets, Réglages — revenus
  et dépenses partagent l'écran Mois, pour que la destination courante ait la place de dire son
  nom à côté de son icône (sur un écran de 440 px, sous les deux DS). Ce qui n'a pas encore de ligne — une nouvelle catégorie, un mois à saisir, un nouveau projet —
  s'ouvre en feuille (`<dialog>` natif), pas en destination.
- **Pas de zones** : comme Investment, les sections sont des blocs nus séparés par le blanc, le
  contenu va d'un bord à l'autre.
- **Supprimer se fait en deux appuis**, avec le bouton de suppression du DS (`DeleteButton`) :
  une ligne d'un montant ou d'un revenu, une version de l'historique, une dépense, une catégorie
  ou un projet (au bas de sa fiche, avec son libellé) et « Tout effacer » (avec son libellé). Le premier appui arme la poubelle, qui passe au rouge ; le second
  supprime. Pas de boîte de confirmation.
- **Un sous-menu, c'est `FlatSelector`** : la périodicité d'un montant, la personne dont on
  saisit le revenu dans la feuille de saisie, la clé de la calculatrice.
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
- L'espace KV est **facultatif** : deux modes, choisis par le déploiement, sans réglage.
  - **Synchronisé** (KV lié) : ce qui précède, le document est partagé entre les téléphones.
  - **Local** (sans KV) : le Worker répond 501 sur `/api/*`, et l'app garde le document sur
    l'appareil, sans rien envoyer ni signaler de panne. Le mode est retenu
    (`budget:storage`) : l'app s'ouvre directement en local, sans spinner. Les réglages
    proposent la sauvegarde en fichier pour garder les données ailleurs ou changer d'appareil.
    Au retour au premier plan, l'app revérifie en silence : un espace lié depuis reçoit ce qui
    attendait, et l'app repasse en synchronisé.
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
projects: Project[]                       // { id, name, items: { id, label, amount }[], target?, budget?: { categoryId }, owner? }
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
npm test             # vitest : domaine (prorata, versions, synthèse, fusion), Worker, design system
npm run lint         # oxlint
npm run typecheck    # tsc -b
```

Les tests de synthèse s'appuient sur `seed/couts.json`, un foyer **fictif** (Alice et Bruno, revenus
et budget inventés) : avec ses revenus d'octobre 2025 à septembre 2026 et ses vingt-deux
dépenses, l'application retrouve 1 378,36 € et 1 995,64 € à verser, 425 € à épargner, un prorata
de 41,32 % / 58,68 % pour octobre 2026.

## Déploiement sur Cloudflare

1. L'espace KV (facultatif, mais c'est lui qui partage le document entre téléphones) : le créer (tableau de bord ou `npx wrangler kv namespace create BUDGET_KV`) et le
   lier au Worker sous le nom de binding **`BUDGET_KV`**. `wrangler.jsonc` ne porte pas d'`id` :
   `wrangler deploy` hérite du lien posé sur le Worker. Pour figer l'espace dans le code, y
   ajouter `"id": "<identifiant>"`.
   Pour s'en passer, retirer le bloc `kv_namespaces` de `wrangler.jsonc` : sinon `wrangler
   deploy` crée un espace vide si le Worker n'en a pas.
2. Cloudflare Access : une application Access sur l'adresse du Worker, avec une règle « Emails
   ending in » votre domaine, et une durée de session longue (un mois). Puis, dans les
   variables du Worker (Paramètres → Variables et secrets), `ACCESS_TEAM_DOMAIN`
   (`equipe.cloudflareaccess.com`, dans Zero Trust → Paramètres) et `ACCESS_AUD` (l'étiquette
   d'audience, dans Zero Trust → Access → Applications → l'application). Ce ne sont pas des
   secrets. `wrangler.jsonc` porte `keep_vars` : un déploiement ne les efface pas.
3. Les deux design systems sont publics sur npm : le build Cloudflare les installe sans rien configurer.
   Commande de build `npm run build`, de déploiement `npx wrangler deploy` ; ou à la
   main, `npm run deploy`.
4. Sur l'iPhone : ouvrir l'URL dans Safari, Partager → Sur l'écran d'accueil, puis se connecter
   à Access depuis l'app installée (elle ne partage pas la session de Safari).

## Structure

```
index.html, public/            coquille, manifeste, icône : `icon.svg` (un cadre de viseur autour de
                               l'euro), et ses PNG pleins (180, 192, 512) rendus depuis elle
src/main.tsx, App.tsx          entrée, les cinq écrans, les rappels, la feuille des revenus, le saut
src/ds/                        l'adaptateur du design system : le paquet élu, sa feuille, puis index.css
src/lib/                       le domaine, pur et testé : month, amount, prorata, budget, summary,
                               missing, merge, state (défaut, assainissement, import/export), api ;
                               design-system (le DS retenu) et hyperspace (le saut qui en change)
src/hooks/                     useSharedState (miroir, envoi, fusion), useOpenLine (une ligne ouverte)
src/components/                écrans ; formulaires (CategoryForm, IncomeForm, ProjectForm), dans les
                               lignes et dans les feuilles de création ; Sheet, NumberField, MonthField
worker/index.ts                GET/PUT /api/state, versions précédentes, statique
worker/access.ts               vérification du jeton Cloudflare Access
seed/couts.json                un foyer fictif en données de test et d'exemple (revenus oct. 2025 – sept. 2026, dépenses, projets)
```
