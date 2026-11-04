import { FAQ, FAQ_TITLE } from "../../content/faq.it";
import styles from "./FaqSection.module.css";

/**
 * Le domande frequenti, dopo il finale dell'esperienza (riferimento
 * ciaoenergy.com). `<details>` nativi: tastiera, screen reader e stato
 * aperto/chiuso li dà il browser, e con lo stesso `name` se ne apre uno alla
 * volta (dove non è supportato restano indipendenti, che va bene lo stesso).
 */
export default function FaqSection() {
  return (
    <section id="faq" className={styles.faq} aria-labelledby="faq-title">
      <h2 id="faq-title" className={`${styles.title} t-display`}>
        {FAQ_TITLE[0]}
        <br />
        {FAQ_TITLE[1]}
      </h2>
      <div className={styles.list}>
        {FAQ.map(({ q, a }) => (
          <details key={q} name="faq" className={styles.item}>
            <summary className={styles.q}>
              <span>{q}</span>
              <i className={styles.mark} aria-hidden="true" />
            </summary>
            <p className={`${styles.a} t-body`}>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
