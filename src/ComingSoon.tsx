import React, { useState, useEffect } from 'react';
import logo from './assets/logo.jpg';
import volcanoImg from './assets/volcano.jpg';
import explosionGif from './assets/explosion.gif';
import './ComingSoon.css';

const ComingSoon: React.FC = () => {
  const [isExploding, setIsExploding] = useState(false);
  const [typedText, setTypedText] = useState('');
  
  const fullText = "Stiamo preparando qualcosa di atomico.\nClicca la Bisalta per un'esplosione!";

  useEffect(() => {
    let currentIndex = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    const typeChar = () => {
      if (currentIndex <= fullText.length) {
        setTypedText(fullText.slice(0, currentIndex));
        currentIndex++;
        // Randomize delay between 30ms and 110ms for realistic typing
        const delay = Math.random() * 80 + 30;
        timeoutId = setTimeout(typeChar, delay);
      }
    };

    timeoutId = setTimeout(typeChar, 50);

    return () => clearTimeout(timeoutId);
  }, []);

  const handleVolcanoClick = () => {
    setIsExploding(true);
    // Reset explosion after animation finishes (e.g., 2 seconds)
    setTimeout(() => {
      setIsExploding(false);
    }, 2000);
  };

  return (
    <div className="coming-soon-container">
      <header className="header">
        <img src={logo} alt="Uranio Logo" className="logo" />
        <div className="text-wrapper-top">
          <h1 className="title-top">URANIO</h1>
          <h2 className="subtitle-top">COMING SOON</h2>
        </div>
      </header>
      
      <main className="main-content">
        <div className="volcano-container" onClick={handleVolcanoClick}>
          <img 
            src={volcanoImg} 
            alt="Bisalta Mountain" 
            className={`volcano ${isExploding ? 'shake' : ''}`}
          />
          {isExploding && (
            <img 
              src={explosionGif} 
              alt="Explosion" 
              className="explosion"
            />
          )}
        </div>
        
        <p className="description" style={{ whiteSpace: 'pre-line' }}>
          {typedText}
          <span className="cursor"></span>
        </p>
      </main>
      
      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} Uranio. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default ComingSoon;