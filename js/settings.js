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

/* Admin: password */
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

/* Admin: recipients + sending settings */
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
