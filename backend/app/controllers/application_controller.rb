class ApplicationController < ActionController::API
  include ActionController::Cookies

  MAX_PER_PAGE = 100

  before_action :require_user

  rescue_from ActiveRecord::RecordNotFound, with: -> { render_error(:not_found, "Not found") }
  rescue_from ActionController::ParameterMissing, with: ->(e) { render_error(:bad_request, e.message) }
  rescue_from Tmdb::Error, with: ->(e) { render_error(:service_unavailable, e.message, code: "provider_unavailable") }

  private

  def current_user
    @current_user ||= User.find_by(id: session[:user_id]) if session[:user_id]
  end

  def require_user
    render_error(:unauthorized, "Please sign in") unless current_user
  end

  def render_error(status, message, code: nil, details: nil)
    render status:, json: { error: { code: code || status.to_s, message:, details: }.compact }
  end

  def render_invalid(record)
    render_error(:unprocessable_content, record.errors.full_messages.to_sentence, code: "validation_failed", details: record.errors.to_hash)
  end

  def page_params
    page = [params[:page].to_i, 1].max
    per_page = (params[:per_page].presence || 24).to_i.clamp(1, MAX_PER_PAGE)
    [page, per_page]
  end

  def paginate(scope)
    page, per_page = page_params
    total = scope.count
    [scope.offset((page - 1) * per_page).limit(per_page), { page:, per_page:, total:, total_pages: (total / per_page.to_f).ceil }]
  end
end
