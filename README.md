<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# TalkNative (LingoFlow) 

__🎯 你的专属沉浸式英语口语与听力训练私教__

[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?style=flat-square&logo=vercel)](https://vercel.com/)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-blue?style=flat-square&logo=react)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-green?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-orange?style=flat-square)](LICENSE)

</div>

---

## 🌟 项目简介

__TalkNative (LingoFlow)__ 是一款专为英语学习者打造的__沉浸式口语与听力实战平台__。

市面上的英语听力材料往往枯燥且与现实脱节。为了解决这一痛点，TalkNative 结合了 __Google Gemini 2.5 Flash__ 的智能文本生成能力与 __微软 Edge TTS 神经网络语音__ 技术，允许你根据任何想练习的现实场景，一键生成极为地道的美式英语长对话，并配合高亮同步跟读，帮你真正实现“像母语者一样交流”。

---

## ✨ 核心亮点

- 🎬 __场景随心定制__：输入任何你想训练的场景（例如：“在外企面试中解释简历的空窗期”、“在纽约星巴克点冷萃并要求加燕麦奶”、“在伦敦希思罗机场办理退税”），AI 即可在数秒内为你量身定制对话剧本。
- 🗣️ __地道美式英语__：对话角色 Alex 与 Jordan 采用最纯正的当代美式口语（包含 "well", "you know" 等自然语气助词），并且每篇对话中自动融入 12-15 个__常用地道习语（Idioms）和动词短语（Phrasal Verbs）__，附带详细的中文释义 and 用法解析。
- ⚡ __歌词级音画同步高亮__：利用先进的__单词边界对齐技术__，播放语音时网页会像 KTV 滚歌词一样，精确高亮正在发音的单个单词，完美解决“听不清”、“对不上”的痛点。
- 🎙️ __高拟真神经网络人声__：采用微软 Edge TTS 神经网络技术（Alex 对应男声，Jordan 对应女声），发音极为自然，且无需配置任何高昂的第三方语音合成 API Key。
- 🔋 __极致的稳定性保障__：后端内置了 __API Key 自动轮换与静默避让算法__。你可以配置多枚免费的 Gemini API Key，当某个 Key 遭遇限流（429）或暂时不可用（503）时，system会在后台零延迟自动切换下一枚 Key 并重试，对用户的学习体验绝对无打扰！

---

## 🚀 普通用户一键云端部署（推荐，完全免费）

如果你不想在自己电脑上安装复杂的编程软件，可以使用 __Vercel__ 平台将本项目一键部署到云端，生成一个属于你自己的专属英语学习网站，随时随地在手机或电脑上访问。

### 第一步：获取你的 Gemini API 密钥 (API Key)
本项目完全免费，你只需要获取谷歌官方提供的 Gemini 免费 API Key：
1. 访问 [Google AI Studio 官网](https://aistudio.google.com/) 并使用你的 Google 账号登录。
2. 点击左上角的 "Get API key"（获取 API 密钥）按钮。
3. 点击 "Create API key"，选择一个项目，即可生成一串 API 密钥（通常为 AIzaSy 开头的字符串）。将它复制并保存好。
> 💡 __小贴士__：为了防止单个免费 Key 因请求频繁而被限流，你可以在该页面多创建几个 Key 备用。

### 第二步：一键部署到 Vercel
1. 注册或登录 [Vercel 官网](https://vercel.com/)（推荐使用 GitHub 账号直接登录）。
2. 在 Vercel 控制台点击 "Add New" -> "Project"。
3. 导入本项目的 GitHub 仓库 `https://github.com/cf3901646/TalkNative`（你可以先将该仓库 Fork 到你自己的账号下，然后再导入）。
4. 在配置页面，找到 Environment Variables（环境变量） 区域，添加以下两项配置：

| 变量名 (Name) | 变量值 (Value) | 说明 |
| :--- | :--- | :--- |
| GEMINI_API_KEY | 你的Gemini_API_Key | 填入你第一步获取的 API Key。如果有多个，可以用英文逗号隔开，例如 key1,key2,key3，系统会自动实现负载均衡和轮换。 |
| VITE_BACKEND_URL | /api/script | （非常重要） 填入 /api/script，这会引导前端直接使用你刚刚部署 of 你的 Vercel 后端，避免使用原作者的演示服务器。 |

5. 检查无误后，点击 "Deploy" 按钮。
6. 等待 1 分钟左右，Vercel 就会部署完成，并为你提供一个以 `.vercel.app` 结尾的免费专属网址。点击即可开始你的英语口语沉浸之旅！

---

## 💻 极客与开发者本地部署教程

如果你希望在本地电脑上运行并修改项目，请参考以下指南：

### 前提条件
在开始之前，请确保你的电脑已安装以下软件：
- [Node.js](https://nodejs.org/) (建议版本 v18 或更高)
- [Python 3.10+](https://www.python.org/)

### 部署步骤

#### 1. 克隆项目到本地
打开终端（Windows 推荐使用 PowerShell，Mac/Linux 推荐使用 Terminal），运行以下命令：
```bash
git clone https://github.com/cf3901646/TalkNative.git
cd TalkNative
```

#### 2. 配置环境变量
在项目根目录下，新建一个名为 `.env` 的文件，填入以下内容：
```env
# 填入你的 Gemini 密钥。支持逗号分隔配置多个
GEMINI_API_KEY="AIzaSyYourKeyHere"

# 指向你本地的后端剧本生成接口
VITE_BACKEND_URL="http://localhost:8000/api/script"
```

#### 3. 运行本地 Python 后端服务
1. 打开一个新的终端窗口，进入项目中的 `api` 目录：
   ```bash
   cd api
   ```
2. 安装后端所需的 Python 依赖：
   ```bash
   pip install -r requirements.txt
   ```
3. 启动 FastAPI 本地服务器（运行在 8000 端口）：
   ```bash
   uvicorn index:app --reload --port 8000
   ```
   （看到终端输出 `Uvicorn running on http://127.0.0.1:8000` 即表示后端启动成功。）

#### 4. 运行前端网页服务
1. 回到之前的终端窗口（项目根目录下），安装前端所需的依赖包：
   ```bash
   npm install
   ```
2. 启动本地开发服务器：
   ```bash
   npm run dev
   ```
3. 启动成功后，终端会显示本地访问链接（通常是 `http://localhost:5173/`）。
4. 在浏览器中打开该链接，即可在本地完美运行 TalkNative！

---

## 🛠️ 项目技术栈

- 前端：React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons（实现精致的磨砂玻璃微动效 UI）
- 后端：FastAPI + Uvicorn + httpx
- 核心服务：
    - 文本与剧本生成：Google Gemini 2.5 Flash API
    - 高保真语音合成与时间对齐：Microsoft Edge TTS (boundary streaming)

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源。你可以自由修改、分发及商用，但请保留原作者的版权声明。
