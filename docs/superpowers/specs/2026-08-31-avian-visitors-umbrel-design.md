# AvianVisitors как приложение Umbrel — дизайн

Дата: 2026-08-31. Статус: согласован, готов к плану реализации.

## Задача

Развернуть [AvianVisitors](https://github.com/Twarner491/AvianVisitors) (форк BirdNET-Pi:
распознавание птиц по звуку + коллаж-фронт) на Raspberry Pi `umbrel` как штатное
приложение umbrelOS, устанавливаемое из собственного community app store.

## Замеры целевого хоста (2026-08-31, сняты по SSH)

| Параметр | Значение |
|---|---|
| Железо | Raspberry Pi 4 Model B Rev 1.5, 8 ГБ RAM, 4 ядра |
| Текущая нагрузка | 2.1 ГБ RAM занято, load average 1.28, swap 9.7 ГБ |
| ОС | Debian 13 trixie, aarch64 |
| umbrelOS | 0.5.4 (community-сторы поддерживает: `~/umbrel/scripts/repo add`) |
| Docker | 28.5.0, Compose v5.1.3 |
| Диски | `/` 107 ГБ (93 свободно), `/mnt/data` 3.6 ТБ SSD (3.0 ТБ свободно) |
| Занятые порты | 22, 80, 139, 445, 2000, 3702, 5005, 5252, 5355, 8240 |
| Микрофон | KTMicro «KT USB Audio» (USB 12d1:0010), карта 2, capture моно 16 бит 44.1/48 кГц |
| Сеть | LAN `umbrel.local` = 192.168.1.87; Tailscale-ключ истёк 27.08.2026 |

Вывод: мощности и места достаточно с запасом. BirdNET занимает порядка одного ядра
и ~1 ГБ RAM при 5.5 ГБ свободных.

## Ключевые решения

1. **Контейнер с systemd внутри** (подход A). Апстрим ставится инсталлятором, который
   поднимает ~15 systemd-юнитов (`birdnet_analysis`, `birdnet_recording`, `birdnet_stats`,
   `caddy`, `php-fpm`, `icecast2`, `livestream`, `spectrogram_viewer`, `web_terminal` и др.).
   Переписывать их на s6/supervisord — неделя работы и ручной мёрж на каждом обновлении
   апстрима, который активно развивается. Берём за основу `mithro/birdnet-pi-docker`
   (Debian trixie + systemd PID 1, arm64), меняя источник клона на нашу ветку.
2. **`cgroup: host` в compose вместо правки `/etc/docker/daemon.json`.** Compose v5.1.3
   поддерживает ключ `cgroup`, поэтому глобальный `default-cgroupns-mode` менять не нужно
   и перезапуск демона не потребуется — vanlog и остальные сервисы Pi не затрагиваются.
3. **Аудио-архив на SSD.** `/mnt/data/avian/...`, не на SD-карту: непрерывная запись
   аудио убивает карту.
4. **Микрофон по имени карты**, `plughw:CARD=Audio,DEV=0` — индекс карты (сейчас 2)
   может съехать после перезагрузки или перетыкания USB.
5. **Стор пересоздаётся с нуля.** См. ниже.

## Состояние стора и его реабилитация

Сейчас: umbrelOS держит `MAY4VFX/my-umbrel-apps` как community app store с id
`may4vfx-custom-apps`, из него установлен `may4vfx-custom-apps-claude-ssh`. Состояние
сломано: клон на Pi сидит на осиротевшем коммите `89f7566`, а ветка `main` содержит
Portainer-версию без манифестов (стор-формат снесён коммитом `8b7b258`). Репо приватный,
поэтому Umbrel его больше не обновляет.

Решение (согласовано с владельцем):

- claude-ssh **удаляется полностью** — приложение больше не нужно.
- Репо `MAY4VFX/my-umbrel-apps` **удаляется и создаётся заново публичным под тем же
  именем**. URL стора при этом сохраняется. Причина: в истории лежит пароль claude-ssh
  открытым текстом, а после обычного переписывания истории старые коммиты остаются
  доступны на GitHub по SHA.
- **id стора `may4vfx-custom-apps` сохраняется** — он служит префиксом id приложений.
- Перед удалением снимается локальный бэкап (`git bundle`) в `~/Github/_archive/`.
- Токен `gh` не имеет scope `delete_repo`, поэтому удаление выполняет владелец: либо
  `gh auth refresh -h github.com -s delete_repo`, либо вручную через веб-интерфейс.
- Пароль от claude-ssh считается скомпрометированным: если он используется где-то ещё,
  его нужно сменить независимо от зачистки.

## Структура нового репозитория

```
umbrel-app-store.yml                          # id: may4vfx-custom-apps
may4vfx-custom-apps-avian-visitors/
├── umbrel-app.yml                            # листинг для UI umbrelOS, port: 8080
└── docker-compose.yml                        # app_proxy + сервис app
images/avian-visitors/Dockerfile              # форк mithro под ветку avian-visitors
.github/workflows/build.yml                   # сборка arm64 → ghcr.io/may4vfx/avian-visitors
docs/superpowers/specs/                       # этот документ
```

## Образ

База — Dockerfile из `mithro/birdnet-pi-docker`: Debian trixie, systemd PID 1, юзер
`birdnet` с passwordless sudo, стаб `timedatectl`, вычистка лишних юнитов. Изменения:

- клон `Twarner491/AvianVisitors -b avian-visitors --depth=1` вместо апстрима Nachtzuster;
- запуск `scripts/install_birdnet.sh` без финального `sudo reboot`;
- наложение avian-оверлея (симлинки фронта в Caddy-root, как в `scripts/bootstrap_v1.sh`);
- внутренний апдейтер BirdNET-Pi («Tools → Pull latest») не используется: обновление идёт
  через новый тег образа и бамп версии в сторе.

Сборка — GitHub Actions на нативном arm64-раннере, теги `:YYYY-MM-DD` и `:latest`.
Пакет GHCR публичный, чтобы Pi тянул без авторизации. Для отладки образ собирается
локально на Apple Silicon (нативный arm64, без QEMU).

## docker-compose приложения

```yaml
services:
  app_proxy:
    environment:
      APP_HOST: may4vfx-custom-apps-avian-visitors_app_1
      APP_PORT: 80
  app:
    image: ghcr.io/may4vfx/avian-visitors:2026-08-31   # дата-тег, бампается вместе с version в umbrel-app.yml
    restart: unless-stopped
    privileged: true
    cgroup: host
    devices:
      - /dev/snd:/dev/snd
    volumes:
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

## Мобильная станция (van)

Pi ездит вместе с фургоном, поэтому в v1:

- координаты в `birdnet.conf` задаются вручную и обновляются при переезде;
- региональный фильтр видов остаётся включённым (`SF_THRESH=0.03`): он отсекает виды,
  редкие для текущих координат и недели года, и работает локально по модели, без
  внешних ключей. Именно он и есть «фильтрация по региону» — eBird для этого не нужен;
- `INFO_SITE="EBIRD"` — справки о видах берутся из eBird, он лучше покрывает Евразию;
- `BIRDWEATHER_ENABLED=1` — детекции публикуются в сеть BirdWeather; токен станции
  вводится владельцем в интерфейсе и живёт только на Pi;
- иллюстрации — родной бандл (333 вида, уже в образе); для видов без рисунка работает
  штатный фото-фоллбэк из Wikipedia (`IMAGE_PROVIDER=WIKIPEDIA`).

## Вне scope v1

- Автоподвязка координат к GPS из vanlog (тот же Pi).
- Ре-ген иллюстраций под европейские виды через Gemini API (там же используется
  `EBIRD_API_KEY` — только для отбора списка видов). Требует оплаченного биллинга
  Gemini, гнать на Pi нельзя (OOM) — только на маке или mayfx02, отдельным этапом.
- Миграция контейнера на s6/supervisord без systemd.
- Форвардинг наружу (Cloudflare Tunnel / Home Assistant / MQTT) — в апстриме есть
  рецепты, подключается позже.
- Ремонт Tailscale на Pi (`sudo tailscale up` + снятие key expiry) — отдельная задача,
  на развёртывание не влияет, так как Pi доступен по LAN.

## Критерии приёмки

1. Стор `may4vfx-custom-apps` подключён к umbrelOS и обновляется без ошибок.
2. Приложение видно в App Store внутри umbrelOS и ставится штатной кнопкой.
3. После установки веб-коллаж открывается на порту 8080 через app_proxy.
4. Спектрограмма показывает живой сигнал с USB-микрофона (проверка, что capture работает).
5. Появилась хотя бы одна детекция птицы, запись легла в `/mnt/data/avian/By_Date`.
6. На SD-карту (`/`) аудио не пишется.
7. vanlog и прочие сервисы Pi продолжают работать; свободной RAM остаётся более 2 ГБ.

## Риски

| Риск | Митигация |
|---|---|
| Инсталлятор апстрима не отрабатывает в контейнере | Каркас mithro уже решает это (стаб `timedatectl`, чистка юнитов); собираем и отлаживаем локально на маке до Pi |
| Индекс звуковой карты съезжает | Адресация по `CARD=Audio` |
| umbrelOS 0.5.4 старая, формат манифеста мог разойтись | Опираемся на рабочий пример claude-ssh из истории (manifestVersion 1.1) |
| Удаление репо необратимо | `git bundle` бэкап до удаления |
| Установка/удаление приложений требует sudo | Выполняется владельцем через веб-интерфейс umbrelOS |
