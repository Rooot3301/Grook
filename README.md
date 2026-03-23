# 🤖 Grook Bot

Bot Discord multifonctions inspiré par l'univers de **Grook**.  
Il combine des outils de **modération**, des **mini‑jeux** interactifs, des commandes "fun" et des **easter eggs** pour rendre votre serveur vivant et sécurisé.

## 🔧 Installation et lancement

1. **Cloner** ce dépôt ou créer un nouveau dossier et y copier les fichiers.
2. Exécuter `npm install` pour installer les dépendances.
3. Copier le fichier `.env.example` en `.env` et remplir les variables :
   - `DISCORD_TOKEN` : le token de votre bot (obtenu dans le [Discord Developer Portal](https://discord.com/developers/applications)).
   - `VIRUSTOTAL_API_KEY` : clé API VirusTotal (facultatif, utilisée pour analyser les liens). Laisser vide pour désactiver l'analyse.
4. Lancer le bot avec `npm start`. En développement, utilisez `npm run dev` pour un rechargement automatique.

## 📂 Arborescence

```
grook-bot/
├─ .env.example         # Exemple de configuration
├─ package.json         # Dépendances et scripts
├─ README.md            # Ce fichier
├─ src/
│  ├─ index.js          # Point d’entrée du bot
│  ├─ loader/
│  │  ├─ commands.js    # Chargement et enregistrement des slash commands
│  │  └─ events.js      # Enregistrement des événements
│  ├─ commands/         # Commandes organisées par catégories
│  │  ├─ moderation/    # Commandes de modération
│  │  ├─ fun/           # Commandes fun (mini‑jeux simples)
│  │  ├─ games/         # Jeux interactifs plus complexes
│  │  └─ util/          # Utilitaires (help, ping…)
│  ├─ features/         # Modules internes (casier, logs, VT, easter eggs…)
│  ├─ utils/            # Fonctions utilitaires (durées, texte…)
│  ├─ data/             # Données persistantes (config, cas, warnings…)
│  └─ events/           # Événements Discord (messageCreate, interactionCreate)
└─ .gitignore
```

## ⚙️ Commandes de modération

Ces commandes nécessitent les permissions Discord adéquates pour fonctionner (ban, kick, gérer les messages, etc.). Les logs sont envoyés dans un salon défini via `/modlogs`.

- `/ban @user [raison]` : bannit un utilisateur définitivement.  
- `/kick @user [raison]` : expulse un utilisateur du serveur.  
- `/mute @user [durée] [raison]` : mute un utilisateur pendant un temps donné (timeout natif).  
- `/unmute @user` : lève le mute.  
- `/warn @user [raison]` : enregistre un avertissement.  
- `/warnings @user` : liste les avertissements d’un membre.  
- `/clear [nombre]` : supprime un nombre de messages dans le salon.  
- `/lock #channel` / `/unlock #channel` : verrouille/déverrouille un salon.  
- `/slowmode #channel [secondes]` : active un mode lent pour calmer un canal.  
- `/nick @user [nouveau_pseudo]` : change le pseudo d’un membre.  
- `/modlogs #channel` : définit le salon où les actions de modération sont enregistrées.  
- `/serverinfo` : affiche des informations générales sur le serveur.  
- `/userinfo @user` : affiche les informations d’un membre.  
- `/case @user` : affiche le casier disciplinaire d’un membre.  
- `/case remove <id>` : supprime un cas disciplinaire.  
- `/cases` : liste tous les cas du serveur (optionnel).  
- `/panic` : verrouille tous les salons textuels et active un slowmode global (anti‑raid).  
- `/help` : affiche la liste des commandes disponibles par catégorie.

Les cas et avertissements sont stockés dans des fichiers JSON (voir `src/data/`).

## 🥚 Easter Eggs

Grook comporte plusieurs surprises aléatoires :

1. **Rickroll** : de temps en temps, un message « GG, voilà ta récompense » apparaît avec un bouton menant vers un célèbre lien YouTube. Parfois Grook se ravise et répond simplement « Non, pas aujourd’hui 😏 ».
2. **Flemme** : Grook peut refuser d’exécuter une commande (rarement) et répondre « Laisse‑moi dormir zebi », ou « Demande à Google frère », ou « J’ai la flemme, reviens plus tard ».  
3. **Prophéties** : Grook poste parfois une prophétie absurde dans le salon de discussion.

Ces comportements sont réglables via la configuration et restent rares pour éviter le spam.

## 🎉 Commandes fun

Pour égayer le serveur, quelques commandes simples :

- `/grookflip` : lance une pièce (Grook peut tricher).  
- `/grookrate <truc>` : note quelque chose de 0 à 10 de façon sarcastique.  
- `/grookfortune` : prédit l’avenir d’un membre (ou du serveur) façon cookie chinois.  
- `/grookquote <lien_ou_id>` : cite un message de façon stylée.  
- `/grookstats` : affiche les statistiques des mini‑jeux (victoires par membre).  

## 🎮 Jeux interactifs

### GrookRoulette
Commandez `/grookroulette` pour lancer une roulette russe virtuelle. Les joueurs cliquent sur « Participer » pour rejoindre. Grook élimine un participant à chaque tour jusqu’à la victoire finale.

### GrookTyper
Avec `/grooktyper`, Grook envoie une phrase aléatoire et le premier joueur à la retaper correctement l’emporte.

### GrookGuess
La commande `/grookguess` lance un jeu de devinettes : Grook pense à un nombre entre 1 et 100 et répond « Plus haut ! » ou « Plus bas ! » jusqu’à trouver le bon nombre. Grook peut parfois mentir pour pimenter le jeu.

### GrookSpy
Jeu d’Undercover. En lançant `/grookspy`, les joueurs rejoignent via un bouton. Grook donne un mot identique à tous sauf à l’Undercover, qui reçoit un mot approchant. Chacun donne ensuite un indice ; les joueurs votent pour démasquer l’espion. Si l’Undercover survit, il gagne.

### Liar
Avec `/liar`, l’hôte saisit trois affirmations (deux vraies, une fausse). Les autres votent pour deviner laquelle est le mensonge. Grook révèle la réponse et roast les perdants.

> **Remarque :** certaines implémentations de jeux complexes nécessitent des interactions avancées (boutons, modals). Ce dépôt fournit un squelette de base ; vous pouvez enrichir les jeux selon vos besoins.

## 🔍 Analyse des liens (VirusTotal)

Lorsqu’un utilisateur poste un lien, Grook tente de l’analyser via l’API VirusTotal (si la clé API est fournie). Il indique si le lien est sain, suspect ou dangereux. Les scans sont mis en cache pour respecter les quotas. La configuration permet d’activer/désactiver cette fonctionnalité et de personnaliser son comportement.

## 📌 Contribuer

Le code est organisé de façon modulaire. Chaque commande est dans son propre fichier. Les données persistantes (cas, avertissements, statistiques et configuration) se trouvent dans `src/data/`.  
N’hésitez pas à proposer des améliorations ou à compléter les jeux existants.

## 📄 Licence

Ce projet est publié sous licence MIT. Vous pouvez l’utiliser et le modifier librement en respectant cette licence.