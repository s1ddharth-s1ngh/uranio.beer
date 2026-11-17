// I testi degli step: entrata dal basso lettera per lettera, uscita a righe
// verso l'alto (spec 7.6 e appendice 10.5).
//
// È una classe che si costruisce il suo DOM, non un componente React, e la
// ragione è una sola: durante una transizione **esistono due testi insieme**
// — il vecchio che esce e il nuovo che entra — e il nuovo entra a metà
// dell'uscita del vecchio. Con React bisognerebbe tenere in stato una coda di
// blocchi uscenti; qui ogni blocco ha la sua timeline e si rimette a posto da
// sé. Il requisito "mai due testi sovrapposti" resta una riga di codice
// invece di una macchina a stati.
//
// Entrata e uscita muovono pezzi diversi, ed è voluto: si entra con le
// lettere del titolo e le parole del paragrafo, si esce con le righe che le
// contengono. Un'uscita che riprendesse gli stessi pezzi, a entrata
// interrotta, li farebbe ripassare in vista dal basso verso l'alto.
//
// I blocchi si costruiscono **prima** (`prepara`), nascosti e già nella posa
// di partenza dell'entrata (lettere sotto la maschera, trasparenti), e si
// riusano. Farlo al cambio di step voleva dire, alla partenza di ogni
// transizione, il DOM del blocco, due `SplitText` con la misura del layout,
// la crenatura e dei `from()` che leggono lo stile calcolato di ogni lettera
// e parola: ~35 ms in un frame con la CPU rallentata di 4 volte come su un
// portatile economico, cioè la bottiglia che si inchioda per tre o quattro
// frame proprio quando parte (misurato il 2026-11-17). Ora al cambio di step
// ci sono solo dei `to()` verso lo stato naturale, che leggono i loro valori
// di partenza tutti insieme quando partono.

import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { TEXT } from "../config/text.ts";
import type { Step } from "../content/steps.it";
import styles from "./StepText.module.css";

gsap.registerPlugin(SplitText);

interface Blocco {
  el: HTMLElement;
  titolo: SplitText;
  corpo: SplitText;
  /** tutto quello che le animazioni toccano, per rimetterlo a posto */
  pezzi: Element[];
  /** l'entrata, finché il blocco è quello in scena */
  tl?: gsap.core.Timeline;
  /** l'uscita in corso, finché non torna nascosto */
  uscita?: gsap.core.Timeline;
}

/** gli stili che le animazioni scrivono in linea: la crenatura (margini) no */
const STILI_ANIMATI = "transform,opacity,filter,clipPath";

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
  /** i blocchi già costruiti, uno per step, nascosti quando non sono in scena */
  private blocchi = new Map<string, Blocco>();

  constructor(host: HTMLElement, reduced = false) {
    this.host = host;
    this.reduced = reduced;
  }

  /**
   * Costruisce in anticipo i blocchi di questi step, nascosti. Va chiamata a
   * font pronti (le righe si misurano qui) e quando la finestra cambia
   * larghezza, dopo `rifai`.
   */
  prepara(steps: readonly Step[]) {
    for (const step of steps) {
      if (!this.blocchi.has(step.id)) this.blocchi.set(step.id, this.costruisci(step));
    }
  }

  /**
   * Butta i blocchi fermi: con la finestra cambiata le righe sono misurate
   * male. Quello in scena e quelli che stanno uscendo restano com'erano
   * (come prima, quando si spezzava una volta sola all'entrata).
   */
  rifai() {
    for (const [id, b] of this.blocchi) {
      if (b === this.corrente || b.uscita) continue;
      this.distruggi(b);
      this.blocchi.delete(id);
    }
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
    for (const b of this.blocchi.values()) this.distruggi(b);
    this.blocchi.clear();
    this.host.replaceChildren();
    this.corrente = undefined;
    this.mostrato = undefined;
  }

  /** Il blocco in scena esce verso l'alto, poi torna nascosto e pronto. */
  private esci() {
    const vecchio = this.corrente;
    if (!vecchio) return;
    this.corrente = undefined;
    // uccidere la timeline di entrata è ciò che rende sicure le inversioni a
    // metà corsa: se non lo si fa, il blocco vecchio continua a entrare
    // mentre esce
    vecchio.tl?.kill();
    vecchio.tl = undefined;
    // per lo screen reader il blocco che esce sparisce subito: due regioni
    // `aria-live` insieme farebbero annunciare anche il testo vecchio
    vecchio.el.removeAttribute("aria-live");
    vecchio.el.setAttribute("aria-hidden", "true");
    // su mobile spegne la sua sfumatura (StepText.module.css)
    vecchio.el.classList.add(styles.leaving);
    const tl = gsap.timeline({
      onComplete: () => {
        vecchio.uscita = undefined;
        this.nascondi(vecchio);
      },
    });
    vecchio.uscita = tl;
    if (this.reduced) {
      tl.to(vecchio.el, { opacity: 0, duration: 0.2 });
      return;
    }
    const { duration, stagger, ease, y, blur } = TEXT.exit;
    const tag = vecchio.el.querySelector(`.${styles.tag}`);
    // il tag si richiude verso destra: da qualunque punto sia arrivata la
    // sua entrata, i due bordi si incontrano senza riaprirlo
    if (tag) tl.to(tag, { clipPath: "inset(0% 0% 0% 100%)", duration, ease }, 0);
    tl.to(
      [...vecchio.titolo.lines, ...vecchio.corpo.lines],
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

  /**
   * La posa di partenza dell'entrata, messa a blocco nascosto: le lettere
   * sotto la loro maschera, girate e sfocate, le parole sotto, il tag chiuso,
   * la riga barrata a zero. Col moto ridotto l'entrata è una dissolvenza del
   * blocco intero, e non serve.
   */
  private arma(b: Blocco) {
    if (this.reduced) return;
    const { chars } = TEXT;
    gsap.set(b.titolo.chars, {
      yPercent: chars.y,
      rotateX: chars.rotateX,
      transformPerspective: 600,
      transformOrigin: "50% 100%",
      opacity: 0,
      filter: `blur(${chars.blur}px)`,
    });
    gsap.set(b.corpo.words, { yPercent: 100, opacity: 0 });
    const tag = b.el.querySelector(`.${styles.tag}`);
    if (tag) gsap.set(tag, { clipPath: "inset(0% 100% 0% 0%)" });
    const riga = b.el.querySelector(`.${styles.strike}`);
    if (riga) gsap.set(riga, { scaleX: 0, transformOrigin: "left center" });
  }

  private entra(step: Step, durata: number): Blocco {
    let b = this.blocchi.get(step.id);
    if (!b) {
      // non preparato (uno step senza testo diventato con testo, o un resize
      // proprio adesso): si costruisce qui, come si faceva sempre
      b = this.costruisci(step);
      this.blocchi.set(step.id, b);
    }
    // stava uscendo (inversione a metà corsa): si ferma e riparte da capo
    if (b.uscita) {
      b.uscita.kill();
      b.uscita = undefined;
      this.nascondi(b);
    }
    b.el.classList.remove(styles.pronto);
    b.el.removeAttribute("aria-hidden");
    // il testo resta leggibile dagli screen reader e annunciato quando cambia
    b.el.setAttribute("aria-live", "polite");
    // anche col moto ridotto si aspetta: il testo vecchio deve essere
    // sparito prima che arrivi il nuovo
    const tl = gsap.timeline({ delay: durata * TEXT.enter.delayFraction });
    b.tl = tl;

    if (this.reduced) {
      tl.from(b.el, { opacity: 0, duration: 0.25 });
      return b;
    }

    // dalla posa di `arma` allo stato naturale
    const tag = b.el.querySelector(`.${styles.tag}`);
    if (tag) {
      tl.to(
        tag,
        { clipPath: "inset(0% 0% 0% 0%)", duration: TEXT.tag.duration, ease: TEXT.tag.ease },
        TEXT.tag.at,
      );
    }
    const { chars, words, strike } = TEXT;
    tl.to(
      b.titolo.chars,
      {
        yPercent: 0,
        rotateX: 0,
        opacity: 1,
        filter: "blur(0px)",
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
    tl.to(
      b.corpo.words,
      {
        yPercent: 0,
        opacity: 1,
        duration: words.duration,
        stagger: words.stagger,
        ease: words.ease,
        clearProps: "transform,opacity",
      },
      words.at,
    );
    const riga = b.el.querySelector(`.${styles.strike}`);
    if (riga) tl.to(riga, { scaleX: 1, duration: strike.duration, ease: strike.ease }, strike.at);
    return b;
  }

  /**
   * Il blocco torna nascosto e pronto per la prossima entrata: senza gli
   * stili lasciati da un'entrata o un'uscita interrotte, crenatura esclusa.
   */
  private nascondi(b: Blocco) {
    gsap.set(b.pezzi, { clearProps: STILI_ANIMATI });
    b.el.classList.remove(styles.leaving);
    b.el.classList.add(styles.pronto);
    b.el.removeAttribute("aria-live");
    b.el.setAttribute("aria-hidden", "true");
    this.arma(b);
  }

  /**
   * Il blocco di uno step, costruito, spezzato e nascosto. `visibility` e non
   * `display`: le righe si misurano sul layout vero, e nascosto così il
   * blocco occupa il suo posto ma non si vede e non si legge.
   */
  private costruisci(step: Step): Blocco {
    const el = this.render(step);
    el.classList.add(styles.pronto);
    el.setAttribute("aria-hidden", "true");
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
    const pezzi: Element[] = [
      el,
      ...titolo.lines,
      ...titolo.chars,
      ...corpo.lines,
      ...corpo.words,
      ...el.querySelectorAll(`.${styles.tag}, .${styles.strike}`),
    ];
    const b: Blocco = { el, titolo, corpo, pezzi };
    this.arma(b);
    return b;
  }

  private distruggi(b: Blocco) {
    b.tl?.kill();
    b.uscita?.kill();
    b.titolo.revert();
    b.corpo.revert();
    b.el.remove();
  }

  /** Il markup di un blocco: tag, titolo, paragrafo (spec 8.18). */
  private render(step: Step): HTMLElement {
    const el = document.createElement("div");
    el.className = styles.block;

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
