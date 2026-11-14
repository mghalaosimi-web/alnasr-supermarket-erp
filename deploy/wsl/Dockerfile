# AL-NASR WSL2 host root filesystem.
# Exported as a rootfs tar and imported by WSL; not run as a container.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      systemd systemd-sysv dbus \
      docker.io docker-compose-v2 \
      ca-certificates curl iproute2 iptables iputils-ping \
 && mkdir -p /etc/docker /opt/alnasr /var/lib/docker /etc/systemd/system/multi-user.target.wants \
 && ln -sf /lib/systemd/system/docker.service /etc/systemd/system/multi-user.target.wants/docker.service \
 && ln -sf /lib/systemd/system/containerd.service /etc/systemd/system/multi-user.target.wants/containerd.service \
 && docker --version \
 && docker compose version \
 && printf '%s\\n' '{' '  "iptables": true,' '  "log-driver": "local",' '  "live-restore": true' '}' > /etc/docker/daemon.json \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/* /var/cache/apt/*

COPY wsl.conf /etc/wsl.conf
STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
