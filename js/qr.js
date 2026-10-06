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
