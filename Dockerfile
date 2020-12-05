FROM node:14 as build
WORKDIR /usr/src/app

COPY . .
RUN yarn install
RUN yarn build

RUN yarn --cwd auproximity-webui install
RUN yarn --cwd auproximity-webui build

RUN mkdir -p dist/src/dist
RUN cp -r auproximity-webui/dist dist/src


FROM mhart/alpine-node:14
EXPOSE 8079
WORKDIR /usr/src/app-prod

ENV NODE_ENV=production

COPY --from=build /usr/src/app/package.json .
RUN yarn install

COPY --from=build /usr/src/app/dist ./dist/

CMD ["yarn", "start"]
