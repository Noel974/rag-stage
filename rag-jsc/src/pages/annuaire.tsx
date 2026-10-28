import Card from "../component/card";

export default function Annuaire() {
  const collaborateurs = [
    {
      service: "Direction",
      personnes: [
        {
          title: "Marie Dupont",
          description: "Directrice Générale",
        },
      ],
    },
    {
      service: "Informatique",
      personnes: [
        {
          title: "Jean Martin",
          description: "Responsable Informatique",
        },
        {
          title: "Paul Robert",
          description: "Développeur",
        },
        {
          title: "Julie Fontaine",
          description: "Administratrice Système",
        },
      ],
    },
    {
      service: "RH",
      personnes: [
        {
          title: "Claire Durand",
          description: "Responsable RH",
        },
      ],
    },
  ];

  return (
    <main className="annuaire">
      <section className="annuaire-hero">
        <span className="hero-badge">
          Annuaire entreprise
        </span>

        <h1>Trouvez le bon interlocuteur</h1>

        <p>
          Recherchez rapidement un collaborateur,
          un service ou une fonction.
        </p>

        <div className="annuaire-search">
          <input
            type="text"
            placeholder="Rechercher un collaborateur..."
          />
        </div>
      </section>

      <section className="organisation">
        <h2>Organisation de l'entreprise</h2>

        <div className="organisation-grid">
          <div className="service-pill">
            Direction
          </div>

          <div className="service-pill">
            Informatique
          </div>

          <div className="service-pill">
            RH
          </div>
        </div>
      </section>

      {collaborateurs.map((service) => (
        <section
          key={service.service}
          className="service-section"
        >
          <h2>{service.service}</h2>

          <div className="cards-grid">
            {service.personnes.map((personne) => (
              <Card
                key={personne.title}
                title={personne.title}
                description={personne.description}
              >
                <div className="card-infos">
                  <span>
                    ✉️ prenom.nom@entreprise.fr
                  </span>

                  <span>
                    📞 02 62 XX XX XX
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}