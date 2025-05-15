const express = require("express");
const app = express();
const port = 3001;

// Load `node-fetch` dynamically for compatibility
// const fetch = (...args) =>
//   import("node-fetch").then(({ default: fetch }) => fetch(...args));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/search", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Missing 'q' parameter" });

  const collectedSongs = new Map();
  const visitedQueries = new Set();
  const searchQueue = [query];

  const maxResults = 7;

  while (searchQueue.length > 0 && collectedSongs.size < maxResults) {
    const currentQuery = searchQueue.shift();
    if (visitedQueries.has(currentQuery)) continue;
    visitedQueries.add(currentQuery);

    try {
      const searchRes = await fetch(
        `https://saavn-api-delta.vercel.app/api/search?query=${currentQuery}`
      );
      const searchData = await searchRes.json();
      const songs = searchData?.data?.songs?.results || [];
      const albums = searchData?.data?.albums?.results || [];

      const albumYearMap = new Map();
      for (const album of albums) {
        if (Array.isArray(album.songIds)) {
          album.songIds.forEach((id) => albumYearMap.set(id, album.year || ""));
        }
      }

      const songFetchTasks = [];

      for (const song of songs) {
        if (!song?.id || !song?.url || collectedSongs.has(song.id)) continue;

        songFetchTasks.push(
          fetch(
            `https://music-api-liart-ten.vercel.app/song/?query=${song.url}`
          )
            .then((mediaRes) => {
              if (!mediaRes.ok) return null;
              return mediaRes.json().then((media) => {
                if (!media?.media_url) return null;

                collectedSongs.set(song.id, {
                  id: song.id,
                  song: song.title,
                  singers: song.singers || song.primaryArtists,
                  image:
                    song.image.find((img) => img.quality === "150x150")?.url ||
                    "",
                  media_url: media.media_url,
                  perma_url: song.url,
                  album: song.album,
                  duration: media.duration || "0",
                  language: song.language,
                  year: albumYearMap.get(song.id) || "",
                });

                if (song.singers) searchQueue.push(song.singers.split(",")[0]);
                if (song.album) searchQueue.push(song.album);

                return true;
              });
            })
            .catch((err) => {
              console.error(
                `Media fetch failed for ${song.title}: ${err.message}`
              );
              return null;
            })
        );

        if (songFetchTasks.length >= 10) break;
      }

      await Promise.allSettled(songFetchTasks);

      if (collectedSongs.size >= maxResults) break;
    } catch (err) {
      console.error(`Search error for query "${currentQuery}":`, err.message);
    }
  }

  res.json([...collectedSongs.values()].slice(0, maxResults));
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
