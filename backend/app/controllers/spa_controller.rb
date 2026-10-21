# Serves the built React app (copied into public/ at build time) for any non-API page, so
# client-side routes like /plan survive a refresh. Assets themselves come from the static file server.
class SpaController < ActionController::API
  INDEX = Rails.public_path.join("index.html")

  def index
    return head :not_found unless INDEX.exist? # development: the app is served by Vite instead

    response.headers["Cache-Control"] = "no-cache" # always pick up the latest deploy's asset names
    send_file INDEX, type: "text/html", disposition: "inline"
  end
end
