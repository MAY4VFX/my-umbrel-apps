# Образ avian-visitors

Форк [mithro/birdnet-pi-docker](https://github.com/mithro/birdnet-pi-docker) под
[AvianVisitors](https://github.com/Twarner491/AvianVisitors) (ветка `avian-visitors`).

Внутри работает systemd, поэтому контейнеру нужны `privileged: true`,
`cgroup: host` и `/sys/fs/cgroup:rw`.

Собирается в GitHub Actions на arm64-раннере и публикуется в
`ghcr.io/may4vfx/avian-visitors`. Сборка занимает около часа: инсталлятор
ставит apt-пакеты, создаёт venv и тянет колесо tflite_runtime.
