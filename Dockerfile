FROM node:14

EXPOSE 8079

WORKDIR /usr/src/app

COPY . .
RUN yarn install
RUN yarn build

CMD ["yarn", "start"]