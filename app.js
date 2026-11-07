const SB_URL='https://casjyuotzxpjgigkcqxo.supabase.co';
const SB_KEY='sb_publishable_K31dWusufFtTUQe76WKStQ_a9d9ThqH';
const sb=supabase.createClient(SB_URL,SB_KEY);
const $=(s,r=document)=>r.querySelector(s);
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>n==null?'—':Number(n).toFixed(2);
const dt=x=>x?new Date(x).toLocaleString('fr-FR'):'—';
const STAT={brouillon:'Brouillon',soumise:'Soumise',en_verification:'En cours de vérification',validee:'Validée',rejetee:'Rejetée'};
const badge=s=>`<span class="badge ${s}">${STAT[s]||s}</span>`;
const isAdmin=document.body.dataset.mode==='admin';
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});

function bars(data,max=100){ // graphique SVG
  const w=100/Math.max(data.length,1);
  return `<svg viewBox="0 0 400 190" style="width:100%;max-width:520px"><line x1="30" y1="150" x2="395" y2="150" stroke="#ccd"/>`+
  data.map((d,i)=>{const hh=d.val==null?0:Math.min(d.val,max)/max*130,x=40+i*(350/data.length),bw=Math.min(60,350/data.length-14);
   return `<rect x="${x}" y="${150-hh}" width="${bw}" height="${hh}" rx="4" fill="${i%2?'#0b2a5b':'#0f8a3d'}"/><text x="${x+bw/2}" y="${144-hh}" text-anchor="middle" font-size="13" font-weight="700">${d.val==null?'—':Number(d.val).toFixed(1)}</text><text x="${x+bw/2}" y="170" text-anchor="middle" font-size="12">${h(d.label)}</text>`}).join('')+`</svg>`;
}
function download(name,csvRows){
  const csv='\ufeff'+csvRows.map(r=>r.map(c=>'"'+String(c??'').replace(/"/g,'""')+'"').join(';')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=name;a.click();
}

/* ============================ ESPACE ADMINISTRATEUR ============================ */
let ROLE=null,NAME='',ME=null,C={classes:[],periodes:[],matieres:[]};
const PAGES={};
const MENU=[['dash','Tableau de bord',['principal','academique','suivi']],['parts','Participants',['principal','academique','suivi']],['import','Importation & codes',['principal']],
['periodes','Périodes académiques',['principal']],['matieres','Matières',['principal']],['valid','Validation des notes',['principal','academique','suivi']],
['exc','Rapport d\'excellence',['principal','academique','suivi']],['admins','Administrateurs',['principal']]];
const cn=id=>C.classes.find(c=>c.id===id)?.nom||'—';
const can=(...r)=>r.includes(ROLE);

async function adminStart(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session)return loginView();
  const {data:p}=await sb.from('profils_admin').select('*').eq('user_id',session.user.id).maybeSingle();
  if(!p||!p.actif){await sb.auth.signOut();return loginView("Ce compte n'a pas d'accès administrateur.");}
  ME=session.user;ROLE=p.role;NAME=p.nom||ME.email;
  const [a,b,c]=await Promise.all([sb.from('classes').select('*').order('ordre'),sb.from('periodes').select('*').order('id'),sb.from('matieres').select('*').order('ordre')]);
  C={classes:a.data||[],periodes:b.data||[],matieres:c.data||[]};
  $('#app').innerHTML=`<div id="shell"><nav id="nav"><div class="logo">ÉduPerf+<small>Gestion des Performances Académiques</small></div>${MENU.filter(m=>m[2].includes(ROLE)).map(m=>`<a data-p="${m[0]}">${m[1]}</a>`).join('')}<a id="out">Déconnexion</a></nav>
  <main><div class="top"><span><button class="btn l burger" onclick="$('#nav').classList.toggle('open')">☰</button> <b style="color:var(--m)">Ensemble pour une réussite durable</b></span><span>${h(NAME)} · <small>${{principal:'Administrateur principal',academique:'Administrateur académique',suivi:'Administrateur de suivi'}[ROLE]}</small></span></div><div id="main"></div></main></div>`;
  document.querySelectorAll('nav a[data-p]').forEach(a=>a.onclick=()=>{$('#nav').classList.remove('open');go(a.dataset.p)});
  $('#out').onclick=async()=>{await sb.auth.signOut();location.reload()};
  go('dash');
}
function loginView(msg){
  $('#app').innerHTML=`<div class="wrap" style="max-width:420px;margin-top:8vh"><div class="hero"><h1>ÉduPerf+</h1>Espace administrateur — Gestion des performances académiques</div>
  <div class="card"><h3>Connexion</h3>${msg?`<div class="err">${h(msg)}</div>`:''}<p><input id="em" type="email" placeholder="Adresse e-mail" style="width:100%"></p><p><input id="pw" type="password" placeholder="Mot de passe" style="width:100%"></p><div id="le"></div><button class="btn" id="go" style="width:100%">Se connecter</button></div></div>`;
  const run=async()=>{const {error}=await sb.auth.signInWithPassword({email:$('#em').value.trim(),password:$('#pw').value});
    if(error)$('#le').innerHTML='<div class="err">E-mail ou mot de passe incorrect.</div>';else adminStart();};
  $('#go').onclick=run;$('#pw').onkeydown=e=>{if(e.key==='Enter')run()};
}
async function go(p){
  document.querySelectorAll('nav a[data-p]').forEach(a=>a.classList.toggle('on',a.dataset.p===p));
  $('#main').innerHTML='<div class="card">Chargement…</div>';
  try{await PAGES[p]()}catch(e){$('#main').innerHTML=`<div class="err">Erreur : ${h(e.message||e)}</div>`}
}
const perOpts=(sel)=>C.periodes.map(p=>`<option value="${p.id}" ${p.id==sel?'selected':''}>${h(p.nom)}</option>`).join('');
const cntS=async f=>{let q=sb.from('soumissions').select('id',{count:'exact',head:true});return (await f(q)).count||0};

PAGES.dash=async()=>{
  const act=C.periodes.filter(p=>p.active),pid=act[0]?.id;
  const np=(await sb.from('participants').select('id',{count:'exact',head:true}).eq('actif',true)).count||0;
  const [sub,val,att]=await Promise.all([cntS(q=>q.neq('statut','brouillon')),cntS(q=>q.eq('statut','validee')),cntS(q=>q.in('statut',['soumise','en_verification']))]);
  const avec=pid?await cntS(q=>q.eq('periode_id',pid).neq('statut','brouillon')):0;
  const moy=[];for(const p of C.periodes){const {data}=await sb.from('classement').select('moyenne').eq('periode_id',p.id);moy.push({label:p.nom.replace('Période','P'),val:data?.length?data.reduce((s,x)=>s+Number(x.moyenne),0)/data.length:null,n:data?.length||0});}
  const ok=moy.filter(m=>m.val!=null),gen=ok.length?ok.reduce((s,m)=>s+m.val,0)/ok.length:null;
  $('#main').innerHTML=`<div class="grid"><div class="stat"><b>${np}</b><span>Total participants</span></div><div class="stat m"><b>${C.matieres.filter(m=>m.actif).length}</b><span>Matières</span></div>
  <div class="stat"><b>${act.length} / 4</b><span>Périodes actives</span></div><div class="stat m"><b>${fmt(gen)}</b><span>Moyenne générale du programme</span></div>
  <div class="stat"><b>${sub}</b><span>Notes soumises</span></div><div class="stat m"><b>${val}</b><span>Notes validées</span></div><div class="stat"><b>${att}</b><span>Notes en attente</span></div>
  <div class="stat m"><b>${pid?Math.max(np-avec,0):'—'}</b><span>Parents sans soumission${pid?' ('+h(act[0].nom)+')':''}</span></div></div>
  <div class="card"><h3>Moyenne générale par période (notes validées)</h3>${bars(moy)}</div>`;
};

PAGES.parts=async()=>{
  const pid=C.periodes.find(p=>p.active)?.id||1;
  $('#main').innerHTML=`<div class="card"><h3>Participants</h3><div class="bar"><input id="q" placeholder="Rechercher (nom ou ID)…"><select id="fc"><option value="">Toutes les classes</option>${C.classes.map(c=>`<option value="${c.id}">${h(c.nom)}</option>`).join('')}</select><select id="fp">${perOpts(pid)}</select><select id="fs"><option value="">Tous les statuts</option><option value="none">Aucune soumission</option>${Object.entries(STAT).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><button class="btn l" id="ex">Exporter CSV</button></div><div id="n"></div><div class="tw" id="t"></div></div>`;
  const {data:P}=await sb.from('participants').select('id,nom,sexe,classe_id,actif').order('id').range(0,999);
  let S={};const load=async()=>{S={};const {data}=await sb.from('soumissions').select('participant_id,statut').eq('periode_id',$('#fp').value).range(0,999);(data||[]).forEach(s=>S[s.participant_id]=s.statut);draw()};
  let rows=[];
  const draw=()=>{const q=$('#q').value.toLowerCase(),c=$('#fc').value,s=$('#fs').value;
    rows=P.filter(p=>(!q||p.nom.toLowerCase().includes(q)||p.id.toLowerCase().includes(q))&&(!c||p.classe_id==c)&&(!s||(s==='none'?!S[p.id]:S[p.id]===s)));
    $('#n').innerHTML=`<small>Affichage de ${rows.length} sur ${P.length}</small>`;
    $('#t').innerHTML=`<table><tr><th>#</th><th>ID</th><th>Nom et prénom</th><th>Sexe</th><th>Classe</th><th>Statut (période)</th></tr>${rows.slice(0,300).map((p,i)=>`<tr><td>${i+1}</td><td>${h(p.id)}</td><td>${h(p.nom)}</td><td>${p.sexe}</td><td>${cn(p.classe_id)}</td><td>${S[p.id]?badge(S[p.id]):'<span class="badge">Aucune soumission</span>'}</td></tr>`).join('')}</table>`};
  ['q','fc','fs'].forEach(i=>$('#'+i).oninput=draw);$('#fp').onchange=load;
  $('#ex').onclick=()=>download('participants.csv',[['ID','Nom','Sexe','Classe','Statut'],...rows.map(p=>[p.id,p.nom,p.sexe,cn(p.classe_id),STAT[S[p.id]]||'Aucune soumission'])]);
  load();
};

PAGES.import=async()=>{
  $('#main').innerHTML=`<div class="card"><h3>Importer la liste officielle des participants</h3><p>Fichier Excel (.xlsx) ou CSV avec les colonnes : <b>ID</b>, <b>Nom complet</b>, <b>Sexe</b> (Male/Female ou Masculin/Féminin). Les participants existants sont mis à jour sans doublon ; les ID ne sont jamais modifiés.</p>
  <input type="file" id="f" accept=".xlsx,.xls,.csv"><div id="pv"></div></div><div class="card"><h3>Codes familiaux</h3><p>Chaque parent a besoin d'un code personnel pour accéder au dossier de son enfant. Les codes ne sont affichés <b>qu'une seule fois</b> : imprimez-les ou téléchargez-les immédiatement.</p>
  <button class="btn m" id="gc">Générer les codes manquants</button> <button class="btn o" id="gt">Régénérer TOUS les codes</button><div id="co"></div></div>`;
  let rows=[],name='';
  $('#f').onchange=async e=>{const f=e.target.files[0];if(!f)return;name=f.name;
    const wb=XLSX.read(await f.arrayBuffer(),{type:'array'});const raw=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});
    const hd=(raw[0]||[]).map(x=>String(x).toLowerCase());const ix=k=>hd.findIndex(x=>x.includes(k));
    const i1=ix('id'),i2=ix('nom'),i3=ix('sex');
    if(i1<0||i2<0||i3<0){$('#pv').innerHTML='<div class="err">Colonnes introuvables : le fichier doit contenir ID, Nom et Sexe sur la première ligne.</div>';return}
    rows=raw.slice(1).filter(r=>r.some(c=>String(c).trim())).map(r=>({id:String(r[i1]).trim(),nom:String(r[i2]).trim(),sexe:String(r[i3]).trim()}));
    const seen={},errs=[];rows.forEach((r,i)=>{const sx=r.sexe.toLowerCase();if(!r.id||!r.nom||!['male','female','m','f','masculin','féminin','feminin'].includes(sx))errs.push(`Ligne ${i+2} : information manquante ou incorrecte`);if(r.id){if(seen[r.id.toUpperCase()])errs.push(`Ligne ${i+2} : ID en double (${r.id})`);seen[r.id.toUpperCase()]=1}});
    $('#pv').innerHTML=`<p><b>${rows.length}</b> lignes lues.</p>${errs.length?`<div class="err"><b>${errs.length} problème(s) :</b><br>${errs.slice(0,15).map(h).join('<br>')}</div>`:'<div class="ok">Aucune anomalie détectée.</div>'}
    <div class="tw"><table><tr><th>ID</th><th>Nom</th><th>Sexe</th></tr>${rows.slice(0,8).map(r=>`<tr><td>${h(r.id)}</td><td>${h(r.nom)}</td><td>${h(r.sexe)}</td></tr>`).join('')}</table></div><p><button class="btn" id="cf" ${errs.length?'disabled':''}>Confirmer l'importation</button></p><div id="ir"></div>`;
    $('#cf').onclick=async()=>{$('#cf').disabled=true;const {data,error}=await sb.rpc('admin_importer',{p_rows:rows,p_fichier:name});
      $('#ir').innerHTML=error?`<div class="err">${h(error.message)}</div>`:`<div class="ok">Importation terminée : ${data.ajoutes} ajouté(s), ${data.mis_a_jour} mis à jour, ${data.erreurs.length} erreur(s).</div>`};
  };
  const gen=async tous=>{if(tous&&!confirm('Les anciens codes ne fonctionneront plus. Continuer ?'))return;
    const {data,error}=await sb.rpc('admin_generer_codes',{p_tous:tous});
    if(error){$('#co').innerHTML=`<div class="err">${h(error.message)}</div>`;return}
    if(!data.length){$('#co').innerHTML='<div class="ok">Tous les participants ont déjà un code.</div>';return}
    $('#co').innerHTML=`<p class="noprint"><button class="btn m" onclick="print()">Imprimer</button> <button class="btn l" id="dl">Télécharger CSV</button></p><div class="tw"><table><tr><th>ID</th><th>Nom</th><th>Code familial</th></tr>${data.map(r=>`<tr><td>${h(r.id)}</td><td>${h(r.nom)}</td><td><b style="font-family:monospace;font-size:17px">${h(r.code)}</b></td></tr>`).join('')}</table></div>`;
    $('#dl').onclick=()=>download('codes_familiaux.csv',[['ID','Nom','Code'],...data.map(r=>[r.id,r.nom,r.code])])};
  $('#gc').onclick=()=>gen(false);$('#gt').onclick=()=>gen(true);
};

PAGES.periodes=async()=>{
  const np=(await sb.from('participants').select('id',{count:'exact',head:true}).eq('actif',true)).count||1;
  const pct={};for(const p of C.periodes)pct[p.id]=Math.round((await cntS(q=>q.eq('periode_id',p.id).neq('statut','brouillon')))/np*100);
  $('#main').innerHTML=`<div class="card"><h3>Périodes académiques (4 maximum)</h3><div class="tw"><table><tr><th>Nom</th><th>Début</th><th>Fin</th><th>Active</th><th>Saisie ouverte</th><th>Soumission</th><th></th></tr>${C.periodes.map(p=>`<tr data-id="${p.id}"><td><input class="n" value="${h(p.nom)}"></td><td><input class="d1" type="date" value="${p.date_debut||''}"></td><td><input class="d2" type="date" value="${p.date_fin||''}"></td><td><input class="a" type="checkbox" ${p.active?'checked':''}></td><td><input class="o" type="checkbox" ${p.saisie_ouverte?'checked':''}></td><td>${pct[p.id]}%</td><td><button class="btn s">Enregistrer</button></td></tr>`).join('')}</table></div><div id="m"></div><p><small>Une période fermée (ou inactive) n'accepte plus aucune modification de notes par les parents.</small></p></div>`;
  document.querySelectorAll('tr[data-id] button').forEach(b=>b.onclick=async()=>{const r=b.closest('tr');
    const {error}=await sb.from('periodes').update({nom:$('.n',r).value,date_debut:$('.d1',r).value||null,date_fin:$('.d2',r).value||null,active:$('.a',r).checked,saisie_ouverte:$('.o',r).checked}).eq('id',r.dataset.id);
    $('#m').innerHTML=error?`<div class="err">${h(error.message)}</div>`:'<div class="ok">Période enregistrée.</div>';
    const {data}=await sb.from('periodes').select('*').order('id');C.periodes=data});
};

PAGES.matieres=async()=>{
  const draw=()=>{$('#main').innerHTML=`<div class="card"><h3>Matières</h3><div class="tw"><table><tr><th>Matière</th><th>Barème</th><th>Coefficient</th><th>Active</th><th></th></tr>${C.matieres.map(m=>`<tr data-id="${m.id}"><td><input class="n" value="${h(m.nom)}"></td><td><input class="b" type="number" min="1" value="${m.bareme}" style="width:90px"></td><td><input class="c" type="number" min="0.1" step="0.1" value="${m.coefficient}" style="width:90px"></td><td><input class="a" type="checkbox" ${m.actif?'checked':''}></td><td><button class="btn s">Enregistrer</button></td></tr>`).join('')}</table></div><div id="m"></div>
    <h3 style="margin-top:16px">Ajouter une matière</h3><div class="bar"><input id="nn" placeholder="Nom"><input id="nb" type="number" value="100" style="width:90px"><input id="nc" type="number" value="1" step="0.1" style="width:90px"><button class="btn" id="add">Ajouter</button></div></div>`;
    const reload=async()=>{const {data}=await sb.from('matieres').select('*').order('ordre');C.matieres=data;draw()};
    document.querySelectorAll('tr[data-id] button').forEach(b=>b.onclick=async()=>{const r=b.closest('tr');
      const {error}=await sb.from('matieres').update({nom:$('.n',r).value.trim(),bareme:+$('.b',r).value,coefficient:+$('.c',r).value,actif:$('.a',r).checked}).eq('id',r.dataset.id);
      if(error)$('#m').innerHTML=`<div class="err">${h(error.message)}</div>`;else{await reload();$('#m').innerHTML='<div class="ok">Matière enregistrée.</div>'}});
    $('#add').onclick=async()=>{const nom=$('#nn').value.trim();if(!nom)return;const {error}=await sb.from('matieres').insert({nom,bareme:+$('#nb').value||100,coefficient:+$('#nc').value||1,ordre:C.matieres.length+1});
      if(error)$('#m').innerHTML=`<div class="err">${h(error.message)}</div>`;else reload()};
  };draw();
};

PAGES.valid=async()=>{
  const edit=can('principal','academique'),pid=C.periodes.find(p=>p.active)?.id||1;
  $('#main').innerHTML=`<div class="card"><h3>Validation des notes</h3><div class="ok" style="background:#e3effd;color:#0b2a5b">Vérifiez les notes soumises par les parents avant de les valider. Seules les notes validées entrent dans les rapports officiels.</div><div class="bar"><select id="fp">${perOpts(pid)}</select><select id="fs"><option value="">Toutes (sauf brouillons)</option>${Object.entries(STAT).map(([k,v])=>`<option value="${k}" ${k==='soumise'?'selected':''}>${v}</option>`).join('')}</select><input id="q" placeholder="Rechercher…"></div><div id="m"></div><div class="tw" id="t"></div></div>`;
  const {data:P}=await sb.from('participants').select('id,nom').range(0,999);const PM=Object.fromEntries(P.map(p=>[p.id,p.nom]));
  const load=async()=>{let q=sb.from('soumissions').select('id,participant_id,classe_id,statut,soumis_le,motif_rejet,notes(matiere_id,valeur)').eq('periode_id',$('#fp').value).order('soumis_le').range(0,999);
    const s=$('#fs').value;q=s?q.eq('statut',s):q.neq('statut','brouillon');const {data}=await q;draw(data||[])};
  const draw=D=>{const f=$('#q').value.toLowerCase();D=D.filter(d=>!f||(PM[d.participant_id]||'').toLowerCase().includes(f)||d.participant_id.toLowerCase().includes(f));
    $('#t').innerHTML=`<table><tr><th>#</th><th>Participant</th><th>Classe</th><th>Soumission</th><th>Notes</th><th>Statut</th>${edit?'<th>Actions</th>':''}</tr>${D.map((d,i)=>{const mm=Object.fromEntries(d.notes.map(n=>[n.matiere_id,n.valeur]));
      return `<tr><td>${i+1}</td><td>${h(PM[d.participant_id])}<br><small>${h(d.participant_id)}</small></td><td>${cn(d.classe_id)}</td><td>${dt(d.soumis_le)}</td><td><small>${C.matieres.filter(m=>m.actif).map(m=>`${h(m.nom)} : <b>${mm[m.id]??'—'}</b>/${m.bareme}`).join('<br>')}</small></td><td>${badge(d.statut)}${d.motif_rejet?`<br><small>${h(d.motif_rejet)}</small>`:''}</td>
      ${edit?`<td>${d.statut!=='validee'?`<button class="btn s" data-a="validee" data-i="${d.id}">Valider</button> `:''}${d.statut==='soumise'?`<button class="btn m s" data-a="en_verification" data-i="${d.id}">Vérifier</button> `:''}${d.statut!=='rejetee'?`<button class="btn r s" data-a="rejetee" data-i="${d.id}">Rejeter</button>`:''}</td>`:''}</tr>`}).join('')||'<tr><td colspan="7">Aucune soumission.</td></tr>'}</table>`;
    document.querySelectorAll('[data-a]').forEach(b=>b.onclick=async()=>{const a=b.dataset.a;let motif=null;
      if(a==='rejetee'){motif=prompt('Motif du rejet / correction demandée :');if(motif===null)return}
      if(a==='validee'&&!confirm('Valider ces notes ? Le parent ne pourra plus les modifier.'))return;
      const u={statut:a,verifie_par:ME.id,updated_at:new Date().toISOString(),motif_rejet:motif};if(a==='validee')u.valide_le=new Date().toISOString();
      const {error}=await sb.from('soumissions').update(u).eq('id',b.dataset.i);
      $('#m').innerHTML=error?`<div class="err">${h(error.message)}</div>`:'<div class="ok">Statut mis à jour.</div>';load()})};
  ['fp','fs'].forEach(i=>$('#'+i).onchange=load);$('#q').oninput=load;load();
};

PAGES.exc=async()=>{
  const pid=C.periodes.find(p=>p.active)?.id||1;
  $('#main').innerHTML=`<div class="card"><h3>RAPPORT D'EXCELLENCE ACADÉMIQUE</h3><div class="bar noprint"><select id="fp">${perOpts(pid)}</select><select id="fc"><option value="">Classement général</option>${C.classes.map(c=>`<option value="${c.id}">${h(c.nom)}</option>`).join('')}</select><select id="fn"><option value="5">Top 5</option><option value="10" selected>Top 10</option><option value="20">Top 20</option><option value="0">Tous</option></select><button class="btn m" onclick="print()">Imprimer / PDF</button><button class="btn l" id="xl">Excel</button></div><div id="t"></div></div><div class="card"><h3>Comparaison des moyennes entre périodes</h3><div id="g"></div></div>`;
  const {data:P}=await sb.from('participants').select('id,nom,sexe').range(0,999);const PM=Object.fromEntries(P.map(p=>[p.id,p]));let out=[];
  const load=async()=>{const c=$('#fc').value,n=+$('#fn').value;const {data}=await sb.from('classement').select('*').eq('periode_id',$('#fp').value).order('moyenne',{ascending:false}).range(0,999);
    let D=(data||[]).filter(d=>!c||d.classe_id==c);
    if(c){let r=0,prev=null,k=0;D.forEach((d,i)=>{if(d.moyenne!==prev){r=i+1;prev=d.moyenne}d.r=r})}else D.forEach(d=>d.r=d.rang);
    if(n)D=D.filter(d=>d.r<=n);out=D;
    $('#t').innerHTML=`<p><b>${h(C.periodes.find(p=>p.id==$('#fp').value)?.nom)}</b> — ${c?cn(+c):'Tous les participants'} — résultats validés uniquement</p><div class="tw"><table><tr><th>Rang</th><th>ID</th><th>Nom complet</th><th>Sexe</th><th>Classe</th><th>Moyenne</th><th>Mention</th></tr>${D.map(d=>`<tr><td><b>${d.r}</b></td><td>${h(d.participant_id)}</td><td>${h(PM[d.participant_id]?.nom)}</td><td>${PM[d.participant_id]?.sexe||''}</td><td>${cn(d.classe_id)}</td><td><b>${fmt(d.moyenne)}</b></td><td>${d.mention}</td></tr>`).join('')||'<tr><td colspan="7">Aucun résultat validé pour cette période.</td></tr>'}</table></div>`};
  ['fp','fc','fn'].forEach(i=>$('#'+i).onchange=load);
  $('#xl').onclick=()=>{const ws=XLSX.utils.json_to_sheet(out.map(d=>({Rang:d.r,ID:d.participant_id,'Nom complet':PM[d.participant_id]?.nom,Sexe:PM[d.participant_id]?.sexe,Classe:cn(d.classe_id),Moyenne:Number(d.moyenne),Mention:d.mention})));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Excellence');XLSX.writeFile(wb,'rapport_excellence.xlsx')};
  const moy=[];for(const p of C.periodes){const {data}=await sb.from('classement').select('moyenne').eq('periode_id',p.id);moy.push({label:p.nom.replace('Période','P'),val:data?.length?data.reduce((s,x)=>s+Number(x.moyenne),0)/data.length:null})}
  $('#g').innerHTML=bars(moy);load();
};

PAGES.admins=async()=>{
  const {data}=await sb.from('profils_admin').select('*').order('created_at');
  $('#main').innerHTML=`<div class="card"><h3>Administrateurs</h3><div class="tw"><table><tr><th>Nom / e-mail</th><th>Rôle</th><th>Actif</th><th></th></tr>${data.map(a=>`<tr data-id="${a.user_id}"><td><input class="n" value="${h(a.nom||'')}"></td><td><select class="r"><option value="principal" ${a.role==='principal'?'selected':''}>Administrateur principal</option><option value="academique" ${a.role==='academique'?'selected':''}>Administrateur académique</option><option value="suivi" ${a.role==='suivi'?'selected':''}>Administrateur de saisie et de suivi</option></select></td><td><input class="a" type="checkbox" ${a.actif?'checked':''}></td><td><button class="btn s">Enregistrer</button></td></tr>`).join('')}</table></div><div id="m"></div>
  <p><small>Pour ajouter un administrateur : créez son compte dans Supabase (Authentication → Users → Add user). Il apparaîtra sans accès ; utilisez le script SQL fourni dans le guide pour lui attribuer un rôle, puis ajustez-le ici.</small></p></div>`;
  document.querySelectorAll('tr[data-id] button').forEach(b=>b.onclick=async()=>{const r=b.closest('tr');
    const {error}=await sb.from('profils_admin').update({nom:$('.n',r).value,role:$('.r',r).value,actif:$('.a',r).checked}).eq('user_id',r.dataset.id);
    $('#m').innerHTML=error?`<div class="err">${h(error.message)}</div>`:'<div class="ok">Enregistré.</div>'});
};

/* ============================ ESPACE PARENTS ============================ */
let CFG=null,CRED=null;
async function parentStart(){
  const {data}=await sb.rpc('parent_config');CFG=data;
  $('#app').innerHTML=`<div class="wrap"><div class="hero"><h1>ÉduPerf+ — Espace Parents</h1>Saisissez les notes de votre enfant et consultez son bulletin académique.</div><div id="pc"></div></div>`;
  loginParent();
}
function loginParent(msg){
  $('#pc').innerHTML=`<div class="card"><h3>Retrouver mon enfant</h3>${msg?`<div class="err">${h(msg)}</div>`:''}<p>Entrez l'ID ou le nom complet de votre enfant, puis le code familial qui vous a été remis.</p>
  <p><input id="q" placeholder="ID (ex. HA0917…) ou nom complet" style="width:100%"></p><p><input id="c" placeholder="Code familial" style="width:100%;text-transform:uppercase" autocomplete="off"></p><button class="btn" id="go" style="width:100%">Accéder au dossier</button></div>`;
  const run=async()=>{CRED={q:$('#q').value.trim(),c:$('#c').value.trim()};if(!CRED.q||!CRED.c)return loginParent('Veuillez remplir les deux champs.');
    await formParent()};
  $('#go').onclick=run;$('#c').onkeydown=e=>{if(e.key==='Enter')run()};
}
async function formParent(pid){
  const periodes=CFG.periodes||[];if(!periodes.length){$('#pc').innerHTML='<div class="card">Aucune période n\'est ouverte pour le moment.</div>';return}
  const per=pid||periodes[0].id;
  const {data}=await sb.rpc('parent_obtenir',{p_q:CRED.q,p_code:CRED.c,p_periode:per});
  if(!data?.ok)return loginParent(data?.erreur||'Erreur de connexion.');
  const P=data.participant,pe=periodes.find(p=>p.id==per),lock=!pe.ouverte||['soumise','en_verification','validee'].includes(data.statut);
  $('#pc').innerHTML=`<div class="card"><h3>${h(P.nom)}</h3><small>ID : ${h(P.id)} · ${h(P.sexe)}</small>
  <p>Période : <select id="pp">${periodes.map(p=>`<option value="${p.id}" ${p.id==per?'selected':''}>${h(p.nom)}</option>`).join('')}</select> ${badge(data.statut)}</p>
  ${!pe.ouverte?'<div class="err">La saisie est fermée pour cette période.</div>':''}${data.statut==='rejetee'&&data.motif_rejet?`<div class="err">Notes à corriger : ${h(data.motif_rejet)}</div>`:''}
  ${data.statut==='validee'?'<div class="ok">Ces notes ont été validées officiellement.</div>':data.statut==='soumise'||data.statut==='en_verification'?'<div class="ok">Vos notes ont été soumises et sont en cours de vérification.</div>':''}
  <p>Classe : <select id="cl" ${lock?'disabled':''}><option value="">— Choisir la classe —</option>${CFG.classes.map(c=>`<option value="${c.id}" ${c.id==P.classe_id?'selected':''}>${h(c.nom)}</option>`).join('')}</select></p>
  ${CFG.matieres.map(m=>`<div class="nr"><label>${h(m.nom)} <small>(sur ${m.bareme})</small></label><input data-m="${m.id}" data-max="${m.bareme}" type="number" inputmode="decimal" min="0" max="${m.bareme}" step="0.01" value="${data.notes[m.id]??''}" ${lock?'disabled':''}></div>`).join('')}
  <div id="pm"></div>${lock?'':`<button class="btn l" id="sv">Enregistrer</button> <button class="btn" id="sm">Soumettre pour validation</button>`}
  <p style="margin-top:14px"><button class="btn m" id="bl">Voir le bulletin académique</button> <button class="btn l" id="qt">Quitter</button></p></div>`;
  $('#pp').onchange=e=>formParent(+e.target.value);$('#qt').onclick=()=>{CRED=null;loginParent()};$('#bl').onclick=bulletin;
  const send=async sub=>{
    const cl=+$('#cl').value;if(!cl)return $('#pm').innerHTML='<div class="err">Veuillez choisir la classe.</div>';
    const notes=[...document.querySelectorAll('[data-m]')].map(i=>({matiere_id:+i.dataset.m,valeur:i.value.replace(',','.')}));
    for(const i of document.querySelectorAll('[data-m]'))if(i.value!==''&&(+i.value<0||+i.value>+i.dataset.max))return $('#pm').innerHTML=`<div class="err">La note ne peut pas dépasser ${i.dataset.max}.</div>`;
    if(sub&&!confirm('Soumettre définitivement ces notes ? Vous ne pourrez plus les modifier.'))return;
    const {data:r}=await sb.rpc('parent_enregistrer_notes',{p_q:CRED.q,p_code:CRED.c,p_periode:per,p_classe:cl,p_notes:notes,p_soumettre:sub});
    if(!r?.ok)return $('#pm').innerHTML=`<div class="err">${h(r?.erreur||'Erreur')}</div>`;
    if(sub)formParent(per);else $('#pm').innerHTML='<div class="ok">Notes enregistrées.</div>'};
  if(!lock){$('#sv').onclick=()=>send(false);$('#sm').onclick=()=>send(true)}
}
async function bulletin(){
  const {data:b}=await sb.rpc('parent_bulletin',{p_q:CRED.q,p_code:CRED.c});if(!b?.ok)return loginParent(b?.erreur);
  const pr=(CFG.periodes||[]).map(p=>p.id),all=[1,2,3,4];
  const avgM=m=>{const v=all.map(p=>m.notes[p]).filter(x=>x!=null);return v.length?v.reduce((s,x)=>s+Number(x),0)/v.length:null};
  $('#pc').innerHTML=`<div class="card"><div class="noprint"><button class="btn l" onclick="formParent()">← Retour</button> <button class="btn m" onclick="print()">Imprimer / PDF</button></div>
  <h2 style="text-align:center;color:var(--m)">BULLETIN ACADÉMIQUE</h2><p style="text-align:center">ÉduPerf+ — Notes validées uniquement</p>
  <p><b>Nom :</b> ${h(b.participant.nom)}<br><b>ID :</b> ${h(b.participant.id)} · <b>Sexe :</b> ${h(b.participant.sexe)}<br><b>Classe :</b> ${h(b.participant.classe||'—')}</p>
  <div class="tw"><table class="bul"><tr><th>Matières</th>${all.map(p=>`<th>Période ${p}</th>`).join('')}<th>Moyenne</th></tr>${b.matieres.map(m=>`<tr><td style="text-align:left">${h(m.matiere)} <small>/${m.bareme}</small></td>${all.map(p=>`<td>${m.notes[p]??'—'}</td>`).join('')}<td><b>${fmt(avgM(m))}</b></td></tr>`).join('')}
  <tr><td style="text-align:left"><b>Moyenne générale (%)</b></td>${all.map(p=>`<td><b>${b.periodes[p]?fmt(b.periodes[p].moyenne):'—'}</b></td>`).join('')}<td><b>${b.annuelle?fmt(b.annuelle.moyenne):'—'}</b></td></tr>
  <tr><td style="text-align:left"><b>Rang</b></td>${all.map(p=>`<td>${b.periodes[p]?.rang??'—'}</td>`).join('')}<td>${b.annuelle?.rang??'—'}</td></tr></table></div>
  <p><b>Appréciation générale :</b> ${b.annuelle?({'Excellent':'Excellent travail','Bien':'Bon travail','À améliorer':'Des efforts sont nécessaires'}[b.annuelle.moyenne>=85?'Excellent':b.annuelle.moyenne>=70?'Bien':'À améliorer']):'—'}</p>
  <p style="margin-top:50px">Signature du responsable académique : ______________________</p></div>`;
}

isAdmin?adminStart():parentStart();
