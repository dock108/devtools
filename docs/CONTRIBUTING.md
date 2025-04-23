# Contributing to DOCK108 Home

First off, thanks for considering contributing! We appreciate the time and effort you want to give to help make DOCK108 Home better.

This document provides guidelines for contributing to this project. Please adhere to these guidelines to ensure a smooth collaboration process.

## Project Philosophy

We strive for:

- **Clean Commits:** Each commit should represent a single logical change. Follow our commit style guide below.
- **Green CI:** All code pushed must pass linting, type checks, and automated tests. No broken builds on `main`.
- **Clear Communication:** Use GitHub Issues for tracking bugs and features, and Pull Requests for proposing changes.

## Getting Started

1.  **Fork & Clone:** Fork the repository to your GitHub account and clone it locally:
    ```bash
    git clone https://github.com/YOUR_USERNAME/dock108home.git
    cd dock108home
    ```
2.  **Install Dependencies:** This project uses `npm`.
    ```bash
    npm install
    ```
3.  **Run Locally:**
    ```bash
    npm run dev
    ```
    This will start the Next.js development server, usually at `http://localhost:3000`.

## Branching Strategy

Please create branches from the `main` branch using the following naming convention:

- `feature/<short-description>` (e.g., `feature/add-user-profile`) - for new features.
- `fix/<short-description>` (e.g., `fix/header-layout-mobile`) - for bug fixes.
- `chore/<short-description>` (e.g., `chore/upgrade-nextjs`) - for maintenance tasks (build, deps, config).
- `docs/<short-description>` (e.g., `docs/update-readme`) - for documentation changes.

## Commit Style (Conventional Commits)

We follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification. This helps automate changelog generation and provides a clear history.

**Format:**

```
type(scope?): subject

body? # Optional

footer? # Optional, for breaking changes or issue linking
```

**Types:** `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `perf`, `test`.
**Scope:** Optional, indicates the part of the codebase affected (e.g., `feat(api)`, `fix(ui)`).
**Subject:** Concise description of the change (imperative mood, lowercase).

**Example:**

```
feat(auth): add password reset flow

Implement the necessary UI and API endpoints for users to reset their passwords via email.

Closes #123
```

**Linking Issues:** Use `Closes #issue-number` or `Fixes #issue-number` in the commit footer to automatically close the corresponding GitHub issue when the PR is merged.

## Code Style

- **Formatting:** We use Prettier for code formatting. It should be run automatically via editor integrations (e.g., VS Code `Format on Save`) or via `npm run format` (if script exists).
- **Linting:** We use ESLint with the `eslint-config-next` base configuration. Check for issues with:
  ```bash
  npm run lint
  ```
- **TypeScript:** Adhere to static typing. Avoid `any` where possible. Check types with:
  ```bash
  npm run type-check
  ```

## Pull Request (PR) Process

1.  **Create an Issue:** Before starting significant work, please open a GitHub Issue to discuss the proposed changes.
2.  **Branch:** Create a branch from `main` following the naming convention.
3.  **Develop:** Make your changes, adhering to the code style and commit conventions.
4.  **Test:** Ensure your changes pass all checks:
    ```bash
    npm run lint
    npm run type-check
    npm run test # Run unit tests
    # Add command for E2E tests if/when available
    ```
5.  **Update Docs:** If your changes affect documentation (README, CONTRIBUTING, etc.) or require new documentation, update it accordingly.
6.  **Push:** Push your branch to your fork.
7.  **Open PR:** Open a Pull Request against the `main` branch of the original repository.
8.  **Checklist:** Fill out the checklist provided in the PR template.
9.  **Review:** Address any feedback from the maintainers.

### Pull Request Checklist (Template will be added)

- [ ] Code passes `npm run lint` and `npm run type-check`.
- [ ] All unit tests pass (`npm run test`).
- [ ] E2E tests pass (if applicable).
- [ ] Documentation updated (if applicable).
- [ ] Screenshots included for UI changes (if applicable).
- [ ] Commit messages follow Conventional Commits format.
- [ ] Linked to relevant GitHub Issue (`Closes #...`).

## Local Development Hooks (Future)

We plan to implement pre-push hooks using Husky and lint-staged to automatically run checks before you push. Stay tuned!

## 🛠️ IDE Setup (VS Code)

1. Open the command palette → **"Extensions: Show Recommended Extensions"**.
2. Click **"Install All"** to install Prettier, ESLint, Tailwind IntelliSense, Jest, and Docker helpers.
3. VS Code is pre-configured to format on save and run `eslint --fix` automatically, so you'll get instant feedback as you code.

---

Thank you for contributing!
