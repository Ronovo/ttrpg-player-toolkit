FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY src src
COPY public public
RUN npm run build

# The coverage report only shows what the tests reach, so failing tests or low coverage still build the image.
FROM build AS coverage
COPY vitest.config.js ./
COPY tests tests
COPY coverage-index/istanbul.css coverage-index/
RUN npx vitest run --coverage ; mkdir -p coverage/js ; cat coverage-index/istanbul.css >> coverage/js/base.css

FROM nginxinc/nginx-unprivileged:1.29.8-alpine@sha256:0c79d56aee561a1d81c63f00eee5fb5fe29279560cdc55e91425133104c7fbe6
COPY --from=build /app/dist /usr/share/nginx/html
COPY coverage-index/index.html /usr/share/nginx/html/coverage/
COPY coverage-reports.json /usr/share/nginx/html/coverage/reports.json
COPY --from=coverage /app/coverage/js /usr/share/nginx/html/coverage/js
