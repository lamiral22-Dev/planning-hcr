# Solution de Gestion de Planning & Pointage HCR

Application web conçue pour l'hôtellerie-restauration, optimisant l'organisation des plannings à la quinzaine, le pointage horodaté et la conformité légale conventionnelle[cite: 2].

## Fonctionnalités Clés

- **Planification & Grille type :** Modélisation d'une grille récurrente et publication à la quinzaine[cite: 2].
- **Banque de créneaux :** Dans le planning manager, les créneaux actifs du planning type peuvent être déposés plusieurs fois ou sélectionnés puis affectés au clic. Les créations restent soumises aux contrôles HCR et au délai de prévenance.
- **Services en coupure et de nuit :** Les services d'une même journée ne doivent pas se chevaucher ni dépasser 13 h d'amplitude ; le repos entre journées est de 11 h. Une fin le lendemain n'est admise que pour un début après 17 h et une fin avant 5 h.
- **Garde-fous HCR intégrés :** Blocage automatique en cas de non-respect du repos quotidien de 11h, du plafond de 48h/semaine ou des 2 jours de repos hebdomadaires[cite: 2, 3].
- **Délai de prévenance & Dérogations :** Alerte sur les changements à moins de 8 jours et émargement numérique obligatoire[cite: 2, 3].
- **Bourse d'échange de shifts :** Échanges directs entre équipiers sous contrôle de conformité et validation manager[cite: 2].
- **Pointage & Arbitrage :** Clôture de service avec règle d'arrondi au quart d'heure et conservation de l'historique brut de pointage[cite: 2, 3].
- **Export Paie :** Extraction mensuelle conforme CSV/Excel pour le gestionnaire de paie[cite: 2, 3].

## Rôles & Accès

- **Salarié :** Consultation du planning nominatif, pointage de fin de shift, émargement et propositions d'échanges[cite: 2, 3].
- **Manager :** Création du planning, arbitrage contradictoire des pointages, validation des échanges et exports paie[cite: 2, 3].
- **Super-Admin :** Paramétrage de l'établissement (délai de prévenance, arrondis, comptes)[cite: 2, 3].

## Stack Technique

- **Framework :** Next.js (App Router) + TypeScript strict[cite: 3]
- **Design :** Tailwind CSS + Shadcn UI[cite: 3]
- **Base de données :** PostgreSQL + Prisma ORM[cite: 3]
- **Validation :** Zod[cite: 3]
- **Dates :** `date-fns` & `date-fns-tz` (`Europe/Paris`)[cite: 3]
- **Tests :** Vitest (unitaires métier) & Playwright (E2E)[cite: 3]

## Architecture & Règles

- Les règles de développement et invariants métier sont détaillés dans [`GEMINI.md`](./GEMINI.md)[cite: 3].
- L'arborescence des dossiers et la topologie de l'application sont décrites dans [`ARCHITECTURE.md`](./ARCHITECTURE.md)[cite: 4].

## Vérification manuelle du planning

Dans `/manager/planning`, créer les lignes de postes du planning restaurant, configurer leurs horaires et jours fermés, puis affecter un salarié par glisser-déposer et par sélection suivie d'un clic. Vérifier les récapitulatifs hebdomadaires et mensuels, la publication par semaine, et le contrôle des règles HCR. Un remplacement à moins de huit jours doit rester en attente de l'accord du salarié affecté, disponible dans son planning personnel. Les horaires exceptionnels sont modifiables depuis la case ; la suppression doit être refusée lorsqu'un pointage, une demande d'échange ou une demande de remplacement y est associé.

Dans `/manager/planning-salarie`, vérifier que la navigation par quinzaine fonctionne sans commande de modification. Dans `/manager/planning`, vérifier que les anciens shifts sans poste associé ne sont pas attribués automatiquement à une ligne. Consulter le registre d'audit pour les traces de création, modification et publication. Les exports paie sont accessibles sous `/manager/paie` ; l'ancienne adresse `/manager/exports` reste disponible.

La migration des lignes de postes et des demandes de remplacement est sous `prisma/migrations/20261120000000_restaurant_planning`. Attention : `npm run build` exécute `prisma db push --accept-data-loss` sur la base désignée par `DATABASE_URL` ; utiliser une base dédiée pour les vérifications.