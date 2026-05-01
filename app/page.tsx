'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'

const agents = [
  { name: 'Scout', role: 'Researcher',  color: '#34d399', pct: 92 },
  { name: 'Bolt',  role: 'Executor',    color: '#6ee7b7', pct: 87 },
  { name: 'Sage',  role: 'Analyst',     color: '#10b981', pct: 95 },
  { name: 'Quill', role: 'Writer',      color: '#a7f3d0', pct: 78 },
  { name: 'Link',  role: 'Synthesizer', color: '#059669', pct: 83 },
]

const panelStats = [
  { num: '2.4M', label: 'Runs this month' },
  { num: '94%',  label: 'Success rate' },
  { num: '14h',  label: 'Avg time saved' },
]

const features = [
  { title: 'AI Command Center', desc: 'Type or speak any goal. Agents plan, delegate, and execute the full pipeline automatically.', wide: true },
  { title: 'Voice Mode', desc: 'Deepgram STT + ElevenLabs TTS. Speak instructions, get spoken answers.', wide: false },
  { title: 'Meeting Intelligence', desc: 'Auto summaries, action items and GitHub issues created in real time.', wide: false },
  { title: '22 Integrations', desc: 'Slack, GitHub, Jira, HubSpot, Notion and more. Real actions, not just mentions.', wide: false },
  { title: 'Automated Workflows', desc: 'Define pipelines once, run on a schedule or by voice command.', wide: false },
  { title: 'Knowledge Base', desc: 'Upload docs and SOPs. Agents inject relevant context into every task.', wide: false },
]

const integrations = ['Slack','GitHub','Gmail','Jira','Linear','HubSpot','Notion','Stripe','Trello','Asana','Twilio','Vercel','Sentry','Zapier','Airtable','Zendesk','PagerDuty','Intercom','Cloudflare','Google Cal','Excel','Web Search']

const plans = [
  { name: 'Starter', price: 'Free', sub: ' forever', items: ['1 workspace','50 agent runs / month','2 integrations','1 GB knowledge base','Meeting transcripts'], cta: 'Get started free', href: '/register', featured: false },
  { name: 'Pro', price: 'Coming soon', items: ['Unlimited workspaces','Unlimited agent runs','All 22 integrations','25 GB knowledge base','Voice mode','Full analytics'], cta: 'Notify me', featured: true, badge: 'Most popular' },
  { name: 'Enterprise', price: 'Custom', items: ['Everything in Pro','SSO / SAML','Custom integrations','SLA & uptime guarantee','Dedicated support'], cta: 'Contact us', featured: false },
]

export default function LandingPage() {
  const year = new Date().getFullYear()
  const router = useRouter()

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: ws } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', session.user.id)
        .order('created_at')
        .limit(1)
        .single()
      if (ws) router.replace(`/workspace/${ws.workspace_id}`)
      else router.replace('/onboarding')
    })
  }, [])

  const webglRef = useRef<HTMLCanvasElement>(null)
  const chartBarRef = useRef<HTMLCanvasElement>(null)
  const chartLineRef = useRef<HTMLCanvasElement>(null)
  const chartAreaRef = useRef<HTMLCanvasElement>(null)

  function loadScript(src: string): Promise<void> {
    return new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return }
      const s = document.createElement('script'); s.src = src
      s.onload = () => res(); s.onerror = rej
      document.head.appendChild(s)
    })
  }

  function buildWebGL() {
    const canvas = webglRef.current; if (!canvas) return
    const T = (window as any).THREE; if (!T) return
    const W = window.innerWidth, H = window.innerHeight
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false })
    renderer.setSize(W, H); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor(0x020d07, 1)
    const scene = new T.Scene()
    const camera = new T.PerspectiveCamera(60, W / H, 0.1, 800); camera.position.z = 95
    const N = 120; const pos = new Float32Array(N * 3); const col = new Float32Array(N * 3)
    const greens = [[0.20,0.82,0.60],[0.06,0.73,0.51],[0.65,0.95,0.82]]
    for (let i = 0; i < N; i++) {
      const r = 100 + Math.random() * 130, theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1)
      pos[i*3]=r*Math.sin(phi)*Math.cos(theta); pos[i*3+1]=r*Math.sin(phi)*Math.sin(theta)*0.4; pos[i*3+2]=r*Math.cos(phi)-80
      const c = greens[Math.floor(Math.random() * 3)], b = 0.12 + Math.random() * 0.35
      col[i*3]=c[0]*b; col[i*3+1]=c[1]*b; col[i*3+2]=c[2]*b
    }
    const pGeo = new T.BufferGeometry()
    const makeTex = () => { const s=32,c=document.createElement('canvas'); c.width=s; c.height=s; const ctx=c.getContext('2d')!; const g=ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.4,'rgba(255,255,255,0.4)'); g.addColorStop(1,'rgba(255,255,255,0)'); ctx.fillStyle=g; ctx.fillRect(0,0,s,s); return new T.CanvasTexture(c) }
    pGeo.setAttribute('position', new T.BufferAttribute(pos, 3)); pGeo.setAttribute('color', new T.BufferAttribute(col, 3))
    scene.add(new T.Points(pGeo, new T.PointsMaterial({ size:1.6, map:makeTex(), vertexColors:true, transparent:true, opacity:0.45, sizeAttenuation:true, blending:T.AdditiveBlending, depthWrite:false, alphaTest:0.001 })))
    const knot = new T.Mesh(new T.TorusKnotGeometry(20,3.8,160,14,2,3), new T.MeshBasicMaterial({ color:0x34d399, wireframe:true, transparent:true, opacity:0.11, blending:T.AdditiveBlending, depthWrite:false }))
    knot.position.set(260,0,-40); scene.add(knot)
    const ring = new T.Mesh(new T.TorusGeometry(34,0.3,6,80), new T.MeshBasicMaterial({ color:0x10b981, transparent:true, opacity:0.07, blending:T.AdditiveBlending, depthWrite:false }))
    ring.rotation.x = Math.PI*0.42; ring.position.set(260,0,-40); scene.add(ring)
    let mx=0, my=0
    window.addEventListener('mousemove', e => { mx=(e.clientX/window.innerWidth-.5)*2; my=(e.clientY/window.innerHeight-.5)*2 })
    const onResize = () => { const w=window.innerWidth,h=window.innerHeight; renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix() }
    window.addEventListener('resize', onResize)
    const clock = new T.Clock(); let frame: number
    const tick = () => { frame=requestAnimationFrame(tick); const t=clock.getElapsedTime(); knot.rotation.x=t*0.12; knot.rotation.y=t*0.08; ring.rotation.z=t*0.05; camera.position.x+=(mx*8-camera.position.x)*0.02; camera.position.y+=(-my*5-camera.position.y)*0.02; camera.lookAt(0,0,0); renderer.render(scene,camera) }
    tick()
  }

  function buildCharts(Chart: any) {
    const gridColor='rgba(52,211,153,0.06)', tickColor='rgba(220,252,231,0.55)', tickFont={size:11,family:'Outfit'}
    const axisOpts = { grid:{color:gridColor,drawBorder:false}, ticks:{color:tickColor,font:tickFont,padding:8}, border:{color:'rgba(52,211,153,0.08)',dash:[4,4]} }
    const base = { responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{ backgroundColor:'rgba(2,13,7,0.97)', borderColor:'rgba(52,211,153,0.2)', borderWidth:1, titleColor:'#a7f3d0', bodyColor:'rgba(220,252,231,0.8)', cornerRadius:10, padding:12 } }, animation:{duration:1400,easing:'easeOutQuart'} }
    if (chartBarRef.current) new Chart(chartBarRef.current, { type:'bar', data:{ labels:['Manual','Basic AI','Atlantir'], datasets:[{ label:'Completion %', data:[56,68,94], backgroundColor:['rgba(5,150,105,0.25)','rgba(16,185,129,0.35)','rgba(52,211,153,0.55)'], borderColor:['#059669','#10b981','#34d399'], borderWidth:1.5, borderRadius:3, borderSkipped:false, barThickness:32 }] }, options:{...base, scales:{x:{...axisOpts},y:{...axisOpts,min:0,max:110,ticks:{...axisOpts.ticks,callback:(v:number)=>v+'%',stepSize:20}}}} })
    if (chartLineRef.current) new Chart(chartLineRef.current, { type:'line', data:{ labels:['Wk 1','Wk 2','Wk 3','Wk 4','Wk 5','Wk 6'], datasets:[{ label:'Hours saved', data:[2,4,6,9,11,14], borderColor:'#6ee7b7', backgroundColor:'rgba(110,231,183,0.05)', borderWidth:1.5, pointBackgroundColor:'#6ee7b7', pointBorderColor:'rgba(2,13,7,0.9)', pointBorderWidth:1.5, pointRadius:5, pointHoverRadius:7, fill:true, tension:0.4 }] }, options:{...base, scales:{x:{...axisOpts},y:{...axisOpts,min:0,max:16,ticks:{...axisOpts.ticks,callback:(v:number)=>v+'h',stepSize:4}}}} })
    if (chartAreaRef.current) new Chart(chartAreaRef.current, { type:'line', data:{ labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], datasets:[{ label:'With Atlantir', data:[80,120,180,250,340,480,640,820,1100,1500,1950,2400], borderColor:'#34d399', backgroundColor:'rgba(52,211,153,0.06)', borderWidth:1.5, pointBackgroundColor:'#34d399', pointBorderColor:'rgba(2,13,7,0.9)', pointBorderWidth:1.5, pointRadius:4, fill:true, tension:0.4 },{ label:'Without Atlantir', data:[80,90,100,105,110,118,122,128,134,140,148,155], borderColor:'rgba(52,211,153,0.4)', backgroundColor:'rgba(52,211,153,0.02)', borderWidth:1.2, borderDash:[6,4], pointBackgroundColor:'rgba(52,211,153,0.5)', pointRadius:3, fill:true, tension:0.4 }] }, options:{...base, scales:{x:{...axisOpts,ticks:{...axisOpts.ticks,maxTicksLimit:6}},y:{...axisOpts,min:0,ticks:{...axisOpts.ticks,callback:(v:number)=>v>=1000?(v/1000).toFixed(1)+'M':v+'K'}}}} })
  }

  useEffect(() => {
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js').then(buildWebGL)
    loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js').then(() => buildCharts((window as any).Chart))
  }, [])

  return (
    <div className="landing">
      <canvas ref={webglRef} className="bg-canvas" />

      <nav className="nav">
        <div className="nav-logo">
          <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
            <path d="M16 3L28 9.5V22.5L16 29L4 22.5V9.5L16 3Z" fill="rgba(52,211,153,0.12)" stroke="rgba(52,211,153,0.55)" strokeWidth="1.2"/>
            <path d="M16 8L24 12.5V20L16 24L8 20V12.5L16 8Z" fill="rgba(16,185,129,0.18)" stroke="rgba(16,185,129,0.75)" strokeWidth="0.8"/>
            <circle cx="16" cy="16" r="2.5" fill="#34d399"/>
          </svg>
          <span className="logo-text">Atlantir</span>
        </div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#performance">Performance</a>
          <a href="#pricing">Pricing</a>
          <a href="#about">About</a>
        </div>
        <div className="nav-cta">
          <Link href="/login" className="nav-signin">Sign in</Link>
          <Link href="/register" className="nav-signup">Get started free</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-left">
          <div className="hero-eyebrow"><span className="eyebrow-dot" />AI workspace · Built for teams</div>
          <h1 className="hero-title">The workspace where<br/><em className="hero-accent">agents get things done.</em></h1>
          <p className="hero-sub">Atlantir connects your meetings, tools and AI agents in one unified space. Speak a goal — your team researches, writes, executes and integrates automatically.</p>
          <div className="hero-btns">
            <Link href="/register" className="btn-primary">Start building free <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></Link>
            <Link href="/login" className="btn-ghost">Sign in →</Link>
          </div>
          <div className="hero-proof">
            <div className="proof-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>No credit card</div>
            <span className="proof-sep" />
            <div className="proof-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Enterprise-ready</div>
            <span className="proof-sep" />
            <div className="proof-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Up in 5 minutes</div>
          </div>
        </div>
        <div className="hero-right">
          <div className="hero-panel">
            <div className="panel-header"><span className="panel-dot" /><span className="panel-title">Live agent activity</span><span className="panel-badge">LIVE</span></div>
            <div className="panel-agents">
              {agents.map(a => (
                <div key={a.name} className="panel-agent">
                  <div className="pa-left"><span className="pa-dot" style={{ background: a.color, boxShadow: `0 0 8px ${a.color}80` }} /><div><div className="pa-name">{a.name}</div><div className="pa-role">{a.role}</div></div></div>
                  <div className="pa-bar-wrap"><div className="pa-bar" style={{ width: `${a.pct}%`, background: a.color }} /></div>
                  <span className="pa-pct">{a.pct}%</span>
                </div>
              ))}
            </div>
            <div className="panel-stats">
              {panelStats.map(s => <div key={s.label} className="ps-item"><span className="ps-num">{s.num}</span><span className="ps-label">{s.label}</span></div>)}
            </div>
          </div>
        </div>
      </section>

      <section className="agents-section">
        <p className="agents-label">Five agents. One unified workspace.</p>
        <div className="agents-row">
          {agents.map(a => (
            <div key={a.name} className="agent-pill" style={{ ['--ac' as any]: a.color }}>
              <span className="agent-dot" /><span className="agent-name">{a.name}</span><span className="agent-role">{a.role}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="page-section">
        <div className="eyebrow-tag">Capabilities</div>
        <h2 className="section-title">Everything connected.<br/><em className="title-accent">Everything automated.</em></h2>
        <div className="features-grid">
          {features.map(f => (
            <div key={f.title} className={`feat-card${f.wide ? ' wide' : ''}`}>
              <h3 className="feat-title">{f.title}</h3>
              <p className="feat-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="performance" className="page-section">
        <div className="eyebrow-tag">Performance</div>
        <h2 className="section-title">Real results.<br/><em className="title-accent">Measurable impact.</em></h2>
        <div className="charts-grid">
          <div className="chart-card"><div className="chart-meta"><h4 className="chart-title">Task Completion Rate</h4><p className="chart-sub">Average across all agent runs</p><div className="chart-stat"><span className="big-num">94%</span><span className="big-delta">+38%</span></div></div><div className="chart-wrap"><canvas ref={chartBarRef} /></div></div>
          <div className="chart-card"><div className="chart-meta"><h4 className="chart-title">Time Saved per Week</h4><p className="chart-sub">Per team member on average</p><div className="chart-stat"><span className="big-num">14h</span><span className="big-delta">+210%</span></div></div><div className="chart-wrap"><canvas ref={chartLineRef} /></div></div>
          <div className="chart-card chart-wide"><div className="chart-meta"><h4 className="chart-title">Agent Runs Over Time</h4><p className="chart-sub">Monthly executions across all workspaces</p><div className="chart-stat"><span className="big-num">2.4M</span><span className="big-delta">+320% YoY</span></div></div><div className="chart-wrap"><canvas ref={chartAreaRef} /></div></div>
        </div>
      </section>

      <section className="page-section">
        <div className="eyebrow-tag">Integrations</div>
        <p className="int-sub">22 integrations. More every week.</p>
        <div className="int-grid">{integrations.map(name => <span key={name} className="int-chip">{name}</span>)}</div>
      </section>

      <section id="pricing" className="page-section">
        <div className="eyebrow-tag">Pricing</div>
        <h2 className="section-title">Simple, honest pricing.</h2>
        <div className="pricing-grid">
          {plans.map(plan => (
            <div key={plan.name} className={`price-card${plan.featured ? ' featured' : ''}`}>
              {'badge' in plan && plan.badge && <div className="price-badge">{plan.badge}</div>}
              <div className="price-tier">{plan.name}</div>
              <div className="price-amount">{plan.price}{'sub' in plan && plan.sub && <span className="price-sub">{plan.sub}</span>}</div>
              <ul className="price-list">{plan.items.map(item => <li key={item}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>{item}</li>)}</ul>
              {'href' in plan && plan.href
                ? <Link href={plan.href} className={`price-btn${plan.featured ? ' primary' : ''}`}>{plan.cta}</Link>
                : <button className="price-btn" disabled>{plan.cta}</button>}
            </div>
          ))}
        </div>
      </section>

      <footer className="footer" style={{ marginLeft: '30%' }}>
        <div className="footer-brand"><svg width="16" height="16" viewBox="0 0 32 32" fill="none"><path d="M16 3L28 9.5V22.5L16 29L4 22.5V9.5L16 3Z" fill="rgba(52,211,153,0.15)" stroke="rgba(52,211,153,0.4)" strokeWidth="1"/></svg><span>Atlantir</span></div>
        <p>© {year} Atlantir. All rights reserved.</p>
      </footer>

      <style>{`
        :root { --g0:#34d399; --g1:#10b981; --g2:#059669; --g3:#a7f3d0; --g4:#6ee7b7; --dark:#020d07; --border:rgba(52,211,153,0.12); --border-hi:rgba(52,211,153,0.28); --text:#e8f5e9; --text-dim:#a7f3d0; --r:14px; }
        * { margin:0; padding:0; box-sizing:border-box; }
        html,body { background:#020d07 !important; scrollbar-width:thin; scrollbar-color:rgba(52,211,153,0.2) #020d07; }
        ::-webkit-scrollbar { width:6px; } ::-webkit-scrollbar-track { background:#020d07; } ::-webkit-scrollbar-thumb { background:rgba(52,211,153,0.18); border-radius:10px; }
      `}</style>
      <style>{`
        .landing { min-height:100vh; background:#020d07; color:#e8f5e9; font-family:'Inter',sans-serif; font-weight:300; overflow-x:hidden; position:relative; }
        .bg-canvas { position:fixed; inset:0; width:100%; height:100%; z-index:0; pointer-events:none; display:block; background:#020d07; }
        .nav { position:fixed; top:0; left:0; right:0; z-index:200; display:flex; align-items:center; justify-content:space-between; padding:14px 52px; background:rgba(2,13,7,0.9); backdrop-filter:blur(20px); border-bottom:1px solid var(--border); }
        .nav-logo { display:flex; align-items:center; gap:10px; font-family:serif; font-size:19px; font-weight:600; color:#e8f5e9; }
        .nav-links { display:flex; gap:28px; }
        .nav-links a { font-size:13px; color:#a7f3d0; text-decoration:none; transition:color .15s; } .nav-links a:hover { color:#34d399; }
        .nav-cta { display:flex; align-items:center; gap:12px; }
        .nav-signin { font-size:13px; color:#a7f3d0; text-decoration:none; } .nav-signin:hover { color:#e8f5e9; }
        .nav-signup { font-size:13px; font-weight:600; padding:8px 20px; border-radius:40px; background:#34d399; color:#020d07; text-decoration:none; transition:all .2s; } .nav-signup:hover { background:#a7f3d0; transform:translateY(-1px); }
        .hero { position:relative; z-index:10; min-height:100vh; display:flex; align-items:center; justify-content:space-between; gap:48px; padding:100px 60px 60px; max-width:1280px; margin:0 auto; }
        .hero-left { flex:1; max-width:580px; }
        .hero-eyebrow { display:flex; align-items:center; gap:10px; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:#34d399; margin-bottom:20px; font-weight:500; }
        .eyebrow-dot { width:7px; height:7px; border-radius:50%; background:#34d399; animation:pulse 2.4s ease-in-out infinite; }
        .hero-title { font-family:serif; font-size:clamp(38px,4.8vw,68px); font-weight:700; line-height:1.08; letter-spacing:-0.02em; color:#fff; margin-bottom:18px; }
        .hero-accent { font-style:italic; font-weight:500; color:#34d399; display:block; }
        .hero-sub { font-size:15.5px; font-weight:300; line-height:1.75; color:#a7f3d0; max-width:480px; margin-bottom:32px; }
        .hero-btns { display:flex; align-items:center; gap:14px; margin-bottom:28px; }
        .btn-primary { display:inline-flex; align-items:center; gap:9px; padding:13px 28px; border-radius:40px; background:#34d399; color:#020d07; font-size:14px; font-weight:600; text-decoration:none; transition:all .22s; } .btn-primary:hover { background:#a7f3d0; transform:translateY(-2px); }
        .btn-ghost { font-size:14px; color:#a7f3d0; text-decoration:none; } .btn-ghost:hover { color:#e8f5e9; }
        .hero-proof { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
        .proof-item { display:flex; align-items:center; gap:6px; font-size:12px; color:#a7f3d0; }
        .proof-sep { width:3px; height:3px; border-radius:50%; background:#6ee7b7; }
        .hero-right { flex-shrink:0; width:320px; }
        .hero-panel { background:rgba(4,18,9,0.9); border:1px solid var(--border-hi); border-radius:20px; padding:24px; backdrop-filter:blur(24px); box-shadow:0 24px 80px rgba(0,0,0,0.5); }
        .panel-header { display:flex; align-items:center; gap:8px; margin-bottom:18px; }
        .panel-dot { width:6px; height:6px; border-radius:50%; background:#34d399; animation:pulse 2s infinite; flex-shrink:0; }
        .panel-title { font-size:11.5px; color:#a7f3d0; flex:1; }
        .panel-badge { font-size:9px; font-weight:600; letter-spacing:0.1em; background:rgba(52,211,153,0.15); color:#34d399; border:1px solid rgba(52,211,153,0.25); border-radius:40px; padding:3px 9px; }
        .panel-agents { display:flex; flex-direction:column; gap:12px; margin-bottom:20px; }
        .panel-agent { display:flex; align-items:center; gap:12px; }
        .pa-left { display:flex; align-items:center; gap:10px; width:120px; flex-shrink:0; }
        .pa-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .pa-name { font-size:12.5px; font-weight:500; color:#e8f5e9; line-height:1.2; }
        .pa-role { font-size:10px; color:#6ee7b7; }
        .pa-bar-wrap { flex:1; height:3px; background:rgba(52,211,153,0.08); border-radius:4px; overflow:hidden; }
        .pa-bar { height:100%; border-radius:4px; }
        .pa-pct { font-size:11px; color:#a7f3d0; width:28px; text-align:right; flex-shrink:0; }
        .panel-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; padding-top:16px; border-top:1px solid var(--border); }
        .ps-item { display:flex; flex-direction:column; gap:3px; }
        .ps-num { font-family:serif; font-size:18px; font-weight:600; color:#34d399; line-height:1; }
        .ps-label { font-size:9px; color:#a7f3d0; letter-spacing:0.04em; }
        .agents-section { position:relative; z-index:10; display:flex; flex-direction:column; align-items:center; padding:0 24px 48px; gap:14px; }
        .agents-label { font-size:10.5px; letter-spacing:0.12em; text-transform:uppercase; color:#6ee7b7; font-weight:500; }
        .agents-row { display:flex; gap:8px; flex-wrap:wrap; justify-content:center; }
        .agent-pill { display:flex; align-items:center; gap:9px; padding:9px 18px; border-radius:40px; border:1px solid var(--border); background:rgba(4,18,9,0.7); backdrop-filter:blur(10px); }
        .agent-dot { width:7px; height:7px; border-radius:50%; background:var(--ac); box-shadow:0 0 8px var(--ac); flex-shrink:0; }
        .agent-name { font-family:serif; font-size:13.5px; font-weight:600; color:#e8f5e9; }
        .agent-role { font-size:11px; color:#a7f3d0; }
        .page-section { position:relative; z-index:10; padding:64px 60px; max-width:1200px; margin:0 auto; }
        .eyebrow-tag { font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.18em; color:#10b981; margin-bottom:12px; }
        .section-title { font-family:serif; font-size:clamp(26px,3vw,44px); font-weight:700; line-height:1.12; letter-spacing:-0.02em; color:#e8f5e9; margin-bottom:36px; }
        .title-accent { font-style:italic; font-weight:500; color:#34d399; }
        .features-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
        .feat-card { background:rgba(4,18,9,0.8); border:1px solid var(--border); border-radius:var(--r); padding:24px 20px; } .feat-card:hover { border-color:var(--border-hi); }
        .feat-card.wide { grid-column:span 2; }
        .feat-title { font-family:serif; font-size:17px; font-weight:600; color:#e8f5e9; margin-bottom:7px; }
        .feat-desc { font-size:13px; color:#a7f3d0; line-height:1.65; }
        .charts-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .chart-card { background:rgba(4,18,9,0.85); border:1px solid var(--border); border-radius:var(--r); padding:24px 22px; display:flex; flex-direction:column; }
        .chart-wide { grid-column:span 2; }
        .chart-title { font-family:serif; font-size:17px; font-weight:600; color:#e8f5e9; margin-bottom:3px; }
        .chart-sub { font-size:12px; color:#a7f3d0; margin-bottom:12px; }
        .chart-stat { display:flex; align-items:baseline; gap:10px; margin-bottom:16px; }
        .big-num { font-family:serif; font-size:34px; font-weight:700; color:#34d399; line-height:1; }
        .big-delta { font-size:11.5px; font-weight:500; color:#10b981; background:rgba(16,185,129,0.1); padding:3px 10px; border-radius:40px; border:1px solid rgba(16,185,129,0.18); }
        .chart-wrap { height:200px; position:relative; } .chart-wide .chart-wrap { height:220px; }
        .int-sub { font-size:13px; color:#a7f3d0; margin-bottom:16px; }
        .int-grid { display:flex; flex-wrap:wrap; gap:7px; }
        .int-chip { font-size:12px; padding:6px 14px; border-radius:40px; border:1px solid var(--border); color:#a7f3d0; background:rgba(4,18,9,0.7); } .int-chip:hover { border-color:var(--border-hi); color:#34d399; }
        .pricing-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
        .price-card { background:rgba(4,18,9,0.8); border:1px solid var(--border); border-radius:var(--r); padding:28px 24px; display:flex; flex-direction:column; gap:9px; position:relative; }
        .price-card.featured { border-color:rgba(52,211,153,0.28); background:rgba(52,211,153,0.04); }
        .price-badge { position:absolute; top:-1px; left:50%; transform:translateX(-50%); font-size:9px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; background:#34d399; color:#020d07; padding:4px 14px; border-radius:0 0 10px 10px; }
        .price-tier { font-size:10.5px; letter-spacing:0.12em; text-transform:uppercase; color:#a7f3d0; font-weight:500; margin-top:8px; }
        .price-amount { font-family:serif; font-size:32px; font-weight:700; color:#e8f5e9; line-height:1.1; margin:4px 0 10px; }
        .price-sub { font-family:sans-serif; font-size:13px; color:#a7f3d0; }
        .price-list { list-style:none; display:flex; flex-direction:column; gap:8px; margin-bottom:14px; }
        .price-list li { font-size:13px; color:#a7f3d0; display:flex; align-items:center; gap:9px; }
        .price-btn { display:block; text-align:center; text-decoration:none; padding:11px; border-radius:40px; font-size:13px; font-weight:500; border:1px solid var(--border-hi); color:#34d399; background:transparent; cursor:pointer; margin-top:auto; } .price-btn:hover:not(:disabled) { background:rgba(52,211,153,0.08); }
        .price-btn.primary { background:#34d399; color:#020d07; border-color:#34d399; } .price-btn.primary:hover { background:#a7f3d0; }
        .price-btn:disabled { opacity:0.25; cursor:not-allowed; }
        .footer { position:relative; z-index:10; border-top:1px solid var(--border); padding:20px 52px; display:flex; align-items:center; gap:20px; flex-wrap:wrap; }
        .footer-brand { display:flex; align-items:center; gap:8px; font-family:serif; font-size:14px; font-weight:600; color:#6ee7b7; }
        .footer > p { font-size:11.5px; color:#6ee7b7; flex:1; }
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(52,211,153,0.6)} 50%{box-shadow:0 0 0 9px rgba(52,211,153,0)} }
        @media(max-width:768px) { .nav{padding:12px 20px} .nav-links{display:none} .hero{flex-direction:column;padding:90px 20px 48px;gap:32px} .hero-right{width:100%;max-width:440px} .page-section{padding:48px 20px} .features-grid,.pricing-grid{grid-template-columns:1fr} .feat-card.wide{grid-column:span 1} .charts-grid{grid-template-columns:1fr} .chart-wide{grid-column:span 1} }
      `}</style>
    </div>
  )
}