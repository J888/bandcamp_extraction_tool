const axios = require('axios')
const cheerio = require('cheerio')
const download = require('image-downloader')
const fs = require('fs')
const { exec } = require('child_process')

const FILES_OUTPUT_FOLDER = `generated`
const frontMatter = (date) =>
  `---\ntitle:\ndate: '${date}'\ncategory: weekly\nfeaturedImgUrl:\nfeaturedImgAlt:\n---`

/* Get command-line args */
let headingTitleA = process.argv[2]
let headingTitleB = process.argv[3]
let urls = []
process.argv.forEach((arg, i) => {
  if (i > 3) {
    urls.push(arg)
  }
})

/* Return the iframe html string for a (small sized) bandcamp track player.
   Example: <iframe style="border: 0; width: 100%; height: 42px;" src="https://bandcamp.com/EmbeddedPlayer/album=3214757306/size=small/bgcol=ffffff/linkcol=0687f5/track=2295968844/transparent=true/" seamless><a href="http://pezzettino.bandcamp.com/album/venus">Venus by Pezzettino</a></iframe>
*/
const embedPlayer = (
  albumId,
  trackId,
  albumPathFull,
  albumName,
  artistName,
  trackName
) => {
  if (albumId) {
    return (
      `<iframe style="border: 0; width: 100%; height: 42px;" ` +
      `src="https://bandcamp.com/EmbeddedPlayer/album=${albumId}/size=small/bgcol=ffffff/linkcol=0687f5/track=${trackId}/transparent=true/" ` +
      `seamless><a href="${albumPathFull}">${albumName} by ${artistName}</a></iframe>`
    )
  } else {
    // if this track has no parent album
    return (
      `<iframe style="border: 0; width: 100%; height: 42px;" ` +
      `src="https://bandcamp.com/EmbeddedPlayer/track=${trackId}/size=small/bgcol=ffffff/linkcol=0687f5/transparent=true/" ` +
      `seamless><a href="${albumPathFull}">${trackName} by ${artistName}</a></iframe>`
    )
  }
}

/* Return the extracted info from the page as an array */
const extractDataFromPage = async (url) => {
  const res = await axios.get(url)
  const { data: html } = res

  const $ = cheerio.load(html)

  const parsedTrackData = JSON.parse($('#pagedata')[0].attribs['data-blob'])
  const { album_id: albumId, track_id: trackId } = parsedTrackData

  const albumPathFull = $('meta[property="og:url"]')
    .attr('content')
    .replace('https', 'http')
  const albumName = $('.fromAlbum').text()
  const artistName = $('span[itemprop=byArtist]').find('a').text()

  const trackName = $('h2.trackTitle').text().trim()

  const imageUrl = $('a.popupImage').find('img').attr('src')

  return [
    albumId,
    trackId,
    albumPathFull,
    albumName,
    artistName,
    trackName,
    imageUrl,
  ]
}

/* Return the track link html string */
const trackLink = (artistName, trackName, url) => {
  return `[${trackName} by ${artistName}](${url})`
}

/* Main method */
const run = async () => {
  exec(`mkdir ${FILES_OUTPUT_FOLDER}`)
  exec(`mkdir ${FILES_OUTPUT_FOLDER}/markdown`)
  exec(`mkdir ${FILES_OUTPUT_FOLDER}/images`)

  let trackLinks = []
  let embedPlayers = []
  let imageUrls = []

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]

    let [
      albumId,
      trackId,
      albumPathFull,
      albumName,
      artistName,
      trackName,
      imageUrl,
    ] = await extractDataFromPage(url)

    imageUrls.push(imageUrl)

    trackLinks.push(trackLink(artistName, trackName, url))

    embedPlayers.push(
      embedPlayer(
        albumId,
        trackId,
        albumPathFull,
        albumName,
        artistName,
        trackName
      )
    )
  }

  /* Open write stream */
  var writeStream = fs.createWriteStream(
    `${FILES_OUTPUT_FOLDER}/markdown/generated.md`,
    {
      flags: 'w',
    }
  )

  /* Write frontmatter */
  const currentDate = new Date().toISOString().substring(0, 10)
  writeStream.write(`${frontMatter(currentDate)}\n\n`)

  /* -- Write body -- */
  writeStream.write(`# ${headingTitleA}  \n`)
  for (let i = 0; i < trackLinks.length; i++) {
    writeStream.write(`${i + 1}. ${trackLinks[i]}` + '  \n')
  }

  writeStream.write('\n')
  writeStream.write(`# ${headingTitleB}  \n`)
  for (let i = 0; i < embedPlayers.length; i++) {
    writeStream.write(embedPlayers[i] + '  \n')
  }
  /* -- finished writing body -- */

  /* Download images */
  for (let i = 0; i < imageUrls.length; i++) {
    let url = imageUrls[i]
    let dest = `${FILES_OUTPUT_FOLDER}/images`

    download.image({ url, dest })
  }
}

run()
