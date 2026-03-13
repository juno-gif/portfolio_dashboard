'use client';

import { useEffect, useRef, useState } from 'react';

// Bookmarklet JS template — %%ORIGIN%% and %%TOKEN%% are replaced at runtime
const BM_TEMPLATE = `(function(){
'use strict';
var O='%%ORIGIN%%',T='%%TOKEN%%',SK='pfbm1';
var PID='__pfbm__';
var ex=document.getElementById(PID);if(ex){ex.remove();return;}
var draft={h:[],tabs:[]};
try{draft=JSON.parse(sessionStorage.getItem(SK+'d')||'{"h":[],"tabs":[]}')}catch(e){}
var tabLabel='주식';
var atel=document.querySelector('.tab_area .on,.tab_area .active,.tabUl .on,.tabUl .active,[role=tab][aria-selected=true],[class*=tab][class*=active],[class*=tab][class*=on]');
if(atel)tabLabel=atel.textContent.trim().replace(/\\s+/g,' ').slice(0,10);
function findTable(){
  var all=Array.from(document.querySelectorAll('table'));
  return all.sort(function(a,b){return b.querySelectorAll('tbody tr').length-a.querySelectorAll('tbody tr').length})[0]||null;
}
function findCol(hdrs,kws){
  for(var i=0;i<hdrs.length;i++)for(var j=0;j<kws.length;j++)if(hdrs[i].includes(kws[j]))return i;
  return -1;
}
function extractCode(el){
  if(!el)return'';
  var a=el.querySelector('a')||el;
  var str='';
  for(var i=0;i<a.attributes.length;i++)str+=' '+a.attributes[i].value;
  var m=str.match(/(?:^|[^0-9])((?:0[1-9]|[1-9][0-9])[0-9]{4})(?:[^0-9]|$)/);
  return m?m[1]:'';
}
function extractHoldings(tbl){
  if(!tbl)return[];
  var hrow=tbl.querySelector('thead tr,tr:first-child');
  var hdrs=hrow?Array.from(hrow.querySelectorAll('th,td')).map(function(c){return c.textContent.trim();}):[];
  var c종목명=findCol(hdrs,['종목명','종목']);if(c종목명<0)c종목명=1;
  var c통화=findCol(hdrs,['통화','화폐']);if(c통화<0)c통화=3;
  var c수량=findCol(hdrs,['보유수량','수량','잔고수량']);if(c수량<0)c수량=5;
  var c매입=findCol(hdrs,['매입금액','매입']);if(c매입<0)c매입=6;
  var c평균=findCol(hdrs,['평균단가','평단가','평균매입']);
  var c계좌=findCol(hdrs,['계좌번호','계좌']);if(c계좌<0)c계좌=0;
  function num(s){return parseFloat((s||'').replace(/[,\\s원%]/g,''))||0;}
  var out=[];
  Array.from(tbl.querySelectorAll('tbody tr')).forEach(function(row){
    var cells=row.querySelectorAll('td');if(cells.length<4)return;
    var get=function(i){return i>=0&&cells[i]?cells[i].textContent.trim():'';};
    var 종목명=get(c종목명);if(!종목명||종목명==='-')return;
    var 종목번호=extractCode(cells[c종목명]);
    var 통화=(get(c통화)||'KRW').toUpperCase();
    var 단위=통화==='USD'?'USD':'KRW';
    var 수량=num(get(c수량));if(수량<=0)return;
    var 평균단가=c평균>=0?num(get(c평균)):0;
    if(!평균단가){var 매입=num(get(c매입));if(매입>0)평균단가=Math.round(매입/수량);}
    if(!평균단가)return;
    var 계좌=get(c계좌)||'미래에셋';
    out.push({계좌:계좌,종목명:종목명,종목번호:종목번호,수량:수량,평균단가:평균단가,단위:단위,_tab:tabLabel});
  });
  return out;
}
var table=findTable();
var extracted=extractHoldings(table);
function mk(tag,css,txt){var e=document.createElement(tag);if(css)e.style.cssText=css;if(txt!==undefined)e.textContent=txt;return e;}
var panel=mk('div','position:fixed;top:16px;right:16px;z-index:2147483647;width:360px;max-height:86vh;overflow-y:auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.2);padding:16px;font:13px/1.5 -apple-system,sans-serif;color:#111827;box-sizing:border-box;');
panel.id=PID;
var hdr=mk('div','display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;');
hdr.appendChild(mk('span','font-size:14px;font-weight:600;','포트폴리오 동기화 · 미래에셋'));
var bx=mk('button','background:none;border:none;font-size:16px;cursor:pointer;color:#9ca3af;padding:0 4px;','✕');
bx.onclick=function(){panel.remove();};hdr.appendChild(bx);panel.appendChild(hdr);
var body=mk('div','');panel.appendChild(body);document.body.appendChild(panel);
render();
function render(){
  body.innerHTML='';
  var TABS=['주식','상품현물','CMA/RP','퇴직연금'];
  var tbadge=mk('div','display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;');
  TABS.forEach(function(t){
    var done=draft.tabs.indexOf(t)>=0;
    var cur=tabLabel.replace(/[\\s·\/]/g,'').includes(t.replace(/[\\s·\/]/g,''));
    var bg=done?'#dcfce7':cur?'#dbeafe':'#f3f4f6';
    var color=done?'#16a34a':cur?'#1d4ed8':'#9ca3af';
    tbadge.appendChild(mk('span','padding:2px 8px;border-radius:20px;font-size:11px;background:'+bg+';color:'+color+';',(done?'✓ ':cur?'▶ ':'')+t));
  });
  body.appendChild(tbadge);
  if(!table||extracted.length===0){
    body.appendChild(mk('p','color:#9ca3af;font-size:12px;margin:0 0 12px;','이 탭에서 보유 종목을 찾지 못했습니다.\n상품별 자산 → 각 탭에서 실행해주세요.'));
  } else {
    var missingCode=extracted.filter(function(h){return!h.종목번호;}).length;
    body.appendChild(mk('p','font-size:12px;color:#6b7280;margin:0 0 8px;','추출: '+extracted.length+'개'+(missingCode?' · ⚠ 코드 미확인: '+missingCode+'개':'')));
    if(missingCode>0){
      var warn=mk('div','background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:8px;font-size:11px;color:#92400e;margin-bottom:8px;','코드 미확인 종목은 업로드 전에 Naver에서 자동 조회합니다.');
      body.appendChild(warn);
    }
    var tbl=mk('table','width:100%;border-collapse:collapse;font-size:11px;margin-bottom:10px;');
    var headerRow=mk('tr','');
    ['종목명','수량','평균단가','코드'].forEach(function(h){
      var th=mk('th','text-align:left;padding:3px 4px;border-bottom:1px solid #e5e7eb;color:#9ca3af;font-weight:500;font-size:10px;',h);
      headerRow.appendChild(th);
    });
    tbl.appendChild(headerRow);
    extracted.slice(0,6).forEach(function(h){
      var tr=mk('tr','');
      [h.종목명.slice(0,12)+(h.종목명.length>12?'…':''),h.수량.toLocaleString(),h.평균단가.toLocaleString(),h.종목번호||'?'].forEach(function(v,i){
        var td=mk('td','padding:3px 4px;border-bottom:1px solid #f9fafb;'+((!h.종목번호&&i===3)?'color:#f59e0b;':''),v);
        tr.appendChild(td);
      });
      tbl.appendChild(tr);
    });
    if(extracted.length>6){var tr=mk('tr','');var td=mk('td','padding:3px 4px;color:#9ca3af;','…외 '+(extracted.length-6)+'개');td.setAttribute('colspan','4');tr.appendChild(td);tbl.appendChild(tr);}
    body.appendChild(tbl);
  }
  if(draft.h.length>0)body.appendChild(mk('p','font-size:12px;color:#1d4ed8;margin:0 0 10px;background:#eff6ff;padding:6px 8px;border-radius:6px;','누적 수집: 총 '+draft.h.length+'개 종목'));
  var br=mk('div','display:flex;flex-direction:column;gap:6px;');
  if(extracted.length>0){
    var addBtn=mk('button','padding:8px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:500;border:1px solid #d1d5db;background:#f3f4f6;color:#374151;width:100%;','+ '+tabLabel+' 추가 ('+extracted.length+'개)');
    addBtn.onclick=function(){
      draft.h=draft.h.filter(function(h){return h._tab!==tabLabel;});
      draft.h=draft.h.concat(extracted);
      if(draft.tabs.indexOf(tabLabel)<0)draft.tabs.push(tabLabel);
      try{sessionStorage.setItem(SK+'d',JSON.stringify(draft));}catch(e){}
      render();
    };
    br.appendChild(addBtn);
  }
  if(draft.h.length>0){
    var br2=mk('div','display:flex;gap:6px;');
    var clrBtn=mk('button','flex:1;padding:8px;border-radius:7px;cursor:pointer;font-size:11px;border:1px solid #e5e7eb;background:#fff;color:#9ca3af;','초기화');
    clrBtn.onclick=function(){draft={h:[],tabs:[]};try{sessionStorage.removeItem(SK+'d');}catch(e){}render();};
    br2.appendChild(clrBtn);
    var upBtn=mk('button','flex:3;padding:8px;border-radius:7px;cursor:pointer;font-size:13px;font-weight:500;border:none;background:#111827;color:#fff;','업로드 ('+draft.h.length+'개) →');
    upBtn.onclick=function(){doUpload(upBtn);};
    br2.appendChild(upBtn);
    br.appendChild(br2);
  }
  body.appendChild(br);
}
function doUpload(b){
  var holdings=draft.h.length>0?draft.h:extracted;
  var missing=holdings.filter(function(h){return!h.종목번호&&h.단위==='KRW';});
  b.disabled=true;
  function buildAndSend(){
    var hdr='계좌,종목명,종목번호,수량,평균단가,단위';
    var rows=holdings.map(function(h){
      function q(s){return'"'+String(s||'').replace(/"/g,'""')+'"';}
      return[q(h.계좌),q(h.종목명),q(h.종목번호||'000000'),h.수량,h.평균단가,h.단위].join(',');
    });
    var csv='\\uFEFF'+hdr+'\\n'+rows.join('\\n');
    var url=T?O+'/api/portfolio?token='+T:O+'/api/portfolio';
    fetch(url,{method:'POST',body:csv,headers:{'Content-Type':'text/plain;charset=utf-8'}})
      .then(function(r){return r.json();})
      .then(function(d){
        if(d.token){
          b.textContent='완료! ✓';b.style.background='#16a34a';
          try{sessionStorage.removeItem(SK+'d');}catch(e){}
          setTimeout(function(){window.open(O+'?token='+d.token,'_blank');panel.remove();},900);
        }else throw new Error(d.error||'오류');
      })
      .catch(function(e){
        b.disabled=false;b.textContent='다시 시도';b.style.background='#dc2626';
        body.insertAdjacentHTML('afterbegin','<p style="color:#dc2626;font-size:12px;margin:0 0 8px;">오류: '+e.message+'</p>');
      });
  }
  if(missing.length>0){
    b.textContent='코드 조회 중... ('+missing.length+'개)';
    var ps=missing.map(function(h){
      return fetch(O+'/api/name2code?name='+encodeURIComponent(h.종목명))
        .then(function(r){return r.json();})
        .then(function(d){if(d.code)h.종목번호=d.code;})
        .catch(function(){});
    });
    Promise.all(ps).then(function(){b.textContent='업로드 중...';buildAndSend();});
  }else{
    b.textContent='업로드 중...';
    buildAndSend();
  }
}
})();`;

export default function BookmarkletPage() {
  const [origin, setOrigin] = useState('');
  const [token, setToken] = useState('');
  const [dragging, setDragging] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    const p = new URLSearchParams(window.location.search);
    setToken(p.get('token') || '');
  }, []);

  // React blocks javascript: URLs in href — set via DOM ref to bypass
  useEffect(() => {
    if (!linkRef.current || !origin) return;
    const code = BM_TEMPLATE
      .replace(/%%ORIGIN%%/g, origin)
      .replace(/%%TOKEN%%/g, token);
    linkRef.current.setAttribute('href', `javascript:${encodeURIComponent(code)}`);
  }, [origin, token]);

  return (
    <div className="min-h-screen bg-background p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <a href={token ? `/?token=${token}` : '/'} className="text-sm text-muted-foreground hover:text-foreground">
          ← 대시보드로 돌아가기
        </a>
      </div>

      <h1 className="text-xl font-bold mb-1">미래에셋 북마크릿 설치</h1>
      <p className="text-sm text-muted-foreground mb-8">
        미래에셋증권 상품별 자산 페이지에서 클릭 한 번으로 보유 종목을 대시보드에 동기화합니다.
      </p>

      {/* Step 1 */}
      <div className="space-y-6">
        <div className="border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center">1</span>
            <h2 className="font-semibold text-sm">북마크릿 설치</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            아래 버튼을 브라우저 북마크바로 드래그하거나, 우클릭 → 즐겨찾기 추가하세요.
          </p>
          {origin ? (
            <a
              ref={linkRef}
              draggable
              onDragStart={() => setDragging(true)}
              onDragEnd={() => setDragging(false)}
              onClick={(e) => e.preventDefault()}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed text-sm font-medium transition-colors select-none cursor-grab active:cursor-grabbing ${
                dragging
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border bg-muted hover:border-primary/50 hover:bg-muted/80'
              }`}
            >
              <span>📊</span>
              <span>미래에셋 포트폴리오 동기화</span>
            </a>
          ) : (
            <div className="h-10 w-48 bg-muted animate-pulse rounded-lg" />
          )}
          <p className="text-xs text-muted-foreground mt-3">
            북마크바가 안 보이면: Chrome → 설정 → 북마크 → 북마크 바 표시
          </p>
        </div>

        {/* Step 2 */}
        <div className="border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center">2</span>
            <h2 className="font-semibold text-sm">미래에셋에서 실행</h2>
          </div>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-foreground font-medium shrink-0">①</span>
              <span>
                미래에셋증권 로그인 후{' '}
                <span className="font-medium text-foreground">MY자산 → 상품별자산</span> 으로 이동
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-foreground font-medium shrink-0">②</span>
              <span>
                <span className="font-medium text-foreground">주식</span> 탭을 클릭해서 보유현황 표가 보이는 상태로 만들기
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-foreground font-medium shrink-0">③</span>
              <span>북마크릿 클릭 → 오른쪽에 패널이 뜨면 <span className="font-medium text-foreground">+ 주식 추가</span></span>
            </li>
            <li className="flex gap-2">
              <span className="text-foreground font-medium shrink-0">④</span>
              <span>
                <span className="font-medium text-foreground">상품현물, CMA/RP, 퇴직연금</span> 탭도 같은 방법으로 순서대로 추가 (없으면 건너뛰어도 됨)
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-foreground font-medium shrink-0">⑤</span>
              <span>
                <span className="font-medium text-foreground">업로드</span> 버튼 클릭 → 대시보드가 새 탭으로 열림
              </span>
            </li>
          </ol>
        </div>

        {/* Notes */}
        <div className="border rounded-xl p-5 bg-muted/30">
          <h2 className="font-semibold text-sm mb-3">참고</h2>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li>• 종목코드를 자동으로 찾지 못한 경우 Naver Finance에서 조회 후 업로드합니다</li>
            <li>• 탭별 데이터는 세션 동안 유지되며, 브라우저를 닫으면 초기화됩니다</li>
            <li>• 기존 데이터를 덮어씁니다 — 매수/매도 후 다시 실행하면 최신 상태로 갱신됩니다</li>
            <li>• 비밀번호 등 민감한 정보는 전송하지 않습니다 (보유수량/평균단가만 전송)</li>
          </ul>
        </div>

        {!token && (
          <div className="border border-amber-200 rounded-xl p-5 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <span className="font-semibold">토큰 없음:</span> 대시보드에서 CSV를 한 번 업로드하면 토큰이 생성되고,
              해당 URL에서 이 페이지를 열면 토큰이 자동으로 연결됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
