import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Loader from "../components/Loader";
import TopBar from "../components/TopBar";
import InvertCursor from "../components/InvertCursor";
import styles from "./Home.module.css";

// L'esperienza porta dentro three, drei e gsap, la sezione "Chi siamo" three
// e R3F: lazy, restano chunk a sé e la shell della home parte leggera. Il
// Loader copre l'attesa di chunk + GLB
const Experience = lazy(() => import("./Experience"));
const AboutSection = lazy(() => import("../components/about/AboutSection"));

export default function Home() {
  const [revealed, setRevealed] = useState(false);
  // con l'esperienza in vista l'header è il suo (HUD); scrollata via, torna
  // la TopBar del sito. Vero all'inizio: l'esperienza parte in cima
  const [hudVisible, setHudVisible] = useState(true);
  const { pathname } = useLocation();

  useEffect(() => {
    document.documentElement.lang = pathname.startsWith("/en") ? "en" : "it";
  }, [pathname]);

  return (
    <div className={styles.page}>
      <Loader onRevealStart={() => setRevealed(true)} />
      <TopBar revealed={revealed && !hudVisible} />
      {/* soglia: INVERT_TRIGGER in InvertCursor.tsx */}
      <InvertCursor sectionId="about" />

      <main>
        {/* lo scroll 3D a step: alto una schermata anche mentre il chunk
            arriva, così "Chi siamo" non sale per poi saltare giù. Il fondo è
            già nero da `index.html`: il fallback può essere il nulla */}
        <section id="hero" className={styles.hero}>
          <Suspense fallback={null}>
            <Experience onHudChange={setHudVisible} />
          </Suspense>
        </section>

        <Suspense fallback={null}>
          <AboutSection />
        </Suspense>
      </main>
    </div>
  );
}
