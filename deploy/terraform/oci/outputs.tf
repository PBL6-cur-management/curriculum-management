output "public_ip" {
  value = local.public_ip
}

# Caddy gets a Let's Encrypt certificate for this name. Put it in demo.env as PUBLIC_HOST.
output "public_host" {
  value = var.public_host
}

# The one record to add by hand in tenten.vn's DNS panel.
output "dns_record" {
  value = local.public_ip != null ? "A  ${var.public_host == var.dns_zone ? "@" : trimsuffix(var.public_host, ".${var.dns_zone}")}  ${local.public_ip}  TTL 300  (zone ${var.dns_zone})" : null
}

# Free wildcard DNS for the same address: usable before the tenten record has propagated.
output "fallback_host" {
  value = local.public_ip != null ? "${replace(local.public_ip, ".", "-")}.sslip.io" : null
}

output "ssh" {
  value = local.public_ip != null ? "ssh -i ~/.ssh/oci_ctdt ubuntu@${local.public_ip}" : null
}

output "image" {
  value = data.oci_core_images.ubuntu.images[0].display_name
}
