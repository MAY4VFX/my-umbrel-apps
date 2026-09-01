# Образ AvianVisitors (форк BirdNET-Pi) для umbrelOS на Raspberry Pi.
# Основан на github.com/mithro/birdnet-pi-docker, отличия:
#  - клонируется форк Twarner491/AvianVisitors, ветка avian-visitors;
#  - инсталлятор вызывается напрямую, без newinstaller.sh (тот делает reboot).
FROM debian:trixie

ENV DEBIAN_FRONTEND=noninteractive

# systemd и минимум, нужный чтобы ЗАПУСТИТЬ инсталлятор;
# остальное инсталлятор доставит сам через apt.
RUN apt-get update && apt-get install -y --no-install-recommends \
    systemd \
    systemd-sysv \
    dbus \
    git \
    curl \
    sudo \
    python3 \
    python3-venv \
    python3-pip \
    jq \
    ca-certificates \
    gnupg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Юниты, которые в контейнере не имеют смысла.
# systemd-tmpfiles-setup оставляем — он создаёт /run/php на старте.
RUN rm -f /etc/systemd/system/*.wants/* \
    /lib/systemd/system/multi-user.target.wants/* \
    /etc/systemd/system/multi-user.target.wants/* \
    /lib/systemd/system/local-fs.target.wants/* \
    /lib/systemd/system/sockets.target.wants/*udev* \
    /lib/systemd/system/sockets.target.wants/*initctl* \
    /lib/systemd/system/systemd-update-utmp*

# Инсталлятор требует passwordless sudo; группа audio нужна для /dev/snd.
RUN useradd -m -s /bin/bash -G audio birdnet \
    && echo "birdnet ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/birdnet \
    && chmod 0440 /etc/sudoers.d/birdnet

# Заглушки на время сборки. Кладём их вместо настоящих бинарников, а не в
# /usr/local/bin: скрипты форка (update_caddyfile.sh, security_refresh.sh и
# другие) жёстко задают PATH=/usr/sbin:/usr/bin:/sbin:/bin, поэтому всё, что
# лежит в /usr/local/bin, они просто не видят.
#
# timedatectl: инсталлятор спрашивает таймзону, а настоящий требует systemd.
# systemctl: инсталлятор идёт под set -e и перезапускает сервисы; хуже того,
# install_icecast_start_guard заканчивается на `systemctl daemon-reload`, чей
# код возврата становится результатом функции — из-за этого установка падала
# с невнятным "Could not install the systemd live audio policy guard", хотя
# сам файл политики создавался успешно. Команды запуска глушим, всё остальное
# (в первую очередь enable, расставляющий симлинки юнитов) отдаём настоящему.
# В финальном слое оба бинарника возвращаются на место.
RUN mv /usr/bin/timedatectl /usr/bin/timedatectl.real \
 && printf '#!/bin/sh\necho "Etc/UTC"\n' > /usr/bin/timedatectl \
 && chmod +x /usr/bin/timedatectl \
 && mv /usr/bin/systemctl /usr/bin/systemctl.real \
 && printf '%s\n' \
      '#!/bin/sh' \
      'case "$1" in' \
      '  start|restart|reload|try-restart|reload-or-restart|daemon-reload|daemon-reexec)' \
      '    exit 0 ;;' \
      '  *) exec /usr/bin/systemctl.real "$@" ;;' \
      'esac' \
      > /usr/bin/systemctl \
 && chmod +x /usr/bin/systemctl

USER birdnet
ENV USER=birdnet
ENV HOME=/home/birdnet
WORKDIR /home/birdnet

# Папка обязана называться BirdNET-Pi: на этот путь завязаны скрипты форка.
RUN git clone --depth=1 -b avian-visitors \
    https://github.com/Twarner491/AvianVisitors.git BirdNET-Pi

WORKDIR /home/birdnet/BirdNET-Pi

# В контейнере /etc/hosts примонтирован демоном Docker, поэтому sed -i на нём
# падает с "Device or resource busy", а hostname задаёт Docker, а не hostnamectl.
# Обе функции нужны инсталлятору только ради внешних URL (BIRDNETPI_URL и
# компания), которые у нас пустые, — глушим их перед запуском.
RUN sed -i \
    -e 's|^  set_hostname$|  : # отключено: hostname задаёт Docker|' \
    -e 's|^  update_etc_hosts$|  : # отключено: /etc/hosts примонтирован Docker|' \
    scripts/install_services.sh \
 && grep -nE '^  : # отключено' scripts/install_services.sh

# Инсталлятор ставит пакеты, но своего `apt update` перед первым apt install
# не делает, а списки после базового слоя вычищены — обновляем сами.
RUN sudo apt-get update && bash scripts/install_birdnet.sh

USER root
RUN mv -f /usr/bin/systemctl.real /usr/bin/systemctl \
    && mv -f /usr/bin/timedatectl.real /usr/bin/timedatectl \
    && apt-get update && apt-get install -y --no-install-recommends php-mbstring \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Юнит Caddy из пакета Debian просит PrivateTmp и ProtectSystem, а systemd
# внутри контейнера не может построить mount namespace (/tmp не отдельная точка
# монтирования) — ExecReload падал с 226/NAMESPACE. Ломалась смена админского
# пароля: она перечитывает конфигурацию Caddy. Изоляция здесь избыточна,
# контейнер сам является песочницей. Имя с zzz — чтобы применялось последним,
# после override.conf, который кладёт инсталлятор.
RUN mkdir -p /etc/systemd/system/caddy.service.d \
 && printf '%s\n' \
      '[Service]' \
      'PrivateTmp=no' \
      'ProtectSystem=no' \
      'ProtectHome=no' \
      > /etc/systemd/system/caddy.service.d/zzz-container.conf

EXPOSE 80 8081

STOPSIGNAL SIGRTMIN+3
VOLUME ["/sys/fs/cgroup"]
CMD ["/sbin/init"]
