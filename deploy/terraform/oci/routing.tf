# Web pages come only from VM1; /api/* is shared by VM1 and the instance pool (2026-11-07).
#
# Why: CD deploys VM1 first and the pool catches up later (deploy/scale-out/update-pool.sh). While the two
# run different frontend builds, index.html from VM1 points at hashed bundles the pool does not have, and a
# load balancer that sends the bundle request to the pool returns 404, so the page renders blank.
# Serving every non-API path from VM1 keeps index.html and its bundles from the same build.
#   AWS terms: second target group + ALB listener rule "path /api/* -> api target group, default -> web".

resource "oci_load_balancer_backend_set" "web_vm1" {
  count            = var.scale_out ? 1 : 0
  load_balancer_id = oci_load_balancer_load_balancer.web[0].id
  name             = "web-vm1"
  policy           = "LEAST_CONNECTIONS"

  health_checker {
    protocol          = "HTTP"
    port              = 8080
    url_path          = "/api/health"
    return_code       = 200
    interval_ms       = 10000
    timeout_in_millis = 5000
    retries           = 3
  }
}

resource "oci_load_balancer_backend" "web_vm1" {
  count            = var.scale_out ? 1 : 0
  load_balancer_id = oci_load_balancer_load_balancer.web[0].id
  backendset_name  = oci_load_balancer_backend_set.web_vm1[0].name
  ip_address       = local.vm1_private_ip
  port             = 8080
}

resource "oci_load_balancer_load_balancer_routing_policy" "api_split" {
  count                      = var.scale_out ? 1 : 0
  load_balancer_id           = oci_load_balancer_load_balancer.web[0].id
  name                       = "api_split"
  condition_language_version = "V1"

  rules {
    name      = "api_to_all_api_vms"
    condition = "any(http.request.url.path sw '/api/')"
    actions {
      name             = "FORWARD_TO_BACKENDSET"
      backend_set_name = oci_load_balancer_backend_set.web[0].name
    }
  }
}
