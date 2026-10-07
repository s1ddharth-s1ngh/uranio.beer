// Le voci del menu e i due pezzi di navigazione condivisi.
//
// Erano dentro `TopBar.tsx`; sono qui perché li usa anche l'header HUD
// dell'esperienza (task 8.16), che della barra attuale rifà il guscio ma
// **non** la logica del menu (regola 10.1.10: il menu del sito è quello che
// c'è, non se ne scrive un secondo). Le classi arrivano da
// `TopBar.module.css`, che resta la fonte dello stile di questi due pezzi.

import { Link } from "react-router-dom";
import styles from "./TopBar.module.css";

// ✏️ Voci di menu — aggiorna gli href quando le sezioni saranno pronte
const NAV_ITEMS = [
  { href: "#about", it: "Chi siamo", en: "About us" },
  { href: "#crisi-economica", it: "Crisi economica", en: "Economic crisis" },
  { href: "#servizi", it: "Servizi", en: "Services" },
  { href: "/slash-experiment", it: "Esperimenti", en: "Experiments" },
  { href: "#contatti", it: "Contatti", en: "Contacts" },
];

export function NavLinks({
  lang,
  className,
  onNavigate,
}: {
  lang: "it" | "en";
  className: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {NAV_ITEMS.map((item) =>
        item.href.startsWith("/") ? (
          <Link
            key={item.href}
            to={item.href}
            className={className}
            onClick={onNavigate}
          >
            {lang === "en" ? item.en : item.it}
          </Link>
        ) : (
          <a
            key={item.href}
            href={item.href}
            className={className}
            onClick={onNavigate}
          >
            {lang === "en" ? item.en : item.it}
          </a>
        ),
      )}
    </>
  );
}

export function LangSwitch({ lang, label }: { lang: "it" | "en"; label: string }) {
  return (
    <nav className={styles.lang} aria-label={label}>
      <Link
        to="/it"
        className={lang === "it" ? styles.active : styles.idle}
        aria-current={lang === "it" ? "true" : undefined}
      >
        it
      </Link>
      <span className={styles.sep} aria-hidden="true">
        /
      </span>
      <Link
        to="/en"
        className={lang === "en" ? styles.active : styles.idle}
        aria-current={lang === "en" ? "true" : undefined}
      >
        en
      </Link>
    </nav>
  );
}

