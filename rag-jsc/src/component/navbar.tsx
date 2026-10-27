
import { useState } from "react";


export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="navbar">
      <a href="#accueil" className="navbar-logo" onClick={closeMenu}>
        MonSite<span>.</span>
      </a>

      <button
        className="menu-toggle"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={menuOpen}
        aria-controls="navbar-menu"
      >
        {menuOpen ? "✕" : "☰"}
      </button>

      <ul
        id="navbar-menu"
        className={`navbar-links ${menuOpen ? "active" : ""}`}
      >
        <li><a href="#accueil" onClick={closeMenu}>Accueil</a></li>
        <li><a href="#apropos" onClick={closeMenu}>À propos</a></li>
        <li><a href="#services" onClick={closeMenu}>Services</a></li>
        <li><a href="#contact" onClick={closeMenu}>Contact</a></li>
      </ul>
    </nav>
  );
}
