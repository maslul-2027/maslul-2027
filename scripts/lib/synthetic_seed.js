// Synthetic course seed shared by the in-browser engine (preview) and the private TEST server host. SYNTHETIC DATA ONLY (invented names/numbers).
// X = the engine namespace, mem = the store object, SEED = {first,last} name lists, save = persist callback.
module.exports = function seed(X, mem, SEED, save) {
  var admin = { email: 'demo-admin@x.com', role: 'admin', courseScope: '*' };
    X.Courses.addUser(admin,{email:'demo-admin@x.com',role:'admin',display_name:'מנהל הדגמה'});
    var c=X.Courses.create(admin,{name:'קורס הדגמה (סינתטי)',start_date:'2099-01-01'}).id;X.Courses.addUser(admin,{email:'demo-cmd@x.com',role:'commander',display_name:'מפקד הדגמה',course_ids:[c]});var o=X.Courses.org(admin,c),N=60,i,used={};
    for(i=0;i<N;i++){var nm,k=i;do{nm=SEED.first[(k*7+i)%SEED.first.length]+' '+SEED.last[(k*3+i*5)%SEED.last.length];k++;}while(used[nm]);used[nm]=1;var t=o.teams[i%o.teams.length];
      X.Soldiers.create(admin,c,{full_name:nm,personal_number:String(9000100+i),gender:i%5===4?'F':'M',department_id:t.department_id,team_id:t.id});}
    X.api('assignments.create',{data:{course_id:c,user_email:'demo-cmd@x.com',scope_type:'team',scope_id:o.teams[0].id,reason:'שיוך הדגמה'}});var sol=X.api('soldiers.list',{courseId:c,opts:{}}).data;[0,7,19].forEach(function(ix,j){X.api('followups.create',{courseId:c,data:{soldier_id:sol[ix].id,what_to_check:['השלמת מעקב כשירות','בדיקת דיווחים חסרים','אישור סיכום שבועי'][j],due_date:'2099-01-1'+(j+1)}});});

    var acts=X.api('acttypes.list',{courseId:c}).data,at=(acts&&acts[0])||X.api('acttypes.create',{courseId:c,name:'אימון'}).data,nowD=new Date(),pad=function(n){return (n<10?'0':'')+n;},iso=function(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
    var prev=new Date(nowD.getFullYear(),nowD.getMonth()-1,12),cur=new Date(Math.max(nowD.getTime()-86400000,new Date(nowD.getFullYear(),nowD.getMonth(),1).getTime()));
    sol=X.api('soldiers.list',{courseId:c,opts:{}}).data;
    var exd=X.api('exams.defCreate',{courseId:c,data:{name:'מבחן עיוני — הדגמה'}}).data,nvt=X.api('navtypes.create',{courseId:c,name:'ניווט יום'}).data;
    for(i=0;i<44;i++){[[prev,0],[cur,4]].forEach(function(pr,j){var b=pr[1],k='seed-'+i+'-'+j,sid=sol[i].id,dd=iso(pr[0]);
      X.api('exams.attempt',{courseId:c,data:{request_id:'e'+k,soldier_id:sid,exam_id:exd.id,attempt:'A',attempt_date:dd,score:68+b+(i%13)}});
      X.api('mk.create',{courseId:c,data:{request_id:'m'+k,soldier_id:sid,test_date:dd,weapon_type:'M16',distance_m:100,examiner_score:64+b+(i%15),weapon_zeroed:true}});
      if(i<36)X.api('nav.create',{courseId:c,data:{request_id:'n'+k,soldier_id:sid,test_date:dd,navigation_type_id:nvt.id,distance_km:3,plan_score:3+(i%2),debrief_score:3+((i+b)%2),points_completed:3+(i%3),points_total:5}});});}
    /* fitness (כש״ג): raw component values only — the demo has NO approved scoring table, so the report honestly shows BLOCKED for the weighted score (never a fabricated score) */
    var ftt=(X.api('fitness.types',{courseId:c}).data||[]).filter(function(x){return !x.is_opening;})[0];
    if(ftt)for(i=12;i<44;i++){[[prev,0],[cur,1]].forEach(function(pr,j){var b=pr[1];X.api('fitness.create',{courseId:c,data:{request_id:'f-'+i+'-'+j,soldier_id:sol[i].id,test_date:iso(pr[0]),test_type_id:ftt.id,pullups:6+b+(i%7),parallel_bars:12+b+(i%8),trap_bar:6+b+(i%4),run150x2:'00:'+(58-b-(i%6)),run3km:(14-b)+':'+(i%6)+'0'}});});}
    [[prev,5],[cur,2]].forEach(function(pr,j){for(var e=0;e<2;e++){var d=new Date(pr[0].getTime()+e*86400000*2);X.api('attendance.create',{courseId:c,data:{request_id:'seed-a'+j+e,event_date:iso(d),activity_type_id:at.id,scope_type:'course',scope_id:c,absent:sol.slice(e*3,e*3+pr[1]).map(function(x){return {soldier_id:x.id};})}});}});
    save();
};
module.exports.NAMES = { first: ['אלון', 'בן', 'גיל', 'דור', 'הדס', 'ורד', 'זיו', 'חן', 'טל', 'יובל', 'כרמל', 'לירן', 'מיכל', 'נועם', 'סהר', 'עידן', 'פז', 'צחי', 'קורן', 'רוני', 'שיר', 'תומר', 'אביב', 'גלי', 'דקל', 'הילה', 'ירדן', 'לבן', 'מור', 'נדב'], last: ['לוי', 'כהן', 'מזרחי', 'פרץ', 'ביטון', 'אברהם', 'דגן', 'אורן', 'נחום', 'זיו', 'עמית', 'שגיא', 'ברק', 'גולן', 'רז', 'שלו', 'טל', 'הדר', 'קדם', 'ארז'] };
