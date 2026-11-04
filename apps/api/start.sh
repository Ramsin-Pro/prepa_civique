#!/bin/sh
# Démarrage de l'API dans son image : migrations en attente, puis serveur.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "Démarrage impossible : la variable DATABASE_URL est vide dans ce service."
  echo "Service : ${RAILWAY_SERVICE_NAME:-inconnu} | environnement : ${RAILWAY_ENVIRONMENT_NAME:-inconnu}"
  echo "Variables liées à une base présentes ici (noms seulement) :"
  env | cut -d= -f1 | grep -E '^(DATABASE|PG|POSTGRES)' || echo "  aucune"
  echo "Sur Railway : Variables de CE service > Add Reference > service PostgreSQL > DATABASE_URL, puis Deploy."
  exit 1
fi

npx prisma migrate deploy
exec node dist/index.js
