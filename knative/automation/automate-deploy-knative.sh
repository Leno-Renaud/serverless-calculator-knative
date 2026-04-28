#!/usr/bin/env bash

set -euo pipefail

OS_NAME=""
DOCKER_USERNAME=""
KOURIER_PORT=""
BUILT_IMAGES=()
KNATIVE_SERVICE_NAMES=()

log() {
  printf '%s\n' "$*"
}

warn() {
  printf 'Attention: %s\n' "$*" >&2
}

die() {
  printf 'Erreur: %s\n' "$*" >&2
  exit 1
}

trim() {
  local value="$1"
  value="${value#${value%%[![:space:]]*}}"
  value="${value%${value##*[![:space:]]}}"
  printf '%s' "$value"
}

slugify() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9._-]/-/g; s/--*/-/g; s/^-//; s/-$//'
}

array_contains() {
  local needle="$1"
  shift
  local item

  for item in "$@"; do
    if [[ "$item" == "$needle" ]]; then
      return 0
    fi
  done

  return 1
}

choose_os() {
  local answer
  while true; do
    read -r -p "Es-tu sur mac ou linux ? [mac/linux]: " answer
    answer="$(trim "$(printf '%s' "$answer" | tr '[:upper:]' '[:lower:]')")"

    case "$answer" in
      mac|macos|darwin)
        printf 'mac'
        return 0
        ;;
      linux)
        printf 'linux'
        return 0
        ;;
    esac

    warn "Réponse attendue: mac ou linux."
  done
}

choose_directory_mac() {
  local prompt="$1"
  local result

  if result="$(PROMPT_TEXT="$prompt" DEFAULT_DIR="$PWD" osascript 2>/dev/null <<'APPLESCRIPT'
set promptText to system attribute "PROMPT_TEXT"
set defaultDir to system attribute "DEFAULT_DIR"

try
  set chosenFolder to choose folder with prompt promptText default location POSIX file defaultDir
  return POSIX path of chosenFolder
on error number -128
  return ""
end try
APPLESCRIPT
)"; then
    :
  else
    result=""
  fi

  printf '%s' "$(trim "$result")"
}

choose_directory_linux() {
  local prompt="$1"
  local result

  if command -v zenity >/dev/null 2>&1; then
    result="$(zenity --file-selection --directory --title="$prompt" --filename="$PWD/" 2>/dev/null || true)"
    printf '%s' "$(trim "$result")"
    return 0
  fi

  read -r -p "$prompt (chemin du dossier, vide pour arrêter): " result
  printf '%s' "$(trim "$result")"
}

choose_directory() {
  local prompt="$1"

  if [[ "$OS_NAME" == "mac" ]]; then
    choose_directory_mac "$prompt"
  else
    choose_directory_linux "$prompt"
  fi
}

ensure_docker_login() {
  local username

  username="$(docker info --format '{{.Username}}' 2>/dev/null || true)"

  if [[ -z "$username" ]]; then
    log "Connexion Docker requise. Si besoin, renseigne ton login dans le prompt Docker."
    docker login
    username="$(docker info --format '{{.Username}}' 2>/dev/null || true)"
  fi

  if [[ -z "$username" ]]; then
    read -r -p "Nom d'utilisateur Docker Hub: " username
  fi

  username="$(trim "$username")"
  [[ -n "$username" ]] || die "Impossible de déterminer le nom Docker Hub."

  DOCKER_USERNAME="$username"
}

wait_for_knative_control_plane() {
  local deployment

  log "Attente de la disponibilité du control-plane Knative..."
  for deployment in activator autoscaler controller webhook; do
    kubectl -n knative-serving rollout status "deployment/${deployment}" --timeout=10m
  done

  if kubectl -n kourier-system get deployment net-kourier-controller >/dev/null 2>&1; then
    log "Attente de la disponibilité de Kourier..."
    kubectl -n kourier-system rollout status deployment/net-kourier-controller --timeout=10m
  else
    warn "Déploiement net-kourier-controller introuvable dans kourier-system."
  fi
}

cleanup_failed_default_domain_pods() {
  local pod_name

  while IFS= read -r pod_name; do
    [[ -n "$pod_name" ]] || continue
    kubectl -n knative-serving delete "$pod_name" --ignore-not-found >/dev/null
  done < <(kubectl -n knative-serving get pods -l job-name=default-domain --field-selector=status.phase=Failed -o name 2>/dev/null || true)
}

wait_for_default_domain_job() {
  if kubectl -n knative-serving wait --for=condition=complete job/default-domain --timeout=180s; then
    cleanup_failed_default_domain_pods
    return 0
  fi

  warn "Le job default-domain a échoué au premier essai. Relance contrôlée..."
  kubectl -n knative-serving delete job default-domain --ignore-not-found >/dev/null
  kubectl -n knative-serving delete pod -l job-name=default-domain --ignore-not-found >/dev/null
  kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.21.2/serving-default-domain.yaml >/dev/null

  kubectl -n knative-serving wait --for=condition=complete job/default-domain --timeout=180s || die "Le job default-domain échoue encore après relance."
  cleanup_failed_default_domain_pods
}

deploy_default_domain() {
  log "Activation du domaine par défaut sslip.io..."
  kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.21.2/serving-default-domain.yaml
  wait_for_default_domain_job
}

setup_knative_stack() {
  log "Installation de Knative Serving..."
  kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.21.2/serving-crds.yaml
  kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.21.2/serving-core.yaml

  log "Installation de Kourier..."
  kubectl apply -f https://github.com/knative-extensions/net-kourier/releases/download/knative-v1.21.0/kourier.yaml

  log "Configuration du routage Kourier..."
  kubectl patch configmap/config-network \
    --namespace knative-serving \
    --type merge \
    --patch '{"data":{"ingress-class":"kourier.ingress.networking.knative.dev"}}'

  wait_for_knative_control_plane
  deploy_default_domain
}

start_cluster() {
  if [[ "$OS_NAME" == "mac" ]]; then
    command -v colima >/dev/null 2>&1 || die "Colima est introuvable dans le PATH."
    log "Démarrage de Colima avec Kubernetes..."
    colima start --kubernetes
  else
    if [[ -x ./startk3sServer.sh ]]; then
      log "Démarrage de K3s via ./startk3sServer.sh..."
      ./startk3sServer.sh
    elif command -v startk3sServer.sh >/dev/null 2>&1; then
      log "Démarrage de K3s via startk3sServer.sh..."
      startk3sServer.sh
    else
      die "Impossible de trouver startk3sServer.sh. Lance le script depuis le dossier qui le contient, ou ajoute-le au PATH."
    fi
  fi
}

build_and_push_dockerfile_tree() {
  local root_dir="$1"
  local dockerfile_dirs=()
  local dockerfile_path
  local dockerfile_dir
  local image_name
  local image_ref

  while IFS= read -r -d '' dockerfile_path; do
    dockerfile_dir="$(dirname "$dockerfile_path")"
    if ! array_contains "$dockerfile_dir" "${dockerfile_dirs[@]:-}"; then
      dockerfile_dirs+=("$dockerfile_dir")
    fi
  done < <(find "$root_dir" -type f -name 'Dockerfile' -print0)

  if [[ "${#dockerfile_dirs[@]}" -eq 0 ]]; then
    warn "Aucun Dockerfile trouvé dans ${root_dir}."
    return 0
  fi

  for dockerfile_dir in "${dockerfile_dirs[@]}"; do
    image_name="$(slugify "$(basename "$dockerfile_dir")")"
    image_ref="docker.io/${DOCKER_USERNAME}/${image_name}:1.0"

    log "Build de l'image ${image_ref} depuis ${dockerfile_dir}..."
    docker build -t "$image_ref" "$dockerfile_dir"

    log "Push de l'image ${image_ref}..."
    docker push "$image_ref"

    BUILT_IMAGES+=("$image_ref")
  done
}

extract_knative_service_name() {
  local manifest_file="$1"

  awk '
    BEGIN { in_knative = 0; in_metadata = 0 }
    /^---[[:space:]]*$/ { in_knative = 0; in_metadata = 0; next }
    /^apiVersion:[[:space:]]*serving\.knative\.dev\/v1([[:space:]]*#.*)?$/ { in_knative = 1; next }
    in_knative && /^kind:[[:space:]]*Service([[:space:]]*#.*)?$/ { next }
    in_knative && /^metadata:[[:space:]]*$/ { in_metadata = 1; next }
    in_knative && in_metadata && /^[[:space:]]*name:[[:space:]]*/ {
      sub(/^[[:space:]]*name:[[:space:]]*/, "", $0)
      print $0
      exit
    }
  ' "$manifest_file"
}

collect_manifests_in_directory() {
  local root_dir="$1"
  local manifest_file
  local tmp_manifest
  local service_name
  local found_any=0

  while IFS= read -r -d '' manifest_file; do
    found_any=1

    service_name=""
    if grep -qE '^apiVersion:[[:space:]]*serving\.knative\.dev/v1' "$manifest_file" && grep -qE '^kind:[[:space:]]*Service' "$manifest_file"; then
      service_name="$(extract_knative_service_name "$manifest_file" | head -n 1)"
      service_name="$(trim "$service_name")"
      if [[ -n "$service_name" ]] && ! array_contains "$service_name" "${KNATIVE_SERVICE_NAMES[@]:-}"; then
        KNATIVE_SERVICE_NAMES+=("$service_name")
      fi
    fi

    log "Application du manifest ${manifest_file}..."
    tmp_manifest="$(mktemp "${TMPDIR:-/tmp}/knative-manifest-XXXXXX.yaml")"
    cp "$manifest_file" "$tmp_manifest"

    if grep -q 'TON_USER_DOCKERHUB' "$tmp_manifest"; then
      DOCKER_USER="$DOCKER_USERNAME" perl -0pi -e 's/TON_USER_DOCKERHUB/$ENV{DOCKER_USER}/g' "$tmp_manifest"
    fi

    kubectl apply -f "$tmp_manifest"
    rm -f "$tmp_manifest"
  done < <(find "$root_dir" -type f \( -name '*.yaml' -o -name '*.yml' \) -print0)

  if [[ "$found_any" -eq 0 ]]; then
    warn "Aucun fichier YAML trouvé dans ${root_dir}."
  fi
}

collect_docker_targets() {
  local selected_dir

  while true; do
    selected_dir="$(choose_directory "Sélectionne un dossier contenant des Dockerfile(s). Annule pour terminer.")"
    selected_dir="$(trim "$selected_dir")"

    if [[ -z "$selected_dir" ]]; then
      break
    fi

    if [[ ! -d "$selected_dir" ]]; then
      warn "Dossier introuvable: ${selected_dir}"
      continue
    fi

    build_and_push_dockerfile_tree "$selected_dir"
  done
}

collect_yaml_targets() {
  local selected_dir

  while true; do
    selected_dir="$(choose_directory "Sélectionne un dossier contenant des YAML à appliquer. Annule pour terminer.")"
    selected_dir="$(trim "$selected_dir")"

    if [[ -z "$selected_dir" ]]; then
      break
    fi

    if [[ ! -d "$selected_dir" ]]; then
      warn "Dossier introuvable: ${selected_dir}"
      continue
    fi

    collect_manifests_in_directory "$selected_dir"
  done
}

detect_lan_ip() {
  local ip

  if [[ "$OS_NAME" == "mac" ]]; then
    ip="$(ipconfig getifaddr en0 2>/dev/null || true)"
    if [[ -z "$ip" ]]; then
      ip="$(ipconfig getifaddr en1 2>/dev/null || true)"
    fi
    if [[ -z "$ip" ]]; then
      ip="$(route -n get default 2>/dev/null | awk '/interface:/{print $2; exit}' | xargs -I{} ipconfig getifaddr {} 2>/dev/null || true)"
    fi
  else
    ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
    if [[ -z "$ip" ]]; then
      ip="$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") {print $(i + 1); exit}}' || true)"
    fi
  fi

  ip="$(trim "$ip")"
  [[ -n "$ip" ]] || die "Impossible de déterminer l'adresse IP LAN."
  printf '%s' "$ip"
}

patch_config_domain() {
  local lan_ip="$1"

  log "Mise à jour du config-domain pour ${lan_ip}.sslip.io..."
  kubectl patch configmap config-domain -n knative-serving --type merge -p "{\"data\":{\"${lan_ip}.sslip.io\":\"\"}}"
}

find_free_port() {
  local port

  for port in $(seq 8080 8099); do
    if ! nc -z 127.0.0.1 "$port" >/dev/null 2>&1; then
      printf '%s' "$port"
      return 0
    fi
  done

  die "Aucun port libre trouvé entre 8080 et 8099."
}

start_kourier_port_forward() {
  local port
  local log_file

  port="$(find_free_port)"
  log_file="${TMPDIR:-/tmp}/kourier-port-forward-${port}.log"

  log "Lancement du port-forward Kourier sur le port ${port}..."
  nohup kubectl -n kourier-system port-forward svc/kourier "${port}:80" --address 0.0.0.0 >"$log_file" 2>&1 &
  KOURIER_PORT="$port"
}

print_frontend_urls() {
  local lan_ip="$1"
  local url_port=""
  local service_name

  if [[ "$KOURIER_PORT" != "" && "$KOURIER_PORT" != "80" ]]; then
    url_port=":${KOURIER_PORT}"
  fi

  if [[ "${#KNATIVE_SERVICE_NAMES[@]}" -eq 0 ]]; then
    service_name="calc-serverless"
    log "Aucun service Knative explicite détecté. URL par défaut:"
    log "http://${service_name}.default.${lan_ip}.sslip.io${url_port}/"
    return 0
  fi

  log "URLs à visiter :"
  for service_name in "${KNATIVE_SERVICE_NAMES[@]}"; do
    log "http://${service_name}.default.${lan_ip}.sslip.io${url_port}/"
  done
}

main() {
  OS_NAME="$(choose_os)"
  log "OS détecté: ${OS_NAME}"

  start_cluster
  setup_knative_stack

  ensure_docker_login
  collect_docker_targets
  collect_yaml_targets

  local lan_ip
  lan_ip="$(detect_lan_ip)"
  patch_config_domain "$lan_ip"

  if [[ "$OS_NAME" == "mac" ]]; then
    start_kourier_port_forward
  else
    KOURIER_PORT="80"
  fi

  print_frontend_urls "$lan_ip"
}

main "$@"