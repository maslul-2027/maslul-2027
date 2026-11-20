'use strict';
/** One original functional UI + one engine; no iframe, no duplicate fixtures. */
function makeUnifiedMobileHtml(original) {
 if(!original.includes('<body>')||!original.includes('</head>'))throw Error('Unexpected source');
 const head='<link rel="manifest" href="./manifest.webmanifest"><link rel="icon" href="./icon.svg" type="image/svg+xml"><meta name="theme-color" content="#ffffff"><link rel="stylesheet" href="./design.css"><link rel="stylesheet" href="./course-design.css"><link rel="stylesheet" href="./mobile-shell.css">';
 const banner='<script src="./course-engine.js"></script><a href="#view" class="mobile-skip">דלג לתוכן</a><div class="mobile-demo-banner" role="status">MASLUL 2027 · הדגמה סינתטית בלבד · ללא נתוני אמת · השינויים יתאפסו ברענון</div>';
 const footer='<nav class="mobile-bottom-nav" id="mobile-navigation" aria-label="ניווט מהיר">'
 +'<button type="button" data-mobile-route="dash" aria-current="page"><span aria-hidden="true">⌂</span>בית</button>'
 +'<button type="button" data-mobile-route="soldiers"><span aria-hidden="true">♙</span>חניכים</button>'
 +'<button type="button" data-mobile-route="attendance"><span aria-hidden="true">✓</span>נוכחות</button>'
 +'<button type="button" data-mobile-route="more" aria-haspopup="true" aria-controls="side"><span aria-hidden="true">☷</span>עוד</button></nav>'
 +'<script>(function(){var nav=document.getElementById("mobile-navigation");'
 +'nav.addEventListener("click",function(e){var b=e.target.closest("button[data-mobile-route]");if(!b)return;var route=b.dataset.mobileRoute;'
 +'if(route==="more"){document.getElementById("menuBtn").click();return;}'
 +'if(typeof showTab!=="function"||typeof S==="undefined"||!S.courseId)return;'
 +'showTab(route);Array.prototype.forEach.call(nav.querySelectorAll("button"),function(n){if(n.dataset.mobileRoute===route)n.setAttribute("aria-current","page");else n.removeAttribute("aria-current");});window.scrollTo(0,0);});'
 +'var view=document.getElementById("view");new MutationObserver(function(){if(typeof S==="undefined"||!S.tab)return;Array.prototype.forEach.call(nav.querySelectorAll("button"),function(n){if(n.dataset.mobileRoute===S.tab)n.setAttribute("aria-current","page");else n.removeAttribute("aria-current");});}).observe(view,{childList:true,subtree:false});'
 +'if("serviceWorker" in navigator)window.addEventListener("load",function(){navigator.serviceWorker.register("./sw.js",{updateViaCache:"none"}).catch(function(){});});'
 +'})();</script>';
 return original.replace('</head>',head+'</head>').replace('<body>','<body>'+banner).replace('</body>',footer+'</body>');
}
module.exports={makeUnifiedMobileHtml};
