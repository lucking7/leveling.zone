"use client";

import { useEffect, useId, useRef } from "react";
import { Check, Languages } from "lucide-react";
import { useLocale, type Locale } from "./locale";

const choices: { value: Locale; label: string; lang: string }[] = [
  { value: "zh", label: "简体中文", lang: "zh-CN" },
  { value: "en", label: "English", lang: "en" },
];

export function LanguageMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { locale, setLocale, t } = useLocale();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const initialFocus = useRef<number | null>(null);
  const changeOpen = useRef(onOpenChange);
  changeOpen.current = onOpenChange;

  useEffect(() => {
    if (!open) return;
    items.current[initialFocus.current ?? choices.findIndex(choice => choice.value === locale)]?.focus();
    initialFocus.current = null;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) changeOpen.current(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, locale]);

  const closeAndRestore = () => {
    onOpenChange(false);
    trigger.current?.focus();
  };

  return <div ref={root} className="language-menu" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) onOpenChange(false);
  }}>
    <button ref={trigger} type="button" className="language-switch icon-button"
      aria-label={t("选择语言", "Select language")} title={t("选择语言", "Select language")}
      aria-haspopup="menu" aria-expanded={open} aria-controls={id}
      onClick={() => onOpenChange(!open)}
      onKeyDown={event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          initialFocus.current = event.key === "ArrowDown" ? 0 : choices.length - 1;
          onOpenChange(true);
        } else if (event.key === "Escape" && open) {
          event.preventDefault();
          closeAndRestore();
        }
      }}><Languages size={18} aria-hidden="true" /></button>
    {open && <div id={id} className="language-popover" role="menu" aria-label={t("语言", "Language")}
      onKeyDown={event => {
        const current = items.current.findIndex(item => item === document.activeElement);
        let next: number | undefined;
        if (event.key === "ArrowDown") next = (current + 1) % choices.length;
        if (event.key === "ArrowUp") next = (current + choices.length - 1) % choices.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = choices.length - 1;
        if (next !== undefined) { event.preventDefault(); items.current[next]?.focus(); }
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeAndRestore(); }
        if (event.key === "Tab") closeAndRestore();
      }}>
      {choices.map((choice, index) => <button key={choice.value} ref={node => { items.current[index] = node; }}
        type="button" role="menuitemradio" aria-checked={locale === choice.value} tabIndex={-1}
        lang={choice.lang} onClick={() => { setLocale(choice.value); closeAndRestore(); }}>
        <span>{choice.label}</span>{locale === choice.value && <Check size={16} aria-hidden="true" />}
      </button>)}
    </div>}
  </div>;
}
