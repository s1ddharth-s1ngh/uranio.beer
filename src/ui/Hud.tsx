import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import uranioMark from "../assets/uranio-mark.png";
import { LangSwitch, NavLinks } from "../components/nav";
import { HUD_LETTERS } from "../content/steps.it";
import { LAST_STEP } from "../config/theme.ts";
import { useAudioEnabled } from "../hooks/useAudioEnabled";
import { ProgressBar } from "./ProgressBar";
import { StepIcons } from "./StepIcons";
import styles from "./Hud.module.css";

/** le lettere di sfondo entrano una alla volta, in ordine sparso */
const LETTER_STAGGER_MS = 30;

/**
 * In quale turno entra ogni lettera.
 *
 * L'ordine è sparso ma **deterministico**, calcolato una volta sola
 * all'importazione: una permutazione da `Math.random()` renderebbe la pagina
 * diversa a ogni ricarica (e, dentro un render di React, instabile a ogni
 * render). Sparso serve perché le lettere non entrino da sinistra a destra
 * come un titolo; casuale per davvero non serve a niente.
 */
function turni(parola: string): number[] {
  const peso = [...parola].map((_, i) => {
    const x = Math.sin((i + 1) * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  });
  const ordine = peso.map((_, i) => i).sort((a, b) => peso[a] - peso[b]);
  const ritardo = new Array<number>(parola.length);
  ordine.forEach((lettera, turno) => {
    ritardo[lettera] = turno * LETTER_STAGGER_MS;
  });
  return ritardo;
}

const RITARDI = {
  top: turni(HUD_LETTERS.top),
  bottom: turni(HUD_LETTERS.bottom),
} as const;

/**
 * Le lettere a bassa opacità sullo sfondo (spec 3.7 e 8.16): "CRISI" in alto,
 * "ECONOMICA" in basso, distribuite su tutta la larghezza.
 */
function HudLetters() {
  return (
    <div className={styles.letters} aria-hidden="true">
      {(["top", "bottom"] as const).map((riga) => (
        <div key={riga} className={`${styles.lettersRow} ${styles[riga]}`}>
          {[...HUD_LETTERS[riga]].map((ch, i) => (
            <span
              key={`${riga}-${i}`}
              className={styles.letter}
              style={{ animationDelay: `${RITARDI[riga][i]}ms` }}
            >
              {ch}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * L'interfaccia fissa: header, angolari, trattini, lettere di sfondo
 * (spec 8.16).
 *
 * Tutto lo strato è `pointer-events: none` e solo i controlli si riaccendono:
 * un HUD che intercetta la rotella fermerebbe l'esperienza nel punto esatto in
 * cui sta sopra la bottiglia.
 */
export function Hud({
  step,
  className,
}: {
  step: number;
  className?: string;
}) {
  const { pathname } = useLocation();
  const lang = pathname.startsWith("/en") ? "en" : "it";
  const [audio, toggleAudio] = useAudioEnabled();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // l'esperienza usa le frecce e lo spazio: Esc è l'unico tasto che qui
      // deve avere la precedenza, e va fermato prima di arrivare al motore
      e.stopPropagation();
      setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [menuOpen]);

  return (
    <div
      className={`${className ?? ""} ${styles.hud} ${
        step === LAST_STEP ? styles.quiet : ""
      }`}
    >
      <HudLetters />
      <ProgressBar step={step} />
      <StepIcons step={step} />

      {/* angolari a L ai quattro angoli del frame */}
      <div className={styles.corners} aria-hidden="true">
        <i className={styles.tl} />
        <i className={styles.tr} />
        <i className={styles.bl} />
        <i className={styles.br} />
      </div>

      {/* trattini sui bordi laterali a un quarto, metà e tre quarti */}
      <div className={styles.ticks} aria-hidden="true">
        {[25, 50, 75].map((y) => (
          <i key={`l${y}`} className={styles.tickLeft} style={{ top: `${y}%` }} />
        ))}
        {[25, 50, 75].map((y) => (
          <i key={`r${y}`} className={styles.tickRight} style={{ top: `${y}%` }} />
        ))}
      </div>

      <header className={styles.header}>
        <button
          type="button"
          className={`${styles.audio} t-label`}
          aria-pressed={audio}
          onClick={toggleAudio}
        >
          <span>AUDIO</span>
          <span className={styles.audioState}>{audio ? "ON" : "OFF"}</span>
          {/* quattro barrette da equalizzatore: oscillano solo ad audio
              acceso, perché un'animazione perenne in un angolo è rumore */}
          <span
            className={`${styles.bars} ${audio ? styles.barsOn : ""}`}
            aria-hidden="true"
          >
            <i />
            <i />
            <i />
            <i />
          </span>
        </button>

        {/* TODO: serve l'SVG del logo Uranio — questo PNG a 120 px è un
            segnaposto e si vede che lo è (domanda aperta, docs/AUDIT.md) */}
        <Link to="/" className={styles.logo} aria-label="Uranio">
          <img src={uranioMark} alt="" width={120} height={120} decoding="async" />
        </Link>

        <div className={styles.right}>
          <button
            type="button"
            className={`${styles.menu} t-label`}
            aria-expanded={menuOpen}
            aria-controls="hud-menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span aria-hidden="true">⁚⁚</span>
            {menuOpen
              ? lang === "en"
                ? "CLOSE"
                : "CHIUDI"
              : "MENU"}
          </button>
          <a className={styles.contact} href="#contatti">
            {lang === "en" ? "CONTACT" : "CONTATTI"}
          </a>
        </div>
      </header>

      {/* il menu è quello del sito: voci e switch di lingua arrivano da
          `components/nav.tsx`, condiviso con la TopBar (regola 10.1.10) */}
      <div
        id="hud-menu"
        className={`${styles.menuPanel} ${menuOpen ? styles.menuOpen : ""}`}
        aria-hidden={!menuOpen}
      >
        <nav
          className={styles.menuNav}
          aria-label={lang === "en" ? "Main menu" : "Menu principale"}
        >
          <NavLinks
            lang={lang}
            className={styles.menuLink}
            onNavigate={() => setMenuOpen(false)}
          />
        </nav>
        <LangSwitch lang={lang} label={lang === "en" ? "Language" : "Lingua"} />
      </div>
    </div>
  );
}
