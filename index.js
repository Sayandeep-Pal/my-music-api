const express = require("express");
const app = express();
const port = 3001;

app.get("/", (req, res) => {
  res.send("Hello World!");
});



app.get("/search", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Missing 'q' parameter" });

  try {
    const searchRes = await fetch(
      `https://saavn-api-delta.vercel.app/api/search?query=${query}`
    );
    const searchData = await searchRes.json();

    const songs = searchData?.data?.songs?.results || [];

    const enrichedSongs = await Promise.all(
      songs.map(async (song) => {
        try {
          const mediaRes = await fetch(
            `https://music-api-liart-ten.vercel.app/song/?query=${song.url}`
          );

          if (!mediaRes.ok) {
            console.error(`Media fetch failed for ${song.title}`);
            return null;
          }

          const media = await mediaRes.json();
          if(media.media_url === null){
            return null
          }

          return {
            id: song.id,
            song: song.title,
            singers: song.singers || song.primaryArtists,
            image:
              song.image.find((img) => img.quality === "150x150")?.url || "",
            media_url: media.media_url,
            perma_url: song.url,
            album: song.album,
            duration: media.duration || "0", // ✅ Now uses accurate duration
            language: song.language,
            year:
              searchData.data.albums?.results.find((album) =>
                album.songIds?.includes(song.id)
              )?.year || "",
          };
        } catch (err) {
          console.error(`Error processing song: ${song.title}`, err.message);
          return null;
        }
      })
    );
      

    const finalResponse = enrichedSongs.filter(Boolean); // Remove nulls
    res.json(finalResponse);
  } catch (err) {
    console.error("Search API error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
  

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
