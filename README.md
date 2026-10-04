# Claude Code Pixel Pet 小克

住在 Claude Code 输入框上方的 8-bit 像素电子宠物。它会跟着 Claude 正在做的事换动作，可以摸摸、喂食、戳一下，还能通过 Haiku 跟你聊天。

<p>
  <img src="docs/idle.svg" width="176" alt="发呆">
  <img src="docs/bash.svg" width="176" alt="敲命令">
  <img src="docs/read.svg" width="176" alt="翻资料">
  <img src="docs/edit.svg" width="176" alt="改代码">
</p>
<p>
  <img src="docs/done.svg" width="176" alt="搞定">
  <img src="docs/pet.svg" width="176" alt="被摸摸">
  <img src="docs/eat.svg" width="176" alt="吃饭饭">
  <img src="docs/sleep.svg" width="176" alt="睡着了">
</p>

## 功能

- **跟着任务变**：收到消息后思考，运行命令时敲电脑，读文件时翻书，改代码时拿笔写，上网时举放大镜，派子任务时叫出一个迷你分身；工具报错时哭，一轮完成时挥手蹦跳，10 分钟没动静会睡着。
- **互动**：摸摸、喂食（喂多了会撑）、戳一下（连续戳会生气）、鼠标悬停冒爱心。等级和亲密度会保存下来，换会话也不会丢。
- **Haiku 聊天**：点「聊天」直接跟它对话；一轮比较长的任务结束后，它会说一句感想（最多每 40 秒一次，比较省额度）。
- **额度一览**：显示 5 小时和每周额度（8 格像素进度条，按用量变绿、黄、红），重置倒计时，本次会话的上下文 token 数和花费。
- **命令**：`/pet` 收起或展开，`/pet name 新名字` 改名，`/pet stats` 查看数据。

桌面版（Code 标签页）显示完整的像素画面；终端里显示颜文字版本。

## 安装

需要较新版本的 Claude Code，并且支持插件函数钩子（目前是早期预览接口，开发时用的是 2.1.287）。

1. 把仓库克隆到本地：

   ```bash
   git clone https://github.com/zhizunbao-studio/claude-code-pixel-pet.git ~/.claude/mods/pixel-pet
   ```

2. 在 `~/.claude/settings.json` 的最外层加上：

   ```json
   "env": {
     "CLAUDE_CODE_PLUGIN_DIRS": "~/.claude/mods/pixel-pet",
     "CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1"
   }
   ```

3. 新开一个会话，小克就会出现在输入框上方。

只想试一次的话，也可以在终端里直接运行 `claude --plugin-dir ~/.claude/mods/pixel-pet`。

## 开发

```bash
claude plugin validate .
claude plugin test .
```

## 声明

这是一个非官方的粉丝作品，与 Anthropic 没有任何关联，也没有得到 Anthropic 的认可。小克的像素造型来自 Claude Code 的吉祥物，相关形象和商标归 Anthropic 所有；如果权利方提出要求，会立即移除。

代码部分以 MIT 协议开源（见 [LICENSE](LICENSE)），不包括上述吉祥物形象。
