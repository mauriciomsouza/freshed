import { componentsUsed, type ComponentDefinition, type PropSpec } from '@freshed-cms/schema'
import { useStore } from '../data/store'
import { registeredNames, ScreenPreview } from '../preview/Phone'
import type { Route } from '../router'

const example: Partial<Record<string, Record<string, unknown>>> = {
  Hero: {
    eyebrow: 'Brew',
    title: 'Fresh beans, on your schedule',
    subtitle: 'Roasted to order.',
    image: 'asset:beans',
  },
  Text: { text: 'How do you take your coffee?', variant: 'heading' },
  Button: { label: 'Continue', action: { type: 'emit', event: 'next' } },
  Image: { src: 'asset:calendar', alt: 'A calendar', aspect: 'wide' },
  Card: {
    title: 'Balanced & sweet',
    caption: 'Caramel, milk chocolate.',
    badge: 'Popular',
    selected: true,
  },
  List: { items: ['Roasted within 48 hours', 'Pause anytime'] },
  Spacer: { size: 'md' },
  Stack: { gap: 'sm' },
  ReferralCode: { code: 'BREW-ANA5', copy: { type: 'copy', text: 'BREW-ANA5' } },
}

function typeLabel(spec: PropSpec) {
  if (spec.type === 'enum') return spec.values.join(' | ')
  return spec.type
}

export function ComponentsPage({
  name,
  navigate,
}: {
  name?: string
  navigate: (r: Route) => void
}) {
  const { workspace } = useStore()
  const list = workspace.components
  const current = list.find((c) => c.name === name) ?? list[0]
  const byCategory = new Map<string, ComponentDefinition[]>()
  for (const c of list)
    byCategory.set(c.category ?? 'Other', [...(byCategory.get(c.category ?? 'Other') ?? []), c])

  return (
    <div className="page-body">
      <aside className="col col-list" aria-label="Components">
        <div className="col-head">
          <span className="col-title">{list.length} registered</span>
        </div>
        <div className="col-scroll">
          {[...byCategory].map(([cat, items]) => (
            <div key={cat}>
              <div className="field-hint" style={{ padding: '12px 18px 2px' }}>
                {cat}
              </div>
              <ul className="list" style={{ paddingTop: 2 }}>
                {items.map((c) => (
                  <li key={c.name}>
                    <button
                      className="list-item"
                      aria-current={c.name === current?.name}
                      onClick={() => navigate({ page: 'components', name: c.name })}
                    >
                      <span className="list-item-row">
                        <span className="list-item-title">{c.name}</span>
                        {!registeredNames.includes(c.name) ? (
                          <span className="tag tag-draft">not in bundle</span>
                        ) : null}
                      </span>
                      <span className="list-item-sub">{Object.keys(c.props).length} props</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </aside>
      {current ? <ComponentDoc def={current} /> : null}
    </div>
  )
}

function ComponentDoc({ def }: { def: ComponentDefinition }) {
  const { workspace } = useStore()
  const usedIn = workspace.screens.filter((s) => componentsUsed(s).includes(def.name))
  const sample = {
    slug: 'specimen',
    title: def.name,
    root: {
      type: 'Stack',
      props: { gap: 'md', padding: 'lg' },
      children: [
        def.children
          ? {
              type: def.name,
              props: example[def.name] ?? {},
              children: [{ type: 'Text', props: { text: 'Child content' } }],
            }
          : { type: def.name, props: (example[def.name] ?? {}) as never },
      ],
    },
  }
  return (
    <div className="col-scroll" style={{ background: 'var(--panel)' }}>
      <div className="doc">
        <h2>{def.name}</h2>
        <p className="doc-lead">{def.description}</p>
        <div
          className="specimen"
          role="region"
          aria-label={`${def.name} rendered with example props`}
        >
          <div className="specimen-inner">
            <ScreenPreview screen={sample as never} />
          </div>
        </div>
        <section className="doc-section">
          <h3>Props</h3>
          <div className="props">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Default</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(def.props).map(([name, spec]) => (
                  <tr key={name}>
                    <td>
                      <code style={{ color: 'var(--text)' }}>{name}</code>
                      {spec.required ? <span className="field-required"> required</span> : null}
                    </td>
                    <td>
                      <code>{typeLabel(spec)}</code>
                    </td>
                    <td>
                      {'default' in spec && spec.default !== undefined ? (
                        <code>{JSON.stringify(spec.default)}</code>
                      ) : (
                        <span className="crumb">none</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>
                      {spec.description ??
                        ('maxLength' in spec && spec.maxLength
                          ? `Up to ${spec.maxLength} characters`
                          : '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {def.children ? (
            <p className="field-hint" style={{ marginTop: 8 }}>
              Accepts child nodes.
            </p>
          ) : null}
        </section>
        <section className="doc-section">
          <h3>Used in</h3>
          {usedIn.length ? (
            <div className="usage">
              {usedIn.map((s) => (
                <a key={s.slug} className="tag" href={`#/screens/${s.slug}`}>
                  {s.title}
                </a>
              ))}
            </div>
          ) : (
            <p className="field-hint">Not used by any screen yet.</p>
          )}
        </section>
        <section className="doc-section">
          <h3>Definition</h3>
          <pre
            className="diff"
            style={{ padding: 12, margin: 0, overflow: 'auto', fontSize: 11.5 }}
          >
            {JSON.stringify(def, null, 2)}
          </pre>
        </section>
      </div>
    </div>
  )
}
