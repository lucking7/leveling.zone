"use client";

import { LanguageMenu } from "./language-menu";
import { OrbitLogo } from "./orbit-logo";
import { useLocale } from "./locale";
import Link from "next/link";
import { isValidElement, useEffect, useRef, useState, type FormEventHandler, type ReactNode } from "react";
import { Copy, Check, Menu, Moon, Sun, Search, X, Monitor, MapPin, FileSearch, Github, Network } from "lucide-react";

export function Workspace({ active, children }: {
  active: "query" | "geoip" | "myip" | "whois" | "egress";
  children: ReactNode;
}) {
  const { t } = useLocale();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [search, setSearch] = useState("");
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
    const desktop = window.matchMedia("(min-width: 769px)");
    const closeOnDesktop = () => { if (desktop.matches) setMenuOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [menuOpen]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try { localStorage.setItem("orbit.theme", next ? "dark" : "light"); } catch {}
  };
  const closeMenu = () => setMenuOpen(false);
  const navigation = <>
    <Link href="/myip" onClick={closeMenu} aria-current={active === "myip" ? "page" : undefined}><Monitor className="navigation-icon" size={16} aria-hidden="true" />{t("我的 IP", "My IP")}</Link>
    <Link href="/geoip" onClick={closeMenu} aria-current={active === "geoip" || active === "query" ? "page" : undefined}><MapPin className="navigation-icon" size={16} aria-hidden="true" />GeoIP</Link>
    <Link href="/whois" onClick={closeMenu} aria-current={active === "whois" ? "page" : undefined}><FileSearch className="navigation-icon" size={16} aria-hidden="true" />Whois</Link>
    <Link href="/egress" onClick={closeMenu} aria-current={active === "egress" ? "page" : undefined}><Network className="navigation-icon" size={16} aria-hidden="true" />{t("出口检测", "Egress")}</Link>
    <a href="https://github.com/lucking7/leveling.zone" onClick={closeMenu} target="_blank" rel="noreferrer"><Github className="navigation-icon" size={16} aria-hidden="true" />GitHub</a>
  </>;

  return <div className="workspace-shell">
    <a className="skip-link" href="#main">{t("跳至内容", "Skip to content")}</a>
    <header ref={headerRef} className="site-header">
      <Link className="wordmark" href="/" aria-label="ORBIT" onClick={closeMenu}><OrbitLogo /></Link>
      <nav className="desktop-navigation" aria-label={t("主导航", "Main navigation")}>{navigation}</nav>
      <form className="header-search" role="search" onSubmit={event => {
        event.preventDefault();
        if (search.trim()) window.location.assign(`/${active === "whois" ? "whois" : "geoip"}/${encodeURIComponent(search.trim())}`);
      }}>
        <Search size={14} aria-hidden="true" />
        <input aria-label={t("快速查询 IP", "Quick IP lookup")} placeholder="IPv4 / IPv6" value={search} onChange={event => setSearch(event.target.value)} maxLength={45} autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="search" />
      </form>
      <div className="header-actions">
        <LanguageMenu open={languageOpen} onOpenChange={open => { setLanguageOpen(open); if (open) setMenuOpen(false); }} />
        <button type="button" className="icon-button theme-switch" aria-label={dark ? t("切换浅色", "Switch to light mode") : t("切换深色", "Switch to dark mode")} onClick={toggleTheme}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
        <button ref={menuButtonRef} type="button" className="icon-button menu-toggle" aria-label={t("主导航菜单", "Navigation menu")} aria-expanded={menuOpen} aria-controls="primary-navigation-mobile" onClick={() => { setLanguageOpen(false); setMenuOpen(open => !open); }}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
      <nav id="primary-navigation-mobile" className={`mobile-navigation${menuOpen ? " is-open" : ""}`} aria-label={t("主导航", "Main navigation")}>{navigation}</nav>
    </header>
    <main id="main" tabIndex={-1}>{children}</main>
    <footer className="site-footer">
      <p>ORBIT · {t("IP 地址与网络信息", "IP address and network information")}</p>
      <p className="database-credit">ORBIT uses the IP2Location LITE database for <a href="https://lite.ip2location.com" target="_blank" rel="noreferrer">IP geolocation</a>.</p>
      <p>{t("位置为数据源估计。注册信息来自权威 RDAP 服务。", "Locations are estimates. Registration data comes from authoritative RDAP services.")}</p>
    </footer>
  </div>;
}

export function LookupForm({value,onChange,onSubmit,isLoading=false,label,placeholder,id="ip-address"}: {
 value:string;onChange:(value:string)=>void;onSubmit:FormEventHandler<HTMLFormElement>;isLoading?:boolean;label?:string;placeholder?:string;id?:string;
}) {
 const {t}=useLocale();
 return <form className="lookup-form" onSubmit={onSubmit} aria-busy={isLoading}>
  <label className="sr-only" htmlFor={id}>{label || t("IP 地址", "IP address")}</label>
  <input id={id} value={value} onChange={event=>onChange(event.target.value)} placeholder={placeholder || t("IPv4 / IPv6 地址", "IPv4 / IPv6 address")} autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="search" maxLength={45} required />
  <button className="primary-button" type="submit" disabled={isLoading}>{isLoading ? t("查询中…", "Searching…") : t("查询", "Search")}</button>
 </form>;
}

export function CopyButton({value,label:providedLabel,compact=false}: {value:string;label?:string;compact?:boolean}) {
 const {t}=useLocale();const label=providedLabel || t("复制", "Copy");
 const [state,setState]=useState<"idle"|"copied"|"failed">("idle");
 const timer=useRef<ReturnType<typeof setTimeout>>();const revision=useRef(0);
 useEffect(()=>{revision.current++;setState("idle");return ()=>{revision.current++;clearTimeout(timer.current);};},[value,label]);
 async function copy(){
  clearTimeout(timer.current);const current=++revision.current;
  try {
   if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
   else {
    const selected=document.activeElement as HTMLElement|null;
    const area=document.createElement('textarea');area.value=value;area.style.cssText='position:fixed;left:-9999px;top:0';document.body.append(area);area.select();
    try {if(!document.execCommand('copy'))throw new Error('Copy unavailable');} finally {area.remove();selected?.focus({preventScroll:true});}
   }
   if(current===revision.current)setState('copied');
  }catch{if(current===revision.current)setState('failed');}
  if(current===revision.current)timer.current=setTimeout(()=>setState('idle'),2500);
 }
 return <span className={`copy-control ${compact ? "is-compact" : ""}`}><button className={compact ? "icon-button copy-button" : "secondary-button"} type="button" data-state={state} aria-label={label} onClick={copy}>{state==='copied'?<Check size={14} aria-hidden="true"/>:<Copy size={14} aria-hidden="true"/>}{!compact && label}</button><span className={state==='failed'?"copy-error":"sr-only"} role="status">{state==='failed'?t("复制失败，请手动选择文本。","Copy failed. Select the text manually."):state==='copied'?t(`${label}：已复制`,`${label}: copied`):''}</span></span>;
}
export function StatusNotice({children,tone="neutral"}:{children:ReactNode;tone?:"error"|"warning"|"neutral"}){return <div className={`notice notice-${tone}`} role={tone==='error'?'alert':'status'}>{children}</div>;}
export function DataPanel({title,actions,children}:{title:ReactNode;actions?:ReactNode;children:ReactNode}){return <section className="data-panel"><header className={`panel-heading${typeof title === "string" && title.includes(":") ? " has-ipv6-title" : ""}`}><h2 className={typeof title === "string" && /^[\da-fA-F:.]+$/.test(title) ? "mono" : undefined}>{title}</h2>{actions && <div className="panel-actions">{actions}</div>}</header>{isValidElement(children) && children.type === "pre" ? <div className="record-list">{children}</div> : <dl className="record-list">{children}</dl>}</section>;}
export function DataRow({label,value,copyValue,mono=false}:{label:string;value:ReactNode;copyValue?:string;mono?:boolean}){const {t}=useLocale();const copyText=copyValue ?? (typeof value === "string" ? value : undefined);return <div className={`record-row${copyText ? " has-copy" : ""}`}><dt>{label}</dt><dd><div className={`record-value${mono ? " mono" : ""}`}>{value}</div>{copyText && <CopyButton value={copyText} label={t(`复制${label}`,`Copy ${label}`)} compact/>}</dd></div>;}
