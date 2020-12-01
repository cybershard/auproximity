FROM node:14

WORKDIR /usr/src/app

COPY . .
RUN yarn install
RUN yarn build

RUN yarn --cwd auproximity-webui install
RUN yarn --cwd auproximity-webui build

RUN mkdir -p dist/src/dist

RUN cp -r auproximity-webui/dist dist/src

FROM node:14
EXPOSE 8079

ENV NODE_ENV=production

WORKDIR /usr/src/app-prod

COPY /usr/src/app/package.json .
RUN yarn install

COPY /usr/src/app/dist ./dist/

CMD ["yarn", "start"]