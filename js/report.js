var params=new URLSearchParams(location.search);
var qlab=(params.get('lab')||'').trim();
var qpc=(params.get('pc')||'').trim();
/* legacy ?id= support */
var qid=(params.get('id')||'').trim().toUpperCase();

var extra=[],busy=false;

/* ── Lab/PC dropdown helpers ── */
function populateReportLabs(){
  var labs=loadLabs(),el=$('#reportLab');
  el.innerHTML=labs.map(function(l){return '<option value="'+esc(l.name)+'">'+esc(l.name)+'</option>';}).join('');
}
function populateReportPCs(){
  var labs=loadLabs(),labName=$('#reportLab').value;
  var lab=labs.filter(function(l){return l.name===labName;})[0];
  var el=$('#pc');
  if(!lab){el.innerHTML='';return;}
  el.innerHTML=getPCsForLab(lab).map(function(pc){return '<option value="'+esc(pc)+'">'+esc(pc)+'</option>';}).join('');
  renderSpecs();
}

populateReportLabs();
$('#reportLab').addEventListener('change',function(){populateReportPCs();renderSpecs();});
populateReportPCs();

/* Handle QR scan params */
if(qlab||qpc){
  var labs=loadLabs();
  if(qlab){
    var matchLab=labs.filter(function(l){return l.name===qlab;})[0];
    if(matchLab){
      $('#reportLab').value=qlab;
      populateReportPCs();
      if(qpc)$('#pc').value=qpc;
    }else{
      show($('#idwarn'),'err','Lab "'+qlab+'" is not configured. Pick the correct Lab below.');
    }
  }
  renderSpecs();
  $('#form').scrollIntoView({behavior:'smooth'});
}else if(qid){
  /* legacy id param fallback */
  show($('#idwarn'),'err','Use the new QR stickers. Old ID: '+qid);
}

/* Catalog (admin) lab/pc selects */
function populateAdminLabs(){
  var labs=loadLabs(),el=$('#alab');
  el.innerHTML=labs.map(function(l){return '<option value="'+esc(l.name)+'">'+esc(l.name)+'</option>';}).join('');
  populateAdminPCs();
}
function populateAdminPCs(){
  var labs=loadLabs(),labName=$('#alab').value;
  var lab=labs.filter(function(l){return l.name===labName;})[0];
  var el=$('#apc');
  if(!lab){el.innerHTML='';return;}
  el.innerHTML=getPCsForLab(lab).map(function(pc){return '<option value="'+esc(pc)+'">'+esc(pc)+'</option>';}).join('');
  renderAdminSpec();
}
$('#alab').addEventListener('change',populateAdminPCs);
populateAdminLabs();

function renderSpecs(){
  var id=$('#pc').value;
  var s=spec(id);
  $('#specs').innerHTML=FIELDS.map(function(f){
    if(f[0]==='pcSerial'||f[0]==='monitorSerial')return '<dt>'+f[1]+'</dt><dd>'+(s[f[0]]?esc(s[f[0]]):'\u2014')+'</dd>';
    return '<dt>'+f[1]+'</dt><dd>'+esc(s[f[0]]||'\u2014')+'</dd>';
  }).join('');
  $('#pcSerial').value=s.pcSerial||'';
  $('#monitorSerial').value=s.monitorSerial||'';
}
$('#pc').addEventListener('change',renderSpecs);
$('#cats').innerHTML=CATS.map(function(c){return '<label class="chip"><input type="radio" name="cat" value="'+esc(c)+'"><span>'+esc(c)+'</span></label>';}).join('');

function resetSel(){extra=[];}
function allRecips(){var l=S.emails.map(function(e){return e.a;});extra.forEach(function(a){if(l.indexOf(a)<0)l.push(a);});return l;}
function checkedRecips(){return $$('#recips input[type=checkbox]:checked').map(function(el){return el.dataset.a;});}
function updateCount(){$('#count').textContent=checkedRecips().length+' selected';}
function renderRecips(){
  var l=allRecips();
  var preOn=new Set(S.emails.filter(function(e){return e.on;}).map(function(e){return e.a;}));
  $('#recips').innerHTML=l.map(function(a){return '<label class="rec"><input type="checkbox" data-a="'+esc(a)+'"'+(preOn.has(a)?' checked':'')+'> <span>'+esc(a)+'</span></label>';}).join('')||'<p class="small">No recipients yet. Add one below.</p>';
  updateCount();
}
$('#recips').addEventListener('change',updateCount);

function addCustom(){
  var el=$('#custom'),v=el.value.trim(),m=$('#msg');
  if(!v)return;
  if(!EMAIL.test(v)){show(m,'err','Enter a valid email address, like name@example.com.');return;}
  hide(m);
  var vl=v.toLowerCase();
  /* preserve existing checked state before re-render */
  var wasChecked=checkedRecips();
  if(allRecips().map(function(x){return x.toLowerCase();}).indexOf(vl)<0)extra.push(v);
  el.value='';renderRecips();
  /* re-check previously checked + the new one */
  $$('#recips input[type=checkbox]').forEach(function(cb){
    if(wasChecked.indexOf(cb.dataset.a)>-1||cb.dataset.a.toLowerCase()===vl)cb.checked=true;
  });
  updateCount();
}
$('#addCustom').addEventListener('click',addCustom);
$('#custom').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();addCustom();}});

function buildReport(p){
  var s=p.specs;
  return '# Lab PC Damage Report\n\n'+
  '**Lab:** '+p.lab+'\n**PC:** '+p.pc_id+'\n**PC Serial:** '+(p.pcSerial||'Not given')+'\n**Monitor Serial:** '+(p.monitorSerial||'Not given')+'\n'+
  '**Category:** '+p.category+'\n**Reported:** '+p.timestamp+'\n**Reporter:** '+(p.reporter||'Not given')+'\n\n'+
  '## Hardware\n'+FIELDS.map(function(f){return '- '+f[1]+': '+s[f[0]];}).join('\n')+'\n\n'+
  '## Remarks\n'+p.remarks+'\n';
}
function unlock(){busy=false;var b=$('#send');b.disabled=false;b.textContent='Send report';}
function resetForm(){
  $('#remarks').value='';$('#reporter').value='';
  $('#pcSerial').value='';$('#monitorSerial').value='';
  $$('input[name=cat]').forEach(function(r){r.checked=false;});
}

$('#form').addEventListener('submit',function(e){
  e.preventDefault();
  if(busy)return;
  var m=$('#msg');
  if($('#website').value){busy=true;$('#send').disabled=true;show(m,'ok','Report sent.');return;} /* honeypot */
  var cat=$('input[name=cat]:checked'),remarks=$('#remarks').value.trim(),to=checkedRecips();
  if(!cat){show(m,'err','Choose a damage category.');return;}
  if(remarks.length<5){show(m,'err','Describe the problem in the remarks box.');return;}
  if(!to.length){show(m,'err','Select at least one recipient.');return;}
  var labName=$('#reportLab').value,pcId=$('#pc').value,now=new Date();
  var p={
    lab:labName,
    pc_id:pcId,
    pcSerial:$('#pcSerial').value.trim(),
    monitorSerial:$('#monitorSerial').value.trim(),
    category:cat.value,
    reporter:$('#reporter').value.trim(),
    remarks:remarks,
    specs:spec(pcId),
    timestamp:now.toLocaleString()+' ('+Intl.DateTimeFormat().resolvedOptions().timeZone+')',
    recipients:to
  };
  p.subject='[Lab PC Damage] '+labName+' / '+pcId+' - '+p.category;
  p.message=buildReport(p);
  busy=true;var b=$('#send');b.disabled=true;b.textContent='Sending...';hide(m);
  if(S.mode==='webhook'){
    if(!S.hook.url){show(m,'err','Webhook URL is missing. Ask an admin to add it under Catalog & settings.');unlock();return;}
    var body,headers={'Accept':'application/json'};
    if(S.hook.type==='apps'){
      body=JSON.stringify(p);
      headers['Content-Type']='text/plain;charset=utf-8';
    }else{
      body=JSON.stringify({
        email:p.recipients[0],subject:p.subject,message:p.message,
        lab:p.lab,pc_id:p.pc_id,pcSerial:p.pcSerial||'Not given',
        monitorSerial:p.monitorSerial||'Not given',
        category:p.category,reporter:p.reporter||'Not given',
        timestamp:p.timestamp,recipients:p.recipients.join(', ')
      });
      headers['Content-Type']='application/json';
    }
    var opt=S.hook.type==='apps'
      ?{method:'POST',mode:'no-cors',headers:headers,body:body}
      :{method:'POST',headers:headers,body:body};
    fetch(S.hook.url,opt).then(function(r){
      if(S.hook.type!=='apps'&&!r.ok)throw new Error('HTTP '+r.status);
      show(m,'ok','Report sent to '+to.length+' recipient'+(to.length>1?'s':'')+'.');resetForm();setTimeout(unlock,4000);
    }).catch(function(err){show(m,'err','Could not send the report. '+(err&&err.message?err.message:'Check your connection and try again.'));unlock();});
  }else{
    var url='mailto:'+encodeURIComponent(to[0]).replace(/%40/g,'@')+'?'+
      (to.length>1?'cc='+to.slice(1).map(function(a){return encodeURIComponent(a).replace(/%40/g,'@');}).join(',')+'&':'')+
      'subject='+encodeURIComponent(p.subject)+'&body='+encodeURIComponent(p.message);
    window.location.href=url;
    setTimeout(function(){show(m,'ok','Your mail app should be open. Press Send there to finish.');resetForm();setTimeout(unlock,3000);},600);
  }
});
