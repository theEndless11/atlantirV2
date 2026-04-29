export default function Loading() {
  return (
    <div className="page-shell" aria-busy="true">
      <div className="page-header">
        <div>
          <div className="sk sk-h" style={{width:130,height:20,marginBottom:8}} />
          <div className="sk sk-h" style={{width:200,height:14}} />
        </div>
        <div className="sk sk-h" style={{width:110,height:34,borderRadius:8}} />
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {[0,1,2,3,4,5].map(i=>(
          <div key={i} className="card" style={{padding:'14px 18px',display:'flex',alignItems:'center',gap:12}}>
            <div className="sk sk-circle" style={{width:32,height:32,flexShrink:0}} />
            <div style={{flex:1,display:'flex',flexDirection:'column',gap:6}}>
              <div className="sk sk-h" style={{width:'60%',height:14}} />
              <div className="sk sk-h" style={{width:'35%',height:12}} />
            </div>
            <div className="sk sk-h" style={{width:70,height:24,borderRadius:99}} />
          </div>
        ))}
      </div>
      <style>{`.sk{background:var(--surface-2);border-radius:6px;}.sk-circle{border-radius:50%;}.sk-h{animation:sk-pulse 1.4s ease-in-out infinite;}@keyframes sk-pulse{0%,100%{opacity:.5}50%{opacity:1}}`}</style>
    </div>
  )
}
