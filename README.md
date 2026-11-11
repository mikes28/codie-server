# Codie Web Control v2

Clean Codie robot web control interface — based on fully decomposed binary (Rust port ground truth).

## What this is

A Node.js/Express + Socket.IO web application that controls the Codie robot over BLE.
The firmware is a Rust port of the original binary, documented in detail at:

## Firmware

[Codie Firmware Dump](https://github.com/mikes28/codie-firmware-dump) —
`/home/mikes/Documents/codie-firmware-dump/`

The firmware documents every feature in the STM32 binary, from bootloader through
command protocol, LED control, sensor readings, and periodic engines. This webapp
provides a UI to control those features.

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start

# Visit http://localhost:3000 (default port)
```

See `server/package.json` for available scripts.

## Features

The webapp implements a subset of the firmware capabilities, including:

- **LED control** — ARGB strip control, animations, brightness
- **Drive controls** — Speed, distance, turn commands
- **Sensor readings** — Battery, sonar, line sensors, microphone
- **BLE connection** — Scan, connect, disconnect, MAC filtering
- **Command interface** — Free-form proxy commands (`call :proxy <cmd>`)
- **API endpoints** — REST endpoints for robot control

## Repository Structure

```
server/           # Node.js backend
  src/            # Source files
    index.js      # Server entry point
    app.js        # Express app setup
    config.js     # Environment configuration
    ble/          # BLE bindings (noble/dbus)
    routes/       # API routes
    scripts/      # Script runner
    tests/        # Unit tests
public/           # Static files (HTML/CSS/JS)
test/             # Integration tests
```

## Cross-Platform

- **Linux**: Full support (noble + dbus binding)
- **Windows**: Node.js app works; BLE requires `wmi` binding change in
  `server/src/ble/noble.js` line 18
- **macOS**: Should work like Linux (dbus binding)

## Development

- `npm test` — Run unit tests (mock-based, works Ubuntu + Windows in CI)
- `npm run scan` — BLE scan tool
- `npm run console` — Console script runner
- CI runs tests on both Ubuntu + Windows via GitHub Actions

## License

See `server/package.json` for details.