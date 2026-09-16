import type { ReactNode } from "react";

const supportedCodes = new Set(["af","ax","al","dz","as","ad","ao","ai","aq","ag","ar","am","aw","au","at","az","bs","bh","bd","bb","by","be","bz","bj","bm","bt","bo","bq","ba","bw","bv","br","io","bn","bg","bf","bi","cv","kh","cm","ca","ky","cf","td","cl","cn","cx","cc","co","km","ck","cr","hr","cu","cw","cy","cz","ci","cd","dk","dj","dm","do","ec","eg","sv","gq","er","ee","sz","et","fk","fo","fm","fj","fi","fr","gf","pf","tf","ga","gm","ge","de","gh","gi","gr","gl","gd","gp","gu","gt","gg","gn","gw","gy","ht","hm","va","hn","hk","hu","is","in","id","ir","iq","ie","im","il","it","jm","jp","je","jo","kz","ke","ki","xk","kw","kg","la","lv","lb","ls","lr","ly","li","lt","lu","mo","mg","mw","my","mv","ml","mt","mh","mq","mr","mu","yt","mx","md","mc","mn","me","ms","ma","mz","mm","na","nr","np","nl","nc","nz","ni","ne","ng","nu","nf","kp","mk","mp","no","om","pk","pw","pa","pg","py","pe","ph","pn","pl","pt","pr","qa","cg","ro","ru","rw","re","bl","sh","kn","lc","mf","pm","vc","ws","sm","st","sa","sn","rs","sc","sl","sg","sx","sk","si","sb","so","za","gs","kr","ss","es","lk","ps","sd","sr","sj","se","ch","sy","tw","tj","tz","th","tl","tg","tk","to","tt","tn","tm","tc","tv","tr","ug","ua","ae","gb","um","us","uy","uz","vu","ve","vn","vg","vi","wf","eh","ye","zm","zw"]);

export function CountryLabel({ code, children }: { code?: string | null; children: ReactNode }) {
  const normalized = code?.trim().toLowerCase();
  const validCode = normalized === "uk" ? "gb" : normalized;
  if (!validCode || !supportedCodes.has(validCode)) return <>{children}</>;
  return <span className="country-label"><img className="country-flag" src={`/flags/4x3/${validCode}.svg`} width={20} height={15} alt="" aria-hidden="true" loading="lazy" decoding="async" /><span>{children}</span></span>;
}
