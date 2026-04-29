export default function FilesLoading() {
  return (
    <div className="page-shell" aria-busy="true">
      <div className="page-header">
        <div><div className="sk sk-h" style={{width:80,height:20,marginBottom:8}} /><div className="sk sk-h" style={{width:220,height:14}} /></div>
        <div className="sk sk-h" style={{width:110,height:34,borderRadius:8}} />
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12}}>
        {[0,1,2,3,4,5,6,7].map(i=>(
          <div key={i} className="card" style={{padding:'16px',display:'flex',flexDirection:'column',gap:10}}>
            <div className="sk sk-h" style={{width:36,height:36,borderRadius:8}} />
            <div className="sk sk-h" style={{width:'80%',height:13}} />
            <div className="sk sk-h" style={{width:'50%',height:12}} />
          </div>
        ))}
      </div>
      <style>{`.sk{background:var(--surface-2);border-radius:6px;}.sk-h{animation:sk-pulse 1.4s ease-in-out infinite;}@keyframes sk-pulse{0%,100%{opacity:.5}50%{opacity:1}}`}</style>
    </div>
  )
}
