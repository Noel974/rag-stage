import Card from "../component/card";

export default function Apropos() {
  return (
    <main className="about">

      {/* Hero */}
      <section className="about-hero">
        <span className="hero-badge">
          À propos du portail
        </span>

        <h1>
          Une plateforme unique pour accéder aux ressources de l'entreprise
        </h1>

        <p>
          Ce portail a été conçu pour centraliser les informations,
          faciliter les recherches et permettre à chaque collaborateur
          d'accéder rapidement aux outils et aux connaissances de
          l'entreprise.
        </p>
      </section>

      {/* Présentation */}
      <section className="about-section">
        <h2>Pourquoi ce portail ?</h2>

        <p>
          Les informations importantes sont souvent dispersées dans
          différents documents, procédures ou espaces de stockage.
          Ce portail permet de retrouver rapidement les ressources utiles
          grâce à un annuaire collaborateur et un assistant intelligent.
        </p>
      </section>

      {/* Fonctionnalités */}
      <section className="about-section">
        <h2>Fonctionnalités principales</h2>

        <div className="cards-grid">

          <Card
            title="Assistant IA"
            description="Posez vos questions et obtenez des réponses basées sur la documentation interne de l'entreprise."
          />

          <Card
            title="Annuaire"
            description="Retrouvez facilement les collaborateurs, leurs coordonnées et leurs services."
          />

          <Card
            title="Documentation"
            description="Accédez rapidement aux procédures, guides et documents de référence."
          />

        </div>
      </section>

      {/* Fonctionnement */}
      <section className="about-section">
        <h2>Comment fonctionne l’assistant IA ?</h2>

        <div className="workflow">

          <div className="workflow-step">
            <span>1</span>
            <p>Documents stockés sur Google Drive</p>
          </div>

          <div className="workflow-step">
            <span>2</span>
            <p>Synchronisation via Kestra</p>
          </div>

          <div className="workflow-step">
            <span>3</span>
            <p>Création des embeddings</p>
          </div>

          <div className="workflow-step">
            <span>4</span>
            <p>Indexation dans Pgvector</p>
          </div>

          <div className="workflow-step">
            <span>5</span>
            <p>Réponse générée par l'assistant IA</p>
          </div>

        </div>
      </section>

      {/* Utilisateurs */}
      <section className="about-section">
        <h2>Qui peut utiliser le portail ?</h2>

        <p>
          Le portail est destiné à l'ensemble des collaborateurs de
          l'entreprise. Il facilite l'accès à l'information, améliore
          la collaboration et réduit le temps de recherche des documents
          internes.
        </p>
      </section>

    </main>
  );
} 