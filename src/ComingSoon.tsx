import React from 'react';
import logo from './assets/logo.jpg';
import './ComingSoon.css';

const ComingSoon: React.FC = () => {
  return (
    <div className="coming-soon-container">
      <header className="header">
        <img src={logo} alt="Uranio Logo" className="logo" />
      </header>
      
      <main className="main-content">
        <div className="text-wrapper">
          <h1 className="title">URANIO</h1>
          <h2 className="subtitle">COMING SOON</h2>
        </div>
        
        <p className="description">
          Stiamo preparando qualcosa di spaziale.
          <br/>
          Preparati per un'esplosione di sapore!
        </p>
      </main>
      
      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} Uranio. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default ComingSoon;