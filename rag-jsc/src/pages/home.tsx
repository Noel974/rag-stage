
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { ChangeEvent, KeyboardEvent } from "react";

import Card from "../component/card";

// Redux
import { fetchIndexingStatus } from "../redux";
import { useAppDispatch, useAppSelector } from "../redux/store/hooks";

// ========================================
// INTERFACES TYPESCRIPT
// ========================================

interface IndexingStatus {
  last_indexed_at?: string | null;

  documents?: {
    indexed?: number | null;
  };

  chunks?: number | null;
}

// ========================================
// COMPOSANT PRINCIPAL HOME
// ========================================

export default function Home() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // ========================================
  // RÉCUPÉRATION DES DONNÉES REDUX
  // ========================================

  const {
    indexingStatus,
    statusLoading,
    statusError,
  } = useAppSelector((state) => state.rag);

  // ========================================
  // ÉTAT DE LA RECHERCHE
  // ========================================

  const [query, setQuery] = useState<string>("");

  // ========================================
  // GESTION DE LA RECHERCHE
  // ========================================

  const handleSearch = (): void => {
    const question = query.trim();

    if (!question) {
      return;
    }

    navigate("/assitance", {
      state: {
        question,
      },
    });
  };

  // ========================================
  // RECHERCHE AVEC LA TOUCHE ENTRÉE
  // ========================================

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement>
  ): void => {
    if (event.key === "Enter") {
      handleSearch();
    }
  };

  // ========================================
  // GESTION DU CHANGEMENT DE RECHERCHE
  // ========================================

  const handleQueryChange = (
    event: ChangeEvent<HTMLInputElement>
  ): void => {
    setQuery(event.target.value);
  };

  // ========================================
  // RÉCUPÉRATION DES STATISTIQUES
  // ========================================

  useEffect(() => {
    dispatch(fetchIndexingStatus());

    const interval = window.setInterval(() => {
      dispatch(fetchIndexingStatus());
    }, 10000);

    return () => window.clearInterval(interval);
  }, [dispatch]);

  // ========================================
  // FORMATAGE DE LA DATE
  // ========================================

  const formattedDate = indexingStatus?.last_indexed_at
    ? new Date(
        indexingStatus.last_indexed_at
      ).toLocaleString("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

  // ========================================
  // RENDU DU COMPOSANT
  // ========================================

  return (
    <main className="home">

      {/* SECTION PRINCIPALE */}

      <section className="hero">
        <span className="hero-badge">
          Portail collaboratif
        </span>

        <h1>
          Votre assistant documentaire intelligent
        </h1>

        <p>
          Recherchez des informations, consultez
          l'annuaire de l'entreprise et accédez
          rapidement aux ressources dont vous avez
          besoin.
        </p>

        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Posez votre question..."
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            aria-label="Votre question"
          />

          <button
            type="button"
            className="search-button"
            onClick={handleSearch}
            disabled={!query.trim()}
          >
            Rechercher
          </button>
        </div>
      </section>

      {/* ACCÈS RAPIDES */}

      <section className="services">
        <h2>Accès rapides</h2>

        <div className="cards-grid">

          <Card
            title="Assistant IA"
            description="Interrogez la base documentaire grâce à l'intelligence artificielle."
            onButtonClick={() =>
              navigate("/assitance")
            }
          />

          <Card
            title="Annuaire"
            description="Retrouvez rapidement les collaborateurs et leurs coordonnées."
            onButtonClick={() =>
              navigate("/annuaire")
            }
          />

          <Card
            title="À propos"
            description="Découvrez le fonctionnement du portail collaboratif."
            onButtonClick={() =>
              navigate("/apropos")
            }
          />

        </div>
      </section>

      {/* STATISTIQUES D'INDEXATION */}

      <section className="stats">

        <div className="stat-card">
          <h3>
            {indexingStatus?.documents?.indexed ?? "—"}
          </h3>

          <span>Documents indexés</span>
        </div>

        <div className="stat-card">
          <h3>
            {indexingStatus?.chunks ?? "—"}
          </h3>

          <span>Fragments de texte indexés</span>
        </div>

        <div className="stat-card">
          <h3>{formattedDate}</h3>

          <span>Dernière indexation</span>
        </div>

      </section>

      {/* ÉTAT DE CHARGEMENT */}

      {statusLoading && (
        <p role="status">
          Chargement des statistiques d'indexation...
        </p>
      )}

      {/* MESSAGE D'ERREUR */}

      {statusError && (
        <p className="stats-error" role="alert">
          Impossible de récupérer les statistiques
          de l'indexation. Veuillez réessayer plus tard.
        </p>
      )}

    </main>
  );
}
