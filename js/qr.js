function populateQRLabs(){
  var labs=loadLabs(),el=$('#qrLab');
  el.innerHTML='<option value="">All Labs</option>'+
    labs.map(function(l){return '<option value="'+esc(l.name)+'">'+esc(l.name)+'</option>';}).join('');
}

function renderQR(){
  var g=$('#sheet');
  var labs=loadLabs();
  var filterLab=$('#qrLab').value;
  var filtered=filterLab?labs.filter(function(l){return l.name===filterLab;}):labs;

  if(!filtered.length){
    g.innerHTML='<p class="small" style="padding:16px">No labs configured. Add labs under Catalog &amp; settings.</p>';
    return;
  }

  var firstPC=filtered[0].name+' - PC-01';
  $('#qrurl').textContent=baseUrl()+'?lab='+encodeURIComponent(filtered[0].name)+'&pc='+encodeURIComponent(firstPC);

  if(typeof QRCode==='undefined'){
    g.innerHTML='<div class="card">The QR library could not load. Check your connection and reopen this tab.</div>';
    return;
  }
  g.innerHTML='';

  filtered.forEach(function(lab){
    getPCsForLab(lab).forEach(function(pc){
      var url=baseUrl()+'?lab='+encodeURIComponent(lab.name)+'&pc='+encodeURIComponent(pc);
      var pcShort=pc.split(' - ')[1]||pc;
      var d=document.createElement('div');
      d.className='badgebox';
      d.innerHTML=
        '<div class="badge-header">'+esc(lab.name)+'</div>'+
        '<div class="badge-body">'+
          '<div class="qr-code-wrapper"></div>'+
          '<div class="badge-pc">'+esc(pcShort)+'</div>'+
        '</div>'+
        '<div class="badge-footer">Scan to Report Damage</div>';
      g.appendChild(d);
      new QRCode(d.querySelector('.qr-code-wrapper'),{
        text:url,
        width:120,
        height:120,
        colorDark:'#000000',
        colorLight:'#ffffff',
        correctLevel:QRCode.CorrectLevel.L
      });
    });
  });
  qrDirty=false;
}

$('#qrLab').addEventListener('change',function(){qrDirty=true;renderQR();});
$('#print').addEventListener('click',function(){if(qrDirty)renderQR();window.print();});

populateQRLabs();
