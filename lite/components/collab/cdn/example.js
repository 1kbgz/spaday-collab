document.addEventListener("spaday:wire-client",({detail:{namespace:r,store:e}})=>{if(r!=="document")return;let n=()=>e.set("pointers",(e.get("remote_activity")??[]).map(({peer:i,state:t})=>({peer:i,pointer:t?.pointer,label:t?.label,color:t?.color}))),o=e.subscribe("remote_activity",n);n(),window.addEventListener("pagehide",i=>{i.persisted||o()})});
//# sourceMappingURL=example.js.map
