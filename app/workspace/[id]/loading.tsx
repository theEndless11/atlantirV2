export default function WorkspaceLoading() {
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', zIndex: 9999,
    }}>
      <svg width="36" height="36" viewBox="0 0 32 32" fill="none" style={{ marginBottom: 20 }}>
        <path d="M16 3L28 9.5V22.5L16 29L4 22.5V9.5L16 3Z" fill="url(#boot_logo)" opacity="0.9"/>
        <defs>
          <linearGradient id="boot_logo" x1="4" y1="3" x2="28" y2="29">
            <stop offset="0%" stopColor="#a78bfa"/>
            <stop offset="100%" stopColor="#6366f1"/>
          </linearGradient>
        </defs>
      </svg>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 140, 280].map(d => (
          <span key={d} style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
            opacity: 0.5,
            animation: `ws-pulse 1.2s ${d}ms ease-in-out infinite`,
          }}/>
        ))}
      </div>
      <style>{`
        @keyframes ws-pulse {
          0%, 80%, 100% { transform: scale(1); opacity: 0.35; }
          40% { transform: scale(1.4); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
