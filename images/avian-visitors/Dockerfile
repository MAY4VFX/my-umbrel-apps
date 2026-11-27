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
#
# php-fpm — исключение: с октября 2026 апстрим (security_refresh.sh,
# update_caddyfile.sh) после установки пулов проверяет, что служба активна и
# её сокеты на месте, иначе сборка падает («no PHP-FPM service is active»,
# «Active PHP-FPM bundle export pool was not found»; образ не собирался с
# 12 октября). Поэтому для php*-fpm заглушка по-настоящему запускает демон
# (php-fpm -D), а is-active отвечает по живому процессу из pid-файла — и
# проверки апстрима проходят как есть, без правок его скриптов.
# В финальном слое оба бинарника возвращаются на место.
RUN mv /usr/bin/timedatectl /usr/bin/timedatectl.real \
 && printf '#!/bin/sh\necho "Etc/UTC"\n' > /usr/bin/timedatectl \
 && chmod +x /usr/bin/timedatectl \
 && mv /usr/bin/systemctl /usr/bin/systemctl.real
COPY --chmod=0755 <<'SH' /usr/bin/systemctl
#!/bin/sh
# Заглушка systemctl на время сборки образа (см. Dockerfile).
REAL=/usr/bin/systemctl.real
fpm_alive() {
  for pf in /run/php/php*-fpm.pid; do
    [ -f "$pf" ] || continue
    pid=$(cat "$pf" 2>/dev/null)
    [ -n "$pid" ] && tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null | grep -q 'php-fpm' && return 0
  done
  return 1
}
fpm_restart() {
  for pf in /run/php/php*-fpm.pid; do
    [ -f "$pf" ] || continue
    pid=$(cat "$pf" 2>/dev/null)
    # pid-файл мог остаться от прошлого слоя: убиваем, только если это php-fpm
    if [ -n "$pid" ] && tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null | grep -q 'php-fpm'; then
      kill "$pid" 2>/dev/null
      i=0; while [ -d "/proc/$pid" ] && [ $i -lt 50 ]; do sleep 0.1; i=$((i+1)); done
    fi
    rm -f "$pf"
  done
  mkdir -p /run/php
  for b in /usr/sbin/php-fpm[0-9]*; do [ -x "$b" ] && "$b" -D || true; done
}
is_fpm_cmd() {
  for u in "$@"; do case "$u" in php*-fpm*) return 0 ;; esac; done
  return 1
}
case "$1" in
  start|restart|reload|try-restart|reload-or-restart)
    is_fpm_cmd "$@" && fpm_restart
    exit 0 ;;
  daemon-reload|daemon-reexec)
    exit 0 ;;
  is-active)
    if is_fpm_cmd "$@"; then fpm_alive; exit $?; fi
    exec "$REAL" "$@" ;;
  *)
    exec "$REAL" "$@" ;;
esac
SH

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

# Коллаж нормирует площади плиток под бюджет экрана и задаёт редким птицам
# минимальную площадь. Когда видов много (за всё время их >100), сумма одних
# минимальных плиток превышает бюджет — остаток для частых птиц уходит в ноль,
# и коэффициент сжатия 0 превращает самых слышимых (Зарянка, Сорока…) в плитки
# 0×0: остаётся только подпись. Чиним: если частым не хватает хотя бы минимума
# каждой, сжимаем все плитки одинаково — пропорции сохраняются, а цикл
# «ужать до экрана» ниже всё равно подгоняет размер.
RUN python3 - <<'PY'
p = '/home/birdnet/BirdNET-Pi/avian/frontend/apt.js'
s = open(p).read()
old = """      var shrink = flexSum > 0 ? Math.min(1, flexBudget / flexSum) : 1;
      tiles.forEach(function (t) {
        if (t.area > minArea + 1e-9) t.area *= shrink;
      });"""
new = """      var flexCount = tiles.filter(function (t) { return t.area > minArea + 1e-9; }).length;
      if (flexBudget < flexCount * minArea) {
        var uniform = budget / sumA;
        tiles.forEach(function (t) { t.area *= uniform; });
      } else {
        var shrink = flexSum > 0 ? Math.min(1, flexBudget / flexSum) : 1;
        tiles.forEach(function (t) {
          if (t.area > minArea + 1e-9) t.area *= shrink;
        });
      }"""
assert s.count(old) == 1, 'патч площадей коллажа не применился'
open(p, 'w').write(s.replace(old, new))
print('коллаж: частые птицы больше не обнуляются')
PY
# Новая версия apt.js в index.html, иначе браузеры держат старый скрипт из кэша.
RUN sed -i -E 's#(apt[.]js[?]v=[A-Za-z0-9.]+)"#\1-eu1"#' /home/birdnet/BirdNET-Pi/avian/frontend/index.html \
 && grep -oE 'apt[.]js[?]v=[^"]+-eu1"' /home/birdnet/BirdNET-Pi/avian/frontend/index.html

# Живое аудио апстрим отдаёт только при «прямом локальном» обращении: микрофон
# слышит разговоры рядом, поэтому наружу поток не выпускается. Проверка — это
# приватные диапазоны IP плюс Host вида *.local. Станция ездит в фургоне, и
# снаружи мы ходим к ней через Tailscale (100.64.0.0/10, имена *.ts.net), что
# под условие не подпадало — поток отдавал 404. Tailnet приватный не меньше
# домашней сети, поэтому добавляем его в то же условие.
#
# Патчатся ОБЕ копии генератора: установщик копирует scripts/update_caddyfile.sh
# в /usr/local/sbin/avian-caddy-refresh, и перегенерацию выполняет именно копия —
# правка одного оригинала ничего не меняла. Замену делает python, а не sed:
# шаблон хоста — длинный регэксп со скобками, экранирование в sed его ломало.
RUN python3 - <<'PY' \
 && sudo install -o root -g root -m 0755 \
      /home/birdnet/BirdNET-Pi/scripts/update_caddyfile.sh \
      /usr/local/sbin/avian-caddy-refresh \
 && sudo systemctl start php-fpm.service \
 && sudo /usr/local/sbin/avian-caddy-refresh
import re
p = '/home/birdnet/BirdNET-Pi/scripts/update_caddyfile.sh'
s = open(p).read()
host = '[a-z0-9][a-z0-9.-]*[.]local'
if 'ts[.]net' not in s:
    s = s.replace(host, host + '|[a-z0-9][a-z0-9.-]*[.]ts[.]net')
s = re.sub(r'^( *)remote_ip private_ranges$',
           r'\1remote_ip private_ranges 100.64.0.0/10', s, flags=re.M)
open(p, 'w').write(s)
assert s.count('100.64.0.0/10') and s.count('ts[.]net'), 'патч tailnet не применился'
print('tailnet разрешён в', s.count('100.64.0.0/10'), 'правилах')
PY

# Вкладка «live» в нижнем переключателе интерфейса и страница живого сигнала.
# Скрипт вкладки — отдельным файлом, а не правкой apt.js: там 540 КБ чужого
# кода, который меняется с каждым обновлением апстрима.
COPY --chown=birdnet:birdnet live.html live-tab.js /home/birdnet/BirdNET-Pi/avian/frontend/
RUN set -eux; \
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
      'Description=Avian Visitors: link the live page and fix config permissions' \
      'After=local-fs.target' \
      '' \
      '[Service]' \
      'Type=oneshot' \
      'RemainAfterExit=yes' \
      'ExecStart=/bin/sh -c "ln -sfn /home/birdnet/BirdNET-Pi/avian/frontend/live.html /home/birdnet/BirdSongs/Extracted/live.html && ln -sfn /home/birdnet/BirdNET-Pi/avian/frontend/live-tab.js /home/birdnet/BirdSongs/Extracted/live-tab.js"' \
      'ExecStart=/bin/sh -c "chmod g+w /home/birdnet/BirdNET-Pi/birdnet.conf /home/birdnet/BirdNET-Pi/body.txt 2>/dev/null; chgrp birdnet /home/birdnet/BirdNET-Pi/apprise.txt 2>/dev/null && chmod 660 /home/birdnet/BirdNET-Pi/apprise.txt; true"' \
      '' \
      '[Install]' \
      'WantedBy=multi-user.target' \
      | sudo tee /etc/systemd/system/avian-live-link.service > /dev/null \
 && sudo systemctl enable avian-live-link.service

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
RUN rm -f /run/php/*.pid /run/php/*.sock \
    && mv -f /usr/bin/systemctl.real /usr/bin/systemctl \
    && mv -f /usr/bin/timedatectl.real /usr/bin/timedatectl \
    && apt-get update && apt-get install -y --no-install-recommends php-mbstring \
    && apt-get -y upgrade \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# В ноябре 2026 PHP закрыл пачку уязвимостей (в т.ч. request smuggling в
# PHP-FPM, через который здесь работает API); исправления — с 8.4.28.
# Сборка падает, если в образ попала версия старше.
RUN php -r 'exit(version_compare(PHP_VERSION, "8.4.28", ">=") ? 0 : 1);' \
    || { php -v; echo 'PHP старше 8.4.28 - нет исправлений 2026-11'; exit 1; }

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
