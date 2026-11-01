# The coverage reports only show what the tests reach, so failing tests or low coverage still build the image.
FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS site
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js vitest.config.js ./
COPY src src
COPY public public
COPY tests tests
COPY coverage-index/istanbul.css coverage-index/
RUN npm run build
RUN npx vitest run --coverage ; mkdir -p coverage/js ; cat coverage-index/istanbul.css >> coverage/js/base.css

FROM python:3.12-slim@sha256:aa943ce411423c7582288f18707ff66eddcbaeb510502d747a72aeb34f30d159 AS python-coverage
WORKDIR /src
COPY pyproject.toml README.md .coveragerc ./
COPY server server
RUN pip install --no-cache-dir ".[test]"
COPY src/dice3d/dice.json src/dice3d/dice.json
COPY tests/__init__.py tests/
COPY tests/python tests/python
COPY coverage-index/coverage-py.css coverage-index/tools/functions.py coverage-index/
RUN python -m coverage run -m unittest discover -s tests/python -t . ; \
    python -m coverage html --fail-under=0 ; mkdir -p coverage/python ; \
    python -m coverage json --fail-under=0 -o coverage.json ; \
    python coverage-index/functions.py coverage.json coverage/python/functions.json

FROM python:3.12-slim@sha256:aa943ce411423c7582288f18707ff66eddcbaeb510502d747a72aeb34f30d159
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATA_DIR=/app/data
WORKDIR /app
COPY pyproject.toml README.md ./
COPY server server
RUN pip install --no-cache-dir . gunicorn==23.0.0 \
    && useradd --create-home --uid 1000 toolkit \
    && mkdir -p /app/data \
    && chown -R toolkit /app
COPY --chown=toolkit src/dice3d/dice.json src/dice3d/dice.json
COPY --chown=toolkit --from=site /app/dist dist
COPY --chown=toolkit coverage-index/index.html coverage/
COPY --chown=toolkit coverage-reports.json coverage/reports.json
COPY --chown=toolkit --from=site /app/coverage/js coverage/js
COPY --chown=toolkit --from=python-coverage /src/coverage/python coverage/python
USER toolkit
EXPOSE 8080
# One worker: the session signing key lives in process memory when TOOLKIT_SECRET_KEY is not set.
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--threads", "4", "--timeout", "120", "server:create_app()"]
