/**
 * 通过 GitHub Git Data API 推送本地 HEAD 提交的全部内容。
 * 适用场景：网络环境封锁 github.com:443（git push 走不通），但 api.github.com 可达。
 * 依赖：gh 已登录（gh auth status 正常），且当前目录是本项目的 git 仓库。
 * 用法：node scripts/api-push.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = 'youzhaiZhi/passvault';
const BRANCH = 'main';

function api(path, method, body) {
  if (!body) {
    return execSync(`gh api ${path}`, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  }
  const tmp = join(tmpdir(), `ghapi-${Date.now()}-${Math.random().toString(36).slice(2)}.json`).replace(/\\/g, '/');
  writeFileSync(tmp, JSON.stringify(body));
  try {
    return execSync(`gh api -X ${method} ${path} --input "${tmp}"`, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (e) {
    const err = e.stderr ? e.stderr.toString() : String(e);
    throw new Error(`API 调用失败 ${path}: ${err}`);
  } finally {
    rmSync(tmp, { force: true });
  }
}

const files = execSync('git ls-files', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const message = execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim();
const localHead = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();

// 远端当前 main 的 commit（空仓库 / 新仓库可能没有）
let remoteHead = null;
try {
  const ref = JSON.parse(api(`repos/${REPO}/git/ref/heads/${BRANCH}`, 'GET'));
  remoteHead = ref.object.sha;
} catch {
  console.log('远端还没有 main 分支，将创建');
}

// 逐文件创建 blob（base64，走临时 JSON 文件避免命令行长度限制）
const treeItems = [];
for (const f of files) {
  const content = readFileSync(f).toString('base64');
  const blob = JSON.parse(api(`repos/${REPO}/git/blobs`, 'POST', { content, encoding: 'base64' }));
  treeItems.push({ path: f, mode: '100644', type: 'blob', sha: blob.sha });
  process.stdout.write(`blob ✓ ${f}\n`);
}

// 基于远端 HEAD 的树创建新树（保持远端已有、本地没有的文件不删除；本项目场景下两边一致）
const treeBody = remoteHead
  ? { base_tree: remoteHead, tree: treeItems }
  : { tree: treeItems };
const tree = JSON.parse(api(`repos/${REPO}/git/trees`, 'POST', treeBody));

const commit = JSON.parse(
  api(`repos/${REPO}/git/commits`, 'POST', {
    message,
    tree: tree.sha,
    parents: remoteHead ? [remoteHead] : [],
  }),
);
console.log(`commit ✓ ${commit.sha.slice(0, 8)}`);

if (remoteHead) {
  api(`repos/${REPO}/git/refs/heads/${BRANCH}`, 'PATCH', { sha: commit.sha, force: false });
} else {
  api(`repos/${REPO}/git/refs`, 'POST', { ref: `refs/heads/${BRANCH}`, sha: commit.sha });
}
console.log(`推送完成：本地 ${localHead.slice(0, 8)} 的内容已提交到 ${REPO}:${BRANCH}（${commit.sha.slice(0, 8)}）`);
console.log('注意：API 推送不保留本地与远端的 sha 对应关系，仅同步文件内容。');
