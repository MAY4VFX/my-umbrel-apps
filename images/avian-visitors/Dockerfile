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

# Штатный бандл иллюстраций — птицы западных США (333 вида), поэтому европейские
# птицы рисовались заглушкой с яйцами. Станция ездит по Европе, так что кладём
# поверх все европейские наборы из illustration-bundles.md апстрима.
# Порядок важен: при совпадении вида побеждает скопированный последним, поэтому
# иберийский идёт в конце — он профильный для текущей стоянки.
RUN set -eux; \
    for spec in \
      "bassrelic/AvianVisitors-German-Fork add_german_species avian/assets/illustrations" \
      "jonnywright/AvianAssets main illustrations" \
      "theskyisthelimit/AvianVisitors europe-illustrations avian/assets/illustrations" \
      "lloydalexporter/AvianAssets_GB-ENG main illustrations" \
      "RoqueAlonso/AvianVisitors iberia-illustrations avian/assets/illustrations" \
    ; do \
      set -- $spec; \
      git clone --depth=1 -b "$2" --filter=blob:none --sparse \
        "https://github.com/$1.git" /tmp/bundle; \
      git -C /tmp/bundle sparse-checkout set "$3"; \
      cp -a "/tmp/bundle/$3/." /home/birdnet/BirdNET-Pi/avian/assets/illustrations/; \
      rm -rf /tmp/bundle; \
    done; \
    ls /home/birdnet/BirdNET-Pi/avian/assets/illustrations | wc -l

# Маски силуэтов не переносятся из наборов, а пересобираются по всей библиотеке:
# у английского набора их вообще нет, а склеивать чужие таблицы руками рискованно.
# Скрипт читает каждую иллюстрацию и пишет dims.json + masks.json целиком.
# Версии в apt.js бампаются, иначе браузер отдаст старые таблицы из кэша.
RUN cd /home/birdnet/BirdNET-Pi/avian/scripts \
 && /home/birdnet/BirdNET-Pi/birdnet/bin/python3 build_masks.py \
 && sed -i \
      -e "s/var TABLE_VERSION = 'r13'/var TABLE_VERSION = 'r13-eu'/" \
      -e "s/var SKETCH_VERSION = 'r12'/var SKETCH_VERSION = 'r12-eu'/" \
      -e "s/var IMG_VERSION = 'r12'/var IMG_VERSION = 'r12-eu'/" \
      ../frontend/apt.js \
 && grep -E "var (TABLE|SKETCH|IMG)_VERSION" ../frontend/apt.js

# Живое аудио апстрим отдаёт только при «прямом локальном» обращении: микрофон
# слышит разговоры рядом, поэтому наружу поток не выпускается. Проверка — это
# приватные диапазоны IP плюс Host вида *.local. Станция ездит в фургоне, и
# снаружи мы ходим к ней через Tailscale (100.64.0.0/10, имена *.ts.net), что
# под условие не подпадало — поток отдавал 404. Tailnet приватный не меньше
# домашней сети, поэтому добавляем его в то же условие.
RUN cd /home/birdnet/BirdNET-Pi/scripts \
 && sed -i 's|^\( *\)remote_ip private_ranges$|\1remote_ip private_ranges 100.64.0.0/10|' \
      update_caddyfile.sh \
 && sed -i 's|localhost\|\[a-z0-9\]\[a-z0-9.-\]\*\[.\]local|localhost\|[a-z0-9][a-z0-9.-]*[.]local\|[a-z0-9][a-z0-9.-]*[.]ts[.]net|g' \
      update_caddyfile.sh \
 && grep -c 'private_ranges 100[.]64' update_caddyfile.sh \
 && grep -c 'ts[.]net' update_caddyfile.sh \
 && /usr/local/sbin/avian-caddy-refresh || true

# Вкладка «live» в нижнем переключателе интерфейса и страница живого сигнала.
# Скрипт вкладки — отдельным файлом, а не правкой apt.js: там 540 КБ чужого
# кода, который меняется с каждым обновлением апстрима.
COPY live.html live-tab.js /home/birdnet/BirdNET-Pi/avian/frontend/
RUN set -eux; \
    chown birdnet:birdnet /home/birdnet/BirdNET-Pi/avian/frontend/live.html \
                          /home/birdnet/BirdNET-Pi/avian/frontend/live-tab.js; \
    grep -q 'live-tab.js' /home/birdnet/BirdNET-Pi/avian/frontend/index.html \
      || sed -i 's|</body>|<script src="/live-tab.js" defer></script>\n</body>|' \
           /home/birdnet/BirdNET-Pi/avian/frontend/index.html; \
    grep -c 'live-tab.js' /home/birdnet/BirdNET-Pi/avian/frontend/index.html

# Корень сайта (BirdSongs/Extracted) — это том с данными, и файлы из образа в
# уже существующем томе сами не появятся. Апстрим решает это симлинками
# (index.html в корне указывает в avian/frontend), но расставляет их только при
# установке. Свои — пересоздаём при каждом старте: юнит дешёвый, а страница
# всегда соответствует образу, даже если том старше него.
RUN printf '%s\n' \
      '[Unit]' \
      'Description=Avian Visitors: link the live page into the web root' \
      'After=local-fs.target' \
      '' \
      '[Service]' \
      'Type=oneshot' \
      'RemainAfterExit=yes' \
      'ExecStart=/bin/sh -c "ln -sfn /home/birdnet/BirdNET-Pi/avian/frontend/live.html /home/birdnet/BirdSongs/Extracted/live.html && ln -sfn /home/birdnet/BirdNET-Pi/avian/frontend/live-tab.js /home/birdnet/BirdSongs/Extracted/live-tab.js"' \
      '' \
      '[Install]' \
      'WantedBy=multi-user.target' \
      > /etc/systemd/system/avian-live-link.service \
 && systemctl enable avian-live-link.service

# Раздел About и ссылка «Wikipedia» жёстко указывают на en.wikipedia.org —
# настройки языка для них нет, хотя названия видов уже переведены через
# DATABASE_LANG. Статьи ищутся по научному названию с включёнными редиректами,
# а в русской Википедии латинские названия ведут на русские статьи
# (Passer domesticus → Домовый воробей), так что подмена домена работает.
RUN sed -i 's|https://en\.wikipedia\.org|https://ru.wikipedia.org|g' \
      /home/birdnet/BirdNET-Pi/avian/api/wiki.php \
      /home/birdnet/BirdNET-Pi/avian/api/cutout.php \
      /home/birdnet/BirdNET-Pi/avian/frontend/apt.js \
 && grep -c 'ru.wikipedia.org' /home/birdnet/BirdNET-Pi/avian/api/wiki.php

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
