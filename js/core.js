'use strict';
var $=function(s){return document.querySelector(s)},$$=function(s){return Array.prototype.slice.call(document.querySelectorAll(s))};
var esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var KEY='labpc.v1',N=40;
var ADMIN_HASH='';
var SALT='labpc-admin-v1:';

var IDS=[];for(var i=1;i<=N;i++)IDS.push('PC-LAB-'+(i<10?'0':'')+i);
var CATS=['Display','Peripheral','Power','Hardware','OS/Software','Network'];
var FIELDS=[['model','Model'],['cpu','CPU'],['ram','RAM'],['storage','Storage'],['gpu','GPU'],['os','Operating system']];

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

function clone(o){return JSON.parse(JSON.stringify(o))}
function load(){try{var s=JSON.parse(localStorage.getItem(KEY));if(s&&typeof s==='object'){var d=clone(DEF);for(var k in s)d[k]=s[k];return d}}catch(e){}return clone(DEF)}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));return true}catch(e){return false}}
var S=load();

function spec(id){var o={},b=CATALOG[id]||{},v=S.specs[id]||{};for(var k in b)o[k]=v[k]!=null&&v[k]!==''?v[k]:b[k];return o}
function baseUrl(){return (S.base||location.origin+location.pathname).split('#')[0].split('?')[0]}
function show(el,type,text){el.className='msg '+type;el.textContent=text}
function hide(el){el.className='msg';el.textContent=''}
var EMAIL=/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/* Auth */
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
