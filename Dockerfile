# One image for the whole app: Rails serves the API and the built React frontend from one origin.

# --- Frontend build ---
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Rails app ---
FROM ruby:3.1-slim
RUN apt-get update -qq \
 && apt-get install -y --no-install-recommends build-essential libpq-dev libyaml-dev curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV RAILS_ENV=production \
    BUNDLE_DEPLOYMENT=1 \
    BUNDLE_WITHOUT=development:test \
    RAILS_LOG_TO_STDOUT=1

COPY backend/Gemfile backend/Gemfile.lock ./
RUN bundle install && rm -rf ~/.bundle/ /usr/local/bundle/cache
COPY backend/ ./
COPY --from=web /web/dist/ ./public/
RUN bundle exec bootsnap precompile app/ lib/

RUN useradd --create-home rails && chown -R rails:rails log tmp db
USER rails

# Render sets PORT. db:prepare migrates (and seeds a brand-new database) before the server starts.
CMD ["sh", "-c", "bin/rails db:prepare && bin/rails server -b 0.0.0.0 -p ${PORT:-3000}"]
