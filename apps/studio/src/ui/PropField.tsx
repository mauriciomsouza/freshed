import {
  ACTION_TYPES,
  checkPropValue,
  type Action,
  type PropSpec,
  type PropValue,
} from '@freshed/schema'
import { useId } from 'react'

/** One editor control per prop type. Values are validated against the spec as you type. */
export function PropField({
  name,
  spec,
  value,
  onChange,
  screens,
}: {
  name: string
  spec: PropSpec
  value: PropValue | undefined
  onChange: (v: PropValue | undefined) => void
  screens: string[]
}) {
  const id = useId()
  const error = checkPropValue(spec, value)
  const label = (
    <label className="field-label" htmlFor={id}>
      {name}
      <span className="field-type">{spec.type === 'enum' ? 'enum' : spec.type}</span>
      {spec.required ? <span className="field-required">required</span> : null}
    </label>
  )
  const hint = spec.description ? <span className="field-hint">{spec.description}</span> : null
  const err = error ? <span className="field-error">{`${name} ${error}`}</span> : null

  switch (spec.type) {
    case 'string':
    case 'image': {
      const v = typeof value === 'string' ? value : ''
      const long = spec.type === 'string' && (spec.multiline || (spec.maxLength ?? 0) > 120)
      return (
        <div className="field">
          {label}
          {long ? (
            <textarea
              id={id}
              className="textarea"
              rows={3}
              value={v}
              onChange={(e) => onChange(e.target.value || undefined)}
            />
          ) : (
            <input
              id={id}
              className="input"
              value={v}
              placeholder={
                spec.type === 'image'
                  ? 'asset:beans or https://…'
                  : 'default' in spec
                    ? spec.default
                    : ''
              }
              onChange={(e) => onChange(e.target.value || undefined)}
            />
          )}
          {spec.type === 'string' && spec.maxLength ? (
            <span className="field-hint">
              {v.length}/{spec.maxLength}
            </span>
          ) : (
            hint
          )}
          {err}
        </div>
      )
    }
    case 'number':
      return (
        <div className="field">
          {label}
          <input
            id={id}
            className="input"
            type="number"
            value={typeof value === 'number' ? value : ''}
            onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          />
          {hint}
          {err}
        </div>
      )
    case 'boolean':
      return (
        <div
          className="field"
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          {label}
          <button
            id={id}
            type="button"
            role="switch"
            className="switch"
            aria-checked={value === true}
            onClick={() => onChange(value === true ? undefined : true)}
          />
        </div>
      )
    case 'enum': {
      const v = typeof value === 'string' ? value : ''
      if (spec.values.length <= 4) {
        return (
          <div className="field">
            <span className="field-label" id={id}>
              {name}
              <span className="field-type">enum</span>
            </span>
            <div className="segmented" role="group" aria-labelledby={id}>
              {spec.values.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  aria-pressed={(v || spec.default) === opt}
                  onClick={() => onChange(opt === spec.default ? undefined : opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
            {err}
          </div>
        )
      }
      return (
        <div className="field">
          {label}
          <select
            id={id}
            className="select"
            value={v || spec.default || ''}
            onChange={(e) => onChange(e.target.value)}
          >
            {spec.values.map((opt) => (
              <option key={opt}>{opt}</option>
            ))}
          </select>
          {err}
        </div>
      )
    }
    case 'string[]': {
      const v = Array.isArray(value) ? value : []
      return (
        <div className="field">
          {label}
          <textarea
            id={id}
            className="textarea"
            rows={Math.max(3, v.length)}
            value={v.join('\n')}
            onChange={(e) => onChange(e.target.value ? e.target.value.split('\n') : undefined)}
          />
          <span className="field-hint">
            One item per line{spec.maxItems ? `, up to ${spec.maxItems}` : ''}.
          </span>
          {err}
        </div>
      )
    }
    case 'action':
      return (
        <div className="field">
          {label}
          <ActionEditor
            id={id}
            value={value as Action | undefined}
            onChange={onChange}
            screens={screens}
          />
          {hint}
          {err}
        </div>
      )
  }
}

function defaultsFor(type: Action['type'], screens: string[]): Action {
  switch (type) {
    case 'navigate':
      return { type, to: screens[0] ?? 'home' }
    case 'emit':
      return { type, event: 'next' }
    case 'openUrl':
      return { type, url: 'https://' }
    case 'submit':
      return { type, name: 'form' }
    case 'copy':
      return { type, text: 'Copied text' }
    case 'share':
      return { type, message: 'Check this out' }
    default:
      return { type } as Action
  }
}

function ActionEditor({
  id,
  value,
  onChange,
  screens,
}: {
  id: string
  value: Action | undefined
  onChange: (v: Action | undefined) => void
  screens: string[]
}) {
  const a = value
  const set = (patch: Partial<Record<string, string>>) =>
    a && onChange({ ...a, ...patch } as Action)
  return (
    <div className="action-editor">
      <select
        id={id}
        className="select"
        value={a?.type ?? ''}
        onChange={(e) =>
          onChange(
            e.target.value ? defaultsFor(e.target.value as Action['type'], screens) : undefined,
          )
        }
      >
        <option value="">none</option>
        {ACTION_TYPES.map((t) => (
          <option key={t}>{t}</option>
        ))}
      </select>
      {a?.type === 'navigate' ? (
        <select
          className="select"
          aria-label="Target screen"
          value={a.to}
          onChange={(e) => set({ to: e.target.value })}
        >
          {screens.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      ) : a?.type === 'emit' ? (
        <input
          className="input code"
          aria-label="Event name"
          value={a.event}
          onChange={(e) => set({ event: e.target.value })}
        />
      ) : a?.type === 'openUrl' ? (
        <input
          className="input code"
          aria-label="URL"
          value={a.url}
          onChange={(e) => set({ url: e.target.value })}
        />
      ) : a?.type === 'submit' ? (
        <input
          className="input code"
          aria-label="Submission name"
          value={a.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      ) : a?.type === 'copy' ? (
        <input
          className="input"
          aria-label="Text to copy"
          value={a.text}
          onChange={(e) => set({ text: e.target.value })}
        />
      ) : a?.type === 'share' ? (
        <input
          className="input"
          aria-label="Share message"
          value={a.message}
          onChange={(e) => set({ message: e.target.value })}
        />
      ) : (
        <span />
      )}
    </div>
  )
}
