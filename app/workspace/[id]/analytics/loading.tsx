export default function AnalyticsLoading() {
  return (
    <div className="page-shell" aria-busy="true">
      <div className="page-header">
        <div><div className="sk sk-h" style={{width:120,height:20,marginBottom:8}} /><div className="sk sk-h" style={{width:240,height:14}} /></div>
        <div className="sk sk-h" style={{width:120,height:34,borderRadius:8}} />
      </div>
      <div style={{maxWidth:860,margin:'0 auto',width:'100%'}}>
        <div className="sk sk-h" style={{width:80,height:12,marginBottom:14,marginTop:32}} />
        {[0,1,2,3,4,5].map(i=>(
          <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 0'}}>
            <div className="sk sk-h" style={{width:160,height:15}} />
            <div className="sk sk-h" style={{width:60,height:15}} />
          </div>
        ))}
        <div className="sk sk-h" style={{width:100,height:12,marginBottom:14,marginTop:32}} />
        {[0,1,2,3,4].map(i=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'220px 160px 1fr auto',gap:16,alignItems:'center',padding:'7px 0'}}>
            <div className="sk sk-h" style={{height:15}} />
            <div className="sk sk-h" style={{height:13}} />
            <div className="sk sk-h" style={{height:13}} />
            <div className="sk sk-h" style={{width:80,height:15}} />
          </div>
        ))}
        <div className="sk sk-h" style={{width:130,height:12,marginBottom:14,marginTop:32}} />
        <div style={{display:'flex',gap:8,height:110,alignItems:'flex-end'}}>
          {Array.from({length:30}).map((_,i)=>(
            <div key={i} className="sk sk-h" style={{flex:1,height:Math.random()*80+10+'%',borderRadius:'3px 3px 0 0',animation:'none',opacity:0.3+Math.random()*0.4}} />
          ))}
        </div>
      </div>
      <style>{`.sk{background:var(--surface-2);border-radius:6px;}.sk-h{animation:sk-pulse 1.4s ease-in-out infinite;}@keyframes sk-pulse{0%,100%{opacity:.5}50%{opacity:1}}`}</style>
    </div>
  )
}
