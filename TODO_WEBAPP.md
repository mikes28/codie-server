# Webapp Implementation Todo

This file lists all the features that need to be implemented in the web interface
(`server/`), based on the firmware capabilities documented in
`/home/mikes/Documents/codie-firmware-dump/`. The webapp is a Node.js/Express +
Socket.IO application that controls the Codie robot via BLE.

## Priority P0 — Bootloader & Basic Control
- [ ] **Bootloader entry UI** — PA12 USB detect, PC13 button state, magic word entry
  (implemented in firmware, needs web UI to trigger/expose)
- [ ] **LED animation control** — Red LED state tracking (state 4 = solid red) for
  bootloader entry; UI buttons to trigger bootloader mode
- [ ] **USB VBUS detect status** — Show when USB is connected (PA12 pin state)

## Priority P1 — Periodic Engines / Tick Features
- [ ] **BLE link service tick (800 ms)** — Periodic BLE link status check; currently
  `ble_com::link_service_tick()` in firmware; UI should display link status
- [ ] **Line sensor service tick (0x37 ms)** — Read both line sensors via `hwi_line::read()`
  and display sensor values on web UI; drive LED 0/1 brightness proportionally
- [ ] **Mic sample tick (500 ms)** — Display microphone audio levels; 500 ms tracking
  filter over the mic ADC group
- [ ] **Buzzer tone sequencer** — UI to play tones; non-blocking queue from firmware
  `hwi_buzz::tick()`
- [ ] **Drive speed loop** — Display current speed loop error (`err / 4`), clamp ±100%;
  UI controls for left/right speed
- [ ] **Light-sense sample** — Read ambient light values; currently `app_lightsense::tick()`
- [ ] **LED animation queue (max 3 entries)** — FIFO queue for LED programs; UI to add/
  pop animations (programs 0-6)

## Priority P2 — LED & Output Controls
- [ ] **ARGB LED control** — UI for:
  - `set hwiLed argb <led> <r> <g> <b>` (individual LED)
  - `set hwiLed argb all <r> <g> <b>` (all LEDs)
  - `get hwiLed argb <led>` (read individual)
  - `set hwiLed argb brightness <0-255>` (global brightness)
  - `get hwiLed argb brightness` (read global)
- [ ] **Single-LED refresh** — UI control for single-outline transfer (ARR 0x308)
- [ ] **LED chase animation** — Program 5 (legacy chase) UI control
- [ ] **Sine-wave brightness fader** — Program 6 (legacy sine) UI control
- [ ] **LED strip control via TIM15+DMA** — Show 12 LED ARGB strip status

## Priority P3 — Drive & Motor Controls
- [ ] **Drive distance** — UI for `drive_distance` (mm, left/right speed)
- [ ] **Drive turn** — UI for `drive_turn` (degree, speed)
- [ ] **Drive speed** — UI for `drive_speed` (left/right speed i8 %)
- [ ] **Fault detection** — GPIOA PA12 fault polling (from firmware tick)
- [ ] **nFault status** — Display fault flag (always "0" in firmware, but UI should show)

## Priority P4 — Sensor & Telemetry Displays
- [ ] **Battery display** — Read voltage/current/remainingCapacity/chargeStat/temp
  from `drv_battery::handler()`
- [ ] **Sonar distance** — Display sonar range (mm); `CMD_SONAR` command
- [ ] **Line sensor values** — Both line sensor bits as binary/decimal display
- [ ] **Light sensor value** — Raw light ADC value
- [ ] **Temperature** — Read from battery/hwInit sensors

## Priority P5 — Protocol / Command Interface
- [ ] **Command input field** — Free-form command entry (`<get|set|call> <iface> <op> [args]`)
- [ ] **Proxy command dispatch** — Send `call :proxy <command>` via web
- [ ] **Greeting/reply display** — Show greeting (ver/mat/date/ttpms/+ack)
- [ ] **Message command** — Send arbitrary system messages
- [ ] **Log level control** — Set log levels (inf/dbg/wrn/err)
- [ ] **Error message display** — Show "Invalid command!", "No interface:", buffer overflow errors

## Priority P6 — BLE Connection & Discovery
- [ ] **BLE device scan** — Discover Codie robots; filter by name/UUID/MAC
- [ ] **Connection management** — Connect/disconnect to paired robots
- [ ] **MAC allowlist** — Add/remove allowlisted MAC addresses
- [ ] **Robot filter UI** — Name filter, UUID filter, MAC allow/block list
- [ ] **Auto-connect settings** — Configure robots to auto-connect on startup

## Priority P7 — API Endpoints (REST)
- [ ] **`GET /api/health`** — Health check endpoint
- [ ] **`GET /api/robots`** — List connected robots
- [ ] **`POST /api/robots/:address/command`** — Send a command to a robot
- [ ] **`POST /api/robots/:address/start-script`** — Start a script on a robot
- [ ] **`POST /api/robots/:address/stop-script`** — Stop a running script
- [ ] **`GET /api/robots/:address/script-status`** — Script status check

## Priority P8 — Cross-Platform / Infrastructure
- [ ] **Windows compatibility** — Ensure Express + Socket.IO works on Windows (currently
  Linux-oriented via noble/dbus)
- [ ] **Linux compatibility** — Verify BLE backend (noble with dbus binding)
- [ ] **Docker support** — Multi-platform Docker image (currently planned via GitHub Actions)
- [ ] **Environment configuration** — `.env` file support for port, host, BLE settings
- [ ] **Graceful shutdown** — Signal handlers for SIGINT/SIGTERM

## Priority P9 — Admin Page
- [ ] **Bluetooth management interface** — Scan for available BLE devices, display all connected robots, manage MAC allowlist, configure auto-connect settings, refresh device list, toggle Bluetooth on/off
- [ ] **Robot inventory** — List all connected robots with status (connected/disconnected), signal strength, last seen, firmware version
- [ ] **Global settings** — Default robot filter, default LED colors, default drive parameters, system-wide log level
- [ ] **Robot operations** — Firmware reset, bootloader entry trigger, power hold on/off, global command broadcast to all robots
- [ ] **User management** (if multi-user) — Assign roles, configure per-robot access levels

## Priority P10 — User Page (per-robot control)
- [ ] **Robot header** — Robot name, connection status, battery level, signal strength
- [ ] **Control panel** — Drive speed (left/right sliders), turn, distance commands
- [ ] **LED control** — Quick ARGB color picker, animation presets (chase, sine, solid), brightness slider
- [ ] **Sensor dashboard** — Real-time battery voltage/current, sonar distance, line sensor states, microphone levels
- [ ] **Command quick-box** — Preset buttons for common commands (forward, backward, stop, left, right, beep, LED on/off)
- [ ] **Script controls** — Start/stop script dropdown, script status display
- [ ] **Connection controls** — Connect/disconnect button, reconnect button, MAC address display
- [ ] **Error/toast notifications** — Connection lost, command failed, battery low, robot detected

## Notes
- All firmware features are documented in `/home/mikes/Documents/codie-firmware-dump/FEATURES.md`
- The Rust port status (✅/❌/⚠️) is tracked in that same file
- Unit tests exist in `server/test/`; new UI features should have corresponding test coverage
- The webapp currently mocks BLE hardware in tests (no physical robot needed)