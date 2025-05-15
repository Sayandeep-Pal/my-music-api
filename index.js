const express = require("express");
const app = express();
const port = 3001;

// const fetch = (...args) =>
//   import("node-fetch").then(({ default: fetch }) => fetch(...args));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/search", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Missing 'q' parameter" });

  const collectedSongs = new Map();
  const searchQueue = [query]; // start with original query

  while (searchQueue.length > 0 && collectedSongs.size < 10) {
    const currentQuery = searchQueue.shift();
    try {
      const searchRes = await fetch(
        `https://saavn-api-delta.vercel.app/api/search?query=${currentQuery}`
      );
      const searchData = await searchRes.json();

      const songs = searchData?.data?.songs?.results || [];

      for (const song of songs) {
        if (collectedSongs.size >= 10) break;
        if (collectedSongs.has(song.id)) continue;

        try {
          const mediaRes = await fetch(
            `https://music-api-liart-ten.vercel.app/song/?query=${song.url}`
          );

          if (!mediaRes.ok) continue;
          const media = await mediaRes.json();
          if (!media.media_url) continue;

          collectedSongs.set(song.id, {
            id: song.id,
            song: song.title,
            singers: song.singers || song.primaryArtists,
            image:
              song.image.find((img) => img.quality === "150x150")?.url || "",
            media_url: media.media_url,
            perma_url: song.url,
            album: song.album,
            duration: media.duration || "0",
            language: song.language,
            year:
              searchData.data.albums?.results.find((album) =>
                album.songIds?.includes(song.id)
              )?.year || "",
          });

          // Add more context to the queue for expansion
          if (song.singers) searchQueue.push(song.singers.split(",")[0]);
          if (song.album) searchQueue.push(song.album);
        } catch (err) {
          console.error(`Error processing song: ${song.title}`, err.message);
        }
      }
    } catch (err) {
      console.error(`Search error for query "${currentQuery}":`, err.message);
    }
  }

  res.json([...collectedSongs.values()]);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
