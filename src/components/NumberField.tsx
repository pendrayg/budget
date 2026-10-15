import { Input } from '../ds'
import { useEffect, useState } from 'react'
import { parseNumber } from '../lib/format'

/**
 * Champ numérique : le champ du DS, en texte à clavier décimal plutôt qu'en `type="number"`.
 *
 * Le clavier numérique d'iOS n'a pas de virgule sur `type="number"`, et une virgule tapée y
 * vide le champ. Ici on tape « 540,5 » comme on l'écrirait ; la conversion se fait à la saisie,
 * et le texte reste ce qu'on a tapé tant qu'on y est.
 */
export default function NumberField({
  id,
  label,
  value,
  onChange,
  placeholder,
  suffix,
  autoFocus,
  className,
}: {
  id: string
  label?: string
  value: number | null
  onChange: (value: number | null) => void
  placeholder?: string
  suffix?: string
  autoFocus?: boolean
  className?: string
}) {
  const [text, setText] = useState(value === null ? '' : String(value).replace('.', ','))

  // Une valeur changée de l'extérieur (réinitialisation du formulaire) se reflète dans le champ.
  useEffect(() => {
    const parsed = parseNumber(text)
    if (parsed !== value) setText(value === null ? '' : String(value).replace('.', ','))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const input = (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      autoFocus={autoFocus}
      value={text}
      onChange={(event) => {
        setText(event.target.value)
        onChange(parseNumber(event.target.value))
      }}
    />
  )

  if (!label) return input
  return (
    <div className={`field${className ? ` ${className}` : ''}`}>
      <label htmlFor={id}>
        {label}
        {suffix ? ` (${suffix})` : ''}
      </label>
      {input}
    </div>
  )
}
