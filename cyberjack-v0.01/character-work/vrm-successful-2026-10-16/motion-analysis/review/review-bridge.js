// Loaded only by the review server for the explicit motionReview iframe.
const query=new URLSearchParams(location.search),id=query.get('reviewClip');let stopped=false;
const css=document.createElement('style');css.textContent='.topbar,.sidebar,.transport,.viewport-toolbar,.ws-toolbar,.workspace-nav,.bottom-bar{display:none!important}.workspace{display:block!important;height:100vh!important}.viewport{height:100vh!important;width:100%!important}body{overflow:hidden!important}';document.head.append(css);
const send=error=>parent.postMessage({type:'motion-review-ready',error},location.origin);
const timer=setInterval(async()=>{const s=window.__studio;if(stopped||!s?.ready||!s.library)return;stopped=true;clearInterval(timer);try{await s.library.selectClip(id);s.frameLinkedPose?.();send(null)}catch(e){send(e.message)}},500);
setTimeout(()=>{if(!stopped){clearInterval(timer);send('VRM не успел загрузиться. Исходный скелет доступен отдельно.')}},180000);
window.addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin||e.data?.type!=='motion-review-transport'||!window.__studio?.ready)return;const s=window.__studio,t=document.querySelector('#timeline');if(t){t.value=String(e.data.time||0);t.dispatchEvent(new Event('input'))}s.setPlaying(Boolean(e.data.playing));const speed=document.querySelector('#speed');if(speed)speed.value=String(e.data.speed||1)});
setInterval(()=>{const s=window.__studio;if(!stopped||!s?.ready)return;parent.postMessage({type:'motion-review-time',time:s.state.clipTime,playing:s.state.playing},location.origin)},250);
let repeat=true;
window.addEventListener('message',e=>{if(e.source===parent&&e.origin===location.origin&&e.data?.type==='motion-review-transport')repeat=Boolean(e.data.loop)});
function stopAtEnd(){requestAnimationFrame(stopAtEnd);const s=window.__studio,c=s?.currentClip?.();if(!repeat&&c&&s.state.playing&&c.duration-s.state.clipTime<.06){s.setPlaying(false);const t=document.querySelector('#timeline');if(t){t.value=String(c.duration);t.dispatchEvent(new Event('input'))}}}requestAnimationFrame(stopAtEnd);
