# AL-NASR WSL2 host root filesystem.
# Exported as a rootfs tar and imported by WSL; not run as a container.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      systemd systemd-sysv dbus \
      docker.io docker-compose-v2 \
      ca-certificates curl iproute2 iptables iputils-ping \
 && systemctl enable docker.service containerd.service \
 && mkdir -p /etc/docker /opt/alnasr /var/lib/docker \
 && printf '%s\\n' '{' '  "iptables": true,' '  "log-driver": "local",' '  "live-restore": true' '}' > /etc/docker/daemon.json \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/* /var/cache/apt/*

COPY wsl.conf /etc/wsl.conf
STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
