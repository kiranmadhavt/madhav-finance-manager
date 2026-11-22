# Personal Finance Manager – AI Development Rules

## Project Objective

Build a personal and family finance management PWA
with future native iOS migration in mind.

## Technology

- HTML5
- CSS3
- Vanilla JavaScript ES6 modules
- Chart.js
- LocalStorage
- Service Workers
- GitHub Actions

## Strict Requirements

1. No Firebase or cloud databases.
2. No authentication or user accounts.
3. No business or corporate accounting features.
4. All financial records remain on the device.
5. Support offline operation.
6. Use INR currency and en-IN formatting.
7. Keep financial calculations separate from UI.
8. Use versioned JSON backups.
9. Never silently delete or overwrite financial data.
10. Follow mobile-first responsive design.

## Development Rules

- Do not put the entire application in one file.
- Use modular JavaScript.
- Validate all user inputs.
- Avoid unsafe DOM manipulation.
- Test financial calculations before deployment.
- Do not introduce unnecessary dependencies.
- Do not change the architecture without documenting it.

## Future Compatibility

Keep the finance calculation logic and data
structures portable to Swift and SwiftData.

## Development Workflow

1. Read project documentation before making changes.
2. Inspect existing files before editing.
3. Make small, focused changes.
4. Run relevant tests.
5. Report modified files and test results.
6. Never overwrite user data during development.
