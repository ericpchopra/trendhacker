# GriffinGPT

Upload an educational PDF, pick a topic, and watch Peter and Stewie Griffin explain it in a short-form video — complete with real voices and Minecraft parkour footage.

## Setup

### 1. Clone the repo and install dependencies

```bash
npm install
```

### 2. Add your API keys

Create a `.env.local` file in the root of the project:

```
GROQ_API_KEY=your_groq_api_key
FISH_AUDIO_API_KEY=your_fish_audio_api_key
```

- Get a Groq API key at https://console.groq.com
- Get a Fish Audio API key at https://fish.audio

### 3. Add the gameplay video

The app requires a Minecraft parkour background video (or actually any brainrot background video, pick your poison I guess). After cloning, drop the following file into `public/minecraft/`:

```
Minecraft Parkour 7 Minutes Free To Use Gameplay 4K 65 - GameplaysForFree (1080p).mp4
```

The filename must match exactly. You can find this video on YouTube — it's free to use.

### 4. FFmpeg

No manual FFmpeg installation needed. The project uses `ffmpeg-static`, which bundles FFmpeg automatically as part of `npm install`.

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

*The genius brainchild of Piyush Chopra and also Sidak Singh Sethi.*
