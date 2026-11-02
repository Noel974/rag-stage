
import type { ReactNode } from "react";
import { useState } from "react";

type Section = "legal" | "privacy";

export default function MentionsLegales() {
  const [activeSection, setActiveSection] =
    useState<Section>("legal");

  return (
    <main className="legal-page">
      <div className="legal-container">

        <header className="legal-header">
          <p className="legal-eyebrow">INFORMATIONS</p>

          <h1>Mentions légales et confidentialité</h1>

          <p>
            Retrouvez les informations relatives à l'éditeur
            du site et à la protection de vos données
            personnelles lorsque vous utilisez notre
            assistant documentaire intelligent.
          </p>
        </header>

        <nav
          className="legal-navigation"
          aria-label="Navigation juridique"
        >
          <button
            type="button"
            className={
              activeSection === "legal"
                ? "legal-tab active"
                : "legal-tab"
            }
            onClick={() => setActiveSection("legal")}
            aria-current={
              activeSection === "legal" ? "page" : undefined
            }
          >
            Mentions légales
          </button>

          <button
            type="button"
            className={
              activeSection === "privacy"
                ? "legal-tab active"
                : "legal-tab"
            }
            onClick={() => setActiveSection("privacy")}
            aria-current={
              activeSection === "privacy" ? "page" : undefined
            }
          >
            Confidentialité
          </button>
        </nav>

        <div className="legal-card">
          <div className="legal-card-body">

            {activeSection === "legal" ? (
              <MentionsLegalesContent />
            ) : (
              <ConfidentialiteContent />
            )}

          </div>
        </div>

        <p className="legal-update">
          Dernière mise à jour : 02 novembre 2026
        </p>

      </div>
    </main>
  );
}

/* --------------------------------
   Mentions légales
--------------------------------- */

function MentionsLegalesContent() {
  return (
    <article>
      <h2 className="h3 mb-4">Mentions légales</h2>

      <LegalSection title="1. Éditeur du site">
        <p>Le présent site est édité par :</p>

        <ul>
          <li><strong>Nom :</strong> [Nom et prénom ou dénomination sociale]</li>
          <li><strong>Statut :</strong> [Particulier, entreprise ou organisme]</li>
          <li><strong>Adresse :</strong> [Adresse professionnelle ou adresse légale]</li>
          <li><strong>Email :</strong> [Adresse de contact]</li>
          <li><strong>Numéro SIRET :</strong> [Si applicable]</li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Directeur de la publication">
        <p>
          Le directeur de la publication est
          [Nom et prénom du responsable].
        </p>
      </LegalSection>

      <LegalSection title="3. Hébergement">
        <p>Le site est hébergé par :</p>

        <ul>
          <li><strong>Hébergeur :</strong> [Nom de l'hébergeur]</li>
          <li><strong>Adresse :</strong> [Adresse de l'hébergeur]</li>
          <li><strong>Site web :</strong> [URL de l'hébergeur]</li>
        </ul>

        <p>
          Les services backend et les données peuvent
          être hébergés auprès d'un prestataire distinct,
          dont les coordonnées seront précisées le cas échéant.
        </p>
      </LegalSection>

      <LegalSection title="4. Objet du service">
        <p>
          L'application propose un assistant documentaire
          intelligent permettant aux utilisateurs
          d'interroger des documents et d'obtenir des
          réponses générées à partir des informations
          disponibles dans ces documents.
        </p>

        <p>
          Les réponses générées par l'intelligence
          artificielle peuvent comporter des erreurs ou
          des imprécisions. L'utilisateur est invité à
          vérifier les informations importantes auprès
          des documents sources.
        </p>
      </LegalSection>

      <LegalSection title="5. Propriété intellectuelle">
        <p>
          Les éléments composant le site, notamment son
          interface, ses textes, son identité visuelle et
          ses développements, sont protégés par les
          dispositions applicables en matière de propriété
          intellectuelle.
        </p>

        <p>
          Les documents importés par les utilisateurs
          demeurent soumis aux droits de leurs auteurs
          et titulaires respectifs.
        </p>
      </LegalSection>

      <LegalSection title="6. Responsabilité">
        <p>
          L'éditeur s'efforce de fournir un service
          accessible et fonctionnel. Il ne garantit
          toutefois pas l'absence d'interruption,
          d'erreur ou d'indisponibilité.
        </p>

        <p>
          L'utilisateur reste responsable de l'usage
          qu'il fait des réponses produites par
          l'assistant et des documents qu'il importe.
        </p>
      </LegalSection>

      <LegalSection title="7. Contact">
        <p>
          Pour toute question concernant le site,
          vous pouvez contacter l'éditeur à l'adresse :
          {" "}
          <a href="mailto:[email]">[email de contact]</a>.
        </p>
      </LegalSection>
    </article>
  );
}

/* --------------------------------
   Politique de confidentialité
--------------------------------- */

function ConfidentialiteContent() {
  return (
    <article>
      <h2 className="h3 mb-4">
        Politique de confidentialité
      </h2>

      <LegalSection title="1. Responsable du traitement">
        <p>
          Le responsable du traitement des données
          personnelles est :
        </p>

        <p>
          [Nom ou dénomination de l'éditeur]
          <br />
          Contact : [Adresse email]
        </p>
      </LegalSection>

      <LegalSection title="2. Données susceptibles d'être collectées">
        <p>
          Selon les fonctionnalités effectivement
          proposées par l'application, les données
          suivantes peuvent être traitées :
        </p>

        <ul>
          <li>Les documents importés par l'utilisateur (PDF, fichiers texte ou autres formats pris en charge).</li>
          <li>Les questions adressées à l'assistant et les réponses générées.</li>
          <li>Les données techniques nécessaires au fonctionnement du service : journaux d'erreurs, date des requêtes et informations de connexion.</li>
          <li>Les informations de compte, si une authentification est proposée.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Finalités du traitement">
        <p>
          Les données sont utilisées, selon les
          fonctionnalités activées, pour :
        </p>

        <ul>
          <li>Permettre l'importation et l'analyse documentaire.</li>
          <li>Générer des réponses aux questions formulées par l'utilisateur.</li>
          <li>Assurer le fonctionnement et la sécurité de l'application.</li>
          <li>Corriger les erreurs et améliorer la qualité du service.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Traitement des documents et de l'IA">
        <p>
          Les documents transmis peuvent être analysés
          automatiquement afin d'en extraire le contenu
          utile à la recherche documentaire.
        </p>

        <p>
          Les questions et les extraits documentaires
          nécessaires à la génération des réponses
          peuvent être transmis à un fournisseur
          d'intelligence artificielle, selon la
          configuration technique du service.
        </p>

        <p>
          Les données traitées par ces prestataires
          sont soumises à leurs conditions et politiques
          de confidentialité. Les fournisseurs utilisés,
          les éventuels transferts hors de l'Union
          européenne et les garanties applicables
          doivent être précisés par l'éditeur.
        </p>

        <p>
          Il est recommandé de ne pas importer de
          documents contenant des données sensibles
          ou confidentielles sans autorisation.
        </p>
      </LegalSection>

      <LegalSection title="5. Base légale">
        <p>
          Les traitements reposent, selon leur finalité,
          sur l'exécution du service demandé par
          l'utilisateur, le consentement lorsque celui-ci
          est requis, ou l'intérêt légitime de l'éditeur
          à assurer la sécurité et le bon fonctionnement
          de l'application.
        </p>
      </LegalSection>

      <LegalSection title="6. Durée de conservation">
        <p>
          Les données sont conservées uniquement
          pendant la durée nécessaire aux finalités
          pour lesquelles elles sont traitées.
        </p>

        <ul>
          <li>Documents importés : [durée à préciser].</li>
          <li>Conversations : [durée à préciser].</li>
          <li>Journaux techniques : [durée à préciser].</li>
          <li>Données de compte : pendant la durée d'utilisation du compte, puis selon les obligations applicables.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Destinataires des données">
        <p>
          Les données peuvent être accessibles aux
          personnes habilitées à administrer le service
          ainsi qu'aux prestataires techniques nécessaires
          à son fonctionnement, notamment les services
          d'hébergement et les fournisseurs d'IA.
        </p>

        <p>
          Elles ne sont pas destinées à être vendues
          à des tiers.
        </p>
      </LegalSection>

      <LegalSection title="8. Sécurité">
        <p>
          Des mesures techniques et organisationnelles
          adaptées sont mises en œuvre afin de protéger
          les données contre l'accès non autorisé,
          la perte, l'altération ou la divulgation.
        </p>
      </LegalSection>

      <LegalSection title="9. Droits des utilisateurs">
        <p>
          Conformément au RGPD et à la réglementation
          applicable, les personnes concernées disposent,
          selon les conditions prévues par la loi, des
          droits suivants :
        </p>

        <ul>
          <li>Accès à leurs données personnelles.</li>
          <li>Rectification des données inexactes.</li>
          <li>Effacement des données.</li>
          <li>Limitation de certains traitements.</li>
          <li>Opposition à certains traitements.</li>
          <li>Portabilité des données lorsque ce droit est applicable.</li>
        </ul>

        <p>
          Pour exercer ces droits, contactez :
          {" "}
          <a href="mailto:[email]">[email de contact]</a>.
        </p>

        <p>
          Une réclamation peut également être adressée
          à la CNIL :
          {" "}
          <a
            href="https://www.cnil.fr"
            target="_blank"
            rel="noopener noreferrer"
          >
            www.cnil.fr
          </a>.
        </p>
      </LegalSection>

      <LegalSection title="10. Cookies et stockage local">
        <p>
          L'application peut utiliser des cookies ou
          des mécanismes de stockage local nécessaires
          à son fonctionnement, par exemple pour
          mémoriser une session ou des préférences.
        </p>

        <p>
          Les éventuels cookies de mesure d'audience
          ou de publicité doivent être décrits ici.
          Lorsqu'un consentement est requis, un
          mécanisme de choix doit être proposé.
        </p>
      </LegalSection>

      <LegalSection title="11. Modification de la politique">
        <p>
          La présente politique peut être mise à jour
          afin de refléter les évolutions du service
          ou de la réglementation.
        </p>

        <p>
          La date de dernière mise à jour est indiquée
          en bas de cette page.
        </p>
      </LegalSection>
    </article>
  );
}

/* --------------------------------
   Composant réutilisable
--------------------------------- */

function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="legal-section">
      <h3>{title}</h3>

      <div className="legal-section-content">
        {children}
      </div>
    </section>
  );
}
