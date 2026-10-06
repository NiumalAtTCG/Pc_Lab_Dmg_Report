var params=new URLSearchParams(location.search),qid=(params.get('id')||'').trim().toUpperCase();
var sel,extra=[],busy=false;

function fillSelect(el){el.innerHTML=IDS.map(function(id){return '<option>'+id+'</option>'}).join('')}
fillSelect($('#pc'));fillSelect($('#apc'));
if(qid){
  if(CATALOG[qid]){
    $('#pc').value=qid;
    renderSpecs();
    $('#form').scrollIntoView({behavior:'smooth'});
  }else{
    show($('#idwarn'),'err','PC "'+qid+'" is not in the catalog. Pick the correct PC below.');
  }
}

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
