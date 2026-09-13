'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface PatientHit {
  id: string;
  name: string;
  meta: string;
}
interface Command {
  id: string;
  label: string;
  hint?: string;
  href: string;
}

const STATIC_COMMANDS: Command[] = [
  { id: 'home', label: 'Ir a Inicio', href: '/' },
  { id: 'patients', label: 'Ir a Pacientes', href: '/patients' },
];

/**
 * Command Palette (§NIVEL 1): navegación y búsqueda rápida con ⌘K / Ctrl+K.
 * Busca pacientes server-side (tenant-scoped) y ofrece atajos de navegación.
 * Accesible por teclado (flechas, Enter, Esc) con `role=dialog` y foco atrapado
 * en el input.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<PatientHit[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Abrir/cerrar con ⌘K / Ctrl+K; cerrar con Esc.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHits([]);
      setActive(0);
      // Enfocar el input al abrir.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Buscar pacientes (debounce simple) cuando cambia la consulta.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q === '') {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/patients/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d: { results: PatientHit[] }) => {
          setHits(d.results ?? []);
          setActive(0);
        })
        .catch(() => {
          /* abortado o error de red: no romper la UI */
        });
    }, 160);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open]);

  const matchingCommands = STATIC_COMMANDS.filter((c) =>
    c.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const items: Command[] = [
    ...matchingCommands,
    ...hits.map((h) => ({ id: h.id, label: h.name, hint: h.meta, href: `/patients/${h.id}` })),
  ];

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const sel = items[active];
      if (sel) go(sel.href);
    }
  }

  if (!open) return null;

  return (
    <div
      className="mos-cmdk__overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de comandos"
      onClick={() => setOpen(false)}
    >
      <div className="mos-cmdk" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="mos-cmdk__input"
          placeholder="Buscar pacientes o ir a…"
          aria-label="Buscar"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onInputKey}
        />
        <ul className="mos-cmdk__list" role="listbox">
          {items.length === 0 ? (
            <li className="mos-cmdk__empty">
              {query.trim() ? 'Sin resultados.' : 'Escribe para buscar…'}
            </li>
          ) : (
            items.map((it, i) => (
              <li
                key={it.id}
                role="option"
                aria-selected={i === active}
                className={`mos-cmdk__item${i === active ? ' is-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(it.href)}
              >
                <span>{it.label}</span>
                {it.hint ? <span className="mos-muted">{it.hint}</span> : null}
              </li>
            ))
          )}
        </ul>
        <div className="mos-cmdk__footer mos-muted">
          ⌘K / Ctrl+K · ↑↓ navegar · Enter abrir · Esc cerrar
        </div>
      </div>
    </div>
  );
}
