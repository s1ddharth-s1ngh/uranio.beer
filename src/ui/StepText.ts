// I testi degli step: uscita a righe verso l'alto, entrata dal basso
// (spec 7.6 e appendice 10.5).
//
// È una classe che si costruisce il suo DOM, non un componente React, e la
// ragione è una sola: durante una transizione **esistono due testi insieme**
// — il vecchio che esce e il nuovo che entra — e il nuovo entra a metà
// dell'uscita del vecchio. Con React bisognerebbe tenere in stato una coda di
// blocchi uscenti e rimuoverli a fine animazione; qui il blocco vecchio è un
// nodo che la sua timeline si porta via da sé. Il requisito "mai due testi
// sovrapposti" diventa così una riga di codice invece di una macchina a stati.

import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { TEXT } from "../config/text.ts";
import type { Step } from "../content/steps.it";
import styles from "./StepText.module.css";

gsap.registerPlugin(SplitText);

interface Blocco {
  el: HTMLElement;
  split: SplitText;
  tl?: gsap.core.Timeline;
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
    this.corrente?.tl?.kill();
    this.corrente?.split.revert();
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
    vecchio.tl?.kill();
    const via = () => {
      vecchio.split.revert();
      vecchio.el.remove();
    };
    if (this.reduced) {
      gsap.to(vecchio.el, { opacity: 0, duration: 0.2, onComplete: via });
      return;
    }
    gsap.to(vecchio.split.lines, {
      yPercent: -105,
      skewY: -4,
      duration: TEXT.exit.duration,
      stagger: TEXT.exit.stagger,
      ease: TEXT.exit.ease,
      onComplete: via,
    });
  }

  private entra(step: Step, durata: number): Blocco {
    const el = this.render(step);
    this.host.appendChild(el);
    const split = SplitText.create(el.querySelectorAll(".t-display, .t-body"), {
      type: "lines",
      // la maschera è ciò che fa sembrare che le righe scorrano dietro un
      // bordo invece di sbiadire
      mask: "lines",
    });

    if (this.reduced) {
      const tl = gsap.timeline().from(el, { opacity: 0, duration: 0.25 });
      return { el, split, tl };
    }

    const tag = el.querySelector(`.${styles.tag}`);
    const strike = el.querySelector(`.${styles.strike}`);
    const tl = gsap.timeline({ delay: durata * TEXT.enter.delayFraction });
    if (tag) {
      tl.from(tag, {
        scaleX: 0,
        transformOrigin: "left center",
        duration: TEXT.tag.duration,
        ease: "power3.out",
      });
    }
    tl.from(
      split.lines,
      {
        yPercent: 105,
        opacity: 0,
        filter: "blur(8px)",
        duration: TEXT.enter.duration,
        stagger: TEXT.enter.stagger,
        ease: TEXT.enter.ease,
      },
      tag ? "-=0.15" : 0,
    );
    if (strike) {
      // la riga barrata si disegna **dopo** che il titolo è entrato: è una
      // cancellatura, e una cancellatura ha senso solo su qualcosa che si è
      // già letto
      tl.from(
        strike,
        {
          scaleX: 0,
          transformOrigin: "left center",
          duration: TEXT.strike.duration,
          ease: TEXT.strike.ease,
        },
        `>-${TEXT.strike.overlap}`,
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
      const quadrato = document.createElement("i");
      quadrato.className = styles.tagMark;
      quadrato.setAttribute("aria-hidden", "true");
      quadrato.textContent = "×";
      const testo = document.createElement("span");
      testo.className = styles.tagText;
      testo.textContent = step.tag.text;
      if (step.tag.strike) {
        const riga = document.createElement("i");
        riga.className = styles.strike;
        riga.setAttribute("aria-hidden", "true");
        testo.appendChild(riga);
      }
      tag.append(quadrato, testo);
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
