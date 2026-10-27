

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">

        {/* Logo et description */}
        <div className="footer-brand">
          <a href="#accueil" className="footer-logo">
            MonSite<span>.</span>
          </a>

          <p>
            Créons ensemble des expériences numériques
            modernes, simples et accessibles.
          </p>

          <div className="footer-socials">
            <a href="https://facebook.com" aria-label="Facebook">
              f
            </a>
            <a href="https://instagram.com" aria-label="Instagram">
              ig
            </a>
            <a href="https://linkedin.com" aria-label="LinkedIn">
              in
            </a>
          </div>
        </div>

        {/* Navigation */}
        <div className="footer-column">
          <h3>Navigation</h3>
          <ul>
            <li><a href="#accueil">Accueil</a></li>
            <li><a href="#apropos">À propos</a></li>
            <li><a href="#services">Services</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
        </div>


        {/* Contact */}
        <div className="footer-column">
          <h3>Contact</h3>
          <ul>
            <li>
              <a href="mailto:contact@monsite.fr">
                contact@monsite.fr
              </a>
            </li>
            <li>
              <a href="tel:+262262000000">
                +262 262 00 00 00
              </a>
            </li>
            <li>La Réunion, France</li>
          </ul>
        </div>

      </div>

      {/* Bas du footer */}
      <div className="footer-bottom">
        <p>
          © {new Date().getFullYear()} MonSite.
          Tous droits réservés.
        </p>

        <div className="footer-legal">
          <a href="#mentions-legales">Mentions légales</a>
          <a href="#confidentialite">Confidentialité</a>
        </div>
      </div>
    </footer>
  );
}
