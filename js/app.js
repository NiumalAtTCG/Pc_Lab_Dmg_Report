(function(){
'use strict';
var $=function(s){return document.querySelector(s)},$$=function(s){return Array.prototype.slice.call(document.querySelectorAll(s))};
var esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var KEY='labpc.v1',N=40;

/* Optional lab-wide admin password hash. Leave empty to let each browser set its own password.
   After signing in, copy the hash from Catalog & settings > Admin password and paste it between the quotes. */
var ADMIN_HASH='';
var SALT='labpc-admin-v1:';

var IDS=[];for(var i=1;i<=N;i++)IDS.push('PC-LAB-'+(i<10?'0':'')+i);
var CATS=['Display','Peripheral','Power','Hardware','OS/Software','Network'];
var FIELDS=[['model','Model'],['cpu','CPU'],['ram','RAM'],['storage','Storage'],['gpu','GPU'],['os','Operating system']];

/* Built-in catalog: 40 PCs, alternating Dell OptiPlex / HP ProDesk, every third unit is the i7 / 32 GB build */
var CATALOG={};
IDS.forEach(function(id,k){
  var n=k+1,hi=n%3===0,dell=n%2===1;
  CATALOG[id]={
    model:dell?(hi?'Dell OptiPlex 7090 Tower':'Dell OptiPlex 3090 SFF'):(hi?'HP ProDesk 600 G6 Tower':'HP ProDesk 400 G7 SFF'),
    cpu:hi?'Intel Core i7-12700':'Intel Core i5-12500',
    ram:hi?'32 GB DDR4':'16 GB DDR4',
    storage:hi?'1 TB NVMe SSD':'512 GB SATA SSD',
    gpu:hi?'NVIDIA GeForce GTX 1660 Super 6 GB':'Intel UHD Graphics 770',
    os:'Windows 11 Pro'
  };
});

var DEF={emails:[
  {a:'hirushasilva69@gmail.com',on:true},
  {a:'hirushasilva64@gmail.com',on:true},
  {a:'it.support@lab.example',on:false},
  {a:'it.technician@lab.example',on:false}],
  mode:'mailto',hook:{type:'formspree',url:''},base:'',specs:{},pw:''};
var S=load();
function clone(o){return JSON.parse(JSON.stringify(o))}
function load(){try{var s=JSON.parse(localStorage.getItem(KEY));if(s&&typeof s==='object'){var d=clone(DEF);for(var k in s)d[k]=s[k];return d}}catch(e){}return clone(DEF)}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));return true}catch(e){return false}}
function spec(id){var o={},b=CATALOG[id]||{},v=S.specs[id]||{};for(var k in b)o[k]=v[k]!=null&&v[k]!==''?v[k]:b[k];return o}
function baseUrl(){return (S.base||location.origin+location.pathname).split('#')[0].split('?')[0]}
function show(el,type,text){el.className='msg '+type;el.textContent=text}
function hide(el){el.className='msg';el.textContent=''}
var EMAIL=/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/* Admin auth */
var AUTH={qr:1,admin:1},pending='qr',unlocked=false,fails=0,until=0,idleT;
function storedHash(){return ADMIN_HASH||S.pw||''}
function sha(t){return crypto.subtle.digest('SHA-256',new TextEncoder().encode(SALT+t)).then(function(b){return Array.prototype.map.call(new Uint8Array(b),function(x){return ('0'+x.toString(16)).slice(-2)}).join('')})}
function canHash(){return !!(window.crypto&&crypto.subtle)}
function armIdle(){clearTimeout(idleT);if(unlocked)idleT=setTimeout(lock,600000)}
['click','keydown','touchstart'].forEach(function(t){document.addEventListener(t,armIdle,{passive:true})});
function openGate(){
  var setup=!storedHash();
  $('#gateTitle').textContent=setup?'Create admin password':'Admin sign in';
  $('#gateHint').textContent=setup?'No admin password is set yet. Choose one with at least 8 characters.':'Sign in to print QR stickers and edit PC details.';
  $('#gconfWrap').hidden=!setup;
  $('#gateBtn').textContent=setup?'Create password':'Sign in';
  $('#gpw').autocomplete=setup?'new-password':'current-password';
  $('#gpw').value='';$('#gpw2').value='';hide($('#gmsg'));
  setTimeout(function(){$('#gpw').focus()},0);
}
function refreshAuthUI(){
  $('#hashOut').value=storedHash();
  $('#pwChangeWrap').hidden=!!ADMIN_HASH;
  $('#hashNote').textContent=ADMIN_HASH?'This site uses a lab-wide password set in ADMIN_HASH. To change it, replace that value in the file and redeploy.':'By default the password is saved in this browser only. To use one password on every device, paste this hash into ADMIN_HASH near the top of the script and redeploy.';
}
function enter(){unlocked=true;$('#gpw').value='';$('#gpw2').value='';$('#logout').hidden=false;armIdle();refreshAuthUI();tab(pending)}
function lock(){
  unlocked=false;clearTimeout(idleT);$('#logout').hidden=true;
  var cur=$$('.pane.on')[0];if(cur&&AUTH[cur.id])tab('report');
}
$('#logout').addEventListener('click',function(){lock();tab('report')});
$('#gateForm').addEventListener('submit',function(e){
  e.preventDefault();
  var m=$('#gmsg'),pw=$('#gpw').value,setup=!storedHash();
  if(!canHash()){show(m,'err','Sign-in needs a secure page. Open this site through its https:// address.');return}
  var wait=Math.ceil((until-Date.now())/1000);
  if(wait>0){show(m,'err','Too many attempts. Try again in '+wait+' seconds.');return}
  if(setup){
    if(pw.length<8){show(m,'err','Use at least 8 characters.');return}
    if(pw!==$('#gpw2').value){show(m,'err','The two passwords do not match.');return}
    sha(pw).then(function(h){S.pw=h;if(!save()){show(m,'err','Could not save the password in this browser.');return}enter()});
    return;
  }
  sha(pw).then(function(h){
    if(h===storedHash()){fails=0;enter()}
    else{fails++;if(fails>=5)until=Date.now()+30000*(fails-4);show(m,'err','Wrong password.');$('#gpw').select()}
  });
});
$('#chgPw').addEventListener('click',function(){
  var m=$('#pmsg'),a=$('#npw').value;
  if(!canHash()){show(m,'err','Changing the password needs an https:// page.');return}
  if(a.length<8){show(m,'err','Use at least 8 characters.');return}
  if(a!==$('#npw2').value){show(m,'err','The two passwords do not match.');return}
  sha(a).then(function(h){S.pw=h;if(!save()){show(m,'err','Could not save the password in this browser.');return}$('#npw').value='';$('#npw2').value='';refreshAuthUI();show(m,'ok','Password changed.')});
});
$('#copyHash').addEventListener('click',function(){
  var el=$('#hashOut');el.select();
  try{navigator.clipboard.writeText(el.value)}catch(e){document.execCommand('copy')}
  show($('#pmsg'),'ok','Hash copied.');
});

/* Tabs */
var qrDirty=true;
function tab(name){
  var shown=name;
  if(AUTH[name]&&!unlocked){pending=name;shown='gate';openGate()}
  $$('nav button[data-tab]').forEach(function(b){b.classList.toggle('on',b.dataset.tab===name)});
  $$('.pane').forEach(function(p){p.classList.toggle('on',p.id===shown)});
  if(shown==='qr'&&qrDirty)renderQR();
}
$$('nav button[data-tab]').forEach(function(b){b.addEventListener('click',function(){tab(b.dataset.tab)})});

/* Report tab */
var params=new URLSearchParams(location.search),qid=(params.get('id')||'').trim().toUpperCase();
var sel,extra=[],busy=false;
function fillSelect(el){el.innerHTML=IDS.map(function(id){return '<option>'+id+'</option>'}).join('')}
fillSelect($('#pc'));fillSelect($('#apc'));
if(qid){if(CATALOG[qid])$('#pc').value=qid;else{show($('#idwarn'),'err','PC "'+qid+'" is not in the catalog. Pick the correct PC below.')}}
function renderSpecs(){var s=spec($('#pc').value);$('#specs').innerHTML=FIELDS.map(function(f){return '<dt>'+f[1]+'</dt><dd>'+esc(s[f[0]])+'</dd>'}).join('')}
$('#pc').addEventListener('change',renderSpecs);
$('#cats').innerHTML=CATS.map(function(c){return '<label class="chip"><input type="radio" name="cat" value="'+esc(c)+'"><span>'+esc(c)+'</span></label>'}).join('');

function resetSel(){sel=new Set(S.emails.filter(function(e){return e.on}).map(function(e){return e.a}));extra=[]}
function allRecips(){var l=S.emails.map(function(e){return e.a});extra.forEach(function(a){if(l.indexOf(a)<0)l.push(a)});return l}
function renderRecips(){
  var l=allRecips();
  $('#recips').innerHTML=l.map(function(a){return '<label class="rec"><input type="checkbox" data-a="'+esc(a)+'"'+(sel.has(a)?' checked':'')+'> <span>'+esc(a)+'</span></label>'}).join('')||'<p class="small">No recipients yet. Add one below.</p>';
  $('#count').textContent=sel.size+' selected';
}
$('#recips').addEventListener('change',function(e){var a=e.target.dataset.a;if(a==null)return;e.target.checked?sel.add(a):sel['delete'](a);$('#count').textContent=sel.size+' selected'});
function addCustom(){
  var el=$('#custom'),v=el.value.trim().toLowerCase(),m=$('#msg');
  if(!v)return;
  if(!EMAIL.test(v)){show(m,'err','Enter a valid email address, like name@example.com.');return}
  hide(m);if(allRecips().map(function(x){return x.toLowerCase()}).indexOf(v)<0)extra.push(v);
  var exact=allRecips().filter(function(x){return x.toLowerCase()===v})[0];sel.add(exact);el.value='';renderRecips();
}
$('#addCustom').addEventListener('click',addCustom);
$('#custom').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();addCustom()}});

function buildReport(p){
  var s=p.specs;
  return '# Lab PC Damage Report\n\n'+
  '**PC ID:** '+p.pc_id+'\n**Category:** '+p.category+'\n**Reported:** '+p.timestamp+'\n**Reporter:** '+(p.reporter||'Not given')+'\n\n'+
  '## Hardware\n'+FIELDS.map(function(f){return '- '+f[1]+': '+s[f[0]]}).join('\n')+'\n\n'+
  '## Remarks\n'+p.remarks+'\n';
}
function unlock(){busy=false;var b=$('#send');b.disabled=false;b.textContent='Send report'}
function resetForm(){$('#remarks').value='';$('#reporter').value='';$$('input[name=cat]').forEach(function(r){r.checked=false})}
$('#form').addEventListener('submit',function(e){
  e.preventDefault();
  if(busy)return;
  var m=$('#msg');
  if($('#website').value){busy=true;$('#send').disabled=true;show(m,'ok','Report sent.');return} /* honeypot */
  var cat=$('input[name=cat]:checked'),remarks=$('#remarks').value.trim(),to=allRecips().filter(function(a){return sel.has(a)});
  if(!cat){show(m,'err','Choose a damage category.');return}
  if(remarks.length<5){show(m,'err','Describe the problem in the remarks box.');return}
  if(!to.length){show(m,'err','Select at least one recipient.');return}
  var id=$('#pc').value,now=new Date();
  var p={pc_id:id,category:cat.value,reporter:$('#reporter').value.trim(),remarks:remarks,specs:spec(id),timestamp:now.toLocaleString()+' ('+Intl.DateTimeFormat().resolvedOptions().timeZone+')',recipients:to};
  p.subject='[Lab PC Damage] '+id+' - '+p.category;p.message=buildReport(p);
  busy=true;var b=$('#send');b.disabled=true;b.textContent='Sending...';hide(m);
  if(S.mode==='webhook'){
    if(!S.hook.url){show(m,'err','Webhook URL is missing. Ask an admin to add it under Catalog & settings.');unlock();return}
    var opt=S.hook.type==='apps'
      ?{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(p)}
      :{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(p)};
    fetch(S.hook.url,opt).then(function(r){
      if(S.hook.type!=='apps'&&!r.ok)throw new Error('HTTP '+r.status);
      show(m,'ok','Report sent to '+to.length+' recipient'+(to.length>1?'s':'')+'.');resetForm();setTimeout(unlock,4000);
    }).catch(function(){show(m,'err','Could not send the report. Check your connection and try again.');unlock()});
  }else{
    var url='mailto:'+encodeURIComponent(to[0]).replace(/%40/g,'@')+'?'+
      (to.length>1?'cc='+to.slice(1).map(function(a){return encodeURIComponent(a).replace(/%40/g,'@')}).join(',')+'&':'')+
      'subject='+encodeURIComponent(p.subject)+'&body='+encodeURIComponent(p.message);
    window.location.href=url;
    setTimeout(function(){show(m,'ok','Your mail app should be open. Press Send there to finish.');resetForm();setTimeout(unlock,3000)},600);
  }
});

/* QR tab */
function renderQR(){
  var g=$('#sheet');
  $('#qrurl').textContent=baseUrl()+'?id=PC-LAB-01';
  if(typeof QRCode==='undefined'){g.innerHTML='<div class="card">The QR library could not load. Check your connection and reopen this tab.</div>';return}
  g.innerHTML='';
  IDS.forEach(function(id){
    var d=document.createElement('div');d.className='badgebox';
    d.innerHTML='<b>'+id+'</b><div class="qr"></div><small>Scan to Report Damage</small>';
    g.appendChild(d);
    new QRCode(d.querySelector('.qr'),{text:baseUrl()+'?id='+id,width:256,height:256,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
  });
  qrDirty=false;
}
$('#print').addEventListener('click',function(){if(qrDirty)renderQR();window.print()});

/* Admin: specs */
function renderAdminSpec(){
  var s=spec($('#apc').value);
  $('#afields').innerHTML=FIELDS.map(function(f){return '<div><label for="f_'+f[0]+'">'+f[1]+'</label><input type="text" id="f_'+f[0]+'" value="'+esc(s[f[0]])+'"></div>'}).join('');
}
$('#apc').addEventListener('change',renderAdminSpec);
$('#saveSpec').addEventListener('click',function(){
  var id=$('#apc').value,o={};
  FIELDS.forEach(function(f){var v=$('#f_'+f[0]).value.trim();if(v&&v!==CATALOG[id][f[0]])o[f[0]]=v});
  if(Object.keys(o).length)S.specs[id]=o;else delete S.specs[id];
  var ok=save();show($('#amsg'),ok?'ok':'err',ok?id+' saved.':'Could not save in this browser.');renderSpecs();
});
$('#resetSpec').addEventListener('click',function(){var id=$('#apc').value;delete S.specs[id];save();renderAdminSpec();renderSpecs();show($('#amsg'),'ok',id+' reset to defaults.')});
$('#resetAll').addEventListener('click',function(){if(!confirm('Reset all 40 PCs to the built-in specs?'))return;S.specs={};save();renderAdminSpec();renderSpecs();show($('#amsg'),'ok','All PCs reset to defaults.')});

/* Admin: recipients + settings */
var rows=[];
function renderRows(){
  $('#rlist').innerHTML=rows.map(function(r,i){return '<div class="row" style="align-items:center;margin-bottom:6px"><input type="checkbox" data-i="'+i+'" data-k="on" style="flex:none;width:20px;height:20px"'+(r.on?' checked':'')+' aria-label="Pre-select"><input type="email" data-i="'+i+'" data-k="a" value="'+esc(r.a)+'" aria-label="Email"><button type="button" class="btn alt" data-del="'+i+'">Remove</button></div>'}).join('');
}
$('#rlist').addEventListener('input',function(e){var t=e.target,i=t.dataset.i;if(i==null)return;rows[i][t.dataset.k]=t.type==='checkbox'?t.checked:t.value});
$('#rlist').addEventListener('click',function(e){var d=e.target.dataset.del;if(d==null)return;rows.splice(+d,1);renderRows()});
$('#addRow').addEventListener('click',function(){rows.push({a:'',on:false});renderRows()});
function syncHook(){$('#hookbox').style.display=document.querySelector('input[name=mode]:checked').value==='webhook'?'block':'none'}
$$('input[name=mode]').forEach(function(r){r.addEventListener('change',syncHook)});
function loadSettings(){
  rows=S.emails.map(function(e){return{a:e.a,on:e.on}});renderRows();
  document.querySelector('input[name=mode][value='+S.mode+']').checked=true;
  $('#htype').value=S.hook.type;$('#hurl').value=S.hook.url;$('#base').value=S.base;syncHook();
}
$('#saveSet').addEventListener('click',function(){
  var m=$('#smsg'),clean=[],seen={};
  for(var i=0;i<rows.length;i++){var a=rows[i].a.trim();if(!a)continue;if(!EMAIL.test(a)){show(m,'err','"'+a+'" is not a valid email address.');return}if(seen[a.toLowerCase()])continue;seen[a.toLowerCase()]=1;clean.push({a:a,on:!!rows[i].on})}
  var mode=document.querySelector('input[name=mode]:checked').value,url=$('#hurl').value.trim(),base=$('#base').value.trim();
  if(mode==='webhook'&&!/^https:\/\//i.test(url)){show(m,'err','Enter a webhook URL that starts with https://');return}
  if(base&&!/^https?:\/\//i.test(base)){show(m,'err','The site address must start with https://');return}
  var baseChanged=base!==S.base;
  S.emails=clean;S.mode=mode;S.hook={type:$('#htype').value,url:url};S.base=base.replace(/\/+$/,base.indexOf('?')>-1?'':'/');
  if(!save()){show(m,'err','Could not save in this browser.');return}
  if(baseChanged)qrDirty=true;
  resetSel();renderRecips();loadSettings();show(m,'ok','Settings saved.');
});

/* Init */
resetSel();renderRecips();renderSpecs();renderAdminSpec();loadSettings();refreshAuthUI();
})();
