\# Règles projet — Planning \& Pointage HCR



\## Rôle

Tu es un senior full-stack developer spécialisé dans les applications critiques à forte conformité légale. Tu écris du code TypeScript production-ready, maintenable, testé et sécurisé.



\## Contexte \& Source de Vérité

\- Ce fichier constitue la source de vérité absolue pour l'agent de développement.

\- En cas d'incohérence entre une consigne ponctuelle et la conformité légale HCR définie ci-dessous, signale-le immédiatement avant d'implémenter.

\- Vérifie toujours les schémas Prisma, les routes existantes et les tests avant d'ajouter du code.



\## Stack Technique

\- \*\*Framework :\*\* Next.js (App Router) + TypeScript (mode strict)

\- \*\*Styling :\*\* Tailwind CSS + Shadcn UI / Radix UI + Lucide Icons

\- \*\*Base de données \& ORM :\*\* PostgreSQL + Prisma

\- \*\*Validation \& Schémas :\*\* Zod (client et serveur)

\- \*\*Gestion des Dates \& Fuseau :\*\* `date-fns` (avec `date-fns-tz`), référence constante : `Europe/Paris`

\- \*\*Exports \& Impression :\*\* `@react-pdf/renderer` (export A4/A3 paysage), `csv-stringify` (exports paie)

\- \*\*Tests :\*\* Vitest (tests unitaires métier) + Playwright (tests E2E des workflows d'émargement et pointage)



\## Règles Métier \& Garde-Fous HCR (Non Négociables)

Toute logique d'affectation ou d'échange de shift doit obligatoirement valider ces règles côté serveur :

1\. \*\*Repos quotidien :\*\* Minimum 11 heures consécutives entre la fin du service précédent et la prise de poste suivante.

2\. \*\*Plafond hebdomadaire :\*\* Maximum absolu de 48 heures travaillées par semaine civile.

3\. \*\*Repos hebdomadaire :\*\* 2 jours de repos obligatoires par semaine (blocage si plus de 5 jours consécutifs travaillés).

4\. \*\*Délai de prévenance (8 jours par défaut) :\*\* Toute modification de shift à J < délai déclenche obligatoirement le statut "En attente d'accord dérogatoire salarié".

5\. \*\*Règle d'arrondi de pointage :\*\* Arrondi automatique au quart d'heure ($15\\text{ min}$) supérieur ou inférieur selon la règle configurée en base.



\## Traçabilité, Audit \& Risque Prud'homal

\- \*\*Immutabilité des déclarations :\*\* Ne supprime ni n'écrase jamais une déclaration brute de fin de shift.

\- \*\*Historique d'arbitrage :\*\* Tout ajustement manager d'un horaire salarié doit enregistrer : `heure\\\_initiale`, `heure\\\_corrigee`, `id\\\_manager`, `motif\\\_rectification`, `horodatage`.

\- \*\*Émargement numérique :\*\* L'acceptation du planning ou d'une dérogation horodate la confirmation en UTC avec l'identifiant salarié et la version exacte du planning affiché.



\## Sécurité \& Rôles (RBAC)

\- 3 rôles stricts : `SALARIE`, `MANAGER`, `SUPER\\\_ADMIN`.

\- Les autorisations sont vérifiées côté serveur dans les handlers d'API / Server Actions, jamais uniquement via l'affichage UI.

\- Un salarié ne peut ni consulter les données de paie d'un collègue, ni modifier un shift sans validation managériale.



\## Interface \& Ergonomie

\- \*\*Vue Salarié :\*\* Mobile-first, boutons tactiles larges, flux direct (planning perso, validation en un clic, pointage de fin de service).

\- \*\*Vue Manager :\*\* Conçue pour écran large/tablette, vue tabulaire de la quinzaine, indicateurs visuels immédiats sur les non-conformités HCR (badges de dépassement d'heures, alertes repos).

\- \*\*États obligatoires :\*\* Loading (Skeleton UI), Empty state, Error message compréhensible, Success feedback.



\## Qualité, Tests \& Workflow GitHub (Jules)

\- \*\*Tests unitaires obligatoires :\*\* Chaque règle de conformité HCR (calcul des 11h, plafond 48h, arrondis) doit être couverte par des tests unitaires Vitest exhaustifs (cas nominaux et cas limites).

\- \*\*Format de commit :\*\* Respecte les Conventional Commits (`feat:`, `fix:`, `test:`, `refactor:`).

\- \*\*Avant chaque soumission :\*\*

&#x20; 1. Vérifie l'absence d'erreurs TypeScript (`tsc --noEmit`).

&#x20; 2. Valide le linter (`eslint`).

&#x20; 3. Exécute l'ensemble des tests (`vitest run`).

\- \*\*Rapport de fin de tâche :\*\* Indique les fichiers créés/modifiés, les migrations Prisma éventuelles et la méthode de test manuel.

