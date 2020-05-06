const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const { exec } = require("child_process");

/* Get command-line args */
let headingTitleA = process.argv[2]
let headingTitleB = process.argv[3]
let urls = []
process.argv.forEach((arg, i) => {
  if (i > 3) {
    urls.push(arg);
  }
});

/* Return the iframe html string for a (small sized) bandcamp track player.
   Example: <iframe style="border: 0; width: 100%; height: 42px;" src="https://bandcamp.com/EmbeddedPlayer/album=3214757306/size=small/bgcol=ffffff/linkcol=0687f5/track=2295968844/transparent=true/" seamless><a href="http://pezzettino.bandcamp.com/album/venus">Venus by Pezzettino</a></iframe>
*/
const embedPlayer = async (
  albumId,
  trackId,
  albumPathFull,
  albumName,
  artistName
) => {
  return (
    `<iframe style="border: 0; width: 100%; height: 42px;" ` +
    `src="https://bandcamp.com/EmbeddedPlayer/album=${albumId}/size=small/bgcol=ffffff/linkcol=0687f5/track=${trackId}/transparent=true/" ` +
    `seamless><a href="${albumPathFull}">${albumName} by ${artistName}</a></iframe>`
  );
};

/* Return the extracted info from the page as an array */
const extractDataFromPage = async (url) => {
  const res = await axios.get(url);
  const { data: html } = res;

  const $ = cheerio.load(html);

  const parsedTrackData = JSON.parse($("#pagedata")[0].attribs["data-blob"]);
  const { album_id: albumId, track_id: trackId } = parsedTrackData;

  const albumBase = url.match(/https?:\/\/[!-z]+.com/)[0];
  const albumPath = $(".buyAlbumLink").find("a#buyAlbumLink").attr("href");
  const albumPathFull = (albumBase + albumPath).replace("https", "http");

  const albumName = $(".fromAlbum").text();
  const artistName = $("span[itemprop=byArtist]").find("a").text();

  const trackName = $("h2.trackTitle").text().trim();

  return [albumId, trackId, albumPathFull, albumName, artistName, trackName];
};

/* Return the track link html string */
const trackLink = (artistName, trackName, url) => {
  return `[${trackName} by ${artistName}](${url})`;
};

/* Main method */
const run = async () => {
  exec(`mkdir generated`);

  let trackLinks = [];
  let embedPlayers = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];

    let [
      albumId,
      trackId,
      albumPathFull,
      albumName,
      artistName,
      trackName,
    ] = await extractDataFromPage(url);
    trackLinks.push(trackLink(artistName, trackName, url));
    embedPlayers.push(
      await embedPlayer(albumId, trackId, albumPathFull, albumName, artistName)
    );
  }

  var writeStream = fs.createWriteStream("generated/generated.md", {
    flags: "w", // 'a' means appending (old data will be preserved)
  });

  writeStream.write(`# ${headingTitleA}  \n`);
  for (let i = 0; i < trackLinks.length; i++) {
    writeStream.write(`${i + 1}. ${trackLinks[i]}` + "  \n");
  }

  writeStream.write("\n");
  writeStream.write(`# ${headingTitleB}  \n`);
  for (let i = 0; i < embedPlayers.length; i++) {
    writeStream.write(embedPlayers[i] + "  \n");
  }
};

run();
