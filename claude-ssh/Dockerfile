# 1. Используем легковесный, мультиплатформенный образ на базе Alpine
FROM node:21-alpine

# 2. Устанавливаем зависимости
RUN apk update && apk add --no-cache \
    openssh \
    git \
    bash

# 3. Устанавливаем Claude Code CLI и Happy Coder
RUN npm install -g @anthropic-ai/claude-code happy-coder

# 4. Исправляем ошибку "/var/empty"
RUN chown root:root /var/empty && chmod 711 /var/empty

# 5. Генерируем ключи хоста для SSH-сервера
RUN ssh-keygen -A

# 6. Создаем пользователя 'dev' и устанавливаем ему пароль
RUN adduser -D -s /bin/bash dev && \
    echo "dev:Workbook^92" | chpasswd

# 7. Настраиваем SSH-доступ по ключу
RUN mkdir -p /home/dev/.ssh && \
    touch /home/dev/.ssh/authorized_keys && \
    echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOQVo9kY2nO1AhWZiYw3pE5SVzalduQzfI7Up56jOIyz umbrel-tunnel" >> /home/dev/.ssh/authorized_keys && \
    chown -R dev:dev /home/dev/.ssh && \
    chmod 700 /home/dev/.ssh && \
    chmod 600 /home/dev/.ssh/authorized_keys

# 8. Настраиваем SSH-сервер
RUN sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin no/' /etc/ssh/sshd_config && \
    sed -i '/^#*PasswordAuthentication/d' /etc/ssh/sshd_config && \
    echo "PasswordAuthentication yes" >> /etc/ssh/sshd_config && \
    sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i '/^AuthorizedKeysFile/d' /etc/ssh/sshd_config && \
    echo "AuthorizedKeysFile /home/dev/.ssh/authorized_keys" >> /etc/ssh/sshd_config

# 9. Открываем стандартный порт SSH
EXPOSE 22

# 10. Запускаем SSH-сервер
CMD ["/usr/sbin/sshd", "-D"]
