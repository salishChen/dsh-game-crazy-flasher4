(() => {
  // src/scene-codec.js
  var MAX_SCENE_BYTES = 1024 * 1024;
  async function transform(bytes, stream) {
    const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader(), chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_SCENE_BYTES) {
        await reader.cancel();
        throw Error("\u5F53\u524D\u573A\u666F\u8D85\u8FC7\u4FDD\u5B58\u4E0A\u9650");
      }
      chunks.push(value);
    }
    const result = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
  async function encodeProgress(state) {
    if (!state?.world || state.world.encoding) return structuredClone(state);
    const bytes = new TextEncoder().encode(JSON.stringify(state.world));
    if (bytes.length > MAX_SCENE_BYTES) throw Error("\u5F53\u524D\u573A\u666F\u8D85\u8FC7\u4FDD\u5B58\u4E0A\u9650");
    const compressed = await transform(bytes, new CompressionStream("deflate"));
    if (compressed.length > 9e4) throw Error("\u5F53\u524D\u573A\u666F\u8D85\u8FC7\u4FDD\u5B58\u4F20\u8F93\u4E0A\u9650");
    let binary = "";
    for (const byte of compressed) binary += String.fromCharCode(byte);
    return { ...state, world: { encoding: "deflate-json-v1", data: btoa(binary) } };
  }
  async function decodeProgress(state) {
    if (state?.world?.encoding !== "deflate-json-v1") return state;
    const bytes = Uint8Array.from(atob(state.world.data), (c) => c.charCodeAt(0));
    const raw = await transform(bytes, new DecompressionStream("deflate"));
    return { ...state, world: JSON.parse(new TextDecoder().decode(raw)) };
  }

  // src/wallet.js
  function createRechargeController({ command, apply: apply2, makeId = () => `cf4:${crypto.randomUUID()}`, requestTimeoutMs = 15e3 }) {
    let revision = 0, state = null, wallet = null, pending = null, preparing = false;
    async function request(input) {
      let timer;
      try {
        return await Promise.race([command(input), new Promise((_, reject) => {
          timer = setTimeout(() => reject(Error("\u8BF7\u6C42\u8D85\u65F6\uFF0C\u7ED3\u679C\u5C1A\u672A\u786E\u8BA4")), requestTimeoutMs);
        })]);
      } finally {
        clearTimeout(timer);
      }
    }
    async function accept(result) {
      if (!result || result.ok !== true) throw Object.assign(Error(result?.message || "\u94B1\u5305\u672A\u786E\u8BA4\u8BF7\u6C42"), { code: result?.errorCode });
      revision = result.revision;
      state = await decodeProgress(result.state);
      wallet = result.wallet;
      return { ...result, state };
    }
    async function send() {
      if (!pending) throw Error("\u6CA1\u6709\u9700\u8981\u91CD\u8BD5\u7684\u8BF7\u6C42");
      try {
        const r = await accept(await request(pending));
        pending = null;
        return r;
      } catch (e) {
        if (["PROTOCOL_INVALID", "STALE_RUNTIME", "CAPABILITY_UNAVAILABLE"].includes(e.code)) pending = null;
        throw e;
      }
    }
    async function save2(snapshot) {
      if (pending || preparing) throw Error("\u8BF7\u5148\u786E\u8BA4\u4E0A\u6B21\u8BF7\u6C42");
      if (!snapshot) throw Error("\u8BF7\u5148\u5F00\u59CB\u6E38\u620F");
      preparing = true;
      try {
        pending = structuredClone({ action: "saveGame", operationId: makeId(), expectedRevision: revision, state: await encodeProgress(snapshot) });
      } finally {
        preparing = false;
      }
      return send();
    }
    return {
      get state() {
        return state;
      },
      get wallet() {
        return wallet;
      },
      get revision() {
        return revision;
      },
      get pending() {
        return pending ? structuredClone(pending) : null;
      },
      async load() {
        if (pending) throw Error("\u8BF7\u5148\u786E\u8BA4\u4E0A\u6B21\u8BF7\u6C42");
        return accept(await request({ action: "status" }));
      },
      save: save2,
      async exchange(amount, snapshot) {
        if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1e4) throw Error("\u5151\u6362\u6570\u91CF\u5FC5\u987B\u4E3A 1\u201310000 \u7684\u6574\u6570");
        await save2(snapshot);
        pending = { action: "exchange", operationId: makeId(), expectedRevision: revision, amount };
        const result = await send();
        apply2(result.state);
        return result;
      },
      async retry() {
        const result = await send();
        apply2(result.state);
        return result;
      }
    };
  }

  // src/game.js
  globalThis.CF4Bytes = (key) => {
    globalThis.CF4Decoded ??= {};
    if (!globalThis.CF4Decoded[key]) {
      const raw = atob(globalThis.CF4Assets[key].join(""));
      globalThis.CF4Decoded[key] = Uint8Array.from(raw, (c) => c.charCodeAt(0));
      delete globalThis.CF4Assets[key];
    }
    return globalThis.CF4Decoded[key];
  };
  globalThis.RufflePlayer = { config: { autoplay: "on", splashScreen: false, polyfills: false, publicPath: "https://offline.invalid/", allowScriptAccess: true, allowNetworking: "all", openUrlMode: "deny", showSwfDownload: false, contextMenu: "off", logLevel: "error", preferredRenderer: "canvas", letterbox: "on", backgroundColor: "#05070a" } };
  var $ = (id) => document.getElementById(id);
  var wait = (ms) => new Promise((r) => setTimeout(r, ms));
  var initial = () => ({ coins: 0, stats: { allkilled: 0, manhp: 100, "\u6B66\u5668\u69FD1": "\u65E0", "\u6B66\u5668\u69FD1_\u5F39\u5939\u5185\u5B50\u5F39": 0, "\u6B66\u5668\u69FD1_\u5B50\u5F39\u6570": 0, "\u6B66\u5668\u69FD2": "\u65E0", "\u6B66\u5668\u69FD2_\u5F39\u5939\u5185\u5B50\u5F39": 0, "\u6B66\u5668\u69FD2_\u5B50\u5F39\u6570": 0, "\u6B66\u5668\u69FD4": "grenade", "\u6B66\u5668\u69FD4_\u5F39\u5939\u5185\u5B50\u5F39": 1, "\u6B66\u5668\u69FD4_\u5B50\u5F39\u6570": 2, "\u5200\u79CD": 1, "\u5200\u5A01\u529B": 25, nickname: "\u5C0F\u5C41\u5B69", "\u4E3B\u7EBF\u4EFB\u52A1\u89E3\u9501": 1 } });
  var player;
  var api;
  var controller;
  var sdk;
  var started = false;
  var paused = false;
  var suspended = false;
  var ready = false;
  var loaded = false;
  var walletReady = false;
  var working = false;
  var restored = false;
  var lastSave = Date.now();
  var message = (s) => {
    $("status").textContent = s;
  };
  function status() {
    try {
      return api?.callExternalInterface("cf4Status");
    } catch {
      return null;
    }
  }
  function read() {
    const snapshot = api.callExternalInterface("cf4Read");
    if (!snapshot || snapshot.error) throw Error(snapshot?.error || "\u8BF7\u5148\u5F00\u59CB\u539F\u7248\u6E38\u620F");
    return snapshot;
  }
  function sync() {
    const blocked = working || suspended || Boolean(controller?.pending);
    $("pause").disabled = !loaded || working || suspended;
    $("pause").textContent = paused ? "\u7EE7\u7EED" : "\u6682\u505C";
    $("sound").disabled = !loaded;
    $("continue").disabled = !ready || blocked || started;
    $("continue").textContent = controller?.state ? "\u7EE7\u7EED\u5B58\u6863" : "\u5F00\u59CB\u6E38\u620F";
    $("save").disabled = !started || !walletReady || blocked;
    $("recharge").disabled = !started || !walletReady || blocked;
    $("retry").hidden = walletReady && !controller?.pending || !loaded;
    $("retry").disabled = working || suspended;
    $("retry").textContent = controller?.pending ? "\u91CD\u8BD5\u672A\u786E\u8BA4\u8BF7\u6C42" : "\u91CD\u65B0\u8FDE\u63A5\u94B1\u5305";
    if (controller?.wallet) $("balance").textContent = String(controller.wallet.balance);
    const s = status();
    if (s?.started) $("money").textContent = `\u6E38\u620F\u91D1\u94B1 ${s.coins}`;
  }
  function halt() {
    api?.suspend();
  }
  function resume() {
    if (!paused && !suspended && !working && !controller?.pending && !$("exchange").open) api?.resume();
  }
  function apply(state) {
    if (api.callExternalInterface("cf4Apply", state) !== true) throw Error("\u6E38\u620F\u672A\u786E\u8BA4\u5230\u8D26\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u4EE5\u6062\u590D\u5DF2\u4FDD\u5B58\u8FDB\u5EA6");
  }
  async function restore(state) {
    working = true;
    halt();
    sync();
    try {
      if (api.callExternalInterface("cf4Restore", state) !== true) throw Error("\u5B58\u6863\u6062\u590D\u5931\u8D25");
      api.resume();
      await wait(160);
      halt();
      if (api.callExternalInterface("cf4RestorePrepare") !== true) throw Error("\u573A\u666F\u91CD\u5EFA\u5931\u8D25");
      api.resume();
      await wait(160);
      halt();
      if (api.callExternalInterface("cf4RestoreFinish") !== true) throw Error("\u573A\u666F\u6062\u590D\u5931\u8D25");
      started = true;
      restored = true;
      paused = Boolean(state.world);
      message(state.world ? "\u5DF2\u6062\u590D\u4FDD\u5B58\u65F6\u7684\u5173\u5361\u3001\u4F4D\u7F6E\u3001\u751F\u547D\u548C\u88C5\u5907\uFF1B\u5F53\u524D\u5DF2\u6682\u505C\uFF0C\u70B9\u51FB\u7EE7\u7EED\u3002" : "\u5DF2\u8FDB\u5165\u6E38\u620F\uFF0C\u53EF\u5728\u539F\u7248\u753B\u9762\u64CD\u4F5C\u6216\u4F7F\u7528\u4E0A\u65B9\u6309\u94AE\u3002");
    } finally {
      working = false;
      sync();
      resume();
    }
  }
  async function save({ quiet = false } = {}) {
    if (!started || !walletReady || working || suspended || controller.pending) return false;
    working = true;
    halt();
    sync();
    try {
      await controller.save(read());
      lastSave = Date.now();
      if (!quiet) message(paused ? "\u5DF2\u6682\u505C\uFF0C\u5F53\u524D\u573A\u666F\u8FDB\u5EA6\u5DF2\u4FDD\u5B58\u3002" : "\u5F53\u524D\u5173\u5361\u3001\u4F4D\u7F6E\u3001\u751F\u547D\u3001\u88C5\u5907\u4E0E\u91D1\u94B1\u5DF2\u4FDD\u5B58\u3002");
      return true;
    } catch (e) {
      message(`\u4FDD\u5B58\u5931\u8D25\uFF1A${e.message}${controller.pending ? "\uFF1B\u8BF7\u91CD\u8BD5\u672A\u786E\u8BA4\u8BF7\u6C42\u3002" : ""}`);
      return false;
    } finally {
      lastSave = Date.now();
      working = false;
      sync();
      resume();
    }
  }
  async function connect() {
    try {
      await sdk.lifecycle.ready();
      await controller.load();
      walletReady = true;
      $("balance").textContent = String(controller.wallet.balance);
      message("\u94B1\u5305\u5DF2\u8FDE\u63A5\uFF1B\u8BF7\u5148\u5728\u539F\u7248\u753B\u9762\u5B8C\u6210\u8FDB\u5165\u786E\u8BA4\u3002");
    } catch (e) {
      walletReady = false;
      message(`\u94B1\u5305\u8FDE\u63A5\u5931\u8D25\uFF1A${e.message}\u3002\u8BF7\u91CD\u8F7D\u6E38\u620F\u4E2D\u5FC3\u540E\u91CD\u8BD5\u3002`);
    }
    sync();
  }
  async function boot() {
    try {
      player = globalThis.RufflePlayer.newest().createPlayer();
      player.id = "flash-player";
      $("stage").append(player);
      api = player.ruffle(1);
      await api.load({ data: globalThis.CF4Bytes("swf"), swfFileName: "crazy-flasher4.swf", ...globalThis.RufflePlayer.config });
      loaded = true;
      sync();
      sdk = globalThis.__DSH_GAMECENTER_SDK__;
      if (!sdk?.wallet?.command) throw Error("\u9700\u8981\u4ECE\u652F\u6301\u9CB8\u9CB8\u5E01\u7684\u6E38\u620F\u4E2D\u5FC3\u542F\u52A8");
      controller = createRechargeController({ command: (input) => sdk.wallet.command(input), apply });
      sdk.lifecycle.register({ pause: async () => {
        suspended = true;
        halt();
        while (working) await wait(20);
        sync();
        return { walletRevision: controller.revision, progress: started ? await encodeProgress(read()) : null, pending: Boolean(controller.pending) };
      }, resume: () => {
        suspended = false;
        sync();
        resume();
      } });
      const theme = (t) => document.body.classList.toggle("light", (typeof t === "string" ? t : t?.mode) === "light");
      theme(sdk.theme?.get?.());
      sdk.theme?.subscribe?.(theme);
      await connect();
      setInterval(async () => {
        if (working) return;
        const s = status();
        if (s?.ready && !ready) {
          ready = true;
          $("loading")?.remove();
          if (walletReady && controller.state && !restored) {
            try {
              await restore(controller.state);
            } catch (e) {
              message(e.message);
            }
            return;
          }
          message("\u539F\u7248\u6E38\u620F\u5DF2\u5C31\u7EEA\uFF0C\u53EF\u76F4\u63A5\u4F7F\u7528\u753B\u9762\u91CC\u7684\u5F00\u59CB\u6E38\u620F\uFF0C\u4E5F\u53EF\u70B9\u51FB\u4E0A\u65B9\u5F00\u59CB\u6E38\u620F\u3002");
        }
        if (s?.started && !started) {
          started = true;
          message("\u5DF2\u8BC6\u522B\u539F\u7248\u6E38\u620F\u8FDB\u5EA6\uFF0C\u5145\u503C\u3001\u6682\u505C\u548C\u4FDD\u5B58\u5DF2\u542F\u7528\u3002");
        }
        sync();
        if (started && walletReady && !paused && !suspended && !controller.pending && Date.now() - lastSave >= 5e3) void save({ quiet: true });
      }, 250);
    } catch (e) {
      message(`\u542F\u52A8\u5931\u8D25\uFF1A${e.message}`);
      sync();
    }
  }
  $("continue").onclick = () => void restore(controller?.state ?? initial()).catch((e) => message(e.message));
  $("pause").onclick = async () => {
    paused = !paused;
    if (paused) {
      halt();
      sync();
      if (started && walletReady) await save();
      else message("\u6E38\u620F\u5DF2\u6682\u505C\u3002");
    } else {
      resume();
      sync();
      message("\u7EE7\u7EED\u6E38\u620F\u3002");
    }
  };
  $("save").onclick = () => void save();
  $("sound").onclick = () => {
    api.volume = api.volume > 0 ? 0 : 1;
    $("sound").textContent = api.volume > 0 ? "\u58F0\u97F3\uFF1A\u5F00" : "\u58F0\u97F3\uFF1A\u5173";
  };
  function openExchange() {
    halt();
    $("exchange-status").textContent = controller.pending ? "\u4E0A\u6B21\u8BF7\u6C42\u5C1A\u672A\u786E\u8BA4\uFF0C\u8BF7\u91CD\u8BD5\u786E\u8BA4\u7ED3\u679C\u3002" : "";
    $("confirm").textContent = controller.pending ? "\u91CD\u8BD5\u786E\u8BA4" : "\u786E\u8BA4\u5151\u6362";
    $("exchange").showModal();
  }
  $("recharge").onclick = openExchange;
  $("retry").onclick = () => controller.pending ? openExchange() : void connect();
  $("amount").oninput = () => {
    $("quote").textContent = `\u6D88\u8017 ${$("amount").value} \u9CB8\u9CB8\u5E01\uFF0C\u83B7\u5F97 ${Number($("amount").value) * 10} \u6E38\u620F\u91D1\u94B1`;
  };
  $("exchange").addEventListener("cancel", (e) => {
    if (working || controller?.pending) e.preventDefault();
  });
  $("exchange").addEventListener("close", resume);
  $("cancel").onclick = () => {
    if (!working && !controller.pending) $("exchange").close();
  };
  $("confirm").onclick = async () => {
    if (working) return;
    const amount = Number($("amount").value);
    if (!controller.pending && (!Number.isSafeInteger(amount) || amount < 1 || amount > 1e4)) {
      $("exchange-status").textContent = "\u8BF7\u8F93\u5165 1\u201310000 \u7684\u6574\u6570";
      return;
    }
    working = true;
    sync();
    $("confirm").disabled = true;
    $("cancel").disabled = true;
    $("amount").disabled = true;
    try {
      if (controller.pending) {
        await controller.retry();
        $("exchange-status").textContent = "\u4E0A\u6B21\u8BF7\u6C42\u5DF2\u786E\u8BA4\u3002";
      } else {
        await controller.exchange(amount, read());
        $("exchange-status").textContent = `\u5151\u6362\u6210\u529F\uFF0C\u6E38\u620F\u91D1\u94B1 ${controller.state.coins}`;
      }
      lastSave = Date.now();
      message("\u9CB8\u9CB8\u5E01\u6263\u6B3E\u3001\u6E38\u620F\u91D1\u94B1\u4E0E\u5F53\u524D\u573A\u666F\u5DF2\u4FDD\u5B58\u3002");
    } catch (e) {
      $("exchange-status").textContent = e.message + (controller.pending ? "\uFF1B\u7ED3\u679C\u5F85\u786E\u8BA4\uFF0C\u8BF7\u91CD\u8BD5\u540C\u4E00\u8BF7\u6C42\u3002" : "");
    } finally {
      working = false;
      $("confirm").disabled = false;
      $("cancel").disabled = Boolean(controller.pending);
      $("amount").disabled = Boolean(controller.pending);
      $("confirm").textContent = controller.pending ? "\u91CD\u8BD5\u786E\u8BA4" : "\u786E\u8BA4\u5151\u6362";
      sync();
    }
  };
  window.addEventListener("load", () => void boot());
})();
