# Cosmo Router wrapped in a Chainguard base image so the router itself is
# part of the "zero-CVE supply chain" story.
FROM cgr.dev/chainguard/wolfi-base:latest AS runtime

ARG ROUTER_VERSION=0.311.0
ARG TARGETARCH=amd64

RUN apk add --no-cache curl ca-certificates \
  && mkdir -p /usr/local/bin /tmp/router \
  && curl -fsSL "https://github.com/wundergraph/cosmo/releases/download/router%40${ROUTER_VERSION}/router-router%40${ROUTER_VERSION}-linux-${TARGETARCH}.tar.gz" \
       -o /tmp/router.tar.gz \
  && tar -xzf /tmp/router.tar.gz -C /tmp/router \
  && find /tmp/router -type f -name router -exec cp {} /usr/local/bin/router \; \
  && chmod +x /usr/local/bin/router \
  && rm -rf /tmp/router.tar.gz /tmp/router

WORKDIR /app
COPY config.yaml /app/config.yaml
COPY supergraph.json /app/supergraph.json

ENV CONFIG_PATH=/app/config.yaml
EXPOSE 3002 5025

USER 65532:65532
ENTRYPOINT ["/usr/local/bin/router"]
