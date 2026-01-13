# Release Process

1.  **Update Version Numbers**
    *   `package.json`: Update `version` field.
    *   `src-tauri/tauri.conf.json`: Update `version` field.
    *   `src-tauri/Cargo.toml`: Update `version` field.
    *   `src/admin/pages/LoginPage.tsx`: Update version string in footer.
    *   `src/pages/Settings.tsx`: Update version badge in About tab.

2.  **Commit Changes**
    ```bash
    git add .
    git commit -m "chore(release): bump version to x.y.z"
    ```

3.  **Tag and Push**
    ```bash
    git tag vx.y.z
    git push origin main --tags
    ```

4.  **Build**
    *   CI/CD (GitHub Actions) will automatically build the release when a tag is pushed.
