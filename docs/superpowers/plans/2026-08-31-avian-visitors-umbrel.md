# AvianVisitors для Umbrel — план реализации

> **Для агентов-исполнителей:** ОБЯЗАТЕЛЬНЫЙ СУБ-СКИЛЛ: используйте
> superpowers:subagent-driven-development (рекомендуется) или superpowers:executing-plans
> для выполнения плана задача за задачей. Шаги отмечаются чекбоксами (`- [ ]`).

**Цель:** установить AvianVisitors на Raspberry Pi `umbrel` как штатное приложение
umbrelOS, ставящееся из собственного community app store.

**Архитектура:** контейнер с systemd внутри (форк `mithro/birdnet-pi-docker` с клоном
ветки `avian-visitors`), образ собирается GitHub Actions под arm64 и публикуется в GHCR,
приложение описывается манифестом Umbrel и раздаётся через штатный app_proxy.

**Стек:** Docker + Compose, Debian trixie, systemd, Caddy + PHP-FPM, tflite_runtime,
GitHub Actions, umbrelOS 0.5.4.

**Спека:** `docs/superpowers/specs/2026-08-31-avian-visitors-umbrel-design.md`

## Глобальные ограничения

- id стора — ровно `may4vfx-custom-apps`, менять нельзя (префикс id приложений).
- id приложения — `may4vfx-custom-apps-avian-visitors`, имя папки обязано совпадать с id.
- `manifestVersion: 1.1` (umbrelOS 0.5.4).
- Порт приложения — 8080 (проверено свободным на хосте).
- Образ — `ghcr.io/may4vfx/avian-visitors`, теги `YYYY-MM-DD` и `latest`, пакет публичный.
- `REC_CARD` — только `usb_mic` (dsnoop). Прямые `hw:`/`plughw:` дают «Device or resource
  busy», потому что микрофон одновременно читают запись и Icecast-стрим.
- Микрофон адресуется по имени карты: `hw:CARD=Audio,DEV=0`, не по индексу.
- Аудио-данные — только в `/mnt/data/avian/...`, на SD-карту писать нельзя.
- Репозиторий публичный: никаких паролей, ключей и токенов в файлах.
- На Pi у агента нет sudo-пароля. Всё, что требует sudo или веб-интерфейса umbrelOS,
  выполняет владелец — такие шаги помечены **[владелец]**.
- Хост: `umbrel@192.168.1.87` (`umbrel.local`), доступен по LAN; Tailscale не работает.

---

### Task 1: Пересоздать репозиторий стора с чистой историей

Репозиторий на GitHub уже удалён владельцем. Локальная копия со старой историей
забэкаплена в `~/Github/_archive/my-umbrel-apps-pre-reset-2026-08-31.bundle`.

**Файлы:**
- Создать: `umbrel-app-store.yml`
- Создать: `README.md`
- Создать: `.gitignore`
- Удалить: `docker-compose.yml`, `claude-ssh/Dockerfile` (Portainer-легаси и claude-ssh)
- Сохранить: `docs/superpowers/specs/`, `docs/superpowers/plans/`

**Интерфейсы:**
- Производит: публичный репозиторий `https://github.com/MAY4VFX/my-umbrel-apps.git`
  с id стора `may4vfx-custom-apps` — из него Umbrel тянет приложения в Task 5.

- [ ] **Шаг 1: Убедиться, что бэкап старой истории на месте**

```bash
git bundle verify ~/Github/_archive/my-umbrel-apps-pre-reset-2026-08-31.bundle
```

Ожидается: `The bundle records a complete history` и список ссылок. Если бандл битый —
остановиться и сообщить владельцу, дальше идти нельзя.

- [ ] **Шаг 2: Снести старую историю и легаси-файлы**

```bash
cd ~/Github/my-umbrel-apps
rm -rf .git docker-compose.yml claude-ssh
git init -b main
```

- [ ] **Шаг 3: Написать манифест стора**

`umbrel-app-store.yml`:

```yaml
id: "may4vfx-custom-apps"
name: "MAY4VFX Custom Apps"
```

- [ ] **Шаг 4: Написать README и .gitignore**

`README.md`:

```markdown
# MAY4VFX Custom Apps

Community app store для umbrelOS.

Подключение: в umbrelOS → App Store → Community App Stores → добавить
`https://github.com/MAY4VFX/my-umbrel-apps`

## Приложения

- **Avian Visitors** — распознавание птиц по звуку с USB-микрофона (форк BirdNET-Pi)
  с коллаж-интерфейсом. Образ: `ghcr.io/may4vfx/avian-visitors`.
```

`.gitignore`:

```
.DS_Store
```

- [ ] **Шаг 5: Первый коммит**

```bash
cd ~/Github/my-umbrel-apps
git add -A
git commit -m "feat: пересоздать стор с чистой историей

Старый репозиторий удалён вместе с историей: в ней лежал пароль claude-ssh
открытым текстом, а стор-формат был снесён Portainer-рефакторингом.
id стора сохранён, чтобы не ломать префиксы id приложений.
Бэкап старой истории: ~/Github/_archive/my-umbrel-apps-pre-reset-2026-08-31.bundle"
```

- [ ] **Шаг 6: Создать публичный репозиторий и запушить**

```bash
cd ~/Github/my-umbrel-apps
gh repo create MAY4VFX/my-umbrel-apps --public --source=. --remote=origin \
  --description "Community app store для umbrelOS: Avian Visitors и другие приложения" \
  --push
```

- [ ] **Шаг 7: Проверить, что репозиторий публичный и клонируется анонимно**

```bash
gh api repos/MAY4VFX/my-umbrel-apps --jq '{private, default_branch}'
git -c credential.helper= -c http.extraheader= clone --depth=1 \
  https://github.com/MAY4VFX/my-umbrel-apps.git /tmp/store-check && \
  cat /tmp/store-check/umbrel-app-store.yml && rm -rf /tmp/store-check
```

Ожидается: `"private": false`, `"default_branch": "main"`, содержимое манифеста стора.
Если клон просит логин — репозиторий приватный, Umbrel его не потянет; исправить
видимость и повторить.

- [ ] **Шаг 8: Проверить, что история ровно одна и в ней нет секретов**

```bash
cd ~/Github/my-umbrel-apps
test "$(git log --oneline | wc -l | tr -d ' ')" = "1" && echo "история чистая"
git log --all -p | grep -icE 'password|PRIVATE KEY|ghp_|github_pat_' || echo "секретов нет"
```

Ожидается: `история чистая` и `секретов нет`.

---

### Task 2: Dockerfile образа и локальная сборка на маке

**Файлы:**
- Создать: `images/avian-visitors/Dockerfile`
- Создать: `images/avian-visitors/README.md`

**Интерфейсы:**
- Потребляет: репозиторий из Task 1.
- Производит: локальный образ `avian-visitors:dev`, из которого Task 4 извлекает
  дефолтный `birdnet.conf`. Внутри образа: веб на порту 80 (Caddy), Icecast на 8081,
  рабочая копия в `/home/birdnet/BirdNET-Pi`, юзер `birdnet`.

- [ ] **Шаг 1: Написать Dockerfile**

`images/avian-visitors/Dockerfile`:

```dockerfile
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

USER birdnet
ENV USER=birdnet
ENV HOME=/home/birdnet
WORKDIR /home/birdnet

# Папка обязана называться BirdNET-Pi: на этот путь завязаны скрипты форка.
RUN git clone --depth=1 -b avian-visitors \
    https://github.com/Twarner491/AvianVisitors.git BirdNET-Pi

WORKDIR /home/birdnet/BirdNET-Pi
RUN bash scripts/install_birdnet.sh

USER root
RUN rm -f /usr/local/bin/timedatectl \
    && apt-get update && apt-get install -y --no-install-recommends php-mbstring \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

EXPOSE 80 8081

STOPSIGNAL SIGRTMIN+3
VOLUME ["/sys/fs/cgroup"]
CMD ["/sbin/init"]
```

- [ ] **Шаг 2: Написать README образа**

`images/avian-visitors/README.md`:

```markdown
# Образ avian-visitors

Форк [mithro/birdnet-pi-docker](https://github.com/mithro/birdnet-pi-docker) под
[AvianVisitors](https://github.com/Twarner491/AvianVisitors) (ветка `avian-visitors`).

Внутри работает systemd, поэтому контейнеру нужны `privileged: true`,
`cgroup: host` и `/sys/fs/cgroup:rw`.

Собирается в GitHub Actions на arm64-раннере и публикуется в
`ghcr.io/may4vfx/avian-visitors`. Сборка занимает около часа: инсталлятор
ставит apt-пакеты, создаёт venv и тянет колесо tflite_runtime.
```

- [ ] **Шаг 3: Коммит**

Образ собирается только в CI (Task 3) — локально ничего не собираем.

```bash
cd ~/Github/my-umbrel-apps
git add images/avian-visitors
git commit -m "feat(image): Dockerfile образа AvianVisitors для arm64"
git push
```

---

### Task 3: Сборка образа в GitHub Actions и публикация в GHCR

**Файлы:**
- Создать: `.github/workflows/build.yml`

**Интерфейсы:**
- Потребляет: `images/avian-visitors/Dockerfile` из Task 2.
- Производит: публичный образ `ghcr.io/may4vfx/avian-visitors:<YYYY-MM-DD>` и `:latest`,
  который Task 4 прописывает в compose, а Pi тянет анонимно в Task 5.

- [ ] **Шаг 1: Написать workflow**

`.github/workflows/build.yml`:

```yaml
name: build image

on:
  push:
    branches: [main]
    paths:
      - 'images/avian-visitors/**'
      - '.github/workflows/build.yml'
  schedule:
    - cron: '0 4 * * 1'   # еженедельно, чтобы подхватывать апстрим
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-24.04-arm
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Установить дату сборки
        id: date
        run: echo "date=$(date +%F)" >> "$GITHUB_OUTPUT"

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/build-push-action@v6
        with:
          context: images/avian-visitors
          platforms: linux/arm64
          push: true
          tags: |
            ghcr.io/may4vfx/avian-visitors:${{ steps.date.outputs.date }}
            ghcr.io/may4vfx/avian-visitors:latest

      - name: Smoke-тест собранного образа
        run: |
          IMAGE=ghcr.io/may4vfx/avian-visitors:${{ steps.date.outputs.date }}
          docker run -d --name smoke --privileged --cgroupns=host \
            -v /sys/fs/cgroup:/sys/fs/cgroup:rw --tmpfs /run --tmpfs /run/lock \
            -p 18080:80 "$IMAGE"
          code=000
          for i in $(seq 1 30); do
            code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:18080/ || true)
            [ "$code" = "200" ] && break
            sleep 10
          done
          echo "HTTP: $code"
          docker exec smoke systemctl is-active caddy
          docker logs --tail 30 smoke
          test "$code" = "200"
```

Smoke гоняется после публикации, поэтому упавший тест означает: тег есть, но образ
негодный — чинить и пересобирать, на Pi такой не ставить. Микрофона на раннере нет,
так что проверяется только веб-стек, а не распознавание.

- [ ] **Шаг 2: Закоммитить и запустить сборку**

```bash
cd ~/Github/my-umbrel-apps
git add .github/workflows/build.yml
git commit -m "ci: сборка arm64-образа и публикация в GHCR"
git push
gh workflow run "build image"
```

- [ ] **Шаг 3: Дождаться сборки**

```bash
gh run watch "$(gh run list --workflow='build image' --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
```

Ожидается: успешное завершение. Прогон длится около часа — это нормально, инсталлятор
внутри образа ставит apt-пакеты и собирает venv.

- [ ] **Шаг 4: [владелец] Сделать пакет GHCR публичным**

Первый пакет из Actions создаётся приватным, и Pi не сможет его скачать. Владелец
открывает github.com/users/MAY4VFX/packages/container/avian-visitors/settings →
Change visibility → Public.

- [ ] **Шаг 5: Проверить анонимное скачивание манифеста**

```bash
TOKEN=$(curl -s "https://ghcr.io/token?scope=repository:may4vfx/avian-visitors:pull" | jq -r .token)
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.v2+json" \
  https://ghcr.io/v2/may4vfx/avian-visitors/manifests/latest
```

Ожидается: `200`. Если `401` — пакет всё ещё приватный, вернуться к шагу 4.

---

### Task 4: Манифест Umbrel-приложения

**Файлы:**
- Создать: `may4vfx-custom-apps-avian-visitors/umbrel-app.yml`
- Создать: `may4vfx-custom-apps-avian-visitors/docker-compose.yml`
- Создать: `may4vfx-custom-apps-avian-visitors/asoundrc`
- Создать: `may4vfx-custom-apps-avian-visitors/birdnet.conf`

Папка приложения целиком копируется umbrelOS в `~/umbrel/app-data/<id>/` при установке —
именно так `asoundrc` и `birdnet.conf` попадают в `${APP_DATA_DIR}`.

**Интерфейсы:**
- Потребляет: образ из Task 3.
- Производит: приложение `may4vfx-custom-apps-avian-visitors`, которое Task 5 ставит на Pi.
  Имя контейнера, на которое смотрит app_proxy: `may4vfx-custom-apps-avian-visitors_app_1`.

- [ ] **Шаг 1: Написать листинг приложения**

`may4vfx-custom-apps-avian-visitors/umbrel-app.yml`:

```yaml
manifestVersion: 1.1
id: "may4vfx-custom-apps-avian-visitors"
name: "Avian Visitors"
category: "Home"
version: "1.0.0"
tagline: "Живой коллаж птиц, которые прилетают к твоему окну"
description: >-
  Слушает USB-микрофон и распознаёт птиц по голосу нейросетью BirdNET,
  показывая их живым коллажом из рисованных иллюстраций.


  Форк BirdNET-Pi с интерфейсом AvianVisitors. Записи детекций пишутся
  на внешний SSD, анализ идёт локально и не требует интернета.
developer: "MAY4VFX"
website: "https://github.com/MAY4VFX/my-umbrel-apps"
repo: "https://github.com/Twarner491/AvianVisitors"
support: "https://github.com/Twarner491/AvianVisitors/issues"
port: 8080
gallery: []
path: ""
defaultUsername: ""
defaultPassword: ""
releaseNotes: "Первая сборка для umbrelOS: контейнер arm64 с systemd, микрофон через dsnoop."
submission: ""
```

- [ ] **Шаг 2: Написать compose**

`may4vfx-custom-apps-avian-visitors/docker-compose.yml`:

```yaml
version: "3.7"

services:
  app_proxy:
    environment:
      APP_HOST: may4vfx-custom-apps-avian-visitors_app_1
      APP_PORT: 80

  app:
    image: ghcr.io/may4vfx/avian-visitors:latest
    restart: unless-stopped
    # Внутри контейнера работает systemd — отсюда privileged и cgroup: host.
    privileged: true
    cgroup: host
    stop_signal: SIGRTMIN+3
    devices:
      - /dev/snd:/dev/snd
    volumes:
      # Аудио — только на внешний SSD: непрерывная запись убивает SD-карту.
      - /mnt/data/avian/StreamData:/home/birdnet/BirdSongs/StreamData
      - /mnt/data/avian/By_Date:/home/birdnet/BirdSongs/Extracted/By_Date
      - ${APP_DATA_DIR}/birdnet.conf:/home/birdnet/BirdNET-Pi/birdnet.conf
      - ${APP_DATA_DIR}/asoundrc:/home/birdnet/.asoundrc:ro
      - /sys/fs/cgroup:/sys/fs/cgroup:rw
      - /etc/localtime:/etc/localtime:ro
    tmpfs:
      - /run
      - /run/lock
```

- [ ] **Шаг 3: Написать конфигурацию микрофона**

`may4vfx-custom-apps-avian-visitors/asoundrc`:

```
# Микрофон читают одновременно запись и Icecast-стрим, а hw: пускает
# только одного читателя — поэтому доступ шарится через dsnoop.
# Карта адресуется по имени (KT USB Audio), а не по индексу: индекс
# съезжает после перезагрузки или перетыкания USB.
pcm.usb_mic_raw {
    type dsnoop
    ipc_key 1234
    slave {
        pcm "hw:CARD=Audio,DEV=0"
    }
}

pcm.usb_mic {
    type plug
    slave.pcm "usb_mic_raw"
}
```

- [ ] **Шаг 4: Извлечь дефолтный birdnet.conf из образа**

```bash
cd ~/Github/my-umbrel-apps
docker pull ghcr.io/may4vfx/avian-visitors:latest
docker run --rm --entrypoint cat ghcr.io/may4vfx/avian-visitors:latest \
  /home/birdnet/BirdNET-Pi/birdnet.conf > may4vfx-custom-apps-avian-visitors/birdnet.conf
wc -l may4vfx-custom-apps-avian-visitors/birdnet.conf
```

Ожидается: непустой файл на сотню-другую строк.

- [ ] **Шаг 5: Настроить конфиг под нашу станцию**

```bash
cd ~/Github/my-umbrel-apps/may4vfx-custom-apps-avian-visitors
# Микрофон: только dsnoop-устройство, иначе "Device or resource busy".
sed -i '' 's|^REC_CARD=.*|REC_CARD=usb_mic|' birdnet.conf
sed -i '' 's|^SITE_NAME=.*|SITE_NAME="Avian Visitors"|' birdnet.conf
# Справки о видах: eBird вместо AllAboutBirds — он лучше покрывает Евразию.
sed -i '' 's|^INFO_SITE=.*|INFO_SITE="EBIRD"|' birdnet.conf
# Публикация детекций в сеть BirdWeather. Сам токен станции сюда не пишем:
# репозиторий публичный, токен владелец вводит в интерфейсе приложения.
sed -i '' 's|^BIRDWEATHER_ENABLED=.*|BIRDWEATHER_ENABLED=1|' birdnet.conf
grep -E '^(REC_CARD|SITE_NAME|INFO_SITE|BIRDWEATHER_|SF_THRESH|LATITUDE|LONGITUDE)=' birdnet.conf
```

Ожидается: `REC_CARD=usb_mic`, `INFO_SITE="EBIRD"`, `BIRDWEATHER_ENABLED=1`,
`BIRDWEATHER_ID=` пустой, `SF_THRESH=0.03` без изменений.

`SF_THRESH` — это и есть региональный фильтр: отсекает виды, которые в текущих
координатах и на этой неделе года встречаются реже 3%. Работает локально по модели,
никаких ключей не требует. Дефолт оставляем: он и даёт фильтрацию «по региону»,
о которой шла речь. Ослабить (например до `0.01`) имеет смысл, только если окажется,
что станция режет реально прилетающих птиц.

- [ ] **Шаг 6: Убедиться, что в конфиге нет секретов**

Репозиторий публичный, а `birdnet.conf` штатно содержит поля под пароль веб-интерфейса,
токен BirdWeather и настройки уведомлений. В шаблоне они обязаны остаться пустыми:
рабочие значения владелец задаёт через интерфейс приложения, и живут они только на Pi
в `${APP_DATA_DIR}`, в репозиторий не возвращаются.

```bash
cd ~/Github/my-umbrel-apps/may4vfx-custom-apps-avian-visitors
grep -nEi '^[A-Z_]*(PWD|PASS|TOKEN|KEY|SECRET)=.+' birdnet.conf | grep -v '^.*ICE_PWD='
grep -nE '^(BIRDWEATHER_ID|FLICKR_API_KEY|CADDY_PWD)=.+' birdnet.conf \
  || echo "непустых секретов нет"
```

Ожидается: `непустых секретов нет`. `ICE_PWD=birdnetpi` — исключение: это дефолтный
пароль, которым ffmpeg авторизуется в Icecast на localhost, он не секрет и обнулять
его нельзя, иначе развалится живой аудиопоток. Всё остальное непустое — обнулить
(`sed -i '' 's|^ИМЯ=.*|ИМЯ=|' birdnet.conf`) и проверить снова.

- [ ] **Шаг 7: Проверить манифесты на валидность и согласованность**

```bash
cd ~/Github/my-umbrel-apps
python3 - << 'EOF'
import yaml, pathlib
d = pathlib.Path("may4vfx-custom-apps-avian-visitors")
app = yaml.safe_load((d / "umbrel-app.yml").read_text())
comp = yaml.safe_load((d / "docker-compose.yml").read_text())
store = yaml.safe_load(pathlib.Path("umbrel-app-store.yml").read_text())
assert app["id"] == d.name, f'id {app["id"]} != имя папки {d.name}'
assert app["id"].startswith(store["id"] + "-"), "id приложения должен начинаться с id стора"
assert comp["services"]["app_proxy"]["environment"]["APP_HOST"] == f'{app["id"]}_app_1'
assert comp["services"]["app_proxy"]["environment"]["APP_PORT"] == 80
assert app["port"] == 8080
assert not app["defaultPassword"], "в публичном репозитории паролей быть не должно"
print("манифесты согласованы")
EOF
```

Ожидается: `манифесты согласованы`. Любой assert — чинить и повторять.

- [ ] **Шаг 8: Коммит**

```bash
cd ~/Github/my-umbrel-apps
git add may4vfx-custom-apps-avian-visitors
git commit -m "feat(app): приложение Avian Visitors для umbrelOS"
git push
```

---

### Task 5: Развёртывание и приёмка на Raspberry Pi

**Файлы:** изменений в репозитории нет — работа идёт на хосте `umbrel@192.168.1.87`.

**Интерфейсы:**
- Потребляет: стор из Task 1, образ из Task 3, приложение из Task 4.
- Производит: работающую станцию, доступную на `http://umbrel.local:8080`.

- [ ] **Шаг 1: [владелец] Удалить старое приложение claude-ssh**

В веб-интерфейсе umbrelOS удалить приложение «Claude SSH Server». Оно больше не нужно,
а его манифест исчез из стора — оставлять его сломанным незачем.

- [ ] **Шаг 2: Подготовить каталоги данных на SSD**

```bash
ssh umbrel@192.168.1.87 'mkdir -p /mnt/data/avian/StreamData /mnt/data/avian/By_Date && ls -ld /mnt/data/avian/*'
```

Ожидается: обе папки созданы и доступны на запись.

- [ ] **Шаг 3: Обновить клон стора на Pi**

Клон сейчас сидит на осиротевшем коммите, а история в репозитории новая, поэтому обычный
`pull` не сойдётся — забираем принудительно.

```bash
ssh umbrel@192.168.1.87 '
R=~/umbrel/repos/https---github-com-getumbrel-umbrel-apps-git
cd $R
# origin тут указывает на официальный стор getumbrel — его не трогаем,
# наш репозиторий подключён вторым remote с хешем вместо имени.
REMOTE=$(git remote | grep -v "^origin$" | head -1)
git fetch --prune "$REMOTE" 2>&1 | tail -3
git reset --hard "$REMOTE/main" && git log --oneline -1 && ls'
```

Ожидается: HEAD на новом коммите, в листинге `umbrel-app-store.yml` и папка
`may4vfx-custom-apps-avian-visitors`. Если fetch просит авторизацию — репозиторий
не публичный, вернуться к Task 1 шаг 7.

- [ ] **Шаг 4: [владелец] Установить приложение**

В веб-интерфейсе umbrelOS: App Store → MAY4VFX Custom Apps → Avian Visitors → Install.
Первая установка тянет около 4 ГБ образа, это занимает время.

- [ ] **Шаг 5: Проверить, что контейнер поднялся**

```bash
ssh umbrel@192.168.1.87 '
docker ps --filter name=avian-visitors --format "{{.Names}} {{.Status}}" 2>/dev/null || \
  echo "нет прав на docker — попросить владельца выполнить: sudo docker ps | grep avian"'
curl -s -o /dev/null -w "%{http_code}\n" http://192.168.1.87:8080/
```

Ожидается: контейнер `Up`, HTTP-код `200`.

- [ ] **Шаг 6: Проверить, что микрофон реально пишет**

```bash
ssh umbrel@192.168.1.87 '
C=may4vfx-custom-apps-avian-visitors_app_1
docker exec $C arecord -l 2>&1 | head -5
docker exec $C systemctl is-active birdnet_recording birdnet_analysis 2>&1
docker exec $C sh -c "ls -la /home/birdnet/BirdSongs/StreamData | head -5"'
```

Ожидается: `arecord -l` показывает карту `Audio`, оба юнита `active`, в StreamData
появляются свежие файлы. Если видно «Device or resource busy» — проверить, что
`REC_CARD=usb_mic`, а не `hw:`/`plughw:`. Команды под `docker exec` может потребоваться
запускать через владельца с `sudo`.

- [ ] **Шаг 7: [владелец] Задать координаты станции и подключить BirdWeather**

В интерфейсе приложения: Settings → LATITUDE / LONGITUDE текущей стоянки. Координаты
здесь не косметика: по ним работает региональный фильтр видов `SF_THRESH`, так что
после переезда фургона их нужно обновлять — иначе станция фильтрует птиц по прошлой
стоянке.

Там же BirdWeather: зарегистрировать станцию на app.birdweather.com, получить токен
и вставить его в поле BIRDWEATHER_ID. Токен остаётся только на Pi, в репозиторий он
не попадает. `BIRDWEATHER_UPLOAD_AUDIO` включать по желанию — он шлёт в сеть ещё и
аудиофрагменты детекций.

- [ ] **Шаг 8: Дождаться первой детекции и проверить, куда легли данные**

```bash
ssh umbrel@192.168.1.87 '
du -sh /mnt/data/avian/* 2>/dev/null
find /mnt/data/avian/By_Date -type f -name "*.wav" 2>/dev/null | head -3
df -h / | tail -1'
```

Ожидается: файлы детекций в `/mnt/data/avian/By_Date`, а занятость `/` не растёт —
подтверждение, что на SD-карту аудио не пишется.

- [ ] **Шаг 9: Проверить, что детекции уходят в BirdWeather**

```bash
ssh umbrel@192.168.1.87 '
C=may4vfx-custom-apps-avian-visitors_app_1
docker exec $C journalctl -u birdnet_analysis --no-pager -n 50 2>&1 | grep -iE "birdweather|http" | head -10'
```

Ожидается: строки об успешной отправке в BirdWeather без ошибок авторизации. Если видно
401/403 — токен станции неверный, вернуться к шагу 7. Публикация появится только после
первой детекции, так что при пустом выводе просто подождать.

- [ ] **Шаг 10: Проверить, что соседям на Pi не поплохело**

```bash
ssh umbrel@192.168.1.87 'free -h | head -2; uptime; docker ps --format "{{.Names}} {{.Status}}" 2>/dev/null | head -20'
```

Ожидается: свободной памяти больше 2 ГБ, load average ниже 4.0, контейнеры vanlog и
прочие сервисы по-прежнему `Up`. Если памяти мало — добавить в compose `mem_limit: 2g`
для сервиса `app` и переустановить приложение.

---

### Task 6: Зафиксировать результат в штабе

Карта инфраструктуры сейчас врёт: она утверждает, что claude-ssh развёрнут через
Portainer, тогда как на деле он ставился из community-стора.

**Файлы:**
- Изменить: `~/Github/may-hub/departments/infra/map.md`
- Изменить: `~/Github/may-hub/departments/lab/map.md`

- [ ] **Шаг 1: Обновить карту инфраструктуры**

В `departments/infra/map.md` в строке про узел `umbrel` заменить «просканить: что
крутится?» на фактическое состояние: Raspberry Pi 4 8 ГБ, Debian trixie, umbrelOS 0.5.4,
Docker 28.5.0, LAN `umbrel.local` = 192.168.1.87, `/mnt/data` — WD 4TB SSD,
Tailscale-ключ истёк 27.08.2026 (лечится `sudo tailscale up`).

- [ ] **Шаг 2: Обновить карту роли lab**

В `departments/lab/map.md` добавить раздел про Avian Visitors: приложение umbrelOS из
стора `may4vfx-custom-apps` (репозиторий `MAY4VFX/my-umbrel-apps`), образ
`ghcr.io/may4vfx/avian-visitors`, данные в `/mnt/data/avian`, микрофон KT USB Audio
через dsnoop `usb_mic`. Там же исправить утверждение про Portainer.

- [ ] **Шаг 3: Коммит и push штаба**

```bash
cd ~/Github/may-hub
git add departments/infra/map.md departments/lab/map.md
git commit -m "docs(infra): umbrel-нода описана по факту; добавлен Avian Visitors"
git push
```
