/* Lab management */
function renderLabList(){
  var labs=loadLabs();
  $('#labList').innerHTML=labs.length?labs.map(function(l,i){
    return '<div class="row" style="align-items:center;margin-bottom:8px">'+
      '<input type="text" data-li="'+i+'" data-lk="name" value="'+esc(l.name)+'" aria-label="Lab name" style="flex:2">'+
      '<input type="number" data-li="'+i+'" data-lk="count" value="'+l.count+'" min="1" max="200" aria-label="PC count" style="flex:1">'+
      '<button type="button" class="btn alt" data-ldel="'+i+'">Delete</button>'+
    '</div>';
  }).join(''):'<p class="small">No labs yet. Add one above.</p>';
}
$('#labList').addEventListener('click',function(e){
  var d=e.target.dataset.ldel;
  if(d==null)return;
  var labs=loadLabs();labs.splice(+d,1);saveLabs(labs);renderLabList();syncAllLabDropdowns();
  show($('#labmsg'),'ok','Lab deleted.');
});
$('#saveLabs').addEventListener('click',function(){
  var m=$('#labmsg');
  var inputs=$$('#labList input[data-li]');
  if(!inputs.length){show(m,'err','No labs to save.');return;}
  var labs=loadLabs();
  var names=[];
  var valid=true;
  inputs.forEach(function(t){
    var i=+t.dataset.li,k=t.dataset.lk;
    if(k==='name'){
      var n=t.value.trim();
      if(!n){show(m,'err','Lab name cannot be empty.');valid=false;return;}
      if(names.indexOf(n.toLowerCase())>-1){show(m,'err','Duplicate lab name: "'+n+'".');valid=false;return;}
      names.push(n.toLowerCase());
      labs[i].name=n;
    }else if(k==='count'){
      labs[i].count=Math.max(1,parseInt(t.value)||1);
    }
  });
  if(!valid)return;
  var ok=saveLabs(labs);
  if(!ok){show(m,'err','Could not save in this browser.');return;}
  renderLabList();syncAllLabDropdowns();show(m,'ok','Labs saved.');
});
$('#addLab').addEventListener('click',function(){
  var name=$('#newLabName').value.trim(),count=parseInt($('#newLabCount').value)||10;
  if(!name){show($('#labmsg'),'err','Enter a lab name.');return;}
  var labs=loadLabs();
  if(labs.some(function(l){return l.name.toLowerCase()===name.toLowerCase();})){show($('#labmsg'),'err','A lab with that name already exists.');return;}
  labs.push({name:name,count:count});saveLabs(labs);
  $('#newLabName').value='';$('#newLabCount').value='';
  renderLabList();syncAllLabDropdowns();show($('#labmsg'),'ok','Lab "'+name+'" added.');
});

function syncAllLabDropdowns(){
  populateReportLabs();populateReportPCs();
  populateAdminLabs();
  populateQRLabs();qrDirty=true;
}
function renderAdminSpec(){
  var id=$('#apc').value;
  var s=spec(id);
  $('#afields').innerHTML=FIELDS.map(function(f){return '<div><label for="f_'+f[0]+'">'+f[1]+'</label><input type="text" id="f_'+f[0]+'" value="'+esc(s[f[0]]||'')+'"></div>';}).join('');
}
$('#apc').addEventListener('change',renderAdminSpec);
$('#saveSpec').addEventListener('click',function(){
  var id=$('#apc').value,o={};
  FIELDS.forEach(function(f){
    var v=$('#f_'+f[0]).value.trim();
    var base=CATALOG[id]?CATALOG[id][f[0]]:undefined;
    if(v&&v!==base)o[f[0]]=v;
  });
  if(Object.keys(o).length)S.specs[id]=o;else delete S.specs[id];
  var ok=save();
  show($('#amsg'),ok?'ok':'err',ok?id+' saved.':'Could not save in this browser.');
  if($('#pc-selector').value===id)renderSpecs();
});
$('#resetSpec').addEventListener('click',function(){
  var id=$('#apc').value;
  delete S.specs[id];save();renderAdminSpec();
  if($('#pc-selector').value===id)renderSpecs();
  show($('#amsg'),'ok',id+' reset to defaults.');
});
$('#resetAll').addEventListener('click',function(){
  if(!confirm('Reset all PCs to the built-in specs?'))return;
  S.specs={};save();renderAdminSpec();renderSpecs();
  show($('#amsg'),'ok','All PCs reset to defaults.');
});

/* ── Recipients ── */
var rows=[];
function renderRows(){
  $('#rlist').innerHTML=rows.map(function(r,i){
    return '<div class="row" style="align-items:center;margin-bottom:6px">'+
      '<input type="checkbox" data-i="'+i+'" data-k="on" style="flex:none;width:20px;height:20px"'+(r.on?' checked':'')+' aria-label="Pre-select">'+
      '<span style="flex:1;font-size:var(--ts-sm);word-break:break-all">'+esc(r.a)+'</span>'+
      '<button type="button" class="btn alt" data-del="'+i+'">Remove</button>'+
    '</div>';
  }).join('')||'<p class="small">No emails yet. Add one below.</p>';
}
function persistEmails(){
  S.emails=rows.map(function(r){return{a:r.a,on:!!r.on};});
  save();renderRecips();
}
$('#rlist').addEventListener('change',function(e){
  var t=e.target,i=t.dataset.i;
  if(i==null||t.dataset.k!=='on')return;
  rows[+i].on=t.checked;persistEmails();
});
$('#rlist').addEventListener('click',function(e){
  var d=e.target.dataset.del;
  if(d==null)return;
  rows.splice(+d,1);renderRows();persistEmails();
});
$('#addRow').addEventListener('click',function(){
  var m=$('#emailmsg'),v=$('#newEmail').value.trim();
  if(!v){show(m,'err','Enter an email address.');return;}
  if(!EMAIL.test(v)){show(m,'err','"'+v+'" is not a valid email address.');return;}
  if(rows.some(function(r){return r.a.toLowerCase()===v.toLowerCase();})){show(m,'err','That address is already in the list.');return;}
  rows.push({a:v,on:false});$('#newEmail').value='';
  renderRows();persistEmails();show(m,'ok','"'+v+'" added.');
});

function syncHook(){$('#hookbox').style.display=document.querySelector('input[name=mode]:checked').value==='webhook'?'block':'none'}
$$('input[name=mode]').forEach(function(r){r.addEventListener('change',syncHook);});

function loadSettings(){
  rows=S.emails.map(function(e){return{a:e.a,on:e.on}});renderRows();
  var modeEl=document.querySelector('input[name=mode][value="'+S.mode+'"]');
  if(modeEl)modeEl.checked=true;
  else{var fallback=document.querySelector('input[name=mode][value="mailto"]');if(fallback)fallback.checked=true;}
  $('#htype').value=S.hook.type;$('#hurl').value=S.hook.url;$('#base').value=S.base;syncHook();
}
$('#saveSet').addEventListener('click',function(){
  var m=$('#smsg');
  var mode=document.querySelector('input[name=mode]:checked').value,url=$('#hurl').value.trim(),base=$('#base').value.trim();
  if(mode==='webhook'&&!/^https:\/\//i.test(url)){show(m,'err','Enter a webhook URL that starts with https://');return;}
  if(base&&!/^https?:\/\//i.test(base)){show(m,'err','The site address must start with https://');return;}
  var baseChanged=base!==S.base;
  S.mode=mode;S.hook={type:$('#htype').value,url:url};S.base=base.replace(/\/+$/,base.indexOf('?')>-1?'':'/');
  if(!save()){show(m,'err','Could not save in this browser.');return;}
  if(baseChanged)qrDirty=true;
  loadSettings();show(m,'ok','Settings saved.');
});

/* Init */
if(typeof resetSel==='function')resetSel();
if(typeof renderRecips==='function')renderRecips();
renderSpecs();renderAdminSpec();loadSettings();renderLabList();
