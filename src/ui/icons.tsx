// Le quattro icone degli step (spec 8.17).
//
// La spec suggerisce Lucide (`wheat`, `zap`, `droplet`, `recycle`). Sono
// quattro icone: aggiungere un pacchetto intero — e tenerlo aggiornato — per
// quattro `path` in un HUD è peso che non si ripaga. Qui sono disegnate a
// mano con lo stesso linguaggio di Lucide (riquadro 24, tratto 1,5, estremità
// arrotondate) così stanno insieme al resto dell'interfaccia.
//
// Il simbolo del riciclo è un `path` solo ripetuto tre volte a 120°: è un
// marchio a simmetria rotazionale e scriverlo tre volte sarebbe tre volte la
// possibilità di sbagliarne una.

import type { Step } from "../content/steps.it";

type IconName = NonNullable<Step["icon"]>;

const FRECCIA_RICICLO =
  "M12 4.2 L15.1 9.6 M15.1 9.6 L12.6 8.9 M15.1 9.6 L14.4 12.1";

const DISEGNI: Record<IconName, React.ReactNode> = {
  // spiga: gambo e tre coppie di chicchi
  wheat: (
    <>
      <path d="M12 21 V9" />
      <path d="M12 9 c-2.4 0 -3.6 -1.6 -3.6 -3.4 2.4 0 3.6 1.6 3.6 3.4Z" />
      <path d="M12 9 c2.4 0 3.6 -1.6 3.6 -3.4 -2.4 0 -3.6 1.6 -3.6 3.4Z" />
      <path d="M12 14 c-2.4 0 -3.6 -1.6 -3.6 -3.4 2.4 0 3.6 1.6 3.6 3.4Z" />
      <path d="M12 14 c2.4 0 3.6 -1.6 3.6 -3.4 -2.4 0 -3.6 1.6 -3.6 3.4Z" />
    </>
  ),
  // fulmine
  zap: <path d="M13 2 L4 14 h6 l-1 8 l9 -12 h-6 Z" />,
  // goccia
  droplet: <path d="M12 3 C12 3 5 10.5 5 15 a7 7 0 0 0 14 0 C19 10.5 12 3 12 3 Z" />,
  // riciclo: la stessa freccia, tre volte
  recycle: (
    <>
      <path d={FRECCIA_RICICLO} />
      <path d={FRECCIA_RICICLO} transform="rotate(120 12 12)" />
      <path d={FRECCIA_RICICLO} transform="rotate(240 12 12)" />
    </>
  ),
};

/** Il guscio comune: riquadro 24, tratto 1,5, niente riempimento. */
export function StepIcon({ name, size = 26 }: { name: IconName; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {DISEGNI[name]}
    </svg>
  );
}
