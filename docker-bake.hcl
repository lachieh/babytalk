variable "REGISTRY" {
  default = ""
}

variable "API_TAGS" {
  default = ["babytalk-api:latest"]
}

variable "WEB_TAGS" {
  default = ["babytalk-web:latest"]
}

variable "API_LABELS" {
  default = {}
}

variable "WEB_LABELS" {
  default = {}
}

group "default" {
  targets = ["api", "web"]
}

target "base" {
  dockerfile = "docker/base.Dockerfile"
  context    = "."
}

target "runner" {
  dockerfile = "docker/runner.Dockerfile"
  context    = "."
}

target "api" {
  dockerfile = "apps/api/Dockerfile"
  context    = "."
  contexts = {
    base   = "target:base"
    runner = "target:runner"
  }
  tags   = API_TAGS
  labels = API_LABELS
}

target "web" {
  dockerfile = "apps/web/Dockerfile"
  context    = "."
  contexts = {
    base   = "target:base"
    runner = "target:runner"
  }
  tags   = WEB_TAGS
  labels = WEB_LABELS
}
