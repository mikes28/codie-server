# Codie web control — Node.js/Express + Socket.IO BLE backend.
#
# BLE talks to BlueZ over D-Bus, so the container needs access to the host
# system bus (mount /var/run/dbus) and Bluetooth device access
# (--device=/dev/hci0 or --privileged) on Linux. Windows/macOS do not support
# the dbus noble binding; see README "Cross-Platform".
#
# Build:
#   docker build -t codie-webcontrol .
# Run (Linux, host Bluetooth):
#   docker run --rm -p 3000:3000 --device=/dev/hci0:/dev/hci0 \
#     -v /var/run/dbus:/var/run/dbus codie-webcontrol

FROM node:24-alpine

WORKDIR /app

# BlueZ + dbus headers/runtime for the @stoprocent/noble dbus binding.
RUN apk add --no-cache dbus bluez bluez-dev python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server

EXPOSE 3000

ENV PORT=3000 HOST=0.0.0.0

CMD ["node", "server/src/index.js"]
