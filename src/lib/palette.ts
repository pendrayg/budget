/**
 * La teinte de la courbe du budget (`--total-color`, cf. index.css) : sous le néomorphique, celle
 * de la valeur dans Investment, de luminosité moyenne, lisible sur les deux fonds du DS (vérifiée :
 * contraste ≥ 3:1 sur #f9f9f7 comme sur #222425) ; sous Star Wars, l'encre des données du DS, ambre
 * — le bleu y dit « sélectionné ». Pas de légende : l'infobulle la nomme.
 */
export const TOTAL_COLOR = 'var(--total-color)'

/** Le revenu du foyer, face au budget : à l'encre discrète du DS, il cadre sans rivaliser. */
export const INCOME_COLOR = 'var(--color-muted)'
