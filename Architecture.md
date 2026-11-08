/src
 ├── /app                   # Routage et Pages
 │    ├── (auth)            # Routes publiques (login, reset password)
 │    ├── /manager          # Espace d'administration (protégé par middleware)
 │    │    ├── /planning    # Vue grille quinzaine, création, publication
 │    │    ├── /arbitrage   # Validation des heures et des absences
 │    │    └── /exports     # Génération CSV Paie
 │    └── /salarie          # Espace employé (mobile-first, protégé)
 │         ├── /planning    # Vue liste perso, émargement, PDF
 │         └── /bourses     # Demandes de switch de shifts
 │
 ├── /components            # Composants UI réutilisables
 │    ├── /ui               # Composants Shadcn (boutons, inputs, dialogues)
 │    └── /features         # Composants métier (ShiftCard, PlanningGrid)
 │
 ├── /lib                   # Logique métier pure et utilitaires
 │    ├── prisma.ts         # Instanciation du client BDD
 │    ├── hcr-rules.ts      # 🧠 MOTEUR DE RÈGLES : Calcul des 11h, 48h, 2 jours
 │    ├── time-utils.ts     # Gestion des fuseaux horaires avec date-fns-tz
 │    └── export-utils.ts   # Génération PDF et CSV
 │
 ├── /actions               # Server Actions (Mutations Next.js)
 │    ├── shift-actions.ts  # Création/modification de shift (avec Zod)
 │    └── time-actions.ts   # Pointage, arbitrage et validation
 │
 └── /schemas               # Validation Zod (partagée Front/Back)
      └── validations.ts    # ex: ShiftSchema, SwapRequestSchema