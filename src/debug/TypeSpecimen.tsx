import { COLORS } from "../config/theme";
import { STEPS } from "../content/steps.it";
import { useFontsReady } from "../hooks/useFontsReady";
import styles from "./TypeSpecimen.module.css";

// Il provino si guarda a occhio, quindi non deve mostrare nulla finché il
// font vero non c'è: con quello di ripiego si giudicherebbero le misure
// sbagliate, che è l'unica cosa che questa pagina serve a decidere.
export default function TypeSpecimen() {
  const ready = useFontsReady();
  if (!ready) return null;

  return (
    <div className={styles.sheet}>
      <p className={`t-label ${styles.head}`}>
        Provino tipografico · ?debug=type
      </p>

      <div className={styles.swatches}>
        {Object.entries(COLORS).map(([name, hex]) => (
          <div key={name} className={styles.swatch}>
            <div className={styles.chip} style={{ background: hex }} />
            <div className={styles.name}>
              --u-{name.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}
              <br />
              {hex}
            </div>
          </div>
        ))}
      </div>

      {STEPS.map((s) => (
        <div key={s.id} className={styles.row}>
          <div className={styles.which}>{s.id}</div>
          <div>
            {s.tag && (
              <p className="t-label" style={{ color: COLORS.red }}>
                {s.tag.text}
                {s.tag.strike ? " (barrato)" : ""}
              </p>
            )}
            {s.title && <h2 className="t-display">{s.title}</h2>}
            {s.bigWord && <h2 className="t-display">{s.bigWord.join(" / ")}</h2>}
            {s.subtitle && <p className="t-label">{s.subtitle}</p>}
            {s.body && <p className="t-body">{s.body}</p>}
            {s.note && <p className="t-body">{s.note}</p>}
            {s.scrollHint && <p className="t-label">{s.scrollHint}</p>}
            {s.cta?.map((c) => (
              <p key={c.href} className="t-label">
                {c.label}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
