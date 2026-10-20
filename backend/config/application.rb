require_relative "boot"

require "rails"
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
require "action_controller/railtie"
require "action_mailer/railtie"
require "action_view/railtie"

Bundler.require(*Rails.groups)

module Reeltime
  class Application < Rails::Application
    config.load_defaults 7.2
    config.autoload_lib(ignore: %w[assets tasks])
    config.api_only = true

    # Cookie-based sessions for the JSON API. The frontend is served from the same
    # origin (Vite proxy in dev), so a SameSite=Lax, HttpOnly cookie keeps sessions
    # out of JS and blocks cross-site state-changing requests.
    config.middleware.use ActionDispatch::Cookies
    config.middleware.use ActionDispatch::Session::CookieStore,
      key: "_reeltime_session", same_site: :lax, secure: Rails.env.production?

  end
end
