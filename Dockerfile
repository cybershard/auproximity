FROM node:14

EXPOSE 8079

WORKDIR /usr/src/app

COPY package*.json ./
RUN yarn install

COPY . .
RUN yarn serve