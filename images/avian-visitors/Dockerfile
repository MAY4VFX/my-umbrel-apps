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

# Заглушка timedatectl: настоящий требует работающего systemd,
# а инсталлятор дёргает его во время сборки.
RUN printf '#!/bin/sh\necho "Etc/UTC"\n' > /usr/local/bin/timedatectl \
    && chmod +x /usr/local/bin/timedatectl

# Инсталлятор идёт под `set -e` и по ходу дела перезапускает сервисы
# (avahi-daemon, php-fpm, daemon-reload). При сборке systemd ещё не работает,
# и любой такой вызов уронил бы всю установку. Подменяем systemctl: команды
# запуска глушим, а enable/disable отдаём настоящему — он умеет работать
# офлайн и именно он расставляет симлинки юнитов.
# /usr/local/bin стоит в sudoers secure_path раньше /usr/bin, так что
# заглушка видна и под sudo. В финальном слое она удаляется.
RUN printf '%s\n' \
    '#!/bin/sh' \
    'case "$1" in' \
    '  start|restart|reload|try-restart|reload-or-restart|daemon-reload)' \
    '    echo "systemctl $*: пропущено при сборке образа" >&2; exit 0 ;;' \
    '  *) exec /usr/bin/systemctl "$@" ;;' \
    'esac' \
    > /usr/local/bin/systemctl \
    && chmod +x /usr/local/bin/systemctl

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
RUN rm -f /usr/local/bin/timedatectl /usr/local/bin/systemctl \
    && apt-get update && apt-get install -y --no-install-recommends php-mbstring \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

EXPOSE 80 8081

STOPSIGNAL SIGRTMIN+3
VOLUME ["/sys/fs/cgroup"]
CMD ["/sbin/init"]
