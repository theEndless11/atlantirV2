export default function DashboardLoading() {
  return (
    <div className="page-shell" aria-busy="true">
      <div className="page-header">
        <div><div className="sk sk-h" style={{width:160,height:20,marginBottom:8}} /><div className="sk sk-h" style={{width:110,height:14}} /></div>
        <div className="sk sk-h" style={{width:120,height:34,borderRadius:8}} />
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
        {[0,1,2,3].map(i=>(
          <div key={i} className="card" style={{padding:'18px 20px'}}>
            <div className="sk sk-h" style={{width:48,height:28,marginBottom:10}} />
            <div className="sk sk-h" style={{width:100,height:13,marginBottom:6}} />
            <div className="sk sk-h" style={{width:70,height:12}} />
          </div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        {[0,1,2,3].map(i=>(
          <div key={i} className="card" style={{padding:0,overflow:'hidden'}}>
            <div style={{padding:'14px 18px',borderBottom:'1px solid var(--border)'}}>
              <div className="sk sk-h" style={{width:90,height:14}} />
            </div>
            {[0,1,2,3].map(j=>(
              <div key={j} style={{padding:'9px 18px',borderBottom:'1px solid var(--border-soft)',display:'flex',gap:8,alignItems:'center'}}>
                <div className="sk sk-h" style={{flex:1,height:12}} />
                <div className="sk sk-h" style={{width:50,height:18,borderRadius:99}} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <style>{`.sk{background:var(--surface-2);border-radius:6px;}.sk-h{animation:sk-pulse 1.4s ease-in-out infinite;}@keyframes sk-pulse{0%,100%{opacity:.5}50%{opacity:1}}`}</style>
    </div>
  )
}
