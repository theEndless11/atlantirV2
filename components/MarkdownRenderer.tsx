'use client'

/**
 * MarkdownRenderer
 * ----------------
 * Uses the already-installed `marked` library (v18) to parse markdown into
 * clean, styled HTML. Handles everything the LLM throws at it:
 *   • Bold / italic / strikethrough
 *   • Tables (with alternating rows)
 *   • Fenced code blocks (with language label + copy button)
 *   • Inline code
 *   • Ordered + unordered lists (nested)
 *   • Blockquotes
 *   • Headings h1–h4
 *   • Horizontal rules
 *   • Links (open in new tab)
 *
 * Usage:
 *   <MarkdownRenderer content={text} />                    — default prose style
 *   <MarkdownRenderer content={text} bubble />             — inside a chat bubble (white/dark text)
 *   <MarkdownRenderer content={text} size="lg" />          — larger font (report / full-page view)
 */

import { useEffect, useRef, useState } from 'react'

interface Props {
  content: string
  bubble?: boolean   // true when inside a coloured chat bubble
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

// Tiny copy button injected next to every code block
function attachCopyButtons(container: HTMLElement) {
  container.querySelectorAll('pre').forEach(pre => {
    if (pre.querySelector('.md-copy-btn')) return
    const btn = document.createElement('button')
    btn.className = 'md-copy-btn'
    btn.textContent = 'Copy'
    btn.addEventListener('click', () => {
      const code = pre.querySelector('code')?.innerText || ''
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = 'Copied!'
        setTimeout(() => { btn.textContent = 'Copy' }, 1800)
      })
    })
    pre.style.position = 'relative'
    pre.appendChild(btn)
  })
}

export function MarkdownRenderer({ content, bubble = false, size = 'md', className }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [html, setHtml] = useState('')

  useEffect(() => {
    if (!content) { setHtml(''); return }

    // Dynamically import marked so it doesn't block SSR
    import('marked').then(({ marked, Renderer }) => {
      const renderer = new Renderer()

      // Links → open in new tab
      renderer.link = ({ href, title, tokens }) => {
        const text = tokens.map((t: any) => t.raw || '').join('')
        const t = title ? ` title="${title}"` : ''
        return `<a href="${href}"${t} target="_blank" rel="noopener noreferrer">${text}</a>`
      }

      // Code blocks — add language badge
      renderer.code = ({ text, lang }) => {
        const langLabel = lang ? `<span class="md-lang">${lang}</span>` : ''
        const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        return `<pre class="md-pre">${langLabel}<code class="md-code language-${lang || 'text'}">${escaped}</code></pre>`
      }

      // Tables — wrap in scroll div
      const origTable = renderer.table.bind(renderer)
      renderer.table = (token) => {
        const inner = origTable(token)
        return `<div class="md-table-wrap">${inner}</div>`
      }

      marked.setOptions({ renderer, breaks: true, gfm: true } as any)

      const result = marked.parse(content) as string
      setHtml(result)
    })
  }, [content])

  useEffect(() => {
    if (ref.current) attachCopyButtons(ref.current)
  }, [html])

  const fontSize = size === 'lg' ? 16 : size === 'sm' ? 12 : 13.5

  return (
    <>
      <div
        ref={ref}
        className={`md-root${bubble ? ' md-bubble' : ''}${className ? ` ${className}` : ''}`}
        style={{ fontSize, lineHeight: 1.75 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <style>{`
        /* ── Base prose ── */
        .md-root { color: var(--text-1); word-break: break-word; }
        .md-root > *:first-child { margin-top: 0 !important; }
        .md-root > *:last-child  { margin-bottom: 0 !important; }

        /* Headings */
        .md-root h1 { font-size: 1.5em; font-weight: 700; margin: 1.1em 0 .5em; line-height: 1.3; }
        .md-root h2 { font-size: 1.25em; font-weight: 700; margin: 1em 0 .4em; line-height: 1.35; }
        .md-root h3 { font-size: 1.1em; font-weight: 600; margin: .9em 0 .35em; }
        .md-root h4 { font-size: 1em; font-weight: 600; margin: .8em 0 .3em; }

        /* Paragraphs */
        .md-root p { margin: .55em 0; }

        /* Bold / italic */
        .md-root strong { font-weight: 700; }
        .md-root em { font-style: italic; }
        .md-root del { text-decoration: line-through; opacity: .6; }

        /* Lists */
        .md-root ul, .md-root ol { margin: .5em 0 .5em 1.4em; padding: 0; }
        .md-root li { margin: .25em 0; }
        .md-root li > ul, .md-root li > ol { margin: .2em 0 .2em 1.2em; }

        /* Blockquote */
        .md-root blockquote {
          border-left: 3px solid var(--accent);
          margin: .6em 0;
          padding: .4em .8em;
          background: var(--accent-soft);
          border-radius: 0 6px 6px 0;
          color: var(--text-2);
        }
        .md-root blockquote p { margin: 0; }

        /* Horizontal rule */
        .md-root hr { border: none; border-top: 1px solid var(--border); margin: 1em 0; }

        /* Links */
        .md-root a { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
        .md-root a:hover { opacity: .8; }

        /* Inline code */
        .md-root code:not(.md-code) {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: .1em .38em;
          font-family: 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
          font-size: .88em;
        }

        /* Fenced code blocks */
        .md-pre {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 8px;
          margin: .7em 0;
          overflow: auto;
          position: relative;
        }
        .md-code {
          display: block;
          padding: 12px 14px;
          font-family: 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
          font-size: .88em;
          line-height: 1.6;
          white-space: pre;
          overflow-x: auto;
        }
        .md-lang {
          display: block;
          padding: 4px 12px 0;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: .07em;
          color: var(--text-3);
          font-family: inherit;
          user-select: none;
        }
        .md-copy-btn {
          position: absolute;
          top: 6px;
          right: 8px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 5px;
          font-size: 10px;
          font-weight: 600;
          padding: 2px 8px;
          cursor: pointer;
          color: var(--text-2);
          font-family: inherit;
          opacity: 0;
          transition: opacity .15s;
        }
        .md-pre:hover .md-copy-btn { opacity: 1; }

        /* Tables */
        .md-table-wrap { overflow-x: auto; margin: .7em 0; border: 1px solid var(--border); border-radius: 8px; }
        .md-root table { width: 100%; border-collapse: collapse; font-size: .95em; }
        .md-root thead { background: var(--surface-2); }
        .md-root th {
          padding: 8px 12px;
          text-align: left;
          font-weight: 600;
          font-size: .85em;
          text-transform: uppercase;
          letter-spacing: .05em;
          color: var(--text-2);
          border-bottom: 1px solid var(--border);
          white-space: nowrap;
        }
        .md-root td {
          padding: 7px 12px;
          border-bottom: 1px solid var(--border-soft);
          color: var(--text-1);
          vertical-align: top;
        }
        .md-root tr:last-child td { border-bottom: none; }
        .md-root tbody tr:nth-child(even) { background: var(--surface-2); }
        .md-root tbody tr:hover { background: var(--accent-soft); }

        /* ── Inside a coloured bubble (user / assistant) ── */
        .md-bubble code:not(.md-code) {
          background: rgba(255,255,255,.18);
          border-color: rgba(255,255,255,.25);
        }
        .md-bubble .md-pre {
          background: rgba(0,0,0,.18);
          border-color: rgba(255,255,255,.15);
        }
        .md-bubble a { color: inherit; opacity: .85; }
        .md-bubble blockquote {
          border-left-color: rgba(255,255,255,.5);
          background: rgba(255,255,255,.1);
        }
        .md-bubble .md-table-wrap {
          border-color: rgba(255,255,255,.2);
        }
        .md-bubble th, .md-bubble td {
          border-color: rgba(255,255,255,.15);
          color: inherit;
        }
        .md-bubble thead { background: rgba(0,0,0,.15); }
        .md-bubble tbody tr:nth-child(even) { background: rgba(255,255,255,.08); }
      `}</style>
    </>
  )
}
