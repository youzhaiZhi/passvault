# 🔐 密码盒 PassVault

一个本地优先、零知识的密码 / API Key 管理器（Web 版）。所有数据在浏览器本地加密存储，不经过任何服务器。

![Build and Deploy](https://github.com/youzhaiZhi/passvault/actions/workflows/deploy.yml/badge.svg)

**在线使用（GitHub Pages）**：<https://youzhaizhi.github.io/passvault/>

## 功能

- **三类条目**：网站登录（网址/用户名/密码/TOTP 密钥）、API Key（服务商/Key/Secret/有效期）、安全笔记
- **本地加密**：主密码 → PBKDF2-HMAC-SHA256（600,000 次迭代）→ AES-256-GCM，每条数据独立随机 IV
- **主密码校验器**：独立盐派生，不暴露保险库密钥
- **搜索 / 分类 / 收藏**，标题明文便于检索，敏感字段全部加密
- **密码生成器**：WebCrypto 随机源 + 拒绝采样，排除易混淆字符
- **一键复制**，剪贴板 30 秒后自动清空
- **自动锁定**：空闲可配置（1/5/15 分钟），密钥只存在内存
- **加密备份**：导出/导入用独立口令整包加密的 JSON 文件
- **修改主密码**：全量重新加密
- **危险区**：输入"删除"二次确认后清空本机数据

## 安全模型

```
主密码 --PBKDF2(600k, salt)--> AES-256-GCM 密钥（只在内存）
                                   │
                     加密每条条目的敏感字段（独立随机 IV）
                                   │
                     密文存入浏览器 IndexedDB（本机）
```

- 服务器（GitHub Pages）只托管静态 JS 文件，**接触不到任何用户数据**
- 明文密码永不落盘、永不上传；导出的备份文件本身也是密文
- 主密码不可找回——忘记即数据永久丢失，请务必定期导出备份并妥善保存
- 注意：标题字段为明文存储（为了不解锁也能搜索的折中），介意者可自行改为全字段加密

## 本地开发

```bash
npm install
npm run dev        # 开发服务器
npm run build      # 类型检查 + 构建
npm run preview    # 预览构建产物
node --experimental-strip-types scripts/smoke.ts   # 加密层冒烟测试
```

> 需要 Node 20+（WebCrypto、structuredClone 等）。

## 部署

推送到 `main` 分支后，GitHub Actions 自动构建并发布到 GitHub Pages（见 `.github/workflows/deploy.yml`）。
首次使用需在仓库 Settings → Pages 中把 Source 设为 **GitHub Actions**。

## 路线图

- [ ] TOTP 动态验证码生成（密钥字段已预留）
- [ ] 密码体检：弱密码 / 重复使用检测
- [ ] 泄露检查（HIBP k-anonymity API）
- [ ] WebDAV / 云盘端到端加密同步
- [ ] 用 Capacitor 打包 iOS / Android App（复用全部加密与 UI 代码，配原生安全存储与生物识别）

## 免责声明

本项目为个人使用的密码管理工具，加密实现基于浏览器原生 WebCrypto，未经第三方安全审计。请自行评估风险，重要账号建议配合硬件密钥/官方两步验证使用。
