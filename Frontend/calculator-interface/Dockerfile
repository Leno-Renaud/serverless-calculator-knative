#charge un environnement node leger React en fichiers web classiques
#nomme cette étape "build" pour y faire référence plus tard.
FROM docker.io/library/node:20-alpine AS build

#Crée un dossier /app à l'intérieur du conteneur et s'y déplace
WORKDIR /app
#URL API injectée au build Vite
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
#Copie fichiers de configuration npm depuis Mac vers le dossier /app du conteneur.
#si seul code react change, gain de temps en ne réinstallant pas les dépendances
COPY package*.json ./

#Installe les dépendances
RUN npm install

#copie le reste du code local vers le conteneur
COPY . .
#Exécute le script compile, minifie et optimise l'app. Résultat final dans dossier dist
RUN npm run build

#étape 2 : Serveur web Nginx
#démarre une toute nouvelle image, vierge, contenant uniquement le serveur web Nginx.
#Nginx intercepte la demande, va chercher ces fichiers, et les envoie au navigateur de l'utilisateur.
FROM docker.io/library/nginx:alpine

#cherche /dist dans environnmenet build, dépose dans le dossier où Nginx sert les fichiers web.
COPY --from=build /app/dist /usr/share/nginx/html
#conteneur veut écouter port 80 (HTTP)
EXPOSE 80
#lance nginx en mode foreground (sans détacher) pour que le conteneur reste actif et serve les fichiers web
CMD ["nginx", "-g", "daemon off;"]

#construire l'image docker le flag -t pour taguer l'image avec un nom, ici "calculatrice"
#docker build -t calculatrice .

#le flag -d pour détacher le conteneur et le faire tourner en arrière-plan
#-p pour faire le mapping du port 80 du conteneur vers le port 8080 de la machine hôte, 
#--name pour donner un nom au conteneur, ici "calc-app", et nom image à utiliser, ici "calculatrice"
#docker run -d -p 8080:80 --name calc-app calculatrice

#pour le stopper/start
#docker stop/start calc-app
