
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Card from "../component/card";

// Redux
import { fetchIndexingStatus } from "../redux/features/ragSlice";
import { useAppDispatch, useAppSelector } from "../redux/store/hoooks";

export default function Home() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Récupération des données depuis Redux
  const {
    indexingStatus,
    statusLoading,
    statusError,
  } = useAppSelector((state) => state.rag);

  // État de la recherche
  const [query, setQuery] = useState("");

  // Gestion de la recherche
  const handleSearch = () => {
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

  // Recherche avec la touche Entrée
  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter") {
      handleSearch();
    }
  };

  // Récupération et actualisation des statistiques
  useEffect(() => {
    dispatch(fetchIndexingStatus());

    const interval = window.setInterval(() => {
      dispatch(fetchIndexingStatus());
    }, 10000);

    return () => window.clearInterval(interval);
  }, [dispatch]);

  // Formatage de la date de dernière indexation
  const formattedDate = indexingStatus?.last_indexed_at
    ? new Date(
        indexingStatus.last_indexed_at
      ).toLocaleString("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

  return (
    <main className="home">
      {/* Section principale */}
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
            onChange={(event) =>
              setQuery(event.target.value)
            }
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

      {/* Accès rapides */}
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

      {/* Statistiques d'indexation */}
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

      {/* État de chargement */}
      {statusLoading && (
        <p role="status">
          Chargement des statistiques d'indexation...
        </p>
      )}

      {/* Message d'erreur */}
      {statusError && (
        <p className="stats-error" role="alert">
          Impossible de récupérer les statistiques
          de l'indexation. Veuillez réessayer plus tard.
        </p>
      )}
    </main>
  );
}
