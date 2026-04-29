export default function MemoryLoading() {
  return (
    <div style={{display:'flex',height:'100%',overflow:'hidden',background:'var(--bg)'}} aria-busy="true">
      <aside style={{width:240,flexShrink:0,borderRight:'1px solid var(--border)',background:'var(--surface)',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'14px 14px 10px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div className="sk sk-h" style={{width:90,height:12}} />
          <div className="sk sk-h" style={{width:40,height:24,borderRadius:6}} />
        </div>
        <div style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:8}}>
          {[0,1,2,3,4].map(i=>(
            <div key={i} className="sk sk-h" style={{width:i%2===0?'75%':'55%',height:12}} />
          ))}
        </div>
      </aside>
      <main style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16}}>
        <div className="sk sk-h" style={{width:40,height:40,borderRadius:8}} />
        <div className="sk sk-h" style={{width:180,height:14}} />
      </main>
      <style>{`.sk{background:var(--surface-2);border-radius:6px;}.sk-h{animation:sk-pulse 1.4s ease-in-out infinite;}@keyframes sk-pulse{0%,100%{opacity:.5}50%{opacity:1}}`}</style>
    </div>
  )
}
