import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import fssync from "node:fs";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { gunzipSync } from "node:zlib";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const projectService = await import(path.join(repoRoot, "dist/main/project-service.js"));
const snapshotService = await import(path.join(repoRoot, "dist/main/snapshot-service.js"));

async function createTempProject(prefix = "wit-core-") {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  const projectPath = path.join(root, "project");
  await fs.mkdir(projectPath, { recursive: true });
  return { root, projectPath };
}

test("project initialization and metadata defaults", async () => {
  const { root, projectPath } = await createTempProject();

  try {
    await projectService.ensureProjectInitialized(projectPath);

    assert.equal(fssync.existsSync(path.join(projectPath, ".wit", "config.json")), true);
    assert.equal(fssync.existsSync(path.join(projectPath, ".wit", "stats.json")), true);
    assert.equal(fssync.existsSync(path.join(projectPath, ".wit", "snapshots")), true);
    assert.equal(fssync.existsSync(path.join(projectPath, ".gitignore")), true);
    assert.equal(
      fssync.existsSync(
        path.join(projectPath, ".wit", "snapshots", snapshotService.SNAPSHOT_VERSION_FILE_NAME)
      ),
      true
    );
    assert.equal(await fs.readFile(path.join(projectPath, ".gitignore"), "utf8"), ".wit/snapshots/\n");

    const metadata = await projectService.getProjectMetadata(projectPath);
    assert.equal(metadata.projectPath, projectPath);
    assert.deepEqual(metadata.files, []);
    assert.deepEqual(metadata.folders, []);
    assert.equal(metadata.wordCount, 0);
    assert.equal(metadata.totalWritingSeconds, 0);
    assert.equal(metadata.latestSnapshotCreatedAt, null);
    assert.equal(metadata.isGitRepository, false);
    assert.equal(metadata.hasGitInitialCommit, false);
    assert.deepEqual(metadata.gitRemotes, []);
    assert.equal(metadata.lastOpenedFilePath, null);
    assert.equal(metadata.hasStoredLastOpenedFilePath, false);
    assert.equal(metadata.settings.autosaveIntervalSec, 300);
    assert.equal(metadata.settings.theme, "light");
    assert.equal(metadata.settings.defaultFileExtension, ".md");
    assert.equal(metadata.settings.showWordCount, false);
    assert.equal(metadata.settings.showWritingTime, false);
    assert.equal(metadata.settings.showCurrentFileBar, false);
    assert.equal(metadata.settings.smartQuotes, true);
    assert.equal(metadata.settings.gitSnapshots, false);
    assert.equal(metadata.settings.gitPushRemote, null);
    assert.equal(metadata.settings.editorLineHeight, 1.68);
    assert.equal(metadata.settings.editorParagraphSpacing, "none");
    assert.equal(metadata.settings.editorMaxWidthPx, 750);
    assert.equal(metadata.settings.editorZoomPercent, 100);
    assert.equal(metadata.settings.editorFontFamily, "iA Writer Mono");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("create/list/save/read files with word count and settings", async () => {
  const { root, projectPath } = await createTempProject();

  try {
    await projectService.ensureProjectInitialized(projectPath);
    await projectService.createProjectFile(projectPath, "chapter-01.txt", "One two three");
    await projectService.createProjectFile(projectPath, "notes/outline.md", "A B");

    const files = await projectService.listProjectFiles(projectPath);
    assert.deepEqual(files, ["chapter-01.txt", "notes/outline.md"]);

    const readBefore = await projectService.readProjectFile(projectPath, "chapter-01.txt");
    assert.equal(readBefore, "One two three");

    await projectService.saveProjectFile(projectPath, "chapter-01.txt", "One two three four five");
    const readAfter = await projectService.readProjectFile(projectPath, "chapter-01.txt");
    assert.equal(readAfter, "One two three four five");

    const totalWordCount = await projectService.calculateTotalWordCount(projectPath);
    assert.equal(totalWordCount, 7);

    const savedSettings = await projectService.saveSettings(projectPath, {
      autosaveIntervalSec: 1,
      theme: "dark",
      defaultFileExtension: ".txt",
      showWordCount: false,
      showWritingTime: false,
      showCurrentFileBar: false,
      smartQuotes: false,
      gitSnapshots: true,
      gitPushRemote: "origin",
      editorLineHeight: 9,
      editorParagraphSpacing: "very-loose",
      editorMaxWidthPx: 9999,
      editorZoomPercent: 999,
      editorFontFamily: ""
    });

    assert.equal(savedSettings.autosaveIntervalSec, 5);
    assert.equal(savedSettings.theme, "dark");
    assert.equal(savedSettings.defaultFileExtension, ".txt");
    assert.equal(savedSettings.showWordCount, false);
    assert.equal(savedSettings.showWritingTime, false);
    assert.equal(savedSettings.showCurrentFileBar, false);
    assert.equal(savedSettings.smartQuotes, false);
    assert.equal(savedSettings.gitSnapshots, true);
    assert.equal(savedSettings.gitPushRemote, null);
    assert.equal(savedSettings.editorLineHeight, 2.4);
    assert.equal(savedSettings.editorParagraphSpacing, "very-loose");
    assert.equal(savedSettings.editorMaxWidthPx, 1200);
    assert.equal(savedSettings.editorZoomPercent, 250);

    await projectService.addWritingSeconds(projectPath, 25);
    const stats = await projectService.getProjectStats(projectPath);
    assert.equal(stats.totalWritingSeconds, 25);

    await assert.rejects(
      () => projectService.createProjectFile(projectPath, "chapter-01.txt", "duplicate"),
      /File already exists/
    );

    await assert.rejects(
      () => projectService.createProjectFile(projectPath, "outside/../..//escape.txt", "x"),
      /Path escapes project root/
    );

    await assert.rejects(
      () => projectService.createProjectFile(projectPath, "invalid.bin", "x"),
      /Only plain text and Markdown files are supported/
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("last opened file path is stored independently from project settings", async () => {
  const { root, projectPath } = await createTempProject();

  try {
    await projectService.ensureProjectInitialized(projectPath);
    await projectService.createProjectFile(projectPath, "chapter-01.txt", "One two three");

    const firstSavedPath = await projectService.saveLastOpenedFilePath(projectPath, "chapter-01.txt");
    assert.equal(firstSavedPath, "chapter-01.txt");

    let metadata = await projectService.getProjectMetadata(projectPath);
    assert.equal(metadata.lastOpenedFilePath, "chapter-01.txt");
    assert.equal(metadata.hasStoredLastOpenedFilePath, true);

    const clearedPath = await projectService.saveLastOpenedFilePath(projectPath, null);
    assert.equal(clearedPath, null);

    metadata = await projectService.getProjectMetadata(projectPath);
    assert.equal(metadata.lastOpenedFilePath, null);
    assert.equal(metadata.hasStoredLastOpenedFilePath, true);
    assert.equal(metadata.settings.editorFontFamily, "iA Writer Mono");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("project initialization preserves an existing .gitignore", async () => {
  const { root, projectPath } = await createTempProject();

  try {
    await fs.writeFile(path.join(projectPath, ".gitignore"), "node_modules/\n", "utf8");
    await projectService.ensureProjectInitialized(projectPath);

    assert.equal(await fs.readFile(path.join(projectPath, ".gitignore"), "utf8"), "node_modules/\n");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("snapshot creation and git snapshot commit flow", async () => {
  const { root, projectPath } = await createTempProject();

  try {
    await projectService.ensureProjectInitialized(projectPath);
    await fs.writeFile(path.join(projectPath, ".gitignore"), ".wit/\n", "utf8");
    await projectService.createProjectFile(projectPath, "chapter.txt", "Initial");

    const snapshotDir = projectService.getSnapshotDirectory(projectPath);
    const files = await projectService.listProjectFiles(projectPath);
    const snapshotName = await snapshotService.createSnapshot({
      projectPath,
      snapshotDirectory: snapshotDir,
      filePaths: files,
      snapshotMaxSizeMb: 10,
      createGitCommit: false,
      pushGitCommit: false,
      gitPushRemote: null
    });

    const snapshotArchive = path.join(snapshotDir, `${snapshotName}.json.gz`);
    assert.equal(fssync.existsSync(snapshotArchive), true);
    const snapshotVersionRaw = await fs.readFile(
      path.join(snapshotDir, snapshotService.SNAPSHOT_VERSION_FILE_NAME),
      "utf8"
    );
    const snapshotVersion = JSON.parse(snapshotVersionRaw);
    assert.equal(snapshotVersion.version, snapshotService.SNAPSHOT_SYSTEM_VERSION);

    const snapshotPayload = JSON.parse(gunzipSync(await fs.readFile(snapshotArchive)).toString("utf8"));
    assert.equal(snapshotPayload.version, 1);
    assert.equal(snapshotPayload.createdAt, snapshotName);
    assert.equal(snapshotPayload.files["chapter.txt"], "Initial");

    const metadataAfterSnapshot = await projectService.getProjectMetadata(projectPath);
    assert.equal(metadataAfterSnapshot.latestSnapshotCreatedAt, snapshotName);

    await execFileAsync("git", ["init", "-q", projectPath]);
    await execFileAsync("git", ["-C", projectPath, "config", "user.email", "qa@example.com"]);
    await execFileAsync("git", ["-C", projectPath, "config", "user.name", "QA"]);
    await execFileAsync("git", ["-C", projectPath, "add", "."]);
    await execFileAsync("git", ["-C", projectPath, "commit", "-m", "init", "--quiet"]);

    await projectService.saveProjectFile(projectPath, "chapter.txt", "Changed for snapshot commit");

    await snapshotService.createSnapshot({
      projectPath,
      snapshotDirectory: snapshotDir,
      filePaths: await projectService.listProjectFiles(projectPath),
      snapshotMaxSizeMb: 10,
      createGitCommit: true,
      pushGitCommit: false,
      gitPushRemote: null
    });

    const status = await execFileAsync("git", ["-C", projectPath, "status", "--porcelain"]);
    assert.equal(status.stdout.trim(), "");

    const witTracked = await execFileAsync("git", ["-C", projectPath, "ls-files", ".wit"]);
    assert.equal(witTracked.stdout.trim(), "");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("git snapshot commit stages deleted writing files", async () => {
  const { root, projectPath } = await createTempProject();

  try {
    await projectService.ensureProjectInitialized(projectPath);
    await fs.writeFile(path.join(projectPath, ".gitignore"), ".wit/\n", "utf8");
    await projectService.createProjectFile(projectPath, "chapter.txt", "Initial");

    await execFileAsync("git", ["init", "-q", projectPath]);
    await execFileAsync("git", ["-C", projectPath, "config", "user.email", "qa@example.com"]);
    await execFileAsync("git", ["-C", projectPath, "config", "user.name", "QA"]);
    await execFileAsync("git", ["-C", projectPath, "add", "."]);
    await execFileAsync("git", ["-C", projectPath, "commit", "-m", "init", "--quiet"]);

    await projectService.deleteProjectEntry(projectPath, "chapter.txt", "file");

    const snapshotDir = projectService.getSnapshotDirectory(projectPath);
    await snapshotService.createSnapshot({
      projectPath,
      snapshotDirectory: snapshotDir,
      filePaths: await projectService.listProjectFiles(projectPath),
      snapshotMaxSizeMb: 10,
      createGitCommit: true,
      pushGitCommit: false,
      gitPushRemote: null
    });

    const status = await execFileAsync("git", ["-C", projectPath, "status", "--porcelain"]);
    assert.equal(status.stdout.trim(), "");

    const lastCommitFiles = await execFileAsync("git", [
      "-C",
      projectPath,
      "show",
      "--name-status",
      "--format=",
      "HEAD"
    ]);
    assert.match(lastCommitFiles.stdout, /^D\tchapter\.txt$/m);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("project metadata reports git repository status", async () => {
  const { root, projectPath } = await createTempProject();

  try {
    await projectService.ensureProjectInitialized(projectPath);
    let metadata = await projectService.getProjectMetadata(projectPath);
    assert.equal(metadata.isGitRepository, false);
    assert.equal(metadata.hasGitInitialCommit, false);

    await execFileAsync("git", ["init", "-q", projectPath]);
    metadata = await projectService.getProjectMetadata(projectPath);
    assert.equal(metadata.isGitRepository, true);
    assert.equal(metadata.hasGitInitialCommit, false);
    assert.deepEqual(metadata.gitRemotes, []);

    await execFileAsync("git", ["-C", projectPath, "config", "user.email", "qa@example.com"]);
    await execFileAsync("git", ["-C", projectPath, "config", "user.name", "QA"]);
    await execFileAsync("git", ["-C", projectPath, "add", "."]);
    await execFileAsync("git", ["-C", projectPath, "commit", "-m", "init", "--quiet"]);

    metadata = await projectService.getProjectMetadata(projectPath);
    assert.equal(metadata.isGitRepository, true);
    assert.equal(metadata.hasGitInitialCommit, true);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("initializeGitRepository creates a repository and initial commit", async () => {
  const { root, projectPath } = await createTempProject();

  try {
    await projectService.ensureProjectInitialized(projectPath);
    await projectService.createProjectFile(projectPath, "chapter.txt", "hello");

    await projectService.initializeGitRepository(projectPath);

    const metadata = await projectService.getProjectMetadata(projectPath);
    assert.equal(metadata.isGitRepository, true);
    assert.equal(metadata.hasGitInitialCommit, true);

    const commitCount = await execFileAsync("git", ["-C", projectPath, "rev-list", "--count", "HEAD"]);
    assert.equal(commitCount.stdout.trim(), "1");

    const trackedFiles = await execFileAsync("git", ["-C", projectPath, "ls-files"]);
    assert.match(trackedFiles.stdout, /chapter\.txt/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("settings normalize git auto-push remote against configured remotes", async () => {
  const { root, projectPath } = await createTempProject();
  const remoteRoot = await fs.mkdtemp(path.join(os.tmpdir(), "wit-core-remote-"));
  const remotePath = path.join(remoteRoot, "origin.git");

  try {
    await projectService.ensureProjectInitialized(projectPath);
    await execFileAsync("git", ["init", "-q", projectPath]);
    await execFileAsync("git", ["init", "--bare", "-q", remotePath]);
    await execFileAsync("git", ["-C", projectPath, "remote", "add", "origin", remotePath]);

    const savedSettings = await projectService.saveSettings(projectPath, {
      autosaveIntervalSec: 60,
      theme: "light",
      defaultFileExtension: ".md",
      showWordCount: true,
      showWritingTime: true,
      showCurrentFileBar: true,
      smartQuotes: true,
      gitSnapshots: true,
      gitPushRemote: "origin",
      editorLineHeight: 1.68,
      editorParagraphSpacing: "tight",
      editorMaxWidthPx: 750,
      editorZoomPercent: 100,
      editorFontFamily: "Readerly"
    });

    assert.equal(savedSettings.gitPushRemote, "origin");

    const metadata = await projectService.getProjectMetadata(projectPath);
    assert.deepEqual(metadata.gitRemotes, ["origin"]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(remoteRoot, { recursive: true, force: true });
  }
});

test("settings keep git push remote disabled by default even when remotes exist", async () => {
  const { root, projectPath } = await createTempProject();
  const remoteRoot = await fs.mkdtemp(path.join(os.tmpdir(), "wit-core-remote-default-"));
  const remotePath = path.join(remoteRoot, "origin.git");

  try {
    await projectService.ensureProjectInitialized(projectPath);
    await execFileAsync("git", ["init", "-q", projectPath]);
    await execFileAsync("git", ["init", "--bare", "-q", remotePath]);
    await execFileAsync("git", ["-C", projectPath, "remote", "add", "origin", remotePath]);

    const savedSettings = await projectService.saveSettings(projectPath, {
      autosaveIntervalSec: 60,
      theme: "light",
      defaultFileExtension: ".txt",
      showWordCount: true,
      showWritingTime: true,
      showCurrentFileBar: true,
      smartQuotes: true,
      gitSnapshots: true,
      gitPushRemote: null,
      editorLineHeight: 1.68,
      editorParagraphSpacing: "none",
      editorMaxWidthPx: 750,
      editorZoomPercent: 100,
      editorFontFamily: "Readerly"
    });

    assert.equal(savedSettings.gitPushRemote, null);

    const metadata = await projectService.getProjectMetadata(projectPath);
    assert.equal(metadata.settings.gitPushRemote, null);
    assert.deepEqual(metadata.gitRemotes, ["origin"]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(remoteRoot, { recursive: true, force: true });
  }
});

test("listProjectFiles filters by supported text extensions and ignores system directories", async () => {
  const { root, projectPath } = await createTempProject();

  try {
    await projectService.ensureProjectInitialized(projectPath);
    await fs.mkdir(path.join(projectPath, "nested"), { recursive: true });
    await fs.mkdir(path.join(projectPath, ".git"), { recursive: true });
    await fs.mkdir(path.join(projectPath, "node_modules"), { recursive: true });

    await fs.writeFile(path.join(projectPath, "book.txt"), "book", "utf8");
    await fs.writeFile(path.join(projectPath, "chapter.md"), "chapter", "utf8");
    await fs.writeFile(path.join(projectPath, "notes.markdown"), "notes", "utf8");
    await fs.writeFile(path.join(projectPath, "scene.text"), "scene", "utf8");
    await fs.writeFile(path.join(projectPath, "binary.bin"), "bin", "utf8");
    await fs.writeFile(path.join(projectPath, ".git", "ignored.txt"), "ignored", "utf8");
    await fs.writeFile(path.join(projectPath, "node_modules", "ignored.md"), "ignored", "utf8");
    await fs.writeFile(path.join(projectPath, "nested", "nested.txt"), "nested", "utf8");

    const files = await projectService.listProjectFiles(projectPath);
    assert.deepEqual(files, [
      "book.txt",
      "chapter.md",
      "nested/nested.txt",
      "notes.markdown",
      "scene.text"
    ]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("createProjectFolder creates nested folders and exposes them in metadata", async () => {
  const { root, projectPath } = await createTempProject();

  try {
    await projectService.ensureProjectInitialized(projectPath);
    await projectService.createProjectFolder(projectPath, "notes/ideas");
    await projectService.createProjectFile(projectPath, "notes/ideas/chapter.txt", "hello");

    const folders = await projectService.listProjectFolders(projectPath);
    assert.deepEqual(folders, ["notes", "notes/ideas"]);

    const metadata = await projectService.getProjectMetadata(projectPath);
    assert.deepEqual(metadata.folders, ["notes", "notes/ideas"]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("moveProjectFile moves a file into an existing folder and prevents collisions", async () => {
  const { root, projectPath } = await createTempProject();

  try {
    await projectService.ensureProjectInitialized(projectPath);
    await projectService.createProjectFolder(projectPath, "drafts");
    await projectService.createProjectFile(projectPath, "chapter.txt", "hello");
    await projectService.createProjectFile(projectPath, "drafts/chapter.txt", "existing");

    await assert.rejects(
      () => projectService.moveProjectFile(projectPath, "chapter.txt", "drafts"),
      /already exists/
    );

    await projectService.deleteProjectEntry(projectPath, "drafts/chapter.txt", "file");
    const movedPath = await projectService.moveProjectFile(projectPath, "chapter.txt", "drafts");
    assert.equal(movedPath, "drafts/chapter.txt");

    assert.equal(fssync.existsSync(path.join(projectPath, "chapter.txt")), false);
    assert.equal(fssync.existsSync(path.join(projectPath, "drafts", "chapter.txt")), true);

    const movedBackPath = await projectService.moveProjectFile(projectPath, "drafts/chapter.txt", "");
    assert.equal(movedBackPath, "chapter.txt");
    assert.equal(fssync.existsSync(path.join(projectPath, "chapter.txt")), true);
    assert.equal(fssync.existsSync(path.join(projectPath, "drafts", "chapter.txt")), false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("renameProjectEntry renames files and folders while preserving project safety", async () => {
  const { root, projectPath } = await createTempProject();

  try {
    await projectService.ensureProjectInitialized(projectPath);
    await projectService.createProjectFolder(projectPath, "drafts");
    await projectService.createProjectFile(projectPath, "drafts/scene.txt", "hello");

    const renamedFolder = await projectService.renameProjectEntry(
      projectPath,
      "drafts",
      "folder",
      "chapters"
    );
    assert.equal(renamedFolder, "chapters");
    assert.equal(fssync.existsSync(path.join(projectPath, "chapters", "scene.txt")), true);
    assert.equal(fssync.existsSync(path.join(projectPath, "drafts")), false);

    const renamedFile = await projectService.renameProjectEntry(
      projectPath,
      "chapters/scene.txt",
      "file",
      "chapters/opening.txt"
    );
    assert.equal(renamedFile, "chapters/opening.txt");
    assert.equal(fssync.existsSync(path.join(projectPath, "chapters", "opening.txt")), true);
    assert.equal(fssync.existsSync(path.join(projectPath, "chapters", "scene.txt")), false);

    await projectService.createProjectFile(projectPath, "chapters/existing.txt", "x");
    await assert.rejects(
      () => projectService.renameProjectEntry(projectPath, "chapters/opening.txt", "file", "chapters/existing.txt"),
      /already exists/
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("deleteProjectEntry removes files and folders safely", async () => {
  const { root, projectPath } = await createTempProject();

  try {
    await projectService.ensureProjectInitialized(projectPath);
    await projectService.createProjectFolder(projectPath, "drafts/ch1");
    await projectService.createProjectFile(projectPath, "drafts/ch1/scene.txt", "hello");
    await projectService.createProjectFile(projectPath, "keep.txt", "keep");

    await projectService.deleteProjectEntry(projectPath, "drafts/ch1/scene.txt", "file");
    assert.equal(fssync.existsSync(path.join(projectPath, "drafts", "ch1", "scene.txt")), false);

    await projectService.deleteProjectEntry(projectPath, "drafts", "folder");
    assert.equal(fssync.existsSync(path.join(projectPath, "drafts")), false);
    assert.equal(fssync.existsSync(path.join(projectPath, "keep.txt")), true);

    await assert.rejects(
      () => projectService.deleteProjectEntry(projectPath, "missing.txt", "file"),
      /does not exist/
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("path traversal is blocked for read/save sync and async file operations", async () => {
  const { root, projectPath } = await createTempProject();

  try {
    await projectService.ensureProjectInitialized(projectPath);
    await projectService.createProjectFile(projectPath, "safe.txt", "safe");

    await assert.rejects(
      () => projectService.readProjectFile(projectPath, "../escape.txt"),
      /Path escapes project root/
    );

    await assert.rejects(
      () => projectService.saveProjectFile(projectPath, "../escape.txt", "bad"),
      /Path escapes project root/
    );

    assert.throws(
      () => projectService.saveProjectFileSync(projectPath, "../escape.txt", "bad"),
      /Path escapes project root/
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("snapshot pruning removes oldest snapshots when folder exceeds size limit", async () => {
  const { root, projectPath } = await createTempProject();

  try {
    await projectService.ensureProjectInitialized(projectPath);
    await projectService.createProjectFile(projectPath, "book.txt", "draft");

    const snapshotDir = projectService.getSnapshotDirectory(projectPath);
    const padding = "x".repeat(1024);
    for (let i = 0; i < 20; i += 1) {
      const label = String(i).padStart(3, "0");
      await fs.writeFile(path.join(snapshotDir, `2000-01-01T00-00-00-${label}Z.json.gz`), padding, "utf8");
    }

    // Use a tiny size limit (1 KB) so old snapshots get pruned.
    await snapshotService.createSnapshot({
      projectPath,
      snapshotDirectory: snapshotDir,
      filePaths: await projectService.listProjectFiles(projectPath),
      snapshotMaxSizeMb: 0.001,
      createGitCommit: false,
      pushGitCommit: false,
      gitPushRemote: null
    });

    const entries = await fs.readdir(snapshotDir);
    const snapshotArchives = entries.filter((entry) => entry.endsWith(".json.gz"));
    assert.equal(snapshotArchives.length < 20, true);
    assert.equal(snapshotArchives.length >= 1, true);
    assert.equal(entries.includes(snapshotService.SNAPSHOT_VERSION_FILE_NAME), true);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
