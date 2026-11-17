// I testi degli step: entrata dal basso lettera per lettera, uscita a righe
// verso l'alto (spec 7.6 e appendice 10.5).
//
// È una classe che si costruisce il suo DOM, non un componente React, e la
// ragione è una sola: durante una transizione **esistono due testi insieme**
// — il vecchio che esce e il nuovo che entra — e il nuovo entra a metà
// dell'uscita del vecchio. Con React bisognerebbe tenere in stato una coda di
// blocchi uscenti e rimuoverli a fine animazione; qui il blocco vecchio è un
// nodo che la sua timeline si porta via da sé. Il requisito "mai due testi
// sovrapposti" diventa così una riga di codice invece di una macchina a stati.
//
// Entrata e uscita muovono pezzi diversi, ed è voluto: si entra con le
// lettere del titolo e le parole del paragrafo, si esce con le righe che le
// contengono. Un'uscita che riprendesse gli stessi pezzi, a entrata
// interrotta, li farebbe ripassare in vista dal basso verso l'alto.

import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { TEXT } from "../config/text.ts";
import type { Step } from "../content/steps.it";
import styles from "./StepText.module.css";

gsap.registerPlugin(SplitText);

interface Blocco {
  el: HTMLElement;
  /** titolo e paragrafo: spezzati in due modi diversi, due split */
  split: SplitText[];
  tl: gsap.core.Timeline;
}

/**
 * Rimette la crenatura che lo split a lettere toglie.
 *
 * Una lettera per elemento non ha più la vicina con cui crenare, e in
 * Instrument Serif "Tr" e "Ve" si aprono di mezzo decimo del corpo
 * (misurato in Chromium): a 100 px sono 5–6 px di buco, e si vedono. La
 * correzione di ogni coppia la misura un canvas, che crena come il testo,
 * e va in `em` così segue il corpo se la finestra cambia.
 */
function crena(chars: Element[]) {
  const ctx = chars.length ? document.createElement("canvas").getContext("2d") : null;
  if (!ctx) return;
  const cs = getComputedStyle(chars[0]);
  ctx.font = `${cs.fontWeight} 100px ${cs.fontFamily}`;
  const w = (s: string) => ctx.measureText(s).width;
  for (let i = 1; i < chars.length; i++) {
    const a = chars[i - 1];
    const b = chars[i] as HTMLElement;
    // solo dentro la stessa parola: fra due parole c'è lo spazio
    if (a.parentNode !== b.parentNode) continue;
    const ta = a.textContent ?? "";
    const tb = b.textContent ?? "";
    const k = w(ta + tb) - w(ta) - w(tb);
    // solo le coppie che stringono: le righe sono già misurate, e una che
    // allarga potrebbe mandare a capo l'ultima parola dentro la sua riga
    if (k < -0.05) b.style.marginLeft = `${k / 100}em`;
  }
}

export class StepText {
  private host: HTMLElement;
  private reduced: boolean;
  private corrente: Blocco | undefined;
  /** l'id dello step mostrato: evita di rianimare lo stesso testo */
  private mostrato: string | undefined;

  constructor(host: HTMLElement, reduced = false) {
    this.host = host;
    this.reduced = reduced;
  }

  /**
   * Mostra il testo di uno step (o nessuno).
   *
   * `durata` è la durata della transizione 3D in corso: l'entrata parte al
   * 45% di quella, così il testo nuovo arriva mentre la bottiglia è già in
   * movimento e non dopo.
   */
  show(step: Step | null, durata: number) {
    const id = step?.id;
    if (id === this.mostrato) return;
    this.mostrato = id;

    this.esci();
    if (!step || (!step.title && !step.body)) {
      this.corrente = undefined;
      return;
    }
    this.corrente = this.entra(step, durata);
  }

  dispose() {
    this.corrente?.tl.kill();
    this.corrente?.split.forEach((s) => s.revert());
    this.host.replaceChildren();
    this.corrente = undefined;
    this.mostrato = undefined;
  }

  /** Il blocco in scena esce verso l'alto e si porta via il suo nodo. */
  private esci() {
    const vecchio = this.corrente;
    if (!vecchio) return;
    this.corrente = undefined;
    // uccidere la timeline di entrata è ciò che rende sicure le inversioni a
    // metà corsa: se non lo si fa, il blocco vecchio continua a entrare
    // mentre esce
    vecchio.tl.kill();
    // per lo screen reader il blocco che esce sparisce subito: due regioni
    // `aria-live` insieme farebbero annunciare anche il testo vecchio
    vecchio.el.removeAttribute("aria-live");
    vecchio.el.setAttribute("aria-hidden", "true");
    // su mobile spegne la sua sfumatura (StepText.module.css)
    vecchio.el.classList.add(styles.leaving);
    const via = () => {
      vecchio.split.forEach((s) => s.revert());
      vecchio.el.remove();
    };
    if (this.reduced) {
      gsap.to(vecchio.el, { opacity: 0, duration: 0.2, onComplete: via });
      return;
    }
    const { duration, stagger, ease, y, blur } = TEXT.exit;
    const tag = vecchio.el.querySelector(`.${styles.tag}`);
    const tl = gsap.timeline({ onComplete: via });
    // il tag si richiude verso destra: da qualunque punto sia arrivata la
    // sua entrata, i due bordi si incontrano senza riaprirlo
    if (tag) tl.to(tag, { clipPath: "inset(0% 0% 0% 100%)", duration, ease }, 0);
    tl.to(
      vecchio.split.flatMap((s) => s.lines),
      {
        yPercent: y,
        opacity: 0,
        filter: `blur(${blur}px)`,
        duration,
        stagger: { amount: stagger },
        ease,
      },
      0,
    );
  }

  private entra(step: Step, durata: number): Blocco {
    const el = this.render(step);
    this.host.appendChild(el);
    // le righe sono maschere, ed è ciò che fa sembrare che il testo scorra
    // dietro un bordo invece di sbiadire. Il titolo si spezza anche in
    // lettere (e in parole, che tengono insieme le lettere se la colonna si
    // stringe), il paragrafo solo in parole
    const titolo = SplitText.create(el.querySelectorAll(".t-display"), {
      type: "lines,words,chars",
      mask: "lines",
    });
    const corpo = SplitText.create(el.querySelectorAll(".t-body"), {
      type: "lines,words",
      mask: "lines",
      // l'`aria-label` che `auto` mette sull'elemento spezzato su un `<p>`
      // non vale (ARIA lo vieta sui paragrafi), e le parole nascoste lo
      // lascerebbero muto: qui il testo resta leggibile così com'è
      aria: "none",
    });
    crena(titolo.chars);
    const split = [titolo, corpo];
    // anche col moto ridotto si aspetta: il testo vecchio deve essere
    // sparito prima che arrivi il nuovo
    const tl = gsap.timeline({ delay: durata * TEXT.enter.delayFraction });

    if (this.reduced) {
      tl.from(el, { opacity: 0, duration: 0.25 });
      return { el, split, tl };
    }

    const tag = el.querySelector(`.${styles.tag}`);
    if (tag) {
      tl.fromTo(
        tag,
        { clipPath: "inset(0% 100% 0% 0%)" },
        { clipPath: "inset(0% 0% 0% 0%)", duration: TEXT.tag.duration, ease: TEXT.tag.ease },
        TEXT.tag.at,
      );
    }
    const { chars, words, strike } = TEXT;
    tl.from(
      titolo.chars,
      {
        yPercent: chars.y,
        rotateX: chars.rotateX,
        transformPerspective: 600,
        transformOrigin: "50% 100%",
        opacity: 0,
        filter: `blur(${chars.blur}px)`,
        duration: chars.duration,
        stagger: chars.stagger,
        ease: chars.ease,
        // a fine corsa niente stili inline: una trasformazione 3D o un
        // filtro rimasti, anche a zero, tengono ogni lettera su un suo
        // livello del compositor per tutto il tempo in cui il testo è letto
        clearProps: "transform,filter,opacity",
      },
      chars.at,
    );
    tl.from(
      corpo.words,
      {
        yPercent: 100,
        opacity: 0,
        duration: words.duration,
        stagger: words.stagger,
        ease: words.ease,
        clearProps: "transform,opacity",
      },
      words.at,
    );
    const riga = el.querySelector(`.${styles.strike}`);
    if (riga) {
      tl.from(
        riga,
        { scaleX: 0, transformOrigin: "left center", duration: strike.duration, ease: strike.ease },
        strike.at,
      );
    }
    return { el, split, tl };
  }

  /** Il markup di un blocco: tag, titolo, paragrafo (spec 8.18). */
  private render(step: Step): HTMLElement {
    const el = document.createElement("div");
    el.className = styles.block;
    // il testo resta leggibile dagli screen reader e annunciato quando cambia
    el.setAttribute("aria-live", "polite");

    if (step.tag) {
      const tag = document.createElement("p");
      tag.className = `${styles.tag} t-label`;
      const filo = document.createElement("i");
      filo.className = styles.tagRule;
      filo.setAttribute("aria-hidden", "true");
      const testo = document.createElement("span");
      testo.className = styles.tagText;
      testo.textContent = step.tag.text;
      if (step.tag.strike) {
        const riga = document.createElement("i");
        riga.className = styles.strike;
        riga.setAttribute("aria-hidden", "true");
        testo.appendChild(riga);
      }
      tag.append(filo, testo);
      el.appendChild(tag);
    }

    if (step.title) {
      const h = document.createElement("h2");
      h.className = "t-display";
      h.textContent = step.title;
      el.appendChild(h);
    }

    if (step.body) {
      const p = document.createElement("p");
      p.className = "t-body";
      p.textContent = step.body;
      el.appendChild(p);
    }

    return el;
  }
}
