import DeepSpace from "../components/scene/DeepSpace";
import FallingStars from "../components/scene/FallingStars";
import { useViewport } from "../hooks/useViewport";

/**
 * Lo sfondo della sezione 1, anche qui (richiesta del 2026-11-17: "vorrei lo
 * stesso background che c'è nella prima sezione", e poi le stelle cadenti
 * della sessione del hero): il nero della pagina, che si vede attraverso il
 * canvas trasparente, lo stesso cielo profondo del hero e le stesse stelle
 * cadenti — gli stessi componenti, non copie, con la densità del hero per
 * formato.
 *
 * Senza la lente (`lens` 0): nel hero è il logo che piega lo spazio, con
 * l'anello attorno alla sua sagoma; qui la bottiglia si sposta da uno step
 * all'altro e un anello fermo al centro non le starebbe attorno. Restano le
 * stelle che derivano, le comete e le meteore. Sono tutti in spazio schermo:
 * la camera della scena, che si muove, non li tocca.
 *
 * Al posto dello shader di prima (studio, alone rosso, nebbia a fbm su un
 * secondo canvas WebGL): un contesto in meno, e un fragment shader a schermo
 * intero in meno.
 */
export function Stars({ reduced }: { reduced: boolean }) {
  const vp = useViewport();
  // le stesse densità del hero: telefono, tablet, desktop
  const densita = vp.mobile ? 0.55 : vp.portrait ? 0.8 : 1;
  return (
    <>
      <DeepSpace reduceMotion={reduced} factor={densita} lens={0} />
      {/* come nel hero niente meteore col moto ridotto: una meteora ferma a
          metà corsa sembrerebbe un graffio */}
      {!reduced && <FallingStars factor={densita} />}
    </>
  );
}
