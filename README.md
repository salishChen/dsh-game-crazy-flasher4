# 闪客快打4：枪林弹雨 · 游戏中心版

使用用户提供的原版 Flash 8 / ActionScript 2 SWF，通过离线 Ruffle 0.7.1 保留原版画面、关卡、武器与玩法。新增游戏中心入口、暂停、音量、进度保存和鲸鲸币兑换。分类：动作、射击、冒险。

先在原版画面完成进入确认，可以点击原版画面的“开始游戏”，也可以使用上方“开始游戏”。已有存档会自动恢复并暂停，点击“继续”即可接着玩。WASD 移动，鼠标瞄准射击，R 换弹，1–4 换武器；其余操作以原版帮助为准。顶部兑换比例为 1 鲸鲸币 = 10 游戏金钱，余额及扣款来自游戏中心宿主账本。

0.2.0 保存当前关卡、角色位置、生命、敌人状态、场景对象、武器弹药、金钱和任务解锁；每 5 秒自动保存，点击暂停或保存也会写入当前进度。关闭游戏前会冻结场景并确认保存，再释放 iframe；重开恢复到保存时的关卡和位置，初始保持暂停。存档采用游戏状态快照，原版场景与动态对象重新建立后恢复属性和位置，动画与音效重新开始。旧版仅含角色属性的存档仍可从整备区继续。充值时先保存当前场景，再原子扣款并增加金钱；确认丢失时点击“重试未确认请求”，不会重复扣款。

`assets/original.swf` 的 SHA-256 必须为 `4f41e62500fd6542f6e497bf71089db8a62e2d089504bbab1dc0b6f82b15f736`。补丁工具只编译新增桥接脚本，在第 6 帧加入独立 DoAction，逐标签验证原版内容未被改写。原始文件保留；不改游戏价格或奖励。

构建（仓库根目录执行，先安装项目依赖并构建 protocol）：

```powershell
python games/crazy-flasher4/scripts/patch-swf.py --java <JAVA_EXE> --ffdec <FFDEC_JAR>
node games/crazy-flasher4/scripts/build.mjs
pnpm -C packages/dsh-gamecenter exec tsc -p tsconfig.staging.json
node --test games/crazy-flasher4/test/*.test.mjs
pnpm -C packages/dsh-gamecenter-client run build:candidate
node tools/flash-full-client-qa.mjs
```

已生成 `assets/game.swf`，仅修改 HTML/JS 时不必重新编译 SWF。运行器、WASM 和 SWF 被打成 1 MiB 以下的本地 JS 分片；`dist/` 为安装产物，不执行安装脚本、不依赖 CDN。游戏包约 25.8 MB，要求新版游戏中心的 32 MiB 总体积限制与 WASM CSP。

Ruffle 源代码项目为 https://github.com/ruffle-rs/ruffle，运行器按 MIT / Apache-2.0 双许可证使用，许可证位于 `vendor/ruffle/`。用户提供的游戏素材不因此改为开源，也不因本地接入自动获得公开再分发许可。

详细开发与充值接入流程见 [Flash 接入指南](../../docs/flash-game-integration.md)。完整浏览器 QA 必须经过真实 Client 白名单、MessagePort Dispatcher、Host 租约和 SQLite 钱包转发，不能用直接调用账本代替实际接入。浏览器 QA 使用明确标记的模拟用量生成测试鲸鲸币，不是实际模型消费证据。
