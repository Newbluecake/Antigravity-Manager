# Web Admin - End-to-End Test Plan

**Feature**: Web Admin Interface
**Version**: v3.4.1
**Date**: 2025-01-12

---

## 1. Prerequisites

- **Build**: Ensure the app is built with `npm run build` and `cargo build --release`.
- **Environment**:
  - Application running on the host machine.
  - Optional: A second device (phone/laptop) connected to the same LAN for testing remote access.
- **Default Credentials**:
  - Password: `admin`

---

## 2. Test Cases

### TC01: Local Access & Static File Serving (T-501)
**Objective**: Verify `dist/` files are served correctly from the Rust backend.

1. **Step**: Open browser on the host machine.
2. **Step**: Visit `http://127.0.0.1:8046/`.
3. **Expected**:
   - Automatically redirects to `/admin`.
   - Loads the Web Admin login page (Dark theme).
   - No 404 errors in browser console for `.js` or `.css` assets.

### TC02: Authentication Flow
**Objective**: Verify login security and session persistence.

1. **Step**: Enter wrong password (e.g., `123456`) and click Login.
   - **Expected**: Error message "Invalid password".
2. **Step**: Enter correct password (`admin`) and click Login.
   - **Expected**: Successfully redirects to Dashboard.
3. **Step**: Refresh the page.
   - **Expected**: Remains logged in (Token persists in localStorage).
4. **Step**: Click "Logout" in the sidebar.
   - **Expected**: Redirects back to Login page.
   - **Expected**: Trying to access `/dashboard` manually redirects to Login.

### TC03: LAN Access Toggle (T-502)
**Objective**: Verify the switch between Localhost-only and LAN mode.

1. **Step**: Go to Settings -> Advanced in the desktop app.
2. **Step**: Ensure "Allow LAN Access to Web Admin" is **OFF** (Default).
3. **Step**: Try to access `http://[Host-LAN-IP]:8046/admin` from the same machine or another device.
   - **Expected**: Connection refused or timeout (Service should NOT be listening on 0.0.0.0).
4. **Step**: **Enable** "Allow LAN Access" in Settings.
5. **Step**: **Restart** the application.
6. **Step**: Try to access `http://[Host-LAN-IP]:8046/admin` again.
   - **Expected**: Login page loads successfully.
   - **Note**: Ensure host firewall allows traffic on port 8046.

### TC04: Dashboard & Data
**Objective**: Verify real-time data display.

1. **Step**: Log in to Web Admin.
2. **Step**: Check the "Total Accounts" card.
   - **Expected**: Matches the number of accounts in the desktop app.
3. **Step**: Check "Proxy Status".
   - **Expected**: Shows "Stopped" or "Running" matching actual state.

### TC05: Proxy Control
**Objective**: Verify remote control capabilities.

1. **Step**: Go to "Proxy" page in Web Admin.
2. **Step**: Click "Start Proxy".
   - **Expected**: Status changes to "Running".
   - **Verification**: Desktop app also shows proxy as running.
3. **Step**: Click "Stop Proxy".
   - **Expected**: Status changes to "Stopped".

### TC06: Account Management
**Objective**: Verify account operations.

1. **Step**: Go to "Accounts" page.
2. **Step**: Find an account and click "Refresh Quota".
   - **Expected**: Success toast message appears.
   - **Expected**: "Last Used" time updates if changed.

### TC07: Logs Viewing
**Objective**: Verify system log access.

1. **Step**: Go to "Logs" page.
2. **Step**: Select a log file from the left list.
   - **Expected**: Log content loads in the right panel.
   - **Expected**: Content matches local log files.

---

## 3. Troubleshooting

- **Cannot access LAN IP**:
  - Check Windows Firewall / macOS Firewall.
  - Ensure "Allow LAN Access" is ON and App restarted.
  - Verify IP address is correct.
- **Login fails repeatedly**:
  - Check `web_admin.db` in data directory.
  - Reset password if necessary (requires DB edit currently).
- **Assets 404**:
  - Verify `dist/` folder existed during `cargo build`.
  - Check if binary was rebuilt after frontend changes.
