'use strict';
var $=function(s){return document.querySelector(s)},$$=function(s){return Array.prototype.slice.call(document.querySelectorAll(s))};
var esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var KEY='labpc.v1';
var LAB_KEY='pc_lab_config';
var LAB_VER_KEY='pc_lab_ver';
var LAB_VER=2; /* bump this whenever default labs/catalog change */

var IDS=[];

/* Dynamic lab config */
var DEFAULT_LABS=[{name:'Lab A',count:6},{name:'Lab B',count:6},{name:'Lab C',count:4}];
function loadLabs(){
  /* If stored version is outdated, wipe and reseed with current defaults */
  var ver=parseInt(localStorage.getItem(LAB_VER_KEY))||0;
  if(ver<LAB_VER){localStorage.removeItem(LAB_KEY);localStorage.removeItem(KEY);localStorage.setItem(LAB_VER_KEY,LAB_VER);}
  try{var d=JSON.parse(localStorage.getItem(LAB_KEY));if(Array.isArray(d)&&d.length)return d;}catch(e){}
  return DEFAULT_LABS;
}
function saveLabs(labs){try{localStorage.setItem(LAB_KEY,JSON.stringify(labs));return true;}catch(e){return false;}}
function getPCsForLab(lab){var pcs=[];for(var i=1;i<=lab.count;i++)pcs.push(lab.name+' - PC-'+(i<10?'0':'')+i);return pcs;}
function getAllLabPCs(){var all=[];loadLabs().forEach(function(l){getPCsForLab(l).forEach(function(pc){all.push({lab:l.name,pc:pc});});});return all;}

var CATS=['Display','Peripheral','Power','Hardware','OS/Software','Network'];
var FIELDS=[['model','Model'],['cpu','CPU'],['ram','RAM'],['storage','Storage'],['gpu','GPU'],['os','Operating system'],['pcSerial','PC Serial Number'],['monitorSerial','Monitor Serial Number']];

/* ── Dummy catalog data ── */
var CATALOG={
  /* ── Lab A ── */
  'Lab A - PC-01':{model:'Dell OptiPlex 7090 Tower',    cpu:'Intel Core i7-10700',   ram:'16 GB DDR4', storage:'512 GB NVMe SSD', gpu:'Intel UHD Graphics 630',          os:'Windows 11 Pro', pcSerial:'DLLA7090-001', monitorSerial:'DLLU2422H-001'},
  'Lab A - PC-02':{model:'Dell OptiPlex 7090 Tower',    cpu:'Intel Core i7-10700',   ram:'16 GB DDR4', storage:'512 GB NVMe SSD', gpu:'Intel UHD Graphics 630',          os:'Windows 11 Pro', pcSerial:'DLLA7090-002', monitorSerial:'DLLU2422H-002'},
  'Lab A - PC-03':{model:'Dell OptiPlex 3090 SFF',      cpu:'Intel Core i5-10500T',  ram:'8 GB DDR4',  storage:'256 GB SATA SSD', gpu:'Intel UHD Graphics 630',          os:'Windows 10 Pro', pcSerial:'DLLA3090-003', monitorSerial:'DLLS2422H-003'},
  'Lab A - PC-04':{model:'Dell OptiPlex 3090 SFF',      cpu:'Intel Core i5-10500T',  ram:'8 GB DDR4',  storage:'256 GB SATA SSD', gpu:'Intel UHD Graphics 630',          os:'Windows 10 Pro', pcSerial:'DLLA3090-004', monitorSerial:'DLLS2422H-004'},
  'Lab A - PC-05':{model:'HP ProDesk 600 G6 MT',        cpu:'Intel Core i5-10500',   ram:'16 GB DDR4', storage:'512 GB NVMe SSD', gpu:'Intel UHD Graphics 630',          os:'Windows 11 Pro', pcSerial:'HPAPD600-005', monitorSerial:'HPP24H-005'},
  'Lab A - PC-06':{model:'HP ProDesk 600 G6 MT',        cpu:'Intel Core i5-10500',   ram:'16 GB DDR4', storage:'512 GB NVMe SSD', gpu:'Intel UHD Graphics 630',          os:'Windows 11 Pro', pcSerial:'HPAPD600-006', monitorSerial:'HPP24H-006'},

  /* ── Lab B ── */
  'Lab B - PC-01':{model:'Dell OptiPlex 5090 Tower',    cpu:'Intel Core i5-10505',   ram:'16 GB DDR4', storage:'512 GB NVMe SSD', gpu:'NVIDIA GeForce GT 730 2 GB',      os:'Windows 11 Pro', pcSerial:'DLLB5090-001', monitorSerial:'DLLU2422H-101'},
  'Lab B - PC-02':{model:'Dell OptiPlex 5090 Tower',    cpu:'Intel Core i5-10505',   ram:'16 GB DDR4', storage:'512 GB NVMe SSD', gpu:'NVIDIA GeForce GT 730 2 GB',      os:'Windows 11 Pro', pcSerial:'DLLB5090-002', monitorSerial:'DLLU2422H-102'},
  'Lab B - PC-03':{model:'Dell OptiPlex 5090 Tower',    cpu:'Intel Core i5-10505',   ram:'32 GB DDR4', storage:'1 TB NVMe SSD',   gpu:'NVIDIA GeForce GTX 1650 4 GB',   os:'Windows 11 Pro', pcSerial:'DLLB5090-003', monitorSerial:'DLLU2422H-103'},
  'Lab B - PC-04':{model:'HP EliteDesk 800 G6 Tower',   cpu:'Intel Core i7-10700',   ram:'32 GB DDR4', storage:'1 TB NVMe SSD',   gpu:'NVIDIA GeForce GTX 1650 4 GB',   os:'Windows 11 Pro', pcSerial:'HPBED800-004', monitorSerial:'HPE24H-104'},
  'Lab B - PC-05':{model:'HP EliteDesk 800 G6 Tower',   cpu:'Intel Core i7-10700',   ram:'32 GB DDR4', storage:'1 TB NVMe SSD',   gpu:'NVIDIA GeForce GTX 1650 4 GB',   os:'Windows 11 Pro', pcSerial:'HPBED800-005', monitorSerial:'HPE24H-105'},
  'Lab B - PC-06':{model:'HP EliteDesk 800 G6 Tower',   cpu:'Intel Core i7-10700',   ram:'16 GB DDR4', storage:'512 GB NVMe SSD', gpu:'Intel UHD Graphics 630',          os:'Windows 11 Pro', pcSerial:'HPBED800-006', monitorSerial:'HPE24H-106'},

  /* ── Lab C ── */
  'Lab C - PC-01':{model:'Lenovo ThinkCentre M90t',     cpu:'Intel Core i7-10700',   ram:'16 GB DDR4', storage:'512 GB NVMe SSD', gpu:'Intel UHD Graphics 630',          os:'Windows 11 Pro', pcSerial:'LNVM90T-001',  monitorSerial:'LNVT24H-201'},
  'Lab C - PC-02':{model:'Lenovo ThinkCentre M90t',     cpu:'Intel Core i7-10700',   ram:'16 GB DDR4', storage:'512 GB NVMe SSD', gpu:'Intel UHD Graphics 630',          os:'Windows 11 Pro', pcSerial:'LNVM90T-002',  monitorSerial:'LNVT24H-202'},
  'Lab C - PC-03':{model:'Lenovo ThinkCentre M70s SFF', cpu:'Intel Core i5-10400',   ram:'8 GB DDR4',  storage:'256 GB SATA SSD', gpu:'Intel UHD Graphics 630',          os:'Windows 10 Pro', pcSerial:'LNVM70S-003',  monitorSerial:'LNVT22H-203'},
  'Lab C - PC-04':{model:'Lenovo ThinkCentre M70s SFF', cpu:'Intel Core i5-10400',   ram:'8 GB DDR4',  storage:'256 GB SATA SSD', gpu:'Intel UHD Graphics 630',          os:'Windows 10 Pro', pcSerial:'LNVM70S-004',  monitorSerial:'LNVT22H-204'},
};

var DEF={emails:[
  {a:'hirushasilva69@gmail.com',on:true},
  {a:'hirushasilva64@gmail.com',on:true},
  {a:'it.support@lab.example',on:false},
  {a:'it.technician@lab.example',on:false}],
  mode:'webhook',hook:{type:'apps',url:'https://script.google.com/macros/s/AKfycbzVsn_2XFkeA8sqF80A1nAUu37UlKUsKk7xKpMnPTR1dg1LTZCZXS-RZOeEdslJvlGBjw/exec'},base:'https://pclabreport.vercel.app/',specs:{}};

function clone(o){return JSON.parse(JSON.stringify(o))}
function load(){try{var s=JSON.parse(localStorage.getItem(KEY));if(s&&typeof s==='object'){var d=clone(DEF);for(var k in s)d[k]=s[k];d.mode=DEF.mode;d.hook=clone(DEF.hook);d.base=DEF.base;return d}}catch(e){}return clone(DEF)}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));return true}catch(e){return false}}
var S=load();

function spec(id){var o={},b=CATALOG[id]||{},v=S.specs[id]||{};FIELDS.forEach(function(f){var k=f[0];o[k]=v[k]!=null&&v[k]!==''?v[k]:(b[k]!=null?b[k]:'');});return o}
function baseUrl(){return (S.base||location.origin+location.pathname).split('#')[0].split('?')[0]}
function show(el,type,text){el.className='msg '+type;el.textContent=text}
function hide(el){el.className='msg';el.textContent=''}
var EMAIL=/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/* Tabs */
var qrDirty=true;
function tab(name){
  $$('nav button[data-tab]').forEach(function(b){b.classList.toggle('on',b.dataset.tab===name)});
  $$('.pane').forEach(function(p){p.classList.toggle('on',p.id===name)});
  if(name==='qr'&&qrDirty)renderQR();
}
$$('nav button[data-tab]').forEach(function(b){b.addEventListener('click',function(){tab(b.dataset.tab)})});
